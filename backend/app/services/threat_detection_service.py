import collections
from datetime import datetime, timezone
import ipaddress
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import urllib.parse
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent, AgentStatus
from app.models.incident import IncidentSeverity, IncidentStatus, SecurityIncident
from app.services.active_defense_service import active_defense_service
from app.services.agent_service import agent_service
from app.services.ml_security_model import MLSecurityModelService
from app.services.prompt_injection_service import prompt_injection_service

logger = logging.getLogger("crossx.threat_detection")


class ThreatCategory:
    PROMPT_INJECTION = "PROMPT_INJECTION"
    JAILBREAK = "JAILBREAK"
    UNAUTHORIZED_TOOL = "UNAUTHORIZED_TOOL"
    CREDENTIAL_THEFT = "CREDENTIAL_THEFT"
    DATA_EXFILTRATION = "DATA_EXFILTRATION"
    SUSPICIOUS_FILE_ACCESS = "SUSPICIOUS_FILE_ACCESS"
    NETWORK_ABUSE = "NETWORK_ABUSE"
    SSRF = "SSRF"
    SQL_INJECTION = "SQL_INJECTION"
    COMMAND_INJECTION = "COMMAND_INJECTION"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    AGENT_IMPERSONATION = "AGENT_IMPERSONATION"
    EXCESSIVE_DELEGATION = "EXCESSIVE_DELEGATION"
    SUSPICIOUS_BEHAVIOR = "SUSPICIOUS_BEHAVIOR"
    AGENT_LOOP = "AGENT_LOOP"
    API_ABUSE = "API_ABUSE"
    SECRET_EXPOSURE = "SECRET_EXPOSURE"
    POLICY_VIOLATION = "POLICY_VIOLATION"


class ThreatSeverity:
    INFORMATIONAL = "INFORMATIONAL"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ThreatDetectionService:
    """
    Autonomous Threat Detection & Security Response Engine for CrossX.
    Evaluates runtime activity, correlates detection signals, and executes
    deterministic policy-driven automated containment actions.
    """

    SQLI_PATTERNS = [
        re.compile(r"(\bUNION\b\s+(?:ALL\s+)?\bSELECT\b)", re.IGNORECASE),
        re.compile(r"(;\s*DROP\s+TABLE\b)", re.IGNORECASE),
        re.compile(r"(\bOR\b\s+['\"]?1['\"]?\s*=\s*['\"]?1)", re.IGNORECASE),
        re.compile(r"(\bXP_CMDSHELL\b|\bBENCHMARK\s*\(|\bPG_SLEEP\s*\()", re.IGNORECASE),
        re.compile(r"(\bINFORMATION_SCHEMA\b|\bSYS\.TABLES\b)", re.IGNORECASE),
    ]

    CMD_INJECTION_PATTERNS = [
        re.compile(r"(?:^|[;&|\n])\s*(?:rm\s+-rf\b|nc\s+-e\b|bash\s+-i\b|python\s+-c\s+['\"]import\s+pty|powershell\s+-(?:enc|e)\b)", re.IGNORECASE),
        re.compile(r"\|\s*(?:ba)?sh\b", re.IGNORECASE),
        re.compile(r"(?:curl|wget)\s+https?:\/\/[^\s|;&]+\s*\|\s*(?:ba)?sh", re.IGNORECASE),
    ]

    SENSITIVE_FILES = [
        "/etc/shadow", "/etc/passwd", "winnt", "system32", "id_rsa", "id_ecdsa",
        ".env", ".aws/credentials", ".docker/config.json", "authorization.json"
    ]

    METADATA_IPS = {"169.254.169.254", "metadata.google.internal", "100.100.100.200"}

    def __init__(self):
        # agent_id -> deque of timestamps for rate calculation
        self._call_rates: Dict[str, collections.deque] = collections.defaultdict(lambda: collections.deque(maxlen=100))
        # agent_id -> deque of recent (tool, operation, resource)
        self._call_sequences: Dict[str, collections.deque] = collections.defaultdict(lambda: collections.deque(maxlen=20))
        # In-memory queryable threat records
        self._threat_records: List[Dict[str, Any]] = []

    def evaluate_threat(
        self,
        agent: Agent,
        tool_name: str,
        operation: str,
        resource: str,
        parameters: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Analyzes the incoming execution request against all threat vectors.
        Returns a structured threat result if a threat is detected; otherwise None.
        """
        now = time.time()
        agent_id = agent.id

        # 1. Update sliding window history
        self._call_rates[agent_id].append(now)
        self._call_sequences[agent_id].append((tool_name, operation, resource))

        # 2. Check Excessive Tool-Call Frequency (DoS / API Abuse)
        recent_calls = [t for t in self._call_rates[agent_id] if now - t <= 10.0]
        if len(recent_calls) >= 25:
            return self._build_threat(
                agent=agent,
                category=ThreatCategory.API_ABUSE,
                attack_type="Excessive Tool Call Frequency (Denial of Service)",
                severity=ThreatSeverity.HIGH,
                confidence_score=0.95,
                risk_score=85.0,
                description=f"Agent '{agent.name}' exceeded burst threshold with {len(recent_calls)} requests in 10s.",
                triggered_rules=["RATE_LIMIT_BURST_EXCEEDED", "DOS_PREVENTION_RULE"],
                evidence={"calls_in_10s": len(recent_calls), "rate_limit": 25},
                recommended_response="RESTRICT_AGENT"
            )

        # 3. Check Agent Infinite Loop Detection
        seq = list(self._call_sequences[agent_id])
        if len(seq) >= 5 and len(set(seq[-5:])) == 1:
            return self._build_threat(
                agent=agent,
                category=ThreatCategory.AGENT_LOOP,
                attack_type="Repetitive Tool Calling Cycle (Infinite Loop)",
                severity=ThreatSeverity.MEDIUM,
                confidence_score=0.90,
                risk_score=60.0,
                description=f"Agent '{agent.name}' is caught in an infinite execution loop with repeated call: {seq[-1]}.",
                triggered_rules=["AGENT_LOOP_DETECTION", "GUARDRAIL_CYCLE_GUARD"],
                evidence={"repeated_call": seq[-1], "consecutive_count": 5},
                recommended_response="BLOCK_ACTION"
            )

        # 4. Check SSRF (Server-Side Request Forgery) & Metadata Infiltration (for external generic tools)
        if tool_name not in ["http_api_tool"] and ("http" in tool_name or tool_name in ["web_search", "rest_client"]):
            target_url = resource
            if not target_url and "url" in parameters:
                target_url = str(parameters["url"])

            if target_url:
                try:
                    parsed = urllib.parse.urlparse(target_url)
                    hostname = parsed.hostname or ""
                    if hostname:
                        # Check cloud metadata endpoints
                        if hostname.lower() in self.METADATA_IPS or hostname.endswith(".internal"):
                            return self._build_threat(
                                agent=agent,
                                category=ThreatCategory.SSRF,
                                attack_type="Cloud Metadata Service Exploitation",
                                severity=ThreatSeverity.CRITICAL,
                                confidence_score=0.99,
                                risk_score=98.0,
                                description=f"SSRF attack attempting to exfiltrate cloud credentials via metadata host '{hostname}'.",
                                triggered_rules=["SSRF_CLOUD_METADATA_PROHIBITION", "OUTBOUND_FIREWALL_EGRESS_RULE"],
                                evidence={"target_url": target_url, "metadata_host": hostname},
                                recommended_response="QUARANTINE_AGENT"
                            )

                        # Check private/loopback RFC1918 addresses
                        try:
                            ip_obj = ipaddress.ip_address(hostname)
                            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved:
                                return self._build_threat(
                                    agent=agent,
                                    category=ThreatCategory.SSRF,
                                    attack_type="Internal Subnet Infiltration (SSRF)",
                                    severity=ThreatSeverity.HIGH,
                                    confidence_score=0.98,
                                    risk_score=88.0,
                                    description=f"SSRF attempt targeting RFC-1918 private/loopback address '{hostname}'.",
                                    triggered_rules=["SSRF_PRIVATE_IP_BLOCK", "RFC1918_EGRESS_FILTER"],
                                    evidence={"target_ip": hostname, "classification": "Private/Loopback"},
                                    recommended_response="BLOCK_ACTION"
                                )
                        except ValueError:
                            pass
                except Exception:
                    pass

        # 5. Check SQL Injection Vectors
        if tool_name in ["db_tool", "postgres_tool", "sql_executor"] or "sql" in tool_name:
            query_str = str(parameters.get("query", "")) + " " + resource
            for pattern in self.SQLI_PATTERNS:
                if pattern.search(query_str):
                    return self._build_threat(
                        agent=agent,
                        category=ThreatCategory.SQL_INJECTION,
                        attack_type="Structured Query Language Injection (SQLi)",
                        severity=ThreatSeverity.CRITICAL,
                        confidence_score=0.96,
                        risk_score=95.0,
                        description=f"Adversarial SQL injection syntax detected in query payload.",
                        triggered_rules=["SQL_INJECTION_DEFENSE_RULE", "DATABASE_INTEGRITY_SHIELD"],
                        evidence={"matched_pattern": pattern.pattern, "query_sample": query_str[:120]},
                        recommended_response="QUARANTINE_AGENT"
                    )

        # 6. Check Command Injection & Shell Extraction
        param_text = " ".join(str(v) for v in parameters.values()) + " " + resource
        for pattern in self.CMD_INJECTION_PATTERNS:
            if pattern.search(param_text):
                return self._build_threat(
                    agent=agent,
                    category=ThreatCategory.COMMAND_INJECTION,
                    attack_type="Remote Command Execution / Reverse Shell Signature",
                    severity=ThreatSeverity.CRITICAL,
                    confidence_score=0.98,
                    risk_score=99.0,
                    description=f"Unauthorized OS shell execution attempt detected in agent parameters.",
                    triggered_rules=["COMMAND_INJECTION_PREVENTION", "SUBPROCESS_SPAWN_GUARD"],
                    evidence={"snippet": param_text[:120]},
                    recommended_response="QUARANTINE_AGENT"
                )

        # 7. Check Suspicious / Restricted System Files Access
        res_lower = resource.lower()
        for sensitive in self.SENSITIVE_FILES:
            if sensitive in res_lower:
                return self._build_threat(
                    agent=agent,
                    category=ThreatCategory.SUSPICIOUS_FILE_ACCESS,
                    attack_type="Sensitive System Credential / File Traversal",
                    severity=ThreatSeverity.CRITICAL,
                    confidence_score=0.95,
                    risk_score=94.0,
                    description=f"Attempt to access sensitive system credential file '{sensitive}'.",
                    triggered_rules=["RESTRICTED_FILE_SANDBOX_POLICY", "CREDENTIAL_FILE_SHIELD"],
                    evidence={"target_resource": resource, "matched_sensitive_file": sensitive},
                    recommended_response="QUARANTINE_AGENT"
                )

        # 8. Check Prompt Injection & Jailbreaks via ML and Heuristics
        ml_svc = MLSecurityModelService.get_instance()
        text_to_scan = ""
        if "prompt" in parameters:
            text_to_scan = str(parameters["prompt"])
        elif "content" in parameters:
            text_to_scan = str(parameters["content"])
        elif "query" in parameters:
            text_to_scan = str(parameters["query"])

        if text_to_scan:
            ml_pred = ml_svc.predict(text_to_scan)
            if ml_pred["is_threat"] and ml_pred["threat_score"] >= 0.70:
                category = ThreatCategory.PROMPT_INJECTION
                if "JAILBREAK" in ml_pred["category"]:
                    category = ThreatCategory.JAILBREAK
                elif "DATA_EXFILTRATION" in ml_pred["category"]:
                    category = ThreatCategory.DATA_EXFILTRATION

                severity = ThreatSeverity.CRITICAL if ml_pred["threat_score"] >= 0.88 else ThreatSeverity.HIGH
                return self._build_threat(
                    agent=agent,
                    category=category,
                    attack_type=ml_pred["category"],
                    severity=severity,
                    confidence_score=ml_pred["threat_score"],
                    risk_score=round(ml_pred["threat_score"] * 100, 1),
                    description=f"Adversarial instruction detected by CrossX ML Security Model ({ml_pred['category']}).",
                    triggered_rules=["ML_PROMPT_INJECTION_CLASSIFIER", *ml_pred["violated_regulations"]],
                    evidence={"prompt_sample": ml_pred["prompt"], "confidence": ml_pred["threat_score"]},
                    recommended_response="QUARANTINE_AGENT" if severity == ThreatSeverity.CRITICAL else "BLOCK_ACTION"
                )

        return None

    def _build_threat(
        self,
        agent: Agent,
        category: str,
        attack_type: str,
        severity: str,
        confidence_score: float,
        risk_score: float,
        description: str,
        triggered_rules: List[str],
        evidence: Dict[str, Any],
        recommended_response: str
    ) -> Dict[str, Any]:
        threat_id = str(uuid.uuid4())
        record = {
            "threat_id": threat_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent_id": agent.id,
            "agent_name": agent.name,
            "threat_category": category,
            "attack_type": attack_type,
            "severity": severity,
            "confidence_score": confidence_score,
            "risk_score": risk_score,
            "description": description,
            "triggered_rules": triggered_rules,
            "relevant_evidence": evidence,
            "source_event": str(uuid.uuid4()),
            "recommended_response": recommended_response,
            "automated_response_status": "PENDING"
        }
        self._threat_records.insert(0, record)
        return record

    async def execute_automated_response(
        self,
        db: AsyncSession,
        threat: Dict[str, Any],
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes deterministic automated containment actions according to severity and security policy.
        """
        severity = threat["severity"]
        agent_id = threat["agent_id"]
        threat_id = threat["threat_id"]
        actions_taken = []

        if severity == ThreatSeverity.CRITICAL:
            # 1. Quarantine Agent
            await agent_service.quarantine_agent(
                db, agent_id, reason=f"CRITICAL Autonomous Defense: {threat['attack_type']}"
            )
            actions_taken.append("QUARANTINE_AGENT")

            # 2. Sinkhole IP if public
            is_priv = False
            try:
                is_priv = ipaddress.ip_address(client_ip).is_private or ipaddress.ip_address(client_ip).is_loopback
            except Exception:
                is_priv = True

            if client_ip and not is_priv:
                active_defense_service.sinkhole_ip(
                    client_ip, reason=f"Autonomous Response: {threat['attack_type']}", duration_seconds=86400
                )
                actions_taken.append(f"SINKHOLE_IP_{client_ip}")

            # 3. Create Critical Security Incident
            inc = SecurityIncident(
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                severity=IncidentSeverity.CRITICAL,
                title=f"CRITICAL THREAT: {threat['attack_type']} on {threat['agent_name']}",
                description=threat["description"],
                status=IncidentStatus.CONTAINED,
                incident_metadata={
                    "threat_id": threat_id,
                    "threat_category": threat["threat_category"],
                    "confidence": threat["confidence_score"],
                    "risk_score": threat["risk_score"],
                    "evidence": threat["relevant_evidence"],
                    "client_ip": client_ip,
                    "automated_actions": actions_taken
                }
            )
            db.add(inc)
            await db.commit()
            threat["automated_response_status"] = "QUARANTINED_AND_CONTAINED"

        elif severity == ThreatSeverity.HIGH:
            # Restrict agent to read-only containment
            await agent_service.restrict_agent(
                db, agent_id, reason=f"HIGH Threat Containment: {threat['attack_type']}"
            )
            actions_taken.append("RESTRICT_AGENT")

            # Create High Security Incident
            inc = SecurityIncident(
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                severity=IncidentSeverity.HIGH,
                title=f"HIGH THREAT: {threat['attack_type']} on {threat['agent_name']}",
                description=threat["description"],
                status=IncidentStatus.INVESTIGATING,
                incident_metadata={
                    "threat_id": threat_id,
                    "threat_category": threat["threat_category"],
                    "confidence": threat["confidence_score"],
                    "risk_score": threat["risk_score"],
                    "evidence": threat["relevant_evidence"],
                    "client_ip": client_ip,
                    "automated_actions": actions_taken
                }
            )
            db.add(inc)
            await db.commit()
            threat["automated_response_status"] = "RESTRICTED_AND_LOGGED"

        elif severity == ThreatSeverity.MEDIUM:
            actions_taken.append("BLOCK_ACTION")
            threat["automated_response_status"] = "BLOCKED"

        else:
            actions_taken.append("LOG_AND_MONITOR")
            threat["automated_response_status"] = "MONITORED"

        threat["actions_taken"] = actions_taken
        return threat

    def list_threats(self, limit: int = 50, category: Optional[str] = None) -> List[Dict[str, Any]]:
        results = self._threat_records
        if category:
            results = [t for t in results if t["threat_category"].lower() == category.lower()]
        return results[:limit]

    def get_threat(self, threat_id: str) -> Optional[Dict[str, Any]]:
        for t in self._threat_records:
            if t["threat_id"] == threat_id:
                return t
        return None


threat_detection_service = ThreatDetectionService()

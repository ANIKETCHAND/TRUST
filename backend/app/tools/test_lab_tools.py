import ast
import operator
import re
from typing import Any, Dict, List
from app.tools.base import BaseTool


class SafeCalculatorTool(BaseTool):
    """
    Mathematical evaluation tool utilizing Python AST parsing instead of eval().
    Prevents arbitrary code execution and injection attacks.
    """
    name = "safe_calculator"
    display_name = "Safe Mathematical Calculator Tool"
    category = "system"
    supported_operations = ["calculate", "evaluate"]

    # Allowed AST operators mapped to Python operator functions
    _OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }

    def _eval_node(self, node: ast.AST) -> float:
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return float(node.value)
            raise ValueError(f"Disallowed constant type in expression: {type(node.value).__name__}")
        elif isinstance(node, ast.BinOp):
            left = self._eval_node(node.left)
            right = self._eval_node(node.right)
            op_type = type(node.op)
            if op_type in self._OPERATORS:
                if op_type in (ast.Div, ast.FloorDiv, ast.Mod) and right == 0:
                    raise ZeroDivisionError("Division by zero in mathematical expression.")
                if op_type == ast.Pow and (right > 100 or left > 1000):
                    raise ValueError("Exponentiation values exceed safety bounds.")
                return float(self._OPERATORS[op_type](left, right))
            raise ValueError(f"Unsupported binary operator: {op_type.__name__}")
        elif isinstance(node, ast.UnaryOp):
            operand = self._eval_node(node.operand)
            op_type = type(node.op)
            if op_type in self._OPERATORS:
                return float(self._OPERATORS[op_type](operand))
            raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
        else:
            raise ValueError(f"Disallowed expression syntax in safe calculator: {type(node).__name__}")

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported operation '{operation}' on tool '{self.name}'")

        expr = parameters.get("expression") or parameters.get("formula") or resource
        if not expr or not isinstance(expr, str):
            raise ValueError("Parameter 'expression' must be a non-empty string.")

        clean_expr = expr.strip()
        if len(clean_expr) > 256:
            raise ValueError("Mathematical expression exceeds maximum length of 256 characters.")

        # Reject any identifier names, imports, or dunder attributes
        if re.search(r"[a-zA-Z_]\w*", clean_expr):
            raise ValueError("Mathematical expression contains disallowed identifiers or function calls.")

        parsed = ast.parse(clean_expr, mode="eval")
        result = self._eval_node(parsed.body)
        return {
            "expression": clean_expr,
            "result": result,
            "formatted": f"{result:g}"
        }


class WebSearchTool(BaseTool):
    """
    Controlled research search tool operating over a curated synthetic cybersecurity index.
    Does not initiate unmediated raw outbound Internet connections, preventing exfiltration.
    """
    name = "web_search_tool"
    display_name = "Safe Research Search Tool"
    category = "system"
    supported_operations = ["search", "lookup"]

    # Curated knowledge index for safe AI research & security benchmarks
    _KNOWLEDGE_INDEX = [
        {
            "title": "OWASP Top 10 for Large Language Model Applications",
            "snippet": "LLM01: Prompt Injection, LLM02: Sensitive Information Disclosure, LLM06: Excessive Agency, LLM07: System Prompt Leakage.",
            "url": "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
            "keywords": ["owasp", "prompt injection", "llm", "security", "disclosure", "agency"]
        },
        {
            "title": "MITRE ATLAS: Adversarial Threat Landscape for AI Systems",
            "snippet": "ATLAS matrix covers ML attack vectors including Direct Prompt Injection (AML.T0054), Training Data Poisoning, and Model Inversion.",
            "url": "https://atlas.mitre.org/",
            "keywords": ["mitre", "atlas", "adversarial", "injection", "aml.t0054", "threat"]
        },
        {
            "title": "NIST AI Risk Management Framework (AI RMF 1.0)",
            "snippet": "Core governance functions: Govern, Map, Measure, and Manage. Emphasizes fail-closed boundaries and zero-trust verification.",
            "url": "https://www.nist.gov/itl/ai-risk-management-framework",
            "keywords": ["nist", "ai rmf", "governance", "zero-trust", "risk", "framework"]
        },
        {
            "title": "CrossX Platform Security Architecture & Zero-Trust Gateway",
            "subtitle": "Deterministic runtime guardrails, fail-closed policy enforcement, and dynamic delegation boundaries for autonomous agents.",
            "url": "https://crossx.internal/docs/architecture",
            "keywords": ["crossx", "platform", "gateway", "zero-trust", "guardrail", "policy", "delegation"]
        },
        {
            "title": "Enterprise Cloud Database Security Guidelines",
            "snippet": "Enforce least-privilege role-based access control (RBAC), parameterization, read-only replica separation, and audit logging.",
            "url": "https://cloud.internal/guidelines/db-security",
            "keywords": ["database", "sql", "least-privilege", "rbac", "enterprise", "customer"]
        }
    ]

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported operation '{operation}' on tool '{self.name}'")

        query = parameters.get("query") or parameters.get("q") or resource or ""
        clean_query = str(query).lower().strip()
        if not clean_query:
            raise ValueError("Query parameter cannot be empty.")

        query_tokens = set(re.findall(r"\w+", clean_query))

        matches = []
        for entry in self._KNOWLEDGE_INDEX:
            entry_keywords = set(k.lower() for k in entry["keywords"])
            title_text = entry.get("title", "").lower()
            snippet_text = entry.get("snippet", entry.get("subtitle", "")).lower()

            overlap = len(query_tokens.intersection(entry_keywords))
            for tok in query_tokens:
                if tok in title_text or tok in snippet_text:
                    overlap += 1

            if overlap > 0 or len(query_tokens) == 0:
                matches.append({
                    "title": entry["title"],
                    "snippet": entry.get("snippet", entry.get("subtitle", "")),
                    "url": entry["url"],
                    "relevance_score": min(1.0, 0.4 + (overlap * 0.15))
                })

        matches.sort(key=lambda x: x["relevance_score"], reverse=True)
        return {
            "query": query,
            "total_results": len(matches),
            "results": matches[:5]
        }


class SecurityEventAnalyzerTool(BaseTool):
    """
    Security event analyzer tool that classifies security events, computes risk scores,
    and correlates indicators of compromise (IOCs).
    """
    name = "security_event_analyzer"
    display_name = "Security Event Analyzer Tool"
    category = "system"
    supported_operations = ["analyze_event", "correlate_signals", "classify_threat"]

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported operation '{operation}' on tool '{self.name}'")

        event_data = parameters.get("event") or parameters.get("data") or {}
        raw_text = str(parameters.get("content") or parameters.get("text") or event_data or resource)

        # Indicator analysis
        is_injection = bool(re.search(r"(ignore\s+(?:previous|all)|override|system\s+prompt|reveal|bypass)", raw_text, re.IGNORECASE))
        is_sqli = bool(re.search(r"(union\s+select|drop\s+table|1=1|exec\s+xp_)", raw_text, re.IGNORECASE))
        is_exfil = bool(re.search(r"(leak|exfiltrate|pastebin|webhook\.site|attacker)", raw_text, re.IGNORECASE))
        is_ssrf = bool(re.search(r"(169\.254|localhost|127\.0\.0\.1|metadata)", raw_text, re.IGNORECASE))

        indicators = []
        severity = "LOW"
        risk_score = 15.0

        if is_injection:
            indicators.append("INSTRUCTION_OVERRIDE_PATTERN")
            severity = "HIGH"
            risk_score = max(risk_score, 85.0)
        if is_sqli:
            indicators.append("SQLI_SYNTAX_SIGNATURE")
            severity = "CRITICAL"
            risk_score = max(risk_score, 95.0)
        if is_exfil:
            indicators.append("OUTBOUND_DATA_EXFILTRATION_TARGET")
            severity = "CRITICAL"
            risk_score = max(risk_score, 90.0)
        if is_ssrf:
            indicators.append("RESTRICTED_METADATA_OR_LOOPBACK_TARGET")
            severity = "CRITICAL"
            risk_score = max(risk_score, 92.0)

        threat_class = "BENIGN_TELEMETRY"
        if indicators:
            threat_class = "ADVERSARIAL_THREAT"

        return {
            "operation": operation,
            "threat_classification": threat_class,
            "severity": severity,
            "risk_score": risk_score,
            "detected_indicators": indicators,
            "recommendation": "BLOCK_AND_ISOLATE" if severity in ("HIGH", "CRITICAL") else "ALLOW_AND_MONITOR"
        }


class TestEnvDataTool(BaseTool):
    """
    Safe test environment data retrieval tool providing mock synthetic records,
    synthetic test users, and test environment topology without touching production systems.
    """
    name = "test_env_data_tool"
    display_name = "Test Environment Data Retrieval Tool"
    category = "system"
    supported_operations = ["get_synthetic_user", "get_mock_record", "get_lab_metadata"]

    _SYNTHETIC_USERS = [
        {"user_id": "usr_synth_01", "name": "Alice Cooper (Synthetic SecOps)", "role": "security_operator", "clearance": "L2"},
        {"user_id": "usr_synth_02", "name": "Bob Vance (Synthetic Analyst)", "role": "data_analyst", "clearance": "L1"},
        {"user_id": "usr_synth_03", "name": "Carol Danvers (Synthetic Auditor)", "role": "compliance_auditor", "clearance": "L3"},
    ]

    _MOCK_RECORDS = [
        {"record_id": "rec_001", "title": "Safe Test Inventory Record", "type": "asset", "classification": "PUBLIC", "status": "verified"},
        {"record_id": "rec_002", "title": "Sample Q3 Diagnostic Log", "type": "diagnostic", "classification": "INTERNAL", "status": "archived"},
        {"record_id": "rec_003", "title": "Synthetic Customer Volume Metric", "type": "metrics", "classification": "CONFIDENTIAL", "status": "active"},
    ]

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported operation '{operation}' on tool '{self.name}'")

        if operation == "get_synthetic_user":
            user_id = parameters.get("user_id") or resource
            user = next((u for u in self._SYNTHETIC_USERS if u["user_id"] == user_id), self._SYNTHETIC_USERS[0])
            return {"user": user}

        elif operation == "get_mock_record":
            rec_id = parameters.get("record_id") or resource
            rec = next((r for r in self._MOCK_RECORDS if r["record_id"] == rec_id), self._MOCK_RECORDS[0])
            return {"record": rec}

        elif operation == "get_lab_metadata":
            return {
                "environment": "crossx_test_lab",
                "isolation_level": "sandboxed_fail_closed",
                "mock_users_count": len(self._SYNTHETIC_USERS),
                "mock_records_count": len(self._MOCK_RECORDS),
                "allowed_sinks": ["synthetic-sink.agenttrust.internal", "testlab.crossx.internal"],
                "active_protections": ["prompt_injection", "dlp", "ssrf", "rbac", "tamper_proof_audit"]
            }

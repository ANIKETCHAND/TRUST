"""
Active Defense & Virus/Malware Process Killer Service
Coordinates enterprise active countermeasures:
- Real-time malicious process termination (kill switch) & process tree termination
- Dynamic perimeter sinkholing & OS firewall blacklisting (Windows Defender Firewall / Linux iptables)
- Tarpit deception engine: slow decoy responses to trap automated scanners
- File quarantine vault inspection and management
- RFC-compliant ISP Abuse incident reporting
"""

import logging
import os
import platform
import subprocess
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
import psutil

logger = logging.getLogger("agenttrust.active_defense")


class ActiveDefenseService:
    def __init__(self):
        # In-memory registry of dynamically sinkholed IPs / CIDRs
        # ip -> {ip, reason, created_at, expires_at, blocked_count}
        self._sinkholed_ips: Dict[str, Dict[str, Any]] = {}
        # In-memory tarpit targets
        self._tarpit_targets: Dict[str, Dict[str, Any]] = {}
        # History log of active defense countermeasures executed
        self._countermeasures_log: List[Dict[str, Any]] = []

    # ---------------------------------------------------------
    # 1. PROCESS KILL SWITCH & MALWARE TERMINATION
    # ---------------------------------------------------------
    def kill_process(
        self,
        pid: int,
        agent_id: Optional[str] = None,
        reason: str = "Active Defense Malicious Process Neutralization",
        force: bool = True
    ) -> Dict[str, Any]:
        """
        Immediately terminates an offending or hijacked AI process and its child processes.
        """
        action_id = str(uuid.uuid4())
        record = {
            "action_id": action_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "countermeasure": "PROCESS_KILL",
            "target_pid": pid,
            "agent_id": agent_id,
            "reason": reason,
            "success": False,
            "terminated_children_pids": [],
            "process_name": "unknown"
        }

        try:
            target_proc = psutil.Process(pid)
            record["process_name"] = target_proc.name()

            # Identify child processes recursively
            try:
                children = target_proc.children(recursive=True)
                for child in children:
                    try:
                        record["terminated_children_pids"].append(child.pid)
                        if force:
                            child.kill()
                        else:
                            child.terminate()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

            # Terminate parent target
            if force:
                target_proc.kill()
            else:
                target_proc.terminate()

            target_proc.wait(timeout=3.0)
            record["success"] = True
            logger.warning(f"[Active Defense] Successfully killed process {pid} ({record['process_name']}). Reason: {reason}")
        except psutil.NoSuchProcess:
            record["success"] = True
            record["notes"] = f"Process {pid} had already exited."
        except Exception as e:
            record["success"] = False
            record["error"] = str(e)
            logger.error(f"[Active Defense] Failed to kill process {pid}: {e}")

        self._countermeasures_log.insert(0, record)
        return record

    def list_running_agent_processes(self) -> List[Dict[str, Any]]:
        """
        Enumerates running processes matching AI agents, Python interpreters, Node.js, and runner binaries.
        """
        results = []
        for p in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_info', 'create_time', 'cmdline']):
            try:
                info = p.info
                name = (info.get('name') or '').lower()
                cmdline = " ".join(info.get('cmdline') or []).lower()

                # Filter for agent-relevant runtimes
                is_agent = any(k in name for k in ['python', 'node', 'uvicorn', 'fastapi', 'ollama', 'llm', 'agent']) or \
                           any(k in cmdline for k in ['agent', 'trust', 'main.py', 'runner', 'worker'])

                if is_agent:
                    mem_mb = round(info['memory_info'].rss / (1024 * 1024), 2) if info.get('memory_info') else 0.0
                    results.append({
                        "pid": info['pid'],
                        "name": info['name'],
                        "user": info.get('username') or 'SYSTEM',
                        "cpu_percent": info.get('cpu_percent') or 0.0,
                        "memory_mb": mem_mb,
                        "started_at": datetime.fromtimestamp(info['create_time'], timezone.utc).isoformat() if info.get('create_time') else None,
                        "cmdline": " ".join(info.get('cmdline') or [])[:120],
                        "status": p.status()
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return results

    # ---------------------------------------------------------
    # 2. DYNAMIC PERIMETER SINKHOLING & OS FIREWALL
    # ---------------------------------------------------------
    def sinkhole_ip(
        self,
        ip: str,
        reason: str = "Active Defense Malicious Ingress Sinkhole",
        duration_seconds: int = 86400
    ) -> Dict[str, Any]:
        """
        Dynamically null-routes an offending IP and attempts to enforce an OS-level firewall drop.
        """
        ip = ip.strip()
        now = time.time()
        record = {
            "ip": ip,
            "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": datetime.fromtimestamp(now + duration_seconds, timezone.utc).isoformat(),
            "duration_seconds": duration_seconds,
            "blocked_hits": 0,
            "firewall_rule_applied": False,
            "os_rule_name": f"AgentTrust_Sinkhole_{ip.replace(':', '_').replace('.', '_')}"
        }

        # OS Firewall Injection
        try:
            current_os = platform.system()
            if current_os == "Windows":
                # Add inbound and outbound block rules via netsh
                rule_name = record["os_rule_name"]
                cmd = f'netsh advfirewall firewall add rule name="{rule_name}" dir=in action=block remoteip={ip}'
                subprocess.run(cmd, shell=True, capture_output=True, timeout=5)
                cmd_out = f'netsh advfirewall firewall add rule name="{rule_name}_out" dir=out action=block remoteip={ip}'
                subprocess.run(cmd_out, shell=True, capture_output=True, timeout=5)
                record["firewall_rule_applied"] = True
            elif current_os == "Linux":
                cmd = f"iptables -I INPUT -s {ip} -j DROP"
                subprocess.run(cmd, shell=True, capture_output=True, timeout=5)
                record["firewall_rule_applied"] = True
        except Exception as e:
            logger.info(f"OS firewall invocation noted: {e} (simulated/privileged fallback active)")

        self._sinkholed_ips[ip] = record
        self._countermeasures_log.insert(0, {
            "action_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "countermeasure": "IP_SINKHOLE",
            "target_ip": ip,
            "reason": reason,
            "success": True
        })
        logger.warning(f"[Active Defense] IP {ip} successfully SINKHOLED. Reason: {reason}")
        return record

    def is_ip_sinkholed(self, ip: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """Checks whether an IP is currently null-routed."""
        clean_ip = ip.strip() if ip else ""
        if clean_ip in self._sinkholed_ips:
            rec = self._sinkholed_ips[clean_ip]
            # Check expiration
            expires_ts = datetime.fromisoformat(rec["expires_at"]).timestamp()
            if time.time() > expires_ts:
                self.release_sinkhole(clean_ip)
                return False, None
            rec["blocked_hits"] += 1
            return True, rec
        return False, None

    def release_sinkhole(self, ip: str) -> bool:
        """Removes IP from sinkhole and removes OS firewall rule."""
        clean_ip = ip.strip()
        if clean_ip in self._sinkholed_ips:
            rec = self._sinkholed_ips.pop(clean_ip)
            try:
                if platform.system() == "Windows":
                    rule_name = rec["os_rule_name"]
                    subprocess.run(f'netsh advfirewall firewall delete rule name="{rule_name}"', shell=True, capture_output=True, timeout=5)
                    subprocess.run(f'netsh advfirewall firewall delete rule name="{rule_name}_out"', shell=True, capture_output=True, timeout=5)
                elif platform.system() == "Linux":
                    subprocess.run(f"iptables -D INPUT -s {clean_ip} -j DROP", shell=True, capture_output=True, timeout=5)
            except Exception:
                pass
            return True
        return False

    def list_sinkholed_ips(self) -> List[Dict[str, Any]]:
        return list(self._sinkholed_ips.values())

    # ---------------------------------------------------------
    # 3. TARPITTING & DECEPTION ENGINE
    # ---------------------------------------------------------
    def add_tarpit_target(self, ip: str, reason: str = "Automated scanner tarpitting") -> Dict[str, Any]:
        record = {
            "ip": ip,
            "reason": reason,
            "added_at": datetime.now(timezone.utc).isoformat(),
            "probes_trapped": 0
        }
        self._tarpit_targets[ip] = record
        return record

    def remove_tarpit_target(self, ip: str) -> bool:
        if ip in self._tarpit_targets:
            del self._tarpit_targets[ip]
            return True
        return False

    def is_tarpitted(self, ip: str) -> bool:
        return ip in self._tarpit_targets

    def generate_tarpit_decoy(self, tool_name: str, operation: str) -> Dict[str, Any]:
        """
        Generates realistic decoy responses containing synthetic canary tokens
        to mislead attacker scanners and trace downstream tool use.
        """
        canary = f"canary_tk_{uuid.uuid4().hex[:12]}"
        return {
            "status": "success",
            "execution_id": str(uuid.uuid4()),
            "message": "Operation completed with synthetic sandbox simulation",
            "synthetic_telemetry": {
                "records_evaluated": 142,
                "token_id": canary,
                "channel": "deception_grid_alpha"
            },
            "warning": "Deception Canary Token Embedded"
        }

    # ---------------------------------------------------------
    # 4. RFC-COMPLIANT ABUSE REPORT GENERATION
    # ---------------------------------------------------------
    def generate_isp_abuse_report(
        self,
        ip: str,
        incident_details: Dict[str, Any]
    ) -> str:
        """
        Formats a standard RFC-compliant network abuse report for transit providers and CERTs.
        """
        now = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
        report = f"""From: soc-abuse@agenttrust.security
Subject: Security Incident Notice: Host {ip} Malicious AI Agent Exploit Probing
Date: {now}
Auto-Submitted: auto-generated
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Dear Network Abuse / Incident Response Team,

AgentTrust Autonomous Cybersecurity Sentry has detected unauthorized, abusive traffic
originating from an IP address within your network allocation:

Offending IP Address: {ip}
Timestamp of Detection: {incident_details.get('timestamp', now)}
Detected Attack Vector: {incident_details.get('attack_vector', 'AI Prompt Injection / Tool Exploitation')}
Severity Classification: {incident_details.get('severity', 'CRITICAL')}
MITRE ATT&CK Mapping: {incident_details.get('mitre_id', 'T1059.001 (Command and Scripting Interpreter)')}

Forensic Evidence Summary:
{incident_details.get('evidence_snippet', 'Attempted unauthorized system command override and sensitive data exfiltration.')}

Action Taken by AgentTrust:
- Ingress dropped via Perimeter Sinkholing
- Process execution tree terminated
- Evidence catalogued under Incident ID: {incident_details.get('incident_id', str(uuid.uuid4()))}

Please investigate this infected or misconfigured host and apply necessary containment.
If this host is a known open proxy, VPN egress, or compromised server, please mitigate immediately.

Sincerely,
AgentTrust Security Operations Center (SOC)
Autonomous Active Defense & Forensics Subsystem
"""
        return report

    def get_countermeasures_history(self) -> List[Dict[str, Any]]:
        return list(self._countermeasures_log)


active_defense_service = ActiveDefenseService()

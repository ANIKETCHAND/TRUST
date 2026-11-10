"""
AgentTrust Endpoint Connector & Sentry Daemon
Monitors AI agent execution at the OS layer, detects unauthorized subprocess spawning,
provides an instant process kill switch, and dynamic OS firewall sinkholing.
"""

import logging
import os
import platform
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional
import psutil

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("agenttrust.endpoint_connector")


class EndpointConnector:
    """
    Native OS Agent & Process Sentry
    """

    SUSPICIOUS_CMDLINE_KEYWORDS = [
        "-enc ", "downloadstring", "invoke-expression", "iex(",
        "cmd.exe /c", "powershell -nop", "certutil -urlcache",
        "bash -i", "/dev/tcp/", "nc -e", "vssadmin delete shadows"
    ]

    def __init__(self):
        self.os_type = platform.system()
        logger.info(f"Initialized Endpoint Sentry on OS: {self.os_type}")

    def kill_process(self, pid: int, force: bool = True) -> Dict[str, Any]:
        """
        Instantly terminates a process and all of its spawned child processes.
        """
        try:
            parent = psutil.Process(pid)
            proc_name = parent.name()
            children = parent.children(recursive=True)

            terminated_pids = []
            for child in children:
                try:
                    terminated_pids.append(child.pid)
                    if force:
                        child.kill()
                    else:
                        child.terminate()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            if force:
                parent.kill()
            else:
                parent.terminate()

            parent.wait(timeout=3.0)
            logger.info(f"Terminated process {pid} ({proc_name}) and {len(terminated_pids)} children.")
            return {
                "success": True,
                "pid": pid,
                "process_name": proc_name,
                "action": "KILLED",
                "child_pids_terminated": terminated_pids
            }
        except psutil.NoSuchProcess:
            return {"success": True, "pid": pid, "action": "ALREADY_EXITED"}
        except Exception as e:
            logger.error(f"Failed to kill process {pid}: {e}")
            return {"success": False, "pid": pid, "error": str(e)}

    def block_remote_ip(self, ip: str) -> Dict[str, Any]:
        """
        Dynamically applies an OS-level firewall drop for the specified remote IP.
        """
        clean_ip = ip.strip()
        rule_name = f"AgentTrust_Sentry_Block_{clean_ip.replace('.', '_').replace(':', '_')}"
        applied = False

        try:
            if self.os_type == "Windows":
                cmd_in = f'netsh advfirewall firewall add rule name="{rule_name}_in" dir=in action=block remoteip={clean_ip}'
                subprocess.run(cmd_in, shell=True, capture_output=True, timeout=5)
                cmd_out = f'netsh advfirewall firewall add rule name="{rule_name}_out" dir=out action=block remoteip={clean_ip}'
                subprocess.run(cmd_out, shell=True, capture_output=True, timeout=5)
                applied = True
            elif self.os_type == "Linux":
                subprocess.run(f"iptables -A INPUT -s {clean_ip} -j DROP", shell=True, capture_output=True, timeout=5)
                subprocess.run(f"iptables -A OUTPUT -d {clean_ip} -j DROP", shell=True, capture_output=True, timeout=5)
                applied = True
        except Exception as e:
            logger.warning(f"Firewall rule command failed or simulated: {e}")

        return {
            "success": True,
            "ip": clean_ip,
            "rule_name": rule_name,
            "firewall_applied": applied,
            "os": self.os_type
        }

    def unblock_remote_ip(self, ip: str) -> Dict[str, Any]:
        """Removes previously added OS firewall block rule."""
        clean_ip = ip.strip()
        rule_name = f"AgentTrust_Sentry_Block_{clean_ip.replace('.', '_').replace(':', '_')}"
        try:
            if self.os_type == "Windows":
                subprocess.run(f'netsh advfirewall firewall delete rule name="{rule_name}_in"', shell=True, capture_output=True, timeout=5)
                subprocess.run(f'netsh advfirewall firewall delete rule name="{rule_name}_out"', shell=True, capture_output=True, timeout=5)
            elif self.os_type == "Linux":
                subprocess.run(f"iptables -D INPUT -s {clean_ip} -j DROP", shell=True, capture_output=True, timeout=5)
                subprocess.run(f"iptables -D OUTPUT -d {clean_ip} -j DROP", shell=True, capture_output=True, timeout=5)
        except Exception:
            pass
        return {"success": True, "ip": clean_ip}

    def scan_for_suspicious_processes(self) -> List[Dict[str, Any]]:
        """
        Scans running processes and detects suspicious command-line invocations.
        """
        suspicious = []
        for p in psutil.process_iter(['pid', 'name', 'cmdline', 'cpu_percent', 'memory_info']):
            try:
                cmdline = " ".join(p.info.get('cmdline') or []).lower()
                for keyword in self.SUSPICIOUS_CMDLINE_KEYWORDS:
                    if keyword in cmdline:
                        suspicious.append({
                            "pid": p.info['pid'],
                            "name": p.info['name'],
                            "cmdline": cmdline[:200],
                            "matched_keyword": keyword,
                            "severity": "CRITICAL"
                        })
                        break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return suspicious

    def get_system_telemetry(self) -> Dict[str, Any]:
        """Gathers real-time OS telemetry."""
        return {
            "os": self.os_type,
            "os_release": platform.release(),
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage(os.path.abspath(os.sep)).percent,
            "timestamp": time.time()
        }


endpoint_connector = EndpointConnector()

if __name__ == "__main__":
    print("[*] Starting AgentTrust Endpoint Sentry...")
    telemetry = endpoint_connector.get_system_telemetry()
    print(f"[*] Telemetry: {telemetry}")
    suspicious = endpoint_connector.scan_for_suspicious_processes()
    print(f"[*] Suspicious processes detected: {len(suspicious)}")

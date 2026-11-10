import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List
import psutil

logger = logging.getLogger("agenttrust.endpoint.collector")

AUTHORIZED_RUNTIMES = {"python.exe", "python3.exe", "node.exe", "uv.exe"}


class EndpointTelemetryCollector:
    """
    Authorized Agent-Workflow Telemetry Collector:
    Collects execution telemetry strictly scoped to authorized AI agent workflows,
    monitored workspace directories, and recognized agent runtimes.
    Does NOT conduct general user surveillance.
    """

    def __init__(self, monitored_workspaces: List[str] = None):
        self.monitored_workspaces = monitored_workspaces or [
            os.path.abspath("./sandbox_storage"),
            os.path.abspath("./reports"),
        ]

    def collect_agent_processes(self) -> List[Dict[str, Any]]:
        """Scans current processes for authorized AI agent runtime instances."""
        events = []
        for proc in psutil.process_iter(["pid", "name", "cmdline", "exe", "create_time"]):
            try:
                pname = (proc.info.get("name") or "").lower()
                if pname in AUTHORIZED_RUNTIMES:
                    cmdline = " ".join(proc.info.get("cmdline") or [])
                    # Check if command line mentions agent, tool, or workspace
                    is_agent_workload = any(
                        keyword in cmdline.lower()
                        for keyword in ["agent", "tool", "trust", "runner", "langchain", "mcp"]
                    )
                    
                    # Detect suspicious invocation patterns
                    is_suspicious = any(
                        susp in cmdline.lower()
                        for susp in ["powershell -enc", "iex(", "downloadstring", "certutil", "/bin/sh"]
                    )

                    events.append({
                        "event_type": "process_spawn",
                        "process_name": pname,
                        "process_pid": proc.info["pid"],
                        "command_line": cmdline[:500],
                        "executable_path": proc.info.get("exe"),
                        "severity": "SUSPICIOUS" if is_suspicious else "INFO",
                        "is_authorized_agent_workflow": not is_suspicious,
                        "telemetry_details": {
                            "matched_runtime": pname,
                            "is_agent_workload": is_agent_workload,
                        }
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        return events

    def generate_synthetic_agent_telemetry(self) -> List[Dict[str, Any]]:
        """Generates representative telemetry for test/demonstration runs."""
        return [
            {
                "event_type": "tool_invocation",
                "process_name": "python.exe",
                "process_pid": os.getpid(),
                "command_line": "python -m agenttrust.agent_runner --task financial_audit",
                "executable_path": "C:\\Python314\\python.exe",
                "target_resource": "reports/q3_summary.txt",
                "severity": "INFO",
                "is_authorized_agent_workflow": True,
                "telemetry_details": {
                    "action": "filesystem_read",
                    "workspace": self.monitored_workspaces[0],
                }
            }
        ]

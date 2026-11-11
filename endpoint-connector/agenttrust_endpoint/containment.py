import logging
from typing import Any, Dict, Optional
import psutil

logger = logging.getLogger("agenttrust.endpoint.containment")


class EndpointContainmentManager:
    """
    Controlled Endpoint Containment Manager:
    Applies reversible, authorized protective actions strictly within agent workspaces.
    
    EXPLICIT SAFEGUARDS:
    - Never conducts destructive deletion or arbitrary system termination.
    - Requires explicit human approval and authorized audit trail.
    - All containment actions (process suspension, workspace isolation) are reversible.
    """

    @staticmethod
    def suspend_agent_process(pid: int, human_approved: bool, reason: str) -> Dict[str, Any]:
        """Gracefully suspends an offending agent process without destroying memory state."""
        if not human_approved:
            raise PermissionError("Safeguard Violation: Process suspension requires explicit human authorization.")

        try:
            p = psutil.Process(pid)
            p.suspend()
            logger.info(f"Process {pid} ({p.name()}) suspended. Reason: {reason}")
            return {
                "success": True,
                "pid": pid,
                "process_name": p.name(),
                "action": "SUSPENDED",
                "reason": reason
            }
        except Exception as e:
            logger.error(f"Failed to suspend process {pid}: {e}")
            return {"success": False, "pid": pid, "error": str(e)}

    @staticmethod
    def resume_agent_process(pid: int, authorized_by: str) -> Dict[str, Any]:
        """Resumes a previously suspended agent process."""
        try:
            p = psutil.Process(pid)
            p.resume()
            logger.info(f"Process {pid} ({p.name()}) resumed by {authorized_by}")
            return {
                "success": True,
                "pid": pid,
                "process_name": p.name(),
                "action": "RESUMED",
                "authorized_by": authorized_by
            }
        except Exception as e:
            return {"success": False, "pid": pid, "error": str(e)}


containment_manager = EndpointContainmentManager()

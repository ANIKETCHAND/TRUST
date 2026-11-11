"""
Active Defense & OS Process Killer API Endpoints
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.api.deps import get_current_admin_user, get_current_user
from app.models.user import User
from app.services.active_defense_service import active_defense_service
from app.services.file_scanner_service import file_scanner_service

router = APIRouter(prefix="/active-defense", tags=["Active Defense"])


class KillProcessRequest(BaseModel):
    pid: int = Field(..., description="Target process ID to terminate")
    agent_id: Optional[str] = Field(None, description="Associated agent ID if known")
    reason: str = Field("Manual Kill Switch Invocation", description="Justification for termination")
    force: bool = Field(True, description="Force termination (SIGKILL / TerminateProcess)")


class AbuseReportRequest(BaseModel):
    ip: str = Field(..., description="Offending IP address")
    attack_vector: str = Field("Prompt Injection & Unauthorized Tool Usage", description="Attack vector")
    severity: str = Field("CRITICAL", description="Severity classification")
    mitre_id: str = Field("T1059.001", description="MITRE ATT&CK technique")
    evidence_snippet: str = Field("Malicious shell command injection attempt", description="Forensic evidence")


@router.get("/processes", summary="Enumerate Monitored AI & Agent Processes")
async def list_agent_processes(current_user: User = Depends(get_current_user)):
    """
    Lists running agent runtimes, Python workers, and LLM runner processes with resource usage.
    """
    return active_defense_service.list_running_agent_processes()


@router.post("/kill-process", summary="1-Click Malicious Process Kill Switch")
async def kill_process(
    req: KillProcessRequest,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Terminates a registered agent runner process via Active Defense. Requires Administrator privileges (SEC-01).
    Disallows terminating arbitrary host processes outside monitored agent runtimes.
    """
    import os
    if req.pid <= 4 or req.pid == os.getpid():
        raise HTTPException(status_code=400, detail="Protected system or AgentTrust platform PID cannot be terminated.")

    # Restrict termination strictly to monitored agent runner processes
    monitored = {p["pid"] for p in active_defense_service.list_running_agent_processes()}
    if req.pid not in monitored:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Target PID {req.pid} is not an enrolled agent process. Terminating arbitrary host processes is strictly prohibited."
        )

    res = active_defense_service.kill_process(
        pid=req.pid,
        agent_id=req.agent_id,
        reason=req.reason,
        force=req.force
    )
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to terminate process"))
    return res


@router.get("/countermeasures", summary="Active Defense Countermeasures History")
async def get_countermeasures_history(current_user: User = Depends(get_current_user)):
    """
    Returns the real-time audit ledger of all executed active defense countermeasures.
    """
    return active_defense_service.get_countermeasures_history()


@router.get("/quarantine", summary="List Quarantined Malware Vault Files")
async def list_quarantine_files(current_user: User = Depends(get_current_user)):
    """
    Returns all files isolated in the secure quarantine storage vault.
    """
    return await file_scanner_service.list_quarantine()


@router.post("/quarantine/{quarantine_id}/restore", summary="Restore Quarantined File")
async def restore_quarantined_file(
    quarantine_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Restores a quarantined file back to its original location.
    """
    try:
        res = await file_scanner_service.restore_quarantined_file(quarantine_id)
        return res
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/quarantine/{quarantine_id}", summary="Permanently Purge Quarantined File")
async def purge_quarantined_file(
    quarantine_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Permanently purges a file from the quarantine vault after forensic verification.
    """
    try:
        res = await file_scanner_service.purge_quarantined_file(quarantine_id)
        return res
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/abuse-report", summary="Generate RFC-Compliant ISP Abuse Notice")
async def generate_abuse_report(
    req: AbuseReportRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Compiles an RFC-compliant network abuse report for external transit providers and cloud hosts.
    """
    report_text = active_defense_service.generate_isp_abuse_report(
        ip=req.ip,
        incident_details={
            "attack_vector": req.attack_vector,
            "severity": req.severity,
            "mitre_id": req.mitre_id,
            "evidence_snippet": req.evidence_snippet
        }
    )
    return {"ip": req.ip, "rfc_report": report_text}

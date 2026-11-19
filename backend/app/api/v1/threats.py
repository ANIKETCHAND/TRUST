from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.agent import Agent
from app.models.user import User
from app.services.threat_detection_service import threat_detection_service

router = APIRouter(prefix="/threats", tags=["Autonomous Threat Detection"])


class ThreatEvaluateRequest(BaseModel):
    agent_id: Optional[str] = None
    tool_name: str = Field(..., description="Target tool name")
    operation: str = Field(..., description="Target operation")
    resource: str = Field("", description="Target resource or URI")
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ThreatRemediateRequest(BaseModel):
    action: str = Field("QUARANTINE_AGENT", description="Action to execute: QUARANTINE_AGENT, RESTRICT_AGENT, SINKHOLE_IP")
    notes: Optional[str] = "Manual operator remediation from SOC dashboard"


@router.get("", summary="List Detected Security Threats")
async def list_threats(
    category: Optional[str] = Query(None, description="Filter by threat category"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user)
):
    """Returns detected autonomous threat signals, risk scores, and automated response actions."""
    return threat_detection_service.list_threats(limit=limit, category=category)


@router.get("/{threat_id}", summary="Get Threat Details")
async def get_threat_details(
    threat_id: str,
    current_user: User = Depends(get_current_user)
):
    """Retrieves full telemetry, triggered rules, and forensic evidence for a threat."""
    threat = threat_detection_service.get_threat(threat_id)
    if not threat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Threat not found")
    return threat


@router.post("/evaluate", summary="Evaluate Payload for Security Threats")
async def evaluate_threat_endpoint(
    req: ThreatEvaluateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates an execution request against SQLi, SSRF, Command Injection, Prompt Injection, and DoS patterns.
    """
    # Create or retrieve dummy/actual agent for evaluation context
    agent = Agent(
        id=req.agent_id or "eval-agent-01",
        name="Evaluation Agent",
        role="tester",
        tenant_id="default_tenant"
    )

    threat = threat_detection_service.evaluate_threat(
        agent=agent,
        tool_name=req.tool_name,
        operation=req.operation,
        resource=req.resource,
        parameters=req.parameters,
        context={"client_ip": "127.0.0.1"}
    )

    if not threat:
        return {
            "is_threat": False,
            "threat_category": "BENIGN",
            "severity": "INFORMATIONAL",
            "confidence_score": 0.0,
            "risk_score": 0.0,
            "description": "Payload cleared all deterministic threat filters and ML models.",
            "recommended_response": "ALLOW"
        }

    return {
        "is_threat": True,
        **threat
    }


@router.post("/{threat_id}/remediate", summary="Execute Manual Threat Remediation")
async def remediate_threat(
    threat_id: str,
    req: ThreatRemediateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Executes manual containment on a threat (quarantine, IP sinkhole, restrict)."""
    threat = threat_detection_service.get_threat(threat_id)
    if not threat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Threat not found")

    threat["severity"] = "CRITICAL" if req.action == "QUARANTINE_AGENT" else "HIGH"
    updated = await threat_detection_service.execute_automated_response(db, threat)
    return {
        "threat_id": threat_id,
        "action_taken": req.action,
        "status": updated.get("automated_response_status", "CONTAINED"),
        "notes": req.notes
    }

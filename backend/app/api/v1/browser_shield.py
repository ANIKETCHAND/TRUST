import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.models.incident import IncidentSeverity, IncidentStatus, SecurityIncident
from app.services.dlp_service import dlp_service

router = APIRouter()

SUPPORTED_AI_WORKFLOWS = [
    {"domain": "chatgpt.com", "service": "OpenAI ChatGPT", "supported": True},
    {"domain": "claude.ai", "service": "Anthropic Claude", "supported": True},
    {"domain": "localhost:8080", "service": "AgentTrust Local Gateway", "supported": True},
    {"domain": "127.0.0.1:8080", "service": "AgentTrust Local Gateway", "supported": True},
]


class ExtensionEnrollRequest(BaseModel):
    browser_name: str = Field("Chrome", description="Browser type (Chrome, Brave, Edge, Firefox)")
    browser_version: Optional[str] = None
    extension_version: str = Field("0.2.0")
    enrollment_secret: str = Field(..., description="Shared enrollment secret key")


class ActionCheckRequest(BaseModel):
    target_url: str = Field(..., description="Active URL of the AI workflow")
    prompt_text: str = Field(..., description="Prompt content before transmission")
    action_type: str = Field("submit_prompt", description="Action type: submit_prompt, upload_attachment")
    user_context: Optional[Dict[str, Any]] = None


class ShieldEventReportRequest(BaseModel):
    event_type: str = Field(..., description="PROMPT_BLOCKED, DLP_LEAK_PREVENTED, UNTRUSTED_ORIGIN")
    target_url: str
    reason: str
    severity: str = Field("MEDIUM", description="LOW, MEDIUM, HIGH, CRITICAL")
    findings: Optional[List[Dict[str, Any]]] = None


@router.get("/status", tags=["Browser Shield"])
async def get_browser_shield_status():
    """Returns Browser Shield service health and supported platforms."""
    return {
        "status": "active" if settings.BROWSER_SHIELD_ENABLED else "disabled",
        "shield_version": "0.2.0",
        "supported_workflows": SUPPORTED_AI_WORKFLOWS,
        "enforcement_capabilities": [
            "Pre-submission DLP scanning (PII, API keys, credentials)",
            "Prompt injection pattern detection",
            "Suspicious outbound exfiltration interception",
            "Central incident audit reporting"
        ],
        "limitations": [
            "Cannot inspect native OS applications outside supported browser tabs",
            "Cannot inspect browser traffic outside configured host permissions",
            "Cannot decrypt non-browser-mediated traffic"
        ]
    }


from sqlalchemy import select
from app.api.deps import get_current_user_optional
from app.models.endpoint import BrowserShieldExtension
from app.models.user import User


async def authenticate_extension_or_user(
    x_extension_token: Optional[str] = Header(None, alias="X-Extension-Token"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
) -> Optional[BrowserShieldExtension]:
    if x_extension_token:
        token = x_extension_token.strip()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        stmt = select(BrowserShieldExtension).where(BrowserShieldExtension.token_hash == token_hash)
        res = await db.execute(stmt)
        ext = res.scalars().first()
        if not ext or ext.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked browser extension token."
            )
        ext.last_seen_at = datetime.now(timezone.utc)
        await db.commit()
        return ext

    if current_user:
        return None

    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Provide a valid X-Extension-Token header or user session."
        )
    return None


@router.post("/enroll", tags=["Browser Shield"])
async def enroll_browser_shield(req: ExtensionEnrollRequest, db: AsyncSession = Depends(get_db)):
    """Securely enrolls an AgentTrust Browser Shield extension instance."""
    if req.enrollment_secret != settings.ENROLLMENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Browser Shield enrollment rejected: Invalid secret."
        )

    extension_token = f"absk_live_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(extension_token.encode("utf-8")).hexdigest()
    token_prefix = f"absk_live_{extension_token[10:16]}..."
    now = datetime.now(timezone.utc)

    instance = BrowserShieldExtension(
        id=str(uuid.uuid4()),
        browser_name=req.browser_name,
        browser_version=req.browser_version,
        extension_version=req.extension_version,
        token_hash=token_hash,
        token_prefix=token_prefix,
        status="ACTIVE",
        last_seen_at=now,
        enrolled_at=now
    )
    db.add(instance)
    await db.commit()

    return {
        "status": "ENROLLED",
        "instance_id": instance.id,
        "extension_token": extension_token,
        "token_prefix": token_prefix,
        "gateway_url": f"http://localhost:{settings.API_PORT}{settings.API_V1_STR}",
        "enrolled_at": now,
        "supported_workflows": [w["domain"] for w in SUPPORTED_AI_WORKFLOWS]
    }


@router.post("/check-action", tags=["Browser Shield"])
async def check_browser_action(
    req: ActionCheckRequest,
    _auth: Optional[BrowserShieldExtension] = Depends(authenticate_extension_or_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Evaluates browser-initiated prompts or tool actions before they are sent to web AI agents.
    Performs deterministic DLP scanning and blocks prompt leakage.
    """
    # Verify domain against supported AI workflows
    target_domain = req.target_url.split("/")[2] if "://" in req.target_url else req.target_url
    is_supported = any(w["domain"] in target_domain for w in SUPPORTED_AI_WORKFLOWS)

    # 1. DLP Scan
    has_leak, findings = dlp_service.inspect_payload({"prompt": req.prompt_text})
    if has_leak:
        leak_desc = findings[0]["description"]
        # Record security incident
        incident = SecurityIncident(
            id=str(uuid.uuid4()),
            severity=IncidentSeverity.HIGH,
            title="Browser Shield: Sensitive Data Leakage Blocked",
            description=f"Blocked sensitive {leak_desc} in prompt dispatched to {target_domain}",
            status=IncidentStatus.OPEN,
            incident_metadata={
                "target_url": req.target_url,
                "target_domain": target_domain,
                "findings": findings
            }
        )
        db.add(incident)
        await db.commit()

        return {
            "decision": "BLOCKED",
            "reason": f"Sensitive data detected ({leak_desc}). Submission blocked by AgentTrust Browser Shield.",
            "findings": findings,
            "incident_id": incident.id
        }

    return {
        "decision": "ALLOWED",
        "reason": "Prompt verified safe by AgentTrust Browser Shield inspection.",
        "findings": [],
        "domain_supported": is_supported
    }


@router.post("/events", tags=["Browser Shield"])
async def report_shield_event(
    req: ShieldEventReportRequest,
    _auth: Optional[BrowserShieldExtension] = Depends(authenticate_extension_or_user),
    db: AsyncSession = Depends(get_db)
):
    """Logs browser shield security detections as central security incidents."""
    incident = SecurityIncident(
        id=str(uuid.uuid4()),
        severity=IncidentSeverity(req.severity.upper()) if req.severity.upper() in IncidentSeverity.__members__ else IncidentSeverity.MEDIUM,
        title=f"Browser Shield Alert: {req.event_type}",
        description=f"Action blocked on {req.target_url}: {req.reason}",
        status=IncidentStatus.OPEN,
        incident_metadata={
            "source": "AgentTrust Browser Shield",
            "target_url": req.target_url,
            "findings": req.findings or []
        }
    )
    db.add(incident)
    await db.commit()
    return {"status": "RECORDED", "incident_id": incident.id}


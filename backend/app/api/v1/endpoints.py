import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.models.endpoint import (
    ContainmentScope,
    EndpointContainmentAction,
    EndpointDevice,
    EndpointStatus,
    EndpointTelemetryEvent,
)
from app.models.incident import IncidentSeverity, IncidentStatus, SecurityIncident

router = APIRouter()


# Schemas
class EndpointEnrollRequest(BaseModel):
    hostname: str = Field(..., min_length=2, max_length=255)
    os_platform: str = Field("windows", description="OS platform (windows | linux)")
    os_version: Optional[str] = None
    agent_version: str = Field("0.2.0")
    ip_address: Optional[str] = None
    mac_address: Optional[str] = Field(None, description="Local network segment MAC address only")
    enrollment_secret: str = Field(..., description="Shared enrollment secret key")
    device_metadata: Optional[Dict[str, Any]] = None


class EndpointEnrollResponse(BaseModel):
    device_id: str
    hostname: str
    os_platform: str
    device_token: str
    token_prefix: str
    policy_version: str
    enrolled_at: datetime


class EndpointHeartbeatResponse(BaseModel):
    status: str
    is_contained: bool
    containment_reason: Optional[str] = None
    policy_version: str
    server_time: datetime


class TelemetryItem(BaseModel):
    event_type: str = Field(..., description="process_spawn, tool_invocation, file_touch, network_egress")
    process_name: Optional[str] = None
    process_pid: Optional[int] = None
    command_line: Optional[str] = None
    executable_path: Optional[str] = None
    target_resource: Optional[str] = None
    severity: str = Field("INFO", description="INFO, WARNING, SUSPICIOUS, HIGH")
    is_authorized_agent_workflow: bool = True
    telemetry_details: Optional[Dict[str, Any]] = None


class TelemetryBatchRequest(BaseModel):
    events: List[TelemetryItem]


class ContainmentRequest(BaseModel):
    scope: ContainmentScope = Field(ContainmentScope.PROCESS_SUSPENSION)
    reason: str = Field(..., min_length=5)
    authorized_by: str = Field(..., min_length=2)
    human_approved: bool = Field(True, description="Containment requires explicit human authorization")


class ReleaseContainmentRequest(BaseModel):
    release_notes: str = Field(..., min_length=5)
    released_by: str = Field(..., min_length=2)


async def authenticate_device(
    x_device_token: Optional[str] = Header(None, alias="X-Device-Token"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db)
) -> EndpointDevice:
    raw_token = x_device_token or authorization
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing device credentials. Provide 'X-Device-Token' header."
        )

    if raw_token.lower().startswith("bearer "):
        raw_token = raw_token[7:].strip()

    token_hash = hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()
    stmt = select(EndpointDevice).where(EndpointDevice.device_token_hash == token_hash)
    res = await db.execute(stmt)
    device = res.scalars().first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or unrecognized device token."
        )

    return device


@router.post("/enroll", response_model=EndpointEnrollResponse, status_code=status.HTTP_201_CREATED, tags=["Endpoints"])
async def enroll_endpoint(req: EndpointEnrollRequest, db: AsyncSession = Depends(get_db)):
    """Enrolls an authorized endpoint connector using the secure enrollment secret."""
    if req.enrollment_secret != settings.ENROLLMENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enrollment failed: Invalid enrollment secret key."
        )

    entropy = secrets.token_urlsafe(32)
    raw_device_token = f"epk_live_{entropy}"
    token_hash = hashlib.sha256(raw_device_token.encode("utf-8")).hexdigest()
    token_prefix = f"epk_live_{entropy[:6]}..."

    device_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    device = EndpointDevice(
        id=device_id,
        hostname=req.hostname,
        os_platform=req.os_platform.lower(),
        os_version=req.os_version,
        agent_version=req.agent_version,
        device_token_hash=token_hash,
        device_token_prefix=token_prefix,
        status=EndpointStatus.ONLINE,
        ip_address=req.ip_address,
        mac_address=req.mac_address,
        last_heartbeat_at=now,
        policy_version="v1.0.0",
        enrolled_at=now,
        enrolled_by="admin_enrollment",
        device_metadata=req.device_metadata or {}
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)

    return EndpointEnrollResponse(
        device_id=device.id,
        hostname=device.hostname,
        os_platform=device.os_platform,
        device_token=raw_device_token,
        token_prefix=token_prefix,
        policy_version=device.policy_version,
        enrolled_at=device.enrolled_at
    )


@router.post("/heartbeat", response_model=EndpointHeartbeatResponse, tags=["Endpoints"])
async def endpoint_heartbeat(
    device: EndpointDevice = Depends(authenticate_device),
    db: AsyncSession = Depends(get_db)
):
    """Heartbeat endpoint for enrolled endpoint connector to keep online state active."""
    now = datetime.now(timezone.utc)
    device.last_heartbeat_at = now
    if not device.is_contained and device.status == EndpointStatus.OFFLINE:
        device.status = EndpointStatus.ONLINE

    await db.commit()

    return EndpointHeartbeatResponse(
        status=device.status.value,
        is_contained=device.is_contained,
        containment_reason=device.containment_reason,
        policy_version=device.policy_version,
        server_time=now
    )


@router.post("/telemetry", tags=["Endpoints"])
async def submit_telemetry(
    req: TelemetryBatchRequest,
    device: EndpointDevice = Depends(authenticate_device),
    db: AsyncSession = Depends(get_db)
):
    """Receives authorized agent-workflow telemetry from enrolled endpoint connector."""
    now = datetime.now(timezone.utc)
    device.last_heartbeat_at = now

    created_events = []
    for item in req.events:
        evt = EndpointTelemetryEvent(
            id=str(uuid.uuid4()),
            device_id=device.id,
            event_type=item.event_type,
            process_name=item.process_name,
            process_pid=item.process_pid,
            command_line=item.command_line,
            executable_path=item.executable_path,
            target_resource=item.target_resource,
            severity=item.severity.upper(),
            is_authorized_agent_workflow=item.is_authorized_agent_workflow,
            telemetry_details=item.telemetry_details or {},
            recorded_at=now
        )
        db.add(evt)
        created_events.append(evt)

        # Trigger security incident if telemetry indicates suspicious unapproved local execution
        if item.severity.upper() in ["SUSPICIOUS", "HIGH"] or not item.is_authorized_agent_workflow:
            incident = SecurityIncident(
                id=str(uuid.uuid4()),
                severity=IncidentSeverity.HIGH if item.severity.upper() == "HIGH" else IncidentSeverity.MEDIUM,
                title=f"Suspicious Endpoint Activity on {device.hostname}",
                description=(
                    f"Endpoint telemetry detected {item.event_type} on device '{device.hostname}' ({device.ip_address}). "
                    f"Process: '{item.process_name}' (PID: {item.process_pid}). Command: '{item.command_line}'"
                ),
                status=IncidentStatus.OPEN,
                incident_metadata={
                    "device_id": device.id,
                    "hostname": device.hostname,
                    "event_type": item.event_type,
                    "severity": item.severity,
                    "is_authorized_agent_workflow": item.is_authorized_agent_workflow
                }
            )
            db.add(incident)

    await db.commit()
    return {"status": "SUCCESS", "events_recorded": len(created_events)}


@router.get("/policies", tags=["Endpoints"])
async def get_endpoint_policies(device: EndpointDevice = Depends(authenticate_device)):
    """Synchronizes active endpoint policy definitions for authorized agent workspaces."""
    return {
        "policy_version": device.policy_version,
        "is_contained": device.is_contained,
        "containment_scope": device.containment_reason if device.is_contained else None,
        "monitored_workspaces": [
            "./sandbox_storage",
            "./reports",
            "C:\\AgentTrustWorkspaces"
        ],
        "approved_agent_runtimes": [
            "python.exe",
            "node.exe"
        ],
        "blocked_outbound_ips": [
            "169.254.169.254",
            "127.0.0.1"
        ]
    }


from app.api.deps import get_current_user
from app.models.user import User


@router.get("", tags=["Endpoints"])
async def list_endpoints(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all enrolled endpoint devices."""
    stmt = select(EndpointDevice)
    if status_filter:
        try:
            stat_enum = EndpointStatus(status_filter.upper())
            stmt = stmt.where(EndpointDevice.status == stat_enum)
        except ValueError:
            pass
    stmt = stmt.order_by(EndpointDevice.enrolled_at.desc())
    res = await db.execute(stmt)
    devices = res.scalars().all()

    return [
        {
            "id": d.id,
            "hostname": d.hostname,
            "os_platform": d.os_platform,
            "os_version": d.os_version,
            "agent_version": d.agent_version,
            "status": d.status.value,
            "token_prefix": d.device_token_prefix,
            "ip_address": d.ip_address,
            "mac_address": d.mac_address,
            "last_heartbeat_at": d.last_heartbeat_at,
            "is_contained": d.is_contained,
            "containment_reason": d.containment_reason,
            "enrolled_at": d.enrolled_at
        }
        for d in devices
    ]


@router.get("/{device_id}", tags=["Endpoints"])
async def get_endpoint_detail(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full device details, recent telemetry, and containment actions."""
    device = await db.get(EndpointDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    # Fetch recent 50 telemetry events
    telem_stmt = (
        select(EndpointTelemetryEvent)
        .where(EndpointTelemetryEvent.device_id == device_id)
        .order_by(EndpointTelemetryEvent.recorded_at.desc())
        .limit(50)
    )
    telem_res = await db.execute(telem_stmt)
    events = telem_res.scalars().all()

    # Fetch containment history
    cont_stmt = (
        select(EndpointContainmentAction)
        .where(EndpointContainmentAction.device_id == device_id)
        .order_by(EndpointContainmentAction.created_at.desc())
    )
    cont_res = await db.execute(cont_stmt)
    containments = cont_res.scalars().all()

    return {
        "device": {
            "id": device.id,
            "hostname": device.hostname,
            "os_platform": device.os_platform,
            "os_version": device.os_version,
            "agent_version": device.agent_version,
            "status": device.status.value,
            "token_prefix": device.device_token_prefix,
            "ip_address": device.ip_address,
            "mac_address": device.mac_address,
            "last_heartbeat_at": device.last_heartbeat_at,
            "is_contained": device.is_contained,
            "containment_reason": device.containment_reason,
            "enrolled_at": device.enrolled_at,
            "device_metadata": device.device_metadata
        },
        "recent_telemetry": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "process_name": e.process_name,
                "process_pid": e.process_pid,
                "command_line": e.command_line,
                "executable_path": e.executable_path,
                "target_resource": e.target_resource,
                "severity": e.severity,
                "is_authorized_agent_workflow": e.is_authorized_agent_workflow,
                "recorded_at": e.recorded_at
            }
            for e in events
        ],
        "containment_history": [
            {
                "id": c.id,
                "scope": c.scope.value,
                "action_type": c.action_type,
                "reason": c.reason,
                "authorized_by": c.authorized_by,
                "human_approved": c.human_approved,
                "is_active": c.is_active,
                "created_at": c.created_at,
                "released_at": c.released_at,
                "release_notes": c.release_notes
            }
            for c in containments
        ]
    }


from app.api.deps import get_current_admin_user
from app.models.user import User


@router.post("/{device_id}/contain", tags=["Endpoints"])
async def contain_endpoint(
    device_id: str,
    req: ContainmentRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Applies controlled endpoint containment with explicit human safeguards.
    No destructive deletion or arbitrary process termination.
    Requires administrative role.
    """
    device = await db.get(EndpointDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    if not req.human_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Containment safeguard error: High-impact containment requires explicit human approval."
        )

    device.is_contained = True
    device.status = EndpointStatus.CONTAINED
    device.containment_reason = req.reason

    action = EndpointContainmentAction(
        id=str(uuid.uuid4()),
        device_id=device.id,
        scope=req.scope,
        action_type="ISOLATE",
        reason=req.reason,
        authorized_by=req.authorized_by,
        human_approved=True,
        is_active=True
    )
    db.add(action)

    # Log critical incident
    incident = SecurityIncident(
        id=str(uuid.uuid4()),
        severity=IncidentSeverity.CRITICAL,
        title=f"Endpoint Contained: {device.hostname}",
        description=f"Device {device.hostname} contained by {req.authorized_by}. Reason: {req.reason}. Scope: {req.scope.value}",
        status=IncidentStatus.INVESTIGATING,
        incident_metadata={"device_id": device.id, "scope": req.scope.value}
    )
    db.add(incident)

    await db.commit()
    return {
        "status": "CONTAINED",
        "device_id": device.id,
        "scope": req.scope.value,
        "containment_action_id": action.id,
        "message": f"Endpoint '{device.hostname}' successfully isolated under scope '{req.scope.value}'."
    }


@router.post("/{device_id}/release", tags=["Endpoints"])
async def release_endpoint_containment(
    device_id: str,
    req: ReleaseContainmentRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Releases containment on an enrolled endpoint, returning it to ONLINE state. Requires administrative role."""
    device = await db.get(EndpointDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    if not device.is_contained:
        return {"status": "NOT_CONTAINED", "message": "Endpoint is not currently contained."}

    now = datetime.now(timezone.utc)
    device.is_contained = False
    device.status = EndpointStatus.ONLINE
    device.containment_reason = None

    # Mark active containment actions as released
    cont_stmt = (
        select(EndpointContainmentAction)
        .where(
            EndpointContainmentAction.device_id == device_id,
            EndpointContainmentAction.is_active == True
        )
    )
    cont_res = await db.execute(cont_stmt)
    for act in cont_res.scalars().all():
        act.is_active = False
        act.released_at = now
        act.release_notes = f"Released by {req.released_by}: {req.release_notes}"

    await db.commit()
    return {
        "status": "RELEASED",
        "device_id": device.id,
        "message": f"Containment lifted for '{device.hostname}'. Status restored to ONLINE."
    }

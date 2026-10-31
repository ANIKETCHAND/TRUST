import csv
import io
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.audit import AuditEvent, PolicyDecision
from app.models.incident import IncidentSeverity, IncidentStatus, SecurityIncident
from app.schemas.audit import AuditEventResponse

router = APIRouter()


class IncidentUpdateRequest(BaseModel):
    status: Optional[IncidentStatus] = None
    resolution_notes: Optional[str] = Field(None, min_length=3)


@router.get("", response_model=List[AuditEventResponse], tags=["Audit"])
async def list_audit_events(
    agent_id: Optional[str] = Query(None),
    tool_name: Optional[str] = Query(None),
    decision: Optional[PolicyDecision] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves immutable audit logs for security inspections."""
    query = select(AuditEvent)
    if agent_id:
        query = query.where(AuditEvent.agent_id == agent_id)
    if tool_name:
        query = query.where(AuditEvent.tool_name == tool_name)
    if decision:
        query = query.where(AuditEvent.decision == decision)
        
    query = query.order_by(AuditEvent.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/export", tags=["Audit"])
async def export_audit_events(
    format: str = Query("json", enum=["json", "csv"]),
    limit: int = Query(500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db)
):
    """Exports audit logs in JSON or CSV format for external SIEM / compliance integration."""
    query = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Event ID", "Request ID", "Timestamp", "Agent ID", "Agent Name",
            "Tool", "Operation", "Target Resource", "Decision", "Reason",
            "Status", "Duration (ms)"
        ])
        for ev in events:
            writer.writerow([
                ev.id, ev.request_id, ev.created_at.isoformat(), ev.agent_id,
                ev.agent_name, ev.tool_name, ev.operation, ev.target_resource,
                ev.decision.value, ev.decision_reason, ev.execution_status.value,
                ev.execution_duration_ms or 0
            ])
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=agenttrust_audit_export.csv"}
        )

    # JSON export
    data = [
        {
            "id": ev.id,
            "request_id": ev.request_id,
            "agent_id": ev.agent_id,
            "agent_name": ev.agent_name,
            "tool_name": ev.tool_name,
            "operation": ev.operation,
            "target_resource": ev.target_resource,
            "decision": ev.decision.value,
            "decision_reason": ev.decision_reason,
            "execution_status": ev.execution_status.value,
            "execution_duration_ms": ev.execution_duration_ms,
            "context_metadata": ev.context_metadata,
            "created_at": ev.created_at.isoformat()
        }
        for ev in events
    ]
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=agenttrust_audit_export.json"}
    )


@router.get("/incidents", tags=["Audit"])
async def list_security_incidents(
    severity: Optional[IncidentSeverity] = Query(None),
    status: Optional[IncidentStatus] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves security incidents generated from blocked or suspicious actions."""
    query = select(SecurityIncident)
    if severity:
        query = query.where(SecurityIncident.severity == severity)
    if status:
        query = query.where(SecurityIncident.status == status)
        
    query = query.order_by(SecurityIncident.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/incidents/{incident_id}", tags=["Audit"])
async def update_security_incident(
    incident_id: str, req: IncidentUpdateRequest, db: AsyncSession = Depends(get_db)
):
    """Updates investigation timeline, resolution notes, and incident status."""
    incident = await db.get(SecurityIncident, incident_id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if req.status is not None:
        incident.status = req.status
    if req.resolution_notes is not None:
        incident.resolution_notes = req.resolution_notes

    await db.commit()
    await db.refresh(incident)
    return incident

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.audit import AuditEvent, PolicyDecision
from app.models.incident import SecurityIncident, IncidentSeverity, IncidentStatus
from app.schemas.audit import AuditEventResponse

router = APIRouter()


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
    incidents = result.scalars().all()
    return incidents

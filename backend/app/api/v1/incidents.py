from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.incident import IncidentSeverity, IncidentStatus, SecurityIncident
from app.models.user import User
from app.services.agent_service import agent_service
from app.services.report_generator import report_generator

router = APIRouter(prefix="/incidents", tags=["Incident Management"])


class IncidentCreateRequest(BaseModel):
    agent_id: Optional[str] = None
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=3)
    severity: IncidentSeverity = IncidentSeverity.MEDIUM
    status: IncidentStatus = IncidentStatus.OPEN
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class IncidentUpdateRequest(BaseModel):
    status: Optional[IncidentStatus] = None
    severity: Optional[IncidentSeverity] = None
    resolution_notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@router.get("", summary="List Security Incidents")
async def list_incidents(
    severity: Optional[IncidentSeverity] = Query(None),
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists security incidents with optional filtering by severity, status, or agent."""
    stmt = select(SecurityIncident)
    if severity:
        stmt = stmt.where(SecurityIncident.severity == severity)
    if status_filter:
        stmt = stmt.where(SecurityIncident.status == status_filter)
    if agent_id:
        stmt = stmt.where(SecurityIncident.agent_id == agent_id)

    stmt = stmt.order_by(SecurityIncident.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create Security Incident")
async def create_incident(
    req: IncidentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually creates a security incident dossier."""
    inc = SecurityIncident(
        id=str(uuid.uuid4()),
        agent_id=req.agent_id,
        severity=req.severity,
        title=req.title,
        description=req.description,
        status=req.status,
        incident_metadata=req.metadata or {}
    )
    db.add(inc)
    await db.commit()
    await db.refresh(inc)
    return inc


@router.get("/{incident_id}", summary="Get Security Incident Dossier")
async def get_incident(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full forensic details for a security incident."""
    inc = await db.get(SecurityIncident, incident_id)
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return inc


@router.patch("/{incident_id}", summary="Update Security Incident Status or Notes")
async def update_incident(
    incident_id: str,
    req: IncidentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates the status (OPEN, INVESTIGATING, CONTAINED, RESOLVED, FALSE_POSITIVE) or resolution notes."""
    inc = await db.get(SecurityIncident, incident_id)
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if req.status is not None:
        inc.status = req.status
    if req.severity is not None:
        inc.severity = req.severity
    if req.resolution_notes is not None:
        inc.resolution_notes = req.resolution_notes
    if req.metadata is not None:
        merged = dict(inc.incident_metadata or {})
        merged.update(req.metadata)
        inc.incident_metadata = merged

    await db.commit()
    await db.refresh(inc)
    return inc


@router.get("/{incident_id}/report", summary="Export Forensic Incident Report")
async def export_incident_report(
    incident_id: str,
    format: str = Query("html", pattern="^(html|json|csv)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports a comprehensive forensic report with executive summary, MITRE mapping,
    attacker attribution, and countermeasure timeline.
    """
    try:
        dossier = await report_generator.generate_incident_dossier(db, incident_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_id}' not found")

    if format == "json":
        return Response(content=report_generator.export_as_json(dossier), media_type="application/json")
    elif format == "csv":
        return Response(
            content=report_generator.export_as_csv(dossier),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=incident_{incident_id}.csv"}
        )
    else:
        return Response(content=report_generator.export_as_html(dossier), media_type="text/html")


@router.post("/{incident_id}/quarantine-agent", summary="Quarantine Agent from Incident")
async def quarantine_agent_from_incident(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Executes 1-click containment to quarantine the target agent involved in this incident."""
    inc = await db.get(SecurityIncident, incident_id)
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    if not inc.agent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No agent associated with this incident")

    await agent_service.quarantine_agent(
        db, inc.agent_id, reason=f"Quarantined from Incident {inc.id}: {inc.title}", quarantined_by=current_user.username
    )
    inc.status = IncidentStatus.CONTAINED
    await db.commit()
    return {"status": "SUCCESS", "message": f"Agent '{inc.agent_id}' quarantined and incident contained."}

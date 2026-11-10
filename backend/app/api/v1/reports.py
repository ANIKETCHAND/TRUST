"""
Forensic Incident & Compliance Reports API Endpoints
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.report_generator import report_generator

router = APIRouter(prefix="/reports", tags=["Forensic Reports"])


@router.get("/incident/{incident_id}/export", summary="Export Forensic Incident Dossier (GET)")
@router.post("/incident/{incident_id}/export", summary="Export Forensic Incident Dossier (JSON / HTML / CSV)")
async def export_incident_report(
    incident_id: str,
    format: str = Query("html", pattern="^(html|json|csv)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Compiles an industrial-grade incident response dossier with MITRE ATT&CK mapping,
    attacker attribution, and active countermeasure ledger in requested format.
    """
    dossier = await report_generator.generate_incident_dossier(db, incident_id)

    if format == "json":
        json_content = report_generator.export_as_json(dossier)
        return Response(content=json_content, media_type="application/json")
    elif format == "csv":
        csv_content = report_generator.export_as_csv(dossier)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=incident_{incident_id}_forensics.csv"}
        )
    else:  # html
        html_content = report_generator.export_as_html(dossier)
        return Response(content=html_content, media_type="text/html")


@router.get("/executive-summary", summary="Executive Security Posture & Post-Attack Audit")
async def get_executive_summary(
    format: str = Query("json", pattern="^(json|html)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns platform-wide posture metrics, block ratios, and executive recommendations.
    """
    summary = await report_generator.get_executive_summary(db)
    if format == "html":
        html_content = report_generator.export_executive_summary_html(summary)
        return Response(content=html_content, media_type="text/html")
    return summary


@router.get("/mitre-matrix", summary="Platform MITRE ATT&CK Taxonomy")
async def get_mitre_matrix():
    """
    Returns all supported MITRE ATT&CK techniques monitored by AgentTrust guardrails.
    """
    return report_generator.MITRE_ATTACK_MAPPINGS

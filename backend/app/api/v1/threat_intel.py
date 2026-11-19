from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.user import User
from app.services.threat_intel_service import threat_intel_service

router = APIRouter(prefix="/threat-intelligence", tags=["Threat Intelligence & Investigation"])


class IndicatorInvestigateRequest(BaseModel):
    indicator: str = Field(..., description="IP, Domain, URL, or Cryptographic File Hash", min_length=2)
    indicator_type: Optional[str] = Field(None, description="Optional type: ip, domain, hash, url")


@router.post("/investigate", summary="Investigate Indicator of Compromise (IoC)")
async def investigate_indicator(
    req: IndicatorInvestigateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Performs modular threat intelligence correlation across AbuseIPDB, VirusTotal,
    URLhaus, AlienVault, RDAP, and DNS lookups.
    """
    if not req.indicator:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Indicator cannot be empty.")

    dossier = threat_intel_service.investigate(
        indicator=req.indicator,
        indicator_type=req.indicator_type
    )
    return dossier


@router.get("/history", summary="Investigation History Dossiers")
async def get_investigation_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user)
):
    """Returns recent IoC investigation records."""
    return threat_intel_service.get_history(limit=limit)

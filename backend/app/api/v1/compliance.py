from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.user import User
from app.services.compliance_knowledge_service import compliance_knowledge_service

router = APIRouter(prefix="/compliance", tags=["Cybersecurity Knowledge & Cyberlaw Compliance"])


class AssessIncidentRequest(BaseModel):
    category: str = Field(..., description="Threat or incident category (e.g. PROMPT_INJECTION, DATA_EXFILTRATION)")
    details: str = Field(..., description="Description or event details")


@router.get("/search", summary="Search Cyberlaw & Cybersecurity Frameworks")
async def search_compliance_articles(
    q: str = Query("", description="Keywords or search query"),
    framework: Optional[str] = Query(None, description="Filter by framework"),
    jurisdiction: Optional[str] = Query(None, description="Filter by jurisdiction (India, Global, etc.)"),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves verified legal references, statutory provisions (IT Act 2000, DPDPA 2023, CERT-In),
    and AI security frameworks (NIST, OWASP, MITRE ATLAS).
    """
    return compliance_knowledge_service.search(query=q, framework=framework, jurisdiction=jurisdiction)


@router.get("/frameworks", summary="List Supported Compliance Frameworks")
async def list_frameworks(current_user: User = Depends(get_current_user)):
    """Returns all supported legal and cybersecurity frameworks."""
    return compliance_knowledge_service.get_frameworks()


@router.get("/articles/{article_id}", summary="Get Compliance Article by ID")
async def get_compliance_article(article_id: str, current_user: User = Depends(get_current_user)):
    """Returns full citation, statutory obligations, and remediation guidance for an article."""
    article = compliance_knowledge_service.get_article(article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article


@router.post("/assess-incident", summary="Assess Incident for Regulatory Obligations & Cyberlaw Implications")
async def assess_incident(req: AssessIncidentRequest, current_user: User = Depends(get_current_user)):
    """
    Evaluates an incident against Indian law (CERT-In 6-hour reporting window, DPDPA 2023 breach rules,
    IT Act Sections 43/66) and international AI standards.
    """
    return compliance_knowledge_service.assess_incident(category=req.category, details=req.details)

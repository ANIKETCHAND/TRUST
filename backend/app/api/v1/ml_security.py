import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

try:
    from app.services.ml_security_model import MLSecurityModelService
except ImportError:
    from backend.app.services.ml_security_model import MLSecurityModelService

logger = logging.getLogger("crossx.api.ml_security")
router = APIRouter(prefix="/ml-security", tags=["ML Security Control Model"])


class PredictRequest(BaseModel):
    prompt: str = Field(..., description="Prompt, command, or payload to inspect for threats", min_length=1)
    agent_id: Optional[str] = Field(None, description="Optional SPIFFE or agent identifier")


class PredictResponse(BaseModel):
    prompt: str
    is_threat: bool
    threat_score: float
    threat_percentage: str
    category: str
    severity: str
    violated_regulations: List[str]
    recommended_action: str
    latency_ms: float
    engine: str


class ModelStatusResponse(BaseModel):
    status: str
    version: str
    model_type: str
    samples_count: int
    train_accuracy: float
    threat_categories: List[str]
    frameworks: List[str]


@router.post("/predict", response_model=PredictResponse, summary="Inspect prompt using ML Security Model")
async def inspect_prompt(payload: PredictRequest):
    """
    Evaluates incoming prompt or tool invocation using the trained ML Security Model.
    Predicts threat probability, cybercrime classification, and regulatory violations.
    """
    try:
        svc = MLSecurityModelService.get_instance()
        result = svc.predict(payload.prompt)
        return PredictResponse(**result)
    except Exception as e:
        logger.error(f"Error during ML prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}"
        )


@router.get("/status", response_model=ModelStatusResponse, summary="Get ML Security Model Status & Metadata")
async def get_model_status():
    """
    Returns the active model metadata, supported legal frameworks, and accuracy.
    """
    svc = MLSecurityModelService.get_instance()
    meta = svc.metadata or {}
    return ModelStatusResponse(
        status="ONLINE",
        version=meta.get("version", "1.0.0"),
        model_type=meta.get("model_type", "TF-IDF + Calibrated Logistic Regression"),
        samples_count=meta.get("samples_count", 0),
        train_accuracy=meta.get("train_accuracy", 1.0),
        threat_categories=meta.get("threat_categories", []),
        frameworks=meta.get("frameworks", ["EU AI Act", "NIST AI RMF", "OWASP Top 10 for LLMs", "MITRE ATLAS"])
    )


@router.post("/retrain", summary="Retrain ML Security Model on updated threat records")
async def retrain_model():
    """
    Retrains the classifier on the latest cybercrime & regulatory dataset.
    """
    try:
        svc = MLSecurityModelService.get_instance()
        metadata = svc.train()
        return {"status": "SUCCESS", "message": "ML Security Model retrained successfully", "metadata": metadata}
    except Exception as e:
        logger.error(f"Error retraining ML model: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retraining error: {str(e)}"
        )

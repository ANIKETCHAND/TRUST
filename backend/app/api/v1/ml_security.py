import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

try:
    from app.services.ml_security_model import MLSecurityModelService
except ImportError:
    from backend.app.services.ml_security_model import MLSecurityModelService

logger = logging.getLogger("crossx.api.ml_security")
ml_base = APIRouter()


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


@ml_base.post("/predict", response_model=PredictResponse, summary="Inspect prompt using ML Security Model")
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


@ml_base.get("/status", response_model=ModelStatusResponse, summary="Get ML Security Model Status & Metadata")
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


@ml_base.post("/retrain", summary="Retrain ML Security Model on updated threat records")
@ml_base.post("/train", summary="Train ML Security Model on latest datasets (Section 18 /ml/train)")
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


class EventClassificationRequest(BaseModel):
    text: str = Field(..., description="Event payload, prompt, or tool output text", min_length=1)


class AnomalyScoreRequest(BaseModel):
    calls_per_min: float = Field(10.0, description="Rate of tool invocations per minute")
    avg_payload_bytes: float = Field(500.0, description="Average parameter payload size in bytes")
    error_rate_pct: float = Field(2.0, description="Execution error rate percentage (0-100)")
    execution_duration_ms: float = Field(80.0, description="Average tool latency in milliseconds")


class RiskScoreRequest(BaseModel):
    threat_category: str = Field(..., description="Threat category (e.g. PROMPT_INJECTION, SQL_INJECTION, DATA_EXFILTRATION)")
    model_confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence of primary detector")
    tool_sensitivity: float = Field(0.5, ge=0.0, le=1.0, description="Destructiveness weight of target tool")
    data_sensitivity: float = Field(0.5, ge=0.0, le=1.0, description="Confidentiality classification of target data")
    agent_state: str = Field("active", description="Current agent status")
    ip_reputation: float = Field(0.0, ge=0.0, le=100.0, description="Attacker IP reputation score")


@ml_base.get("/models", summary="Inventory of All Deployed ML Security Models")
async def get_models_inventory():
    """Returns deployment status, versions, and test metrics for Models A, B, C, and D."""
    svc = MLSecurityModelService.get_instance()
    meta = svc.metadata or {}
    return {
        "status": "ONLINE",
        "version": meta.get("version", "2.1.0"),
        "models": meta.get("models", {}),
        "test_metrics": meta.get("test_metrics", {}),
        "samples_count": meta.get("samples_count", 0),
        "train_accuracy": meta.get("train_accuracy", 1.0),
        "training_duration_sec": meta.get("training_duration_sec", 0.0),
        "frameworks": meta.get("frameworks", [])
    }


@ml_base.post("/classify-event", summary="Model B: Classify Security Event")
async def classify_security_event(req: EventClassificationRequest):
    """Model B: Multi-class classification of security events."""
    svc = MLSecurityModelService.get_instance()
    return svc.classify_event(req.text)


@ml_base.post("/anomaly-score", summary="Model C: Behavioral Anomaly Detection")
async def evaluate_behavioral_anomaly(req: AnomalyScoreRequest):
    """Model C: Isolation Forest behavioral deviation scoring against normal baseline."""
    svc = MLSecurityModelService.get_instance()
    return svc.detect_behavioral_anomaly(
        calls_per_min=req.calls_per_min,
        avg_payload_bytes=req.avg_payload_bytes,
        error_rate_pct=req.error_rate_pct,
        execution_duration_ms=req.execution_duration_ms
    )


@ml_base.post("/risk-score", summary="Model D: Explainable Multi-Factor Risk Scoring")
async def compute_explainable_risk(req: RiskScoreRequest):
    """Model D: Transparent factor weighting for composite risk scoring."""
    svc = MLSecurityModelService.get_instance()
    return svc.calculate_risk_score(
        threat_category=req.threat_category,
        model_confidence=req.model_confidence,
        tool_sensitivity=req.tool_sensitivity,
        data_sensitivity=req.data_sensitivity,
        agent_state=req.agent_state,
        ip_reputation=req.ip_reputation
    )


router = APIRouter(prefix="/ml-security", tags=["ML Security Control Model"])
router.include_router(ml_base)

ml_router = APIRouter(prefix="/ml", tags=["ML Security Model Engine"])
ml_router.include_router(ml_base)

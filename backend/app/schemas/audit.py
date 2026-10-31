from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.models.audit import PolicyDecision, ExecutionStatus


class AuditEventResponse(BaseModel):
    id: str
    request_id: str
    agent_id: str
    agent_name: Optional[str] = None
    tool_name: str
    operation: str
    target_resource: str
    decision: PolicyDecision
    decision_reason: str
    policy_id_triggered: Optional[str] = None
    delegation_id: Optional[str] = None
    provenance_id: Optional[str] = None
    execution_status: ExecutionStatus
    execution_duration_ms: Optional[float] = None
    context_metadata: Dict[str, Any]
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.agent import AgentStatus


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    description: Optional[str] = None
    role: str = Field("general_agent", max_length=64)
    agent_type: Optional[str] = Field("custom_python", max_length=64)
    owner: Optional[str] = Field("security_admin", max_length=128)
    environment: Optional[str] = Field("production", max_length=64)
    risk_classification: Optional[str] = Field("LOW", max_length=32)
    agent_version: Optional[str] = Field("1.0.0", max_length=32)
    agent_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=128)
    description: Optional[str] = None
    role: Optional[str] = None
    status: Optional[AgentStatus] = None
    agent_type: Optional[str] = None
    owner: Optional[str] = None
    environment: Optional[str] = None
    risk_classification: Optional[str] = None
    security_score: Optional[float] = None
    agent_version: Optional[str] = None
    agent_metadata: Optional[Dict[str, Any]] = None


class AgentRevokeRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)


class AgentQuarantineRequest(BaseModel):
    reason: str = Field("Automated threat response quarantine", min_length=3, max_length=255)


class AgentSuspendRequest(BaseModel):
    reason: str = Field("Administrative suspension", min_length=3, max_length=255)


class AgentRestrictRequest(BaseModel):
    reason: str = Field("Security restriction applied - read-only containment", min_length=3, max_length=255)


class AgentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    role: str
    status: AgentStatus
    agent_type: str = "custom_python"
    owner: Optional[str] = "security_admin"
    environment: str = "production"
    risk_classification: str = "LOW"
    security_score: float = 100.0
    agent_version: str = "1.0.0"
    last_activity_at: Optional[datetime] = None
    agent_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentRegistrationResponse(BaseModel):
    agent: AgentResponse
    raw_api_key: str
    token_prefix: str
    warning: str = "Store this API key safely. It will never be shown again."

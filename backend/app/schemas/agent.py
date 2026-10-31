from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.models.agent import AgentStatus


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    description: Optional[str] = None
    role: str = Field("general_agent", max_length=64)
    agent_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=128)
    description: Optional[str] = None
    role: Optional[str] = None
    status: Optional[AgentStatus] = None
    agent_metadata: Optional[Dict[str, Any]] = None


class AgentRevokeRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)


class AgentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    role: str
    status: AgentStatus
    agent_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentRegistrationResponse(BaseModel):
    agent: AgentResponse
    raw_api_key: str
    token_prefix: str
    warning: str = "Store this API key safely. It will never be shown again."

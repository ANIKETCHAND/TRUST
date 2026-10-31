from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.models.permission import PermissionEffect


class PermissionCreate(BaseModel):
    agent_id: Optional[str] = None
    tool_name: str = Field(..., min_length=1, max_length=64)
    operation: str = Field(..., min_length=1, max_length=64)
    resource_pattern: str = Field("*", max_length=255)
    effect: PermissionEffect = PermissionEffect.ALLOW
    priority: int = Field(10, ge=1, le=100)
    conditions: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None
    expires_at: Optional[datetime] = None


class PermissionResponse(BaseModel):
    id: str
    agent_id: Optional[str] = None
    tool_name: str
    operation: str
    resource_pattern: str
    effect: PermissionEffect
    priority: int
    conditions: Dict[str, Any]
    description: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

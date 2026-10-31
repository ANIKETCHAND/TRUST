from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.models.tool import ToolCategory, ToolStatus


class ToolCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=64)
    display_name: str = Field(..., min_length=2, max_length=128)
    description: Optional[str] = None
    category: ToolCategory = ToolCategory.SYSTEM
    supported_operations: List[str] = Field(..., min_length=1)
    configuration: Dict[str, Any] = Field(default_factory=dict)
    is_protected: bool = True


class ToolResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    category: ToolCategory
    status: ToolStatus
    supported_operations: List[str]
    is_protected: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class GatewayExecuteRequest(BaseModel):
    tool: str = Field(..., description="Target tool identifier (e.g. 'filesystem_tool')")
    operation: str = Field(..., description="Action to perform (e.g. 'read_file')")
    resource: str = Field(..., description="Target resource path or identifier (e.g. 'reports/summary.txt')")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parameters to pass to the tool")
    context: Dict[str, Any] = Field(default_factory=dict, description="Execution context, delegation token, etc.")


class GatewayExecuteResponse(BaseModel):
    request_id: str
    event_id: str
    decision: str  # ALLOWED, BLOCKED, APPROVAL_REQUIRED
    execution_status: str  # SUCCESS, FAILED, BLOCKED
    result: Optional[Any] = None
    error: Optional[str] = None
    reason: str
    execution_duration_ms: Optional[float] = None

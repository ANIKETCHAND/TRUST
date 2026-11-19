from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.models.audit import AuditEvent, PolicyDecision
from app.models.user import User

router = APIRouter(prefix="/security", tags=["Security Events & Telemetry"])


@router.get("/events", summary="Unified Security Event Stream (Section 15 & Section 18)")
async def get_security_events(
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    decision: Optional[str] = Query(None, description="Filter by ALLOWED or BLOCKED"),
    tool_name: Optional[str] = Query(None, description="Filter by tool name"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns unified real-time stream of intercepted tool calls, security decisions,
    policy enforcement actions, and DLP inspection outcomes.
    """
    query = select(AuditEvent)
    count_query = select(func.count(AuditEvent.id))

    if agent_id:
        query = query.where(AuditEvent.agent_id == agent_id)
        count_query = count_query.where(AuditEvent.agent_id == agent_id)

    if decision:
        dec_upper = decision.upper()
        if dec_upper in [d.value for d in PolicyDecision]:
            query = query.where(AuditEvent.decision == PolicyDecision(dec_upper))
            count_query = count_query.where(AuditEvent.decision == PolicyDecision(dec_upper))

    if tool_name:
        query = query.where(AuditEvent.tool_name == tool_name)
        count_query = count_query.where(AuditEvent.tool_name == tool_name)

    total = await db.scalar(count_query) or 0
    query = query.order_by(AuditEvent.created_at.desc()).offset(offset).limit(limit)
    res = await db.execute(query)
    events = res.scalars().all()

    return {
        "total": total,
        "count": len(events),
        "limit": limit,
        "offset": offset,
        "events": [
            {
                "id": ev.id,
                "request_id": ev.request_id,
                "timestamp": ev.created_at.isoformat(),
                "agent_id": ev.agent_id,
                "agent_name": ev.agent_name or ev.agent_id,
                "tool_name": ev.tool_name,
                "operation": ev.operation,
                "target_resource": ev.target_resource,
                "decision": ev.decision.value,
                "decision_reason": ev.decision_reason,
                "execution_status": ev.execution_status.value,
                "execution_duration_ms": ev.execution_duration_ms,
                "context_metadata": ev.context_metadata
            }
            for ev in events
        ]
    }

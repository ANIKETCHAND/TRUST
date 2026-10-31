from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.agent import Agent, AgentStatus
from app.models.audit import AuditEvent, PolicyDecision
from app.models.incident import IncidentStatus, SecurityIncident
from app.models.tool import Tool

router = APIRouter()


@router.get("/stats", tags=["Overview"])
async def get_overview_statistics(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Computes real-time cybersecurity metrics aggregated directly from the database.
    Zero hardcoded values.
    """
    # 1. Agent counts
    agent_total = await db.scalar(select(func.count(Agent.id))) or 0
    agent_active = await db.scalar(
        select(func.count(Agent.id)).where(Agent.status == AgentStatus.ACTIVE)
    ) or 0

    # 2. Tool counts
    tools_total = await db.scalar(select(func.count(Tool.id))) or 0

    # 3. Decision metrics
    allowed_count = await db.scalar(
        select(func.count(AuditEvent.id)).where(AuditEvent.decision == PolicyDecision.ALLOWED)
    ) or 0
    blocked_count = await db.scalar(
        select(func.count(AuditEvent.id)).where(AuditEvent.decision == PolicyDecision.BLOCKED)
    ) or 0

    # 4. Open Incidents
    open_incidents = await db.scalar(
        select(func.count(SecurityIncident.id)).where(
            SecurityIncident.status.in_([IncidentStatus.OPEN, IncidentStatus.INVESTIGATING])
        )
    ) or 0

    # 5. Tool usage distribution
    tool_dist_stmt = (
        select(AuditEvent.tool_name, func.count(AuditEvent.id))
        .group_by(AuditEvent.tool_name)
    )
    tool_dist_res = await db.execute(tool_dist_stmt)
    tool_distribution = [{"tool": r[0], "count": r[1]} for r in tool_dist_res.all()]

    # 6. Timeline of events (simulated 24 hour buckets based on real records)
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)
    timeline_stmt = (
        select(AuditEvent)
        .where(AuditEvent.created_at >= twenty_four_hours_ago)
        .order_by(AuditEvent.created_at.asc())
    )
    timeline_res = await db.execute(timeline_stmt)
    recent_events_records = list(timeline_res.scalars().all())

    # Bucket by 4-hour intervals
    hourly_buckets: Dict[str, Dict[str, int]] = {}
    for i in range(6):
        bucket_time = now - timedelta(hours=(5 - i) * 4)
        label = bucket_time.strftime("%H:00")
        hourly_buckets[label] = {"allowed": 0, "blocked": 0}

    for ev in recent_events_records:
        # Find closest bucket
        ev_hour = ev.created_at.strftime("%H:00")
        if ev_hour in hourly_buckets:
            if ev.decision == PolicyDecision.ALLOWED:
                hourly_buckets[ev_hour]["allowed"] += 1
            else:
                hourly_buckets[ev_hour]["blocked"] += 1

    timeline_data = [
        {"time": k, "allowed": v["allowed"], "blocked": v["blocked"]}
        for k, v in hourly_buckets.items()
    ]

    # 7. Recent 10 security events
    recent_stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(10)
    recent_res = await db.execute(recent_stmt)
    recent_events = [
        {
            "id": ev.id,
            "request_id": ev.request_id,
            "agent_id": ev.agent_id,
            "agent_name": ev.agent_name or ev.agent_id,
            "tool_name": ev.tool_name,
            "operation": ev.operation,
            "target_resource": ev.target_resource,
            "decision": ev.decision.value,
            "decision_reason": ev.decision_reason,
            "execution_status": ev.execution_status.value,
            "execution_duration_ms": ev.execution_duration_ms,
            "created_at": ev.created_at.isoformat()
        }
        for ev in recent_res.scalars().all()
    ]

    return {
        "metrics": {
            "total_agents": agent_total,
            "active_agents": agent_active,
            "registered_tools": tools_total,
            "allowed_operations": allowed_count,
            "blocked_operations": blocked_count,
            "security_incidents": open_incidents
        },
        "tool_distribution": tool_distribution,
        "timeline": timeline_data,
        "recent_events": recent_events
    }

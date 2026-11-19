from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.user import User
from app.services.behavior_analytics_service import behavior_analytics_service

router = APIRouter(prefix="/analytics", tags=["Agent Behavior Analytics"])


@router.get("/overview", summary="Platform Behavioral Analytics Overview")
async def get_analytics_overview(current_user: User = Depends(get_current_user)):
    """Returns aggregated behavioral metrics and anomaly counts across all enrolled agents."""
    return behavior_analytics_service.get_overview()


@router.get("/agents/{agent_id}", summary="Agent Behavioral Profile & Anomaly Baseline")
async def get_agent_behavior_profile(agent_id: str, current_user: User = Depends(get_current_user)):
    """
    Returns the real-time behavioral profile, tool usage trends, error rates,
    and Isolation Forest anomaly scores for a specific agent.
    """
    profile = behavior_analytics_service.get_agent_profile(agent_id)
    return profile

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.models.agent import AgentStatus
from app.models.user import User
from app.services.simulation_engine import simulation_engine
from app.services.test_agent_service import test_agent_service

router = APIRouter(prefix="/simulations", tags=["AI Agent Simulation Lab"])


class RunSimulationRequest(BaseModel):
    scenario_id: Optional[str] = Field(None, description="Specific scenario identifier (e.g. 'scenario_02_direct_injection') or None to run all")


class AgentActionRequest(BaseModel):
    action: str = Field(..., description="Action to perform: 'start', 'pause', 'stop', 'quarantine', 'reset'")
    reason: Optional[str] = Field(None, description="Optional justification for the status change")


class AgentExecuteRequest(BaseModel):
    task_prompt: str = Field(..., min_length=3, description="Task prompt instruction for the test agent")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


@router.get("/scenarios", tags=["AI Agent Simulation Lab"])
async def list_scenarios():
    """Lists all registered red-team simulation scenarios."""
    return {
        "scenarios": simulation_engine.get_scenarios(),
        "total": len(simulation_engine.get_scenarios())
    }


@router.post("/run", tags=["AI Agent Simulation Lab"])
async def run_simulation(
    req: RunSimulationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes an automated security simulation against the actual CrossX Zero-Trust Gateway.
    Runs all 12 scenarios or an individual targeted scenario.
    """
    if req.scenario_id:
        try:
            result = await simulation_engine.run_single_scenario(db=db, scenario_id=req.scenario_id)
            return {
                "type": "single_scenario",
                "result": result
            }
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    else:
        summary = await simulation_engine.run_all_simulations(db=db)
        return summary


@router.get("/results", tags=["AI Agent Simulation Lab"])
async def get_simulation_results(
    db: AsyncSession = Depends(get_db)
):
    """Retrieves the latest simulation run telemetry, metrics, and live execution timeline."""
    latest = simulation_engine.get_latest_summary()
    if not latest:
        # If no simulation has run yet, run all simulations to populate real data
        latest = await simulation_engine.run_all_simulations(db=db)
    return latest


@router.get("/agent/status", tags=["AI Agent Simulation Lab"])
async def get_test_agent_status(
    db: AsyncSession = Depends(get_db)
):
    """Retrieves live configuration, health, status, and permissions of CrossX Security Test Agent."""
    return await test_agent_service.get_agent_details(db)


@router.post("/agent/action", tags=["AI Agent Simulation Lab"])
async def perform_agent_action(
    req: AgentActionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Controls test agent state:
    'start' -> Active
    'pause' -> Restricted
    'stop' -> Suspended
    'quarantine' -> Quarantined (Emergency Kill Switch)
    'reset' -> Active & clear test lab state
    """
    action = req.action.lower().strip()
    reason = req.reason or f"Operator requested {action}"

    if action in ("start", "resume", "activate"):
        agent = await test_agent_service.update_agent_status(db, AgentStatus.ACTIVE, reason=reason)
    elif action in ("monitor", "monitoring"):
        agent = await test_agent_service.update_agent_status(db, AgentStatus.MONITORING, reason=reason)
    elif action in ("pause", "restrict"):
        agent = await test_agent_service.update_agent_status(db, AgentStatus.RESTRICTED, reason=reason)
    elif action in ("stop", "suspend"):
        agent = await test_agent_service.update_agent_status(db, AgentStatus.SUSPENDED, reason=reason)
    elif action in ("quarantine", "kill"):
        agent = await test_agent_service.update_agent_status(db, AgentStatus.QUARANTINED, reason=reason)
    elif action in ("revoke", "revoked"):
        agent = await test_agent_service.update_agent_status(db, AgentStatus.REVOKED, reason=reason)
    elif action in ("reset", "restart"):
        await test_agent_service.reset_test_lab(db)
        agent = await test_agent_service.ensure_test_agent_registered(db)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported action '{req.action}'. Allowed: start, monitor, pause, stop, quarantine, revoke, reset"
        )

    status_str = agent.status.value if hasattr(agent.status, "value") else str(agent.status)
    return {
        "status": "SUCCESS",
        "action": action,
        "agent_id": agent.id,
        "new_status": status_str,
        "timestamp": agent.last_activity_at.isoformat() if agent.last_activity_at else None
    }


@router.post("/agent/execute", tags=["AI Agent Simulation Lab"])
async def execute_custom_task(
    req: AgentExecuteRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Dispatches a custom autonomous task prompt to the test agent.
    Every step is intercepted and authorized by the CrossX Security Gateway.
    """
    res = await test_agent_service.execute_task(
        db=db,
        task_prompt=req.task_prompt,
        context=req.context
    )
    return res

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_current_agent, get_current_user_optional
from app.core.database import get_db
from app.models.agent import Agent, AgentStatus
from app.models.user import User
from app.schemas.agent import (
    AgentCreate,
    AgentRegistrationResponse,
    AgentResponse,
    AgentRevokeRequest,
    AgentQuarantineRequest,
    AgentSuspendRequest,
    AgentRestrictRequest,
    AgentUpdate,
)
from app.services.agent_service import agent_service

router = APIRouter()


@router.post("", response_model=AgentRegistrationResponse, status_code=status.HTTP_201_CREATED, tags=["Agents"])
@router.post("/register", response_model=AgentRegistrationResponse, status_code=status.HTTP_201_CREATED, tags=["Agents"])
async def register_agent(
    req: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registers a new AI agent and returns its cryptographic API key."""
    registration = await agent_service.register_agent(db, req)
    return registration


@router.post("/connect", tags=["Agents"])
async def connect_agent_gateway(
    agent: Agent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db)
):
    """
    Agent Connection Workflow Endpoint (Section 4 & Section 18).
    Authenticates connected agent and validates zero-trust gateway integration.
    """
    from datetime import datetime, timezone
    agent.last_activity_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "connected": True,
        "agent_id": agent.id,
        "agent_name": agent.name,
        "status": agent.status.value,
        "role": agent.role,
        "agent_type": agent.agent_type,
        "environment": agent.environment,
        "risk_classification": agent.risk_classification,
        "security_score": agent.security_score,
        "message": f"Agent '{agent.name}' successfully connected to CrossX Security Gateway."
    }


@router.post("/{agent_id}/connect", tags=["Agents"])
async def connect_specific_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validates connectivity for specific agent by ID."""
    try:
        result = await agent_service.validate_connection(db, agent_id)
        return result
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=List[AgentResponse], tags=["Agents"])
async def list_agents(
    status_filter: Optional[AgentStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all registered AI agents with optional status filtering."""
    query = select(Agent)
    if status_filter:
        query = query.where(Agent.status == status_filter)
    result = await db.execute(query.order_by(Agent.created_at.desc()))
    return result.scalars().all()


@router.get("/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def get_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves identity and configuration for a specific AI agent."""
    stmt = select(Agent).where(Agent.id == agent_id)
    result = await db.execute(stmt)
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def update_agent(
    agent_id: str,
    req: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates agent attributes (name, description, role, metadata, status)."""
    stmt = select(Agent).where(Agent.id == agent_id)
    result = await db.execute(stmt)
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    if req.name is not None:
        agent.name = req.name
    if req.description is not None:
        agent.description = req.description
    if req.role is not None:
        agent.role = req.role
    if req.status is not None:
        agent.status = req.status
    if req.agent_metadata is not None:
        agent.agent_metadata = req.agent_metadata

    await db.commit()
    await db.refresh(agent)
    return agent


@router.post("/{agent_id}/revoke", tags=["Agents"])
async def revoke_agent(
    agent_id: str,
    req: AgentRevokeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Immediately revokes an agent and invalidates all associated credentials."""
    success = await agent_service.revoke_agent(db, agent_id, reason=req.reason)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return {
        "agent_id": agent_id,
        "status": "revoked",
        "reason": req.reason,
        "message": "Agent and all associated credentials revoked successfully"
    }


@router.post("/{agent_id}/quarantine", tags=["Agents"])
async def quarantine_agent(
    agent_id: str,
    req: AgentQuarantineRequest = AgentQuarantineRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Isolates the agent immediately into quarantine status; halts all tool execution."""
    success = await agent_service.quarantine_agent(db, agent_id, reason=req.reason, quarantined_by=current_user.username)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return {
        "agent_id": agent_id,
        "status": "quarantined",
        "reason": req.reason,
        "message": "Agent quarantined successfully. Tool execution halted."
    }


@router.post("/{agent_id}/suspend", tags=["Agents"])
async def suspend_agent(
    agent_id: str,
    req: AgentSuspendRequest = AgentSuspendRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Suspends the agent; tool requests are temporarily paused."""
    success = await agent_service.suspend_agent(db, agent_id, reason=req.reason, suspended_by=current_user.username)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return {
        "agent_id": agent_id,
        "status": "suspended",
        "reason": req.reason,
        "message": "Agent suspended successfully."
    }


@router.post("/{agent_id}/restrict", tags=["Agents"])
async def restrict_agent(
    agent_id: str,
    req: AgentRestrictRequest = AgentRestrictRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restricts agent to read-only tools and prevents privileged actions."""
    success = await agent_service.restrict_agent(db, agent_id, reason=req.reason, restricted_by=current_user.username)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return {
        "agent_id": agent_id,
        "status": "restricted",
        "reason": req.reason,
        "message": "Agent restricted successfully. Read-only containment active."
    }


@router.post("/{agent_id}/activate", tags=["Agents"])
async def activate_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reactivates an agent from quarantine or suspension."""
    success = await agent_service.activate_agent(db, agent_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return {
        "agent_id": agent_id,
        "status": "active",
        "message": "Agent activated successfully."
    }


@router.post("/{agent_id}/rotate-credentials", tags=["Agents"])
async def rotate_agent_credentials(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revokes active credentials and provisions a new cryptographic API key."""
    try:
        raw_key, prefix = await agent_service.rotate_credentials(db, agent_id)
        return {
            "agent_id": agent_id,
            "raw_api_key": raw_key,
            "token_prefix": prefix,
            "warning": "New key generated. Previous keys are permanently invalidated."
        }
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{agent_id}/validate-connection", tags=["Agents"])
@router.post("/{agent_id}/validate-connection", tags=["Agents"])
async def validate_agent_connection(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Performs live connectivity check and credentials verification."""
    try:
        result = await agent_service.validate_connection(db, agent_id)
        return result
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

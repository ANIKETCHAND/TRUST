from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.agent import Agent, AgentStatus
from app.schemas.agent import (
    AgentCreate,
    AgentRegistrationResponse,
    AgentResponse,
    AgentRevokeRequest,
    AgentUpdate,
)
from app.services.agent_service import agent_service

router = APIRouter()


@router.post("", response_model=AgentRegistrationResponse, status_code=status.HTTP_201_CREATED, tags=["Agents"])
async def register_agent(req: AgentCreate, db: AsyncSession = Depends(get_db)):
    """Registers a new AI agent and returns its cryptographic API key."""
    registration = await agent_service.register_agent(db, req)
    return registration


@router.get("", response_model=List[AgentResponse], tags=["Agents"])
async def list_agents(
    status_filter: Optional[AgentStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db)
):
    """Lists all registered AI agents with optional status filtering."""
    query = select(Agent)
    if status_filter:
        query = query.where(Agent.status == status_filter)
    result = await db.execute(query.order_by(Agent.created_at.desc()))
    return result.scalars().all()


@router.get("/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves identity and configuration for a specific AI agent."""
    stmt = select(Agent).where(Agent.id == agent_id)
    result = await db.execute(stmt)
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def update_agent(agent_id: str, req: AgentUpdate, db: AsyncSession = Depends(get_db)):
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
async def revoke_agent(agent_id: str, req: AgentRevokeRequest, db: AsyncSession = Depends(get_db)):
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

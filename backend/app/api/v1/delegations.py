from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.agent import Agent
from app.models.delegation import Delegation, DelegationStatus
from app.services.delegation_service import delegation_service

router = APIRouter()


class DelegationCreateRequest(BaseModel):
    parent_agent_id: str
    child_agent_id: str
    scope: Dict[str, Any]
    expires_at: datetime
    max_depth: int = Field(1, ge=1, le=5)
    parent_delegation_id: Optional[str] = None


class DelegationRevokeRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)


@router.post("", status_code=status.HTTP_201_CREATED, tags=["Delegation"])
async def create_delegation(
    req: DelegationCreateRequest, db: AsyncSession = Depends(get_db)
):
    """Issues a scoped delegation grant from parent agent to child agent."""
    try:
        delegation, raw_token = await delegation_service.create_delegation(
            db=db,
            parent_agent_id=req.parent_agent_id,
            child_agent_id=req.child_agent_id,
            scope=req.scope,
            expires_at=req.expires_at,
            max_depth=req.max_depth,
            parent_delegation_id=req.parent_delegation_id
        )
        return {
            "delegation": {
                "id": delegation.id,
                "parent_agent_id": delegation.parent_agent_id,
                "child_agent_id": delegation.child_agent_id,
                "parent_delegation_id": delegation.parent_delegation_id,
                "scope": delegation.scope,
                "max_depth": delegation.max_depth,
                "current_depth": delegation.current_depth,
                "status": delegation.status.value,
                "expires_at": delegation.expires_at.isoformat(),
                "created_at": delegation.created_at.isoformat()
            },
            "delegation_token": raw_token,
            "warning": "Provide this delegation token in execution context to authorize downstream actions."
        }
    except (PermissionError, ValueError) as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.get("", tags=["Delegation"])
async def list_delegations(
    status_filter: Optional[DelegationStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db)
):
    """Lists all delegation grants with parent and child agent names."""
    stmt = select(Delegation)
    if status_filter:
        stmt = stmt.where(Delegation.status == status_filter)
    stmt = stmt.order_by(Delegation.created_at.desc())
    res = await db.execute(stmt)
    delegations = res.scalars().all()

    # Enrich with agent names
    agents_res = await db.execute(select(Agent))
    agents_map = {a.id: a.name for a in agents_res.scalars().all()}

    output = []
    for d in delegations:
        output.append({
            "id": d.id,
            "parent_agent_id": d.parent_agent_id,
            "parent_agent_name": agents_map.get(d.parent_agent_id, "Unknown"),
            "child_agent_id": d.child_agent_id,
            "child_agent_name": agents_map.get(d.child_agent_id, "Unknown"),
            "scope": d.scope,
            "max_depth": d.max_depth,
            "current_depth": d.current_depth,
            "status": d.status.value,
            "expires_at": d.expires_at.isoformat(),
            "created_at": d.created_at.isoformat(),
            "revoked_at": d.revoked_at.isoformat() if d.revoked_at else None,
            "revocation_reason": d.revocation_reason
        })
    return output


@router.post("/{delegation_id}/revoke", tags=["Delegation"])
async def revoke_delegation(
    delegation_id: str, req: DelegationRevokeRequest, db: AsyncSession = Depends(get_db)
):
    """Immediately invalidates a delegation grant and prevents further execution."""
    success = await delegation_service.revoke_delegation(
        db=db, delegation_id=delegation_id, reason=req.reason
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delegation grant not found")
    return {"message": "Delegation grant revoked successfully", "delegation_id": delegation_id}

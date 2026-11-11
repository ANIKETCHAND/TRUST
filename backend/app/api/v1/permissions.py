import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.permission import Permission
from app.models.user import User
from app.schemas.permission import PermissionCreate, PermissionResponse

router = APIRouter()


@router.post("", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED, tags=["Permissions"])
async def create_permission(
    req: PermissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new permission grant or explicit deny rule."""
    perm = Permission(
        id=str(uuid.uuid4()),
        agent_id=req.agent_id,
        tool_name=req.tool_name,
        operation=req.operation,
        resource_pattern=req.resource_pattern,
        effect=req.effect,
        priority=req.priority,
        conditions=req.conditions,
        description=req.description,
        expires_at=req.expires_at,
        is_active=True
    )
    db.add(perm)
    await db.commit()
    await db.refresh(perm)
    return perm


@router.get("", response_model=List[PermissionResponse], tags=["Permissions"])
async def list_permissions(
    agent_id: Optional[str] = Query(None),
    tool_name: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists permissions with optional filtering by agent, tool, or active state."""
    query = select(Permission)
    if agent_id:
        query = query.where(Permission.agent_id == agent_id)
    if tool_name:
        query = query.where(Permission.tool_name == tool_name)
    if is_active is not None:
        query = query.where(Permission.is_active == is_active)
    result = await db.execute(query.order_by(Permission.priority.desc(), Permission.created_at.desc()))
    return result.scalars().all()


@router.delete("/{permission_id}", tags=["Permissions"])
async def deactivate_permission(
    permission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deactivates a permission grant."""
    stmt = select(Permission).where(Permission.id == permission_id)
    result = await db.execute(stmt)
    perm = result.scalars().first()
    if not perm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    perm.is_active = False
    await db.commit()
    return {"message": "Permission deactivated successfully", "permission_id": permission_id}

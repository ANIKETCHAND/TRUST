from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tool import Tool
from app.models.user import User
from app.schemas.tool import ToolCreate, ToolResponse
from app.services.tool_registry import tool_registry

router = APIRouter()


@router.get("", response_model=List[ToolResponse], tags=["Tools"])
async def list_tools(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all registered tools."""
    await tool_registry.sync_tools_to_db(db)
    result = await db.execute(select(Tool).order_by(Tool.name))
    return result.scalars().all()


@router.get("/{tool_id}", response_model=ToolResponse, tags=["Tools"])
async def get_tool(
    tool_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves tool definition and operations."""
    stmt = select(Tool).where(Tool.id == tool_id)
    result = await db.execute(stmt)
    tool = result.scalars().first()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    return tool

import enum
from typing import Optional, List
from sqlalchemy import Enum, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimeStampedModel


class ToolStatus(str, enum.Enum):
    ACTIVE = "active"
    DISABLED = "disabled"
    MAINTENANCE = "maintenance"


class ToolCategory(str, enum.Enum):
    FILESYSTEM = "filesystem"
    DATABASE = "database"
    HTTP_API = "http_api"
    MCP = "mcp"
    SYSTEM = "system"


class Tool(TimeStampedModel):
    __tablename__ = "tools"

    name: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[ToolCategory] = mapped_column(
        Enum(ToolCategory), default=ToolCategory.SYSTEM, nullable=False
    )
    status: Mapped[ToolStatus] = mapped_column(
        Enum(ToolStatus), default=ToolStatus.ACTIVE, nullable=False
    )
    supported_operations: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    configuration: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_protected: Mapped[bool] = mapped_column(default=True, nullable=False)

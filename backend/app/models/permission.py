import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimeStampedModel


class PermissionEffect(str, enum.Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"


class Permission(TimeStampedModel):
    __tablename__ = "permissions"

    # Agent ID (or NULL for wildcard / role-based policy)
    agent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Target tool name or '*'
    tool_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    # Specific operation (e.g., 'read_file', 'query_select') or '*'
    operation: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    # Resource pattern (glob, regex, or exact match, e.g. '/data/*', 'table:users', '*')
    resource_pattern: Mapped[str] = mapped_column(String(255), default="*", nullable=False)
    # ALLOW or DENY (Explicit Deny always takes precedence over Allow)
    effect: Mapped[PermissionEffect] = mapped_column(
        Enum(PermissionEffect), default=PermissionEffect.ALLOW, nullable=False
    )
    # Priority for resolution (higher evaluates first; DENY takes precedence at equal level)
    priority: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    # JSON conditions: e.g. {"max_file_size_bytes": 1048576, "required_tags": ["public"]}
    conditions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    agent: Mapped[Optional["Agent"]] = relationship("Agent", back_populates="permissions")

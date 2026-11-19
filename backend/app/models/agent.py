import enum
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimeStampedModel


class AgentStatus(str, enum.Enum):
    ACTIVE = "active"
    MONITORING = "monitoring"
    RESTRICTED = "restricted"
    QUARANTINED = "quarantined"
    SUSPENDED = "suspended"
    REVOKED = "revoked"
    OFFLINE = "offline"
    INACTIVE = "inactive"


class Agent(TimeStampedModel):
    __tablename__ = "agents"

    # Agent ID can be a customized string identifier (e.g. 'agent-researcher-01')
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(64), default="general_agent", index=True, nullable=False)
    status: Mapped[AgentStatus] = mapped_column(
        Enum(AgentStatus), default=AgentStatus.ACTIVE, index=True, nullable=False
    )
    agent_type: Mapped[str] = mapped_column(String(64), default="custom_python", index=True, nullable=False)
    owner: Mapped[Optional[str]] = mapped_column(String(128), default="security_admin", nullable=True)
    environment: Mapped[str] = mapped_column(String(64), default="production", index=True, nullable=False)
    risk_classification: Mapped[str] = mapped_column(String(32), default="LOW", index=True, nullable=False)
    security_score: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    agent_version: Mapped[str] = mapped_column(String(32), default="1.0.0", nullable=False)
    last_activity_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    agent_metadata: Mapped[Optional[dict]] = mapped_column(JSON, default=dict, nullable=True)

    # Relationships
    credentials: Mapped[List["AgentCredential"]] = relationship(
        "AgentCredential", back_populates="agent", cascade="all, delete-orphan"
    )
    permissions: Mapped[List["Permission"]] = relationship(
        "Permission", back_populates="agent", cascade="all, delete-orphan"
    )


class AgentCredential(TimeStampedModel):
    __tablename__ = "agent_credentials"

    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    token_prefix: Mapped[str] = mapped_column(String(32), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="credentials")

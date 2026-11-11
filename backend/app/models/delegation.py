import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimeStampedModel


class DelegationStatus(str, enum.Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class Delegation(TimeStampedModel):
    __tablename__ = "delegations"

    parent_agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    child_agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_delegation_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("delegations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Subscoped permissions granted to the child
    scope: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Maximum delegation depth permitted downstream
    max_depth: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    current_depth: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    status: Mapped[DelegationStatus] = mapped_column(
        Enum(DelegationStatus), default=DelegationStatus.ACTIVE, index=True, nullable=False
    )
    token_hash: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revocation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

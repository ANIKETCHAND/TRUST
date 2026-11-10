import enum
from typing import Optional
from sqlalchemy import Enum, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimeStampedModel


class PolicyDecision(str, enum.Enum):
    ALLOWED = "ALLOWED"
    BLOCKED = "BLOCKED"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"


class ExecutionStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"
    PENDING = "PENDING"


class AuditEvent(TimeStampedModel):
    __tablename__ = "audit_events"

    # Event ID is standard id (UUID)
    request_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    agent_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    agent_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    tool_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    operation: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    target_resource: Mapped[str] = mapped_column(String(512), index=True, nullable=False)
    
    # Security Decision & Reason
    decision: Mapped[PolicyDecision] = mapped_column(
        Enum(PolicyDecision), index=True, nullable=False
    )
    decision_reason: Mapped[str] = mapped_column(Text, nullable=False)
    policy_id_triggered: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    # Delegation and Provenance References
    delegation_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    provenance_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    
    # Execution Outcome
    execution_status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus), default=ExecutionStatus.BLOCKED, index=True, nullable=False
    )
    execution_duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Context Metadata (sanitized: NO tokens, passwords, or raw secrets)
    context_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Cryptographic Audit Hash Chain (HMAC-SHA256)
    previous_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    hmac_signature: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

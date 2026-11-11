import enum
from typing import Optional
from sqlalchemy import Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimeStampedModel


class IncidentSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    CONTAINED = "CONTAINED"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


class SecurityIncident(TimeStampedModel):
    __tablename__ = "security_incidents"

    audit_event_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("audit_events.id", ondelete="SET NULL"), nullable=True, index=True
    )
    agent_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    severity: Mapped[IncidentSeverity] = mapped_column(
        Enum(IncidentSeverity), default=IncidentSeverity.MEDIUM, index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus), default=IncidentStatus.OPEN, index=True, nullable=False
    )
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    incident_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class RevocationRecord(TimeStampedModel):
    __tablename__ = "revocation_records"

    target_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)  # AGENT, CREDENTIAL, DELEGATION, PERMISSION
    target_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    revoked_by: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

import enum
from typing import Optional, List
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimeStampedModel


class PolicyEffectDefault(str, enum.Enum):
    DENY = "DENY"
    ALLOW = "ALLOW"


class Policy(TimeStampedModel):
    __tablename__ = "policies"

    name: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    default_effect: Mapped[PolicyEffectDefault] = mapped_column(
        Enum(PolicyEffectDefault), default=PolicyEffectDefault.DENY, nullable=False
    )
    # Rules definition structure (JSON logic or Rego policy specification)
    rules: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    versions: Mapped[List["PolicyVersion"]] = relationship(
        "PolicyVersion", back_populates="policy", cascade="all, delete-orphan"
    )


class PolicyVersion(TimeStampedModel):
    __tablename__ = "policy_versions"

    policy_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    rules: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    changed_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    change_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    policy: Mapped["Policy"] = relationship("Policy", back_populates="versions")

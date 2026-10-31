import enum
from typing import Optional
from sqlalchemy import Enum, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimeStampedModel


class NodeType(str, enum.Enum):
    USER_INPUT = "USER_INPUT"
    DOCUMENT = "DOCUMENT"
    EMAIL = "EMAIL"
    API_RESPONSE = "API_RESPONSE"
    AGENT_OUTPUT = "AGENT_OUTPUT"
    TOOL_EVENT = "TOOL_EVENT"


class TrustLevel(str, enum.Enum):
    TRUSTED = "TRUSTED"
    UNTRUSTED = "UNTRUSTED"
    SANITIZED = "SANITIZED"


class EdgeType(str, enum.Enum):
    DERIVED_FROM = "DERIVED_FROM"
    INFLUENCED_BY = "INFLUENCED_BY"
    HANDOFF_TO = "HANDOFF_TO"


class ProvenanceNode(TimeStampedModel):
    __tablename__ = "provenance_nodes"

    node_type: Mapped[NodeType] = mapped_column(Enum(NodeType), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    trust_level: Mapped[TrustLevel] = mapped_column(
        Enum(TrustLevel), default=TrustLevel.UNTRUSTED, nullable=False, index=True
    )
    metadata_info: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class ProvenanceEdge(TimeStampedModel):
    __tablename__ = "provenance_edges"

    source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("provenance_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("provenance_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    edge_type: Mapped[EdgeType] = mapped_column(
        Enum(EdgeType), default=EdgeType.DERIVED_FROM, nullable=False
    )

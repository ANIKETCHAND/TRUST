import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.provenance import EdgeType, NodeType, ProvenanceEdge, ProvenanceNode, TrustLevel

router = APIRouter()


class NodeCreateRequest(BaseModel):
    node_type: NodeType
    name: str = Field(..., min_length=2, max_length=255)
    source_reference: Optional[str] = None
    trust_level: TrustLevel = TrustLevel.UNTRUSTED
    metadata_info: Dict[str, Any] = Field(default_factory=dict)


class EdgeCreateRequest(BaseModel):
    source_id: str
    target_id: str
    edge_type: EdgeType = EdgeType.DERIVED_FROM


@router.post("/nodes", status_code=status.HTTP_201_CREATED, tags=["Provenance"])
async def create_provenance_node(req: NodeCreateRequest, db: AsyncSession = Depends(get_db)):
    """Registers an origin source, document, or transform node in the provenance graph."""
    node = ProvenanceNode(
        id=str(uuid.uuid4()),
        node_type=req.node_type,
        name=req.name,
        source_reference=req.source_reference,
        trust_level=req.trust_level,
        metadata_info=req.metadata_info
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.post("/edges", status_code=status.HTTP_201_CREATED, tags=["Provenance"])
async def create_provenance_edge(req: EdgeCreateRequest, db: AsyncSession = Depends(get_db)):
    """Links two provenance nodes to track influence, derivation, or agent handoff."""
    edge = ProvenanceEdge(
        id=str(uuid.uuid4()),
        source_id=req.source_id,
        target_id=req.target_id,
        edge_type=req.edge_type
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


@router.get("/graph", tags=["Provenance"])
async def get_provenance_graph(db: AsyncSession = Depends(get_db)):
    """
    Returns full provenance graph with nodes, edges, and classification metadata.
    Automatically seeds demonstration nodes if empty.
    """
    nodes_res = await db.execute(select(ProvenanceNode))
    nodes = list(nodes_res.scalars().all())

    # If empty, seed initial demonstration nodes
    if not nodes:
        sample_nodes = [
            ProvenanceNode(
                id="node-user-prompt-01",
                node_type=NodeType.USER_INPUT,
                name="User Quarterly Audit Task Request",
                source_reference="Chat Session #4092",
                trust_level=TrustLevel.TRUSTED,
                metadata_info={"actor": "Chief Security Officer", "channel": "Slack/Web"}
            ),
            ProvenanceNode(
                id="node-untrusted-doc-02",
                node_type=NodeType.DOCUMENT,
                name="External Vendor Spec Sheet (v1.4.pdf)",
                source_reference="Uploaded via S3 bucket: vendor-incoming",
                trust_level=TrustLevel.UNTRUSTED,
                metadata_info={"threat_scan": "Clean", "signatures_checked": True}
            ),
            ProvenanceNode(
                id="node-agent-transform-03",
                node_type=NodeType.AGENT_OUTPUT,
                name="SecOps Parser Agent Analysis",
                source_reference="Agent: SecOps-Research-Agent",
                trust_level=TrustLevel.SANITIZED,
                metadata_info={"sanitization": "HTML stripped, text normalized"}
            ),
            ProvenanceNode(
                id="node-tool-action-04",
                node_type=NodeType.TOOL_EVENT,
                name="Database Customer Query Action",
                source_reference="Tool: postgres_tool",
                trust_level=TrustLevel.TRUSTED,
                metadata_info={"operation": "query_select", "resource": "customer_records"}
            ),
        ]
        db.add_all(sample_nodes)
        await db.flush()

        sample_edges = [
            ProvenanceEdge(
                id="edge-01",
                source_id="node-user-prompt-01",
                target_id="node-agent-transform-03",
                edge_type=EdgeType.DERIVED_FROM
            ),
            ProvenanceEdge(
                id="edge-02",
                source_id="node-untrusted-doc-02",
                target_id="node-agent-transform-03",
                edge_type=EdgeType.INFLUENCED_BY
            ),
            ProvenanceEdge(
                id="edge-03",
                source_id="node-agent-transform-03",
                target_id="node-tool-action-04",
                edge_type=EdgeType.HANDOFF_TO
            ),
        ]
        db.add_all(sample_edges)
        await db.commit()

        nodes_res = await db.execute(select(ProvenanceNode))
        nodes = list(nodes_res.scalars().all())

    edges_res = await db.execute(select(ProvenanceEdge))
    edges = list(edges_res.scalars().all())

    return {
        "nodes": [
            {
                "id": n.id,
                "type": n.node_type.value,
                "name": n.name,
                "source": n.source_reference,
                "trust_level": n.trust_level.value,
                "metadata": n.metadata_info,
                "created_at": n.created_at.isoformat()
            }
            for n in nodes
        ],
        "edges": [
            {
                "id": e.id,
                "source": e.source_id,
                "target": e.target_id,
                "type": e.edge_type.value
            }
            for e in edges
        ]
    }

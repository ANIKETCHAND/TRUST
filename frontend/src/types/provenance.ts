export type NodeType = 'USER_INPUT' | 'DOCUMENT' | 'EMAIL' | 'API_RESPONSE' | 'AGENT_OUTPUT' | 'TOOL_EVENT';
export type TrustLevel = 'TRUSTED' | 'UNTRUSTED' | 'SANITIZED';
export type EdgeType = 'DERIVED_FROM' | 'INFLUENCED_BY' | 'HANDOFF_TO';

export interface ProvenanceNode {
  id: string;
  type: NodeType;
  name: string;
  source?: string;
  trust_level: TrustLevel;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ProvenanceEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
}

export interface ProvenanceGraph {
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
}

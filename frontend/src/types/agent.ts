export type AgentStatus =
  | 'active'
  | 'monitoring'
  | 'restricted'
  | 'quarantined'
  | 'suspended'
  | 'revoked'
  | 'offline'
  | 'inactive';

export interface Agent {
  id: string;
  name: string;
  description?: string;
  role: string;
  status: AgentStatus;
  agent_type?: string;
  owner?: string;
  environment?: string;
  risk_classification?: string;
  security_score?: number;
  agent_version?: string;
  last_activity_at?: string;
  agent_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AgentCreatePayload {
  name: string;
  description?: string;
  role: string;
  agent_type?: string;
  owner?: string;
  environment?: string;
  risk_classification?: string;
  agent_version?: string;
  agent_metadata?: Record<string, any>;
}

export interface AgentRegistrationResult {
  agent: Agent;
  raw_api_key: string;
  token_prefix: string;
  warning?: string;
}

export interface AgentUpdatePayload {
  name?: string;
  description?: string;
  role?: string;
  status?: AgentStatus;
  agent_type?: string;
  owner?: string;
  environment?: string;
  risk_classification?: string;
  security_score?: number;
  agent_version?: string;
  agent_metadata?: Record<string, any>;
}

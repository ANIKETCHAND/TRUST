export type AgentStatus = 'active' | 'inactive' | 'revoked' | 'suspended';

export interface Agent {
  id: string;
  name: string;
  description?: string;
  role: string;
  status: AgentStatus;
  agent_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AgentCreatePayload {
  name: string;
  description?: string;
  role: string;
  agent_metadata?: Record<string, any>;
}

export interface AgentRegistrationResult {
  agent: Agent;
  raw_api_key: string;
  token_prefix: string;
  warning: string;
}

export interface AgentUpdatePayload {
  name?: string;
  description?: string;
  role?: string;
  status?: AgentStatus;
  agent_metadata?: Record<string, any>;
}

export type DelegationStatus = 'active' | 'revoked' | 'expired';

export interface Delegation {
  id: string;
  parent_agent_id: string;
  parent_agent_name?: string;
  child_agent_id: string;
  child_agent_name?: string;
  scope: Record<string, any>;
  max_depth: number;
  current_depth: number;
  status: DelegationStatus;
  expires_at: string;
  created_at: string;
  revoked_at?: string;
  revocation_reason?: string;
}

export interface DelegationCreatePayload {
  parent_agent_id: string;
  child_agent_id: string;
  scope: Record<string, any>;
  expires_at: string;
  max_depth?: number;
}

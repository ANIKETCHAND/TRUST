export type PolicyDecision = 'ALLOWED' | 'BLOCKED' | 'APPROVAL_REQUIRED';
export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'PENDING';

export interface AuditEvent {
  id: string;
  request_id: string;
  agent_id: string;
  agent_name?: string;
  tool_name: string;
  operation: string;
  target_resource: string;
  decision: PolicyDecision;
  decision_reason: string;
  policy_id_triggered?: string;
  delegation_id?: string;
  provenance_id?: string;
  execution_status: ExecutionStatus;
  execution_duration_ms?: number;
  context_metadata: Record<string, any>;
  error_message?: string;
  created_at: string;
}

export interface AuditFilterParams {
  agent_id?: string;
  tool_name?: string;
  decision?: PolicyDecision;
  limit?: number;
}

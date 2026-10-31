export type PolicyEffectDefault = 'DENY' | 'ALLOW';

export interface Policy {
  id: string;
  name: string;
  description?: string;
  version: number;
  is_active: boolean;
  default_effect: PolicyEffectDefault;
  rules: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PolicyTestPayload {
  agent_id: string;
  tool_name: string;
  operation: string;
  resource: string;
  context?: Record<string, any>;
}

export interface PolicyTestResult {
  agent: { id: string; name: string; role: string; status: string };
  target: { tool: string; operation: string; resource: string };
  decision: string;
  reason: string;
  matched_rule_id?: string;
  is_allowed: boolean;
}

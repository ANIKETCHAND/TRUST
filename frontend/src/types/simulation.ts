export interface SimulationScenario {
  id: string;
  name: string;
  category: string;
  description: string;
  expected_decision: string;
  expected_status: string;
  attack_type: string;
}

export interface ScenarioResult {
  scenario_id: string;
  scenario_name: string;
  attack_category: string;
  agent_request: string;
  tool_attempted: string;
  gateway_decision: 'ALLOWED' | 'BLOCKED';
  detection_result: string;
  expected_outcome: string;
  actual_outcome: string;
  execution_time_ms: number;
  pass_status: boolean;
  evidence: Record<string, any>;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  scenario_id: string;
  action: string;
  tool: string;
  decision: string;
  risk_score: number;
  threat_classification: string;
  details: string;
}

export interface SimulationSummary {
  run_id: string;
  timestamp: string;
  total_scenarios: number;
  passed_tests: number;
  failed_tests: number;
  blocked_attacks: number;
  detection_rate_pct: number;
  false_positives: number;
  agent_status: string;
  agent_id: string;
  agent_name: string;
  total_duration_ms: number;
  results: ScenarioResult[];
  timeline_events: TimelineEvent[];
}

export interface TestAgentDetails {
  agent_id: string;
  agent_name: string;
  description: string;
  role: string;
  agent_type: string;
  status: string;
  health_status: string;
  environment: string;
  risk_classification: string;
  security_score: number;
  agent_version: string;
  created_at: string | null;
  last_activity_at: string | null;
  execution_mode: string;
  model_provider: string;
  model_name: string;
  allowed_tools: string[];
  permissions_count: number;
  execution_history_count: number;
  recent_executions: any[];
}

export interface AgentExecutionStep {
  step: number;
  thought?: string;
  action: string;
  tool: string;
  operation: string;
  resource: string;
  parameters_sample: Record<string, any>;
  decision: 'ALLOWED' | 'BLOCKED';
  execution_status: string;
  reason?: string;
  event_id?: string;
  error?: string;
  result_preview?: any;
  observation?: string;
  reasoning?: string;
  blocked: boolean;
}

export interface AgentExecutionTrace {
  run_id: string;
  status: string;
  agent_id: string;
  agent_name: string;
  agent_status: string;
  task_prompt: string;
  execution_mode: string;
  model_provider: string;
  duration_ms: number;
  steps_count: number;
  halt_reason?: string | null;
  final_response?: string;
  steps: AgentExecutionStep[];
  timestamp: string;
}

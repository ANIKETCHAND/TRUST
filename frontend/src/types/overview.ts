import type { AuditEvent } from './audit';

export interface OverviewMetrics {
  total_agents: number;
  active_agents: number;
  quarantined_agents?: number;
  suspended_agents?: number;
  restricted_agents?: number;
  monitoring_agents?: number;
  registered_tools: number;
  allowed_operations: number;
  blocked_operations: number;
  total_monitored_calls?: number;
  security_incidents: number;
  critical_incidents?: number;
  threat_detection_rate?: number;
  gateway_status?: string;
  ml_model_status?: string;
  threat_intel_status?: string;
}

export interface TimelineDataPoint {
  time: string;
  allowed: number;
  blocked: number;
}

export interface ToolDistributionItem {
  tool: string;
  count: number;
}

export interface AgentRiskDistributionItem {
  classification: string;
  count: number;
}

export interface IncidentSeverityDistributionItem {
  severity: string;
  count: number;
}

export interface ThreatCategoryDistributionItem {
  category: string;
  count: number;
}

export interface TopTargetedAgentItem {
  agent_name: string;
  blocked_count: number;
}

export interface RecentIncidentSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  agent_id?: string;
  created_at?: string;
}

export interface OverviewStatsResponse {
  metrics: OverviewMetrics;
  tool_distribution: ToolDistributionItem[];
  timeline: TimelineDataPoint[];
  agent_risk_distribution?: AgentRiskDistributionItem[];
  incident_severity_distribution?: IncidentSeverityDistributionItem[];
  threat_category_distribution?: ThreatCategoryDistributionItem[];
  top_targeted_agents?: TopTargetedAgentItem[];
  recent_events: AuditEvent[];
  recent_incidents?: RecentIncidentSummary[];
}

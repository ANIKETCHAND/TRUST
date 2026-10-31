import type { AuditEvent } from './audit';

export interface OverviewMetrics {
  total_agents: number;
  active_agents: number;
  registered_tools: number;
  allowed_operations: number;
  blocked_operations: number;
  security_incidents: number;
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

export interface OverviewStatsResponse {
  metrics: OverviewMetrics;
  tool_distribution: ToolDistributionItem[];
  timeline: TimelineDataPoint[];
  recent_events: AuditEvent[];
}

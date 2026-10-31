export type ToolCategory = 'filesystem' | 'database' | 'http_api' | 'mcp' | 'system';
export type ToolStatus = 'active' | 'disabled' | 'maintenance';

export interface Tool {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category: ToolCategory;
  status: ToolStatus;
  supported_operations: string[];
  is_protected: boolean;
  created_at: string;
}

export interface GatewayExecutionPayload {
  tool: string;
  operation: string;
  resource: string;
  parameters?: Record<string, any>;
  context?: Record<string, any>;
}

export interface GatewayExecutionResponse {
  request_id: string;
  event_id: string;
  decision: 'ALLOWED' | 'BLOCKED' | 'APPROVAL_REQUIRED';
  execution_status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'PENDING';
  result?: any;
  error?: string;
  reason: string;
  execution_duration_ms?: number;
}

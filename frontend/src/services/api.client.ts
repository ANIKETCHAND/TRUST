import { ENV } from '../config/env';

export class ApiError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${ENV.API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let details: any = undefined;

    try {
      const errJson = await response.json();
      if (errJson.error && typeof errJson.error === 'object') {
        message = errJson.error.message || message;
        details = errJson.error.details;
      } else {
        message = errJson.detail || errJson.reason || errJson.error || message;
      }
    } catch {
      // Use fallback message
    }

    throw new ApiError(message, response.status, details);
  }

  return response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'GET', headers }),

  post: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    }),

  patch: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    }),

  put: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    }),

  delete: <T>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'DELETE', headers }),
};

// Complete API interface
export const api = {
  getHealth: () => apiClient.get<any>('/health'),
  getOverviewStats: () => apiClient.get<any>('/overview/stats'),
  listAgents: (status?: string) => apiClient.get<any[]>(`/agents${status ? `?status=${status}` : ''}`),
  getAgent: (id: string) => apiClient.get<any>(`/agents/${id}`),
  registerAgent: (data: any) => apiClient.post<any>('/agents', data),
  updateAgent: (id: string, data: any) => apiClient.patch<any>(`/agents/${id}`, data),
  revokeAgent: (id: string, reason: string) => apiClient.post<any>(`/agents/${id}/revoke`, { reason }),
  listTools: () => apiClient.get<any[]>('/tools'),
  listPermissions: (agentId?: string) => apiClient.get<any[]>(`/permissions${agentId ? `?agent_id=${agentId}` : ''}`),
  createPermission: (data: any) => apiClient.post<any>('/permissions', data),
  deactivatePermission: (id: string) => apiClient.delete<any>(`/permissions/${id}`),
  executeTool: (data: any, apiKey?: string) => {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    return apiClient.post<any>('/gateway/execute', data, headers);
  },
  listDelegations: (status?: string) => apiClient.get<any[]>(`/delegations${status ? `?status=${status}` : ''}`),
  createDelegation: (data: any) => apiClient.post<any>('/delegations', data),
  revokeDelegation: (id: string, reason: string) => apiClient.post<any>(`/delegations/${id}/revoke`, { reason }),
  getProvenanceGraph: () => apiClient.get<any>('/provenance/graph'),
  createProvenanceNode: (data: any) => apiClient.post<any>('/provenance/nodes', data),
  listPolicies: () => apiClient.get<any[]>('/policies'),
  updatePolicy: (id: string, data: any) => apiClient.put<any>(`/policies/${id}`, data),
  testPolicy: (data: any) => apiClient.post<any>('/policies/test', data),
  listAuditEvents: (params?: any) => {
    const q = new URLSearchParams();
    if (params?.agent_id) q.set('agent_id', params.agent_id);
    if (params?.tool_name) q.set('tool_name', params.tool_name);
    if (params?.decision) q.set('decision', params.decision);
    if (params?.limit) q.set('limit', String(params.limit));
    return apiClient.get<any[]>(`/audit?${q.toString()}`);
  },
  exportAuditUrl: (format: 'json' | 'csv') => `${ENV.API_BASE_URL}/audit/export?format=${format}`,
  listIncidents: (params?: any) => {
    const q = new URLSearchParams();
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    return apiClient.get<any[]>(`/audit/incidents?${q.toString()}`);
  },
  updateIncident: (id: string, data: any) => apiClient.patch<any>(`/audit/incidents/${id}`, data),
  runAgentWorkflow: (data: any) => apiClient.post<any>('/agent-exec/run', data),

  // Endpoint Connector (Layer 3)
  listEndpoints: (status?: string) => apiClient.get<any[]>(`/endpoints${status ? `?status=${status}` : ''}`),
  getEndpoint: (id: string) => apiClient.get<any>(`/endpoints/${id}`),
  enrollEndpoint: (data: any) => apiClient.post<any>('/endpoints/enroll', data),
  containEndpoint: (id: string, data: any) => apiClient.post<any>(`/endpoints/${id}/contain`, data),
  releaseEndpoint: (id: string, data: any) => apiClient.post<any>(`/endpoints/${id}/release`, data),

  // Browser Shield (Layer 2)
  getBrowserShieldStatus: () => apiClient.get<any>('/browser-shield/status'),
  checkBrowserAction: (data: any) => apiClient.post<any>('/browser-shield/check-action', data),
  reportShieldEvent: (data: any) => apiClient.post<any>('/browser-shield/events', data),

  // Open-Source Integrations
  listIntegrations: () => apiClient.get<any>('/integrations'),
  scanFile: (data: any) => apiClient.post<any>('/integrations/scan-file', data),
  listQuarantine: () => apiClient.get<any[]>('/integrations/quarantine'),
  restoreQuarantine: (data: any) => apiClient.post<any>('/integrations/quarantine/restore', data),
  queryThreatIntel: (data: any) => apiClient.post<any>('/integrations/threat-intel', data),
};

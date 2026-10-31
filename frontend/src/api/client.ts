const BASE_URL = '/api/v1';

async function fetchJSON<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.reason || errJson.error || errorDetail;
    } catch {
      // Use fallback errorDetail
    }
    throw new Error(errorDetail);
  }
  return response.json();
}

export const api = {
  // Overview
  getOverviewStats: () => fetchJSON<any>('/overview/stats'),

  // Agents
  listAgents: (status?: string) => fetchJSON<any[]>(`/agents${status ? `?status=${status}` : ''}`),
  getAgent: (id: string) => fetchJSON<any>(`/agents/${id}`),
  registerAgent: (data: { name: string; description?: string; role: string; agent_metadata?: any }) =>
    fetchJSON<any>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: any) =>
    fetchJSON<any>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  revokeAgent: (id: string, reason: string) =>
    fetchJSON<any>(`/agents/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Tools
  listTools: () => fetchJSON<any[]>('/tools'),
  getTool: (id: string) => fetchJSON<any>(`/tools/${id}`),

  // Permissions
  listPermissions: (agentId?: string) =>
    fetchJSON<any[]>(`/permissions${agentId ? `?agent_id=${agentId}` : ''}`),
  createPermission: (data: any) =>
    fetchJSON<any>('/permissions', { method: 'POST', body: JSON.stringify(data) }),
  deactivatePermission: (id: string) =>
    fetchJSON<any>(`/permissions/${id}`, { method: 'DELETE' }),

  // Gateway Tool Execution
  executeTool: (data: { tool: string; operation: string; resource: string; parameters?: any; context?: any }, apiKey?: string) => {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return fetchJSON<any>('/gateway/execute', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  },

  // Delegations
  listDelegations: (status?: string) =>
    fetchJSON<any[]>(`/delegations${status ? `?status=${status}` : ''}`),
  createDelegation: (data: any) =>
    fetchJSON<any>('/delegations', { method: 'POST', body: JSON.stringify(data) }),
  revokeDelegation: (id: string, reason: string) =>
    fetchJSON<any>(`/delegations/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Provenance
  getProvenanceGraph: () => fetchJSON<any>('/provenance/graph'),
  createProvenanceNode: (data: any) =>
    fetchJSON<any>('/provenance/nodes', { method: 'POST', body: JSON.stringify(data) }),

  // Policies
  listPolicies: () => fetchJSON<any[]>('/policies'),
  createPolicy: (data: any) =>
    fetchJSON<any>('/policies', { method: 'POST', body: JSON.stringify(data) }),
  updatePolicy: (id: string, data: any) =>
    fetchJSON<any>(`/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  testPolicy: (data: any) =>
    fetchJSON<any>('/policies/test', { method: 'POST', body: JSON.stringify(data) }),

  // Audit
  listAuditEvents: (params?: { agent_id?: string; tool_name?: string; decision?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.agent_id) q.set('agent_id', params.agent_id);
    if (params?.tool_name) q.set('tool_name', params.tool_name);
    if (params?.decision) q.set('decision', params.decision);
    if (params?.limit) q.set('limit', String(params.limit));
    return fetchJSON<any[]>(`/audit?${q.toString()}`);
  },
  exportAuditUrl: (format: 'json' | 'csv') => `${BASE_URL}/audit/export?format=${format}`,

  // Incidents
  listIncidents: (params?: { severity?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    return fetchJSON<any[]>(`/audit/incidents?${q.toString()}`);
  },
  updateIncident: (id: string, data: { status?: string; resolution_notes?: string }) =>
    fetchJSON<any>(`/audit/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // System Health
  getHealth: () => fetchJSON<any>('/health'),

  // Autonomous Agent Workflow Execution
  runAgentWorkflow: (data: { agent_id: string; task_prompt: string; simulate_injection_attack: boolean }) =>
    fetchJSON<any>('/agent-exec/run', { method: 'POST', body: JSON.stringify(data) }),
};

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
  const token = typeof window !== 'undefined' ? (localStorage.getItem('crossx_token') || localStorage.getItem('agenttrust_token') || localStorage.getItem('access_token')) : null;
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const headers = {
    'Content-Type': 'application/json',
    ...authHeader,
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
  login: async (credentials: { username: string; password: string }) => {
    const res = await fetch(`${ENV.API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: credentials.username, password: credentials.password }),
    });
    if (!res.ok) {
      let errorMsg = `Authentication failed: HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errorMsg = errJson.detail || errorMsg;
      } catch {}
      throw new ApiError(errorMsg, res.status);
    }
    const data = await res.json();
    if (data.access_token && typeof window !== 'undefined') {
      localStorage.setItem('crossx_token', data.access_token);
      localStorage.setItem('agenttrust_token', data.access_token);
      localStorage.setItem('access_token', data.access_token);
    }
    return data;
  },
  getCurrentUser: () => apiClient.get<any>('/auth/me'),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('crossx_token');
      localStorage.removeItem('agenttrust_token');
      localStorage.removeItem('access_token');
    }
  },
  getHealth: () => apiClient.get<any>('/health'),
  getOverviewStats: () => apiClient.get<any>('/overview/stats'),
  listAgents: (status?: string) => apiClient.get<any[]>(`/agents${status ? `?status=${status}` : ''}`),
  getAgent: (id: string) => apiClient.get<any>(`/agents/${id}`),
  registerAgent: (data: any) => apiClient.post<any>('/agents', data),
  updateAgent: (id: string, data: any) => apiClient.patch<any>(`/agents/${id}`, data),
  revokeAgent: (id: string, reason: string) => apiClient.post<any>(`/agents/${id}/revoke`, { reason }),
  listTools: () => apiClient.get<any[]>('/tools'),
  updateTool: (id: string, data: any) => apiClient.patch<any>(`/tools/${id}`, data),
  listPermissions: (agentId?: string) => apiClient.get<any[]>(`/permissions${agentId ? `?agent_id=${agentId}` : ''}`),
  createPermission: (data: any) => apiClient.post<any>('/permissions', data),
  grantPermission: (data: any) => apiClient.post<any>('/permissions', data),
  deactivatePermission: (id: string) => apiClient.delete<any>(`/permissions/${id}`),
  revokePermission: (id: string) => apiClient.delete<any>(`/permissions/${id}`),
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
  createPolicy: (data: any) => apiClient.post<any>('/policies', data),
  updatePolicy: (id: string, data: any) => apiClient.put<any>(`/policies/${id}`, data),
  deletePolicy: (id: string) => apiClient.delete<any>(`/policies/${id}`),
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
    if (params?.agent_id) q.set('agent_id', params.agent_id);
    if (params?.limit) q.set('limit', String(params.limit));
    return apiClient.get<any[]>(`/incidents?${q.toString()}`);
  },
  getIncident: (id: string) => apiClient.get<any>(`/incidents/${id}`),
  createIncident: (data: any) => apiClient.post<any>('/incidents', data),
  updateIncident: (id: string, data: any) => apiClient.patch<any>(`/incidents/${id}`, data),
  quarantineAgentFromIncident: (incidentId: string) => apiClient.post<any>(`/incidents/${incidentId}/quarantine-agent`),
  getSecurityEvents: (params?: any) => {
    const q = new URLSearchParams();
    if (params?.agent_id) q.set('agent_id', params.agent_id);
    if (params?.decision) q.set('decision', params.decision);
    if (params?.tool_name) q.set('tool_name', params.tool_name);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return apiClient.get<any>(`/security/events?${q.toString()}`);
  },
  inspectGateway: (data: any, apiKey?: string) => {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    return apiClient.post<any>('/gateway/inspect', data, headers);
  },
  connectAgent: (apiKey?: string) => {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    return apiClient.post<any>('/agents/connect', {}, headers);
  },
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

  // Threat Map & Attribution Forensics
  getThreatMap: () => apiClient.get<any>('/attribution/threat-map'),
  getLocalArp: () => apiClient.get<any[]>('/attribution/local-arp'),
  traceIp: (ip: string) => apiClient.get<any>(`/attribution/trace/${encodeURIComponent(ip)}`),
  listSinkholes: () => apiClient.get<any[]>('/attribution/sinkholes'),
  createSinkhole: (data: any) => apiClient.post<any>('/attribution/sinkhole', data),
  releaseSinkhole: (ip: string) => apiClient.delete<any>(`/attribution/sinkhole/${encodeURIComponent(ip)}`),

  // Active Defense & Malicious Process Killer
  listActiveDefenseProcesses: () => apiClient.get<any[]>('/active-defense/processes'),
  killProcess: (data: any) => apiClient.post<any>('/active-defense/kill-process', data),
  getActiveDefenseQuarantine: () => apiClient.get<any[]>('/active-defense/quarantine'),
  restoreActiveDefenseQuarantine: (id: string) => apiClient.post<any>(`/active-defense/quarantine/${encodeURIComponent(id)}/restore`),
  purgeActiveDefenseQuarantine: (id: string) => apiClient.delete<any>(`/active-defense/quarantine/${encodeURIComponent(id)}`),
  getCountermeasuresHistory: () => apiClient.get<any[]>('/active-defense/countermeasures'),

  // Forensics & Reports
  getExecutiveSummary: (format: 'json' | 'html' = 'json') => apiClient.get<any>(`/reports/executive-summary?format=${format}`),
  exportIncidentReport: async (incidentId: string, format: 'html' | 'json' | 'csv' = 'html') => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('crossx_token') || localStorage.getItem('agenttrust_token') || localStorage.getItem('access_token')) : null;
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${ENV.API_BASE_URL}/reports/incident/${encodeURIComponent(incidentId)}/export?format=${format}`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      let errDetail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        errDetail = j.detail || errDetail;
      } catch {}
      throw new ApiError(errDetail, res.status);
    }
    return format === 'json' ? res.json() : res.text();
  },
  getMitreMatrix: () => apiClient.get<any>('/reports/mitre-matrix'),

  // CrossX Platform Transformation Additions
  quarantineAgent: (id: string, reason?: string) => apiClient.post<any>(`/agents/${id}/quarantine`, { reason: reason || 'SOC Manual Containment' }),
  suspendAgent: (id: string, reason?: string) => apiClient.post<any>(`/agents/${id}/suspend`, { reason: reason || 'Administrative suspension' }),
  restrictAgent: (id: string, reason?: string) => apiClient.post<any>(`/agents/${id}/restrict`, { reason: reason || 'Containment restriction' }),
  activateAgent: (id: string) => apiClient.post<any>(`/agents/${id}/activate`),
  rotateAgentCredentials: (id: string) => apiClient.post<any>(`/agents/${id}/rotate-credentials`),
  validateAgentConnection: (id: string) => apiClient.get<any>(`/agents/${id}/validate-connection`),

  listThreats: (category?: string) => apiClient.get<any[]>(`/threats${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getThreat: (id: string) => apiClient.get<any>(`/threats/${id}`),
  evaluateThreat: (data: any) => apiClient.post<any>('/threats/evaluate', data),
  remediateThreat: (id: string, data: any) => apiClient.post<any>(`/threats/${id}/remediate`, data),

  investigateThreatIntel: (data: any) => apiClient.post<any>('/threat-intelligence/investigate', data),
  getThreatIntelHistory: () => apiClient.get<any[]>('/threat-intelligence/history'),

  getMlModelsInventory: () => apiClient.get<any>('/ml-security/models'),
  retrainMlModel: () => apiClient.post<any>('/ml-security/retrain'),
  predictMlPrompt: (prompt: string) => apiClient.post<any>('/ml-security/predict', { prompt }),
  classifySecurityEvent: (text: string) => apiClient.post<any>('/ml-security/classify-event', { text }),
  getBehaviorAnomalyScore: (data: any) => apiClient.post<any>('/ml-security/anomaly-score', data),
  getExplainableRiskScore: (data: any) => apiClient.post<any>('/ml-security/risk-score', data),

  searchCompliance: (q: string, framework?: string) => apiClient.get<any[]>(`/compliance/search?q=${encodeURIComponent(q)}${framework ? `&framework=${encodeURIComponent(framework)}` : ''}`),
  listComplianceFrameworks: () => apiClient.get<any[]>('/compliance/frameworks'),
  assessIncidentCompliance: (data: any) => apiClient.post<any>('/compliance/assess-incident', data),

  getAnalyticsOverview: () => apiClient.get<any>('/analytics/overview'),
  getAgentAnalyticsProfile: (id: string) => apiClient.get<any>(`/analytics/agents/${id}`),
  getSystemDiagnostics: () => apiClient.get<any>('/system/diagnostics'),

  // AI Agent Simulation Lab APIs
  listSimulationScenarios: () => apiClient.get<any>('/simulations/scenarios'),
  runSimulation: (scenarioId?: string) => apiClient.post<any>('/simulations/run', { scenario_id: scenarioId || null }),
  getSimulationResults: () => apiClient.get<any>('/simulations/results'),
  getTestAgentStatus: () => apiClient.get<any>('/simulations/agent/status'),
  performAgentAction: (action: string, reason?: string) => apiClient.post<any>('/simulations/agent/action', { action, reason }),
  executeTestAgentTask: (taskPrompt: string, context?: any) => apiClient.post<any>('/simulations/agent/execute', { task_prompt: taskPrompt, context: context || {} }),
};

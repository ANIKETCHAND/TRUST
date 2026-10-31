import { apiClient } from './api.client';
import type { Agent, AgentCreatePayload, AgentRegistrationResult, AgentStatus, AgentUpdatePayload } from '../types';

export const agentService = {
  list: (status?: AgentStatus | string) =>
    apiClient.get<Agent[]>(`/agents${status ? `?status=${status}` : ''}`),

  getById: (id: string) =>
    apiClient.get<Agent>(`/agents/${id}`),

  register: (payload: AgentCreatePayload) =>
    apiClient.post<AgentRegistrationResult>('/agents', payload),

  update: (id: string, payload: AgentUpdatePayload) =>
    apiClient.patch<Agent>(`/agents/${id}`, payload),

  revoke: (id: string, reason: string) =>
    apiClient.post<{ message: string; agent_id: string; status: string }>(`/agents/${id}/revoke`, { reason }),
};

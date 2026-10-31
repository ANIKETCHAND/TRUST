import { apiClient } from './api.client';
import type { GatewayExecutionPayload, GatewayExecutionResponse, Tool } from '../types';

export const toolService = {
  list: () => apiClient.get<Tool[]>('/tools'),
  getById: (id: string) => apiClient.get<Tool>(`/tools/${id}`),

  executeViaGateway: (payload: GatewayExecutionPayload, apiKey?: string) => {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return apiClient.post<GatewayExecutionResponse>('/gateway/execute', payload, headers);
  },
};

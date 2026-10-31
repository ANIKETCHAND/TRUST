import { useState, useEffect, useCallback } from 'react';
import { agentService } from '../services/agent.service';
import type { Agent, AgentCreatePayload, AgentRegistrationResult, AgentStatus } from '../types';
import { useToast } from '../context/ToastContext';

export function useAgents(statusFilter?: AgentStatus | string) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agentService.list(statusFilter);
      setAgents(data);
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch registered agents';
      setError(msg);
      toast.error('Agent Fetch Error', msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const registerAgent = async (payload: AgentCreatePayload): Promise<AgentRegistrationResult | null> => {
    try {
      const res = await agentService.register(payload);
      toast.success('Agent Provisioned', `Agent '${res.agent.name}' created with active key.`);
      await fetchAgents();
      return res;
    } catch (err: any) {
      toast.error('Provisioning Failed', err.message);
      return null;
    }
  };

  const revokeAgent = async (agentId: string, reason: string): Promise<boolean> => {
    try {
      await agentService.revoke(agentId, reason);
      toast.warning('Agent Revoked', 'Agent credentials permanently invalidated.');
      await fetchAgents();
      return true;
    } catch (err: any) {
      toast.error('Revocation Error', err.message);
      return false;
    }
  };

  return {
    agents,
    loading,
    error,
    refresh: fetchAgents,
    registerAgent,
    revokeAgent,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { toolService } from '../services/tool.service';
import type { GatewayExecutionPayload, GatewayExecutionResponse, Tool } from '../types';
import { useToast } from '../context/ToastContext';

export function useTools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<GatewayExecutionResponse | null>(null);
  const toast = useToast();

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      const data = await toolService.list();
      setTools(data);
    } catch (err: any) {
      toast.error('Tool Registry Error', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const executeTool = async (payload: GatewayExecutionPayload, apiKey?: string) => {
    setExecuting(true);
    setExecutionResult(null);
    try {
      const res = await toolService.executeViaGateway(payload, apiKey);
      setExecutionResult(res);
      if (res.decision === 'ALLOWED') {
        toast.success('Gateway Authorized', `Executed ${payload.tool}:${payload.operation}`);
      } else {
        toast.warning('Gateway Blocked', res.reason);
      }
      return res;
    } catch (err: any) {
      const blockedRes: GatewayExecutionResponse = {
        request_id: 'client-err',
        event_id: 'client-err',
        decision: 'BLOCKED',
        execution_status: 'BLOCKED',
        reason: err.message || 'Operation denied by gateway',
        error: err.message,
      };
      setExecutionResult(blockedRes);
      toast.error('Execution Error', err.message);
      return blockedRes;
    } finally {
      setExecuting(false);
    }
  };

  return {
    tools,
    loading,
    executing,
    executionResult,
    refresh: fetchTools,
    executeTool,
  };
}

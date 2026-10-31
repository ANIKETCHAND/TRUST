import React, { useEffect, useState, useCallback } from 'react';
import { Bot, Play, Terminal, Layers } from 'lucide-react';
import { api } from '../../services/api.client';
import type { Agent } from '../../types';
import { DecisionBadge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

interface WorkflowStep {
  step: number;
  action: string;
  tool: string;
  decision: 'ALLOWED' | 'BLOCKED' | 'REQUIRES_APPROVAL';
  reason: string;
  execution_status: string;
  result_preview?: any;
}

interface WorkflowResult {
  status: 'COMPLETED' | 'HALTED_BY_GATEWAY' | 'ERROR';
  agent_id: string;
  steps: WorkflowStep[];
}

export const AgentRunnerTab: React.FC = () => {
  const { showToast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [taskPrompt, setTaskPrompt] = useState(
    'Query enterprise database for active clients, compute client volume, and write summary report to reports/'
  );
  const [simulateInjection, setSimulateInjection] = useState(false);
  const [running, setRunning] = useState(false);
  const [workflowOutput, setWorkflowOutput] = useState<WorkflowResult | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoadingAgents(true);
      const res = await api.listAgents('active');
      setAgents(res as Agent[]);
      if (res.length > 0 && !selectedAgentId) {
        setSelectedAgentId(res[0].id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load active agents', 'error');
    } finally {
      setLoadingAgents(false);
    }
  }, [selectedAgentId, showToast]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleRunWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      showToast('Please select an active agent before executing.', 'warning');
      return;
    }
    setRunning(true);
    setWorkflowOutput(null);

    try {
      const res = await api.runAgentWorkflow({
        agent_id: selectedAgentId,
        task_prompt: taskPrompt,
        simulate_injection_attack: simulateInjection,
      });
      setWorkflowOutput(res as WorkflowResult);
      if (res.status === 'COMPLETED') {
        showToast('Autonomous agent task completed successfully.', 'success');
      } else {
        showToast(`Workflow halted by AgentTrust gateway: ${res.status}`, 'warning');
      }
    } catch (err: any) {
      showToast(`Agent workflow execution error: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="h-7 w-7 text-cyan-400" />
            Autonomous Agent Execution & Guardrail Runner
          </h1>
          <p className="text-sm text-slate-400">
            Execute multi-step autonomous AI workflows where every database query, file write, and external API call passes through the AgentTrust security gateway.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Run Controls */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Terminal className="h-4 w-4 text-cyan-400" />
            Task Dispatch Configuration
          </h2>

          <form onSubmit={handleRunWorkflow} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-300">Target Agent</label>
              {loadingAgents ? (
                <div className="mt-1 py-2">
                  <LoadingSpinner size="sm" message="Loading agents..." />
                </div>
              ) : (
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  aria-label="Select target agent"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                  {agents.length === 0 && <option value="">No active agents registered</option>}
                </select>
              )}
            </div>

            <div>
              <label className="font-semibold text-slate-300">High-Level Task Directive</label>
              <textarea
                rows={4}
                required
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Prompt Injection Simulation Switch */}
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateInjection}
                  onChange={(e) => setSimulateInjection(e.target.checked)}
                  className="mt-0.5 rounded border-amber-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-bold text-amber-300">Simulate Indirect Prompt Injection</span>
                  <p className="mt-0.5 text-[11px] text-amber-400/80">
                    Injects a malicious untrusted vendor document instruction commanding the agent to exfiltrate database records to an external HTTP sink. Observe AgentTrust blocking the leak!
                  </p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={running || agents.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              <Play className="h-4 w-4" />
              {running ? 'Agent Dispatched & Running...' : 'Execute Agent Workflow'}
            </button>
          </form>
        </div>

        {/* Live Step Execution Timeline */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Bot className="h-4 w-4 text-cyan-400" />
                Interception & Security Guardrail Timeline
              </h2>
              {workflowOutput && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    workflowOutput.status === 'COMPLETED'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {workflowOutput.status}
                </span>
              )}
            </div>

            {running ? (
              <div className="py-24">
                <LoadingSpinner size="lg" message="Agent execution dispatched. Intercepting operations via Security Gateway..." />
              </div>
            ) : workflowOutput ? (
              <div className="mt-4 space-y-4">
                {workflowOutput.steps.map((st) => (
                  <div key={st.step} className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                          Step {st.step}
                        </span>
                        <span className="font-bold text-white">{st.action}</span>
                      </div>
                      <div>
                        <DecisionBadge decision={st.decision} />
                      </div>
                    </div>

                    <div className="font-mono text-slate-400 text-[11px]">
                      Tool: <span className="text-cyan-300">{st.tool}</span> | Status:{' '}
                      <span className="text-slate-300">{st.execution_status}</span>
                    </div>

                    <div className="text-slate-300 text-[11px]">
                      <span className="font-semibold text-slate-400">Gateway Enforcement: </span>
                      {st.reason}
                    </div>

                    {st.result_preview && (
                      <div className="mt-2">
                        <span className="font-semibold text-slate-400 text-[11px]">Execution Result Preview:</span>
                        <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-900 p-2 font-mono text-[10px] text-cyan-300 border border-slate-800">
                          {JSON.stringify(st.result_preview, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-xs text-slate-500 space-y-2">
                <Bot className="h-10 w-10 text-slate-600 mb-1" />
                <p>Click &quot;Execute Agent Workflow&quot; on the left to watch AgentTrust intercept each step in real time.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

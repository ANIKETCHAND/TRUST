import React, { useEffect, useState, useCallback } from 'react';
import { Bot, Play, Terminal, Layers, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.client';
import type { Agent } from '../../types';
import { DecisionBadge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TerminalBox } from '../ui/TerminalBox';
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
  const toast = useToast();
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
      toast.error('Agent Load Failed', err.message || 'Failed to load active agents');
    } finally {
      setLoadingAgents(false);
    }
  }, [selectedAgentId, toast]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleRunWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      toast.warning('Agent Required', 'Please select an active agent before executing.');
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
        toast.success('Workflow Completed', 'Autonomous agent task executed within policy boundaries.');
      } else {
        toast.warning('Workflow Halted', `Gateway intercepted violation: ${res.status}`);
      }
    } catch (err: any) {
      toast.error('Workflow Exception', err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-kali-cyan" />
            Agent Playground & Guardrail Testbench
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Simulate multi-step autonomous AI operations with real-time gateway interception and prompt injection testing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAgents}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loadingAgents ? 'animate-spin' : ''}`} />
            <span>Sync Agents</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Run Controls */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Terminal className="h-4 w-4 text-kali-primary" />
            <span>Task Dispatch Configuration</span>
          </h2>

          <form onSubmit={handleRunWorkflow} className="space-y-4">
            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Target Agent</label>
              {loadingAgents ? (
                <div className="py-2">
                  <LoadingSpinner size="sm" message="Enumerating agents..." />
                </div>
              ) : (
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} className="bg-[#0a0d14] text-white">
                      {a.name} ({a.role})
                    </option>
                  ))}
                  {agents.length === 0 && <option value="" className="bg-[#0a0d14] text-white">No active agents registered</option>}
                </select>
              )}
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Autonomous Task Directive</label>
              <textarea
                rows={4}
                required
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-kali-cyan focus:border-kali-primary focus:outline-none text-xs leading-relaxed"
              />
            </div>

            {/* Prompt Injection Simulation Switch */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-slate-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateInjection}
                  onChange={(e) => setSimulateInjection(e.target.checked)}
                  className="mt-1 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-amber-400 block text-xs">Simulate Prompt Injection Attack</span>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                    Inject an untrusted third-party document command forcing the agent to exfiltrate database records to an external sink to test gateway interception.
                  </p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={running || agents.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-kali-primary py-2.5 text-xs font-semibold text-white shadow-lg shadow-kali-primary/20 hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{running ? 'Dispatching & Intercepting...' : 'Dispatch Agent Workflow'}</span>
            </button>
          </form>
        </div>

        {/* Live Step Execution Timeline */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bot className="h-4 w-4 text-kali-cyan" />
                <span>Gateway Interception Timeline</span>
              </h2>
              {workflowOutput && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    workflowOutput.status === 'COMPLETED'
                      ? 'bg-kali-secure/10 text-kali-secure border border-kali-secure/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {workflowOutput.status === 'COMPLETED' ? 'Completed' : 'Halted by Gateway'}
                </span>
              )}
            </div>

            {running ? (
              <div className="py-24">
                <LoadingSpinner size="lg" message="Agent task dispatched. Intercepting operations via zero-trust gateway..." />
              </div>
            ) : workflowOutput ? (
              <div className="mt-4 space-y-3 text-xs">
                {workflowOutput.steps.map((st) => (
                  <div key={st.step} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-white/10">
                          Step {st.step}
                        </span>
                        <span className="font-semibold text-white">{st.action}</span>
                      </div>
                      <DecisionBadge decision={st.decision} />
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Tool: <span className="text-kali-cyan font-mono">{st.tool}</span> • Status:{' '}
                      <span className="text-slate-300 font-medium">{st.execution_status}</span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      <span className="text-slate-400 font-medium">Gateway Verdict: </span>
                      {st.reason}
                    </div>

                    {st.result_preview && (
                      <div className="mt-2.5">
                        <span className="text-[11px] text-slate-400 font-medium block mb-1">Payload Output Preview:</span>
                        <TerminalBox
                          title={`Step ${st.step} Output`}
                          copyContent={JSON.stringify(st.result_preview, null, 2)}
                          maxHeight="max-h-32"
                        >
                          <pre>{JSON.stringify(st.result_preview, null, 2)}</pre>
                        </TerminalBox>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-xs text-slate-500 space-y-2">
                <Bot className="h-8 w-8 text-slate-600 mb-1" />
                <p>Click &quot;Dispatch Agent Workflow&quot; to observe multi-step guardrail interception.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

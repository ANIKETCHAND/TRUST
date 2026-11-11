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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// AGENT_SECURITY</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">SANDBOX_PLAYGROUND</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Layers className="h-6 w-6 text-kali-primary" />
            Autonomous Agent Playground & Guardrail Testbench
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulate multi-step autonomous AI operations where every database query, filesystem write, and network egress is intercepted by the Security Gateway.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAgents}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loadingAgents ? 'animate-spin' : ''}`} />
            <span>SYNC AGENTS</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Run Controls */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-4 font-mono text-xs">
          <h2 className="text-xs font-bold text-white flex items-center gap-2 border-b border-kali-border pb-3">
            <Terminal className="h-4 w-4 text-kali-primary" />
            <span>// TASK_DISPATCH_CONFIGURATION</span>
          </h2>

          <form onSubmit={handleRunWorkflow} className="space-y-4">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Target Subject Agent</label>
              {loadingAgents ? (
                <div className="py-2">
                  <LoadingSpinner size="sm" message="Enumerating agents..." />
                </div>
              ) : (
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
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
              <label className="text-slate-300 font-semibold block mb-1">Autonomous Task Directive</label>
              <textarea
                rows={4}
                required
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                className="w-full rounded border border-kali-border bg-kali-bg p-3 text-kali-cyan focus:border-kali-primary focus:outline-none font-sans text-xs"
              />
            </div>

            {/* Prompt Injection Simulation Switch */}
            <div className="rounded border border-kali-warning/50 bg-[#2E200C] p-3 text-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateInjection}
                  onChange={(e) => setSimulateInjection(e.target.checked)}
                  className="mt-0.5 rounded border-kali-border bg-kali-bg text-kali-warning focus:ring-kali-warning"
                />
                <div>
                  <span className="font-bold text-kali-warning font-mono">[INJECTION TESTBENCH]</span>
                  <p className="mt-1 text-[11px] text-slate-300 font-sans leading-relaxed">
                    Inject an untrusted third-party document command forcing the agent to exfiltrate database records to an external HTTP sink. Observe AgentTrust pre-flight interception!
                  </p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={running || agents.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded bg-kali-primary py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{running ? 'Dispatching & Intercepting...' : 'Dispatch Agent Workflow'}</span>
            </button>
          </form>
        </div>

        {/* Live Step Execution Timeline */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-kali-border pb-3">
              <h2 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <Bot className="h-4 w-4 text-kali-cyan" />
                <span>// GATEWAY_INTERCEPTION_TIMELINE</span>
              </h2>
              {workflowOutput && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    workflowOutput.status === 'COMPLETED'
                      ? 'bg-[#0E2E22] text-kali-secure border border-[#155E42]'
                      : 'bg-[#331418] text-kali-critical border border-[#7A1F26]'
                  }`}
                >
                  [{workflowOutput.status}]
                </span>
              )}
            </div>

            {running ? (
              <div className="py-24">
                <LoadingSpinner size="lg" message="AGENT TASK DISPATCHED. INTERCEPTING OPERATIONS VIA ZERO-TRUST GATEWAY..." />
              </div>
            ) : workflowOutput ? (
              <div className="mt-4 space-y-3 font-mono text-xs">
                {workflowOutput.steps.map((st) => (
                  <div key={st.step} className="rounded border border-kali-border bg-kali-bg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-kali-card px-2 py-0.5 text-[10px] text-slate-300 border border-kali-border">
                          STEP {st.step}
                        </span>
                        <span className="font-bold text-white font-sans">{st.action}</span>
                      </div>
                      <DecisionBadge decision={st.decision} />
                    </div>

                    <div className="text-[11px] text-slate-400">
                      TOOL: <span className="text-kali-cyan font-bold">{st.tool}</span> • STATUS:{' '}
                      <span className="text-white">{st.execution_status}</span>
                    </div>

                    <div className="text-[11px] text-slate-300 font-sans">
                      <span className="font-mono text-slate-400 font-bold">GATEWAY VERDICT: </span>
                      {st.reason}
                    </div>

                    {st.result_preview && (
                      <div className="mt-2">
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Payload Output Preview:</span>
                        <TerminalBox
                          title={`STEP ${st.step} OUTPUT`}
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
              <div className="flex h-64 flex-col items-center justify-center text-xs text-slate-500 font-mono space-y-2">
                <Bot className="h-8 w-8 text-slate-600 mb-1" />
                <p>// CLICK &quot;DISPATCH AGENT WORKFLOW&quot; TO OBSERVE MULTI-STEP GUARDRAIL INTERCEPTION.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

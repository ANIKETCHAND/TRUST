import React, { useEffect, useState } from 'react';
import { Wrench, Terminal, Play, CheckCircle2, XCircle, HardDrive, Database, Globe, Network, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

export const ToolsTab: React.FC = () => {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Live Gateway Tester state
  const [agentApiKey, setAgentApiKey] = useState('');
  const [testTool, setTestTool] = useState('filesystem_tool');
  const [testOp, setTestOp] = useState('read_file');
  const [testResource, setTestResource] = useState('reports/audit_2026.txt');
  const [testParams, setTestParams] = useState('{\n  "encoding": "utf-8"\n}');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const fetchToolsAndAgents = async () => {
    try {
      setLoading(true);
      const toolList = await api.listTools();
      setTools(toolList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolsAndAgents();
  }, []);

  const handleExecuteTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecuting(true);
    setExecutionResult(null);

    let parsedParams = {};
    try {
      if (testParams.trim()) {
        parsedParams = JSON.parse(testParams);
      }
    } catch (err: any) {
      alert(`Invalid JSON in parameters: ${err.message}`);
      setExecuting(false);
      return;
    }

    try {
      const res = await api.executeTool(
        {
          tool: testTool,
          operation: testOp,
          resource: testResource,
          parameters: parsedParams,
          context: { source: 'dashboard_tool_tester' },
        },
        agentApiKey || undefined
      );
      setExecutionResult(res);
    } catch (err: any) {
      setExecutionResult({
        decision: 'BLOCKED',
        execution_status: 'BLOCKED',
        reason: err.message,
        error: err.message,
      });
    } finally {
      setExecuting(false);
    }
  };

  const getToolIcon = (category: string) => {
    switch (category) {
      case 'filesystem':
        return <HardDrive className="h-6 w-6 text-cyan-400" />;
      case 'database':
        return <Database className="h-6 w-6 text-emerald-400" />;
      case 'http_api':
        return <Globe className="h-6 w-6 text-purple-400" />;
      default:
        return <Network className="h-6 w-6 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wrench className="h-7 w-7 text-purple-400" />
            Protected Tool Registry & Execution Testing
          </h1>
          <p className="text-sm text-slate-400">
            Enforced server-side tool integrations, sandboxed boundaries, and interactive gateway test dispatch.
          </p>
        </div>
        <button
          onClick={fetchToolsAndAgents}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Tools
        </button>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tools.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                {getToolIcon(t.category)}
                <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/80">
                  {t.status.toUpperCase()}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-white">{t.display_name}</h3>
              <p className="mt-1 text-xs text-slate-400 font-mono">{t.name}</p>
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-slate-400">Supported Operations:</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {t.supported_operations.map((op: string) => (
                    <span key={op} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">
                      {op}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span>Boundary:</span>
              <span className="font-mono text-cyan-400">Sandboxed Jail</span>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Gateway Execution Tester */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-cyan-400" />
              Gateway Execution Testing Console
            </h2>
            <p className="text-xs text-slate-400">
              Dispatch a real tool call through the Security Gateway to verify deterministic policy decisions and tool outputs.
            </p>
          </div>
        </div>

        <form onSubmit={handleExecuteTool} className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Controls Column */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Agent API Key (Bearer Authorization)</label>
              <input
                type="password"
                placeholder="agk_live_... (leave empty to test unauthorized denial)"
                value={agentApiKey}
                onChange={(e) => setAgentApiKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-cyan-300 focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">
                Supply the agent's key to test authorized calls, or leave empty/invalid to observe fail-closed denial.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Target Tool</label>
                <select
                  value={testTool}
                  onChange={(e) => {
                    setTestTool(e.target.value);
                    if (e.target.value === 'filesystem_tool') {
                      setTestOp('read_file');
                      setTestResource('reports/audit_2026.txt');
                      setTestParams('{\n  "encoding": "utf-8"\n}');
                    } else if (e.target.value === 'postgres_tool') {
                      setTestOp('query_select');
                      setTestResource('table:customer_records');
                      setTestParams('{\n  "sql": "SELECT customer_name, annual_spend FROM customer_records"\n}');
                    } else if (e.target.value === 'http_api_tool') {
                      setTestOp('http_get');
                      setTestResource('https://httpbin.org/get');
                      setTestParams('{\n  "timeout": 5\n}');
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="filesystem_tool">filesystem_tool</option>
                  <option value="postgres_tool">postgres_tool</option>
                  <option value="http_api_tool">http_api_tool</option>
                  <option value="mcp_tool">mcp_tool</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Operation</label>
                <input
                  type="text"
                  value={testOp}
                  onChange={(e) => setTestOp(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Target Resource</label>
              <input
                type="text"
                value={testResource}
                onChange={(e) => setTestResource(e.target.value)}
                placeholder="e.g. reports/audit.txt or table:customer_records"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Parameters (JSON Payload)</label>
              <textarea
                rows={5}
                value={testParams}
                onChange={(e) => setTestParams(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={executing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {executing ? 'Evaluating & Executing via Gateway...' : 'Dispatch Request to Gateway'}
            </button>
          </div>

          {/* Result Column */}
          <div className="flex flex-col rounded-lg border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Gateway Interception & Execution Result
            </span>

            {executionResult ? (
              <div className="mt-3 flex-1 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    {executionResult.decision === 'ALLOWED' ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800">
                        <CheckCircle2 className="h-4 w-4" /> ALLOWED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-950 px-2 py-0.5 text-xs font-bold text-rose-400 border border-rose-800">
                        <XCircle className="h-4 w-4" /> BLOCKED
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-400">
                      Status: {executionResult.execution_status}
                    </span>
                  </div>
                  {executionResult.execution_duration_ms && (
                    <span className="font-mono text-xs text-cyan-400">
                      Latency: {executionResult.execution_duration_ms.toFixed(2)} ms
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-slate-400">Decision Reason: </span>
                  {executionResult.reason}
                </div>

                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-400">Payload / Result Body:</span>
                  <pre className="mt-1 h-52 overflow-auto rounded border border-slate-800 bg-slate-900/60 p-3 font-mono text-[11px] text-cyan-300">
                    {JSON.stringify(executionResult.result || executionResult.error || executionResult, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-slate-600">
                No tool request dispatched yet. Click "Dispatch Request to Gateway" to evaluate.
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

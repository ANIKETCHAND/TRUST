import React, { useState } from 'react';
import {
  Wrench,
  Play,
  RefreshCw,
  HardDrive,
  Database,
  Globe,
  Network,
} from 'lucide-react';
import { useTools } from '../../hooks/useTools';
import { DecisionBadge, StatusBadge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TerminalBox } from '../ui/TerminalBox';
import { formatLatency, safeJsonParse } from '../../utils/formatters';

export const ToolsTab: React.FC = () => {
  const { tools, loading, executing, executionResult, refresh, executeTool } = useTools();

  // Gateway tester state
  const [agentApiKey, setAgentApiKey] = useState('');
  const [testTool, setTestTool] = useState('filesystem_tool');
  const [testOp, setTestOp] = useState('read_file');
  const [testResource, setTestResource] = useState('reports/audit_2026.txt');
  const [testParams, setTestParams] = useState('{\n  "encoding": "utf-8"\n}');

  const handleExecuteTool = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedParams = safeJsonParse(testParams, {});
    await executeTool(
      {
        tool: testTool,
        operation: testOp,
        resource: testResource,
        parameters: parsedParams,
        context: { source: 'kali_dashboard_tool_tester' },
      },
      agentApiKey || undefined
    );
  };

  const getToolIcon = (category: string) => {
    switch (category) {
      case 'filesystem':
        return <HardDrive className="h-5 w-5 text-kali-cyan" />;
      case 'database':
        return <Database className="h-5 w-5 text-kali-secure" />;
      case 'http_api':
        return <Globe className="h-5 w-5 text-kali-primary" />;
      default:
        return <Network className="h-5 w-5 text-kali-warning" />;
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
            <span className="font-mono text-xs text-kali-cyan">TOOL_REGISTRY</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Wrench className="h-6 w-6 text-kali-primary" />
            Protected Tool Registry & Sandboxed Execution Console
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Sandboxed tool boundaries, strict filesystem isolation, authenticated database adapters, and interactive gateway interception dispatch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC TOOLS</span>
          </button>
        </div>
      </div>

      {/* Tool Cards */}
      {loading && tools.length === 0 ? (
        <LoadingSpinner message="ENUMERATING PROTECTED TOOL CONNECTORS..." />
      ) : (
        <div>
          <div className="mb-2 font-mono text-[11px] font-bold text-slate-400">
            // REGISTERED_TOOL_ADAPTERS ({tools.length})
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tools.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card flex flex-col justify-between hover:border-kali-primary/60 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getToolIcon(t.category)}
                      <span className="font-mono text-[10px] uppercase text-kali-cyan bg-kali-bg px-2 py-0.5 rounded border border-kali-border">
                        {t.category}
                      </span>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-white">{t.display_name}</h3>
                  <p className="mt-1 font-mono text-xs text-slate-400">{t.name}</p>

                  <div className="mt-3">
                    <span className="font-mono text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Allowed Operations:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {t.supported_operations.map((op: string) => (
                        <span
                          key={op}
                          className="rounded bg-kali-bg px-1.5 py-0.5 font-mono text-[10px] text-slate-300 border border-kali-border"
                        >
                          {op}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-kali-border pt-2.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span>JAIL BOUNDARY:</span>
                  <span className="text-kali-secure font-bold">[SANDBOX_ACTIVE]</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Gateway Execution Tester */}
      <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-4">
        <div className="flex items-center justify-between border-b border-kali-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-kali-primary font-bold">[INTERACTIVE_DISPATCH]</span>
              <h2 className="text-sm font-bold text-white">Gateway Pre-Flight Tool Dispatch Testing Bench</h2>
            </div>
            <p className="font-mono text-[10px] text-slate-400 mt-0.5">
              Dispatch real requests to the Security Gateway to observe policy evaluation, authorization enforcement, and execution outcomes.
            </p>
          </div>
        </div>

        <form onSubmit={handleExecuteTool} className="grid grid-cols-1 gap-5 lg:grid-cols-2 font-mono text-xs">
          {/* Controls Column */}
          <div className="space-y-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Agent Bearer Key (<span className="text-slate-400 font-sans">Leave blank to test fail-closed unauthorized denial</span>)
              </label>
              <input
                type="password"
                placeholder="agk_live_... (optional)"
                value={agentApiKey}
                onChange={(e) => setAgentApiKey(e.target.value)}
                className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-kali-cyan focus:border-kali-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Target Tool</label>
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
                  className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                >
                  <option value="filesystem_tool">filesystem_tool</option>
                  <option value="postgres_tool">postgres_tool</option>
                  <option value="http_api_tool">http_api_tool</option>
                  <option value="mcp_tool">mcp_tool</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Operation</label>
                <input
                  type="text"
                  value={testOp}
                  onChange={(e) => setTestOp(e.target.value)}
                  className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Target Resource</label>
              <input
                type="text"
                value={testResource}
                onChange={(e) => setTestResource(e.target.value)}
                placeholder="e.g. reports/audit.txt or table:customers"
                className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Parameters (JSON Schema)</label>
              <textarea
                rows={4}
                value={testParams}
                onChange={(e) => setTestParams(e.target.value)}
                className="w-full rounded border border-kali-border bg-kali-bg p-2.5 text-kali-cyan focus:border-kali-primary focus:outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={executing}
              className="w-full flex items-center justify-center gap-2 rounded bg-kali-primary py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{executing ? 'Evaluating Gateway...' : 'Dispatch Request To Gateway'}</span>
            </button>
          </div>

          {/* Result Column */}
          <div className="flex flex-col justify-between rounded border border-kali-border bg-kali-bg p-4">
            <div>
              <div className="flex items-center justify-between border-b border-kali-border pb-2.5 mb-3">
                <span className="font-bold text-white">// GATEWAY_DECISION_OUTCOME</span>
                {executionResult && <DecisionBadge decision={executionResult.decision} />}
              </div>

              {executionResult ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>EXECUTION STATUS: {executionResult.execution_status}</span>
                    {executionResult.execution_duration_ms && (
                      <span className="text-kali-cyan">
                        LATENCY: {formatLatency(executionResult.execution_duration_ms)}
                      </span>
                    )}
                  </div>

                  <div className="rounded border border-kali-border bg-kali-card p-2.5 text-slate-300 font-sans leading-relaxed">
                    <span className="font-mono text-slate-400 font-bold">REASON: </span>
                    {executionResult.reason}
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block mb-1">// RESPONSE_PAYLOAD</span>
                    <TerminalBox
                      title="GATEWAY EXECUTION RESULT"
                      copyContent={JSON.stringify(executionResult.result || executionResult.error || executionResult, null, 2)}
                      maxHeight="max-h-48"
                    >
                      <pre>{JSON.stringify(executionResult.result || executionResult.error || executionResult, null, 2)}</pre>
                    </TerminalBox>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 font-mono text-xs">
                  // ZERO DISPATCH RECORDED. CLICK "DISPATCH REQUEST TO GATEWAY" TO EVALUATE.
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

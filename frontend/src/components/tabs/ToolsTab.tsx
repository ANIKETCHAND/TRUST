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
        context: { source: 'dashboard_tool_tester' },
      },
      agentApiKey || undefined
    );
  };

  const getToolIcon = (category: string) => {
    switch (category) {
      case 'filesystem':
        return <HardDrive className="h-5 w-5 text-kali-cyan" />;
      case 'database':
        return <Database className="h-5 w-5 text-emerald-400" />;
      case 'http_api':
        return <Globe className="h-5 w-5 text-kali-primary" />;
      default:
        return <Network className="h-5 w-5 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Wrench className="h-6 w-6 text-kali-cyan" />
            Protected Tool Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sandboxed tool adapters, access boundaries, and interactive dispatch testing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Tool Cards */}
      {loading && tools.length === 0 ? (
        <LoadingSpinner message="Loading registered tools..." />
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Registered Connectors ({tools.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tools.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md flex flex-col justify-between hover:border-white/20 hover:bg-white/[0.04] transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                        {getToolIcon(t.category)}
                      </div>
                      <span className="text-[10px] uppercase font-medium text-kali-cyan bg-kali-cyan/10 px-2 py-0.5 rounded-full border border-kali-cyan/20">
                        {t.category}
                      </span>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{t.display_name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{t.name}</p>

                  <div className="mt-3.5">
                    <span className="text-xs font-medium text-slate-400 block mb-1.5">
                      Allowed Operations:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {t.supported_operations.map((op: string) => (
                        <span
                          key={op}
                          className="rounded-lg bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-white/10"
                        >
                          {op}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-white/10 pt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Boundary:</span>
                  <span className="text-emerald-400 font-medium">Sandbox Enforced</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Gateway Execution Tester */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-md space-y-5">
        <div className="border-b border-white/10 pb-4">
          <h2 className="text-sm font-semibold text-white">Pre-Flight Dispatch Testbench</h2>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch test requests to the Security Gateway to observe policy evaluation and outcomes.
          </p>
        </div>

        <form onSubmit={handleExecuteTool} className="grid grid-cols-1 gap-6 lg:grid-cols-2 text-xs">
          {/* Controls Column */}
          <div className="space-y-4">
            <div>
              <label className="text-slate-300 font-medium block mb-1.5">
                Agent Bearer Key <span className="text-slate-400 text-xs font-normal">(Leave empty to test unauthorized denial)</span>
              </label>
              <input
                type="password"
                placeholder="agk_live_... (optional)"
                value={agentApiKey}
                onChange={(e) => setAgentApiKey(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-kali-cyan focus:border-kali-cyan focus:outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Target Tool</label>
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
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-cyan focus:outline-none"
                >
                  <option value="filesystem_tool" className="bg-[#0a0d14]">filesystem_tool</option>
                  <option value="postgres_tool" className="bg-[#0a0d14]">postgres_tool</option>
                  <option value="http_api_tool" className="bg-[#0a0d14]">http_api_tool</option>
                  <option value="mcp_tool" className="bg-[#0a0d14]">mcp_tool</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Operation</label>
                <input
                  type="text"
                  value={testOp}
                  onChange={(e) => setTestOp(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-cyan focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Target Resource</label>
              <input
                type="text"
                value={testResource}
                onChange={(e) => setTestResource(e.target.value)}
                placeholder="e.g. reports/audit.txt or table:customers"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Parameters (JSON Schema)</label>
              <textarea
                rows={4}
                value={testParams}
                onChange={(e) => setTestParams(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-kali-cyan focus:border-kali-cyan focus:outline-none font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={executing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue py-3 text-xs font-semibold text-white shadow-kali-glow hover:opacity-95 transition-all disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{executing ? 'Evaluating Gateway...' : 'Dispatch Request to Gateway'}</span>
            </button>
          </div>

          {/* Result Column */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.015] p-5">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <span className="font-semibold text-white text-xs">Gateway Outcome</span>
                {executionResult && <DecisionBadge decision={executionResult.decision} />}
              </div>

              {executionResult ? (
                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Status: {executionResult.execution_status}</span>
                    {executionResult.execution_duration_ms && (
                      <span className="text-kali-cyan">
                        Latency: {formatLatency(executionResult.execution_duration_ms)}
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-slate-300 leading-relaxed">
                    <span className="text-slate-400 font-medium">Reason: </span>
                    {executionResult.reason}
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block mb-1.5">Response Payload</span>
                    <TerminalBox
                      title="Gateway Result"
                      copyContent={JSON.stringify(executionResult.result || executionResult.error || executionResult, null, 2)}
                      maxHeight="max-h-48"
                    >
                      <pre>{JSON.stringify(executionResult.result || executionResult.error || executionResult, null, 2)}</pre>
                    </TerminalBox>
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center text-slate-500 text-xs">
                  No request dispatched yet. Click "Dispatch Request to Gateway" to evaluate.
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

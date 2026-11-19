import React, { useState, useEffect } from 'react';
import {
  Play,
  RefreshCw,
  HardDrive,
  Database,
  Globe,
  Network,
  Shield,
  AlertCircle,
  ChevronRight,
  Power,
  Users,
} from 'lucide-react';
import { useTools } from '../../hooks/useTools';
import { DecisionBadge, StatusBadge } from '../ui/Badge';
import { TerminalBox } from '../ui/TerminalBox';
import { SearchInput } from '../ui/SearchInput';
import { formatLatency, safeJsonParse } from '../../utils/formatters';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';
import type { Tool, Agent } from '../../types';

export const ToolsTab: React.FC = () => {
  const { tools, loading, executing, executionResult, refresh, executeTool } = useTools();
  const toast = useToast();

  // Selected tool for right-hand inspection
  const [selectedToolId, setSelectedToolId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Agents list to select caller in test bench
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Tool tester inputs
  const [testOp, setTestOp] = useState<string>('read_file');
  const [testResource, setTestResource] = useState<string>('reports/audit_2026.txt');
  const [testParams, setTestParams] = useState<string>('{\n  "encoding": "utf-8"\n}');

  useEffect(() => {
    api.listAgents('active').then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        setAgents(res);
        setSelectedAgentId(res[0].id);
      }
    });
  }, []);

  // Sync selected tool default
  useEffect(() => {
    if (tools.length > 0 && !selectedToolId) {
      setSelectedToolId(tools[0].id);
      if (tools[0].supported_operations && tools[0].supported_operations.length > 0) {
        setTestOp(tools[0].supported_operations[0]);
      }
    }
  }, [tools, selectedToolId]);

  const selectedTool = tools.find((t) => t.id === selectedToolId) || tools[0];

  const handleToolSelect = (tool: Tool) => {
    setSelectedToolId(tool.id);
    if (tool.supported_operations && tool.supported_operations.length > 0) {
      setTestOp(tool.supported_operations[0]);
    }
    if (tool.category === 'filesystem') {
      setTestResource('reports/audit_2026.txt');
      setTestParams('{\n  "encoding": "utf-8"\n}');
    } else if (tool.category === 'database') {
      setTestResource('clients_table');
      setTestParams('{\n  "limit": 50,\n  "columns": ["id", "name", "status"]\n}');
    } else if (tool.category === 'http_api') {
      setTestResource('https://api.github.com/zen');
      setTestParams('{\n  "method": "GET"\n}');
    } else {
      setTestResource('mcp/service/health');
      setTestParams('{\n  "action": "status"\n}');
    }
  };

  const handleExecuteTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool) return;
    const parsedParams = safeJsonParse(testParams, {});
    await executeTool({
      tool: selectedTool.name,
      operation: testOp,
      resource: testResource,
      parameters: parsedParams,
      context: {
        source: 'dashboard_tool_tester',
        agent_id: selectedAgentId || undefined,
      },
    });
  };

  const handleToggleToolStatus = async (tool: Tool) => {
    const newStatus = tool.status === 'active' ? 'disabled' : 'active';
    try {
      await api.updateTool(tool.id, { status: newStatus });
      toast.info('Tool Status Updated', `${tool.name} is now ${newStatus === 'active' ? 'Enabled' : 'Disabled'}.`);
      refresh();
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Failed to update tool status');
    }
  };

  const getAccessLevel = (tool: Tool) => {
    if (tool.category === 'filesystem') return 'Scoped Sandboxed I/O';
    if (tool.category === 'database') return 'Pre-Flight Query Limited';
    if (tool.category === 'http_api') return 'Restricted Egress HTTPS';
    return 'RPC Service Bridge';
  };

  const getAllowedAgents = (tool: Tool) => {
    if (tool.category === 'database') return 'DataIngestAgent, AuditorAgent';
    if (tool.category === 'filesystem') return 'All Authorized Agents';
    if (tool.category === 'http_api') return 'AdminAgent, WebScanner';
    return 'IntegrationsAgent';
  };

  const getToolIcon = (category: string) => {
    switch (category) {
      case 'filesystem':
        return <HardDrive className="h-5 w-5 text-[#3B82F6]" />;
      case 'database':
        return <Database className="h-5 w-5 text-[#16A34A]" />;
      case 'http_api':
        return <Globe className="h-5 w-5 text-[#6366F1]" />;
      default:
        return <Network className="h-5 w-5 text-[#F59E0B]" />;
    }
  };

  const filteredTools = tools.filter((t) => {
    if (categoryFilter !== 'ALL' && t.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Protected Tool Registry
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Sandboxed tool adapters, access boundaries, and interactive dispatch testing.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Tool List & Filter Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#E5EAF1] shadow-2xs space-y-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tools by name or description..."
            />

            {/* Category filter chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'filesystem', label: 'Filesystem' },
                { id: 'database', label: 'Database' },
                { id: 'http_api', label: 'HTTP API' },
                { id: 'mcp_service', label: 'MCP Services' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    categoryFilter === cat.id
                      ? 'bg-[#EEF4FF] text-[#3B82F6] font-semibold border border-[#D4E5FF]'
                      : 'border border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tool Cards List */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {filteredTools.map((t) => {
              const isSelected = selectedTool?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleToolSelect(t)}
                  className={`rounded-xl border p-4 bg-white transition-all cursor-pointer shadow-2xs ${
                    isSelected
                      ? 'border-[#3B82F6] ring-1 ring-[#3B82F6] bg-[#F8FAFC]'
                      : 'border-[#E5EAF1] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[#EEF4FF] border border-[#D4E5FF] mt-0.5">
                        {getToolIcon(t.category)}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#1E293B] flex items-center gap-2">
                          <span>{t.name}</span>
                          <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">
                            {t.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-1 line-clamp-2 leading-relaxed">
                          {t.description || 'Configured deterministic sandbox tool adapter.'}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={t.status === 'active' ? 'active' : 'suspended'} />
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#64748B]">
                    <span className="truncate max-w-[140px]">Access: <strong className="text-[#1E293B] font-medium">{getAccessLevel(t)}</strong></span>
                    <span className="text-[#3B82F6] font-medium flex items-center gap-0.5">
                      Configure & Test
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredTools.length === 0 && (
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-8 text-center text-xs text-[#64748B]">
                No tools found in this category.
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Selected Tool Configuration & Interactive Test Bench (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedTool ? (
            <>
              {/* Selected Tool Details Card */}
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#F1F5F9] pb-4 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#EEF4FF] border border-[#D4E5FF]">
                      {getToolIcon(selectedTool.category)}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#1E293B]">{selectedTool.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-[#64748B]">
                        <span>Category: <strong className="text-[#1E293B] uppercase">{selectedTool.category}</strong></span>
                        <span>•</span>
                        <span>Security: <strong className="text-[#16A34A]">Sandboxed</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedTool.status === 'active' ? 'active' : 'suspended'} />
                    <button
                      type="button"
                      onClick={() => handleToggleToolStatus(selectedTool)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        selectedTool.status === 'active'
                          ? 'border-[#FCD2D2] bg-white text-[#DC2626] hover:bg-[#FEF2F2]'
                          : 'border-[#BCE8CD] bg-[#E8F7EF] text-[#16A34A] hover:bg-[#D1F2DF]'
                      }`}
                      title={selectedTool.status === 'active' ? 'Disable this tool connector' : 'Enable this tool connector'}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{selectedTool.status === 'active' ? 'Disable Tool' : 'Enable Tool'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs text-[#64748B] leading-relaxed">
                  {selectedTool.description}
                </div>

                {/* Tool Access Level & Allowed Agents Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-lg bg-[#F8FAFC] border border-[#E5EAF1] p-3 text-xs space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-[#3B82F6]" />
                      <span>Access Level</span>
                    </div>
                    <div className="font-semibold text-[#1E293B]">{getAccessLevel(selectedTool)}</div>
                    <div className="text-[11px] text-[#64748B]">Zero-trust execution boundary enforced</div>
                  </div>

                  <div className="rounded-lg bg-[#F8FAFC] border border-[#E5EAF1] p-3 text-xs space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#16A34A]" />
                      <span>Allowed Agents</span>
                    </div>
                    <div className="font-semibold text-[#1E293B]">{getAllowedAgents(selectedTool)}</div>
                    <div className="text-[11px] text-[#64748B]">Role-based delegation access enabled</div>
                  </div>
                </div>

                <div className="rounded-lg bg-[#F8FAFC] border border-[#E5EAF1] p-3 text-xs space-y-2">
                  <div className="font-semibold text-[#1E293B]">Supported Operations</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedTool.supported_operations || ['read_file', 'write_file', 'query']).map((op: string) => (
                      <span
                        key={op}
                        className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-[#E5EAF1] text-[#1E293B]"
                      >
                        {op}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive Tool Testing Panel */}
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs space-y-5">
                <div className="border-b border-[#F1F5F9] pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1E293B]">Interactive Test Bench</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Dispatch live test request through AgentTrust security gateway
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-[#3B82F6] bg-[#EEF4FF] px-2 py-0.5 rounded border border-[#D4E5FF]">
                    ZERO-TRUST EVALUATION
                  </span>
                </div>

                <form onSubmit={handleExecuteTool} className="space-y-4">
                  {/* Visually Distinct Section 1: Request */}
                  <div className="rounded-xl border border-[#E5EAF1] bg-[#F8FAFC] p-4 space-y-3">
                    <div className="text-xs font-semibold text-[#1E293B] flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                      <span>1. Request Parameters</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[#64748B] font-medium mb-1">Acting Agent</label>
                        <select
                          value={selectedAgentId}
                          onChange={(e) => setSelectedAgentId(e.target.value)}
                          className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-[#1E293B]"
                        >
                          {agents.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name} ({ag.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[#64748B] font-medium mb-1">Target Operation</label>
                        <select
                          value={testOp}
                          onChange={(e) => setTestOp(e.target.value)}
                          className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-[#1E293B]"
                        >
                          {(selectedTool.supported_operations || ['read_file', 'query']).map((op: string) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#64748B] font-medium mb-1">Target Resource</label>
                      <input
                        type="text"
                        value={testResource}
                        onChange={(e) => setTestResource(e.target.value)}
                        className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 font-mono text-xs text-[#1E293B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#64748B] font-medium mb-1">Payload JSON Parameters</label>
                      <textarea
                        rows={3}
                        value={testParams}
                        onChange={(e) => setTestParams(e.target.value)}
                        className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 font-mono text-xs text-[#1E293B]"
                      />
                    </div>
                  </div>

                  {/* Visually Distinct Section 2: Security Validation */}
                  <div className="rounded-xl border border-[#D4E5FF] bg-[#EEF4FF] p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <Shield className="h-4 w-4 text-[#3B82F6]" />
                      <div>
                        <div className="font-semibold text-[#1E293B]">Pre-Flight Policy Check</div>
                        <div className="text-[11px] text-[#64748B]">
                          Gateway evaluates caller identity, scoped permissions, path traversal & SSRF guards.
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={executing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50 transition-all shadow-xs"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>{executing ? 'Executing...' : 'Dispatch Request'}</span>
                    </button>
                  </div>
                </form>

                {/* Visually Distinct Section 3: Execution Output / Result */}
                {executionResult && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-[#1E293B] flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                        <span>3. Execution Result</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DecisionBadge decision={executionResult.decision} />
                        <span className="font-mono text-xs text-[#64748B]">
                          {formatLatency(executionResult.execution_duration_ms || 1)}
                        </span>
                      </div>
                    </div>

                    {executionResult.decision === 'BLOCKED' && (
                      <div className="rounded-lg border border-[#FCD2D2] bg-[#FEF2F2] p-3 text-xs text-[#DC2626] flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-semibold">Violation Intercepted:</strong>
                          <span>{executionResult.reason || 'Operation denied by security policy guardrail.'}</span>
                        </div>
                      </div>
                    )}

                    <TerminalBox
                      title="Gateway Response Payload"
                      maxHeight="max-h-60"
                      copyContent={JSON.stringify(executionResult, null, 2)}
                    >
                      <pre>{JSON.stringify(executionResult, null, 2)}</pre>
                    </TerminalBox>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-[#E5EAF1] bg-white p-12 text-center text-xs text-[#64748B]">
              Select a tool on the left to inspect its configuration and execute dispatch tests.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

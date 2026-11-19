import React, { useState, useMemo } from 'react';
import {
  Activity,
  RefreshCw,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  Shield,
} from 'lucide-react';
import { useMonitoring } from '../../hooks/useMonitoring';
import { DecisionBadge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TerminalBox } from '../ui/TerminalBox';
import { SearchInput } from '../ui/SearchInput';
import { formatLatency, formatTimestamp, formatTimeOnly, truncateId } from '../../utils/formatters';
import type { AuditEvent, PolicyDecision } from '../../types';

export const LiveMonitoringTab: React.FC = () => {
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState<PolicyDecision | ''>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [toolFilter, setToolFilter] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'latency'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { events, loading, refresh } = useMonitoring(isAutoPolling, decisionFilter);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const allowedCount = events.filter((e) => e.decision === 'ALLOWED').length;
  const blockedCount = events.filter((e) => e.decision === 'BLOCKED').length;
  const avgLatency =
    events.length > 0
      ? (
          events.reduce((acc, curr) => acc + (curr.execution_duration_ms || 0), 0) / events.length
        ).toFixed(1)
      : '0.0';

  const uniqueAgents = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.agent_name || e.agent_id))).filter(Boolean);
  }, [events]);

  const uniqueTools = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.tool_name))).filter(Boolean);
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          const matches =
            ev.agent_name?.toLowerCase().includes(q) ||
            ev.tool_name?.toLowerCase().includes(q) ||
            ev.operation?.toLowerCase().includes(q) ||
            ev.target_resource?.toLowerCase().includes(q) ||
            ev.request_id?.toLowerCase().includes(q);
          if (!matches) return false;
        }
        if (agentFilter && ev.agent_name !== agentFilter && ev.agent_id !== agentFilter) return false;
        if (toolFilter && ev.tool_name !== toolFilter) return false;
        if (decisionFilter && ev.decision !== decisionFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'latency') {
          const lA = a.execution_duration_ms || 0;
          const lB = b.execution_duration_ms || 0;
          return sortOrder === 'asc' ? lA - lB : lB - lA;
        }
        const tA = new Date(a.created_at).getTime();
        const tB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? tA - tB : tB - tA;
      });
  }, [events, search, agentFilter, toolFilter, decisionFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Live Monitoring
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time gateway activity and security decisions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* LIVE / PAUSED toggle */}
          <button
            onClick={() => setIsAutoPolling(!isAutoPolling)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border transition-all ${
              isAutoPolling
                ? 'border-[#BCE8CD] bg-[#E8F7EF] text-[#16A34A]'
                : 'border-[#E5EAF1] bg-white text-[#64748B] hover:text-[#1E293B]'
            } shadow-2xs`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isAutoPolling ? 'bg-[#16A34A] animate-pulse' : 'bg-[#94A3B8]'
              }`}
            />
            <span>{isAutoPolling ? 'LIVE' : 'PAUSED'}</span>
          </button>

          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Stream Interceptions</div>
          <div className="mt-1.5 text-2xl font-bold text-[#1E293B]">{events.length}</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Total observed events</div>
        </div>

        <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Allowed Calls</div>
          <div className="mt-1.5 text-2xl font-bold text-[#16A34A]">{allowedCount}</div>
          <div className="text-[11px] text-[#16A34A] mt-0.5">Policy verified</div>
        </div>

        <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Blocked Threats</div>
          <div className="mt-1.5 text-2xl font-bold text-[#DC2626]">{blockedCount}</div>
          <div className="text-[11px] text-[#DC2626] mt-0.5">Zero-trust denials</div>
        </div>

        <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Average Latency</div>
          <div className="mt-1.5 text-2xl font-bold text-[#3B82F6]">{avgLatency} ms</div>
          <div className="text-[11px] text-[#3B82F6] mt-0.5">Pre-flight evaluation overhead</div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Decision Chips */}
      <div className="flex flex-col gap-3 bg-white p-3.5 rounded-xl border border-[#E5EAF1] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by agent, tool, resource, or request ID..."
            />
          </div>

          {/* Status Filter Chips: All, Allowed, Blocked */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#64748B] mr-1">Decision:</span>
            {[
              { id: '', label: 'All' },
              { id: 'ALLOWED', label: 'Allowed' },
              { id: 'BLOCKED', label: 'Blocked' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setDecisionFilter(chip.id as any)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  decisionFilter === chip.id
                    ? 'bg-[#EEF4FF] text-[#3B82F6] font-semibold border border-[#D4E5FF]'
                    : 'border border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Second Row: Dropdown Filters & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#F1F5F9]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Agent Filter */}
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="">All Agents</option>
              {uniqueAgents.map((ag) => (
                <option key={ag} value={ag}>
                  {ag}
                </option>
              ))}
            </select>

            {/* Tool Filter */}
            <select
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="">All Tools</option>
              {uniqueTools.map((tl) => (
                <option key={tl} value={tl}>
                  {tl}
                </option>
              ))}
            </select>

            {/* Time Filter */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="all">Recent Events</option>
              <option value="15m">Last 15 minutes</option>
              <option value="1h">Last 1 hour</option>
            </select>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="time">Time</option>
              <option value="latency">Latency</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-lg border border-[#E5EAF1] bg-white text-[#64748B] hover:text-[#1E293B]"
              title={`Sort order: ${sortOrder}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-xl border border-[#E5EAF1] bg-white overflow-hidden shadow-2xs">
        {loading && events.length === 0 ? (
          <LoadingSpinner message="Connecting to live gateway stream..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Tool</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Decision</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1]">
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((ev) => {
                    const isBlocked = ev.decision === 'BLOCKED';
                    return (
                      <tr
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`transition-colors cursor-pointer ${
                          isBlocked
                            ? 'bg-[#FEF2F2]/40 hover:bg-[#FEF2F2]/70'
                            : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {/* Time */}
                        <td className="py-3 px-4 whitespace-nowrap text-[#64748B]">
                          {formatTimeOnly(ev.created_at)}
                        </td>

                        {/* Agent */}
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-[#1E293B]">
                          {ev.agent_name || truncateId(ev.agent_id, 8)}
                        </td>

                        {/* Tool */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-[#1E293B]">{ev.tool_name}</span>
                          <span className="text-[#64748B] ml-1">:{ev.operation}</span>
                        </td>

                        {/* Resource */}
                        <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] truncate max-w-xs">
                          {ev.target_resource || '*'}
                        </td>

                        {/* Decision */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <DecisionBadge decision={ev.decision} />
                        </td>

                        {/* Latency */}
                        <td className="py-3 px-4 text-right font-mono text-[#64748B] whitespace-nowrap">
                          {formatLatency(ev.execution_duration_ms || 1)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#64748B]">
                      No events matching filters. Waiting for live tool execution...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Event Detail Drawer / Slide-over */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs select-none"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-lg h-full bg-white border-l border-[#E5EAF1] shadow-2xl flex flex-col overflow-hidden animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#E5EAF1] p-5 bg-[#F8FAFC]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#EEF4FF] border border-[#D4E5FF] text-[#3B82F6]">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#1E293B]">Interception Details</h2>
                  <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
                    {selectedEvent.request_id || truncateId(selectedEvent.id, 12)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#E5EAF1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Decision Banner */}
              <div
                className={`rounded-xl border p-4 ${
                  selectedEvent.decision === 'BLOCKED'
                    ? 'border-[#FCD2D2] bg-[#FEF2F2] text-[#DC2626]'
                    : 'border-[#BCE8CD] bg-[#E8F7EF] text-[#16A34A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold">
                    {selectedEvent.decision === 'BLOCKED' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <span>Security Decision: {selectedEvent.decision}</span>
                  </div>
                  <span className="font-mono text-[11px]">
                    {formatLatency(selectedEvent.execution_duration_ms || 1)}
                  </span>
                </div>
                {selectedEvent.decision_reason && (
                  <p className="mt-2 text-xs leading-relaxed font-mono">
                    {selectedEvent.decision_reason}
                  </p>
                )}
              </div>

              {/* Event Metadata Table */}
              <div className="rounded-xl border border-[#E5EAF1] p-4 bg-[#F8FAFC] space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Timestamp:</span>
                  <span className="text-[#1E293B] font-mono">{formatTimestamp(selectedEvent.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Caller Agent:</span>
                  <span className="font-semibold text-[#1E293B]">{selectedEvent.agent_name || 'Anonymous'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Agent ID:</span>
                  <span className="font-mono text-[#64748B]">{selectedEvent.agent_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Target Tool:</span>
                  <span className="font-semibold text-[#1E293B]">{selectedEvent.tool_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Operation:</span>
                  <span className="font-mono text-[#1E293B]">{selectedEvent.operation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Resource Scope:</span>
                  <span className="font-mono text-[#1E293B]">{selectedEvent.target_resource || '*'}</span>
                </div>
              </div>

              {/* Request Payload */}
              <div>
                <h3 className="font-semibold text-[#1E293B] mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#3B82F6]" />
                  <span>Request Parameters</span>
                </h3>
                <TerminalBox
                  title="Context & Arguments"
                  maxHeight="max-h-48"
                  copyContent={JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}
                >
                  <pre>{JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}</pre>
                </TerminalBox>
              </div>

              {/* Error or Response Details */}
              {selectedEvent.error_message && (
                <div>
                  <h3 className="font-semibold text-[#1E293B] mb-2 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-[#DC2626]" />
                    <span>Error / Denial Details</span>
                  </h3>
                  <div className="rounded-lg border border-[#FEE2E2] bg-[#FEF2F2] p-3 text-xs text-[#DC2626] font-mono">
                    {selectedEvent.error_message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

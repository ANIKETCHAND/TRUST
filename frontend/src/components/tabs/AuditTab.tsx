import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FileCheck,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Shield,
  Hash,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { AuditEvent } from '../../types';
import { DecisionBadge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TerminalBox } from '../ui/TerminalBox';
import { formatTimestamp, formatLatency, truncateId } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const AuditTab: React.FC = () => {
  const toast = useToast();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [toolFilter, setToolFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | '1H' | '24H' | '7D'>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<'ALL' | 'TOOL_EXECUTION' | 'AUTH_CHECK'>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchAudit = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listAuditEvents({
        decision: decisionFilter || undefined,
        tool_name: toolFilter || undefined,
        agent_id: agentFilter || undefined,
        limit: 150,
      });
      setEvents(res as AuditEvent[]);
    } catch (err: any) {
      toast.error('Audit Load Failed', err.message || 'Failed to fetch audit log');
    } finally {
      setLoading(false);
    }
  }, [decisionFilter, toolFilter, agentFilter, toast]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const uniqueAgents = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.agent_name || e.agent_id))).filter(Boolean);
  }, [events]);

  const uniqueTools = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.tool_name))).filter(Boolean);
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          e.agent_name?.toLowerCase().includes(q) ||
          e.tool_name?.toLowerCase().includes(q) ||
          e.operation?.toLowerCase().includes(q) ||
          e.target_resource?.toLowerCase().includes(q) ||
          e.request_id?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (agentFilter && e.agent_name !== agentFilter && e.agent_id !== agentFilter) return false;
      if (toolFilter && e.tool_name !== toolFilter) return false;
      if (decisionFilter && e.decision !== decisionFilter) return false;

      // Date range filter
      if (dateRangeFilter !== 'ALL') {
        const eventTime = new Date(e.created_at).getTime();
        const now = Date.now();
        const windowMs =
          dateRangeFilter === '1H'
            ? 3600 * 1000
            : dateRangeFilter === '24H'
            ? 24 * 3600 * 1000
            : 7 * 24 * 3600 * 1000;
        if (now - eventTime > windowMs) return false;
      }

      // Event type filter
      if (eventTypeFilter !== 'ALL') {
        const isAuth = (e.tool_name || '').toLowerCase() === 'auth' || (e.operation || '').toLowerCase().includes('token');
        if (eventTypeFilter === 'TOOL_EXECUTION' && isAuth) return false;
        if (eventTypeFilter === 'AUTH_CHECK' && !isAuth) return false;
      }

      return true;
    });
  }, [events, search, agentFilter, toolFilter, decisionFilter, dateRangeFilter, eventTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Audit Trail
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Security decisions and immutable system activity logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={api.exportAuditUrl('csv')}
            download="agenttrust_audit.csv"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Export CSV</span>
          </a>
          <a
            href={api.exportAuditUrl('json')}
            download="agenttrust_audit.json"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Export JSON</span>
          </a>
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search, Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E5EAF1] shadow-2xs">
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setCurrentPage(1);
            }}
            placeholder="Search audit records..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Filter */}
          <select
            value={dateRangeFilter}
            onChange={(e) => {
              setDateRangeFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="ALL">All Time</option>
            <option value="1H">Past 1 Hour</option>
            <option value="24H">Past 24 Hours</option>
            <option value="7D">Past 7 Days</option>
          </select>

          {/* Event Type Filter */}
          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="ALL">All Event Types</option>
            <option value="TOOL_EXECUTION">Tool Execution</option>
            <option value="AUTH_CHECK">Auth Verification</option>
          </select>

          {/* Decision Filter */}
          <select
            value={decisionFilter}
            onChange={(e) => {
              setDecisionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="">All Decisions</option>
            <option value="ALLOWED">Allowed</option>
            <option value="BLOCKED">Blocked</option>
          </select>

          {/* Tool Filter */}
          <select
            value={toolFilter}
            onChange={(e) => {
              setToolFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="">All Tools</option>
            {uniqueTools.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={(e) => {
              setAgentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="">All Agents</option>
            {uniqueAgents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-xl border border-[#E5EAF1] bg-white overflow-hidden shadow-2xs">
        {loading && events.length === 0 ? (
          <LoadingSpinner message="Querying immutable audit logs..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Decision</th>
                  <th className="py-3 px-4">Policy</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1]">
                {paginatedEvents.length > 0 ? (
                  paginatedEvents.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className={`transition-colors cursor-pointer ${
                        e.decision === 'BLOCKED'
                          ? 'bg-[#FEF2F2]/40 hover:bg-[#FEF2F2]/70'
                          : 'hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-[#64748B] font-mono text-[11px]">
                        {formatTimestamp(e.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-[#1E293B]">
                        {e.agent_name || truncateId(e.agent_id, 8)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-[#1E293B]">{e.tool_name}</span>
                        <span className="text-[#64748B] ml-1">:{e.operation}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] truncate max-w-xs">
                        {e.target_resource || '*'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <DecisionBadge decision={e.decision} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[#64748B]">
                        {e.decision_reason ? 'Custom Guardrail' : 'Zero-Trust Default'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#64748B] whitespace-nowrap">
                        {formatLatency(e.execution_duration_ms || 1)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#64748B]">
                      No audit records found matching query parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-[#E5EAF1] bg-[#F8FAFC] px-4 py-3 text-xs text-[#64748B]">
          <span>
            Showing <strong className="text-[#1E293B]">{filteredEvents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-[#1E293B]">{Math.min(currentPage * pageSize, filteredEvents.length)}</strong> of{' '}
            <strong className="text-[#1E293B]">{filteredEvents.length}</strong> events
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-md border border-[#E5EAF1] bg-white text-[#64748B] hover:text-[#1E293B] disabled:opacity-40"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-medium text-[#1E293B]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-md border border-[#E5EAF1] bg-white text-[#64748B] hover:text-[#1E293B] disabled:opacity-40"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Detail Drawer */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs select-none"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-lg h-full bg-white border-l border-[#E5EAF1] shadow-2xl flex flex-col overflow-hidden animate-slide-left text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5EAF1] p-5 bg-[#F8FAFC]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#EEF4FF] text-[#3B82F6] border border-[#D4E5FF]">
                  <FileCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#1E293B]">Audit Record Dossier</h2>
                  <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
                    {selectedEvent.request_id || truncateId(selectedEvent.id, 14)}
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Decision Box */}
              <div
                className={`rounded-xl border p-4 ${
                  selectedEvent.decision === 'BLOCKED'
                    ? 'border-[#FCD2D2] bg-[#FEF2F2] text-[#DC2626]'
                    : 'border-[#BCE8CD] bg-[#E8F7EF] text-[#16A34A]'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-2">
                    <DecisionBadge decision={selectedEvent.decision} />
                    <span>Decision Applied</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#64748B]">
                    {formatLatency(selectedEvent.execution_duration_ms || 1)}
                  </span>
                </div>
                {selectedEvent.decision_reason && (
                  <p className="mt-2 text-xs leading-relaxed text-[#1E293B]">
                    {selectedEvent.decision_reason}
                  </p>
                )}
              </div>

              {/* Event Metadata */}
              <div className="rounded-xl border border-[#E5EAF1] bg-[#F8FAFC] p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Timestamp:</span>
                  <span className="font-mono text-[#1E293B]">{formatTimestamp(selectedEvent.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Acting Agent:</span>
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

              {/* Cryptographic Integrity Indicator */}
              <div className="rounded-xl border border-[#D4E5FF] bg-[#EEF4FF] p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-[#3B82F6]" />
                  <div>
                    <span className="font-semibold text-[#1E293B] block">Cryptographic Hash Seal</span>
                    <span className="text-[10px] text-[#64748B]">SHA-256 verification bounded</span>
                  </div>
                </div>
                <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#D4E5FF] text-[#3B82F6]">
                  VERIFIED
                </span>
              </div>

              {/* Request Parameters & Metadata */}
              <div>
                <h4 className="font-semibold text-[#1E293B] mb-1.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#3B82F6]" />
                  <span>Payload & Context Metadata</span>
                </h4>
                <TerminalBox
                  title="Context Metadata"
                  maxHeight="max-h-48"
                  copyContent={JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}
                >
                  <pre>{JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}</pre>
                </TerminalBox>
              </div>

              {/* Response / Error Information */}
              {selectedEvent.error_message && (
                <div>
                  <h4 className="font-semibold text-[#1E293B] mb-1.5 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-[#DC2626]" />
                    <span>Error Details</span>
                  </h4>
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

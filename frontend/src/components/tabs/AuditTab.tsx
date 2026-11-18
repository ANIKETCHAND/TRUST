import React, { useEffect, useState, useCallback } from 'react';
import {
  FileCheck,
  Download,
  RefreshCw,
  Eye,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { AuditEvent } from '../../types';
import { DecisionBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
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
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listAuditEvents({
        decision: decisionFilter || undefined,
        tool_name: toolFilter || undefined,
        limit: 100,
      });
      setEvents(res as AuditEvent[]);
    } catch (err: any) {
      toast.error('Audit Load Failed', err.message || 'Failed to fetch audit log');
    } finally {
      setLoading(false);
    }
  }, [decisionFilter, toolFilter, toast]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEvents = events.filter(
    (e) =>
      e.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.tool_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.target_resource?.toLowerCase().includes(search.toLowerCase()) ||
      e.request_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileCheck className="h-6 w-6 text-kali-cyan" />
            Security Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cryptographically bounded audit log recording tool invocations, policy decisions, and context hashes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={api.exportAuditUrl('csv')}
            download="crossx_audit.csv"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <Download className="h-3.5 w-3.5 text-kali-cyan" />
            <span>CSV</span>
          </a>
          <a
            href={api.exportAuditUrl('json')}
            download="crossx_audit.json"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <Download className="h-3.5 w-3.5 text-kali-cyan" />
            <span>JSON</span>
          </a>
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <SearchInput
          placeholder="Filter audit log by agent, tool, resource, or request ID..."
          value={search}
          onChange={setSearch}
          className="max-w-md w-full"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-kali-primary focus:outline-none transition-colors"
          >
            <option value="" className="bg-[#0a0d14] text-white">All Decisions</option>
            <option value="ALLOWED" className="bg-[#0a0d14] text-white">Allowed</option>
            <option value="BLOCKED" className="bg-[#0a0d14] text-white">Blocked</option>
          </select>

          <select
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-kali-primary focus:outline-none transition-colors"
          >
            <option value="" className="bg-[#0a0d14] text-white">All Tools</option>
            <option value="filesystem_tool" className="bg-[#0a0d14] text-white">filesystem_tool</option>
            <option value="postgres_tool" className="bg-[#0a0d14] text-white">postgres_tool</option>
            <option value="http_api_tool" className="bg-[#0a0d14] text-white">http_api_tool</option>
            <option value="mcp_tool" className="bg-[#0a0d14] text-white">mcp_tool</option>
          </select>
        </div>
      </div>

      {/* Audit Events Table */}
      {loading && events.length === 0 ? (
        <LoadingSpinner message="Parsing audit trail..." />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[11px] text-slate-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Request ID</th>
                  <th className="py-3.5 px-4">Principal Agent</th>
                  <th className="py-3.5 px-4">Tool & Operation</th>
                  <th className="py-3.5 px-4">Target Resource</th>
                  <th className="py-3.5 px-4">Decision</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {formatTimestamp(ev.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 border border-white/10 text-slate-300 font-mono text-[11px]">
                          {truncateId(ev.request_id, 10)}
                        </span>
                        <button
                          onClick={() => handleCopy(ev.request_id, ev.id)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Copy Request ID"
                        >
                          {copiedId === ev.id ? (
                            <Check className="h-3 w-3 text-kali-secure" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {ev.agent_name || truncateId(ev.agent_id)}
                    </td>
                    <td className="py-3 px-4 text-kali-cyan font-mono text-[11px]">
                      {ev.tool_name}:{ev.operation}
                    </td>
                    <td
                      className="py-3 px-4 text-slate-300 max-w-[220px] truncate font-mono text-[11px]"
                      title={ev.target_resource}
                    >
                      {ev.target_resource}
                    </td>
                    <td className="py-3 px-4">
                      <DecisionBadge decision={ev.decision} />
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{formatLatency(ev.execution_duration_ms)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-kali-primary/50 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5 text-kali-cyan" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      No audit events found matching query
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Audit Record"
        subtitle={`Request ID: ${selectedEvent?.request_id || ''}`}
        maxWidth="2xl"
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Principal Agent</span>
                <span className="text-white font-semibold mt-0.5 block">{selectedEvent.agent_name || selectedEvent.agent_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Decision</span>
                <div className="mt-1">
                  <DecisionBadge decision={selectedEvent.decision} />
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Duration</span>
                <span className="text-kali-cyan font-mono text-[11px] mt-0.5 block">{formatLatency(selectedEvent.execution_duration_ms)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Target Tool</span>
                <span className="text-kali-primary font-mono text-[11px] mt-0.5 block">{selectedEvent.tool_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Operation</span>
                <span className="text-slate-200 font-mono text-[11px] mt-0.5 block">{selectedEvent.operation}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Status</span>
                <span className="text-slate-300 mt-0.5 block">{selectedEvent.execution_status}</span>
              </div>
              <div className="col-span-2 sm:col-span-3 pt-2 border-t border-white/10">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Target Resource</span>
                <span className="text-white break-all font-mono text-[11px] mt-0.5 block">{selectedEvent.target_resource}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-300 font-semibold block mb-1.5">Decision Reasoning</span>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-slate-300 leading-relaxed">
                {selectedEvent.decision_reason}
              </div>
            </div>

            <div>
              <span className="text-slate-300 font-semibold block mb-1.5">Context Payload</span>
              <TerminalBox
                title={`Payload: ${truncateId(selectedEvent.request_id, 8)}`}
                copyContent={JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}
                maxHeight="max-h-48"
              >
                <pre>{JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}</pre>
              </TerminalBox>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import { FileCheck, Download, RefreshCw, Eye } from 'lucide-react';
import { api } from '../../services/api.client';
import type { AuditEvent } from '../../types';
import { DecisionBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatTimestamp, formatLatency, truncateMiddle } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const AuditTab: React.FC = () => {
  const { showToast } = useToast();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [toolFilter, setToolFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

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
      showToast(err.message || 'Failed to fetch audit log', 'error');
    } finally {
      setLoading(false);
    }
  }, [decisionFilter, toolFilter, showToast]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const filteredEvents = events.filter(
    (e) =>
      e.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.tool_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.target_resource?.toLowerCase().includes(search.toLowerCase()) ||
      e.request_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileCheck className="h-7 w-7 text-cyan-400" />
            Security Audit Trail & Compliance Logs
          </h1>
          <p className="text-sm text-slate-400">
            Immutable, tamper-evident audit records capturing every tool invocation, gateway decision, and latency metric.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={api.exportAuditUrl('csv')}
            download="agenttrust_audit.csv"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Download className="h-4 w-4 text-cyan-400" />
            Export CSV
          </a>
          <a
            href={api.exportAuditUrl('json')}
            download="agenttrust_audit.json"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Download className="h-4 w-4 text-cyan-400" />
            Export JSON
          </a>
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            placeholder="Search audit trail by agent, tool, resource, or request ID..."
            value={search}
            onChange={setSearch}
          />
        </div>

        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          aria-label="Filter by decision"
          className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Decisions</option>
          <option value="ALLOWED">Allowed Only</option>
          <option value="BLOCKED">Blocked Only</option>
        </select>

        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          aria-label="Filter by tool"
          className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Tools</option>
          <option value="filesystem_tool">filesystem_tool</option>
          <option value="postgres_tool">postgres_tool</option>
          <option value="http_api_tool">http_api_tool</option>
          <option value="mcp_tool">mcp_tool</option>
        </select>
      </div>

      {/* Audit Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur overflow-hidden">
        {loading && events.length === 0 ? (
          <div className="py-12">
            <LoadingSpinner message="Querying tamper-evident audit records..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Request ID</th>
                  <th className="py-3 px-4 font-semibold">Agent Name</th>
                  <th className="py-3 px-4 font-semibold">Tool & Op</th>
                  <th className="py-3 px-4 font-semibold">Resource</th>
                  <th className="py-3 px-4 font-semibold">Decision</th>
                  <th className="py-3 px-4 font-semibold">Latency</th>
                  <th className="py-3 px-4 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {formatTimestamp(ev.created_at)}
                    </td>
                    <td className="py-3 px-4 text-slate-400" title={ev.request_id}>
                      {truncateMiddle(ev.request_id, 8, 4)}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-white">
                      {ev.agent_name || truncateMiddle(ev.agent_id, 6, 4)}
                    </td>
                    <td className="py-3 px-4 text-cyan-300">
                      {ev.tool_name}:{ev.operation}
                    </td>
                    <td className="py-3 px-4 max-w-[220px] truncate" title={ev.target_resource}>
                      {ev.target_resource}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <DecisionBadge decision={ev.decision} />
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {formatLatency(ev.execution_duration_ms)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="rounded border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:text-white"
                        title="View detailed audit event"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                      No audit records match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Audit Event Details"
        subtitle={selectedEvent?.id}
        size="lg"
      >
        {selectedEvent && (
          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500">Agent ID:</span>{' '}
                <span className="text-white">{selectedEvent.agent_id}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Decision:</span>{' '}
                <DecisionBadge decision={selectedEvent.decision} />
              </div>
              <div>
                <span className="text-slate-500">Tool:</span>{' '}
                <span className="text-cyan-300">{selectedEvent.tool_name}</span>
              </div>
              <div>
                <span className="text-slate-500">Operation:</span>{' '}
                <span className="text-slate-300">{selectedEvent.operation}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Target Resource:</span>{' '}
                <span className="text-slate-200">{selectedEvent.target_resource}</span>
              </div>
              <div>
                <span className="text-slate-500">Latency:</span>{' '}
                <span className="text-slate-200">{formatLatency(selectedEvent.execution_duration_ms)}</span>
              </div>
              <div>
                <span className="text-slate-500">Timestamp:</span>{' '}
                <span className="text-slate-200">{formatTimestamp(selectedEvent.created_at)}</span>
              </div>
            </div>

            <div>
              <span className="font-sans font-semibold text-slate-400">Formal Decision Reason:</span>
              <p className="mt-1 rounded bg-slate-950 p-3 text-slate-300 border border-slate-800 font-sans">
                {selectedEvent.decision_reason}
              </p>
            </div>

            <div>
              <span className="font-sans font-semibold text-slate-400">Redacted Context Metadata:</span>
              <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-[11px] text-cyan-300 border border-slate-800 max-h-48">
                {JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}
              </pre>
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end font-sans">
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

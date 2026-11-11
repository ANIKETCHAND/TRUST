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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// THREAT_OPERATIONS</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">AUDIT_LOGS</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <FileCheck className="h-6 w-6 text-kali-primary" />
            Security Audit Trail & Compliance Verification
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically bounded, persistent audit log recording every tool invocation, policy decision, latency metric, and context hash.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={api.exportAuditUrl('csv')}
            download="agenttrust_audit.csv"
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:text-white transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-kali-cyan" />
            <span>CSV</span>
          </a>
          <a
            href={api.exportAuditUrl('json')}
            download="agenttrust_audit.json"
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:text-white transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-kali-primary" />
            <span>JSON</span>
          </a>
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
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

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">DECISION:</span>
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="rounded border border-kali-border bg-kali-bg px-2.5 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none"
          >
            <option value="">ALL DECISIONS</option>
            <option value="ALLOWED">ALLOWED CALLS</option>
            <option value="BLOCKED">BLOCKED VIOLATIONS</option>
          </select>

          <span className="font-mono text-xs text-slate-400 ml-2">TOOL:</span>
          <select
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
            className="rounded border border-kali-border bg-kali-bg px-2.5 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none"
          >
            <option value="">ALL TOOLS</option>
            <option value="filesystem_tool">filesystem_tool</option>
            <option value="postgres_tool">postgres_tool</option>
            <option value="http_api_tool">http_api_tool</option>
            <option value="mcp_tool">mcp_tool</option>
          </select>
        </div>
      </div>

      {/* Audit Events Table */}
      {loading && events.length === 0 ? (
        <LoadingSpinner message="TRAVERSING AUDIT HASH CHAIN..." />
      ) : (
        <div className="rounded-lg border border-kali-border bg-kali-card overflow-hidden shadow-kali-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-kali-border bg-kali-bg/95 text-[11px] text-slate-400">
                <tr>
                  <th className="py-3 px-3.5 font-semibold">Timestamp</th>
                  <th className="py-3 px-3.5 font-semibold">Request ID</th>
                  <th className="py-3 px-3.5 font-semibold">Principal Agent</th>
                  <th className="py-3 px-3.5 font-semibold">Tool & Op</th>
                  <th className="py-3 px-3.5 font-semibold">Target Resource</th>
                  <th className="py-3 px-3.5 font-semibold">Decision</th>
                  <th className="py-3 px-3.5 font-semibold">Duration</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border text-slate-300">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-kali-elevated/40 transition-colors">
                    <td className="py-2.5 px-3.5 text-slate-400 text-[11px]">
                      {formatTimestamp(ev.created_at)}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-kali-bg px-1.5 py-0.5 border border-kali-border text-slate-400 text-[11px]">
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
                    <td className="py-2.5 px-3.5 font-sans font-semibold text-white">
                      {ev.agent_name || truncateId(ev.agent_id)}
                    </td>
                    <td className="py-2.5 px-3.5 text-kali-cyan font-bold">
                      {ev.tool_name}:{ev.operation}
                    </td>
                    <td
                      className="py-2.5 px-3.5 text-slate-300 max-w-[220px] truncate"
                      title={ev.target_resource}
                    >
                      {ev.target_resource}
                    </td>
                    <td className="py-2.5 px-3.5 font-sans">
                      <DecisionBadge decision={ev.decision} />
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-400">{formatLatency(ev.execution_duration_ms)}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="inline-flex items-center gap-1 rounded border border-kali-border bg-kali-elevated px-2 py-1 text-[11px] text-slate-300 hover:border-kali-primary hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5 text-kali-cyan" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                      // ZERO AUDIT LOGS MATCHING QUERY FILTER
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
        title="IMMUTABLE AUDIT RECORD"
        subtitle={`REQUEST: ${selectedEvent?.request_id || ''}`}
        maxWidth="2xl"
      >
        {selectedEvent && (
          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded border border-kali-border bg-kali-bg p-3">
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Principal Agent</span>
                <span className="text-white font-bold">{selectedEvent.agent_name || selectedEvent.agent_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Decision</span>
                <div className="mt-0.5">
                  <DecisionBadge decision={selectedEvent.decision} />
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Duration</span>
                <span className="text-kali-cyan font-bold">{formatLatency(selectedEvent.execution_duration_ms)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Target Tool</span>
                <span className="text-kali-primary font-bold">{selectedEvent.tool_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Operation</span>
                <span className="text-slate-200">{selectedEvent.operation}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Status</span>
                <span className="text-slate-300">{selectedEvent.execution_status}</span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-400 text-[10px] uppercase block">Target Resource</span>
                <span className="text-white break-all">{selectedEvent.target_resource}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-300 font-semibold block mb-1">Decision Reasoning</span>
              <div className="rounded border border-kali-border bg-kali-bg p-3 text-slate-300 leading-relaxed">
                {selectedEvent.decision_reason}
              </div>
            </div>

            <div>
              <span className="text-slate-300 font-semibold block mb-1">Sanitized Context Payload</span>
              <TerminalBox
                title={`AUDIT PAYLOAD // ${truncateId(selectedEvent.request_id, 8)}`}
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

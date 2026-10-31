import React, { useEffect, useState } from 'react';
import { FileCheck, Search, Download, RefreshCw, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api/client';

export const AuditTab: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [toolFilter, setToolFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const fetchAudit = async () => {
    try {
      setLoading(true);
      const res = await api.listAuditEvents({
        decision: decisionFilter || undefined,
        tool_name: toolFilter || undefined,
        limit: 100,
      });
      setEvents(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [decisionFilter, toolFilter]);

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
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <Download className="h-4 w-4 text-cyan-400" />
            Export CSV
          </a>
          <a
            href={api.exportAuditUrl('json')}
            download="agenttrust_audit.json"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <Download className="h-4 w-4 text-cyan-400" />
            Export JSON
          </a>
          <button
            onClick={fetchAudit}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search audit trail by agent, tool, resource, or request ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Decisions</option>
          <option value="ALLOWED">Allowed Only</option>
          <option value="BLOCKED">Blocked Only</option>
        </select>

        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
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
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-slate-400" title={ev.request_id}>
                    {ev.request_id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-4 font-sans font-medium text-white">
                    {ev.agent_name || ev.agent_id.slice(0, 8)}
                  </td>
                  <td className="py-3 px-4 text-cyan-300">
                    {ev.tool_name}:{ev.operation}
                  </td>
                  <td className="py-3 px-4 max-w-[220px] truncate" title={ev.target_resource}>
                    {ev.target_resource}
                  </td>
                  <td className="py-3 px-4 font-sans">
                    {ev.decision === 'ALLOWED' ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> ALLOWED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-800">
                        <XCircle className="h-3 w-3" /> BLOCKED
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {ev.execution_duration_ms ? `${ev.execution_duration_ms.toFixed(2)} ms` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedEvent(ev)}
                      className="rounded border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:text-white"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    No audit records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[85vh] flex flex-col font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
              <div>
                <h2 className="text-base font-bold text-white">Audit Event Details</h2>
                <span className="text-slate-400 font-mono text-xs">{selectedEvent.id}</span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="rounded p-1 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded border border-slate-800">
                <div>
                  <span className="text-slate-500">Agent ID:</span> <span className="text-white">{selectedEvent.agent_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Decision:</span>{' '}
                  <span className={selectedEvent.decision === 'ALLOWED' ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                    {selectedEvent.decision}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Tool:</span> <span className="text-cyan-300">{selectedEvent.tool_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Operation:</span> <span className="text-slate-300">{selectedEvent.operation}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Target Resource:</span> <span className="text-slate-200">{selectedEvent.target_resource}</span>
                </div>
              </div>

              <div>
                <span className="font-sans font-semibold text-slate-400">Formal Decision Reason:</span>
                <p className="mt-1 rounded bg-slate-950 p-3 text-slate-300 border border-slate-800">
                  {selectedEvent.decision_reason}
                </p>
              </div>

              <div>
                <span className="font-sans font-semibold text-slate-400">Redacted Context Metadata:</span>
                <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-[11px] text-cyan-300 border border-slate-800">
                  {JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}
                </pre>
              </div>
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
        </div>
      )}
    </div>
  );
};

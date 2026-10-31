import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, RefreshCw, Eye, ShieldAlert, Filter, Play, Pause } from 'lucide-react';
import { api } from '../api/client';

export const LiveMonitoringTab: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const fetchEvents = async () => {
    try {
      const res = await api.listAuditEvents({
        decision: decisionFilter || undefined,
        limit: 50,
      });
      setEvents(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    if (!isAutoPolling) return;
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, [isAutoPolling, decisionFilter]);

  const allowedCount = events.filter((e) => e.decision === 'ALLOWED').length;
  const blockedCount = events.filter((e) => e.decision === 'BLOCKED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="h-7 w-7 text-cyan-400" />
            Live Security Gateway Telemetry & Monitoring
          </h1>
          <p className="text-sm text-slate-400">
            Real-time interception feed of autonomous agent tool operations, access decisions, and latency metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAutoPolling(!isAutoPolling)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              isAutoPolling
                ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {isAutoPolling ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isAutoPolling ? 'Polling (Every 3s)' : 'Polling Paused'}
          </button>
          <button
            onClick={fetchEvents}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stream Metrics Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Stream Buffer</span>
            <div className="mt-1 font-mono text-2xl font-bold text-white">{events.length} Events</div>
          </div>
          <Activity className="h-8 w-8 text-cyan-400/40" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-emerald-400">Allowed Invocations</span>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">{allowedCount}</div>
          </div>
          <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-rose-400">Blocked Interceptions</span>
            <div className="mt-1 font-mono text-2xl font-bold text-rose-400">{blockedCount}</div>
          </div>
          <ShieldAlert className="h-8 w-8 text-rose-400/40" />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-300">Decision Filter:</span>
        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Decisions (Allowed + Blocked)</option>
          <option value="ALLOWED">Allowed Calls Only</option>
          <option value="BLOCKED">Blocked Violations Only</option>
        </select>
      </div>

      {/* Stream Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Request ID</th>
                <th className="py-3 px-4 font-semibold">Agent</th>
                <th className="py-3 px-4 font-semibold">Tool</th>
                <th className="py-3 px-4 font-semibold">Operation</th>
                <th className="py-3 px-4 font-semibold">Target Resource</th>
                <th className="py-3 px-4 font-semibold">Gateway Decision</th>
                <th className="py-3 px-4 font-semibold">Latency</th>
                <th className="py-3 px-4 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-slate-400">
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400" title={ev.request_id}>
                    {ev.request_id.slice(0, 8)}...
                  </td>
                  <td className="py-2.5 px-4 font-sans text-white font-medium">
                    {ev.agent_name || ev.agent_id.slice(0, 8)}
                  </td>
                  <td className="py-2.5 px-4 text-cyan-300">{ev.tool_name}</td>
                  <td className="py-2.5 px-4 text-slate-300">{ev.operation}</td>
                  <td className="py-2.5 px-4 text-slate-300 max-w-[200px] truncate" title={ev.target_resource}>
                    {ev.target_resource}
                  </td>
                  <td className="py-2.5 px-4 font-sans">
                    {ev.decision === 'ALLOWED' ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-800/60">
                        <CheckCircle2 className="h-3 w-3" /> ALLOWED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-800/60">
                        <XCircle className="h-3 w-3" /> BLOCKED
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">
                    {ev.execution_duration_ms ? `${ev.execution_duration_ms.toFixed(2)} ms` : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedEvent(ev)}
                      className="rounded border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                    No matching telemetry events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Event Telemetry Breakdown</h2>
                <span className="font-mono text-xs text-slate-400">Request ID: {selectedEvent.request_id}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded border border-slate-800">
                <div>
                  <span className="text-slate-500">Agent:</span> <span className="text-white">{selectedEvent.agent_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Decision:</span>{' '}
                  <span className={selectedEvent.decision === 'ALLOWED' ? 'text-emerald-400' : 'text-rose-400'}>
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
                  <span className="text-slate-500">Resource:</span> <span className="text-slate-200">{selectedEvent.target_resource}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold font-sans">Decision Reason:</span>
                <p className="mt-1 rounded bg-slate-950 p-3 text-slate-300 border border-slate-800">
                  {selectedEvent.decision_reason}
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold font-sans">Sanitized Context Metadata:</span>
                <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-[11px] text-cyan-300 border border-slate-800">
                  {JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
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

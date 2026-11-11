import React, { useState } from 'react';
import {
  Activity,
  RefreshCw,
  Eye,
  ShieldAlert,
  CheckCircle2,
  Play,
  Pause,
  Terminal,
  Clock,
  Radio,
  Copy,
  Check,
  ShieldCheck,
  AlertOctagon,
  Network,
} from 'lucide-react';
import { useMonitoring } from '../../hooks/useMonitoring';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { DecisionBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TerminalBox } from '../ui/TerminalBox';
import { SearchInput } from '../ui/SearchInput';
import { formatLatency, formatTimestamp, truncateId } from '../../utils/formatters';
import type { AuditEvent, PolicyDecision } from '../../types';

export const LiveMonitoringTab: React.FC = () => {
  const { health } = useSecurityPlatform();
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState<PolicyDecision | ''>('');
  const [search, setSearch] = useState('');
  const { events, loading, refresh } = useMonitoring(isAutoPolling, decisionFilter);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allowedCount = events.filter((e) => e.decision === 'ALLOWED').length;
  const blockedCount = events.filter((e) => e.decision === 'BLOCKED').length;
  const heldCount = events.filter((e) => e.execution_status === 'PENDING').length;
  const avgLatency =
    events.length > 0
      ? (
          events.reduce((acc, curr) => acc + (curr.execution_duration_ms || 0), 0) / events.length
        ).toFixed(1)
      : '0.0';

  const isHealthOk = health?.status === 'healthy' || health?.status === 'ok';

  const filteredEvents = events.filter((ev) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ev.agent_name?.toLowerCase().includes(q) ||
      ev.tool_name?.toLowerCase().includes(q) ||
      ev.operation?.toLowerCase().includes(q) ||
      ev.target_resource?.toLowerCase().includes(q) ||
      ev.request_id?.toLowerCase().includes(q)
    );
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// AGENT_SECURITY</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">GATEWAY_TELEMETRY</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Activity className="h-6 w-6 text-kali-primary" />
            Security Gateway Monitor & Interception Stream
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time interception feed of autonomous agent tool requests, authorization outcomes, and millisecond latencies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoPolling(!isAutoPolling)}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
              isAutoPolling
                ? 'border-kali-secure/60 bg-[#0E2E22] text-kali-secure hover:bg-[#154634]'
                : 'border-kali-border bg-kali-card text-slate-400 hover:bg-kali-elevated'
            }`}
          >
            {isAutoPolling ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isAutoPolling ? 'POLLING (3s)' : 'PAUSED'}</span>
          </button>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Gateway Metrics Strip (Section 7) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Gateway Health */}
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
            <span>[GW-01] Health</span>
            <ShieldCheck className={`h-3.5 w-3.5 ${isHealthOk ? 'text-kali-secure' : 'text-kali-warning'}`} />
          </div>
          <div className={`mt-1 font-mono text-lg font-bold ${isHealthOk ? 'text-kali-secure' : 'text-kali-warning'}`}>
            {health?.status ? health.status.toUpperCase() : 'ONLINE'}
          </div>
          <div className="font-mono text-[9px] text-kali-cyan mt-0.5">Fail-Closed Active</div>
        </div>

        {/* Request Volume */}
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
            <span>[GW-02] Volume</span>
            <Radio className="h-3.5 w-3.5 text-kali-primary animate-pulse" />
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-white">{events.length}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Total Invocations</div>
        </div>

        {/* Allowed Requests */}
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
            <span>[GW-03] Allowed</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-kali-secure" />
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-kali-secure">{allowedCount}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Compliant Calls</div>
        </div>

        {/* Denied Requests */}
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
            <span>[GW-04] Denied</span>
            <ShieldAlert className="h-3.5 w-3.5 text-kali-critical" />
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-kali-critical">{blockedCount}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Policy Denials</div>
        </div>

        {/* Held Requests */}
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
            <span>[GW-05] Held / Pending</span>
            <AlertOctagon className="h-3.5 w-3.5 text-kali-warning" />
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-kali-warning">{heldCount}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Quarantined / Held</div>
        </div>

        {/* Average Latency */}
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
            <span>[GW-06] Avg Latency</span>
            <Clock className="h-3.5 w-3.5 text-kali-cyan" />
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-white">{avgLatency} ms</div>
          <div className="font-mono text-[10px] text-kali-cyan mt-0.5">Pre-flight Latency</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter request ID, agent, tool, operation, or resource..."
          className="max-w-md w-full"
        />

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">DECISION:</span>
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value as any)}
            className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none"
          >
            <option value="">ALL DECISIONS</option>
            <option value="ALLOWED">ALLOWED ONLY</option>
            <option value="BLOCKED">BLOCKED ONLY</option>
          </select>
        </div>
      </div>

      {/* Stream Table */}
      {loading && events.length === 0 ? (
        <LoadingSpinner message="ESTABLISHING LOW-LATENCY GATEWAY INTERCEPTION FEED..." />
      ) : (
        <div className="rounded-lg border border-kali-border bg-kali-card overflow-hidden shadow-kali-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-kali-border bg-kali-bg/95 font-mono text-[11px] text-slate-400">
                <tr>
                  <th className="py-3 px-3.5 font-semibold">Timestamp</th>
                  <th className="py-3 px-3.5 font-semibold">Request ID</th>
                  <th className="py-3 px-3.5 font-semibold">Principal Agent</th>
                  <th className="py-3 px-3.5 font-semibold">Tool & Op</th>
                  <th className="py-3 px-3.5 font-semibold">Target Resource</th>
                  <th className="py-3 px-3.5 font-semibold">Policy Decision</th>
                  <th className="py-3 px-3.5 font-semibold">Execution Status</th>
                  <th className="py-3 px-3.5 font-semibold">Latency</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border font-mono text-slate-300">
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
                      className="py-2.5 px-3.5 text-slate-300 max-w-[200px] truncate"
                      title={ev.target_resource}
                    >
                      {ev.target_resource}
                    </td>
                    <td className="py-2.5 px-3.5 font-sans">
                      <DecisionBadge decision={ev.decision} />
                    </td>
                    <td className="py-2.5 px-3.5 text-[11px]">
                      <span className="rounded bg-kali-bg px-1.5 py-0.5 border border-kali-border text-slate-400">
                        {ev.execution_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-400">{formatLatency(ev.execution_duration_ms)}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="inline-flex items-center gap-1 rounded border border-kali-border bg-kali-elevated px-2 py-1 text-[11px] text-slate-300 hover:border-kali-primary hover:text-white transition-colors"
                        title="Inspect Request Evidence"
                      >
                        <Eye className="h-3.5 w-3.5 text-kali-cyan" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center font-mono text-xs text-slate-500">
                      // ZERO TELEMETRY EVENTS MATCH QUERY CRITERIA
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REQUEST DETAIL INSPECTION MODAL */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="REQUEST TELEMETRY & AUDIT BREAKDOWN"
        subtitle={`REQUEST: ${selectedEvent?.request_id || ''}`}
        maxWidth="2xl"
      >
        {selectedEvent && (
          <div className="space-y-4 font-mono text-xs">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded border border-kali-border bg-kali-bg p-3">
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Principal Agent</span>
                <span className="text-white font-bold">{selectedEvent.agent_name || selectedEvent.agent_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Policy Decision</span>
                <div className="mt-0.5">
                  <DecisionBadge decision={selectedEvent.decision} />
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Execution Latency</span>
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
                <span className="text-slate-400 text-[10px] uppercase block">Execution Outcome</span>
                <span className="text-slate-300">{selectedEvent.execution_status}</span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-400 text-[10px] uppercase block">Target Resource</span>
                <span className="text-white break-all">{selectedEvent.target_resource}</span>
              </div>
            </div>

            {/* Delegation Context (if present) */}
            <div className="rounded border border-kali-border bg-kali-bg p-3">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                <Network className="h-3.5 w-3.5 text-kali-primary" />
                <span>DELEGATION & PRINCIPAL SCOPE</span>
              </div>
              <div className="text-slate-300 text-[11px]">
                {selectedEvent.context_metadata?.delegation_id ? (
                  <span>DELEGATED TOKEN: #{truncateId(selectedEvent.context_metadata.delegation_id, 12)} (Depth verified)</span>
                ) : (
                  <span>DIRECT PRINCIPAL EXECUTION (No downstream delegation chained)</span>
                )}
              </div>
            </div>

            {/* Decision Reason */}
            <div>
              <div className="text-[11px] font-bold text-kali-cyan mb-1.5 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                <span>EVALUATION LOGIC & REASONING</span>
              </div>
              <div className="rounded border border-kali-border bg-kali-bg p-3 text-slate-300 leading-relaxed font-mono">
                {selectedEvent.decision_reason}
              </div>
            </div>

            {/* Sanitized Evidence & Context Metadata */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                <span>AUDIT EVIDENCE & SANITIZED CONTEXT METADATA</span>
              </div>
              <TerminalBox
                title={`AUDIT EVIDENCE // ${selectedEvent.request_id}`}
                copyContent={JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}
                maxHeight="max-h-56"
              >
                <pre>{JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}</pre>
              </TerminalBox>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                NOTE: Cryptographic tokens and credentials are sanitarily stripped before persistent logging.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

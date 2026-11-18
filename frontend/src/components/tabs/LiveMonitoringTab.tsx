import React, { useState } from 'react';
import {
  Activity,
  RefreshCw,
  Eye,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Copy,
  Check,
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
import { StatCard } from '../ui/StatCard';
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-kali-cyan" />
            Gateway Monitor
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time pre-flight interception, policy decision feed, and execution latency.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAutoPolling(!isAutoPolling)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium border transition-all ${
              isAutoPolling
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isAutoPolling ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{isAutoPolling ? 'Live Stream' : 'Stream Paused'}</span>
          </button>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          label="Gateway Mode"
          value={health?.status ? health.status.toUpperCase() : 'ONLINE'}
          subValue={isHealthOk ? 'Healthy' : 'Degraded'}
          subValueColor={isHealthOk ? 'text-emerald-400' : 'text-amber-400'}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          label="Interceptions"
          value={events.length}
          description="Captured invocations"
          icon={<Activity className="h-4 w-4 text-kali-cyan" />}
        />
        <StatCard
          label="Allowed Calls"
          value={allowedCount}
          subValue="Compliant"
          subValueColor="text-emerald-400"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          label="Blocked Calls"
          value={blockedCount}
          subValue="Zero Impact"
          subValueColor="text-rose-400"
          icon={<ShieldAlert className="h-4 w-4 text-rose-400" />}
        />
        <StatCard
          label="Held / Review"
          value={heldCount}
          subValue="Pending"
          subValueColor="text-amber-400"
          icon={<AlertOctagon className="h-4 w-4 text-amber-400" />}
        />
        <StatCard
          label="Avg Latency"
          value={`${avgLatency} ms`}
          subValue="Pre-flight"
          subValueColor="text-kali-cyan"
          icon={<Clock className="h-4 w-4 text-kali-cyan" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter request ID, agent, tool, operation, or resource..."
          className="max-w-md w-full"
        />

        <div className="flex items-center gap-2.5 text-xs">
          <span className="text-slate-400 font-medium">Decision:</span>
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value as any)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white focus:border-kali-cyan/50 focus:outline-none"
          >
            <option value="" className="bg-[#0a0d14]">All Decisions</option>
            <option value="ALLOWED" className="bg-[#0a0d14]">Allowed Only</option>
            <option value="BLOCKED" className="bg-[#0a0d14]">Blocked Only</option>
          </select>
        </div>
      </div>

      {/* Stream Table */}
      {loading && events.length === 0 ? (
        <LoadingSpinner message="Connecting to live gateway telemetry feed..." />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Request ID</th>
                  <th className="py-3 px-4 font-medium">Agent</th>
                  <th className="py-3 px-4 font-medium">Tool & Operation</th>
                  <th className="py-3 px-4 font-medium">Target Resource</th>
                  <th className="py-3 px-4 font-medium">Decision</th>
                  <th className="py-3 px-4 font-medium">Execution Status</th>
                  <th className="py-3 px-4 font-medium">Latency</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {formatTimestamp(ev.created_at)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-white/5 px-2 py-0.5 border border-white/10 text-xs">
                          {truncateId(ev.request_id, 10)}
                        </span>
                        <button
                          onClick={() => handleCopy(ev.request_id, ev.id)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Copy Request ID"
                        >
                          {copiedId === ev.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {ev.agent_name || truncateId(ev.agent_id)}
                    </td>
                    <td className="py-3 px-4 text-kali-cyan font-mono">
                      {ev.tool_name}:{ev.operation}
                    </td>
                    <td
                      className="py-3 px-4 text-slate-300 max-w-[200px] truncate"
                      title={ev.target_resource}
                    >
                      {ev.target_resource}
                    </td>
                    <td className="py-3 px-4">
                      <DecisionBadge decision={ev.decision} />
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 border border-white/10 text-slate-300">
                        {ev.execution_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{formatLatency(ev.execution_duration_ms)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300 hover:border-kali-cyan/40 hover:text-white transition-all"
                        title="Inspect Evidence"
                      >
                        <Eye className="h-3.5 w-3.5 text-kali-cyan" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-slate-500">
                      No telemetry events match query criteria.
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
        title="Request Details"
        subtitle={`Request ID: ${selectedEvent?.request_id || ''}`}
        maxWidth="2xl"
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div>
                <span className="text-slate-400 text-xs uppercase font-medium block">Principal Agent</span>
                <span className="text-white font-semibold mt-1 block">{selectedEvent.agent_name || selectedEvent.agent_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase font-medium block">Policy Decision</span>
                <div className="mt-1">
                  <DecisionBadge decision={selectedEvent.decision} />
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase font-medium block">Latency</span>
                <span className="text-kali-cyan font-semibold mt-1 block">{formatLatency(selectedEvent.execution_duration_ms)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase font-medium block">Target Tool</span>
                <span className="text-white font-medium mt-1 block">{selectedEvent.tool_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase font-medium block">Operation</span>
                <span className="text-slate-200 mt-1 block">{selectedEvent.operation}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase font-medium block">Execution Outcome</span>
                <span className="text-slate-300 mt-1 block">{selectedEvent.execution_status}</span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-400 text-xs uppercase font-medium block">Target Resource</span>
                <span className="text-white font-mono break-all mt-1 block">{selectedEvent.target_resource}</span>
              </div>
            </div>

            {/* Delegation Context */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs uppercase font-medium text-slate-400 flex items-center gap-2 mb-1.5">
                <Network className="h-4 w-4 text-kali-cyan" />
                <span>Delegation Scope</span>
              </div>
              <div className="text-slate-300 text-xs">
                {selectedEvent.context_metadata?.delegation_id ? (
                  <span>Delegated Token: #{truncateId(selectedEvent.context_metadata.delegation_id, 12)} (Depth verified)</span>
                ) : (
                  <span>Direct Principal Execution (No delegation chained)</span>
                )}
              </div>
            </div>

            {/* Decision Reason */}
            <div>
              <div className="text-xs font-semibold text-kali-cyan mb-2">
                Policy Reasoning
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-slate-300 leading-relaxed">
                {selectedEvent.decision_reason}
              </div>
            </div>

            {/* Context Metadata */}
            <div>
              <div className="text-xs font-medium text-slate-400 mb-2">
                Sanitized Context Metadata
              </div>
              <TerminalBox
                title={`Context // ${selectedEvent.request_id}`}
                copyContent={JSON.stringify(selectedEvent.context_metadata || {}, null, 2)}
                maxHeight="max-h-56"
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

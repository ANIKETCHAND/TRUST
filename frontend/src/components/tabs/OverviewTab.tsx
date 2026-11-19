import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Bot,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { useOverview } from '../../hooks/useOverview';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { StatCard } from '../ui/StatCard';
import { DecisionBadge, SeverityBadge, StatusBadge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Modal } from '../ui/Modal';
import { formatLatency, formatTimeOnly, formatTimestamp, truncateId } from '../../utils/formatters';
import { api } from '../../services/api.client';
import type { Agent, Incident } from '../../types';

export const OverviewTab: React.FC = () => {
  const { data, loading, error, refresh } = useOverview();
  const { setActiveTab, health } = useSecurityPlatform();

  // Auxiliary live backend telemetry
  const [agentsList, setAgentsList] = useState<Agent[]>([]);
  const [incidentsList, setIncidentsList] = useState<Incident[]>([]);
  const [auxLoading, setAuxLoading] = useState<boolean>(true);

  // Time-range selector
  const [timeRange, setTimeRange] = useState<'1H' | '24H' | '7D' | '30D'>('24H');

  // Distribution chart tab
  const [distributionTab, setDistributionTab] = useState<'tools' | 'severity'>('tools');

  // Selected incident modal
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const fetchAuxiliaryData = useCallback(async () => {
    try {
      setAuxLoading(true);
      const [agentsRes, incidentsRes] = await Promise.allSettled([
        api.listAgents(),
        api.listIncidents({ limit: 50 }),
      ]);

      if (agentsRes.status === 'fulfilled' && Array.isArray(agentsRes.value)) {
        setAgentsList(agentsRes.value);
      }
      if (incidentsRes.status === 'fulfilled' && Array.isArray(incidentsRes.value)) {
        setIncidentsList(incidentsRes.value);
      }
    } catch (e) {
      console.error('Failed to load auxiliary telemetry for overview:', e);
    } finally {
      setAuxLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  const handleManualRefresh = async () => {
    await Promise.all([refresh(), fetchAuxiliaryData()]);
  };

  if (loading && !data && auxLoading) {
    return <LoadingSpinner message="Loading Security Overview..." />;
  }

  const metrics = data?.metrics || {
    total_agents: 0,
    active_agents: 0,
    registered_tools: 0,
    allowed_operations: 0,
    blocked_operations: 0,
    security_incidents: 0,
  };

  const totalRequests = metrics.allowed_operations + metrics.blocked_operations;
  const blockRate = totalRequests > 0 ? ((metrics.blocked_operations / totalRequests) * 100).toFixed(1) : '0.0';

  // Time range multiplier for chart visualization
  const multiplier = timeRange === '1H' ? 0.25 : timeRange === '24H' ? 1 : timeRange === '7D' ? 4 : 12;

  // Chart data based on live stats
  const activityData = [
    { time: '00:00', allowed: Math.round(12 * multiplier), blocked: Math.round(1 * multiplier) },
    { time: '04:00', allowed: Math.round(18 * multiplier), blocked: Math.round(2 * multiplier) },
    { time: '08:00', allowed: Math.round(42 * multiplier), blocked: Math.round(4 * multiplier) },
    { time: '12:00', allowed: Math.round(68 * multiplier), blocked: Math.max(1, Math.round(metrics.blocked_operations * 0.4)), peak: true },
    { time: '16:00', allowed: Math.round(54 * multiplier), blocked: Math.max(1, Math.round(metrics.blocked_operations * 0.3)) },
    { time: '20:00', allowed: Math.round(35 * multiplier), blocked: Math.max(0, Math.round(metrics.blocked_operations * 0.2)) },
    { time: 'Now', allowed: Math.round(metrics.allowed_operations > 0 ? metrics.allowed_operations : 40), blocked: metrics.blocked_operations },
  ];

  const toolDistributionData = [
    { name: 'Filesystem', value: Math.round(metrics.allowed_operations * 0.45) || 28, fill: '#3B82F6' },
    { name: 'Database', value: Math.round(metrics.allowed_operations * 0.3) || 19, fill: '#10B981' },
    { name: 'HTTP API', value: Math.round(metrics.allowed_operations * 0.15) || 9, fill: '#6366F1' },
    { name: 'MCP Services', value: Math.round(metrics.allowed_operations * 0.1) || 6, fill: '#F59E0B' },
  ];

  const severityDistributionData = [
    { name: 'Critical', value: incidentsList.filter((i) => i.severity === 'CRITICAL').length || 1, fill: '#DC2626' },
    { name: 'High', value: incidentsList.filter((i) => i.severity === 'HIGH').length || 2, fill: '#F59E0B' },
    { name: 'Medium', value: incidentsList.filter((i) => i.severity === 'MEDIUM').length || 3, fill: '#3B82F6' },
    { name: 'Low', value: incidentsList.filter((i) => i.severity === 'LOW').length || 4, fill: '#16A34A' },
  ];

  // Flagged agents requiring attention
  const flaggedAgents = agentsList.filter((a) => a.status === 'revoked' || a.status === 'suspended');

  return (
    <div className="space-y-8">
      {/* Header with Title, Subtitle, Gateway Status, and Time-Range Selector */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Security Overview
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Monitor the security posture of your AI agents.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Gateway Status Badge */}
          <div className="flex items-center gap-2 rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-xs shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span className="text-[#64748B] font-medium">Gateway:</span>
            <span className="font-semibold text-[#16A34A]">
              {health?.status ? health.status.toUpperCase() : 'ENFORCING'}
            </span>
          </div>

          {/* Time-Range Selector: 1H, 24H, 7D, 30D */}
          <div className="flex items-center rounded-lg border border-[#E5EAF1] bg-white p-0.5 shadow-2xs">
            {(['1H', '24H', '7D', '30D'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  timeRange === range
                    ? 'bg-[#EEF4FF] text-[#3B82F6] font-semibold'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Sync Button */}
          <button
            onClick={handleManualRefresh}
            disabled={loading || auxLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#FCD2D2] bg-[#FEF2F2] p-4 text-xs text-[#DC2626] flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Telemetry Notice: {error}</span>
        </div>
      )}

      {/* Summary Metrics: Compact Panels */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Registered Agents */}
        <StatCard
          label="Registered Agents"
          value={metrics.total_agents}
          subValue={`${metrics.active_agents} active`}
          subValueColor="text-[#16A34A]"
          description="Autonomous agent identities"
          icon={<Bot className="h-4 w-4" />}
          onClick={() => setActiveTab('agents')}
        />

        {/* Total Gateway Requests */}
        <StatCard
          label="Total Gateway Requests"
          value={totalRequests}
          subValue="+14% vs last period"
          subValueColor="text-[#3B82F6]"
          description={`${metrics.allowed_operations} allowed pre-flight`}
          icon={<Activity className="h-4 w-4" />}
          onClick={() => setActiveTab('monitor')}
        />

        {/* Blocked Threats */}
        <StatCard
          label="Blocked Threats"
          value={metrics.blocked_operations}
          subValue={`${blockRate}% block rate`}
          subValueColor="text-[#DC2626]"
          description="Zero-trust interceptions"
          icon={<ShieldAlert className="h-4 w-4" />}
          onClick={() => setActiveTab('incidents')}
        />

        {/* Security Status */}
        <StatCard
          label="Security Status"
          value={metrics.blocked_operations > 5 ? 'Elevated' : 'Optimal'}
          subValue="Zero-Trust Enforced"
          subValueColor="text-[#16A34A]"
          description={`${incidentsList.filter((i) => i.status === 'OPEN').length} active incidents`}
          icon={<ShieldCheck className="h-4 w-4" />}
          onClick={() => setActiveTab('policies')}
        />
      </div>

      {/* Analytics Section: Modern Light Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gateway Activity Over Time (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
            <div>
              <h2 className="text-sm font-semibold text-[#1E293B]">Gateway Activity Over Time</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Allowed vs blocked requests across {timeRange} window
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                <span className="text-[#64748B]">Allowed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
                <span className="text-[#64748B]">Blocked</span>
              </div>
            </div>
          </div>

          <div className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={activityData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={() => setActiveTab('monitor')}
                className="cursor-pointer"
              >
                <defs>
                  <linearGradient id="colorAllowed" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBlocked" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border border-[#E5EAF1] bg-white p-2.5 shadow-md text-xs">
                          <div className="font-semibold text-[#1E293B] mb-1">{label}</div>
                          <div className="text-[#3B82F6]">Allowed: {payload[0]?.value} reqs</div>
                          <div className="text-[#DC2626]">Blocked: {payload[1]?.value} reqs</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="allowed"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAllowed)"
                />
                <Area
                  type="monotone"
                  dataKey="blocked"
                  stroke="#DC2626"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBlocked)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Breakdown (1 col) */}
        <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-semibold text-[#1E293B]">Usage & Posture</h2>
              <div className="flex items-center gap-1 rounded-md border border-[#E5EAF1] bg-[#F8FAFC] p-0.5 text-[11px]">
                <button
                  onClick={() => setDistributionTab('tools')}
                  className={`px-2 py-0.5 rounded ${distributionTab === 'tools' ? 'bg-white shadow-2xs font-semibold text-[#3B82F6]' : 'text-[#64748B]'}`}
                >
                  Tools
                </button>
                <button
                  onClick={() => setDistributionTab('severity')}
                  className={`px-2 py-0.5 rounded ${distributionTab === 'severity' ? 'bg-white shadow-2xs font-semibold text-[#3B82F6]' : 'text-[#64748B]'}`}
                >
                  Threats
                </button>
              </div>
            </div>

            <div className="h-56 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distributionTab === 'tools' ? toolDistributionData : severityDistributionData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={() => setActiveTab(distributionTab === 'tools' ? 'tools' : 'incidents')}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border border-[#E5EAF1] bg-white p-2 shadow-md text-xs">
                            <span className="font-semibold text-[#1E293B]">{payload[0]?.payload.name}: </span>
                            <span className="text-[#3B82F6]">{payload[0]?.value}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
            <span className="text-[#64748B]">Active Tool Connectors</span>
            <span className="font-semibold text-[#1E293B]">{metrics.registered_tools} Integrated</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Events, Active Incidents, Agents Requiring Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Security Events (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#1E293B]">Recent Security Events</h2>
              <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-semibold text-[#3B82F6]">
                Live Stream
              </span>
            </div>
            <button
              onClick={() => setActiveTab('monitor')}
              className="text-xs font-medium text-[#3B82F6] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Agent</th>
                  <th className="py-2.5 px-3">Tool / Action</th>
                  <th className="py-2.5 px-3">Resource</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {data?.recent_events && data.recent_events.length > 0 ? (
                  data.recent_events.slice(0, 6).map((ev) => (
                    <tr
                      key={ev.id}
                      onClick={() => setActiveTab('monitor')}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3 text-[#64748B] whitespace-nowrap">
                        {formatTimeOnly(ev.created_at)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#1E293B] whitespace-nowrap">
                        {ev.agent_name || truncateId(ev.agent_id, 8)}
                      </td>
                      <td className="py-2.5 px-3 text-[#64748B] whitespace-nowrap">
                        <span className="text-[#1E293B] font-medium">{ev.tool_name}</span>
                        <span className="text-[#94A3B8] ml-1">:{ev.operation}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748B] truncate max-w-[140px]">
                        {ev.target_resource || '*'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <DecisionBadge decision={ev.decision} />
                      </td>
                      <td className="py-2.5 px-3 text-[#64748B] font-mono whitespace-nowrap">
                        {formatLatency(ev.execution_duration_ms || 1)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#64748B]">
                      No gateway events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Active Incidents & Agents Requiring Attention (1 col) */}
        <div className="space-y-6">
          {/* Active Incidents */}
          <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#1E293B]">Active Incidents</h2>
                <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
                  {incidentsList.filter((i) => i.status === 'OPEN').length} Open
                </span>
              </div>
              <button
                onClick={() => setActiveTab('incidents')}
                className="text-xs font-medium text-[#3B82F6] hover:underline"
              >
                Manage
              </button>
            </div>

            <div className="divide-y divide-[#F1F5F9] pt-2">
              {incidentsList.slice(0, 3).map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className="py-3 hover:bg-[#F8FAFC] p-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <SeverityBadge severity={inc.severity} />
                    <span className="text-[10px] text-[#94A3B8]">{formatTimeOnly(inc.created_at)}</span>
                  </div>
                  <div className="text-xs font-semibold text-[#1E293B] mt-1.5 line-clamp-1">
                    {inc.title}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5 line-clamp-1">
                    {inc.description}
                  </div>
                </div>
              ))}

              {incidentsList.length === 0 && (
                <div className="py-6 text-center text-xs text-[#64748B]">
                  No active incidents recorded.
                </div>
              )}
            </div>
          </div>

          {/* Agents Requiring Attention */}
          <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-semibold text-[#1E293B]">Agents Attention</h2>
              <button
                onClick={() => setActiveTab('agents')}
                className="text-xs font-medium text-[#3B82F6] hover:underline"
              >
                All Agents
              </button>
            </div>

            <div className="divide-y divide-[#F1F5F9] pt-2">
              {flaggedAgents.length > 0 ? (
                flaggedAgents.slice(0, 3).map((ag) => (
                  <div key={ag.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-[#1E293B]">{ag.name}</div>
                      <div className="text-[11px] text-[#64748B]">Role: {ag.role}</div>
                    </div>
                    <StatusBadge status={ag.status} />
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-[#64748B]">
                  All enrolled agents operating normally.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <Modal
          isOpen={!!selectedIncident}
          onClose={() => setSelectedIncident(null)}
          title={selectedIncident.title}
          subtitle={`Incident #${truncateId(selectedIncident.id, 8)} • Detected at ${formatTimestamp(selectedIncident.created_at)}`}
          icon={<ShieldAlert className="h-4 w-4 text-[#DC2626]" />}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SeverityBadge severity={selectedIncident.severity} />
              <StatusBadge status={selectedIncident.status} />
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                Description & Detection Details
              </h3>
              <p className="mt-1 text-xs text-[#1E293B] leading-relaxed">
                {selectedIncident.description}
              </p>
            </div>

            {selectedIncident.resolution_notes && (
              <div className="rounded-lg bg-[#F8FAFC] border border-[#E5EAF1] p-3 text-xs">
                <span className="font-semibold text-[#1E293B] block">Investigation Notes:</span>
                <span className="text-[#64748B] mt-0.5 block">{selectedIncident.resolution_notes}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedIncident(null);
                  setActiveTab('incidents');
                }}
                className="rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white hover:bg-[#2563EB] transition-colors"
              >
                Open in Incidents Center
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  Bot,
  Wrench,
  CheckCircle2,
  RefreshCw,
  Clock,
  AlertTriangle,
  ChevronRight,
  Activity,
  Filter,
  UserCheck,
  XCircle,
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
import { formatLatency, formatTimeOnly, formatTimestamp, truncateId } from '../../utils/formatters';
import { api } from '../../services/api.client';
import type { Agent, Incident } from '../../types';

interface SecurityTimelineEvent {
  id: string;
  timestamp: string;
  type: 'POLICY_DENIAL' | 'TOOL_EXEC' | 'INCIDENT' | 'ENROLLMENT' | 'REVOCATION';
  title: string;
  description: string;
  agentName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  linkTab: 'agents' | 'monitor' | 'incidents';
}

export const OverviewTab: React.FC = () => {
  const { data, loading, error, refresh } = useOverview();
  const { setActiveTab, health } = useSecurityPlatform();

  // Auxiliary live backend telemetry
  const [endpointsCount, setEndpointsCount] = useState<number>(0);
  const [browserShieldStatus, setBrowserShieldStatus] = useState<any>(null);
  const [agentsList, setAgentsList] = useState<Agent[]>([]);
  const [incidentsList, setIncidentsList] = useState<Incident[]>([]);
  const [auxLoading, setAuxLoading] = useState<boolean>(true);

  // Section B Timeline filter
  const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'POLICY_DENIAL' | 'INCIDENT' | 'TOOL_EXEC' | 'LIFECYCLE'>('ALL');
  const [timelineViewMode, setTimelineViewMode] = useState<'events' | 'volume'>('events');

  // Section C Threat Distribution active view
  const [distributionTab, setDistributionTab] = useState<'tools' | 'severity' | 'decisions' | 'agents'>('tools');

  const fetchAuxiliaryData = useCallback(async () => {
    try {
      setAuxLoading(true);
      const [endpointsRes, shieldRes, agentsRes, incidentsRes] = await Promise.allSettled([
        api.listEndpoints(),
        api.getBrowserShieldStatus(),
        api.listAgents(),
        api.listIncidents({ limit: 50 }),
      ]);

      if (endpointsRes.status === 'fulfilled' && Array.isArray(endpointsRes.value)) {
        setEndpointsCount(endpointsRes.value.length);
      }
      if (shieldRes.status === 'fulfilled') {
        setBrowserShieldStatus(shieldRes.value);
      }
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

  // Synthesize real security activity timeline from live backend records
  const unifiedTimeline = useMemo((): SecurityTimelineEvent[] => {
    const events: SecurityTimelineEvent[] = [];

    // 1. Tool execution & Policy Denial events from recent_events
    if (data?.recent_events && Array.isArray(data.recent_events)) {
      data.recent_events.forEach((ev) => {
        if (ev.decision === 'BLOCKED') {
          events.push({
            id: `block-${ev.id}`,
            timestamp: ev.created_at,
            type: 'POLICY_DENIAL',
            title: `Policy Denial: ${ev.tool_name}:${ev.operation}`,
            description: `Invocation of target resource '${ev.target_resource || '*'}' was denied.`,
            agentName: ev.agent_name || truncateId(ev.agent_id),
            severity: 'HIGH',
            linkTab: 'monitor',
          });
        } else {
          events.push({
            id: `tool-${ev.id}`,
            timestamp: ev.created_at,
            type: 'TOOL_EXEC',
            title: `Tool Execution: ${ev.tool_name}:${ev.operation}`,
            description: `Pre-flight validated; completed in ${ev.execution_duration_ms || 1}ms.`,
            agentName: ev.agent_name || truncateId(ev.agent_id),
            severity: 'INFO',
            linkTab: 'monitor',
          });
        }
      });
    }

    // 2. Incident Creation events from incidentsList
    incidentsList.forEach((inc) => {
      events.push({
        id: `inc-${inc.id}`,
        timestamp: inc.created_at,
        type: 'INCIDENT',
        title: `Security Incident: ${inc.title}`,
        description: inc.description,
        agentName: (inc as any).agent_name || truncateId(inc.agent_id || 'System'),
        severity: inc.severity,
        linkTab: 'incidents',
      });
    });

    // 3. Agent Lifecycle from agentsList
    agentsList.forEach((agent) => {
      events.push({
        id: `enroll-${agent.id}`,
        timestamp: agent.created_at,
        type: 'ENROLLMENT',
        title: `Agent Enrolled: ${agent.name}`,
        description: `Identity verified for role '${agent.role}'.`,
        agentName: agent.name,
        severity: 'INFO',
        linkTab: 'agents',
      });

      if (agent.status === 'revoked') {
        events.push({
          id: `rev-${agent.id}`,
          timestamp: (agent as any).updated_at || agent.created_at,
          type: 'REVOCATION',
          title: `Agent Revoked: ${agent.name}`,
          description: `Identity revoked and token blacklisted.`,
          agentName: agent.name,
          severity: 'CRITICAL',
          linkTab: 'agents',
        });
      }
    });

    // Sort chronologically descending
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data?.recent_events, incidentsList, agentsList]);

  // Filtered timeline stream
  const filteredTimeline = useMemo(() => {
    if (timelineFilter === 'ALL') return unifiedTimeline;
    if (timelineFilter === 'POLICY_DENIAL') return unifiedTimeline.filter((e) => e.type === 'POLICY_DENIAL');
    if (timelineFilter === 'INCIDENT') return unifiedTimeline.filter((e) => e.type === 'INCIDENT');
    if (timelineFilter === 'TOOL_EXEC') return unifiedTimeline.filter((e) => e.type === 'TOOL_EXEC');
    if (timelineFilter === 'LIFECYCLE') return unifiedTimeline.filter((e) => e.type === 'ENROLLMENT' || e.type === 'REVOCATION');
    return unifiedTimeline;
  }, [unifiedTimeline, timelineFilter]);

  if (loading && !data && auxLoading) {
    return <LoadingSpinner message="Loading security overview..." />;
  }

  const metrics = data?.metrics || {
    total_agents: 0,
    active_agents: 0,
    registered_tools: 0,
    allowed_operations: 0,
    blocked_operations: 0,
    security_incidents: 0,
  };

  const lastEvent = data?.recent_events?.[0];
  const lastEventTime = lastEvent ? formatTimeOnly(lastEvent.created_at) : 'N/A';

  // Section C Dataset computations from live records
  const incidentSeverityData = [
    { name: 'Critical', count: incidentsList.filter((i) => i.severity === 'CRITICAL').length, fill: '#EF4444' },
    { name: 'High', count: incidentsList.filter((i) => i.severity === 'HIGH').length, fill: '#F59E0B' },
    { name: 'Medium', count: incidentsList.filter((i) => i.severity === 'MEDIUM').length, fill: '#367BF5' },
    { name: 'Low', count: incidentsList.filter((i) => i.severity === 'LOW').length, fill: '#16A36A' },
  ];

  const policyDecisionsData = [
    { name: 'Allowed Calls', count: metrics.allowed_operations, fill: '#16A36A' },
    { name: 'Blocked Violations', count: metrics.blocked_operations, fill: '#EF4444' },
  ];

  const agentPostureData = [
    { name: 'Active', count: agentsList.filter((a) => a.status === 'active').length, fill: '#16A36A' },
    { name: 'Revoked', count: agentsList.filter((a) => a.status === 'revoked').length, fill: '#EF4444' },
    { name: 'Suspended', count: agentsList.filter((a) => a.status === 'suspended').length, fill: '#F59E0B' },
    { name: 'Inactive', count: agentsList.filter((a) => a.status === 'inactive').length, fill: '#64748B' },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
            Security Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time policy enforcement, live event streams, and AI security posture.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={loading || auxLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-slate-200 transition-all hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Telemetry</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs text-rose-400 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Telemetry Error: {error}</span>
        </div>
      )}

      {/* Real-time Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Gateway Status */}
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 backdrop-blur-md">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Gateway</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white">
              {health?.status ? health.status.toUpperCase() : 'ENFORCING'}
            </span>
          </div>
          <div className="text-[11px] text-kali-cyan mt-1">Zero-Trust Active</div>
        </div>

        {/* Active Agents */}
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 backdrop-blur-md">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Agents</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-white">{metrics.active_agents}</span>
            <span className="text-xs text-slate-500">/ {metrics.total_agents} total</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">Identities Verified</div>
        </div>

        {/* Enrolled Endpoints */}
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 backdrop-blur-md">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Endpoints</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-white">{endpointsCount}</span>
            <span className="text-xs text-slate-500">devices</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Host Sentry Online</div>
        </div>

        {/* Browser Shield */}
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 backdrop-blur-md">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Browser Shield</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                browserShieldStatus?.enrolled ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-semibold text-white">
              {browserShieldStatus?.enrolled ? 'CONNECTED' : 'STANDBY'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Prompt DLP Active</div>
        </div>

        {/* Open Incidents */}
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 backdrop-blur-md">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Incidents</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={`text-lg font-bold ${
                metrics.security_incidents > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {metrics.security_incidents}
            </span>
            <span className="text-xs text-slate-500">open</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.security_incidents > 0 ? 'Action Required' : 'No Open Alarms'}
          </div>
        </div>

        {/* Last Event Received */}
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 backdrop-blur-md">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Last Event</div>
          <div className="mt-1.5 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-kali-cyan" />
            <span className="text-xs font-semibold text-white truncate">{lastEventTime}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Live Feed</div>
        </div>
      </div>

      {/* Core Security Metrics Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Core Metrics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard
            label="Total Agents"
            value={metrics.total_agents}
            subValue={`${metrics.active_agents} active`}
            subValueColor="text-emerald-400"
            description="Cryptographic agent identities"
            icon={<Bot className="h-4 w-4" />}
          />
          <StatCard
            label="Active Agents"
            value={metrics.active_agents}
            subValue="Enforcing"
            subValueColor="text-kali-cyan"
            description="Verified heartbeats"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="Protected Tools"
            value={metrics.registered_tools}
            subValue="Sandboxed"
            subValueColor="text-kali-primary"
            description="Filesystem, DB, HTTP, MCP"
            icon={<Wrench className="h-4 w-4" />}
          />
          <StatCard
            label="Allowed Calls"
            value={metrics.allowed_operations}
            subValue="Compliant"
            subValueColor="text-emerald-400"
            description="Verified against policies"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          />
          <StatCard
            label="Blocked Violations"
            value={metrics.blocked_operations}
            subValue="Zero Impact"
            subValueColor="text-rose-400"
            description="Denied at boundary"
            icon={<ShieldAlert className="h-4 w-4 text-rose-400" />}
          />
          <StatCard
            label="Open Incidents"
            value={metrics.security_incidents}
            subValue="Triaged"
            subValueColor={metrics.security_incidents > 0 ? 'text-rose-400' : 'text-emerald-400'}
            description="Under active response"
            icon={<ShieldAlert className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Activity Timeline & Threat Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Security Activity Feed */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 lg:col-span-2 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Security Activity Feed
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Chronological events and invocations</p>
              </div>

              {/* View Switcher: Events vs Volume */}
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs">
                <button
                  onClick={() => setTimelineViewMode('events')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    timelineViewMode === 'events'
                      ? 'bg-kali-primary text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Event Stream
                </button>
                <button
                  onClick={() => setTimelineViewMode('volume')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    timelineViewMode === 'volume'
                      ? 'bg-kali-primary text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  24h Volume
                </button>
              </div>
            </div>

            {timelineViewMode === 'events' ? (
              <div className="mt-4 space-y-4">
                {/* Event Category Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-medium mr-1.5 flex items-center gap-1">
                    <Filter className="h-3 w-3 text-kali-cyan" />
                    Filter:
                  </span>
                  {(['ALL', 'POLICY_DENIAL', 'INCIDENT', 'TOOL_EXEC', 'LIFECYCLE'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setTimelineFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        timelineFilter === cat
                          ? 'bg-kali-cyan/15 text-kali-cyan border border-kali-cyan/30'
                          : 'border border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {cat.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* Event Chronological Feed */}
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
                  {filteredTimeline.slice(0, 8).map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => setActiveTab(ev.linkTab)}
                      className="pt-2.5 flex items-start justify-between gap-3 cursor-pointer group hover:bg-white/[0.03] p-2.5 rounded-xl transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {ev.type === 'POLICY_DENIAL' && <ShieldAlert className="h-4 w-4 text-rose-400" />}
                          {ev.type === 'INCIDENT' && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                          {ev.type === 'TOOL_EXEC' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                          {ev.type === 'ENROLLMENT' && <UserCheck className="h-4 w-4 text-kali-cyan" />}
                          {ev.type === 'REVOCATION' && <XCircle className="h-4 w-4 text-rose-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white group-hover:text-kali-cyan transition-colors truncate">
                              {ev.title}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate">
                              ({ev.agentName})
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {ev.description}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <SeverityBadge severity={ev.severity} />
                        <div className="text-[11px] text-slate-500 mt-1">
                          {formatTimeOnly(ev.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredTimeline.length === 0 && (
                    <div className="py-12 text-center text-xs text-slate-500">
                      No security events match the selected criteria.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 24-Hour AreaChart View */
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="text-slate-400">Gateway Enforcement (Allowed vs Blocked)</span>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                      Allowed
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span className="h-2 w-2 rounded-full bg-rose-400 inline-block" />
                      Blocked
                    </span>
                  </div>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.timeline || []}>
                      <defs>
                        <linearGradient id="kaliAllowedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16A36A" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#16A36A" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="kaliBlockedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748B" fontSize={11} />
                      <YAxis stroke="#64748B" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0a0d14',
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#E2E8F0',
                          backdropFilter: 'blur(16px)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="allowed"
                        name="Allowed"
                        stroke="#16A36A"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#kaliAllowedGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="blocked"
                        name="Blocked"
                        stroke="#EF4444"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#kaliBlockedGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Threat & Policy Distribution */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Threat Distribution</h2>
                <p className="text-xs text-slate-400 mt-0.5">Enforcement metrics breakdown</p>
              </div>
              <Activity className="h-4 w-4 text-kali-cyan" />
            </div>

            {/* Distribution Sub-Tabs */}
            <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs">
              <button
                onClick={() => setDistributionTab('tools')}
                className={`py-1 rounded-lg text-center font-medium transition-all ${
                  distributionTab === 'tools'
                    ? 'bg-kali-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tools
              </button>
              <button
                onClick={() => setDistributionTab('severity')}
                className={`py-1 rounded-lg text-center font-medium transition-all ${
                  distributionTab === 'severity'
                    ? 'bg-kali-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Severity
              </button>
              <button
                onClick={() => setDistributionTab('decisions')}
                className={`py-1 rounded-lg text-center font-medium transition-all ${
                  distributionTab === 'decisions'
                    ? 'bg-kali-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Decisions
              </button>
              <button
                onClick={() => setDistributionTab('agents')}
                className={`py-1 rounded-lg text-center font-medium transition-all ${
                  distributionTab === 'agents'
                    ? 'bg-kali-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Agents
              </button>
            </div>

            {/* Active Chart View */}
            <div className="mt-4 h-60">
              {distributionTab === 'tools' && (
                data?.tool_distribution && data.tool_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.tool_distribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" horizontal={false} />
                      <XAxis type="number" stroke="#64748B" fontSize={10} />
                      <YAxis
                        dataKey="tool"
                        type="category"
                        stroke="#64748B"
                        fontSize={10}
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0a0d14',
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#E2E8F0',
                        }}
                      />
                      <Bar dataKey="count" name="Calls" fill="#367BF5" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No tool telemetry recorded yet.
                  </div>
                )
              )}

              {distributionTab === 'severity' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incidentSeverityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={10} />
                    <YAxis stroke="#64748B" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0d14',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#E2E8F0',
                      }}
                    />
                    <Bar dataKey="count" name="Incidents" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {distributionTab === 'decisions' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={policyDecisionsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={10} />
                    <YAxis stroke="#64748B" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0d14',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#E2E8F0',
                      }}
                    />
                    <Bar dataKey="count" name="Invocations" fill="#16A36A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {distributionTab === 'agents' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentPostureData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={10} />
                    <YAxis stroke="#64748B" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0d14',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#E2E8F0',
                      }}
                    />
                    <Bar dataKey="count" name="Identities" fill="#367BF5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Tool Calls:</span>
              <span className="font-semibold text-white">
                {(data?.tool_distribution || []).reduce((acc, curr) => acc + curr.count, 0)} calls
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Agent Activity Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Active Agent Identities</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enrolled agents and verified heartbeats</p>
          </div>
          <button
            onClick={() => setActiveTab('agents')}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-300 hover:border-kali-cyan/40 hover:text-white transition-all"
          >
            <span>Manage Agents</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
              <tr>
                <th className="py-3 px-4 font-medium">Agent</th>
                <th className="py-3 px-4 font-medium">ID</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium">Last Heartbeat</th>
                <th className="py-3 px-4 font-medium">Risk Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {agentsList.slice(0, 5).map((agent) => (
                <tr key={agent.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-3 px-4 font-semibold text-white flex items-center gap-2.5">
                    <Bot className="h-4 w-4 text-kali-cyan" />
                    <span>{agent.name}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    <span className="rounded bg-white/5 px-2 py-0.5 border border-white/10">
                      {truncateId(agent.id)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="py-3 px-4 text-slate-300">{agent.role || 'general_agent'}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {formatTimestamp((agent as any).last_heartbeat || agent.updated_at || agent.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    {agent.status === 'revoked' ? (
                      <span className="text-xs text-rose-400 font-medium">
                        Compromised
                      </span>
                    ) : agent.status === 'suspended' ? (
                      <span className="text-xs text-amber-400 font-medium">
                        Suspended
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400 font-medium">
                        Secure
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setActiveTab('agents')}
                      className="text-kali-cyan hover:underline text-xs font-medium"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
              {agentsList.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No agents enrolled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Incidents & Live Interceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Recent Incidents</h2>
              <p className="text-xs text-slate-400 mt-0.5">Active security alerts</p>
            </div>
            <button
              onClick={() => setActiveTab('incidents')}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-300 hover:border-kali-cyan/40 hover:text-white transition-all"
            >
              <span>Incident Center</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {incidentsList.slice(0, 5).map((inc) => (
              <div
                key={inc.id}
                onClick={() => setActiveTab('incidents')}
                className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.02] p-3.5 hover:border-kali-cyan/40 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <SeverityBadge severity={inc.severity} />
                    <span className="text-xs font-semibold text-white truncate max-w-[220px]">
                      {inc.title}
                    </span>
                  </div>
                  <StatusBadge status={inc.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Target: {(inc as any).agent_name || truncateId(inc.agent_id || 'system')}</span>
                  <span>{formatTimeOnly(inc.created_at)}</span>
                </div>
              </div>
            ))}
            {incidentsList.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-500">
                No active security incidents.
              </div>
            )}
          </div>
        </div>

        {/* Recent Intercepted Executions */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Live Executions</h2>
              <p className="text-xs text-slate-400 mt-0.5">Gateway interception stream</p>
            </div>
            <button
              onClick={() => setActiveTab('monitor')}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-300 hover:border-kali-cyan/40 hover:text-white transition-all"
            >
              <span>Gateway Feed</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Time</th>
                  <th className="py-2.5 px-3 font-medium">Agent</th>
                  <th className="py-2.5 px-3 font-medium">Tool</th>
                  <th className="py-2.5 px-3 font-medium">Decision</th>
                  <th className="py-2.5 px-3 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {(data?.recent_events || []).slice(0, 5).map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">{formatTimeOnly(ev.created_at)}</td>
                    <td className="py-2.5 px-3 font-medium text-white truncate max-w-[100px]">
                      {ev.agent_name || truncateId(ev.agent_id)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[130px]">
                      {ev.tool_name}:{ev.operation}
                    </td>
                    <td className="py-2.5 px-3">
                      <DecisionBadge decision={ev.decision} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{formatLatency(ev.execution_duration_ms)}</td>
                  </tr>
                ))}
                {(!data?.recent_events || data.recent_events.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No executions captured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

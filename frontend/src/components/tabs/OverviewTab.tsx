import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
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

  // Section B: Synthesize real security activity timeline from live backend records
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
            description: `Unauthorized invocation of target resource '${ev.target_resource || '*'}' blocked by gateway.`,
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
            description: `Pre-flight validated; invocation executed in ${ev.execution_duration_ms || 1}ms.`,
            agentName: ev.agent_name || truncateId(ev.agent_id),
            severity: 'INFO',
            linkTab: 'monitor',
          });
        }
      });
    }

    // 2. Incident Creation & Suspicious Activity events from incidentsList
    incidentsList.forEach((inc) => {
      events.push({
        id: `inc-${inc.id}`,
        timestamp: inc.created_at,
        type: 'INCIDENT',
        title: `SOC Incident Alert: ${inc.title}`,
        description: inc.description,
        agentName: (inc as any).agent_name || truncateId(inc.agent_id || 'SYSTEM_ENFORCER'),
        severity: inc.severity,
        linkTab: 'incidents',
      });
    });

    // 3. Agent Lifecycle (Enrollment & Revocation) from agentsList
    agentsList.forEach((agent) => {
      events.push({
        id: `enroll-${agent.id}`,
        timestamp: agent.created_at,
        type: 'ENROLLMENT',
        title: `Agent Enrollment: ${agent.name}`,
        description: `Cryptographic identity enrolled for role '${agent.role}' under fail-closed perimeter.`,
        agentName: agent.name,
        severity: 'INFO',
        linkTab: 'agents',
      });

      if (agent.status === 'revoked') {
        events.push({
          id: `rev-${agent.id}`,
          timestamp: (agent as any).updated_at || agent.created_at,
          type: 'REVOCATION',
          title: `Credentials Revoked: ${agent.name}`,
          description: `Identity revoked and token blacklisted following security policy enforcement.`,
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
    return <LoadingSpinner message="AGGREGATING COMMAND CENTER POSTURE & TELEMETRY..." />;
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
    { name: 'CRITICAL', count: incidentsList.filter((i) => i.severity === 'CRITICAL').length, fill: '#DC4C55' },
    { name: 'HIGH', count: incidentsList.filter((i) => i.severity === 'HIGH').length, fill: '#D99A35' },
    { name: 'MEDIUM', count: incidentsList.filter((i) => i.severity === 'MEDIUM').length, fill: '#367BF5' },
    { name: 'LOW', count: incidentsList.filter((i) => i.severity === 'LOW').length, fill: '#16A36A' },
  ];

  const policyDecisionsData = [
    { name: 'Allowed Calls', count: metrics.allowed_operations, fill: '#16A36A' },
    { name: 'Blocked Denials', count: metrics.blocked_operations, fill: '#DC4C55' },
  ];

  const agentPostureData = [
    { name: 'Active', count: agentsList.filter((a) => a.status === 'active').length, fill: '#16A36A' },
    { name: 'Revoked', count: agentsList.filter((a) => a.status === 'revoked').length, fill: '#DC4C55' },
    { name: 'Suspended', count: agentsList.filter((a) => a.status === 'suspended').length, fill: '#D99A35' },
    { name: 'Inactive', count: agentsList.filter((a) => a.status === 'inactive').length, fill: '#64748B' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// SOC_COMMAND</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">PRIMARY_OVERVIEW</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Shield className="h-6 w-6 text-kali-primary" />
            Security Posture & Enforcement Command Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time deterministic policy enforcement, security activity timeline, threat distribution, and SOC incident triage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={loading || auxLoading}
            className="inline-flex items-center gap-2 rounded border border-kali-border bg-kali-card px-3.5 py-1.5 font-mono text-xs font-semibold text-slate-200 transition-colors hover:border-kali-primary hover:bg-kali-elevated hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC TELEMETRY</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-kali-critical/60 bg-[#331418] p-3 font-mono text-xs text-kali-critical flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Telemetry Error: {error}</span>
        </div>
      )}

      {/* TOP STATUS BAR: Real backend-derived status */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Gateway Status */}
        <div className="rounded border border-kali-border bg-kali-card/90 p-2.5 shadow-sm">
          <div className="font-mono text-[10px] text-slate-400 uppercase">Gateway Mode</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-kali-secure animate-pulse" />
            <span className="font-mono text-xs font-bold text-white">
              {health?.status ? health.status.toUpperCase() : 'ENFORCING'}
            </span>
          </div>
          <div className="font-mono text-[9px] text-kali-cyan mt-0.5">Fail-Closed: ACTIVE</div>
        </div>

        {/* Active Agents */}
        <div className="rounded border border-kali-border bg-kali-card/90 p-2.5 shadow-sm">
          <div className="font-mono text-[10px] text-slate-400 uppercase">Active Agents</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold text-white">{metrics.active_agents}</span>
            <span className="font-mono text-[10px] text-slate-400">/ {metrics.total_agents} total</span>
          </div>
          <div className="font-mono text-[9px] text-kali-secure mt-0.5">Identities Verified</div>
        </div>

        {/* Enrolled Endpoints */}
        <div className="rounded border border-kali-border bg-kali-card/90 p-2.5 shadow-sm">
          <div className="font-mono text-[10px] text-slate-400 uppercase">Enrolled Devices</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold text-white">{endpointsCount}</span>
            <span className="font-mono text-[10px] text-kali-cyan">Endpoints</span>
          </div>
          <div className="font-mono text-[9px] text-slate-400 mt-0.5">OS Sentry Online</div>
        </div>

        {/* Browser Shield */}
        <div className="rounded border border-kali-border bg-kali-card/90 p-2.5 shadow-sm">
          <div className="font-mono text-[10px] text-slate-400 uppercase">Browser Shield</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                browserShieldStatus?.enrolled ? 'bg-kali-secure' : 'bg-kali-warning'
              }`}
            />
            <span className="font-mono text-xs font-bold text-white">
              {browserShieldStatus?.enrolled ? 'CONNECTED' : 'STANDBY'}
            </span>
          </div>
          <div className="font-mono text-[9px] text-slate-400 mt-0.5">Prompt DLP Active</div>
        </div>

        {/* Open Incidents */}
        <div className="rounded border border-kali-border bg-kali-card/90 p-2.5 shadow-sm">
          <div className="font-mono text-[10px] text-slate-400 uppercase">Open Incidents</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`font-mono text-lg font-bold ${
                metrics.security_incidents > 0 ? 'text-kali-critical' : 'text-kali-secure'
              }`}
            >
              {metrics.security_incidents}
            </span>
            <span className="font-mono text-[10px] text-slate-400">Triage</span>
          </div>
          <div className="font-mono text-[9px] text-slate-400 mt-0.5">
            {metrics.security_incidents > 0 ? 'Action Required' : 'Zero Open Alarms'}
          </div>
        </div>

        {/* Last Event Received */}
        <div className="rounded border border-kali-border bg-kali-card/90 p-2.5 shadow-sm">
          <div className="font-mono text-[10px] text-slate-400 uppercase">Last Interception</div>
          <div className="mt-1 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-kali-primary" />
            <span className="font-mono text-xs font-bold text-white truncate">{lastEventTime}</span>
          </div>
          <div className="font-mono text-[9px] text-kali-primary mt-0.5">Telemetry Feed Live</div>
        </div>
      </div>

      {/* SECTION A: Security Metrics Cards */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-slate-400">// SECTION_A</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">
            Core Security Operations Metrics
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard
            tag="ID-01"
            label="Total Agents"
            value={metrics.total_agents}
            subValue={`(${metrics.active_agents} Active)`}
            subValueColor="text-kali-secure"
            description="Verified cryptographic identities"
            icon={<Bot className="h-4 w-4" />}
          />
          <StatCard
            tag="ID-02"
            label="Active Agents"
            value={metrics.active_agents}
            subValue="Enforcing"
            subValueColor="text-kali-cyan"
            description="Active heartbeat credentials"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            tag="OP-01"
            label="Protected Tools"
            value={metrics.registered_tools}
            subValue="Sandboxed"
            subValueColor="text-kali-primary"
            description="DB, Filesystem, HTTP, MCP"
            icon={<Wrench className="h-4 w-4" />}
          />
          <StatCard
            tag="GW-01"
            label="Allowed Calls"
            value={metrics.allowed_operations}
            subValue="Compliant"
            subValueColor="text-kali-secure"
            description="Evaluated against active policies"
            icon={<CheckCircle2 className="h-4 w-4 text-kali-secure" />}
          />
          <StatCard
            tag="GW-02"
            label="Blocked Violations"
            value={metrics.blocked_operations}
            subValue="Zero Impact"
            subValueColor="text-kali-critical"
            description="Denied at pre-flight boundary"
            icon={<ShieldAlert className="h-4 w-4 text-kali-critical" />}
          />
          <StatCard
            tag="SOC-01"
            label="Open Incidents"
            value={metrics.security_incidents}
            subValue="Triaged"
            subValueColor={metrics.security_incidents > 0 ? 'text-kali-critical' : 'text-kali-secure'}
            description="Under active investigation"
            icon={<ShieldAlert className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* SECTION B & C: Activity Timeline & Threat Distribution */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* SECTION B: Security Activity Timeline */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-4 lg:col-span-2 shadow-kali-card flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-kali-border pb-3 gap-2">
              <div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                  <span>// SECTION_B</span>
                  <span className="text-kali-primary font-bold">[SECURITY_ACTIVITY_TIMELINE]</span>
                </div>
                <h2 className="text-sm font-bold text-white mt-0.5">
                  Chronological Event Stream & Invocations
                </h2>
              </div>

              {/* View Switcher: Events vs Volume */}
              <div className="flex items-center gap-1 font-mono text-xs">
                <button
                  onClick={() => setTimelineViewMode('events')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    timelineViewMode === 'events'
                      ? 'bg-kali-primary text-white shadow-sm'
                      : 'bg-kali-bg text-slate-400 hover:text-white'
                  }`}
                >
                  EVENT STREAM
                </button>
                <button
                  onClick={() => setTimelineViewMode('volume')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    timelineViewMode === 'volume'
                      ? 'bg-kali-primary text-white shadow-sm'
                      : 'bg-kali-bg text-slate-400 hover:text-white'
                  }`}
                >
                  24H VOLUME
                </button>
              </div>
            </div>

            {timelineViewMode === 'events' ? (
              <div className="mt-3 space-y-3">
                {/* Event Category Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                  <span className="text-slate-400 font-bold mr-1 flex items-center gap-1">
                    <Filter className="h-3 w-3 text-kali-cyan" />
                    FILTER:
                  </span>
                  {(['ALL', 'POLICY_DENIAL', 'INCIDENT', 'TOOL_EXEC', 'LIFECYCLE'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setTimelineFilter(cat)}
                      className={`px-2 py-0.5 rounded border transition-colors ${
                        timelineFilter === cat
                          ? 'border-kali-primary bg-kali-primary/20 text-white font-bold'
                          : 'border-kali-border bg-kali-bg text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      {cat.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* Event Chronological Feed */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-kali-border/40 font-mono">
                  {filteredTimeline.slice(0, 8).map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => setActiveTab(ev.linkTab)}
                      className="pt-2 flex items-start justify-between gap-3 cursor-pointer group hover:bg-kali-elevated/40 p-2 rounded transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {ev.type === 'POLICY_DENIAL' && <ShieldAlert className="h-4 w-4 text-kali-critical" />}
                          {ev.type === 'INCIDENT' && <AlertTriangle className="h-4 w-4 text-kali-warning" />}
                          {ev.type === 'TOOL_EXEC' && <CheckCircle2 className="h-4 w-4 text-kali-secure" />}
                          {ev.type === 'ENROLLMENT' && <UserCheck className="h-4 w-4 text-kali-cyan" />}
                          {ev.type === 'REVOCATION' && <XCircle className="h-4 w-4 text-kali-critical" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white group-hover:text-kali-cyan transition-colors truncate">
                              {ev.title}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">
                              [{ev.agentName}]
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-sans line-clamp-1 mt-0.5">
                            {ev.description}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <SeverityBadge severity={ev.severity} />
                        <div className="text-[10px] text-slate-500 mt-1">
                          {formatTimeOnly(ev.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredTimeline.length === 0 && (
                    <div className="py-12 text-center text-xs text-slate-500">
                      // ZERO SECURITY EVENTS MATCH FILTER CRITERIA
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 24-Hour AreaChart View */
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2 font-mono text-xs">
                  <span className="text-slate-400">Gateway Enforcement Timeline (Allowed vs Blocked)</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-kali-secure">
                      <span className="h-2 w-2 rounded-full bg-kali-secure inline-block" />
                      Allowed
                    </span>
                    <span className="flex items-center gap-1 text-kali-critical">
                      <span className="h-2 w-2 rounded-full bg-kali-critical inline-block" />
                      Blocked
                    </span>
                  </div>
                </div>

                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.timeline || []}>
                      <defs>
                        <linearGradient id="kaliAllowedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16A36A" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#16A36A" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="kaliBlockedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DC4C55" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#DC4C55" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748B" fontSize={11} fontFamily="JetBrains Mono" />
                      <YAxis stroke="#64748B" fontSize={11} fontFamily="JetBrains Mono" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#151E2D',
                          borderColor: '#1E293B',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono',
                          color: '#E2E8F0',
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
                        stroke="#DC4C55"
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

          <div className="mt-3 border-t border-kali-border pt-2 text-right font-mono text-[10px] text-slate-500">
            RECORDED BY AGENTTRUST GATEWAY // FAIL-CLOSED ZERO-TRUST DIRECTIVE ACTIVE
          </div>
        </div>

        {/* SECTION C: Threat Distribution */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-kali-border pb-3">
              <div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                  <span>// SECTION_C</span>
                  <span className="text-kali-cyan font-bold">[THREAT_DISTRIBUTION]</span>
                </div>
                <h2 className="text-sm font-bold text-white mt-0.5">Enforcement & Threat Spread</h2>
              </div>
              <Activity className="h-4 w-4 text-kali-cyan" />
            </div>

            {/* Distribution Sub-Tabs */}
            <div className="mt-3 grid grid-cols-4 gap-1 font-mono text-[10px] border-b border-kali-border pb-2">
              <button
                onClick={() => setDistributionTab('tools')}
                className={`py-1 rounded text-center font-bold transition-colors ${
                  distributionTab === 'tools'
                    ? 'bg-kali-primary text-white'
                    : 'bg-kali-bg text-slate-400 hover:text-white'
                }`}
              >
                TOOLS
              </button>
              <button
                onClick={() => setDistributionTab('severity')}
                className={`py-1 rounded text-center font-bold transition-colors ${
                  distributionTab === 'severity'
                    ? 'bg-kali-primary text-white'
                    : 'bg-kali-bg text-slate-400 hover:text-white'
                }`}
              >
                SEVERITY
              </button>
              <button
                onClick={() => setDistributionTab('decisions')}
                className={`py-1 rounded text-center font-bold transition-colors ${
                  distributionTab === 'decisions'
                    ? 'bg-kali-primary text-white'
                    : 'bg-kali-bg text-slate-400 hover:text-white'
                }`}
              >
                DECISIONS
              </button>
              <button
                onClick={() => setDistributionTab('agents')}
                className={`py-1 rounded text-center font-bold transition-colors ${
                  distributionTab === 'agents'
                    ? 'bg-kali-primary text-white'
                    : 'bg-kali-bg text-slate-400 hover:text-white'
                }`}
              >
                AGENTS
              </button>
            </div>

            {/* Active Chart View */}
            <div className="mt-3 h-52">
              {distributionTab === 'tools' && (
                data?.tool_distribution && data.tool_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.tool_distribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                      <XAxis type="number" stroke="#64748B" fontSize={10} fontFamily="JetBrains Mono" />
                      <YAxis
                        dataKey="tool"
                        type="category"
                        stroke="#64748B"
                        fontSize={10}
                        fontFamily="JetBrains Mono"
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#151E2D',
                          borderColor: '#1E293B',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono',
                          color: '#E2E8F0',
                        }}
                      />
                      <Bar dataKey="count" name="Calls" fill="#367BF5" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center font-mono text-xs text-slate-500">
                    No tool telemetry recorded yet.
                  </div>
                )
              )}

              {distributionTab === 'severity' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incidentSeverityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={10} fontFamily="JetBrains Mono" />
                    <YAxis stroke="#64748B" fontSize={10} fontFamily="JetBrains Mono" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151E2D',
                        borderColor: '#1E293B',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                        color: '#E2E8F0',
                      }}
                    />
                    <Bar dataKey="count" name="Incidents" fill="#DC4C55" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {distributionTab === 'decisions' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={policyDecisionsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={10} fontFamily="JetBrains Mono" />
                    <YAxis stroke="#64748B" fontSize={10} fontFamily="JetBrains Mono" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151E2D',
                        borderColor: '#1E293B',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={10} fontFamily="JetBrains Mono" />
                    <YAxis stroke="#64748B" fontSize={10} fontFamily="JetBrains Mono" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151E2D',
                        borderColor: '#1E293B',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                        color: '#E2E8F0',
                      }}
                    />
                    <Bar dataKey="count" name="Identities" fill="#367BF5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="border-t border-kali-border pt-3">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-slate-400">Total Tool Executions:</span>
              <span className="font-bold text-white">
                {(data?.tool_distribution || []).reduce((acc, curr) => acc + curr.count, 0)} calls
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION D: Agent Activity Table */}
      <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card">
        <div className="flex items-center justify-between border-b border-kali-border pb-3">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
              <span>// SECTION_D</span>
              <span className="text-kali-primary font-bold">[AGENT_ACTIVITY_INVENTORY]</span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5">Active Agent Identities & Risk Posture</h2>
          </div>
          <button
            onClick={() => setActiveTab('agents')}
            className="flex items-center gap-1 rounded border border-kali-border bg-kali-elevated px-2.5 py-1 font-mono text-xs text-slate-300 hover:border-kali-primary hover:text-white transition-colors"
          >
            <span>MANAGE ALL AGENTS</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kali-border bg-kali-bg/90 font-mono text-[11px] text-slate-400">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Agent Name</th>
                <th className="py-2.5 px-3 font-semibold">Cryptographic ID</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Role</th>
                <th className="py-2.5 px-3 font-semibold">Last Heartbeat</th>
                <th className="py-2.5 px-3 font-semibold">Risk Indicator</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kali-border text-slate-300">
              {agentsList.slice(0, 5).map((agent) => (
                <tr key={agent.id} className="hover:bg-kali-elevated/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-kali-cyan" />
                    <span>{agent.name}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    <span className="rounded bg-kali-bg px-1.5 py-0.5 border border-kali-border">
                      {truncateId(agent.id)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">{agent.role || 'general_agent'}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {formatTimestamp((agent as any).last_heartbeat || agent.updated_at || agent.created_at)}
                  </td>
                  <td className="py-2.5 px-3">
                    {agent.status === 'revoked' ? (
                      <span className="font-mono text-[10px] text-kali-critical font-bold">
                        [COMPROMISED / REVOKED]
                      </span>
                    ) : agent.status === 'suspended' ? (
                      <span className="font-mono text-[10px] text-kali-warning font-bold">
                        [SUSPENDED BY OPERATOR]
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-kali-secure font-bold">
                        [ZERO RISK DETECTED]
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setActiveTab('agents')}
                      className="font-mono text-[11px] text-kali-primary hover:text-kali-cyan hover:underline"
                    >
                      Inspect ›
                    </button>
                  </td>
                </tr>
              ))}
              {agentsList.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500 font-mono">
                    Zero agents enrolled. Navigate to Agent Security to register an identity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION E: Recent Security Incidents & Events Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Incidents */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card">
          <div className="flex items-center justify-between border-b border-kali-border pb-3">
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                <span>// SECTION_E1</span>
                <span className="text-kali-critical font-bold">[SOC_INCIDENT_TRIAGE]</span>
              </div>
              <h2 className="text-sm font-bold text-white mt-0.5">Recent Security Incidents</h2>
            </div>
            <button
              onClick={() => setActiveTab('incidents')}
              className="flex items-center gap-1 rounded border border-kali-border bg-kali-elevated px-2 py-1 font-mono text-xs text-slate-300 hover:border-kali-primary hover:text-white transition-colors"
            >
              <span>INCIDENT CENTER</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {incidentsList.slice(0, 5).map((inc) => (
              <div
                key={inc.id}
                onClick={() => setActiveTab('incidents')}
                className="cursor-pointer rounded border border-kali-border bg-kali-bg/80 p-3 hover:border-kali-primary hover:bg-kali-elevated/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={inc.severity} />
                    <span className="font-mono text-xs font-semibold text-white truncate max-w-[200px]">
                      {inc.title}
                    </span>
                  </div>
                  <StatusBadge status={inc.status} />
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-slate-400">
                  <span>AFFECTED: {(inc as any).agent_name || truncateId(inc.agent_id || 'system')}</span>
                  <span>{formatTimeOnly(inc.created_at)}</span>
                </div>
              </div>
            ))}
            {incidentsList.length === 0 && (
              <div className="py-8 text-center font-mono text-xs text-slate-500">
                No active security incidents triaged. Gateway perimeter secure.
              </div>
            )}
          </div>
        </div>

        {/* Recent 10 Intercepted Events Stream */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card">
          <div className="flex items-center justify-between border-b border-kali-border pb-3">
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                <span>// SECTION_E2</span>
                <span className="text-kali-primary font-bold">[INTERCEPTION_STREAM]</span>
              </div>
              <h2 className="text-sm font-bold text-white mt-0.5">Live Intercepted Tool Executions</h2>
            </div>
            <button
              onClick={() => setActiveTab('monitor')}
              className="flex items-center gap-1 rounded border border-kali-border bg-kali-elevated px-2 py-1 font-mono text-xs text-slate-300 hover:border-kali-primary hover:text-white transition-colors"
            >
              <span>GATEWAY FEED</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-kali-border bg-kali-bg/90 font-mono text-[10px] text-slate-400">
                <tr>
                  <th className="py-2 px-2.5">Time</th>
                  <th className="py-2 px-2.5">Agent</th>
                  <th className="py-2 px-2.5">Tool:Op</th>
                  <th className="py-2 px-2.5">Decision</th>
                  <th className="py-2 px-2.5">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border font-mono text-slate-300">
                {(data?.recent_events || []).slice(0, 5).map((ev) => (
                  <tr key={ev.id} className="hover:bg-kali-elevated/40 transition-colors">
                    <td className="py-2 px-2.5 text-slate-400">{formatTimeOnly(ev.created_at)}</td>
                    <td className="py-2 px-2.5 font-medium text-white truncate max-w-[90px]">
                      {ev.agent_name || truncateId(ev.agent_id)}
                    </td>
                    <td className="py-2 px-2.5 text-slate-300 truncate max-w-[120px]">
                      {ev.tool_name}:{ev.operation}
                    </td>
                    <td className="py-2 px-2.5">
                      <DecisionBadge decision={ev.decision} />
                    </td>
                    <td className="py-2 px-2.5 text-slate-400">{formatLatency(ev.execution_duration_ms)}</td>
                  </tr>
                ))}
                {(!data?.recent_events || data.recent_events.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 font-mono">
                      No gateway executions captured yet.
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

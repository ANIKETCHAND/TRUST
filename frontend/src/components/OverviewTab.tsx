import React, { useEffect, useState } from 'react';
import { Shield, ShieldAlert, Bot, Wrench, CheckCircle2, XCircle, RefreshCw, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import { api } from '../api/client';

export const OverviewTab: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getOverviewStats();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="font-mono text-sm tracking-wider">AGGREGATING CYBERSECURITY TELEMETRY...</span>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    total_agents: 0,
    active_agents: 0,
    registered_tools: 0,
    allowed_operations: 0,
    blocked_operations: 0,
    security_incidents: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Shield className="h-7 w-7 text-cyan-400" />
            Security Posture & Enforcement Overview
          </h1>
          <p className="text-sm text-slate-400">
            Real-time deterministic AI agent access enforcement, audit metrics, and incident intelligence.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 p-4 text-sm text-rose-300">
          Error: {error}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total & Active Agents */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Agents</span>
            <Bot className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-white">{metrics.total_agents}</span>
            <span className="text-xs text-emerald-400 font-medium">({metrics.active_agents} Active)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Authenticated agent identities</div>
        </div>

        {/* Protected Tools */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Protected Tools</span>
            <Wrench className="h-5 w-5 text-purple-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-white">{metrics.registered_tools}</span>
            <span className="text-xs text-purple-400 font-medium">Sandboxed</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">DB, Filesystem, HTTP & MCP</div>
        </div>

        {/* Allowed Actions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Allowed Operations</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-emerald-400">{metrics.allowed_operations}</span>
            <span className="text-xs text-slate-400 font-medium">Verified Calls</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Compliant with active security policies</div>
        </div>

        {/* Blocked Actions & Incidents */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Blocked Violations</span>
            <ShieldAlert className="h-5 w-5 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-rose-400">{metrics.blocked_operations}</span>
            <span className="text-xs text-rose-400 font-medium font-mono">({metrics.security_incidents} Incidents)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Zero execution side-effects</div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 24-Hour Enforcement Timeline */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">24-Hour Gateway Enforcement Activity</h2>
              <p className="text-xs text-slate-400">Allowed operations vs. blocked security violations</p>
            </div>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.timeline || []}>
                <defs>
                  <linearGradient id="allowedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="allowed" name="Allowed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#allowedGrad)" />
                <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#blockedGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tool Distribution */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Tool Invocations</h2>
              <p className="text-xs text-slate-400">Total requests per protected tool</p>
            </div>
            <Wrench className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.tool_distribution || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis dataKey="tool" type="category" stroke="#64748b" fontSize={10} width={90} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="count" name="Calls" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Security Events Stream */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Security Gateway Events</h2>
            <p className="text-xs text-slate-400">Live decision stream recorded by the gateway</p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-800">
            AUTO-POLLING ACTIVE
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Agent</th>
                <th className="py-2.5 px-3 font-semibold">Tool & Operation</th>
                <th className="py-2.5 px-3 font-semibold">Target Resource</th>
                <th className="py-2.5 px-3 font-semibold">Decision</th>
                <th className="py-2.5 px-3 font-semibold">Latency</th>
                <th className="py-2.5 px-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {(data?.recent_events || []).map((ev: any) => (
                <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-white">{ev.agent_name}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    {ev.tool_name}:{ev.operation}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300 max-w-[200px] truncate" title={ev.target_resource}>
                    {ev.target_resource}
                  </td>
                  <td className="py-2.5 px-3">
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
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {ev.execution_duration_ms ? `${ev.execution_duration_ms.toFixed(2)} ms` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 max-w-[250px] truncate" title={ev.decision_reason}>
                    {ev.decision_reason}
                  </td>
                </tr>
              ))}
              {(!data?.recent_events || data.recent_events.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No gateway security events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

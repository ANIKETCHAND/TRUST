import React from 'react';
import { RefreshCw, Activity, ShieldCheck } from 'lucide-react';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';

const tabLabels: Record<string, string> = {
  overview: 'Executive Security Overview',
  'threat-map': 'Live Global Threat & Geolocation Radar',
  'active-defense': 'Active Defense & Autonomous Process Killer',
  agents: 'AI Agent Registry & Access Keys',
  tools: 'Protected Tools & Sensitive Connectors',
  monitor: 'Live Real-Time Interception Stream',
  endpoints: 'Native OS Endpoint Sentry',
  'browser-shield': 'Enterprise Browser Shield DLP',
  delegations: 'Multi-Agent Delegation Graph',
  provenance: 'Data Flow & Provenance Lineage',
  policies: 'Deterministic Security Policies',
  incidents: 'Security Incidents & Automated Alerts',
  reports: 'Forensic Dossier & Executive Compliance Reports',
  audit: 'Compliance Audit Trail',
  'agent-runner': 'Autonomous Agent Guardrail Runner',
  settings: 'Platform Configuration & System Health',
};

export const TopNavbar: React.FC = () => {
  const { activeTab, autoRefresh, setAutoRefresh, triggerGlobalRefresh } = useSecurityPlatform();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/40 px-6 backdrop-blur shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Console /</span>
        <span className="text-xs font-bold text-white uppercase tracking-wider">
          {tabLabels[activeTab] || activeTab}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs font-mono">
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] border transition-colors ${
            autoRefresh
              ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
              : 'border-slate-800 bg-slate-900 text-slate-400'
          }`}
          title="Toggle automatic telemetry background polling"
        >
          <Activity className={`h-3 w-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
          {autoRefresh ? 'LIVE POLLING ON' : 'POLLING PAUSED'}
        </button>

        <button
          onClick={triggerGlobalRefresh}
          className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-700 hover:bg-slate-800 transition-colors"
          title="Trigger global refresh across all widgets"
        >
          <RefreshCw className="h-3 w-3 text-cyan-400" />
          Refresh
        </button>

        <div className="hidden sm:flex items-center gap-1.5 rounded bg-slate-900 px-2.5 py-1 text-slate-400 border border-slate-800 text-[11px]">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
          Deterministic Security Engine
        </div>
      </div>
    </header>
  );
};

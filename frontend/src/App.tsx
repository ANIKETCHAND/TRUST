import { useState } from 'react';
import {
  Shield,
  LayoutDashboard,
  Bot,
  Wrench,
  Activity,
  GitFork,
  Network,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Layers,
  Settings,
} from 'lucide-react';
import { OverviewTab } from './components/OverviewTab';
import { AgentsTab } from './components/AgentsTab';
import { ToolsTab } from './components/ToolsTab';
import { LiveMonitoringTab } from './components/LiveMonitoringTab';
import { DelegationTab } from './components/DelegationTab';
import { ProvenanceTab } from './components/ProvenanceTab';
import { PoliciesTab } from './components/PoliciesTab';
import { IncidentsTab } from './components/IncidentsTab';
import { AuditTab } from './components/AuditTab';
import { AgentRunnerTab } from './components/AgentRunnerTab';
import { SettingsTab } from './components/SettingsTab';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'tools' | 'monitor' | 'delegations' | 'provenance' | 'policies' | 'incidents' | 'audit' | 'agent-runner' | 'settings'>('overview');

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'tools', label: 'Tools', icon: Wrench },
    { id: 'monitor', label: 'Live Monitoring', icon: Activity },
    { id: 'delegations', label: 'Delegation Graph', icon: GitFork },
    { id: 'provenance', label: 'Provenance', icon: Network },
    { id: 'policies', label: 'Security Policies', icon: ShieldCheck },
    { id: 'incidents', label: 'Incidents & Alerts', icon: ShieldAlert },
    { id: 'audit', label: 'Audit Logs', icon: FileCheck },
    { id: 'agent-runner', label: 'Agent Playground', icon: Layers },
    { id: 'settings', label: 'Settings & Health', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cyber-bg text-slate-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur">
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-800">
            <Shield className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-wider text-white">AGENTTRUST</div>
            <div className="text-[10px] font-mono text-cyan-400">AI SECURITY PLATFORM</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Platform Status */}
        <div className="border-t border-slate-800/80 p-4">
          <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-white">GATEWAY ENFORCING</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400 font-mono">Fail-Closed Mode: ON</div>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/40 px-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Console /</span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="rounded bg-slate-900 px-2.5 py-1 border border-slate-800">
              Deterministic Security Engine
            </span>
          </div>
        </header>

        {/* Tab Content Canvas */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'tools' && <ToolsTab />}
            {activeTab === 'monitor' && <LiveMonitoringTab />}
            {activeTab === 'delegations' && <DelegationTab />}
            {activeTab === 'provenance' && <ProvenanceTab />}
            {activeTab === 'policies' && <PoliciesTab />}
            {activeTab === 'incidents' && <IncidentsTab />}
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'agent-runner' && <AgentRunnerTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

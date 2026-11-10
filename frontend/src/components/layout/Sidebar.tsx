import React from 'react';
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
  Monitor,
  Globe,
} from 'lucide-react';
import { useSecurityPlatform, type ActiveTabId } from '../../context/SecurityPlatformContext';

interface NavItem {
  id: ActiveTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'monitor', label: 'Live Monitoring', icon: Activity },
  { id: 'endpoints', label: 'Endpoint Connector', icon: Monitor },
  { id: 'browser-shield', label: 'Browser Shield', icon: Globe },
  { id: 'delegations', label: 'Delegation Graph', icon: GitFork },
  { id: 'provenance', label: 'Provenance', icon: Network },
  { id: 'policies', label: 'Security Policies', icon: ShieldCheck },
  { id: 'incidents', label: 'Incidents & Alerts', icon: ShieldAlert },
  { id: 'audit', label: 'Audit Logs', icon: FileCheck },
  { id: 'agent-runner', label: 'Agent Playground', icon: Layers },
  { id: 'settings', label: 'Settings & Health', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useSecurityPlatform();

  return (
    <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur shrink-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-800 shadow-sm shadow-cyan-900/20">
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
              onClick={() => setActiveTab(item.id)}
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

      {/* Platform Status */}
      <div className="border-t border-slate-800/80 p-4">
        <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-white">GATEWAY ENFORCING</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-mono">Fail-Closed Mode: ACTIVE</div>
        </div>
      </div>
    </aside>
  );
};

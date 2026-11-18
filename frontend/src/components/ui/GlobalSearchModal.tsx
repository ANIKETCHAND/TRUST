import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bot,
  ShieldAlert,
  Wrench,
  Monitor,
  LayoutDashboard,
  ShieldCheck,
  Globe,
  Skull,
  Activity,
  GitFork,
  Network,
  Layers,
  FileText,
  FileCheck,
  Settings,
  Cpu,
  ArrowRight,
  X,
} from 'lucide-react';
import { useSecurityPlatform, type PlatformTab } from '../../context/SecurityPlatformContext';
import { api } from '../../services/api.client';
import { truncateId } from '../../utils/formatters';

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'NAVIGATION' | 'AGENT' | 'INCIDENT' | 'TOOL' | 'ENDPOINT';
  icon: React.ComponentType<{ className?: string }>;
  tab: PlatformTab;
}

export const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, setActiveTab } = useSecurityPlatform();
  const [query, setQuery] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);

      // Fetch fresh items for index
      Promise.allSettled([
        api.listAgents(),
        api.listIncidents({ limit: 10 }),
        api.listTools(),
        api.listEndpoints(),
      ]).then(([aRes, iRes, tRes, eRes]) => {
        if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) setAgents(aRes.value);
        if (iRes.status === 'fulfilled' && Array.isArray(iRes.value)) setIncidents(iRes.value);
        if (tRes.status === 'fulfilled' && Array.isArray(tRes.value)) setTools(tRes.value);
        if (eRes.status === 'fulfilled' && Array.isArray(eRes.value)) setEndpoints(eRes.value);
      });
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const navItems: SearchItem[] = [
    { id: 'nav-overview', title: 'Security Overview', subtitle: 'Platform health and core security metrics', category: 'NAVIGATION', icon: LayoutDashboard, tab: 'overview' },
    { id: 'nav-threat-map', title: 'Threat Radar & Geolocation', subtitle: 'Global attack vectors and network map', category: 'NAVIGATION', icon: Globe, tab: 'threat-map' },
    { id: 'nav-active-defense', title: 'Active Defense', subtitle: 'Process termination and IP sinkholes', category: 'NAVIGATION', icon: Skull, tab: 'active-defense' },
    { id: 'nav-agents', title: 'Agent Management', subtitle: 'Cryptographic identities and status', category: 'NAVIGATION', icon: Bot, tab: 'agents' },
    { id: 'nav-monitor', title: 'Gateway Monitor', subtitle: 'Live telemetry and intercepted requests', category: 'NAVIGATION', icon: Activity, tab: 'monitor' },
    { id: 'nav-tools', title: 'Tool Registry', subtitle: 'Sandboxed tools and dispatch sandbox', category: 'NAVIGATION', icon: Wrench, tab: 'tools' },
    { id: 'nav-policies', title: 'Policy Engine', subtitle: 'Rule definitions and simulation testbench', category: 'NAVIGATION', icon: ShieldCheck, tab: 'policies' },
    { id: 'nav-delegations', title: 'Delegation Control', subtitle: 'Subscoping hierarchy and tokens', category: 'NAVIGATION', icon: GitFork, tab: 'delegations' },
    { id: 'nav-provenance', title: 'Provenance Explorer', subtitle: 'Data lineage and source verification', category: 'NAVIGATION', icon: Network, tab: 'provenance' },
    { id: 'nav-agent-runner', title: 'Agent Playground', subtitle: 'Prompt sandbox and injection testing', category: 'NAVIGATION', icon: Layers, tab: 'agent-runner' },
    { id: 'nav-incidents', title: 'Incident Center', subtitle: 'Active threat triage and resolution', category: 'NAVIGATION', icon: ShieldAlert, tab: 'incidents' },
    { id: 'nav-reports', title: 'Forensics & Reports', subtitle: 'Executive dossiers and audit compliance', category: 'NAVIGATION', icon: FileText, tab: 'reports' },
    { id: 'nav-audit', title: 'Audit Trail', subtitle: 'Immutable security log and events', category: 'NAVIGATION', icon: FileCheck, tab: 'audit' },
    { id: 'nav-browser-shield', title: 'Browser Shield', subtitle: 'Pre-flight prompt DLP inspection', category: 'NAVIGATION', icon: Globe, tab: 'browser-shield' },
    { id: 'nav-endpoints', title: 'Endpoint Security', subtitle: 'Host containment and agent telemetry', category: 'NAVIGATION', icon: Monitor, tab: 'endpoints' },
    { id: 'nav-integrations', title: 'Integrations', subtitle: 'Security mesh and external connectors', category: 'NAVIGATION', icon: Cpu, tab: 'integrations' },
    { id: 'nav-settings', title: 'Settings', subtitle: 'Platform configurations and health', category: 'NAVIGATION', icon: Settings, tab: 'settings' },
  ];

  const agentItems: SearchItem[] = agents.map((a) => ({
    id: `agent-${a.id}`,
    title: a.name,
    subtitle: `Agent ID: ${truncateId(a.id, 12)} • Status: ${a.status} • Role: ${a.role}`,
    category: 'AGENT',
    icon: Bot,
    tab: 'agents',
  }));

  const incidentItems: SearchItem[] = incidents.map((i) => ({
    id: `incident-${i.id}`,
    title: i.title,
    subtitle: `Severity: ${i.severity} • Status: ${i.status} • Agent: ${i.agent_id ? truncateId(i.agent_id, 8) : 'System'}`,
    category: 'INCIDENT',
    icon: ShieldAlert,
    tab: 'incidents',
  }));

  const toolItems: SearchItem[] = tools.map((t) => ({
    id: `tool-${t.id || t.name}`,
    title: t.name,
    subtitle: `Category: ${t.category || 'System'} • Operations: ${(t.allowed_operations || []).join(', ') || 'All'}`,
    category: 'TOOL',
    icon: Wrench,
    tab: 'tools',
  }));

  const endpointItems: SearchItem[] = endpoints.map((e) => ({
    id: `endpoint-${e.id}`,
    title: e.hostname || 'Unknown Host',
    subtitle: `Platform: ${e.os_platform || 'Windows'} • Status: ${e.status || 'ONLINE'} • IP: ${e.ip_address || '127.0.0.1'}`,
    category: 'ENDPOINT',
    icon: Monitor,
    tab: 'endpoints',
  }));

  const allItems = [...navItems, ...agentItems, ...incidentItems, ...toolItems, ...endpointItems];

  const filteredItems = allItems.filter((item) => {
    if (!query.trim()) return item.category === 'NAVIGATION';
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleSelect = (tab: PlatformTab) => {
    setActiveTab(tab);
    setIsSearchOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/80 backdrop-blur-xl p-4 animate-fade-in"
      onClick={() => setIsSearchOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0a0d14]/95 shadow-[0_16px_60px_rgba(0,0,0,0.85)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-white/10 bg-white/[0.02] px-5 py-4 flex items-center gap-3">
          <Search className="h-4 w-4 text-kali-cyan shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, incidents, tools, endpoints, or jump to tab..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.slice(0, 10).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.tab)}
                className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-white/[0.04] transition-all group border border-transparent hover:border-white/10"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 group-hover:text-kali-cyan group-hover:border-kali-cyan/30 transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white group-hover:text-kali-cyan transition-colors truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.02] text-slate-400">
                    {item.category}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-kali-cyan group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500">
              No matching results found for "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  const { isSearchOpen, setIsSearchOpen, scrollToChapter } = useSecurityPlatform();
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

  const staticNavItems: SearchItem[] = [
    { id: 'nav-overview', title: 'Security Overview', subtitle: 'Executive dashboard & metrics', category: 'NAVIGATION', icon: LayoutDashboard, tab: 'overview' },
    { id: 'nav-agents', title: 'Agent Registry', subtitle: 'Manage AI agent identities & credentials', category: 'NAVIGATION', icon: Bot, tab: 'agents' },
    { id: 'nav-tools', title: 'Protected Tool Registry', subtitle: 'Sandbox boundaries & execution testing', category: 'NAVIGATION', icon: Wrench, tab: 'tools' },
    { id: 'nav-monitor', title: 'Live Monitoring', subtitle: 'Real-time gateway interception stream', category: 'NAVIGATION', icon: Activity, tab: 'monitor' },
    { id: 'nav-delegation', title: 'Delegation Graph', subtitle: 'Interactive agent delegation tree', category: 'NAVIGATION', icon: GitFork, tab: 'delegations' },
    { id: 'nav-provenance', title: 'Data Provenance Explorer', subtitle: 'Origin tracking & data lineage', category: 'NAVIGATION', icon: Network, tab: 'provenance' },
    { id: 'nav-policies', title: 'Security Policies', subtitle: 'Deterministic policy rules & simulation', category: 'NAVIGATION', icon: ShieldCheck, tab: 'policies' },
    { id: 'nav-incidents', title: 'Security Incidents', subtitle: 'Triage, containment, and investigations', category: 'NAVIGATION', icon: ShieldAlert, tab: 'incidents' },
    { id: 'nav-audit', title: 'Compliance Audit Trail', subtitle: 'Cryptographically bounded event records', category: 'NAVIGATION', icon: FileCheck, tab: 'audit' },
    { id: 'nav-runner', title: 'Agent Playground', subtitle: 'Autonomous execution testbench', category: 'NAVIGATION', icon: Layers, tab: 'agent-runner' },
    { id: 'nav-threat-radar', title: 'Threat Radar & Geolocation', subtitle: 'Attribution map & network sinkholes', category: 'NAVIGATION', icon: Globe, tab: 'threat-map' },
    { id: 'nav-active-defense', title: 'Active Defense', subtitle: 'Malicious process mitigation', category: 'NAVIGATION', icon: Skull, tab: 'active-defense' },
    { id: 'nav-forensics', title: 'Forensic Dossiers & Reports', subtitle: 'MITRE ATT&CK mapping', category: 'NAVIGATION', icon: FileText, tab: 'reports' },
    { id: 'nav-browser-shield', title: 'Browser Shield', subtitle: 'Layer 2 agent DOM & script protection', category: 'NAVIGATION', icon: ShieldCheck, tab: 'browser-shield' },
    { id: 'nav-endpoints', title: 'Endpoint Security', subtitle: 'Host sentry & container containment', category: 'NAVIGATION', icon: Monitor, tab: 'endpoints' },
    { id: 'nav-integrations', title: 'Connected Integrations', subtitle: 'ClamAV, VirusTotal, SIEM connectors', category: 'NAVIGATION', icon: Cpu, tab: 'integrations' },
    { id: 'nav-settings', title: 'Settings & Health', subtitle: 'Telemetry polling, fail-closed policy', category: 'NAVIGATION', icon: Settings, tab: 'settings' },
  ];

  const agentItems: SearchItem[] = agents.map((a) => ({
    id: `agent-${a.id}`,
    title: a.name,
    subtitle: `Role: ${a.role} • Status: ${a.status}`,
    category: 'AGENT',
    icon: Bot,
    tab: 'agents',
  }));

  const incidentItems: SearchItem[] = incidents.map((i) => ({
    id: `inc-${i.id}`,
    title: i.title || `Incident #${truncateId(i.id, 8)}`,
    subtitle: `Severity: ${i.severity} • Status: ${i.status}`,
    category: 'INCIDENT',
    icon: ShieldAlert,
    tab: 'incidents',
  }));

  const toolItems: SearchItem[] = tools.map((t) => ({
    id: `tool-${t.id || t.name}`,
    title: t.name,
    subtitle: `Category: ${t.category} • Operations: ${(t.supported_operations || t.operations || []).join(', ') || 'N/A'}`,
    category: 'TOOL',
    icon: Wrench,
    tab: 'tools',
  }));

  const endpointItems: SearchItem[] = endpoints.map((e) => ({
    id: `endpoint-${e.id || e.hostname || e.name}`,
    title: e.hostname || e.name || 'Host Endpoint',
    subtitle: `Status: ${e.isolation_status || e.status || 'Active'}`,
    category: 'ENDPOINT',
    icon: Monitor,
    tab: 'endpoints',
  }));

  const allItems: SearchItem[] = [...staticNavItems, ...agentItems, ...incidentItems, ...toolItems, ...endpointItems];

  const filteredItems = query.trim()
    ? allItems.filter(
        (it) =>
          it.title.toLowerCase().includes(query.toLowerCase()) ||
          it.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          it.category.toLowerCase().includes(query.toLowerCase())
      )
    : staticNavItems;

  const handleSelect = (tab: PlatformTab) => {
    setIsSearchOpen(false);
    scrollToChapter(tab);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/30 backdrop-blur-xs select-none"
      onClick={() => setIsSearchOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#E5EAF1] bg-white shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[#E5EAF1] px-4 py-3 bg-[#F8FAFC]">
          <Search className="h-4 w-4 text-[#3B82F6]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, tools, policies, incidents, or jump to..."
            className="flex-1 bg-transparent text-sm text-[#1E293B] placeholder-[#94A3B8] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#94A3B8] hover:text-[#1E293B]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="rounded border border-[#E5EAF1] bg-white px-2 py-0.5 font-mono text-[10px] text-[#64748B]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-[#F1F5F9]">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#64748B]">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.slice(0, 15).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.tab)}
                  className="flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-[#F8FAFC] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5EAF1] bg-[#EEF4FF] text-[#3B82F6]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#1E293B] group-hover:text-[#3B82F6] transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5 truncate max-w-sm">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B]">
                      {item.category}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#94A3B8] group-hover:text-[#3B82F6] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E5EAF1] bg-[#F8FAFC] px-4 py-2.5 text-[11px] text-[#64748B]">
          <span>Type to filter live security entities</span>
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-[#E5EAF1] bg-white px-1.5 py-0.5 font-mono text-[9px] mr-1">↑</kbd>
              <kbd className="rounded border border-[#E5EAF1] bg-white px-1.5 py-0.5 font-mono text-[9px]">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="rounded border border-[#E5EAF1] bg-white px-1.5 py-0.5 font-mono text-[9px]">↵</kbd> Select
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

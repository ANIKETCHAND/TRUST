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
    { id: 'nav-overview', title: 'Security Overview', subtitle: 'Executive & Technical Command Dashboard', category: 'NAVIGATION', icon: LayoutDashboard, tab: 'overview' },
    { id: 'nav-threat-map', title: 'Threat Radar & Geolocation', subtitle: 'Active IP Sinkholes & ARP Forensics', category: 'NAVIGATION', icon: Globe, tab: 'threat-map' },
    { id: 'nav-active-defense', title: 'Active Defense & Process Killer', subtitle: 'Autonomous Process Sentinel & YARA Vault', category: 'NAVIGATION', icon: Skull, tab: 'active-defense' },
    { id: 'nav-agents', title: 'Agent Management & Identity', subtitle: 'Cryptographic API Keys & Zero-Trust Grants', category: 'NAVIGATION', icon: Bot, tab: 'agents' },
    { id: 'nav-monitor', title: 'Gateway Monitor', subtitle: 'Pre-flight Interception & Telemetry Feed', category: 'NAVIGATION', icon: Activity, tab: 'monitor' },
    { id: 'nav-tools', title: 'Tool Registry', subtitle: 'Deterministic Tool Sandboxing & Execution Testbench', category: 'NAVIGATION', icon: Wrench, tab: 'tools' },
    { id: 'nav-policies', title: 'Policy Engine', subtitle: 'Declarative Rule Editor & Evaluation Simulator', category: 'NAVIGATION', icon: ShieldCheck, tab: 'policies' },
    { id: 'nav-delegations', title: 'Delegation Control', subtitle: 'Cryptographic Subscoping Graph & Bounds', category: 'NAVIGATION', icon: GitFork, tab: 'delegations' },
    { id: 'nav-provenance', title: 'Provenance Explorer', subtitle: 'Immutable Data Lineage Graph', category: 'NAVIGATION', icon: Network, tab: 'provenance' },
    { id: 'nav-agent-runner', title: 'Agent Sandbox Playground', subtitle: 'Prompt Injection Simulation & Execution', category: 'NAVIGATION', icon: Layers, tab: 'agent-runner' },
    { id: 'nav-incidents', title: 'Incident Center', subtitle: 'SOC Alert Triage & Remediation Actions', category: 'NAVIGATION', icon: ShieldAlert, tab: 'incidents' },
    { id: 'nav-reports', title: 'Forensic Dossiers & Reports', subtitle: 'MITRE ATT&CK Matrix & Threat Intel', category: 'NAVIGATION', icon: FileText, tab: 'reports' },
    { id: 'nav-audit', title: 'Audit Logs & Security Events', subtitle: 'Tamper-Evident SHA-256 Ledger', category: 'NAVIGATION', icon: FileCheck, tab: 'audit' },
    { id: 'nav-browser-shield', title: 'Browser Shield DLP', subtitle: 'Pre-Submission Prompt DLP Interception', category: 'NAVIGATION', icon: Globe, tab: 'browser-shield' },
    { id: 'nav-endpoints', title: 'Endpoint Security Sentry', subtitle: 'Host Containment & OS Process Inspection', category: 'NAVIGATION', icon: Monitor, tab: 'endpoints' },
    { id: 'nav-integrations', title: 'Integration Center', subtitle: 'OPA, Pipelock, YARA, ClamAV, OpenTelemetry', category: 'NAVIGATION', icon: Cpu, tab: 'integrations' },
    { id: 'nav-settings', title: 'System Health & Settings', subtitle: 'Platform Infrastructure & Zero-Trust Config', category: 'NAVIGATION', icon: Settings, tab: 'settings' },
  ];

  const agentItems: SearchItem[] = agents.map((a) => ({
    id: `agent-${a.id}`,
    title: a.name,
    subtitle: `Agent ID: ${truncateId(a.id, 12)} • Status: ${a.status.toUpperCase()} • Role: ${a.role}`,
    category: 'AGENT',
    icon: Bot,
    tab: 'agents',
  }));

  const incidentItems: SearchItem[] = incidents.map((i) => ({
    id: `incident-${i.id}`,
    title: i.title,
    subtitle: `Severity: ${i.severity} • Status: ${i.status} • Affected: ${i.agent_id ? truncateId(i.agent_id, 8) : 'System'}`,
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
    subtitle: `Platform: ${e.os_platform || 'Windows'} • Status: ${e.status?.toUpperCase() || 'ONLINE'} • IP: ${e.ip_address || '127.0.0.1'}`,
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-kali-bg/85 backdrop-blur-md p-4 animate-fade-in"
      onClick={() => setIsSearchOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-kali-border bg-kali-secondary shadow-2xl overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-kali-border bg-kali-card px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-kali-primary animate-pulse" />
            <span className="font-bold text-white tracking-wider">COMMAND PALETTE // GLOBAL SEARCH</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 bg-kali-bg px-1.5 py-0.5 rounded border border-kali-border">
              ESC to close
            </span>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative border-b border-kali-border bg-kali-bg px-4 py-3 flex items-center gap-3">
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
              className="text-xs text-slate-400 hover:text-white"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Results Stream */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
          {filteredItems.slice(0, 20).map((item) => {
            const Icon = item.icon;
            const categoryColors: Record<string, string> = {
              NAVIGATION: 'text-kali-primary border-kali-primary/40 bg-kali-primary/10',
              AGENT: 'text-kali-cyan border-kali-cyan/40 bg-kali-cyan/10',
              INCIDENT: 'text-kali-critical border-kali-critical/40 bg-kali-critical/10',
              TOOL: 'text-kali-warning border-kali-warning/40 bg-kali-warning/10',
              ENDPOINT: 'text-kali-secure border-kali-secure/40 bg-kali-secure/10',
            };

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.tab)}
                className="group flex w-full items-center justify-between rounded-md p-2.5 text-left hover:bg-kali-elevated transition-colors border border-transparent hover:border-kali-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-kali-border bg-kali-bg text-slate-300 group-hover:text-white group-hover:border-kali-primary transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white truncate group-hover:text-kali-cyan transition-colors">
                        {item.title}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded border uppercase font-bold ${
                          categoryColors[item.category] || 'text-slate-400 border-slate-700'
                        }`}
                      >
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 group-hover:text-kali-primary transition-colors shrink-0 ml-2">
                  <span>JUMP</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500">
              // NO INDICATORS OR ROUTES MATCH QUERY: "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-kali-border bg-kali-bg/90 px-4 py-2 flex items-center justify-between text-[10px] text-slate-400">
          <span>PRESS [ENTER] OR CLICK TO NAVIGATE</span>
          <span>AGENTTRUST INTELLIGENCE INDEX</span>
        </div>
      </div>
    </div>
  );
};

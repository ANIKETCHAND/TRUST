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
  Monitor,
  Globe,
  Skull,
  FileText,
  Settings,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Radio,
  Lock,
} from 'lucide-react';
import { useSecurityPlatform, type ActiveTabId } from '../../context/SecurityPlatformContext';
import { BrandLogo } from '../ui/BrandLogo';

interface NavGroup {
  label: string;
  items: {
    id: ActiveTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tag?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      { id: 'overview', label: 'Security Overview', icon: LayoutDashboard },
      { id: 'threat-map', label: 'Threat Radar & Geolocation', icon: Globe },
      { id: 'active-defense', label: 'Active Defense & Process Killer', icon: Skull, tag: 'L3' },
    ],
  },
  {
    label: 'AGENT SECURITY',
    items: [
      { id: 'agents', label: 'Agent Management', icon: Bot },
      { id: 'monitor', label: 'Gateway Monitor', icon: Activity, tag: 'LIVE' },
      { id: 'tools', label: 'Tool Registry', icon: Wrench },
      { id: 'policies', label: 'Policy Engine', icon: Shield },
      { id: 'delegations', label: 'Delegation Control', icon: GitFork },
      { id: 'provenance', label: 'Provenance Explorer', icon: Network },
      { id: 'agent-runner', label: 'Agent Playground', icon: Layers },
    ],
  },
  {
    label: 'THREAT OPERATIONS',
    items: [
      { id: 'incidents', label: 'Incident Center', icon: ShieldAlert, tag: 'SOC' },
      { id: 'reports', label: 'Forensics & Threat Intel', icon: FileText },
      { id: 'audit', label: 'Audit Logs & Events', icon: FileCheck },
    ],
  },
  {
    label: 'PROTECTION',
    items: [
      { id: 'browser-shield', label: 'Browser Shield', icon: ShieldCheck, tag: 'L2' },
      { id: 'endpoints', label: 'Endpoint Security', icon: Monitor, tag: 'L1' },
      { id: 'integrations', label: 'Integrations', icon: Cpu, tag: 'MESH' },
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { id: 'settings', label: 'System Health & Settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  } = useSecurityPlatform();

  const handleSelectTab = (tabId: ActiveTabId) => {
    setActiveTab(tabId);
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const sidebarContent = (
    <aside
      className={`flex flex-col border-r border-kali-border bg-kali-sidebar transition-all duration-200 select-none ${
        isSidebarCollapsed ? 'w-[68px]' : 'w-64'
      } h-full shrink-0`}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-kali-border px-3.5">
        <BrandLogo
          size={isSidebarCollapsed ? 'sm' : 'md'}
          showText={!isSidebarCollapsed}
          showSubtitle={!isSidebarCollapsed}
        />
        <button
          onClick={toggleSidebarCollapse}
          className="hidden md:flex h-6 w-6 items-center justify-center rounded border border-kali-border bg-kali-bg text-slate-400 hover:border-kali-primary hover:text-white transition-colors"
          title={isSidebarCollapsed ? 'Expand sidebar [Ctrl+B]' : 'Collapse sidebar [Ctrl+B]'}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-kali-primary" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation Group Stream */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Main Navigation">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!isSidebarCollapsed && (
              <div className="px-2 pb-1 font-mono text-[10px] font-bold tracking-widest text-slate-400 flex items-center gap-1.5">
                <span className="text-kali-primary/80">//</span>
                <span>{group.label}</span>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="mx-auto my-1 h-px w-6 bg-kali-border" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    title={isSidebarCollapsed ? `${item.label} ${item.tag ? `[${item.tag}]` : ''}` : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-all ${
                      isActive
                        ? 'border-l-2 border-kali-primary bg-kali-elevated text-white font-semibold shadow-sm'
                        : 'border-l-2 border-transparent text-slate-400 hover:bg-kali-card hover:text-slate-200'
                    } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive ? 'text-kali-primary' : 'text-slate-400 group-hover:text-kali-cyan'
                      }`}
                    />

                    {!isSidebarCollapsed && (
                      <span className="flex-1 truncate text-left">{item.label}</span>
                    )}

                    {!isSidebarCollapsed && item.tag && (
                      <span
                        className={`font-mono text-[9px] px-1.5 py-0.2 rounded border uppercase ${
                          isActive
                            ? 'border-kali-primary/60 bg-kali-primary/20 text-kali-cyan'
                            : 'border-kali-border bg-kali-bg text-slate-500'
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}

                    {/* Tooltip for collapsed mode */}
                    {isSidebarCollapsed && (
                      <div className="absolute left-full ml-2 hidden rounded-md border border-kali-border bg-kali-secondary px-2.5 py-1 font-mono text-xs text-white shadow-xl group-hover:block z-50 whitespace-nowrap pointer-events-none">
                        {item.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Fail-Closed Gateway Status Footer */}
      <div className="border-t border-kali-border p-2.5">
        <div
          className={`rounded border border-kali-border bg-kali-bg/90 p-2 text-xs ${
            isSidebarCollapsed ? 'flex justify-center' : ''
          }`}
        >
          {isSidebarCollapsed ? (
            <div className="relative" title="GATEWAY ENFORCING (FAIL-CLOSED: ACTIVE)">
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kali-secure opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-kali-secure"></span>
              </span>
              <Lock className="h-4 w-4 text-kali-primary" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-white">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kali-secure opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-kali-secure"></span>
                  </span>
                  <span>GATEWAY ENFORCING</span>
                </div>
                <Radio className="h-3 w-3 text-kali-cyan animate-pulse" />
              </div>
              <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                <span>POLICY: FAIL-CLOSED</span>
                <span className="text-kali-secure font-bold">ONLINE</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block h-full">{sidebarContent}</div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden bg-kali-bg/80 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div className="w-72 h-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

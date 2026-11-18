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
  Lock,
} from 'lucide-react';
import { useSecurityPlatform, type ActiveTabId } from '../../context/SecurityPlatformContext';
import { useRouter } from '../../context/RouterContext';
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
    label: 'Overview',
    items: [
      { id: 'overview', label: 'Security Overview', icon: LayoutDashboard },
      { id: 'threat-map', label: 'Threat Radar & Geolocation', icon: Globe },
      { id: 'active-defense', label: 'Active Defense', icon: Skull, tag: 'L3' },
    ],
  },
  {
    label: 'Agent Security',
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
    label: 'Threat Operations',
    items: [
      { id: 'incidents', label: 'Incident Center', icon: ShieldAlert, tag: 'SOC' },
      { id: 'reports', label: 'Forensics & Threat Intel', icon: FileText },
      { id: 'audit', label: 'Audit Logs', icon: FileCheck },
    ],
  },
  {
    label: 'Protection',
    items: [
      { id: 'browser-shield', label: 'Browser Shield', icon: ShieldCheck, tag: 'L2' },
      { id: 'endpoints', label: 'Endpoint Security', icon: Monitor, tag: 'L1' },
      { id: 'integrations', label: 'Integrations', icon: Cpu },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings & Health', icon: Settings },
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
  const { navigate } = useRouter();

  const handleSelectTab = (tabId: ActiveTabId) => {
    setActiveTab(tabId);
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const sidebarContent = (
    <aside
      className={`flex flex-col border-r border-white/10 bg-[#03060c]/95 backdrop-blur-2xl transition-all duration-200 select-none ${
        isSidebarCollapsed ? 'w-[68px]' : 'w-64'
      } h-full shrink-0`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <button
          onClick={() => navigate('/')}
          className="focus:outline-none text-left"
          title="Return to Landing Page (/)"
        >
          <BrandLogo
            size={isSidebarCollapsed ? 'sm' : 'md'}
            showText={!isSidebarCollapsed}
            showSubtitle={!isSidebarCollapsed}
          />
        </button>
        <button
          onClick={toggleSidebarCollapse}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white transition-colors"
          title={isSidebarCollapsed ? 'Expand sidebar [Ctrl+B]' : 'Collapse sidebar [Ctrl+B]'}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-kali-cyan" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main Navigation">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!isSidebarCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                {group.label}
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="mx-auto my-1.5 h-px w-6 bg-white/10" />
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
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-white/[0.08] text-white border-l-2 border-kali-cyan shadow-[0_0_15px_rgba(34,184,207,0.12)]'
                        : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200 border-l-2 border-transparent'
                    } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive ? 'text-kali-cyan' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />

                    {!isSidebarCollapsed && (
                      <span className="flex-1 truncate text-left">{item.label}</span>
                    )}

                    {!isSidebarCollapsed && item.tag && (
                      <span
                        className={`font-mono text-[9px] px-1.5 py-0.5 rounded uppercase ${
                          isActive
                            ? 'bg-kali-cyan/15 text-kali-cyan border border-kali-cyan/30'
                            : 'bg-white/5 text-slate-400 border border-white/5'
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}

                    {/* Tooltip for collapsed mode */}
                    {isSidebarCollapsed && (
                      <div className="absolute left-full ml-2 hidden rounded-lg border border-white/15 bg-[#0a0d14] px-3 py-1.5 text-xs text-white shadow-2xl group-hover:block z-50 whitespace-nowrap pointer-events-none">
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

      {/* Gateway Status Footer */}
      <div className="border-t border-white/10 p-3">
        <div
          className={`rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs ${
            isSidebarCollapsed ? 'flex justify-center p-2' : ''
          }`}
        >
          {isSidebarCollapsed ? (
            <div className="relative" title="Gateway Active: Fail-Closed Enforced">
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <Lock className="h-4 w-4 text-kali-cyan" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span>Gateway Enforcing</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-400 font-medium">ONLINE</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Fail-closed zero-trust policy active
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
          className="fixed inset-0 z-50 flex md:hidden bg-black/80 backdrop-blur-md"
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

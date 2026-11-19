import React, { useState } from 'react';
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
  ChevronDown,
  Lock,
} from 'lucide-react';
import { useSecurityPlatform, type ActiveTabId } from '../../context/SecurityPlatformContext';
import { BrandLogo } from '../ui/BrandLogo';

interface NavGroup {
  label: string;
  collapsible?: boolean;
  items: {
    id: ActiveTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tag?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'agents', label: 'Agent Registry', icon: Bot },
      { id: 'tools', label: 'Tool Registry', icon: Wrench },
      { id: 'monitor', label: 'Live Monitoring', icon: Activity, tag: 'LIVE' },
    ],
  },
  {
    label: 'Security',
    items: [
      { id: 'delegations', label: 'Delegation Graph', icon: GitFork },
      { id: 'provenance', label: 'Provenance Explorer', icon: Network },
      { id: 'policies', label: 'Security Policies', icon: Shield },
      { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
    ],
  },
  {
    label: 'Activity',
    items: [
      { id: 'audit', label: 'Audit Trail', icon: FileCheck },
      { id: 'agent-runner', label: 'Agent Playground', icon: Layers },
    ],
  },
  {
    label: 'Extensions',
    collapsible: true,
    items: [
      { id: 'threat-map', label: 'Threat Radar', icon: Globe },
      { id: 'active-defense', label: 'Active Defense', icon: Skull },
      { id: 'reports', label: 'Forensic Reports', icon: FileText },
      { id: 'browser-shield', label: 'Browser Shield', icon: ShieldCheck },
      { id: 'endpoints', label: 'Endpoint Security', icon: Monitor },
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
    scrollToChapter,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  } = useSecurityPlatform();
  const [extensionsOpen, setExtensionsOpen] = useState(false);

  const handleSelectTab = (tabId: ActiveTabId) => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
    scrollToChapter(tabId);
  };

  const isExtensionTabActive = [
    'threat-map',
    'active-defense',
    'reports',
    'browser-shield',
    'endpoints',
    'integrations',
  ].includes(activeTab);

  const sidebarContent = (
    <aside
      className={`flex flex-col border-r border-[var(--line)] bg-[var(--card)] transition-all duration-200 select-none ${
        isSidebarCollapsed ? 'w-[68px]' : 'w-[250px]'
      } h-full shrink-0`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-[var(--line)] px-4">
        <button
          onClick={() => {
            scrollToChapter('overview');
          }}
          className="focus:outline-none text-left"
          title="CrossX Platform"
        >
          <BrandLogo
            size={isSidebarCollapsed ? 'sm' : 'md'}
            showText={!isSidebarCollapsed}
            showSubtitle={!isSidebarCollapsed}
          />
        </button>
        <button
          onClick={toggleSidebarCollapse}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line-2)] bg-[var(--bg)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--line)] transition-colors"
          title={isSidebarCollapsed ? 'Expand sidebar [Ctrl+B]' : 'Collapse sidebar [Ctrl+B]'}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-[var(--accent)]" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main Navigation">
        {navGroups.map((group) => {
          const isExtensionsGroup = group.label === 'Extensions';
          const isExpanded = isExtensionsGroup ? extensionsOpen || isExtensionTabActive : true;

          return (
            <div key={group.label} className="space-y-1">
              {!isSidebarCollapsed && (
                <div className="flex items-center justify-between px-3 pb-1 text-[11px] font-mono font-medium tracking-wider text-[var(--ink-3)] uppercase">
                  <span>{group.label}</span>
                  {group.collapsible && (
                    <button
                      onClick={() => setExtensionsOpen(!extensionsOpen)}
                      className="p-0.5 rounded text-[var(--ink-3)] hover:text-[var(--ink)]"
                      title="Toggle extensions menu"
                    >
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                </div>
              )}
              {isSidebarCollapsed && (
                <div className="mx-auto my-1.5 h-px w-6 bg-[var(--line)]" />
              )}

              {isExpanded && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        title={
                          isSidebarCollapsed
                            ? `${item.label} ${item.tag ? `[${item.tag}]` : ''}`
                            : undefined
                        }
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs transition-all ${
                          isActive
                            ? 'bg-[#E2E7EF] dark:bg-[#282E38] text-[#2A2E35] dark:text-[#ECEFF4] font-semibold shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),inset_-1px_-1px_2px_rgba(160,172,192,0.3)]'
                            : 'text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink)] font-normal'
                        } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--ink-3)] group-hover:text-[var(--ink)]'
                          }`}
                        />

                        {!isSidebarCollapsed && (
                          <span className="flex-1 truncate text-left">{item.label}</span>
                        )}

                        {!isSidebarCollapsed && item.tag && (
                          <span
                            className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-medium uppercase ${
                              isActive
                                ? 'bg-[var(--accent)] text-[var(--btn-ink)]'
                                : 'bg-[var(--bg-2)] text-[var(--ink-2)] border border-[var(--line-2)]'
                            }`}
                          >
                            {item.tag}
                          </span>
                        )}

                        {/* Tooltip for collapsed mode */}
                        {isSidebarCollapsed && (
                          <div className="absolute left-full ml-2 hidden rounded-md border border-[var(--line)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] shadow-md group-hover:block z-50 whitespace-nowrap pointer-events-none">
                            {item.label}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Gateway Status Footer */}
      <div className="border-t border-[var(--line)] p-3 bg-[var(--bg)]">
        <div
          className={`rounded-xl border border-[var(--line)] bg-[var(--card)] p-2.5 text-xs shadow-xs ${
            isSidebarCollapsed ? 'flex justify-center p-2' : ''
          }`}
        >
          {isSidebarCollapsed ? (
            <div className="relative" title="Gateway Active: Fail-Closed Enforced">
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
              </span>
              <Lock className="h-4 w-4 text-[var(--accent)]" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
                  </span>
                  <span>Zero-Trust Gateway</span>
                </div>
                <span className="font-mono text-[10px] text-[var(--accent-ink)] font-semibold bg-[var(--tint)] px-1.5 py-0.5 rounded border border-[var(--accent)]/30">
                  ONLINE
                </span>
              </div>
              <div className="text-[11px] text-[var(--ink-2)]">
                Fail-closed enforcement active
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
          className="fixed inset-0 z-50 flex md:hidden bg-black/40 backdrop-blur-xs"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div className="w-64 h-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;

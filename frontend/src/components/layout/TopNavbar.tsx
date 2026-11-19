import React, { useState, useEffect } from 'react';
import {
  Activity,
  Menu,
  Search,
  Building,
  User as UserIcon,
  LogOut,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { useSecurityPlatform, type ActiveTabId } from '../../context/SecurityPlatformContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { api } from '../../services/api.client';
import { SeverityBadge } from '../ui/Badge';
import { formatTimeOnly, truncateId } from '../../utils/formatters';

interface TabMeta {
  title: string;
  category: string;
}

const tabMetaMap: Record<ActiveTabId, TabMeta> = {
  overview: { title: 'Security Overview', category: 'Main' },
  agents: { title: 'Agent Registry', category: 'Main' },
  tools: { title: 'Tool Registry', category: 'Main' },
  monitor: { title: 'Live Monitoring', category: 'Main' },
  delegations: { title: 'Delegation Graph', category: 'Security' },
  provenance: { title: 'Provenance Explorer', category: 'Security' },
  policies: { title: 'Security Policies', category: 'Security' },
  incidents: { title: 'Security Incidents', category: 'Security' },
  audit: { title: 'Compliance Audit Trail', category: 'Activity' },
  'agent-runner': { title: 'Agent Playground', category: 'Activity' },
  'threat-map': { title: 'Threat Radar & Geolocation', category: 'Extensions' },
  'active-defense': { title: 'Active Defense', category: 'Extensions' },
  reports: { title: 'Forensic Reports', category: 'Extensions' },
  'browser-shield': { title: 'Browser Shield', category: 'Extensions' },
  endpoints: { title: 'Endpoint Security', category: 'Extensions' },
  integrations: { title: 'Integrations', category: 'Extensions' },
  settings: { title: 'Settings & Health', category: 'System' },
};

export const TopNavbar: React.FC = () => {
  const {
    activeTab,
    health,
    setIsMobileMenuOpen,
    setIsSearchOpen,
    selectedOrg,
    setSelectedOrg,
  } = useSecurityPlatform();
  const { user, logout } = useAuth();
  const { navigate } = useRouter();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Theme switch state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ferrow-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('ferrow-theme', next);
    } catch {
      // ignore
    }
  };

  const organizations = [
    { id: 'SOC-PRIMARY', label: 'SOC-PRIMARY (Default Cluster)' },
    { id: 'SOC-EMEA', label: 'SOC-EMEA (Regional Sentry)' },
    { id: 'SOC-ISOLATED', label: 'SOC-ISOLATED (Air-Gapped Unit)' },
  ];

  // Fetch real notifications/incidents periodically
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.listIncidents({ limit: 5 });
        if (Array.isArray(res)) {
          setNotifications(res);
        }
      } catch (err) {
        console.error('Failed to load notifications in top navbar:', err);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  const currentMeta = tabMetaMap[activeTab] || {
    title: activeTab,
    category: 'Console',
  };

  const isHealthOk = health?.status === 'healthy' || health?.status === 'ok';
  const unreadAlertsCount = notifications.filter(
    (n) => n.status === 'OPEN' || n.status === 'INVESTIGATING'
  ).length;

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-6 shrink-0 z-30 select-none text-[var(--ink)]">
      {/* Left: Mobile Toggle & Active Section Breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)]"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--ink-3)] hidden sm:inline">
            {currentMeta.category}
          </span>
          <span className="text-[var(--line-2)] hidden sm:inline">/</span>
          <h1 className="text-sm font-medium tracking-tight text-[var(--ink)]">
            {currentMeta.title}
          </h1>
        </div>
      </div>

      {/* Right: Quick actions, Search, Theme, Cluster & User Dropdowns */}
      <div className="flex items-center gap-3">
        {/* Search Bar Trigger */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--line-2)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--ink-2)] hover:border-[var(--line)] hover:text-[var(--ink)] transition-colors"
          title="Search telemetry and commands [Ctrl+K]"
        >
          <Search className="h-3.5 w-3.5 text-[var(--ink-3)]" />
          <span className="text-xs">Search console...</span>
          <kbd className="rounded border border-[var(--line-2)] bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-3)]">
            ⌘K
          </kbd>
        </button>

        {/* Global Cluster Selector */}
        <div className="relative hidden lg:block">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="flex items-center gap-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--line)] transition-colors"
            title="Active Security Cluster"
          >
            <Building className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span className="max-w-[120px] truncate">{selectedOrg}</span>
            <ChevronDown className="h-3 w-3 text-[var(--ink-3)]" />
          </button>

          {showOrgDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowOrgDropdown(false)}
              />
              <div className="absolute right-0 mt-1 w-64 rounded-xl border border-[var(--line)] bg-[var(--card)] p-1.5 shadow-lg z-50 text-xs">
                <div className="px-2 py-1 text-[10px] font-mono font-medium text-[var(--ink-3)] uppercase">
                  Active Defense Cluster
                </div>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrg(org.id);
                      setShowOrgDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                      selectedOrg === org.id
                        ? 'bg-[var(--tint)] text-[var(--accent-ink)] font-medium'
                        : 'text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <span className="truncate">{org.label}</span>
                    {selectedOrg === org.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle Button matching Ferrow design */}
        <button
          className="icon-btn"
          id="theme"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title="Toggle light/dark theme"
        >
          <svg
            className="moon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21.5 14.08C20.3 14.72 18.93 15.08 17.48 15.08C12.75 15.08 8.92 11.25 8.92 6.52C8.92 5.07 9.28 3.7 9.92 2.5C5.67 3.5 2.5 7.32 2.5 11.87C2.5 17.19 6.81 21.5 12.13 21.5C16.68 21.5 20.5 18.33 21.5 14.08Z" />
          </svg>
          <svg
            className="sun"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12Z" />
            <path d="M12 2V3.5M12 20.5V22M19.07 19.07L18.01 18.01M5.99 5.99L4.93 4.93M22 12H20.5M3.5 12H2M19.07 4.93L18.01 5.99M5.99 18.01L4.93 19.07" />
          </svg>
        </button>

        {/* Real-time Health Status Pill */}
        <div
          className="hidden md:flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--bg)] px-2.5 py-1 text-xs"
          title={`Gateway Status: ${health?.status || 'Active'}`}
        >
          <span className="relative flex h-2 w-2">
            {isHealthOk && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isHealthOk ? 'bg-[var(--accent)]' : 'bg-[#EF4444]'
              }`}
            ></span>
          </span>
          <span className="font-mono text-[11px] font-medium text-[var(--ink-2)]">
            {isHealthOk ? 'ENFORCING' : 'OFFLINE'}
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-2)] bg-[var(--bg)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
            title="Realtime Alerts Feed"
          >
            <Bell className="h-4 w-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white font-mono">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 shadow-xl z-50 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                  <span className="font-medium text-[var(--ink)]">Recent Security Alerts</span>
                  <span className="font-mono text-[10px] text-[var(--ink-3)]">
                    {notifications.length} events
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <div className="py-4 text-center text-[var(--ink-3)] text-xs">
                      No critical alerts reported.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setShowNotifDropdown(false);
                          const el = document.getElementById('incidents');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2 hover:border-[var(--line-2)] transition-colors space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-[var(--ink-3)]">
                            {truncateId(n.id)}
                          </span>
                          <SeverityBadge severity={n.severity} />
                        </div>
                        <div className="font-medium text-[var(--ink)] truncate">{n.title}</div>
                        <div className="text-[10px] text-[var(--ink-3)] font-mono">
                          {formatTimeOnly(n.created_at)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-[var(--line)] pt-2 text-center">
                  <button
                    onClick={() => {
                      setShowNotifDropdown(false);
                      const el = document.getElementById('incidents');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="text-[11px] text-[var(--accent-ink)] hover:underline font-medium"
                  >
                    View All Incidents
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile & Sign Out Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--line)] transition-colors"
          >
            <div className="h-5 w-5 rounded-full bg-[var(--tint)] flex items-center justify-center text-[var(--accent-ink)] font-semibold text-[10px]">
              {user?.username ? user.username[0].toUpperCase() : 'A'}
            </div>
            <span className="hidden sm:inline font-medium text-xs">
              {user?.username || 'Operator'}
            </span>
            <ChevronDown className="h-3 w-3 text-[var(--ink-3)]" />
          </button>

          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserDropdown(false)}
              />
              <div className="absolute right-0 mt-1 w-56 rounded-xl border border-[var(--line)] bg-[var(--card)] p-2 shadow-xl z-50 text-xs space-y-1">
                <div className="px-2 py-1.5 border-b border-[var(--line)] mb-1">
                  <div className="font-medium text-[var(--ink)]">{user?.username || 'Operator'}</div>
                  <div className="text-[10px] font-mono text-[var(--ink-3)]">
                    Role: {user?.role || 'SOC Lead'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    const el = document.getElementById('settings');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink)] transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Platform Diagnostics</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    navigate('/');
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink)] transition-colors"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>Landing Page</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#EF4444] hover:bg-[#FEF2F2] transition-colors border-t border-[var(--line)] mt-1"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;

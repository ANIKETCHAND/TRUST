import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Activity,
  Menu,
  Search,
  Building,
  User as UserIcon,
  LogOut,
  Bell,
  ChevronDown,
  ShieldAlert,
  Globe,
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
  overview: { title: 'Security Overview', category: 'Overview' },
  'threat-map': { title: 'Threat Radar & Geolocation', category: 'Overview' },
  'active-defense': { title: 'Active Defense', category: 'Overview' },
  agents: { title: 'Agent Management', category: 'Agent Security' },
  monitor: { title: 'Gateway Monitor', category: 'Agent Security' },
  tools: { title: 'Tool Registry', category: 'Agent Security' },
  policies: { title: 'Policy Engine', category: 'Agent Security' },
  delegations: { title: 'Delegation Control', category: 'Agent Security' },
  provenance: { title: 'Provenance Explorer', category: 'Agent Security' },
  'agent-runner': { title: 'Agent Playground', category: 'Agent Security' },
  incidents: { title: 'Incident Center', category: 'Threat Operations' },
  reports: { title: 'Forensic Dossiers & Reports', category: 'Threat Operations' },
  audit: { title: 'Security Audit Logs', category: 'Threat Operations' },
  'browser-shield': { title: 'Browser Shield', category: 'Protection' },
  endpoints: { title: 'Endpoint Security', category: 'Protection' },
  integrations: { title: 'Integrations', category: 'Protection' },
  settings: { title: 'Settings & Health', category: 'System' },
};

export const TopNavbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    autoRefresh,
    setAutoRefresh,
    triggerGlobalRefresh,
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
  const unreadAlertsCount = notifications.filter((n) => n.status === 'OPEN' || n.status === 'INVESTIGATING').length;

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/10 bg-black/80 px-6 backdrop-blur-xl shrink-0 z-30 select-none">
      {/* Left: Mobile toggle & Clean Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex md:hidden p-2 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium hidden sm:inline">
            CrossX
          </span>
          <span className="text-slate-600">/</span>
          <span className="text-kali-cyan font-medium">
            {currentMeta.category}
          </span>
          <span className="text-slate-600">/</span>
          <h1 className="text-xs font-semibold text-white tracking-wide truncate max-w-[200px] sm:max-w-xs md:max-w-none">
            {currentMeta.title}
          </h1>
        </div>
      </div>

      {/* Center: Search / Command Palette */}
      <div className="hidden lg:flex items-center max-w-sm w-full mx-6">
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between rounded-full border border-white/10 bg-white/[0.03] py-2 px-4 text-xs text-slate-400 hover:border-white/20 hover:bg-white/[0.05] hover:text-slate-200 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Search className="h-3.5 w-3.5 text-kali-cyan" />
            <span>Search or jump to...</span>
          </div>
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Gateway Health Indicator */}
        <div
          className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs"
          title="Gateway Enforcer Telemetry Status"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isHealthOk ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-slate-400">Gateway:</span>
          <span className={`font-semibold ${isHealthOk ? 'text-emerald-400' : 'text-amber-400'}`}>
            {health?.status ? health.status.toUpperCase() : 'ONLINE'}
          </span>
        </div>

        {/* Live Polling Toggle */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border transition-all ${
            autoRefresh
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
          }`}
          title="Toggle telemetry live polling"
        >
          <Activity className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
          <span className="hidden md:inline font-medium">{autoRefresh ? 'Live' : 'Paused'}</span>
        </button>

        {/* Global Manual Refresh Button */}
        <button
          onClick={triggerGlobalRefresh}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white transition-all"
          title="Trigger global refresh across all telemetry widgets"
        >
          <RefreshCw className="h-3.5 w-3.5 text-kali-cyan" />
          <span className="hidden md:inline font-medium">Sync</span>
        </button>

        {/* Return to Landing Page Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-kali-cyan/40 hover:text-white transition-all"
          title="Return to CrossX Landing Page"
        >
          <Globe className="h-3.5 w-3.5 text-kali-cyan" />
          <span className="hidden lg:inline font-medium">Landing</span>
        </button>

        {/* Notifications Center */}
        <div className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative flex items-center justify-center h-9 w-9 rounded-full border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white transition-all"
            title="Security Notifications"
            aria-label="Security Notifications"
          >
            <Bell className="h-4 w-4 text-slate-300" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div
              className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-[#0a0d14]/95 p-3 shadow-2xl z-50 animate-fade-in backdrop-blur-2xl"
              onMouseLeave={() => setShowNotifDropdown(false)}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 px-2">
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span>Security Alerts</span>
                </div>
                <span className="text-[11px] text-kali-cyan font-medium">{unreadAlertsCount} Active</span>
              </div>

              <div className="divide-y divide-white/5 max-h-64 overflow-y-auto py-1">
                {notifications.slice(0, 4).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setShowNotifDropdown(false);
                      setActiveTab('incidents');
                    }}
                    className="p-2.5 hover:bg-white/[0.04] cursor-pointer rounded-xl transition-all"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <SeverityBadge severity={notif.severity} />
                      <span className="text-[10px] text-slate-500">{formatTimeOnly(notif.created_at)}</span>
                    </div>
                    <div className="font-medium text-white text-xs mt-1.5 truncate">{notif.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      Agent: {truncateId(notif.agent_id || 'system', 8)}
                    </div>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No active notifications.
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-2 px-1 flex justify-center">
                <button
                  onClick={() => {
                    setShowNotifDropdown(false);
                    setActiveTab('incidents');
                  }}
                  className="text-kali-cyan hover:underline text-xs font-medium"
                >
                  View Incident Center
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Organization Selector */}
        <div className="relative hidden xl:block">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-300 hover:border-white/20 transition-all"
            title="Switch Tenant Context"
          >
            <Building className="h-3.5 w-3.5 text-kali-cyan" />
            <span className="font-medium">{selectedOrg}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {showOrgDropdown && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-[#0a0d14]/95 p-2 shadow-2xl z-50 animate-fade-in backdrop-blur-2xl text-xs"
              onMouseLeave={() => setShowOrgDropdown(false)}
            >
              <div className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-semibold border-b border-white/10">
                Tenant Context
              </div>
              <div className="space-y-1 mt-1">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrg(org.id);
                      setShowOrgDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-all ${
                      selectedOrg === org.id
                        ? 'bg-white/[0.08] text-white font-medium border-l-2 border-kali-cyan'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <span>{org.id}</span>
                    {selectedOrg === org.id && <span className="text-[10px] text-emerald-400 font-medium">Active</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile / Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs hover:border-white/20 transition-all"
            title="User Profile"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-kali-cyan/15 text-kali-cyan">
              <UserIcon className="h-3 w-3" />
            </div>
            <span className="text-slate-200 font-medium">{user?.username || 'admin'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-kali-cyan border border-white/10 uppercase">
              {user?.role?.toUpperCase() || 'ADMIN'}
            </span>
          </button>

          {/* User Dropdown */}
          {showUserDropdown && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[#0a0d14]/95 p-2 shadow-2xl z-50 animate-fade-in backdrop-blur-2xl"
              onMouseLeave={() => setShowUserDropdown(false)}
            >
              <div className="border-b border-white/10 pb-2.5 px-3 pt-1.5">
                <div className="text-xs font-semibold text-white">{user?.username || 'admin'}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Role: {user?.role?.toUpperCase() || 'ADMINISTRATOR'}</div>
              </div>
              <div className="pt-2 space-y-1">
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    navigate('/');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.04] hover:text-white transition-all"
                >
                  <Globe className="h-3.5 w-3.5 text-kali-cyan" />
                  <span>Landing Page</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                    navigate('/login');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

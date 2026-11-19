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
    <header className="flex h-16 items-center justify-between border-b border-[#E5EAF1] bg-white px-6 shrink-0 z-30 select-none">
      {/* Left: Mobile toggle & Clean Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex md:hidden p-2 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] hover:text-[#1E293B]"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
          <span className="text-[#64748B] font-semibold hidden sm:inline">
            AgentTrust
          </span>
          <span className="text-[#CBD5E1]">/</span>
          <span className="text-[#64748B] font-medium">
            {currentMeta.category}
          </span>
          <span className="text-[#CBD5E1]">/</span>
          <h1 className="text-xs font-semibold text-[#1E293B] tracking-tight truncate max-w-[200px] sm:max-w-xs md:max-w-none">
            {currentMeta.title}
          </h1>
        </nav>
      </div>

      {/* Center: Search / Command Palette */}
      <div className="hidden lg:flex items-center max-w-sm w-full mx-6">
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] py-1.5 px-3.5 text-xs text-[#64748B] hover:border-[#CBD5E1] hover:bg-white hover:text-[#1E293B] transition-all shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Search or jump to...</span>
          </div>
          <kbd className="rounded border border-[#E5EAF1] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#94A3B8]">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Gateway Health Indicator */}
        <div
          className="hidden sm:flex items-center gap-2 rounded-full border border-[#E5EAF1] bg-[#F8FAFC] px-3 py-1.5 text-xs"
          title="Gateway Telemetry Status"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isHealthOk ? 'bg-[#16A34A] animate-pulse' : 'bg-[#F59E0B]'
            }`}
          />
          <span className="text-[#64748B]">Gateway:</span>
          <span className={`font-semibold ${isHealthOk ? 'text-[#16A34A]' : 'text-[#F59E0B]'}`}>
            {health?.status ? health.status.toUpperCase() : 'HEALTHY'}
          </span>
        </div>

        {/* Live Polling Toggle */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition-all ${
            autoRefresh
              ? 'border-[#BCE8CD] bg-[#E8F7EF] text-[#16A34A]'
              : 'border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] hover:text-[#1E293B] hover:bg-white'
          }`}
          title="Toggle telemetry live stream"
        >
          <Activity className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
          <span className="hidden md:inline font-medium">{autoRefresh ? 'Live' : 'Paused'}</span>
        </button>

        {/* Global Manual Refresh Button */}
        <button
          onClick={triggerGlobalRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#64748B] hover:border-[#CBD5E1] hover:bg-white hover:text-[#1E293B] transition-all"
          title="Trigger sync across all telemetry panels"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#3B82F6]" />
          <span className="hidden md:inline font-medium">Sync</span>
        </button>

        {/* Return to Landing Page Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#64748B] hover:border-[#3B82F6]/50 hover:text-[#3B82F6] hover:bg-white transition-all"
          title="Return to Landing Page"
        >
          <Globe className="h-3.5 w-3.5 text-[#3B82F6]" />
          <span className="hidden lg:inline font-medium">Landing</span>
        </button>

        {/* Notifications Center */}
        <div className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative flex items-center justify-center h-8 w-8 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#1E293B] hover:bg-white transition-all"
            title="Security Notifications"
            aria-label="Security Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[10px] font-bold text-white shadow-xs">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div
              className="absolute right-0 mt-2 w-80 rounded-xl border border-[#E5EAF1] bg-white p-3 shadow-lg z-50 animate-fade-in"
              onMouseLeave={() => setShowNotifDropdown(false)}
            >
              <div className="flex items-center justify-between border-b border-[#E5EAF1] pb-2 px-1">
                <div className="text-xs font-semibold text-[#1E293B] flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#DC2626]" />
                  <span>Security Alerts</span>
                </div>
                <span className="text-[11px] text-[#3B82F6] font-medium">{unreadAlertsCount} Active</span>
              </div>

              <div className="divide-y divide-[#F1F5F9] max-h-64 overflow-y-auto py-1">
                {notifications.slice(0, 4).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setShowNotifDropdown(false);
                      setActiveTab('incidents');
                    }}
                    className="p-2.5 hover:bg-[#F8FAFC] cursor-pointer rounded-lg transition-all"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <SeverityBadge severity={notif.severity} />
                      <span className="text-[10px] text-[#94A3B8]">{formatTimeOnly(notif.created_at)}</span>
                    </div>
                    <div className="font-medium text-[#1E293B] text-xs mt-1.5 truncate">{notif.title}</div>
                    <div className="text-[11px] text-[#64748B] mt-0.5 truncate">
                      Agent: {truncateId(notif.agent_id || 'system', 8)}
                    </div>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div className="py-6 text-center text-xs text-[#64748B]">
                    No active notifications.
                  </div>
                )}
              </div>

              <div className="border-t border-[#E5EAF1] pt-2 px-1 flex justify-center">
                <button
                  onClick={() => {
                    setShowNotifDropdown(false);
                    setActiveTab('incidents');
                  }}
                  className="text-[#3B82F6] hover:underline text-xs font-medium"
                >
                  View All Incidents
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Organization Selector */}
        <div className="relative hidden xl:block">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="flex items-center gap-2 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] px-3 py-1.5 text-xs text-[#64748B] hover:border-[#CBD5E1] hover:text-[#1E293B] hover:bg-white transition-all"
            title="Switch Tenant Context"
          >
            <Building className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span className="font-medium text-[#1E293B]">{selectedOrg}</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
          </button>

          {showOrgDropdown && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-xl border border-[#E5EAF1] bg-white p-2 shadow-lg z-50 animate-fade-in text-xs"
              onMouseLeave={() => setShowOrgDropdown(false)}
            >
              <div className="px-3 py-1.5 text-[10px] text-[#94A3B8] uppercase font-semibold border-b border-[#E5EAF1]">
                Tenant Cluster
              </div>
              <div className="space-y-0.5 mt-1">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrg(org.id);
                      setShowOrgDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all ${
                      selectedOrg === org.id
                        ? 'bg-[#EEF4FF] text-[#3B82F6] font-medium'
                        : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1E293B]'
                    }`}
                  >
                    <span>{org.id}</span>
                    {selectedOrg === org.id && <span className="text-[10px] text-[#16A34A] font-semibold">Active</span>}
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
            className="flex items-center gap-2 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs hover:border-[#CBD5E1] hover:bg-white transition-all"
            title="User Profile"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF4FF] text-[#3B82F6]">
              <UserIcon className="h-3 w-3" />
            </div>
            <span className="text-[#1E293B] font-medium">{user?.username || 'admin'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#EEF4FF] text-[#3B82F6] font-semibold border border-[#D4E5FF] uppercase">
              {user?.role?.toUpperCase() || 'ADMIN'}
            </span>
          </button>

          {/* User Dropdown */}
          {showUserDropdown && (
            <div
              className="absolute right-0 mt-2 w-52 rounded-xl border border-[#E5EAF1] bg-white p-2 shadow-lg z-50 animate-fade-in"
              onMouseLeave={() => setShowUserDropdown(false)}
            >
              <div className="border-b border-[#E5EAF1] pb-2 px-3 pt-1">
                <div className="text-xs font-semibold text-[#1E293B]">{user?.username || 'admin'}</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">Role: {user?.role?.toUpperCase() || 'ADMINISTRATOR'}</div>
              </div>
              <div className="pt-1.5 space-y-0.5">
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    navigate('/');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1E293B] transition-all"
                >
                  <Globe className="h-3.5 w-3.5 text-[#3B82F6]" />
                  <span>Landing Page</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                    navigate('/login');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] transition-all"
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

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
} from 'lucide-react';
import { useSecurityPlatform, type ActiveTabId } from '../../context/SecurityPlatformContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api.client';
import { SeverityBadge } from '../ui/Badge';
import { formatTimeOnly, truncateId } from '../../utils/formatters';

interface TabMeta {
  title: string;
  category: string;
}

const tabMetaMap: Record<ActiveTabId, TabMeta> = {
  overview: { title: 'Security Posture Overview', category: 'OVERVIEW' },
  'threat-map': { title: 'Threat Radar & Geolocation', category: 'OVERVIEW' },
  'active-defense': { title: 'Active Defense & Process Killer', category: 'OVERVIEW' },
  agents: { title: 'Agent Management & Identity', category: 'AGENT_SECURITY' },
  monitor: { title: 'Gateway Telemetry Monitor', category: 'AGENT_SECURITY' },
  tools: { title: 'Protected Tool Registry', category: 'AGENT_SECURITY' },
  policies: { title: 'Deterministic Policy Engine', category: 'AGENT_SECURITY' },
  delegations: { title: 'Delegation Control Graph', category: 'AGENT_SECURITY' },
  provenance: { title: 'Data Provenance & Lineage', category: 'AGENT_SECURITY' },
  'agent-runner': { title: 'Agent Sandbox Playground', category: 'AGENT_SECURITY' },
  incidents: { title: 'SOC Incident Center', category: 'THREAT_OPERATIONS' },
  reports: { title: 'Forensic Dossier & Threat Intel', category: 'THREAT_OPERATIONS' },
  audit: { title: 'Security Audit Logs & Events', category: 'THREAT_OPERATIONS' },
  'browser-shield': { title: 'Browser Shield DLP Extension', category: 'PROTECTION' },
  endpoints: { title: 'Endpoint Security Sentry', category: 'PROTECTION' },
  integrations: { title: 'Integration Center & Defense Mesh', category: 'PROTECTION' },
  settings: { title: 'System Health & Settings', category: 'ADMINISTRATION' },
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
    title: activeTab.toUpperCase(),
    category: 'CONSOLE',
  };

  const isHealthOk = health?.status === 'healthy' || health?.status === 'ok';
  const unreadAlertsCount = notifications.filter((n) => n.status === 'OPEN' || n.status === 'INVESTIGATING').length;

  return (
    <header className="flex h-14 items-center justify-between border-b border-kali-border bg-kali-bg/95 px-4 md:px-6 backdrop-blur-md shrink-0 z-30 select-none">
      {/* Left: Mobile toggle & Technical Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex md:hidden p-1.5 rounded border border-kali-border bg-kali-card text-slate-300 hover:text-white"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-slate-400 font-semibold tracking-wide hidden sm:inline">
            AGENTTRUST //
          </span>
          <span className="text-kali-primary font-bold tracking-wide">
            {currentMeta.category}
          </span>
          <span className="text-slate-400">/</span>
          <h1 className="text-xs font-semibold text-white tracking-wide truncate max-w-[200px] sm:max-w-xs md:max-w-none">
            {currentMeta.title}
          </h1>
        </div>
      </div>

      {/* Center: Command Palette Trigger Button / Search */}
      <div className="hidden lg:flex items-center max-w-xs w-full mx-4">
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between rounded-md border border-kali-border bg-kali-card/80 py-1.5 px-3 font-mono text-xs text-slate-400 hover:border-kali-primary hover:bg-kali-secondary hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-kali-cyan" />
            <span>Search or jump...</span>
          </div>
          <kbd className="rounded border border-kali-border bg-kali-bg px-1.5 py-0.5 text-[10px] text-slate-400">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Telemetry, Refresh, Notifications, Gateway Health, Profile */}
      <div className="flex items-center gap-2.5 font-mono text-xs">
        {/* Gateway Health Indicator */}
        <div
          className="hidden sm:flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-2.5 py-1 text-[11px]"
          title="Gateway Enforcer Telemetry Status"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isHealthOk ? 'bg-kali-secure animate-pulse' : 'bg-kali-warning'
            }`}
          />
          <span className="text-slate-400 font-mono">GW:</span>
          <span className={`font-bold font-mono ${isHealthOk ? 'text-kali-secure' : 'text-kali-warning'}`}>
            {health?.status ? health.status.toUpperCase() : 'ONLINE'}
          </span>
        </div>

        {/* Live Polling Toggle */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] border font-mono transition-colors ${
            autoRefresh
              ? 'border-kali-secure/50 bg-[#0E2E22] text-kali-secure'
              : 'border-kali-border bg-kali-card text-slate-400'
          }`}
          title="Toggle telemetry background polling"
        >
          <Activity className={`h-3 w-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
          <span className="hidden md:inline">{autoRefresh ? 'LIVE POLLING' : 'PAUSED'}</span>
        </button>

        {/* Global Manual Refresh Button */}
        <button
          onClick={triggerGlobalRefresh}
          className="flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-2.5 py-1 text-[11px] text-slate-300 hover:border-kali-primary hover:bg-kali-elevated hover:text-white transition-colors"
          title="Trigger global refresh across all telemetry widgets"
        >
          <RefreshCw className="h-3 w-3 text-kali-cyan" />
          <span className="hidden md:inline">SYNC</span>
        </button>

        {/* Notifications Center */}
        <div className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative flex items-center justify-center h-8 w-8 rounded border border-kali-border bg-kali-card text-slate-300 hover:border-kali-primary hover:text-white transition-colors"
            title="SOC Security Alerts & Notifications"
            aria-label="Security Notifications"
          >
            <Bell className="h-3.5 w-3.5 text-kali-cyan" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-kali-critical text-[9px] font-bold text-white shadow-sm">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div
              className="absolute right-0 mt-2 w-80 rounded-lg border border-kali-border bg-kali-secondary p-2 shadow-2xl z-50 animate-fade-in font-mono"
              onMouseLeave={() => setShowNotifDropdown(false)}
            >
              <div className="flex items-center justify-between border-b border-kali-border pb-2 px-2 pt-1">
                <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-kali-critical" />
                  <span>SECURITY NOTIFICATIONS</span>
                </div>
                <span className="text-[10px] text-kali-cyan font-bold">{unreadAlertsCount} ACTIVE</span>
              </div>

              <div className="divide-y divide-kali-border/50 max-h-64 overflow-y-auto py-1">
                {notifications.slice(0, 4).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setShowNotifDropdown(false);
                      setActiveTab('incidents');
                    }}
                    className="p-2 hover:bg-kali-card/80 cursor-pointer rounded transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <SeverityBadge severity={notif.severity} />
                      <span className="text-[10px] text-slate-400">{formatTimeOnly(notif.created_at)}</span>
                    </div>
                    <div className="font-semibold text-white text-xs mt-1 truncate">{notif.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Agent: {truncateId(notif.agent_id || 'system', 8)} • Status: {notif.status}
                    </div>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div className="py-6 text-center text-[11px] text-slate-500">
                    No open security notifications.
                  </div>
                )}
              </div>

              <div className="border-t border-kali-border pt-1.5 px-1 flex justify-between items-center text-[10px]">
                <button
                  onClick={() => {
                    setShowNotifDropdown(false);
                    setActiveTab('incidents');
                  }}
                  className="text-kali-primary hover:text-kali-cyan font-bold"
                >
                  VIEW INCIDENT CENTER ›
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Organization Selector */}
        <div className="relative hidden xl:block">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-2.5 py-1 text-[11px] text-slate-300 hover:border-kali-primary transition-colors"
            title="Switch Organization / Tenant Context"
          >
            <Building className="h-3 w-3 text-kali-primary" />
            <span className="font-bold">{selectedOrg}</span>
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </button>

          {showOrgDropdown && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-lg border border-kali-border bg-kali-secondary p-1.5 shadow-2xl z-50 animate-fade-in font-mono text-xs"
              onMouseLeave={() => setShowOrgDropdown(false)}
            >
              <div className="px-2 py-1 text-[10px] text-slate-400 font-bold border-b border-kali-border/60">
                ACTIVE TENANT CONTEXT
              </div>
              <div className="space-y-1 mt-1">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrg(org.id);
                      setShowOrgDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors ${
                      selectedOrg === org.id
                        ? 'bg-kali-elevated text-white font-bold border-l-2 border-kali-primary'
                        : 'text-slate-300 hover:bg-kali-card hover:text-white'
                    }`}
                  >
                    <span>{org.id}</span>
                    {selectedOrg === org.id && <span className="text-[10px] text-kali-secure font-bold">ACTIVE</span>}
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
            className="flex items-center gap-2 rounded border border-kali-border bg-kali-card px-2.5 py-1 text-[11px] hover:border-kali-primary transition-colors"
            title="Operator Identity & RBAC"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-kali-primary/20 text-kali-primary">
              <UserIcon className="h-3 w-3" />
            </div>
            <span className="text-slate-200 font-semibold">{user?.username || 'admin'}</span>
            <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-kali-bg text-kali-cyan border border-kali-border">
              {user?.role?.toUpperCase() || 'ADMIN'}
            </span>
          </button>

          {/* User Dropdown */}
          {showUserDropdown && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-lg border border-kali-border bg-kali-secondary p-2 shadow-2xl z-50 animate-fade-in font-mono"
              onMouseLeave={() => setShowUserDropdown(false)}
            >
              <div className="border-b border-kali-border pb-2 px-2 pt-1">
                <div className="text-[11px] font-bold text-white">{user?.username || 'admin'}</div>
                <div className="text-[10px] text-slate-400">ROLE: {user?.role?.toUpperCase() || 'ADMINISTRATOR'}</div>
                <div className="text-[10px] text-kali-cyan">MODE: ZERO_TRUST_ENFORCED</div>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-kali-critical hover:bg-[#331418] transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>TERMINATE SESSION</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../services/api.client';

export type PlatformTab =
  | 'overview'
  | 'threat-map'
  | 'active-defense'
  | 'agents'
  | 'tools'
  | 'monitor'
  | 'delegations'
  | 'provenance'
  | 'policies'
  | 'endpoints'
  | 'browser-shield'
  | 'integrations'
  | 'incidents'
  | 'reports'
  | 'audit'
  | 'agent-runner'
  | 'settings';

export type ActiveTabId = PlatformTab;

export interface SecurityPlatformContextValue {
  activeTab: PlatformTab;
  setActiveTab: (tab: PlatformTab) => void;
  isAutoPolling: boolean;
  autoRefresh: boolean;
  toggleAutoPolling: () => void;
  setAutoRefresh: (val: boolean) => void;
  refreshInterval: number;
  setRefreshInterval: (val: number) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  triggerGlobalRefresh: () => void;
  health: any;
  checkHealth: () => Promise<void>;
  isSidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
  selectedOrg: string;
  setSelectedOrg: (org: string) => void;
}

const SecurityPlatformContext = createContext<SecurityPlatformContextValue | undefined>(undefined);

export const SecurityPlatformProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<PlatformTab>('overview');
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [health, setHealth] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState('SOC-PRIMARY');

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const triggerGlobalRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const toggleAutoPolling = useCallback(() => {
    setIsAutoPolling((prev) => !prev);
  }, []);

  const setAutoRefresh = useCallback((val: boolean) => {
    setIsAutoPolling(val);
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const res = await api.getHealth();
      setHealth(res);
    } catch (err) {
      console.error('Failed to query platform health:', err);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Global keyboard shortcuts (Ctrl+B for sidebar, Ctrl+K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebarCollapse();
      }
      // Ctrl+K: Toggle Command Palette / Search
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleSearch();
      }
      // ESC: Close search if open
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebarCollapse, toggleSearch]);

  return (
    <SecurityPlatformContext.Provider
      value={{
        activeTab,
        setActiveTab,
        isAutoPolling,
        autoRefresh: isAutoPolling,
        toggleAutoPolling,
        setAutoRefresh,
        refreshInterval,
        setRefreshInterval,
        refreshTrigger,
        triggerRefresh,
        triggerGlobalRefresh,
        health,
        checkHealth,
        isSidebarCollapsed,
        toggleSidebarCollapse,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isSearchOpen,
        setIsSearchOpen,
        toggleSearch,
        selectedOrg,
        setSelectedOrg,
      }}
    >
      {children}
    </SecurityPlatformContext.Provider>
  );
};

export const useSecurityPlatform = () => {
  const context = useContext(SecurityPlatformContext);
  if (!context) {
    throw new Error('useSecurityPlatform must be used within a SecurityPlatformProvider');
  }
  return context;
};

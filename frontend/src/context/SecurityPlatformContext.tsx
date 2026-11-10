import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../services/api.client';

export type PlatformTab =
  | 'overview'
  | 'agents'
  | 'tools'
  | 'monitor'
  | 'delegations'
  | 'provenance'
  | 'policies'
  | 'endpoints'
  | 'browser-shield'
  | 'incidents'
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
}

const SecurityPlatformContext = createContext<SecurityPlatformContextValue | undefined>(undefined);

export const SecurityPlatformProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<PlatformTab>('overview');
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [health, setHealth] = useState<any>(null);

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

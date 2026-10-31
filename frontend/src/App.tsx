import React from 'react';
import { ToastProvider } from './context/ToastContext';
import { SecurityPlatformProvider, useSecurityPlatform } from './context/SecurityPlatformContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';

import { OverviewTab } from './components/tabs/OverviewTab';
import { AgentsTab } from './components/tabs/AgentsTab';
import { ToolsTab } from './components/tabs/ToolsTab';
import { LiveMonitoringTab } from './components/tabs/LiveMonitoringTab';
import { DelegationTab } from './components/tabs/DelegationTab';
import { ProvenanceTab } from './components/tabs/ProvenanceTab';
import { PoliciesTab } from './components/tabs/PoliciesTab';
import { IncidentsTab } from './components/tabs/IncidentsTab';
import { AuditTab } from './components/tabs/AuditTab';
import { AgentRunnerTab } from './components/tabs/AgentRunnerTab';
import { SettingsTab } from './components/tabs/SettingsTab';

const TabRouter: React.FC = () => {
  const { activeTab } = useSecurityPlatform();

  switch (activeTab) {
    case 'overview':
      return <OverviewTab />;
    case 'agents':
      return <AgentsTab />;
    case 'tools':
      return <ToolsTab />;
    case 'monitor':
      return <LiveMonitoringTab />;
    case 'delegations':
      return <DelegationTab />;
    case 'provenance':
      return <ProvenanceTab />;
    case 'policies':
      return <PoliciesTab />;
    case 'incidents':
      return <IncidentsTab />;
    case 'audit':
      return <AuditTab />;
    case 'agent-runner':
      return <AgentRunnerTab />;
    case 'settings':
      return <SettingsTab />;
    default:
      return <OverviewTab />;
  }
};

const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cyber-bg text-slate-100 font-sans">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            <ErrorBoundary>
              <TabRouter />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SecurityPlatformProvider>
          <DashboardLayout />
        </SecurityPlatformProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

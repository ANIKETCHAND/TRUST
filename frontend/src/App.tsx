import React from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SecurityPlatformProvider, useSecurityPlatform } from './context/SecurityPlatformContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { LoginScreen } from './components/auth/LoginScreen';
import { BrandLogo } from './components/ui/BrandLogo';

import { OverviewTab } from './components/tabs/OverviewTab';
import { ThreatMapTab } from './components/tabs/ThreatMapTab';
import { ActiveDefenseTab } from './components/tabs/ActiveDefenseTab';
import { ReportsTab } from './components/tabs/ReportsTab';
import { AgentsTab } from './components/tabs/AgentsTab';
import { ToolsTab } from './components/tabs/ToolsTab';
import { LiveMonitoringTab } from './components/tabs/LiveMonitoringTab';
import { EndpointsTab } from './components/tabs/EndpointsTab';
import { BrowserShieldTab } from './components/tabs/BrowserShieldTab';
import { DelegationTab } from './components/tabs/DelegationTab';
import { ProvenanceTab } from './components/tabs/ProvenanceTab';
import { PoliciesTab } from './components/tabs/PoliciesTab';
import { IncidentsTab } from './components/tabs/IncidentsTab';
import { AuditTab } from './components/tabs/AuditTab';
import { AgentRunnerTab } from './components/tabs/AgentRunnerTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { IntegrationsTab } from './components/tabs/IntegrationsTab';
import { GlobalSearchModal } from './components/ui/GlobalSearchModal';

const TabRouter: React.FC = () => {
  const { activeTab } = useSecurityPlatform();

  switch (activeTab) {
    case 'overview':
      return <OverviewTab />;
    case 'threat-map':
      return <ThreatMapTab />;
    case 'active-defense':
      return <ActiveDefenseTab />;
    case 'agents':
      return <AgentsTab />;
    case 'tools':
      return <ToolsTab />;
    case 'monitor':
      return <LiveMonitoringTab />;
    case 'endpoints':
      return <EndpointsTab />;
    case 'browser-shield':
      return <BrowserShieldTab />;
    case 'delegations':
      return <DelegationTab />;
    case 'provenance':
      return <ProvenanceTab />;
    case 'policies':
      return <PoliciesTab />;
    case 'incidents':
      return <IncidentsTab />;
    case 'reports':
      return <ReportsTab />;
    case 'audit':
      return <AuditTab />;
    case 'agent-runner':
      return <AgentRunnerTab />;
    case 'integrations':
      return <IntegrationsTab />;
    case 'settings':
      return <SettingsTab />;
    default:
      return <OverviewTab />;
  }
};

const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-kali-bg text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-kali-bg">
          <div className="mx-auto max-w-[1600px] space-y-6">
            <ErrorBoundary>
              <TabRouter />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <GlobalSearchModal />
    </div>
  );
};

const AuthenticatedConsole: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-kali-bg text-kali-cyan font-mono text-xs gap-4">
        <BrandLogo size="lg" showSubtitle={false} />
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-kali-primary animate-ping" />
          <span className="tracking-widest">VERIFYING AGENTTRUST CONTROL PLANE SESSION...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <SecurityPlatformProvider>
      <DashboardLayout />
    </SecurityPlatformProvider>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AuthenticatedConsole />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

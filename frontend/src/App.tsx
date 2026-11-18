import React, { useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { SecurityPlatformProvider, useSecurityPlatform } from './context/SecurityPlatformContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { LoginScreen } from './components/auth/LoginScreen';
import { LandingPage } from './components/landing/LandingPage';
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
    <div className="flex h-screen w-screen overflow-hidden bg-black text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-5 md:p-8 bg-black">
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

const NotFoundScreen: React.FC = () => {
  const { pathname, navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-slate-100 p-4 relative select-none">
      <div className="absolute inset-0 soc-grid-bg opacity-20 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-8 shadow-2xl text-center space-y-5">
        <div className="flex justify-center">
          <BrandLogo size="md" />
        </div>
        <div>
          <div className="text-4xl font-bold text-white tracking-tight font-mono">404</div>
          <h2 className="text-base font-semibold text-white mt-1">Page Not Found</h2>
        </div>
        <p className="text-slate-400 text-xs leading-relaxed">
          The requested path <code className="text-kali-cyan bg-white/5 px-2 py-0.5 rounded border border-white/10">{pathname}</code> does not exist on this console.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue text-white font-medium hover:opacity-95 transition-all shadow-kali-glow"
            >
              Dashboard
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue text-white font-medium hover:opacity-95 transition-all shadow-kali-glow"
            >
              Sign In
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white hover:border-white/20 transition-all"
          >
            Landing Page
          </button>
        </div>
      </div>
    </div>
  );
};

const AppFlowRouter: React.FC = () => {
  const { isLandingPage, isLoginPage, isDashboardRoute, isNotFound, navigate } = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Route guard: redirect unauthenticated users attempting to access dashboard or subroutes
  useEffect(() => {
    if (!isLoading && !isAuthenticated && isDashboardRoute) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, isDashboardRoute, navigate]);

  if (isLoading && !isLandingPage) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-slate-400 text-xs gap-4">
        <BrandLogo size="lg" showSubtitle={false} />
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-kali-cyan animate-pulse" />
          <span className="text-slate-400">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (isLandingPage) {
    return <LandingPage />;
  }

  if (isLoginPage) {
    return <LoginScreen />;
  }

  if (isNotFound) {
    return <NotFoundScreen />;
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
          <RouterProvider>
            <AppFlowRouter />
          </RouterProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

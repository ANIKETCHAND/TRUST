import React, { useEffect, useRef } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { SecurityPlatformProvider, useSecurityPlatform, type PlatformTab } from './context/SecurityPlatformContext';
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

interface DashboardChapter {
  id: PlatformTab;
  no: string;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  Component: React.ComponentType;
}

const DASHBOARD_CHAPTERS: DashboardChapter[] = [
  {
    id: 'overview',
    no: '01',
    category: 'Main',
    title: 'Security Overview',
    subtitle: 'Realtime Telemetry & Health',
    description: 'High-level executive metrics, gateway operational status, threat radar, and active agent health.',
    Component: OverviewTab,
  },
  {
    id: 'agents',
    no: '02',
    category: 'Main',
    title: 'Agent Registry',
    subtitle: 'Autonomous Entities & Identities',
    description: 'Cryptographically registered AI agents, assigned trust tiers, containment states, and capabilities.',
    Component: AgentsTab,
  },
  {
    id: 'tools',
    no: '03',
    category: 'Main',
    title: 'Tool Registry',
    subtitle: 'Permissions & Execution Bounds',
    description: 'External tools, API integrations, and sandbox policies available to autonomous agents.',
    Component: ToolsTab,
  },
  {
    id: 'monitor',
    no: '04',
    category: 'Main',
    title: 'Live Monitoring',
    subtitle: 'Event Stream & Gateway Telemetry',
    description: 'Live streaming WebSocket feed of tool invocations, prompt inspections, and zero-trust policy evaluations.',
    Component: LiveMonitoringTab,
  },
  {
    id: 'delegations',
    no: '05',
    category: 'Security',
    title: 'Delegation Graph',
    subtitle: 'Cascades & Boundary Constraints',
    description: 'Interactive visualization of inter-agent task handoffs, depth limits, and privilege boundary scopes.',
    Component: DelegationTab,
  },
  {
    id: 'provenance',
    no: '06',
    category: 'Security',
    title: 'Provenance Explorer',
    subtitle: 'End-to-End Decision Lineage',
    description: 'Trace upstream prompts, memory recall, and model parameters that led to an execution event.',
    Component: ProvenanceTab,
  },
  {
    id: 'policies',
    no: '07',
    category: 'Security',
    title: 'Security Policies',
    subtitle: 'Zero-Trust Contracts & Guardrails',
    description: 'Active and dry-run guardrails covering prompt injection, tool isolation, and rate bounds.',
    Component: PoliciesTab,
  },
  {
    id: 'incidents',
    no: '08',
    category: 'Security',
    title: 'Security Incidents',
    subtitle: 'Triage & Containment Center',
    description: 'Automated threat containment alerts, anomalous agent behaviors, and quarantined executions.',
    Component: IncidentsTab,
  },
  {
    id: 'audit',
    no: '09',
    category: 'Activity',
    title: 'Compliance Audit Trail',
    subtitle: 'Cryptographic Event Verification',
    description: 'Tamper-evident logs of all security decisions with SHA-256 integrity proofs.',
    Component: AuditTab,
  },
  {
    id: 'agent-runner',
    no: '10',
    category: 'Activity',
    title: 'Agent Playground',
    subtitle: 'Sandbox Testing & Simulation',
    description: 'Test agent prompts against CrossX security guardrails with real-time policy evaluation.',
    Component: AgentRunnerTab,
  },
  {
    id: 'threat-map',
    no: '11',
    category: 'Extensions',
    title: 'Threat Radar & Geolocation',
    subtitle: 'Global Threat Telemetry',
    description: 'Visual map of incoming adversary probes, anomalous tool abuse, and regional cluster sentries.',
    Component: ThreatMapTab,
  },
  {
    id: 'active-defense',
    no: '12',
    category: 'Extensions',
    title: 'Active Defense',
    subtitle: 'Automated Countermeasures & Decoys',
    description: 'Synthetic honeypots, prompt canary tokens, and dynamic policy reconfiguration.',
    Component: ActiveDefenseTab,
  },
  {
    id: 'reports',
    no: '13',
    category: 'Extensions',
    title: 'Forensic Reports',
    subtitle: 'Deep Attack Reconstruction',
    description: 'Comprehensive forensic breakdowns of security incidents and root-cause attribution.',
    Component: ReportsTab,
  },
  {
    id: 'browser-shield',
    no: '14',
    category: 'Extensions',
    title: 'Browser Shield',
    subtitle: 'Web Sandbox & Scraping Isolation',
    description: 'Isolation proxy protecting agents browsing external web pages from indirect prompt injections.',
    Component: BrowserShieldTab,
  },
  {
    id: 'endpoints',
    no: '15',
    category: 'Extensions',
    title: 'Endpoint Security',
    subtitle: 'Host & Node Containment',
    description: 'Host-level monitoring for rogue system process executions and file-system tampering.',
    Component: EndpointsTab,
  },
  {
    id: 'integrations',
    no: '16',
    category: 'Extensions',
    title: 'Integrations',
    subtitle: 'SIEM & Tool Ecosystem Connectors',
    description: 'Export events to Splunk, Datadog, Slack, or webhook endpoints with zero-trust envelope.',
    Component: IntegrationsTab,
  },
  {
    id: 'settings',
    no: '17',
    category: 'System',
    title: 'Settings & Health',
    subtitle: 'Cluster Configuration & API Keys',
    description: 'Manage gateway fail-closed modes, cluster secrets, maintenance status, and diagnostics.',
    Component: SettingsTab,
  },
];

const ContinuousDashboard: React.FC = () => {
  const { activeTab, setActiveTab, scrollToChapter, isProgrammaticScrollRef } = useSecurityPlatform();
  const mainRef = useRef<HTMLElement | null>(null);
  const initialScrollDoneRef = useRef<boolean>(false);

  // Initial mount scroll: if direct URL loaded (e.g. /threat-radar or /policies), jump to it immediately
  useEffect(() => {
    if (initialScrollDoneRef.current) return;
    initialScrollDoneRef.current = true;

    if (activeTab && activeTab !== 'overview') {
      const el = document.getElementById(activeTab);
      if (el) {
        scrollToChapter(activeTab, true);
      }
    }
  }, [activeTab, scrollToChapter]);

  // Attach scrollend listener to clear programmatic scroll lock early once smooth scroll settles
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const handleScrollEnd = () => {
      isProgrammaticScrollRef.current = false;
    };

    mainEl.addEventListener('scrollend', handleScrollEnd, { passive: true });
    return () => mainEl.removeEventListener('scrollend', handleScrollEnd);
  }, [isProgrammaticScrollRef]);

  // Scroll spy: Track which chapter is in view as user scrolls manually
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    let ticking = false;
    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          // 1. Boundary check: Near top of container
          if (mainEl.scrollTop <= 60) {
            const firstTab = DASHBOARD_CHAPTERS[0].id;
            if (activeTab !== firstTab) {
              setActiveTab(firstTab, { replace: true });
            }
            ticking = false;
            return;
          }

          // 2. Boundary check: Near bottom of container
          if (mainEl.scrollTop + mainEl.clientHeight >= mainEl.scrollHeight - 50) {
            const lastTab = DASHBOARD_CHAPTERS[DASHBOARD_CHAPTERS.length - 1].id;
            if (activeTab !== lastTab) {
              setActiveTab(lastTab, { replace: true });
            }
            ticking = false;
            return;
          }

          // 3. Middle chapters: Find which chapter occupies the reading band
          const containerRect = mainEl.getBoundingClientRect();
          const targetOffset = containerRect.top + 140;

          let detectedTab: PlatformTab | null = null;
          for (const ch of DASHBOARD_CHAPTERS) {
            const el = document.getElementById(ch.id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= targetOffset + 60 && rect.bottom > targetOffset) {
                detectedTab = ch.id;
                break;
              }
            }
          }

          if (detectedTab && detectedTab !== activeTab) {
            setActiveTab(detectedTab, { replace: true });
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, [activeTab, setActiveTab, isProgrammaticScrollRef]);

  return (
    <main
      ref={mainRef}
      className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 bg-transparent text-[var(--ink)] scroll-smooth"
    >
      <div className="mx-auto max-w-[1600px] space-y-16 pb-28">
        {DASHBOARD_CHAPTERS.map((chapter) => {
          const TabComponent = chapter.Component;
          return (
            <section
              key={chapter.id}
              id={chapter.id}
              data-tab={chapter.id}
              className="dashboard-chapter"
            >
              {/* Ferrow Chapter Head */}
              <div className="dashboard-chapter-head">
                <div className="dashboard-chapter-meta">
                  <div className="dashboard-chapter-no">
                    <span>{chapter.no}</span>
                    {chapter.category}
                  </div>
                  <h2 className="text-xl md:text-2xl font-medium tracking-tight text-[var(--ink)]">
                    {chapter.title} <span className="muted">/ {chapter.subtitle}</span>
                  </h2>
                  <p className="text-xs md:text-sm text-[var(--ink-2)] max-w-2xl">
                    {chapter.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`#${chapter.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToChapter(chapter.id);
                    }}
                    className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-[var(--line-2)] bg-[var(--card)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--line)] transition-colors"
                  >
                    #{chapter.id}
                  </a>
                </div>
              </div>

              {/* Tab Component Inside Card Container */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 md:p-6 shadow-[0_4px_20px_rgba(90,105,130,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <ErrorBoundary>
                  <TabComponent />
                </ErrorBoundary>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
};

const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent text-[var(--ink)] font-sans antialiased">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNavbar />
        <ContinuousDashboard />
      </div>
      <GlobalSearchModal />
    </div>
  );
};

const NotFoundScreen: React.FC = () => {
  const { pathname, navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-transparent text-[var(--ink)] p-4 relative select-none">
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 shadow-[0_10px_30px_rgba(90,105,130,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] text-center space-y-5">
        <div className="flex justify-center">
          <BrandLogo size="md" />
        </div>
        <div>
          <div className="text-4xl font-mono font-medium text-[var(--ink)] tracking-tight">404</div>
          <h2 className="text-base font-medium text-[var(--ink)] mt-1">Page Not Found</h2>
        </div>
        <p className="text-[var(--ink-2)] text-xs leading-relaxed">
          The requested path{' '}
          <code className="text-[var(--accent-ink)] bg-[var(--tint)] px-2 py-0.5 rounded border border-[var(--line-2)] font-mono">
            {pathname}
          </code>{' '}
          does not exist on this console.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-sm w-full sm:w-auto"
            >
              Go to SOC Console
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="btn btn-sm w-full sm:w-auto"
            >
              Sign In
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="btn ghost btn-sm w-full sm:w-auto"
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
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[var(--bg)] text-[var(--ink-2)] text-xs gap-4">
        <BrandLogo size="lg" showSubtitle={false} />
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[var(--ink-2)]">Verifying session...</span>
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

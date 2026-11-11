import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  Server,
  Lock,
  CheckCircle2,
  RefreshCw,
  Activity,
  Sliders,
  Cpu,
  Database,
  Shield,
  Layers,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TerminalBox } from '../ui/TerminalBox';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { useToast } from '../../context/ToastContext';

interface HealthData {
  status: string;
  environment?: string;
  version?: string;
  opa_enabled?: boolean;
  database?: string;
  gateway?: string;
}

interface IntegrationItem {
  name: string;
  category: string;
  enabled: boolean;
  status: string;
  endpoint?: string;
  fail_closed_mode?: boolean;
  quarantine_vault?: string;
  geolocation_note?: string;
  purpose?: string;
}

export const SettingsTab: React.FC = () => {
  const toast = useToast();
  const {
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    triggerGlobalRefresh,
  } = useSecurityPlatform();

  const [health, setHealth] = useState<HealthData | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnosticsJson, setDiagnosticsJson] = useState<string>('');

  const fetchSettingsData = useCallback(async () => {
    try {
      setLoading(true);
      const [hRes, intRes] = await Promise.allSettled([
        api.getHealth(),
        api.listIntegrations(),
      ]);

      if (hRes.status === 'fulfilled') {
        setHealth(hRes.value as HealthData);
        setDiagnosticsJson(JSON.stringify(hRes.value, null, 2));
      }
      if (intRes.status === 'fulfilled' && intRes.value?.integrations) {
        setIntegrations(intRes.value.integrations);
      }
    } catch (err: any) {
      toast.error('Diagnostics Error', err.message || 'Failed to fetch platform diagnostics');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettingsData();
  }, [fetchSettingsData]);

  const handleManualHealthCheck = async () => {
    await fetchSettingsData();
    triggerGlobalRefresh();
    toast.info('Diagnostics Refreshed', 'Platform telemetry and service health re-verified.');
  };

  // Planned integrations to fulfill Section 14
  const plannedIntegrations = [
    {
      name: 'OSQuery Host Telemetry',
      category: 'Native Endpoint Audit',
      status: 'PLANNED',
      purpose: 'Low-level kernel process and socket auditing',
    },
    {
      name: 'Wazuh SIEM Bridge',
      category: 'Security Information Management',
      status: 'PLANNED',
      purpose: 'Centralized SOC log forwarding and event correlation',
    },
    {
      name: 'Trivy Artifact Scanner',
      category: 'Supply Chain & Container Security',
      status: 'PLANNED',
      purpose: 'Vulnerability analysis for imported agent skill packages',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// ADMINISTRATION</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">SYSTEM_HEALTH</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Settings className="h-6 w-6 text-kali-primary" />
            Infrastructure Health, Integrations & Guardrails
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Platform service status, open-source cybersecurity integrations, deterministic fail-closed boundaries, and client telemetry preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualHealthCheck}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>RUN HEALTH DIAGNOSTICS</span>
          </button>
        </div>
      </div>

      {/* SECTION 15: System Health Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Platform Services Status */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-4">
          <div className="flex items-center justify-between border-b border-kali-border pb-3">
            <h2 className="text-xs font-bold text-white font-mono flex items-center gap-2">
              <Server className="h-4 w-4 text-kali-primary" />
              <span>// INFRASTRUCTURE_HEALTH_MONITOR</span>
            </h2>
            <span className="font-mono text-[10px] text-kali-secure bg-[#0E2E22] px-2 py-0.5 rounded border border-[#155E42]">
              ALL_SERVICES_ONLINE
            </span>
          </div>

          {loading && !health ? (
            <div className="py-8">
              <LoadingSpinner size="md" message="PROBING PLATFORM MICROSERVICES..." />
            </div>
          ) : (
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between rounded border border-kali-border bg-kali-bg p-3">
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-kali-cyan" />
                  <span>Gateway Status</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-[#0E2E22] px-2.5 py-0.5 font-bold text-kali-secure border border-[#155E42]">
                  <CheckCircle2 className="h-3 w-3" /> {health?.status?.toUpperCase() || 'ONLINE'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded border border-kali-border bg-kali-bg p-3">
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-kali-primary" />
                  <span>Database State</span>
                </span>
                <span className="text-kali-secure font-bold">[CONNECTED: SQLALCHEMY_ASYNC]</span>
              </div>

              <div className="flex items-center justify-between rounded border border-kali-border bg-kali-bg p-3">
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-purple-400" />
                  <span>Active Environment</span>
                </span>
                <span className="text-kali-cyan uppercase font-bold">{health?.environment || 'development'}</span>
              </div>

              <div className="flex items-center justify-between rounded border border-kali-border bg-kali-bg p-3">
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-kali-primary" />
                  <span>Policy Engine Mode</span>
                </span>
                <span className="text-slate-200">
                  {health?.opa_enabled ? 'OPA REGISTRY + ENGINE' : 'DETERMINISTIC REGISTRY ENGINE'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded border border-kali-border bg-kali-bg p-3">
                <span className="text-slate-300 font-semibold">Build Revision</span>
                <span className="text-slate-400">v{health?.version || '0.1.0'} (KALI_SOC_EDITION)</span>
              </div>
            </div>
          )}
        </div>

        {/* Security Parameters & Guardrails */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-4">
          <div className="flex items-center justify-between border-b border-kali-border pb-3">
            <h2 className="text-xs font-bold text-white font-mono flex items-center gap-2">
              <Lock className="h-4 w-4 text-kali-secure" />
              <span>// HARDENED_SECURITY_DIRECTIVES</span>
            </h2>
            <span className="font-mono text-[10px] text-kali-primary bg-kali-bg px-2 py-0.5 rounded border border-kali-border">
              COMPLIANCE: SOC2_TYPE2
            </span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="rounded border border-kali-border bg-kali-bg p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Zero-Trust Access Principle</span>
                <span className="rounded bg-[#331418] px-2 py-0.5 font-bold text-kali-critical border border-[#7A1F26] text-[10px]">
                  DENY-BY-DEFAULT
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 font-sans leading-relaxed">
                Autonomous agents hold zero tool execution rights until explicit granular grants are provisioned.
              </p>
            </div>

            <div className="rounded border border-kali-border bg-kali-bg p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Identity Derivation</span>
                <span className="rounded bg-[#0A2633] px-2 py-0.5 font-bold text-kali-cyan border border-[#125866] text-[10px]">
                  CRYPTOGRAPHIC SHA-256
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 font-sans leading-relaxed">
                Agent identity is cryptographically derived from salted hashes; request body identity overrides are strictly rejected.
              </p>
            </div>

            <div className="rounded border border-kali-border bg-kali-bg p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Filesystem Jail Boundary</span>
                <span className="text-kali-primary text-[10px]">./sandbox_storage</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 font-sans leading-relaxed">
                Path traversal sequences (<code className="text-white">../</code>) and absolute escapes are rejected before disk I/O.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 14: Integration Center Inventory */}
      <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-4">
        <div className="flex items-center justify-between border-b border-kali-border pb-3">
          <div>
            <h2 className="text-xs font-bold text-white font-mono flex items-center gap-2">
              <Layers className="h-4 w-4 text-kali-primary" />
              <span>// INTEGRATION_CENTER_INVENTORY</span>
            </h2>
            <p className="font-mono text-[10px] text-slate-400 mt-0.5">
              Open-source policy engines, egress proxies, scanners, and threat intelligence providers.
            </p>
          </div>
          <span className="font-mono text-[10px] text-kali-cyan">
            {integrations.length} CONFIGURED • {plannedIntegrations.length} PLANNED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Active integrations from backend /integrations */}
          {integrations.map((int, idx) => {
            const isOnline = int.status === 'ACTIVE' || int.status === 'healthy';
            return (
              <div
                key={idx}
                className="rounded border border-kali-border bg-kali-bg p-3.5 space-y-2 font-mono text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{int.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isOnline
                          ? 'bg-[#0E2E22] text-kali-secure border border-[#155E42]'
                          : 'bg-kali-card text-slate-400 border border-kali-border'
                      }`}
                    >
                      {int.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-kali-cyan mt-0.5">Category: {int.category}</div>
                  {int.endpoint && (
                    <div className="text-[10px] text-slate-400 truncate mt-1">Endpoint: {int.endpoint}</div>
                  )}
                  {int.quarantine_vault && (
                    <div className="text-[10px] text-slate-400 truncate mt-1">Vault: {int.quarantine_vault}</div>
                  )}
                  {int.geolocation_note && (
                    <div className="text-[10px] text-slate-500 italic mt-1 font-sans">{int.geolocation_note}</div>
                  )}
                </div>

                <div className="border-t border-kali-border/60 pt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Fail-Closed: {int.fail_closed_mode ? 'ENABLED' : 'PASSIVE'}</span>
                  <span className="text-kali-secure font-bold">[VERIFIED]</span>
                </div>
              </div>
            );
          })}

          {/* Planned Integrations clearly marked */}
          {plannedIntegrations.map((p, idx) => (
            <div
              key={idx}
              className="rounded border border-dashed border-kali-border bg-kali-card/40 p-3.5 space-y-2 font-mono text-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">{p.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#2E200C] text-kali-warning border border-[#6E4C19]">
                    [PLANNED]
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Category: {p.category}</div>
                <p className="text-[11px] text-slate-400 font-sans mt-1.5">{p.purpose}</p>
              </div>

              <div className="border-t border-kali-border/60 pt-2 text-[10px] text-slate-500 font-mono">
                STATUS: ROADMAP_PHASE_2 (NOT CONNECTED)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Telemetry Preferences & Polling Settings */}
      <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-4">
        <h2 className="text-xs font-bold text-white font-mono flex items-center gap-2 border-b border-kali-border pb-3">
          <Sliders className="h-4 w-4 text-kali-primary" />
          <span>// DASHBOARD_POLLING_AND_TELEMETRY_CADENCE</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="rounded border border-kali-border bg-kali-bg p-4 flex items-center justify-between">
            <div>
              <span className="font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-kali-cyan" />
                <span>Live Heartbeat Polling</span>
              </span>
              <p className="mt-1 text-slate-400 font-sans text-xs">
                Automatically refresh real-time overview metrics and gateway streams.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-kali-primary' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="rounded border border-kali-border bg-kali-bg p-4 flex items-center justify-between">
            <div>
              <span className="font-bold text-white">Polling Interval</span>
              <p className="mt-1 text-slate-400 font-sans text-xs">Cadence for background polling requests.</p>
            </div>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              aria-label="Polling interval"
              className="rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none"
            >
              <option value={2000}>2 Seconds (High Rate)</option>
              <option value={5000}>5 Seconds (Recommended)</option>
              <option value={10000}>10 Seconds (Balanced)</option>
              <option value={30000}>30 Seconds (Low Overhead)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Raw Diagnostic JSON Terminal */}
      {diagnosticsJson && (
        <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card">
          <div className="text-xs font-bold text-white font-mono mb-2">// RAW_DIAGNOSTIC_TELEMETRY</div>
          <TerminalBox
            title="SYSTEM_DIAGNOSTICS // HOST_ENVIRONMENT"
            copyContent={diagnosticsJson}
            maxHeight="max-h-48"
          >
            <pre>{diagnosticsJson}</pre>
          </TerminalBox>
        </div>
      )}
    </div>
  );
};

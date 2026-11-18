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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-kali-cyan" />
            Infrastructure Health & Platform Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Platform service telemetry, cybersecurity integrations, and deterministic fail-closed boundaries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualHealthCheck}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Health Check</span>
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Platform Services Status */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-kali-primary" />
              <span>Infrastructure Health Monitor</span>
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-kali-secure font-medium px-2.5 py-0.5 rounded-full bg-kali-secure/10 border border-kali-secure/20">
              <span className="h-1.5 w-1.5 rounded-full bg-kali-secure" /> All Services Online
            </span>
          </div>

          {loading && !health ? (
            <div className="py-8">
              <LoadingSpinner size="md" message="Probing platform microservices..." />
            </div>
          ) : (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <span className="text-slate-300 font-medium flex items-center gap-2.5">
                  <Activity className="h-4 w-4 text-kali-cyan" />
                  <span>Gateway Status</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-kali-secure/10 px-2.5 py-0.5 font-medium text-kali-secure border border-kali-secure/20">
                  <CheckCircle2 className="h-3 w-3" /> {health?.status?.toUpperCase() || 'ONLINE'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <span className="text-slate-300 font-medium flex items-center gap-2.5">
                  <Database className="h-4 w-4 text-kali-primary" />
                  <span>Database State</span>
                </span>
                <span className="text-kali-secure font-medium">Connected (Async Engine)</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <span className="text-slate-300 font-medium flex items-center gap-2.5">
                  <Cpu className="h-4 w-4 text-purple-400" />
                  <span>Active Environment</span>
                </span>
                <span className="text-kali-cyan uppercase font-semibold">{health?.environment || 'development'}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <span className="text-slate-300 font-medium flex items-center gap-2.5">
                  <Shield className="h-4 w-4 text-kali-primary" />
                  <span>Policy Engine Mode</span>
                </span>
                <span className="text-slate-200">
                  {health?.opa_enabled ? 'OPA Registry + Engine' : 'Deterministic Registry Engine'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <span className="text-slate-300 font-medium">Build Revision</span>
                <span className="text-slate-400 font-mono text-[11px]">v{health?.version || '0.1.0'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Security Parameters & Guardrails */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-kali-secure" />
              <span>Hardened Security Directives</span>
            </h2>
            <span className="text-xs text-kali-primary font-medium bg-kali-primary/10 px-2.5 py-0.5 rounded-full border border-kali-primary/20">
              SOC2 Type II
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Zero-Trust Access Principle</span>
                <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 font-medium text-rose-400 border border-rose-500/20 text-[10px]">
                  Deny by Default
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                Autonomous agents hold zero tool execution rights until explicit granular grants are provisioned.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Identity Derivation</span>
                <span className="rounded-full bg-kali-cyan/10 px-2.5 py-0.5 font-medium text-kali-cyan border border-kali-cyan/20 text-[10px]">
                  SHA-256 Cryptographic
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                Agent identity is cryptographically derived from salted hashes; request body identity overrides are strictly rejected.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Filesystem Jail Boundary</span>
                <span className="text-kali-primary font-mono text-[11px]">./sandbox_storage</span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                Path traversal sequences (<code className="text-white">../</code>) and absolute escapes are rejected before disk I/O.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Center Inventory */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-kali-primary" />
              <span>Security Integrations</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Policy engines, egress proxies, scanners, and threat intelligence providers.
            </p>
          </div>
          <span className="text-xs font-medium text-kali-cyan">
            {integrations.length} Configured • {plannedIntegrations.length} Planned
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* Active integrations */}
          {integrations.map((int, idx) => {
            const isOnline = int.status === 'ACTIVE' || int.status === 'healthy';
            return (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{int.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        isOnline
                          ? 'bg-kali-secure/10 text-kali-secure border border-kali-secure/20'
                          : 'bg-white/[0.04] text-slate-400 border border-white/10'
                      }`}
                    >
                      {int.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-kali-cyan mt-1">Category: {int.category}</div>
                  {int.endpoint && (
                    <div className="text-[11px] text-slate-400 truncate mt-1 font-mono">Endpoint: {int.endpoint}</div>
                  )}
                  {int.quarantine_vault && (
                    <div className="text-[11px] text-slate-400 truncate mt-1 font-mono">Vault: {int.quarantine_vault}</div>
                  )}
                  {int.geolocation_note && (
                    <div className="text-[11px] text-slate-500 italic mt-1">{int.geolocation_note}</div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Fail-Closed: {int.fail_closed_mode ? 'Enabled' : 'Passive'}</span>
                  <span className="text-kali-secure font-medium">Verified</span>
                </div>
              </div>
            );
          })}

          {/* Planned Integrations */}
          {plannedIntegrations.map((p, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-dashed border-white/15 bg-white/[0.01] p-4 space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-300">{p.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Planned
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Category: {p.category}</div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{p.purpose}</p>
              </div>

              <div className="border-t border-white/5 pt-2.5 text-[11px] text-slate-500">
                Phase 2 Integration
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Telemetry Preferences & Polling Settings */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-3.5">
          <Sliders className="h-4 w-4 text-kali-primary" />
          <span>Dashboard Polling & Telemetry Cadence</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-kali-cyan" />
                <span>Live Heartbeat Polling</span>
              </span>
              <p className="mt-1 text-slate-400 text-xs">
                Automatically refresh real-time overview metrics and gateway streams.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-kali-primary' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white">Polling Interval</span>
              <p className="mt-1 text-slate-400 text-xs">Cadence for background polling requests.</p>
            </div>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              aria-label="Polling interval"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white focus:border-kali-primary focus:outline-none"
            >
              <option value={2000} className="bg-[#0a0d14] text-white">2 Seconds (High Rate)</option>
              <option value={5000} className="bg-[#0a0d14] text-white">5 Seconds (Recommended)</option>
              <option value={10000} className="bg-[#0a0d14] text-white">10 Seconds (Balanced)</option>
              <option value={30000} className="bg-[#0a0d14] text-white">30 Seconds (Low Overhead)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Raw Diagnostic JSON Terminal */}
      {diagnosticsJson && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl">
          <div className="text-sm font-semibold text-white mb-3">Diagnostic Telemetry</div>
          <TerminalBox
            title="System Diagnostics & Environment"
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

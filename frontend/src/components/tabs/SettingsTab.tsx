import React, { useEffect, useState, useCallback } from 'react';
import { Settings, Server, Lock, CheckCircle2, RefreshCw, Activity, Sliders } from 'lucide-react';
import { api } from '../../services/api.client';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { useToast } from '../../context/ToastContext';

interface HealthData {
  status: string;
  environment?: string;
  version?: string;
  opa_enabled?: boolean;
}

export const SettingsTab: React.FC = () => {
  const { showToast } = useToast();
  const { autoRefresh, setAutoRefresh, refreshInterval, setRefreshInterval, triggerGlobalRefresh } =
    useSecurityPlatform();

  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getHealth();
      setHealth(res as HealthData);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch platform health', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleManualHealthCheck = async () => {
    await fetchHealth();
    triggerGlobalRefresh();
    showToast('Platform diagnostics updated.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Settings className="h-7 w-7 text-cyan-400" />
            Platform Configuration & System Health
          </h1>
          <p className="text-sm text-slate-400">
            System status, security policies, external OPA bridge, and sandboxed storage boundaries.
          </p>
        </div>
        <button
          onClick={handleManualHealthCheck}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Run Health Diagnostics
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* System Health */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Server className="h-4 w-4 text-cyan-400" />
            Platform Services Status
          </h2>

          {loading && !health ? (
            <div className="py-8">
              <LoadingSpinner size="md" message="Probing platform services..." />
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-slate-950 p-3 border border-slate-800">
                <span className="font-semibold text-slate-300">Gateway Status</span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-950 px-2.5 py-0.5 font-bold text-emerald-400 border border-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {health?.status?.toUpperCase() || 'ONLINE'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-950 p-3 border border-slate-800">
                <span className="font-semibold text-slate-300">Active Environment</span>
                <span className="font-mono text-cyan-300 uppercase">{health?.environment || 'development'}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-950 p-3 border border-slate-800">
                <span className="font-semibold text-slate-300">Platform Build Version</span>
                <span className="font-mono text-slate-400">v{health?.version || '0.1.0'}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-950 p-3 border border-slate-800">
                <span className="font-semibold text-slate-300">Policy Engine Mode</span>
                <span className="font-mono text-slate-300">
                  {health?.opa_enabled ? 'OPA REGISTRY + ENGINE' : 'DETERMINISTIC REGISTRY ENGINE'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Security Parameters */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="h-4 w-4 text-emerald-400" />
            Security Guardrails & Hardening
          </h2>

          <div className="space-y-3 text-xs">
            <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Default Access Model</span>
                <span className="rounded bg-rose-950 px-2 py-0.5 font-bold text-rose-400 border border-rose-800">
                  DENY-BY-DEFAULT
                </span>
              </div>
              <p className="mt-1 text-slate-500">
                AI agents possess zero permissions until explicit granular grants are created.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Identity Derivation</span>
                <span className="rounded bg-cyan-950 px-2 py-0.5 font-bold text-cyan-400 border border-cyan-800">
                  CRYPTOGRAPHIC TOKENS
                </span>
              </div>
              <p className="mt-1 text-slate-500">
                Agent identity is derived from SHA-256 hashed credentials; body parameters are never trusted.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Filesystem Sandbox Jail</span>
                <span className="font-mono text-slate-300">./sandbox_storage</span>
              </div>
              <p className="mt-1 text-slate-500">
                Strict path boundary enforcement prevents directory traversal (../) attacks.
              </p>
            </div>
          </div>
        </div>

        {/* Client Real-Time Telemetry Settings */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur space-y-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="h-4 w-4 text-cyan-400" />
            Dashboard Polling & Monitoring Preferences
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  Live Polling Mode
                </span>
                <p className="mt-1 text-slate-400">
                  Automatically refresh overview metrics and monitoring streams.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoRefresh ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">Refresh Interval</span>
                <p className="mt-1 text-slate-400">Cadence for background polling requests.</p>
              </div>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                aria-label="Refresh interval"
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value={2000}>2 Seconds</option>
                <option value={5000}>5 Seconds (Recommended)</option>
                <option value={10000}>10 Seconds</option>
                <option value={30000}>30 Seconds</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

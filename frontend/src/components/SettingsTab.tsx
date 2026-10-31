import React, { useEffect, useState } from 'react';
import { Settings, Server, Lock, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

export const SettingsTab: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await api.getHealth();
      setHealth(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

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
          onClick={fetchHealth}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Check Health
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* System Health */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Server className="h-4 w-4 text-cyan-400" />
            Platform Services Status
          </h2>

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
              <span className="font-semibold text-slate-300">Open Policy Agent (OPA) Integration</span>
              <span className="font-mono text-slate-400">
                {health?.opa_enabled ? 'CONNECTED' : 'STANDALONE DETERMINISTIC ENGINE'}
              </span>
            </div>
          </div>
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
      </div>
    </div>
  );
};

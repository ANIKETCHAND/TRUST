import React, { useState, useEffect } from 'react';
import {
  Globe,
  Shield,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Play,
  Lock,
  Layers,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';

export const BrowserShieldTab: React.FC = () => {
  const { error: toastError, success: toastSuccess } = useToast();
  const [status, setStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Pre-flight prompt tester state
  const [testUrl, setTestUrl] = useState('https://chatgpt.com/c/work-session');
  const [testPrompt, setTestPrompt] = useState(
    'Please summarize our cloud infrastructure using credentials: agk_live_super_secret_token_prod_991823'
  );
  const [evaluating, setEvaluating] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getBrowserShieldStatus();
      setStatus(res);
    } catch (err: any) {
      toastError(`Failed to query Browser Shield status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestSubmit = async () => {
    if (!testPrompt.trim()) return;

    try {
      setEvaluating(true);
      setTestResult(null);
      const res = await api.checkBrowserAction({
        target_url: testUrl,
        prompt_text: testPrompt,
        action_type: 'submit_prompt',
      });
      setTestResult(res);
      if (res.decision === 'BLOCKED') {
        toastError(`Pre-flight Check: ${res.reason}`);
      } else {
        toastSuccess('Pre-flight Check: Prompt allowed by security policy.');
      }
    } catch (err: any) {
      toastError(`Evaluation error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Globe className="h-6 w-6 text-cyan-400" />
            AgentTrust Browser Shield Console
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Manifest V3 browser protection surface for enterprise AI web workflows and DLP pre-flight inspection.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Protection Status"
          value={status?.status === 'active' ? 'ACTIVE' : 'READY'}
          icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />}
          description="Pre-submission prompt inspection enabled"
        />
        <StatCard
          label="Supported AI Services"
          value={status?.supported_workflows?.length || 4}
          icon={<Layers className="h-5 w-5 text-cyan-400" />}
          description="ChatGPT, Claude & Local AI Gateways"
        />
        <StatCard
          label="Enforcement Model"
          value="PRE-FLIGHT"
          icon={<Lock className="h-5 w-5 text-purple-400" />}
          description="Blocks PII & token exfiltration before egress"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Pre-flight Prompt Inspection Simulator */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="h-4 w-4 text-cyan-400" />
              Pre-Flight Action Simulator
            </h2>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-mono">
              Live Gateway Policy Engine
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Simulates the exact pre-submission intercept check performed by the Browser Shield content script before an
            agent prompt reaches third-party LLMs.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target AI Application URL</label>
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Prompt Payload</label>
            <textarea
              rows={4}
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-xs text-white font-mono"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleTestSubmit}
              disabled={evaluating}
              className="flex items-center gap-2 rounded bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
            >
              <Shield className="h-3.5 w-3.5" />
              {evaluating ? 'Inspecting...' : 'Test Pre-Flight Intercept'}
            </button>
          </div>

          {/* Result Output */}
          {testResult && (
            <div
              className={`rounded-lg p-4 border text-xs space-y-2 mt-4 ${
                testResult.decision === 'BLOCKED'
                  ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-sm">
                <span className="flex items-center gap-1.5">
                  {testResult.decision === 'BLOCKED' ? (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  )}
                  Decision: {testResult.decision}
                </span>
                {testResult.incident_id && (
                  <span className="text-[10px] font-mono text-rose-300">
                    Incident ID: {testResult.incident_id.slice(0, 8)}...
                  </span>
                )}
              </div>
              <p className="font-medium">{testResult.reason}</p>
              {testResult.findings?.length > 0 && (
                <div className="bg-slate-950/80 rounded p-2 text-[11px] font-mono text-slate-300">
                  Detected Finding: {testResult.findings[0].description} (Pattern:{' '}
                  {testResult.findings[0].pattern})
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Supported Platform Matrix & Boundaries */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              <Layers className="h-4 w-4 text-cyan-400" />
              Supported AI Workflow Platform Matrix
            </h2>

            <div className="space-y-2 text-xs">
              {status?.supported_workflows?.map((wf: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/80 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <div>
                      <div className="font-semibold text-white">{wf.service}</div>
                      <div className="font-mono text-slate-400 text-[11px]">{wf.domain}</div>
                    </div>
                  </div>
                  <span className="rounded bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                    PROTECTED
                  </span>
                </div>
              ))}
            </div>

            {/* Trust Boundary Documentation */}
            <div className="rounded-lg bg-slate-950 p-4 border border-slate-800/80 text-xs space-y-2 mt-4">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Explicit Enforcement Boundary
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                The Browser Shield uses minimal permissions (Manifest V3) strictly bounded to supported AI web tabs. It
                does not claim visibility into arbitrary native operating system traffic or native native agents outside
                the browser.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

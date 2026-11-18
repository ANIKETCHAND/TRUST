import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Shield,
  CheckCircle,
  XCircle,
  Play,
  Layers,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';
import { truncateId } from '../../utils/formatters';

export const BrowserShieldTab: React.FC = () => {
  const toast = useToast();
  const [status, setStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Pre-flight prompt tester state
  const [testUrl, setTestUrl] = useState('https://chatgpt.com/c/work-session');
  const [testPrompt, setTestPrompt] = useState(
    'Please summarize our internal cloud infrastructure using credentials: agk_live_super_secret_token_prod_991823'
  );
  const [evaluating, setEvaluating] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getBrowserShieldStatus();
      setStatus(res);
    } catch (err: any) {
      toast.error('Browser Shield Error', `Failed to query status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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
        toast.error('Pre-flight Blocked', res.reason || 'DLP token exfiltration rule violated.');
      } else {
        toast.success('Pre-flight Verified', 'Prompt compliant with security policy.');
      }
    } catch (err: any) {
      toast.error('Evaluation Error', err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const isProtectionActive = status?.status === 'active' || status?.enrolled;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Globe className="h-6 w-6 text-kali-cyan" />
            Browser Shield & Prompt DLP
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Client-side browser extension for pre-submission prompt inspection, secret redaction, and exfiltration prevention.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Connection Status KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Enrollment Status"
          value={isProtectionActive ? 'Enrolled' : 'Disconnected'}
          subValue={isProtectionActive ? 'Active' : 'Offline'}
          subValueColor={isProtectionActive ? 'text-emerald-400' : 'text-amber-400'}
          description={isProtectionActive ? 'Extension paired and reporting' : 'Requires extension setup'}
          icon={<Globe className="h-4 w-4 text-kali-cyan" />}
        />
        <StatCard
          label="Target Engine"
          value="Chromium (MV3)"
          subValue="Supported"
          subValueColor="text-kali-cyan"
          description="Chrome, Brave, Edge"
          icon={<Layers className="h-4 w-4 text-kali-primary" />}
        />
        <StatCard
          label="Active DLP Rules"
          value={status?.rules_count ?? 8}
          subValue="Enforced"
          subValueColor="text-emerald-400"
          description="API keys, PII, sensitive tokens"
          icon={<Shield className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          label="Interceptions"
          value={status?.interceptions_count ?? 0}
          subValue="Blocked"
          subValueColor="text-rose-400"
          description="Exfiltrations prevented"
          icon={<Shield className="h-4 w-4 text-rose-400" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Pre-Flight Prompt Simulator */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-kali-cyan">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Pre-Submission DLP Simulator</h2>
                <p className="text-xs text-slate-400">Test prompt redaction and exfiltration rules</p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-400">
              DLP Engine
            </span>
          </div>

          <div className="text-xs space-y-4">
            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Target AI Application URL</label>
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Prompt Payload Body</label>
              <textarea
                rows={4}
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-kali-cyan focus:border-kali-cyan focus:outline-none font-mono text-xs"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleTestSubmit}
                disabled={evaluating}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-5 py-2 text-xs font-semibold text-white shadow-kali-glow hover:opacity-95 transition-all disabled:opacity-50"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>{evaluating ? 'Evaluating DLP...' : 'Run Pre-Flight Test'}</span>
              </button>
            </div>
          </div>

          {/* Test Result Breakdown */}
          {testResult && (
            <div
              className={`rounded-xl border p-4 text-xs space-y-2 mt-4 ${
                testResult.decision === 'BLOCKED'
                  ? 'border-rose-500/30 bg-rose-500/10 text-slate-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  {testResult.decision === 'BLOCKED' ? (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  )}
                  <span>Decision: {testResult.decision}</span>
                </span>
                {testResult.incident_id && (
                  <span className="text-xs text-rose-400 font-mono">
                    Incident #{truncateId(testResult.incident_id, 8)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{testResult.reason}</p>
              {testResult.findings?.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-black/40 p-2.5 text-xs text-kali-cyan font-mono">
                  <span className="text-slate-400 font-medium block mb-1">DLP Rule Violation Detected:</span>
                  <span>{testResult.findings[0].description} (Pattern: {testResult.findings[0].pattern})</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Supported Platforms & Setup Instructions */}
        <div className="space-y-6">
          {/* Supported Workflows */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-md space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-3 border-b border-white/10">
              <Layers className="h-4 w-4 text-kali-cyan" />
              <span>Protected AI Applications</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              {(status?.supported_workflows || [
                { service: 'OpenAI ChatGPT', domain: 'chatgpt.com' },
                { service: 'Anthropic Claude', domain: 'claude.ai' },
                { service: 'Google Gemini', domain: 'gemini.google.com' },
                { service: 'Local AI Proxy', domain: 'localhost:8080' },
              ]).map((wf: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <div>
                      <div className="font-medium text-white">{wf.service}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{wf.domain}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium">
                    Protected
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-md space-y-4 text-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10 text-white font-semibold">
              <Terminal className="h-4 w-4 text-kali-cyan" />
              <span>Extension Setup</span>
            </div>

            <ol className="list-decimal list-inside space-y-2.5 text-slate-300 text-xs leading-relaxed">
              <li>
                <strong className="text-white">Load Extension:</strong> Open <code className="text-kali-cyan bg-white/5 px-2 py-0.5 rounded font-mono border border-white/10">chrome://extensions</code>, enable Developer Mode, and click <em>Load Unpacked</em> pointing to the <code className="text-kali-cyan bg-white/5 px-2 py-0.5 rounded font-mono border border-white/10">extension/</code> directory.
              </li>
              <li>
                <strong className="text-white">Configuration:</strong> Specify Gateway base URL <code className="text-kali-cyan bg-white/5 px-2 py-0.5 rounded font-mono border border-white/10">http://127.0.0.1:8080</code> and verify pairing.
              </li>
              <li>
                <strong className="text-white">Automatic Protection:</strong> Web prompts sent to supported LLM domains are intercepted and evaluated before submission.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

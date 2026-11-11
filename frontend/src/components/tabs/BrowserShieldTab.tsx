import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Shield,
  CheckCircle,
  XCircle,
  Play,
  Layers,
  AlertTriangle,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// PROTECTION</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">BROWSER_SHIELD_DLP</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Globe className="h-6 w-6 text-kali-primary" />
            Enterprise Browser Shield & Prompt DLP Sentry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Client-side Manifest V3 browser extension for pre-submission prompt inspection, secret redaction, and exfiltration prevention.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Real Extension Connection Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[EXT-01] Enrollment Status</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isProtectionActive ? 'bg-kali-secure animate-pulse' : 'bg-kali-warning'
              }`}
            />
            <span
              className={`font-mono text-base font-bold ${
                isProtectionActive ? 'text-kali-secure' : 'text-kali-warning'
              }`}
            >
              {isProtectionActive ? 'ENROLLED' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">
            {isProtectionActive ? 'Extension Paired & Heartbeating' : 'Requires Extension Installation'}
          </div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[EXT-02] Target Engine</div>
          <div className="mt-1 font-mono text-base font-bold text-white">CHROMIUM (MV3)</div>
          <div className="font-mono text-[10px] text-kali-cyan mt-0.5">Chrome, Brave, Edge</div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[EXT-03] Workflows Guarded</div>
          <div className="mt-1 font-mono text-base font-bold text-kali-primary">
            {status?.supported_workflows?.length || 4} TARGETS
          </div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">ChatGPT, Claude, Custom LLM</div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[EXT-04] Intercept Mode</div>
          <div className="mt-1 font-mono text-base font-bold text-kali-secure">PRE-FLIGHT</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Zero Outbound Leakage</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Pre-flight Prompt Inspection Simulator */}
        <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-kali-border">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded border border-kali-primary/40 bg-kali-bg text-kali-primary">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Browser Pre-Submission DLP Simulator</h2>
                <span className="font-mono text-[10px] text-kali-cyan">[LOCAL_CONTENT_SCRIPT_DRY_RUN]</span>
              </div>
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-kali-border bg-kali-bg text-slate-400">
              PORT 8080 DLP
            </span>
          </div>

          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Replicates the exact pre-submission intercept evaluated by the Browser Shield content script before an operator or agent submits text to third-party web LLMs.
          </p>

          <div className="font-mono text-xs space-y-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Target AI Application URL</label>
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Prompt Payload Body</label>
              <textarea
                rows={4}
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-kali-cyan focus:border-kali-primary focus:outline-none font-mono"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleTestSubmit}
                disabled={evaluating}
                className="inline-flex items-center gap-2 rounded bg-kali-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>{evaluating ? 'Evaluating DLP...' : 'Run Pre-Flight Test'}</span>
              </button>
            </div>
          </div>

          {/* Test Result Breakdown */}
          {testResult && (
            <div
              className={`rounded border p-3.5 text-xs font-mono space-y-2 mt-4 ${
                testResult.decision === 'BLOCKED'
                  ? 'border-kali-critical/60 bg-[#331418] text-slate-200'
                  : 'border-kali-secure/60 bg-[#0E2E22] text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  {testResult.decision === 'BLOCKED' ? (
                    <XCircle className="h-4 w-4 text-kali-critical" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-kali-secure" />
                  )}
                  <span>DECISION: {testResult.decision}</span>
                </span>
                {testResult.incident_id && (
                  <span className="text-[10px] text-kali-critical">
                    INCIDENT #{truncateId(testResult.incident_id, 8)}
                  </span>
                )}
              </div>
              <p className="font-sans text-xs">{testResult.reason}</p>
              {testResult.findings?.length > 0 && (
                <div className="rounded border border-kali-border bg-kali-bg p-2.5 text-[11px] text-kali-cyan">
                  <span className="text-slate-400 font-bold block mb-1">DLP Rule Violation Detected:</span>
                  <span>{testResult.findings[0].description} (Pattern: {testResult.findings[0].pattern})</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Supported Platforms & Setup Instructions */}
        <div className="space-y-5">
          {/* Supported Workflows */}
          <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-kali-border">
              <Layers className="h-4 w-4 text-kali-cyan" />
              <span>Protected AI Workflow Endpoints</span>
            </h2>

            <div className="space-y-2 font-mono text-xs">
              {(status?.supported_workflows || [
                { service: 'OpenAI ChatGPT', domain: 'chatgpt.com' },
                { service: 'Anthropic Claude', domain: 'claude.ai' },
                { service: 'Google Gemini', domain: 'gemini.google.com' },
                { service: 'Local AI Proxy', domain: 'localhost:8080' },
              ]).map((wf: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded border border-kali-border bg-kali-bg"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-kali-secure" />
                    <div>
                      <div className="font-semibold text-white font-sans">{wf.service}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{wf.domain}</div>
                    </div>
                  </div>
                  <span className="rounded bg-[#0E2E22] text-kali-secure border border-[#155E42] px-2 py-0.5 text-[10px] font-bold">
                    [INTERCEPT_ENABLED]
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Setup & Troubleshooting Instructions */}
          <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-kali-border text-white font-bold">
              <Terminal className="h-4 w-4 text-kali-primary" />
              <span>EXTENSION SETUP & TROUBLESHOOTING</span>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-slate-300 font-sans text-xs">
              <li>
                <strong className="text-white">Load Extension:</strong> Open <code className="text-kali-cyan font-mono bg-kali-bg px-1.5 py-0.5 rounded border border-kali-border">chrome://extensions</code>, enable Developer Mode, and click <em>Load Unpacked</em> selecting the <code className="text-kali-cyan font-mono bg-kali-bg px-1.5 py-0.5 rounded border border-kali-border">extension/</code> directory.
              </li>
              <li>
                <strong className="text-white">Enrollment Token:</strong> Input the AgentTrust Gateway base URL <code className="text-kali-cyan font-mono bg-kali-bg px-1.5 py-0.5 rounded border border-kali-border">http://127.0.0.1:8080</code> and your operator token.
              </li>
              <li>
                <strong className="text-white">Active Interception:</strong> Navigating to supported AI web clients will activate the pre-submission shield indicator.
              </li>
            </ol>

            <div className="rounded border border-kali-warning/50 bg-[#2E200C] p-3 text-[11px] text-slate-300 font-sans mt-3">
              <div className="flex items-center gap-1.5 font-bold text-kali-warning font-mono mb-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>TROUBLESHOOTING DISCONNECTED STATE:</span>
              </div>
              Verify that the background worker can ping <code className="text-white font-mono">/api/v1/browser-shield/status</code> and ensure no CORS policy or ad-blocker interferes with the local port 8080 socket.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

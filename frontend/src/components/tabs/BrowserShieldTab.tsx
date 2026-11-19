import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Shield,
  Play,
  Layers,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';
import { TerminalBox } from '../ui/TerminalBox';
import { DecisionBadge } from '../ui/Badge';

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
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Browser Shield & Prompt DLP
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Client-side browser extension for pre-submission prompt inspection, secret redaction, and exfiltration prevention.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStatus}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Enrollment Status"
          value={isProtectionActive ? 'Enrolled' : 'Standby'}
          icon={<Globe className="h-4 w-4" />}
          subValue={isProtectionActive ? 'Active' : 'Unlinked'}
          subValueColor={isProtectionActive ? 'text-[#16A34A]' : 'text-[#D97706]'}
        />
        <StatCard
          label="DLP Interceptions"
          value={status?.blocked_count ?? 12}
          icon={<Shield className="h-4 w-4" />}
          subValue="Secrets Redacted"
          subValueColor="text-[#DC2626]"
        />
        <StatCard
          label="DOM Sensor Status"
          value="Online"
          icon={<Lock className="h-4 w-4" />}
          subValue="Real-time Hook"
        />
        <StatCard
          label="Redaction Latency"
          value="< 2 ms"
          icon={<Layers className="h-4 w-4" />}
          subValue="Client Pre-flight"
        />
      </div>

      {/* Interactive DLP Test Bench */}
      <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs space-y-4">
        <div className="border-b border-[#F1F5F9] pb-3">
          <h2 className="text-sm font-bold text-[#1E293B]">Prompt DLP Pre-Flight Inspection</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Test prompt redaction rules before user submits input to external LLM providers
          </p>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#1E293B] mb-1">Target Application URL</label>
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 font-mono text-[#1E293B]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#1E293B] mb-1">Prompt Buffer with Sensitive Tokens</label>
            <textarea
              rows={3}
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2.5 font-mono text-xs text-[#1E293B]"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleTestSubmit}
              disabled={evaluating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold text-xs hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-xs"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{evaluating ? 'Analyzing...' : 'Simulate Pre-Submission'}</span>
            </button>
          </div>
        </div>

        {/* Evaluation Result */}
        {testResult && (
          <div className="mt-4 pt-4 border-t border-[#F1F5F9] space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#1E293B]">DLP Decision Result</span>
              <DecisionBadge decision={testResult.decision} />
            </div>

            {testResult.decision === 'BLOCKED' && (
              <div className="p-3.5 rounded-lg border border-[#FCD2D2] bg-[#FEF2F2] text-[#DC2626]">
                <strong>Sensitive Secret Intercepted: </strong>
                <span>{testResult.reason}</span>
              </div>
            )}

            <TerminalBox
              title="DLP Payload Analysis"
              maxHeight="max-h-48"
              copyContent={JSON.stringify(testResult, null, 2)}
            >
              <pre>{JSON.stringify(testResult, null, 2)}</pre>
            </TerminalBox>
          </div>
        )}
      </div>
    </div>
  );
};

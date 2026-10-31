import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Play, Save } from 'lucide-react';
import { api } from '../../services/api.client';
import type { Policy, Agent, PolicyTestResult } from '../../types';
import { DecisionBadge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { safeJsonParse } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const PoliciesTab: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Policy Editor state
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [editorRules, setEditorRules] = useState('');
  const [editorDesc, setEditorDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Policy Simulator / Test state
  const [testAgentId, setTestAgentId] = useState('');
  const [testTool, setTestTool] = useState('filesystem_tool');
  const [testOp, setTestOp] = useState('read_file');
  const [testRes, setTestRes] = useState('confidential/keys.pem');
  const [testSimulationResult, setTestSimulationResult] = useState<PolicyTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pList, aList] = await Promise.all([
        api.listPolicies(),
        api.listAgents('active'),
      ]);
      setPolicies(pList);
      setAgents(aList);
      if (pList.length > 0 && !selectedPolicy) {
        setSelectedPolicy(pList[0]);
        setEditorRules(JSON.stringify(pList[0].rules || {}, null, 2));
        setEditorDesc(pList[0].description || '');
      }
      if (aList.length > 0 && !testAgentId) {
        setTestAgentId(aList[0].id);
      }
    } catch (err: any) {
      toast.error('Policy Load Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectPolicy = (p: Policy) => {
    setSelectedPolicy(p);
    setEditorRules(JSON.stringify(p.rules || {}, null, 2));
    setEditorDesc(p.description || '');
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy) return;
    setIsSaving(true);
    const parsedRules = safeJsonParse(editorRules, null);
    if (!parsedRules) {
      toast.error('Syntax Error', 'Invalid JSON in policy rules definition.');
      setIsSaving(false);
      return;
    }

    try {
      const updated = await api.updatePolicy(selectedPolicy.id, {
        description: editorDesc,
        rules: parsedRules,
        change_summary: 'Rule modified via Web Dashboard Console',
      });
      setSelectedPolicy(updated);
      toast.success('Policy Committed', `Policy bumped to version ${updated.version}.`);
      fetchData();
    } catch (err: any) {
      toast.error('Policy Update Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testAgentId) {
      toast.warning('Input Required', 'Please select a subject agent to test.');
      return;
    }
    setTesting(true);
    setTestSimulationResult(null);

    try {
      const res = await api.testPolicy({
        agent_id: testAgentId,
        tool_name: testTool,
        operation: testOp,
        resource: testRes,
      });
      setTestSimulationResult(res);
      if (res.is_allowed) {
        toast.success('Simulation Result', 'Request matches ALLOW policy.');
      } else {
        toast.warning('Simulation Result', 'Request would be BLOCKED.');
      }
    } catch (err: any) {
      toast.error('Simulator Error', err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
            Deterministic Policy Engine & Simulator
          </h1>
          <p className="text-sm text-slate-400">
            Define declarative authorization policies, maintain immutable version history, and dry-run access decisions.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Policies
        </button>
      </div>

      {loading && policies.length === 0 ? (
        <LoadingSpinner message="LOADING REVISION-CONTROLLED POLICIES..." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Policy List */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Security Policies ({policies.length})
            </h2>
            <div className="space-y-2">
              {policies.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPolicy(p)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    selectedPolicy?.id === p.id
                      ? 'border-cyan-500 bg-slate-900 shadow-md shadow-cyan-900/20'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{p.name}</span>
                    <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400 border border-cyan-800">
                      v{p.version}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400 line-clamp-2">{p.description}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Default: <span className="text-rose-400 font-semibold">{p.default_effect}</span></span>
                    <span className="text-emerald-400 font-semibold">ACTIVE</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Center: Policy Editor */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur lg:col-span-2">
            {selectedPolicy ? (
              <form onSubmit={handleSavePolicy} className="flex flex-col h-full justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">{selectedPolicy.name}</h3>
                      <span className="text-xs text-slate-400 font-mono">Current Revision: v{selectedPolicy.version}</span>
                    </div>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? 'Committing...' : 'Commit New Version'}
                    </button>
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-semibold text-slate-300">Description</label>
                    <input
                      type="text"
                      value={editorDesc}
                      onChange={(e) => setEditorDesc(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-semibold text-slate-300">Policy Rules Definition (JSON Schema)</label>
                    <textarea
                      rows={12}
                      value={editorRules}
                      onChange={(e) => setEditorRules(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-cyan-300 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-3 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Modifications trigger immutable version increments with audit hashes.</span>
                </div>
              </form>
            ) : (
              <div className="flex h-64 items-center justify-center text-xs text-slate-500">
                Select a policy from the list to view and edit its rules.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Policy Testing Simulator */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Play className="h-5 w-5 text-cyan-400" />
          Interactive Policy Dry-Run Simulator
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Verify whether an agent request would be allowed or denied by current policies without producing real-world side effects.
        </p>

        <form onSubmit={handleTestPolicy} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-5 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-300">Subject Agent</label>
            <select
              value={testAgentId}
              onChange={(e) => setTestAgentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Target Tool</label>
            <select
              value={testTool}
              onChange={(e) => {
                setTestTool(e.target.value);
                if (e.target.value === 'filesystem_tool') setTestOp('read_file');
                else if (e.target.value === 'postgres_tool') setTestOp('query_select');
                else if (e.target.value === 'http_api_tool') setTestOp('http_get');
              }}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="filesystem_tool">filesystem_tool</option>
              <option value="postgres_tool">postgres_tool</option>
              <option value="http_api_tool">http_api_tool</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Operation</label>
            <input
              type="text"
              value={testOp}
              onChange={(e) => setTestOp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Target Resource</label>
            <input
              type="text"
              value={testRes}
              onChange={(e) => setTestRes(e.target.value)}
              placeholder="e.g. confidential/keys.pem"
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={testing}
              className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500 disabled:opacity-50"
            >
              {testing ? 'Simulating...' : 'Simulate Decision'}
            </button>
          </div>
        </form>

        {/* Simulation Output */}
        {testSimulationResult && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="font-sans font-bold text-slate-400">Simulation Outcome:</span>
              <DecisionBadge decision={testSimulationResult.decision} />
            </div>
            <div className="mt-2 text-slate-300 font-sans">
              <span className="text-slate-500 font-semibold">Evaluation Reason: </span>
              {testSimulationResult.reason}
            </div>
            {testSimulationResult.matched_rule_id && (
              <div className="mt-1 text-slate-400">
                <span className="text-slate-500">Matched Rule ID: </span>
                {testSimulationResult.matched_rule_id}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

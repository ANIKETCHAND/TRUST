import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Play,
  Save,
  Check,
  Code2,
  FileCode,
  Shield,
  Plus,
  Power,
  History,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { Policy, Agent, PolicyTestResult } from '../../types';
import { DecisionBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatTimestamp, safeJsonParse } from '../../utils/formatters';
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
  const [isValidJson, setIsValidJson] = useState<boolean | null>(null);
  const [activeTabMode, setActiveTabMode] = useState<'editor' | 'history'>('editor');

  // Policy Simulator / Test state
  const [testAgentId, setTestAgentId] = useState('');
  const [testTool, setTestTool] = useState('filesystem_tool');
  const [testOp, setTestOp] = useState('read_file');
  const [testRes, setTestRes] = useState('confidential/keys.pem');
  const [testSimulationResult, setTestSimulationResult] = useState<PolicyTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Policy Creation Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyDesc, setNewPolicyDesc] = useState('');
  const [newPolicyDefaultEffect, setNewPolicyDefaultEffect] = useState<'DENY' | 'ALLOW'>('DENY');
  const [newPolicyRules, setNewPolicyRules] = useState(
    JSON.stringify(
      {
        sandbox_filesystem: {
          allowed_prefixes: ['reports/', 'public/', 'temp/'],
          blocked_extensions: ['.pem', '.key', '.env'],
        },
        database_access: {
          max_rows_per_query: 500,
          forbidden_statements: ['DROP', 'TRUNCATE', 'ALTER'],
        },
      },
      null,
      2
    )
  );
  const [creatingPolicy, setCreatingPolicy] = useState(false);

  const fetchData = useCallback(async () => {
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
  }, [selectedPolicy, testAgentId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectPolicy = (p: Policy) => {
    setSelectedPolicy(p);
    setEditorRules(JSON.stringify(p.rules || {}, null, 2));
    setEditorDesc(p.description || '');
    setIsValidJson(null);
    setActiveTabMode('editor');
  };

  const handleValidateJson = () => {
    try {
      JSON.parse(editorRules);
      setIsValidJson(true);
      toast.success('JSON Validation', 'Policy rules syntax is valid.');
    } catch {
      setIsValidJson(false);
      toast.error('JSON Syntax Error', 'Invalid JSON syntax in rules definition.');
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(editorRules);
      setEditorRules(JSON.stringify(parsed, null, 2));
      setIsValidJson(true);
      toast.info('Rules Formatted', 'JSON pretty-printed successfully.');
    } catch {
      setIsValidJson(false);
      toast.error('Cannot Format', 'Fix syntax errors before auto-formatting.');
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy) return;
    setIsSaving(true);
    const parsedRules = safeJsonParse(editorRules, null);
    if (!parsedRules) {
      toast.error('Syntax Error', 'Invalid JSON in policy rules definition.');
      setIsSaving(false);
      setIsValidJson(false);
      return;
    }

    try {
      const updated = await api.updatePolicy(selectedPolicy.id, {
        description: editorDesc,
        rules: parsedRules,
        change_summary: `Rule revision committed via CrossX SOC Console at ${new Date().toISOString()}`,
      });
      setSelectedPolicy(updated);
      toast.success('Policy Committed', `Policy incremented to revision v${updated.version}.`);
      fetchData();
    } catch (err: any) {
      toast.error('Policy Update Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePolicyActive = async () => {
    if (!selectedPolicy) return;
    const newActive = selectedPolicy.is_active === false ? true : false;
    try {
      const updated = await api.updatePolicy(selectedPolicy.id, {
        is_active: newActive,
        change_summary: `Policy state toggled to ${newActive ? 'ACTIVE' : 'DISABLED'}`,
      });
      setSelectedPolicy(updated);
      toast.success(
        newActive ? 'Policy Activated' : 'Policy Disabled',
        `Policy '${selectedPolicy.name}' enforcement is now ${newActive ? 'ACTIVE' : 'DISABLED'}.`
      );
      fetchData();
    } catch (err: any) {
      toast.error('Toggle Failed', err.message);
    }
  };

  const handleCreatePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedRules = safeJsonParse(newPolicyRules, null);
    if (!parsedRules) {
      toast.error('Invalid JSON', 'Policy rules must be valid JSON.');
      return;
    }

    setCreatingPolicy(true);
    try {
      const created = await api.createPolicy({
        name: newPolicyName,
        description: newPolicyDesc || undefined,
        default_effect: newPolicyDefaultEffect,
        rules: parsedRules,
      });
      toast.success('Policy Created', `Policy '${created.name}' initialized as v1.`);
      setIsCreateOpen(false);
      setNewPolicyName('');
      setNewPolicyDesc('');
      setSelectedPolicy(created);
      setEditorRules(JSON.stringify(created.rules || {}, null, 2));
      setEditorDesc(created.description || '');
      fetchData();
    } catch (err: any) {
      toast.error('Creation Failed', err.message);
    } finally {
      setCreatingPolicy(false);
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
        toast.success('Simulation Result', 'Request conforms with active ALLOW rule.');
      } else {
        toast.warning('Simulation Result', 'Request denied by policy fail-closed boundary.');
      }
    } catch (err: any) {
      toast.error('Simulator Error', err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-kali-cyan" />
            Deterministic Policy Engine & Simulator
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Declarative security policies, syntax validation, and offline pre-flight simulation testbench.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Fail-Closed Enforcing</span>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-4 py-2 text-xs font-semibold text-white shadow-kali-glow hover:opacity-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>New Policy</span>
          </button>
        </div>
      </div>

      {loading && policies.length === 0 ? (
        <LoadingSpinner message="Parsing declarative policy trees..." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Policy Inventory */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="text-white font-semibold">Active Policies ({policies.length})</span>
              <span className="text-kali-cyan text-[11px]">OPA Engine</span>
            </div>

            <div className="space-y-2.5">
              {policies.map((p) => {
                const isSelected = selectedPolicy?.id === p.id;
                const isActive = p.is_active !== false;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPolicy(p)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? 'border-kali-primary/70 bg-kali-primary/[0.08] shadow-lg shadow-kali-primary/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-kali-primary/20 text-kali-primary' : 'bg-white/[0.04] text-slate-400'}`}>
                          <Shield className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-white text-xs">{p.name}</span>
                      </div>
                      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-kali-cyan border border-white/10">
                        v{p.version}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">{p.description}</p>

                    <div className="mt-3 flex items-center justify-between text-[11px] border-t border-white/10 pt-2.5">
                      <span className="text-slate-400">
                        Default: <span className="text-rose-400 font-semibold">{p.default_effect}</span>
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-kali-secure font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-kali-secure" /> Enforcing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Disabled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Policy Editor & History */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl lg:col-span-2 flex flex-col justify-between">
            {selectedPolicy ? (
              <form onSubmit={handleSavePolicy} className="flex flex-col h-full justify-between space-y-4">
                <div>
                  {/* Editor Header Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-kali-cyan">
                        <FileCode className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{selectedPolicy.name}</h3>
                          <span className="text-[10px] text-kali-primary bg-kali-primary/10 px-2 py-0.5 rounded-md border border-kali-primary/20 font-medium">
                            Revision v{selectedPolicy.version}
                          </span>
                          {selectedPolicy.is_active === false && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
                              Disabled
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">ID: {selectedPolicy.id}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Active/Disable toggle */}
                      <button
                        type="button"
                        onClick={handleTogglePolicyActive}
                        className={`rounded-xl border px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5 ${
                          selectedPolicy.is_active === false
                            ? 'border-kali-secure/40 bg-kali-secure/10 text-kali-secure hover:bg-kali-secure/20'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                        }`}
                        title="Toggle policy enforcement status"
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span>{selectedPolicy.is_active === false ? 'Activate' : 'Disable'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleValidateJson}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 hover:border-kali-cyan/50 hover:text-white transition-colors"
                        title="Validate JSON Syntax"
                      >
                        <Check className="inline h-3 w-3 mr-1 text-kali-cyan" />
                        Validate
                      </button>
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 hover:border-kali-primary/50 hover:text-white transition-colors"
                        title="Pretty Print JSON"
                      >
                        <Code2 className="inline h-3 w-3 mr-1 text-kali-primary" />
                        Format
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-kali-primary px-3.5 py-1.5 font-semibold text-white hover:bg-kali-secondaryBlue shadow-lg shadow-kali-primary/20 transition-colors disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Commit Version'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Sub-Tabs: Editor vs History */}
                  <div className="flex border-b border-white/10 gap-4 text-xs mt-3.5">
                    <button
                      type="button"
                      onClick={() => setActiveTabMode('editor')}
                      className={`pb-2 border-b-2 font-medium transition-colors ${
                        activeTabMode === 'editor'
                          ? 'border-kali-primary text-white font-semibold'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Rule Definition (JSON)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTabMode('history')}
                      className={`pb-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
                        activeTabMode === 'history'
                          ? 'border-kali-primary text-white font-semibold'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <History className="h-3.5 w-3.5 text-kali-cyan" />
                      <span>Revision Metadata</span>
                    </button>
                  </div>

                  {activeTabMode === 'editor' ? (
                    <>
                      {/* Description Input */}
                      <div className="mt-3.5">
                        <label className="text-xs font-medium text-slate-300 block mb-1.5">
                          Policy Scope Description
                        </label>
                        <input
                          type="text"
                          value={editorDesc}
                          onChange={(e) => setEditorDesc(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white focus:border-kali-primary focus:outline-none transition-colors"
                        />
                      </div>

                      {/* Code Editor Frame */}
                      <div className="mt-3.5">
                        <div className="flex items-center justify-between border-t border-x border-white/10 bg-white/[0.03] px-3.5 py-2 rounded-t-xl text-xs text-slate-400">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-kali-primary" />
                            <span className="font-medium text-slate-300">Declarative JSON Specification</span>
                          </span>
                          {isValidJson !== null && (
                            <span className={`font-semibold ${isValidJson ? 'text-kali-secure' : 'text-rose-400'}`}>
                              {isValidJson ? '✓ Valid JSON' : '✗ Syntax Error'}
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={12}
                          value={editorRules}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditorRules(val);
                            if (!val.trim()) {
                              setIsValidJson(null);
                            } else {
                              try {
                                JSON.parse(val);
                                setIsValidJson(true);
                              } catch {
                                setIsValidJson(false);
                              }
                            }
                          }}
                          className={`w-full rounded-b-xl border border-white/10 bg-black/60 p-3.5 font-mono text-xs focus:outline-none leading-relaxed ${
                            isValidJson === false
                              ? 'border-rose-500/50 text-rose-300 focus:border-rose-500'
                              : 'text-emerald-400 focus:border-kali-cyan/50'
                          }`}
                          spellCheck={false}
                        />
                      </div>
                    </>
                  ) : (
                    /* Policy Revision History Tab */
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
                        <div className="text-xs font-semibold text-kali-cyan">Revision Dossier</div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-2 text-slate-300">
                          <span className="text-slate-400">Current Version:</span>
                          <span className="text-white font-semibold">v{selectedPolicy.version}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-2 text-slate-300">
                          <span className="text-slate-400">Default Fallback Effect:</span>
                          <span className="text-rose-400 font-semibold">{selectedPolicy.default_effect}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-2 text-slate-300">
                          <span className="text-slate-400">Enforcement Status:</span>
                          <span className={selectedPolicy.is_active !== false ? 'text-kali-secure font-semibold' : 'text-amber-400 font-semibold'}>
                            {selectedPolicy.is_active !== false ? 'Active & Enforcing' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Enrolled At:</span>
                          <span className="text-slate-300">{formatTimestamp(selectedPolicy.created_at)}</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Commit Notes</span>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {selectedPolicy.description || 'Enterprise baseline policy configuration.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-3.5">
                  <span>Changes are versioned immutably on commit</span>
                  <span className="text-kali-cyan font-medium">Zero-Trust Guardrail Active</span>
                </div>
              </form>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Select a security policy to inspect or modify rules.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION B: OFFLINE PRE-FLIGHT SIMULATION TESTBENCH (TEST MODE) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Policy Simulator Testbench
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dry-run agent tool calls against deterministic policies in isolated simulation mode.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>Dry-Run Simulation</span>
          </div>
        </div>

        <form onSubmit={handleTestPolicy} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1.5">Subject Agent</label>
            <select
              value={testAgentId}
              onChange={(e) => setTestAgentId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id} className="bg-[#0a0d14] text-white">
                  {a.name} ({a.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1.5">Target Tool</label>
            <input
              type="text"
              value={testTool}
              onChange={(e) => setTestTool(e.target.value)}
              placeholder="filesystem_tool"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1.5">Operation</label>
            <input
              type="text"
              value={testOp}
              onChange={(e) => setTestOp(e.target.value)}
              placeholder="read_file"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1.5">Resource Path</label>
            <input
              type="text"
              value={testRes}
              onChange={(e) => setTestRes(e.target.value)}
              placeholder="confidential/keys.pem"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={testing}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-kali-cyan px-4 py-2 font-semibold text-black shadow-lg shadow-kali-cyan/20 hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{testing ? 'Evaluating...' : 'Run Simulation'}</span>
            </button>
          </div>
        </form>

        {/* Simulation Output Card */}
        {testSimulationResult && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="font-semibold text-white">Evaluation Outcome</span>
              <DecisionBadge decision={testSimulationResult.decision} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300 text-[11px]">
              <div>
                <span className="text-slate-400 block font-medium">Agent</span>
                <span className="text-white font-semibold mt-0.5 block">{testSimulationResult.agent.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Target</span>
                <span className="text-kali-cyan font-mono mt-0.5 block">{testSimulationResult.target.tool}:{testSimulationResult.target.operation}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Decision</span>
                <span className={`font-semibold mt-0.5 block ${testSimulationResult.is_allowed ? 'text-kali-secure' : 'text-rose-400'}`}>
                  {testSimulationResult.decision}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Matched Rule</span>
                <span className="text-slate-300 font-mono truncate mt-0.5 block">{testSimulationResult.matched_rule_id || 'DEFAULT_FAIL_CLOSED'}</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 pt-2 border-t border-white/5">
              Reasoning: <span className="text-slate-200">{testSimulationResult.reason}</span>
            </div>
          </div>
        )}
      </div>

      {/* CREATE POLICY MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Security Policy"
        subtitle="Initializes an immutable declarative authorization policy record"
      >
        <form onSubmit={handleCreatePolicySubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Policy Identifier Name</label>
            <input
              type="text"
              required
              value={newPolicyName}
              onChange={(e) => setNewPolicyName(e.target.value)}
              placeholder="e.g. Database-Egress-Boundary-Policy"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Scope Description</label>
            <input
              type="text"
              value={newPolicyDesc}
              onChange={(e) => setNewPolicyDesc(e.target.value)}
              placeholder="Enforces maximum query limits and prevents schema alterations..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Default Fallback Effect</label>
            <select
              value={newPolicyDefaultEffect}
              onChange={(e) => setNewPolicyDefaultEffect(e.target.value as any)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-primary focus:outline-none"
            >
              <option value="DENY" className="bg-[#0a0d14] text-white">DENY (Fail-Closed Zero Trust)</option>
              <option value="ALLOW" className="bg-[#0a0d14] text-white">ALLOW (Permissive Default)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Policy Rules (JSON)</label>
            <textarea
              rows={6}
              value={newPolicyRules}
              onChange={(e) => setNewPolicyRules(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-emerald-400 focus:border-kali-primary focus:outline-none leading-relaxed"
              spellCheck={false}
            />
          </div>

          <div className="flex justify-end gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingPolicy}
              className="rounded-xl bg-kali-primary px-4 py-2 font-semibold text-white shadow-lg shadow-kali-primary/20 hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
            >
              {creatingPolicy ? 'Creating...' : 'Initialize Policy'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

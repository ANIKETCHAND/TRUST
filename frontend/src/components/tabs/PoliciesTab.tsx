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
        change_summary: `Rule revision committed via Kali SOC Console at ${new Date().toISOString()}`,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// AGENT_SECURITY</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">DETERMINISTIC_POLICIES</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <ShieldCheck className="h-6 w-6 text-kali-primary" />
            Deterministic Policy Engine & Pre-flight Simulator
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Revision-controlled declarative security policies, rule syntax validation, and offline pre-flight simulation testbench.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode Distinction Banner */}
          <div className="flex items-center gap-2 rounded border border-kali-secure/50 bg-[#0E2E22] px-3 py-1 font-mono text-xs text-kali-secure">
            <span className="h-2 w-2 rounded-full bg-kali-secure animate-pulse" />
            <span>ENFORCEMENT MODE: FAIL-CLOSED</span>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-kali-primary px-3 py-1 font-mono text-xs font-bold text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>NEW POLICY</span>
          </button>
        </div>
      </div>

      {loading && policies.length === 0 ? (
        <LoadingSpinner message="PARSING DECLARATIVE POLICY TREES..." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Policy Inventory */}
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-xs text-slate-400">
              <span className="font-bold">// POLICY_INVENTORY ({policies.length})</span>
              <span className="text-[10px] text-kali-cyan">OPA / REGISTRY</span>
            </div>

            <div className="space-y-2.5">
              {policies.map((p) => {
                const isSelected = selectedPolicy?.id === p.id;
                const isActive = p.is_active !== false;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPolicy(p)}
                    className={`cursor-pointer rounded-lg border p-3.5 transition-all shadow-sm ${
                      isSelected
                        ? 'border-kali-primary bg-kali-elevated shadow-kali-glow'
                        : 'border-kali-border bg-kali-card hover:border-kali-borderLight hover:bg-kali-card/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className={`h-4 w-4 ${isSelected ? 'text-kali-primary' : 'text-slate-400'}`} />
                        <span className="font-bold text-white text-xs">{p.name}</span>
                      </div>
                      <span className="rounded bg-kali-bg px-2 py-0.5 font-mono text-[10px] font-bold text-kali-cyan border border-kali-border">
                        v{p.version}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 font-sans">{p.description}</p>

                    <div className="mt-3 flex items-center justify-between font-mono text-[11px] border-t border-kali-border/60 pt-2">
                      <span className="text-slate-500">
                        DEFAULT: <span className="text-kali-critical font-bold">{p.default_effect}</span>
                      </span>
                      {isActive ? (
                        <span className="text-kali-secure font-bold">[ACTIVE_ENFORCING]</span>
                      ) : (
                        <span className="text-kali-warning font-bold">[DISABLED]</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: High-Tech Policy Editor & History */}
          <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card lg:col-span-2 flex flex-col justify-between">
            {selectedPolicy ? (
              <form onSubmit={handleSavePolicy} className="flex flex-col h-full justify-between space-y-4">
                <div>
                  {/* Editor Header Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-kali-border pb-3 gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded border border-kali-border bg-kali-bg text-kali-cyan">
                        <FileCode className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{selectedPolicy.name}</h3>
                          <span className="font-mono text-[10px] text-kali-primary bg-kali-bg px-1.5 py-0.2 rounded border border-kali-border">
                            REVISION: v{selectedPolicy.version}
                          </span>
                          {selectedPolicy.is_active === false && (
                            <span className="font-mono text-[9px] text-kali-warning bg-[#2E200C] px-1.5 py-0.2 rounded border border-kali-warning/40 font-bold">
                              DISABLED
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">ID: {selectedPolicy.id}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                      {/* Active/Disable toggle */}
                      <button
                        type="button"
                        onClick={handleTogglePolicyActive}
                        className={`rounded border px-2.5 py-1 font-mono transition-colors flex items-center gap-1 ${
                          selectedPolicy.is_active === false
                            ? 'border-kali-secure/50 bg-[#0E2E22] text-kali-secure hover:bg-[#154634]'
                            : 'border-kali-warning/50 bg-[#2E200C] text-kali-warning hover:bg-[#473212]'
                        }`}
                        title="Toggle policy enforcement status"
                      >
                        <Power className="h-3 w-3" />
                        <span>{selectedPolicy.is_active === false ? 'ACTIVATE' : 'DISABLE'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleValidateJson}
                        className="rounded border border-kali-border bg-kali-bg px-2.5 py-1 text-slate-300 hover:border-kali-cyan hover:text-white transition-colors"
                        title="Validate JSON Syntax"
                      >
                        <Check className="inline h-3 w-3 mr-1 text-kali-cyan" />
                        Validate
                      </button>
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        className="rounded border border-kali-border bg-kali-bg px-2.5 py-1 text-slate-300 hover:border-kali-primary hover:text-white transition-colors"
                        title="Pretty Print JSON"
                      >
                        <Code2 className="inline h-3 w-3 mr-1 text-kali-primary" />
                        Format
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 rounded bg-kali-primary px-3 py-1 font-bold text-white hover:bg-kali-secondaryBlue shadow-kali-glow transition-colors disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{isSaving ? 'Committing...' : 'Commit Version'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Sub-Tabs: Editor vs History */}
                  <div className="flex border-b border-kali-border gap-3 font-mono text-xs mt-3">
                    <button
                      type="button"
                      onClick={() => setActiveTabMode('editor')}
                      className={`pb-1.5 border-b-2 font-bold transition-colors ${
                        activeTabMode === 'editor'
                          ? 'border-kali-primary text-white'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      RULE DEFINITION (JSON)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTabMode('history')}
                      className={`pb-1.5 border-b-2 font-bold transition-colors flex items-center gap-1 ${
                        activeTabMode === 'history'
                          ? 'border-kali-primary text-white'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <History className="h-3.5 w-3.5 text-kali-cyan" />
                      <span>REVISION METADATA</span>
                    </button>
                  </div>

                  {activeTabMode === 'editor' ? (
                    <>
                      {/* Description Input */}
                      <div className="mt-3">
                        <label className="font-mono text-[11px] font-semibold text-slate-300 block mb-1">
                          Policy Scope Description
                        </label>
                        <input
                          type="text"
                          value={editorDesc}
                          onChange={(e) => setEditorDesc(e.target.value)}
                          className="w-full rounded border border-kali-border bg-kali-bg px-3 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none"
                        />
                      </div>

                      {/* Code Editor Frame */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between border-t border-x border-kali-border bg-kali-bg px-3 py-1.5 rounded-t font-mono text-[10px] text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-kali-primary" />
                            <span>RULES_TREE // DECLARATIVE JSON SPECIFICATION</span>
                          </span>
                          {isValidJson !== null && (
                            <span className={`font-bold ${isValidJson ? 'text-kali-secure' : 'text-kali-critical'}`}>
                              {isValidJson ? '✓ SYNTAX VALID' : '✗ SYNTAX ERROR'}
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={12}
                          value={editorRules}
                          onChange={(e) => {
                            setEditorRules(e.target.value);
                            setIsValidJson(null);
                          }}
                          className="w-full rounded-b border border-kali-border bg-[#080B10] p-3 font-mono text-xs text-emerald-400 focus:border-kali-primary focus:outline-none leading-relaxed"
                          spellCheck={false}
                        />
                      </div>
                    </>
                  ) : (
                    /* Policy Revision History Tab */
                    <div className="mt-4 space-y-3 font-mono text-xs">
                      <div className="rounded border border-kali-border bg-kali-bg p-3 space-y-2">
                        <div className="text-[11px] font-bold text-kali-cyan">// REVISION METADATA DOSSIER</div>
                        <div className="flex items-center justify-between border-b border-kali-border/60 pb-1.5 text-slate-300">
                          <span>Current Version:</span>
                          <span className="text-white font-bold">v{selectedPolicy.version}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-kali-border/60 pb-1.5 text-slate-300">
                          <span>Default Effect:</span>
                          <span className="text-kali-critical font-bold">{selectedPolicy.default_effect}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-kali-border/60 pb-1.5 text-slate-300">
                          <span>Enforcement Status:</span>
                          <span className={selectedPolicy.is_active !== false ? 'text-kali-secure font-bold' : 'text-kali-warning font-bold'}>
                            {selectedPolicy.is_active !== false ? 'ACTIVE ENFORCING' : 'DISABLED'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Initial Enrolled:</span>
                          <span className="text-slate-400">{formatTimestamp(selectedPolicy.created_at)}</span>
                        </div>
                      </div>

                      <div className="rounded border border-kali-border bg-kali-bg p-3">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Audit Commit Notes</span>
                        <p className="text-slate-300 text-xs">
                          {selectedPolicy.description || 'Enterprise baseline policy configuration.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 border-t border-kali-border pt-3">
                  <span>CHANGES ARE VERSIONED IMMUTABLY ON COMMIT</span>
                  <span>PRE-FLIGHT EVALUATION: ACTIVE</span>
                </div>
              </form>
            ) : (
              <div className="h-full flex items-center justify-center font-mono text-xs text-slate-500">
                Select a security policy from the inventory to inspect or modify rules.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION B: OFFLINE PRE-FLIGHT SIMULATION TESTBENCH (TEST MODE) */}
      <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card">
        <div className="flex items-center justify-between border-b border-kali-border pb-3">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
              <span>// TEST_MODE</span>
              <span className="text-kali-warning font-bold">[OFFLINE_PREFLIGHT_SIMULATOR]</span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5">
              Simulate Policy Evaluation without Side-Effects
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Dry-run evaluate agent tool calls against deterministic policy trees in isolated test mode.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded border border-kali-warning/50 bg-[#2E200C] px-3 py-1 font-mono text-xs text-kali-warning">
            <span className="h-2 w-2 rounded-full bg-kali-warning" />
            <span>TEST MODE: ZERO SIDE-EFFECTS</span>
          </div>
        </div>

        <form onSubmit={handleTestPolicy} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Subject Agent</label>
            <select
              value={testAgentId}
              onChange={(e) => setTestAgentId(e.target.value)}
              className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-1.5 text-white focus:border-kali-primary focus:outline-none"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Target Tool</label>
            <input
              type="text"
              value={testTool}
              onChange={(e) => setTestTool(e.target.value)}
              placeholder="filesystem_tool"
              className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-1.5 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Operation</label>
            <input
              type="text"
              value={testOp}
              onChange={(e) => setTestOp(e.target.value)}
              placeholder="read_file"
              className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-1.5 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Resource Path</label>
            <input
              type="text"
              value={testRes}
              onChange={(e) => setTestRes(e.target.value)}
              placeholder="confidential/keys.pem"
              className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-1.5 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={testing}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-kali-cyan px-3 py-1.5 font-bold uppercase tracking-wider text-black shadow-kali-glow hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{testing ? 'Simulating...' : 'Run Test'}</span>
            </button>
          </div>
        </form>

        {/* Simulation Output Card */}
        {testSimulationResult && (
          <div className="mt-4 rounded border border-kali-border bg-kali-bg p-3.5 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-kali-border/60 pb-2">
              <span className="font-bold text-white">// SIMULATION_OUTCOME</span>
              <DecisionBadge decision={testSimulationResult.decision} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 text-[11px]">
              <div>
                <span className="text-slate-500 block">Agent:</span>
                <span className="text-white font-bold">{testSimulationResult.agent.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Target:</span>
                <span className="text-kali-cyan">{testSimulationResult.target.tool}:{testSimulationResult.target.operation}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Evaluation Decision:</span>
                <span className={testSimulationResult.is_allowed ? 'text-kali-secure font-bold' : 'text-kali-critical font-bold'}>
                  {testSimulationResult.decision}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Matched Rule:</span>
                <span className="text-slate-400 truncate">{testSimulationResult.matched_rule_id || 'DEFAULT_FAIL_CLOSED'}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-1 border-t border-kali-border/40">
              REASONING: <span className="text-slate-200">{testSimulationResult.reason}</span>
            </div>
          </div>
        )}
      </div>

      {/* CREATE POLICY MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="CREATE SECURITY POLICY"
        subtitle="Initializes an immutable declarative authorization policy record"
      >
        <form onSubmit={handleCreatePolicySubmit} className="space-y-3 font-mono text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Policy Identifier Name</label>
            <input
              type="text"
              required
              value={newPolicyName}
              onChange={(e) => setNewPolicyName(e.target.value)}
              placeholder="e.g. Database-Egress-Boundary-Policy"
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Scope Description</label>
            <input
              type="text"
              value={newPolicyDesc}
              onChange={(e) => setNewPolicyDesc(e.target.value)}
              placeholder="Enforces maximum query limits and prevents schema alterations..."
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Default Fallback Effect</label>
            <select
              value={newPolicyDefaultEffect}
              onChange={(e) => setNewPolicyDefaultEffect(e.target.value as any)}
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            >
              <option value="DENY">DENY (Fail-Closed Zero Trust)</option>
              <option value="ALLOW">ALLOW (Permissive Default)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Policy Rules (JSON)</label>
            <textarea
              rows={6}
              value={newPolicyRules}
              onChange={(e) => setNewPolicyRules(e.target.value)}
              className="w-full rounded border border-kali-border bg-[#080B10] p-2.5 text-emerald-400 focus:border-kali-primary focus:outline-none leading-relaxed"
              spellCheck={false}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-kali-border pt-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingPolicy}
              className="rounded bg-kali-primary px-4 py-1.5 font-bold text-white shadow-kali-glow hover:bg-kali-secondaryBlue disabled:opacity-50"
            >
              {creatingPolicy ? 'Creating...' : 'Initialize Policy'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

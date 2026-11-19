import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Play,
  Save,
  Code2,
  Shield,
  Plus,
  Trash2,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { Policy, Agent, PolicyTestResult } from '../../types';
import { DecisionBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';
import { useToast } from '../../context/ToastContext';
import { formatTimestamp } from '../../utils/formatters';

export const PoliciesTab: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'updated_at' | 'name' | 'priority'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Deletion modal state
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Policy Editor state
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [editorRules, setEditorRules] = useState('');
  const [editorDesc, setEditorDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isValidJson, setIsValidJson] = useState<boolean | null>(null);

  // Policy Simulator / Test state
  const [testAgentId, setTestAgentId] = useState('');
  const [testTool, setTestTool] = useState('filesystem_tool');
  const [testOp, setTestOp] = useState('read_file');
  const [testRes, setTestRes] = useState('reports/confidential.pem');
  const [testSimulationResult, setTestSimulationResult] = useState<PolicyTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Multi-Step Policy Builder Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyDesc, setNewPolicyDesc] = useState('');
  const [newPolicyCategory, setNewPolicyCategory] = useState('filesystem');
  const [newPolicyAgentScope, setNewPolicyAgentScope] = useState('*');
  const [newPolicyResourcePattern, setNewPolicyResourcePattern] = useState('reports/*');
  const [newPolicyBlockedExtensions, setNewPolicyBlockedExtensions] = useState('.pem, .key, .env');
  const [newPolicyDefaultEffect, setNewPolicyDefaultEffect] = useState<'DENY' | 'ALLOW'>('DENY');
  const [newPolicyPriority, setNewPolicyPriority] = useState(100);
  const [newPolicyEnabled, setNewPolicyEnabled] = useState(true);
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
  };

  const handleSavePolicy = async () => {
    if (!selectedPolicy) return;
    try {
      const parsed = JSON.parse(editorRules);
      setIsValidJson(true);
      setIsSaving(true);
      const updated = await api.updatePolicy(selectedPolicy.id, {
        description: editorDesc,
        rules: parsed,
      });
      setSelectedPolicy(updated);
      setPolicies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast.success('Policy Updated', `Rule changes saved for ${selectedPolicy.name}.`);
    } catch (err: any) {
      setIsValidJson(false);
      toast.error('Invalid JSON', err.message || 'Check rule syntax.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePolicyStatus = async (p: Policy, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newActive = !p.is_active;
      await api.updatePolicy(p.id, { is_active: newActive });
      setPolicies((prev) => prev.map((item) => (item.id === p.id ? { ...item, is_active: newActive } : item)));
      if (selectedPolicy?.id === p.id) {
        setSelectedPolicy((prev) => (prev ? { ...prev, is_active: newActive } : null));
      }
      toast.info('Policy Status Changed', `${p.name} is now ${newActive ? 'Enforcing' : 'Disabled'}.`);
    } catch (err: any) {
      toast.error('Toggle Failed', err.message);
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestSimulationResult(null);
    try {
      const res = await api.testPolicy({
        agent_id: testAgentId,
        tool: testTool,
        operation: testOp,
        resource: testRes,
      });
      setTestSimulationResult(res);
      if (res.decision === 'ALLOWED') {
        toast.success('Simulation Passed', 'Request permitted by active policy.');
      } else {
        toast.warning('Simulation Denied', `Denied: ${res.reason || 'Guardrail blocked'}`);
      }
    } catch (err: any) {
      toast.error('Simulation Failed', err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleCreatePolicySubmit = async () => {
    setCreatingPolicy(true);
    try {
      const rulesPayload = {
        [newPolicyCategory]: {
          allowed_prefixes: [newPolicyResourcePattern],
          blocked_extensions: newPolicyBlockedExtensions.split(',').map((s) => s.trim()),
          priority: newPolicyPriority,
        },
      };

      const created = await api.createPolicy({
        name: newPolicyName,
        description: newPolicyDesc,
        is_enabled: newPolicyEnabled,
        rules: rulesPayload,
      });

      setPolicies((prev) => [created, ...prev]);
      setSelectedPolicy(created);
      setIsCreateOpen(false);
      setCreateStep(1);
      toast.success('Policy Enacted', `Policy ${newPolicyName} created successfully.`);
    } catch (err: any) {
      toast.error('Creation Failed', err.message);
    } finally {
      setCreatingPolicy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!policyToDelete) return;
    setIsDeleting(true);
    try {
      await api.deletePolicy(policyToDelete.id);
      setPolicies((prev) => prev.filter((p) => p.id !== policyToDelete.id));
      if (selectedPolicy?.id === policyToDelete.id) {
        setSelectedPolicy(null);
      }
      toast.success('Policy Deleted', `${policyToDelete.name} was successfully removed.`);
      setDeleteConfirmOpen(false);
      setPolicyToDelete(null);
    } catch (err: any) {
      toast.error('Delete Failed', err.message || 'Failed to delete policy');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered and sorted policies
  const filteredPolicies = useMemo(() => {
    return policies
      .filter((p) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) {
            return false;
          }
        }
        if (statusFilter === 'ENABLED' && !p.is_active) return false;
        if (statusFilter === 'DISABLED' && p.is_active) return false;

        if (categoryFilter !== 'ALL') {
          const cat = (Object.keys(p.rules || {})[0] || '').toLowerCase();
          if (!cat.includes(categoryFilter.toLowerCase())) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          const comp = a.name.localeCompare(b.name);
          return sortOrder === 'asc' ? comp : -comp;
        }
        if (sortBy === 'priority') {
          const pA = 100;
          const pB = 100;
          return sortOrder === 'asc' ? pA - pB : pB - pA;
        }
        const tA = new Date(a.updated_at || a.created_at).getTime();
        const tB = new Date(b.updated_at || b.created_at).getTime();
        return sortOrder === 'asc' ? tA - tB : tB - tA;
      });
  }, [policies, search, statusFilter, categoryFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Security Policies
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Deterministic security guardrails and pre-flight policy evaluation engine.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => {
              setCreateStep(1);
              setNewPolicyName('');
              setNewPolicyDesc('');
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] transition-all shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Policy</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Policy Table / List + Editor / Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Policies Table & Filters (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E5EAF1] shadow-2xs">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search policies by name or rule..."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-xs text-[#1E293B]"
              >
                <option value="ALL">All Categories</option>
                <option value="filesystem">Filesystem</option>
                <option value="database">Database</option>
                <option value="http">HTTP API</option>
                <option value="sandbox">Sandbox</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-xs text-[#1E293B]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ENABLED">Enforcing</option>
                <option value="DISABLED">Disabled</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
              >
                <option value="updated_at">Updated</option>
                <option value="name">Name</option>
                <option value="priority">Priority</option>
              </select>

              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded-lg border border-[#E5EAF1] bg-white text-[#64748B] hover:text-[#1E293B]"
                title={`Sort order: ${sortOrder}`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Policy Table */}
          <div className="rounded-xl border border-[#E5EAF1] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Policy Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Scope</th>
                    <th className="py-3 px-4">Enforcement</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF1]">
                  {filteredPolicies.length > 0 ? (
                    filteredPolicies.map((p) => {
                      const isSelected = selectedPolicy?.id === p.id;
                      const categoryName = Object.keys(p.rules || {})[0] || 'GENERAL';
                      const defaultEffect = p.default_effect || 'DENY';

                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleSelectPolicy(p)}
                          className={`transition-colors cursor-pointer ${
                            isSelected ? 'bg-[#EEF4FF]/50 font-medium' : 'hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#1E293B]">{p.name}</div>
                            <div className="text-[11px] text-[#64748B] truncate max-w-xs">
                              {p.description || 'Pre-flight rule guardrail'}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] uppercase">
                              {categoryName}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-[11px] text-[#64748B]">
                              {categoryName.toLowerCase().includes('file') ? 'reports/*' : '*'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold ${
                                defaultEffect === 'ALLOW'
                                  ? 'bg-[#E8F7EF] text-[#16A34A] border border-[#BCE8CD]'
                                  : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCD2D2]'
                              }`}
                            >
                              {defaultEffect}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#64748B] whitespace-nowrap">100</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              onClick={(e) => handleTogglePolicyStatus(p, e)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-medium text-[11px] cursor-pointer transition-colors ${
                                p.is_active !== false
                                  ? 'bg-[#E8F7EF] text-[#16A34A] border border-[#BCE8CD]'
                                  : 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]'
                              }`}
                              title="Click to toggle enforcement"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  p.is_active !== false ? 'bg-[#16A34A]' : 'bg-[#94A3B8]'
                                }`}
                              />
                              <span>{p.is_active !== false ? 'Enforcing' : 'Disabled'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#64748B] whitespace-nowrap text-[11px]">
                            {formatTimestamp(p.updated_at || p.created_at)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleSelectPolicy(p)}
                                className="px-2.5 py-1 text-xs rounded border border-[#E5EAF1] bg-white text-[#3B82F6] hover:bg-[#EEF4FF] transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setPolicyToDelete(p);
                                  setDeleteConfirmOpen(true);
                                }}
                                className="p-1 rounded text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                                title="Delete policy"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-[#64748B]">
                        No policies found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Policy Configuration Editor & Interactive Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Policy JSON Rule Editor */}
          {selectedPolicy && (
            <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#EEF4FF] text-[#3B82F6]">
                    <Code2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1E293B]">{selectedPolicy.name}</h3>
                    <span className="text-[11px] text-[#64748B]">Deterministic Guardrail Rules</span>
                  </div>
                </div>
                <button
                  onClick={handleSavePolicy}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50 transition-all shadow-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Rules'}</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1E293B] mb-1">Description</label>
                <input
                  type="text"
                  value={editorDesc}
                  onChange={(e) => setEditorDesc(e.target.value)}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-xs text-[#1E293B]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="font-medium text-[#1E293B]">JSON Rules Specification</span>
                  {isValidJson === false && (
                    <span className="text-[#DC2626] font-medium text-[11px]">Invalid JSON</span>
                  )}
                  {isValidJson === true && (
                    <span className="text-[#16A34A] font-medium text-[11px]">Valid JSON</span>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={editorRules}
                  onChange={(e) => {
                    setEditorRules(e.target.value);
                    setIsValidJson(null);
                  }}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] p-3 font-mono text-xs text-[#1E293B] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Policy Simulation Bench */}
          <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs space-y-4">
            <div className="border-b border-[#F1F5F9] pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1E293B]">Policy Simulator</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Evaluate sample invocation inputs against active rules
                </p>
              </div>
              <span className="font-mono text-[10px] text-[#3B82F6] bg-[#EEF4FF] px-2 py-0.5 rounded border border-[#D4E5FF]">
                PRE-FLIGHT TEST
              </span>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#1E293B] mb-1">Agent Context</label>
                <select
                  value={testAgentId}
                  onChange={(e) => setTestAgentId(e.target.value)}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                >
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Target Tool</label>
                  <input
                    type="text"
                    value={testTool}
                    onChange={(e) => setTestTool(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Operation</label>
                  <input
                    type="text"
                    value={testOp}
                    onChange={(e) => setTestOp(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#1E293B] mb-1">Target Resource</label>
                <input
                  type="text"
                  value={testRes}
                  onChange={(e) => setTestRes(e.target.value)}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={testing}
                className="w-full py-2.5 rounded-lg bg-[#3B82F6] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-xs"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{testing ? 'Evaluating Rules...' : 'Simulate Pre-Flight Evaluation'}</span>
              </button>
            </form>

            {/* Simulation Result */}
            {testSimulationResult && (
              <div
                className={`rounded-xl border p-4 text-xs space-y-2 ${
                  testSimulationResult.decision === 'ALLOWED'
                    ? 'border-[#BCE8CD] bg-[#E8F7EF]'
                    : 'border-[#FCD2D2] bg-[#FEF2F2]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-1.5">
                    <DecisionBadge decision={testSimulationResult.decision} />
                    <span className="text-[#1E293B]">Simulation Evaluation</span>
                  </div>
                </div>
                <div className="text-[#1E293B] leading-relaxed">
                  <strong>Evaluated Rule: </strong>
                  <span>{testSimulationResult.reason || 'Matched explicit security policy constraints.'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Step Policy Builder Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Security Policy"
          subtitle={`Step ${createStep} of 3: ${
            createStep === 1
              ? 'Basic Information'
              : createStep === 2
              ? 'Condition Configuration'
              : 'Enforcement & Priority'
          }`}
          icon={<Shield className="h-4 w-4 text-[#3B82F6]" />}
        >
          <div className="space-y-5 text-xs">
            {/* Step Progress Indicator */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF1]">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <span
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      createStep === step
                        ? 'bg-[#3B82F6] text-white'
                        : createStep > step
                        ? 'bg-[#E8F7EF] text-[#16A34A] border border-[#BCE8CD]'
                        : 'bg-[#F1F5F9] text-[#94A3B8]'
                    }`}
                  >
                    {step}
                  </span>
                  <span className={`font-medium ${createStep === step ? 'text-[#1E293B]' : 'text-[#94A3B8]'}`}>
                    {step === 1 ? 'Metadata' : step === 2 ? 'Conditions' : 'Enforcement'}
                  </span>
                </div>
              ))}
            </div>

            {/* Step 1: Basic Info */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Policy Name *</label>
                  <input
                    type="text"
                    required
                    value={newPolicyName}
                    onChange={(e) => setNewPolicyName(e.target.value)}
                    placeholder="e.g. StrictSandboxFilesystemGuard"
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={newPolicyDesc}
                    onChange={(e) => setNewPolicyDesc(e.target.value)}
                    placeholder="Describe purpose of guardrail..."
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Category</label>
                  <select
                    value={newPolicyCategory}
                    onChange={(e) => setNewPolicyCategory(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  >
                    <option value="filesystem">Filesystem Sandboxing</option>
                    <option value="database">Database Query Guard</option>
                    <option value="network">Network & SSRF Guard</option>
                    <option value="custom">Custom Agent Rules</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Conditions */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Agent Scope</label>
                  <input
                    type="text"
                    value={newPolicyAgentScope}
                    onChange={(e) => setNewPolicyAgentScope(e.target.value)}
                    placeholder="* or specific agent ID"
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Allowed Resource Prefix Pattern</label>
                  <input
                    type="text"
                    value={newPolicyResourcePattern}
                    onChange={(e) => setNewPolicyResourcePattern(e.target.value)}
                    placeholder="e.g. reports/*, public/*"
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Blocked File Extensions / Keywords</label>
                  <input
                    type="text"
                    value={newPolicyBlockedExtensions}
                    onChange={(e) => setNewPolicyBlockedExtensions(e.target.value)}
                    placeholder=".pem, .key, .env, DROP, TRUNCATE"
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Enforcement */}
            {createStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#1E293B] mb-1">Default Enforcement Effect</label>
                    <select
                      value={newPolicyDefaultEffect}
                      onChange={(e) => setNewPolicyDefaultEffect(e.target.value as any)}
                      className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                    >
                      <option value="DENY">DENY (Fail-Closed)</option>
                      <option value="ALLOW">ALLOW</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[#1E293B] mb-1">Evaluation Priority</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={newPolicyPriority}
                      onChange={(e) => setNewPolicyPriority(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="enforceCheck"
                    checked={newPolicyEnabled}
                    onChange={(e) => setNewPolicyEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[#E5EAF1] text-[#3B82F6]"
                  />
                  <label htmlFor="enforceCheck" className="text-[#1E293B] font-medium">
                    Enable and enforce policy immediately on zero-trust gateway
                  </label>
                </div>
              </div>
            )}

            {/* Step Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-[#E5EAF1]">
              <button
                type="button"
                onClick={() => {
                  if (createStep > 1) setCreateStep((s) => (s - 1) as any);
                  else setIsCreateOpen(false);
                }}
                className="px-4 py-2 rounded-lg border border-[#E5EAF1] text-[#64748B] hover:text-[#1E293B]"
              >
                {createStep === 1 ? 'Cancel' : 'Back'}
              </button>

              {createStep < 3 ? (
                <button
                  type="button"
                  disabled={createStep === 1 && !newPolicyName.trim()}
                  onClick={() => setCreateStep((s) => (s + 1) as any)}
                  className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold hover:bg-[#2563EB] disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={creatingPolicy}
                  onClick={handleCreatePolicySubmit}
                  className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold hover:bg-[#2563EB] disabled:opacity-50"
                >
                  {creatingPolicy ? 'Enacting...' : 'Enact Policy'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Policy Confirmation Modal */}
      {deleteConfirmOpen && policyToDelete && (
        <Modal
          isOpen={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setPolicyToDelete(null);
          }}
          title="Delete Security Policy"
          subtitle="This action permanently revokes deterministic policy enforcement"
          icon={<AlertTriangle className="h-4 w-4 text-[#DC2626]" />}
        >
          <div className="space-y-4">
            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to delete policy{' '}
              <strong className="text-[#1E293B] font-semibold">{policyToDelete.name}</strong>?
              This policy rule will be permanently deleted and will no longer protect gateway operations.
            </p>

            <div className="rounded-lg bg-[#FEF2F2] border border-[#FCD2D2] p-3 text-xs text-[#DC2626]">
              <strong className="block font-semibold">Warning:</strong>
              <span>Any agent requests relying on this policy will fallback to default-deny rules.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setPolicyToDelete(null);
                }}
                className="px-4 py-2 text-xs rounded-lg border border-[#E5EAF1] text-[#64748B] hover:text-[#1E293B]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs rounded-lg bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete Policy'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

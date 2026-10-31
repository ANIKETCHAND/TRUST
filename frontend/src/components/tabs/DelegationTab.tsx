import React, { useEffect, useState } from 'react';
import { GitFork, Plus, RefreshCw, ArrowRight, ShieldX } from 'lucide-react';
import { api } from '../../services/api.client';
import type { Delegation, Agent } from '../../types';
import { StatusBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatTimestamp, truncateId } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const DelegationTab: React.FC = () => {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parentId, setParentId] = useState('');
  const [childId, setChildId] = useState('');
  const [scopeTool, setScopeTool] = useState('filesystem_tool');
  const [scopeOp, setScopeOp] = useState('read_file');
  const [maxDepth, setMaxDepth] = useState(1);
  const [hoursValid, setHoursValid] = useState(4);
  const [issuedTokenData, setIssuedTokenData] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [delList, agentList] = await Promise.all([
        api.listDelegations(),
        api.listAgents('active'),
      ]);
      setDelegations(delList);
      setAgents(agentList);
      if (agentList.length >= 2) {
        if (!parentId) setParentId(agentList[0].id);
        if (!childId) setChildId(agentList[1].id);
      }
    } catch (err: any) {
      toast.error('Delegation Fetch Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parentId === childId) {
      toast.warning('Invalid Hierarchy', 'Parent and Child agents must be distinct.');
      return;
    }
    const expiresAt = new Date(Date.now() + hoursValid * 3600 * 1000).toISOString();
    try {
      const res = await api.createDelegation({
        parent_agent_id: parentId,
        child_agent_id: childId,
        scope: { tool_name: scopeTool, operation: scopeOp },
        expires_at: expiresAt,
        max_depth: maxDepth,
      });
      setIssuedTokenData(res);
      toast.success('Delegation Granted', 'Cryptographic delegation token generated.');
      fetchData();
    } catch (err: any) {
      toast.error('Delegation Blocked', err.message);
    }
  };

  const handleRevokeDelegation = async (id: string) => {
    const reason = prompt('Please provide reason for revoking this delegation grant:');
    if (!reason) return;
    try {
      await api.revokeDelegation(id, reason);
      toast.warning('Delegation Revoked', 'Subscoped delegation grant permanently disabled.');
      fetchData();
    } catch (err: any) {
      toast.error('Revocation Error', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <GitFork className="h-7 w-7 text-cyan-400" />
            Multi-Agent Delegation Security & Hierarchy
          </h1>
          <p className="text-sm text-slate-400">
            Cryptographically bounded parent-to-child delegation grants, depth constraints, and anti-privilege escalation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setIssuedTokenData(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            Issue Delegation Grant
          </button>
        </div>
      </div>

      {/* Delegation Cards */}
      {loading && delegations.length === 0 ? (
        <LoadingSpinner message="ANALYZING MULTI-AGENT DELEGATION GRAPHS..." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {delegations.map((del) => (
            <div key={del.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-mono text-xs text-slate-400">{truncateId(del.id)}</span>
                  <StatusBadge status={del.status} />
                </div>

                {/* Hierarchy Diagram */}
                <div className="mt-4 flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Parent Agent</span>
                    <div className="font-bold text-white text-xs mt-0.5">{del.parent_agent_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{truncateId(del.parent_agent_id)}</div>
                  </div>

                  <div className="flex flex-col items-center px-3 text-cyan-400">
                    <span className="font-mono text-[10px] uppercase text-cyan-400">Depth {del.current_depth}/{del.max_depth}</span>
                    <ArrowRight className="h-5 w-5 my-0.5" />
                    <span className="text-[10px] text-slate-500">Delegates</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Child Agent</span>
                    <div className="font-bold text-white text-xs mt-0.5">{del.child_agent_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{truncateId(del.child_agent_id)}</div>
                  </div>
                </div>

                {/* Scope details */}
                <div className="mt-4 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-400">Delegated Scope:</span>{' '}
                    <span className="font-mono text-cyan-300">
                      {del.scope.tool_name}:{del.scope.operation}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400">Expires At:</span>{' '}
                    <span className="text-slate-300">{formatTimestamp(del.expires_at)}</span>
                  </div>
                  {del.revocation_reason && (
                    <div className="text-rose-400 text-[11px]">
                      <span className="font-semibold">Revocation Reason:</span> {del.revocation_reason}
                    </div>
                  )}
                </div>
              </div>

              {del.status === 'active' && (
                <div className="mt-5 border-t border-slate-800 pt-3 flex justify-end">
                  <button
                    onClick={() => handleRevokeDelegation(del.id)}
                    className="rounded border border-rose-900 bg-rose-950/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60"
                  >
                    <ShieldX className="inline h-3.5 w-3.5 mr-1" />
                    Revoke Delegation
                  </button>
                </div>
              )}
            </div>
          ))}
          {delegations.length === 0 && (
            <div className="col-span-2 py-12 text-center text-xs text-slate-500 rounded-xl border border-slate-800 bg-slate-900/20">
              No inter-agent delegation grants issued yet. Click "Issue Delegation Grant" to create one.
            </div>
          )}
        </div>
      )}

      {/* Modal using shared Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Issue Cryptographic Delegation Grant"
        icon={<GitFork className="h-5 w-5" />}
      >
        {!issuedTokenData ? (
          <form onSubmit={handleCreateDelegation} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-300">Parent Agent (Delegator)</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-300">Child Agent (Delegatee)</label>
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-300">Scoped Tool</label>
                <select
                  value={scopeTool}
                  onChange={(e) => setScopeTool(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="filesystem_tool">filesystem_tool</option>
                  <option value="postgres_tool">postgres_tool</option>
                  <option value="http_api_tool">http_api_tool</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-300">Operation</label>
                <input
                  type="text"
                  value={scopeOp}
                  onChange={(e) => setScopeOp(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-300">Max Depth</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-300">Validity (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={hoursValid}
                  onChange={(e) => setHoursValid(parseInt(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500"
              >
                Grant Delegation Token
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-emerald-300">
              Delegation grant issued successfully!
            </div>
            <div>
              <label className="font-semibold text-slate-300">Delegation Token</label>
              <input
                type="text"
                readOnly
                value={issuedTokenData.delegation_token}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-cyan-300"
              />
              <p className="mt-1 text-slate-500">{issuedTokenData.warning}</p>
            </div>
            <div className="flex justify-end pt-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import {
  GitFork,
  Plus,
  RefreshCw,
  ArrowRight,
  ShieldX,
  Clock,
  Bot,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { Delegation, Agent } from '../../types';
import { StatusBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { StatCard } from '../ui/StatCard';
import { formatTimestamp, truncateId } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const DelegationTab: React.FC = () => {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parentId, setParentId] = useState('');
  const [childId, setChildId] = useState('');
  const [scopeTool, setScopeTool] = useState('filesystem_tool');
  const [scopeOp, setScopeOp] = useState('read_file');
  const [maxDepth, setMaxDepth] = useState(1);
  const [hoursValid, setHoursValid] = useState(4);
  const [issuedTokenData, setIssuedTokenData] = useState<any>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Revoke Modal state
  const [revokeTarget, setRevokeTarget] = useState<Delegation | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchData = useCallback(async () => {
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
  }, [childId, parentId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parentId === childId) {
      toast.warning('Invalid Hierarchy', 'Parent and Child agents must be distinct.');
      return;
    }

    try {
      const result = await api.createDelegation({
        parent_agent_id: parentId,
        child_agent_id: childId,
        scope: {
          tool_name: scopeTool,
          operation: scopeOp,
        },
        max_depth: Number(maxDepth),
        expires_in_hours: Number(hoursValid),
      });

      setIssuedTokenData(result);
      toast.success('Delegation Established', 'Subscoping contract generated.');
      fetchData();
    } catch (err: any) {
      toast.error('Delegation Failed', err.message);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeTarget || !revokeReason.trim()) return;
    setIsRevoking(true);
    try {
      await api.revokeDelegation(revokeTarget.id, revokeReason);
      toast.info('Delegation Revoked', 'Delegation token neutralized.');
      setRevokeTarget(null);
      setRevokeReason('');
      fetchData();
    } catch (err: any) {
      toast.error('Revocation Failed', err.message);
    } finally {
      setIsRevoking(false);
    }
  };

  const activeCount = delegations.filter((d) => d.status === 'active').length;
  const revokedCount = delegations.filter((d) => d.status === 'revoked').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <GitFork className="h-6 w-6 text-kali-cyan" />
            Delegation Control
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Subscoping tokens, depth limits, and parent-to-child permissions graph.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => {
              setIssuedTokenData(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-4 py-2 text-xs font-semibold text-white shadow-kali-glow hover:opacity-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Issue Delegation</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Active Grants"
          value={activeCount}
          subValue="Active"
          subValueColor="text-emerald-400"
          description="Verified tokens"
          icon={<GitFork className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          label="Revoked Grants"
          value={revokedCount}
          subValue="Neutralized"
          subValueColor="text-rose-400"
          description="Terminated early"
          icon={<ShieldX className="h-4 w-4 text-rose-400" />}
        />
        <StatCard
          label="Max Depth Bound"
          value="Depth 2"
          subValue="Enforced"
          subValueColor="text-kali-cyan"
          description="Strict non-escalation"
          icon={<GitFork className="h-4 w-4 text-kali-cyan" />}
        />
        <StatCard
          label="Principle Model"
          value="Least Privilege"
          subValue="Active"
          subValueColor="text-kali-primary"
          description="Subset scoping only"
          icon={<GitFork className="h-4 w-4 text-kali-primary" />}
        />
      </div>

      {/* Delegation Cards Grid */}
      {loading && delegations.length === 0 ? (
        <LoadingSpinner message="Loading delegation contracts..." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {delegations.map((del) => {
            return (
              <div
                key={del.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md flex flex-col justify-between hover:border-white/20 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                    <div className="flex items-center gap-2">
                      <GitFork className="h-4 w-4 text-kali-cyan" />
                      <span className="text-xs font-semibold text-white">
                        Delegation Token #{truncateId(del.id, 8)}
                      </span>
                    </div>
                    <StatusBadge status={del.status} />
                  </div>

                  {/* Flow Diagram */}
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs">
                    <div className="text-left max-w-[40%]">
                      <span className="text-[11px] text-slate-400 block font-medium">Parent Granter</span>
                      <div className="font-semibold text-white text-xs mt-1 truncate flex items-center gap-2">
                        <Bot className="h-4 w-4 text-kali-cyan shrink-0" />
                        <span>{del.parent_agent_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                        {truncateId(del.parent_agent_id, 10)}
                      </div>
                    </div>

                    <div className="flex flex-col items-center px-2">
                      <span className="text-[10px] font-medium text-kali-cyan bg-kali-cyan/10 px-2 py-0.5 rounded-full border border-kali-cyan/20">
                        Depth {del.current_depth}/{del.max_depth}
                      </span>
                      <ArrowRight className="h-4 w-4 my-1 text-slate-500" />
                      <span className="text-[10px] text-slate-500">delegates</span>
                    </div>

                    <div className="text-right max-w-[40%]">
                      <span className="text-[11px] text-slate-400 block font-medium">Child Delegatee</span>
                      <div className="font-semibold text-white text-xs mt-1 truncate flex items-center justify-end gap-2">
                        <span>{del.child_agent_name}</span>
                        <Bot className="h-4 w-4 text-kali-primary shrink-0" />
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                        {truncateId(del.child_agent_id, 10)}
                      </div>
                    </div>
                  </div>

                  {/* Scope details */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 border border-white/10 font-mono">
                      <span className="text-slate-400">Delegated Scope:</span>
                      <span className="font-semibold text-kali-cyan">
                        {del.scope.tool_name}:{del.scope.operation}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-xs px-1">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        <span>Expires:</span>
                      </span>
                      <span className="text-slate-300">{formatTimestamp(del.expires_at)}</span>
                    </div>
                    {del.revocation_reason && (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-400 text-xs">
                        <span className="font-semibold">Reason:</span> {del.revocation_reason}
                      </div>
                    )}
                  </div>
                </div>

                {del.status === 'active' && (
                  <div className="mt-4 border-t border-white/10 pt-3 flex justify-end">
                    <button
                      onClick={() => {
                        setRevokeTarget(del);
                        setRevokeReason('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                    >
                      <ShieldX className="h-3.5 w-3.5" />
                      <span>Revoke Delegation</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {delegations.length === 0 && (
            <div className="col-span-2 py-16 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-white/10 bg-white/[0.015]">
              No active delegation hierarchies detected. Click "Issue Delegation" to provision.
            </div>
          )}
        </div>
      )}

      {/* CREATE DELEGATION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Issue Delegation Grant"
        subtitle="Cryptographically bounds parent-to-child permissions"
        icon={<GitFork className="h-5 w-5" />}
      >
        {!issuedTokenData ? (
          <form onSubmit={handleCreateDelegation} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Parent Agent (Granter)</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-cyan focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} className="bg-[#0a0d14]">
                      {a.name} ({truncateId(a.id, 6)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Child Agent (Delegatee)</label>
                <select
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-cyan focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} className="bg-[#0a0d14]">
                      {a.name} ({truncateId(a.id, 6)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Delegated Tool Scope</label>
                <input
                  type="text"
                  required
                  value={scopeTool}
                  onChange={(e) => setScopeTool(e.target.value)}
                  placeholder="e.g. filesystem_tool"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Operation Scope</label>
                <input
                  type="text"
                  required
                  value={scopeOp}
                  onChange={(e) => setScopeOp(e.target.value)}
                  placeholder="e.g. read_file"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Max Delegation Depth</label>
                <select
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-cyan focus:outline-none"
                >
                  <option value={1} className="bg-[#0a0d14]">Depth 1 (Child Only)</option>
                  <option value={2} className="bg-[#0a0d14]">Depth 2 (Sub-delegation permitted)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Validity Duration (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={hoursValid}
                  onChange={(e) => setHoursValid(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl px-4 py-2 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-5 py-2 font-semibold text-white shadow-kali-glow hover:opacity-95"
              >
                Sign & Issue Token
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-slate-400">Token ID:</span>
                <span className="text-white font-mono">{issuedTokenData.delegation?.id}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-slate-400">Subscope:</span>
                <span className="text-kali-cyan font-mono">
                  {issuedTokenData.delegation?.scope?.tool_name}:{issuedTokenData.delegation?.scope?.operation}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Max Depth:</span>
                <span className="text-white">{issuedTokenData.delegation?.max_depth}</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cryptographic Delegation Token</div>
              <div className="flex items-center justify-between gap-3 bg-white/[0.03] p-3 rounded-xl border border-white/10 font-mono text-kali-cyan break-all">
                <span>{issuedTokenData.raw_delegation_token}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(issuedTokenData.raw_delegation_token);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="rounded-lg bg-kali-cyan/15 px-3 py-1.5 text-xs text-kali-cyan hover:bg-kali-cyan/25 transition-all shrink-0 font-sans"
                >
                  {copiedToken ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-white/10 pt-4">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setIssuedTokenData(null);
                }}
                className="rounded-xl bg-kali-primary px-5 py-2 font-semibold text-white hover:bg-kali-secondaryBlue"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* REVOKE DELEGATION MODAL */}
      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Delegation Grant"
        subtitle={`Token: ${revokeTarget?.id || ''}`}
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-400">
            Revoking this token will immediately invalidate child execution rights under this grant.
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">
              Reason for Revocation
            </label>
            <textarea
              rows={2}
              required
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Workflow task completed or suspicious delegation pattern"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setRevokeTarget(null)}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isRevoking || !revokeReason.trim()}
              onClick={handleRevokeConfirm}
              className="rounded-xl bg-rose-500 px-5 py-2 font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

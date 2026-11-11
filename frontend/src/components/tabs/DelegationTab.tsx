import React, { useEffect, useState, useCallback } from 'react';
import {
  GitFork,
  Plus,
  RefreshCw,
  ArrowRight,
  ShieldX,
  Clock,
  Copy,
  Check,
  Bot,
} from 'lucide-react';
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

  const handleRevokeConfirm = async () => {
    if (!revokeTarget || !revokeReason.trim()) return;
    setIsRevoking(true);
    try {
      await api.revokeDelegation(revokeTarget.id, revokeReason);
      toast.warning('Delegation Revoked', 'Subscoped delegation grant permanently disabled.');
      setRevokeTarget(null);
      setRevokeReason('');
      fetchData();
    } catch (err: any) {
      toast.error('Revocation Error', err.message);
    } finally {
      setIsRevoking(false);
    }
  };

  const activeCount = delegations.filter((d) => d.status === 'active').length;
  const revokedCount = delegations.filter((d) => d.status === 'revoked').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// AGENT_SECURITY</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">DELEGATION_CONTROL</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <GitFork className="h-6 w-6 text-kali-primary" />
            Multi-Agent Delegation Control & Subscoping Graph
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically signed subscope tokens, depth bounds, non-escalation guarantees, and parent-to-child lineage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>
          <button
            onClick={() => {
              setIssuedTokenData(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded border border-transparent bg-kali-primary px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>ISSUE DELEGATION</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[DEL-01] Active Grants</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-secure">{activeCount}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Cryptographically Valid</div>
        </div>
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[DEL-02] Revoked Contracts</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-critical">{revokedCount}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Terminated Early</div>
        </div>
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[DEL-03] Max Depth Allowed</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-cyan">DEPTH_2</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Strict Non-Escalation</div>
        </div>
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[DEL-04] Principle Model</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-primary">LEAST_PRIV</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Subset Scoping Only</div>
        </div>
      </div>

      {/* Delegation Cards Grid */}
      {loading && delegations.length === 0 ? (
        <LoadingSpinner message="VERIFYING DELEGATION CHAIN HIERARCHIES..." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {delegations.map((del) => {
            const isRevoked = del.status === 'revoked';
            const isExpired = del.status === 'expired';
            const cardBorder = isRevoked
              ? 'border-kali-critical/40 bg-[#331418]/20'
              : isExpired
              ? 'border-kali-warning/40 bg-[#2E200C]/20'
              : 'border-kali-border bg-kali-card hover:border-kali-primary/60';

            return (
              <div
                key={del.id}
                className={`rounded-lg border p-4 shadow-kali-card flex flex-col justify-between transition-all ${cardBorder}`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-kali-border pb-3">
                    <div className="flex items-center gap-2">
                      <GitFork className="h-4 w-4 text-kali-primary" />
                      <span className="font-mono text-xs font-bold text-white">
                        DELEGATION TOKEN #{truncateId(del.id, 8)}
                      </span>
                    </div>
                    <StatusBadge status={del.status} />
                  </div>

                  {/* Flow Diagram */}
                  <div className="mt-3.5 flex items-center justify-between rounded border border-kali-border bg-kali-bg p-3 font-mono">
                    <div className="text-left max-w-[40%]">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Parent Principal</span>
                      <div className="font-bold text-white text-xs mt-0.5 truncate flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-kali-cyan shrink-0" />
                        <span>{del.parent_agent_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {truncateId(del.parent_agent_id, 10)}
                      </div>
                    </div>

                    <div className="flex flex-col items-center px-2 text-kali-primary">
                      <span className="text-[9px] uppercase font-bold text-kali-cyan bg-kali-card px-1.5 py-0.5 rounded border border-kali-border">
                        DEPTH {del.current_depth}/{del.max_depth}
                      </span>
                      <ArrowRight className="h-4 w-4 my-1" />
                      <span className="text-[9px] text-slate-500 uppercase">DELEGATES</span>
                    </div>

                    <div className="text-right max-w-[40%]">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Child Delegatee</span>
                      <div className="font-bold text-white text-xs mt-0.5 truncate flex items-center justify-end gap-1.5">
                        <span>{del.child_agent_name}</span>
                        <Bot className="h-3.5 w-3.5 text-kali-primary shrink-0" />
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {truncateId(del.child_agent_id, 10)}
                      </div>
                    </div>
                  </div>

                  {/* Scope details */}
                  <div className="mt-3.5 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between rounded bg-kali-bg px-2.5 py-1.5 border border-kali-border">
                      <span className="text-slate-400">Delegated Scope:</span>
                      <span className="font-bold text-kali-cyan">
                        {del.scope.tool_name}:{del.scope.operation}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-[11px] px-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span>Expires:</span>
                      </span>
                      <span className="text-slate-300">{formatTimestamp(del.expires_at)}</span>
                    </div>
                    {del.revocation_reason && (
                      <div className="rounded border border-kali-critical/40 bg-[#331418] p-2 text-kali-critical text-[11px]">
                        <span className="font-bold">REVOCATION REASON:</span> {del.revocation_reason}
                      </div>
                    )}
                  </div>
                </div>

                {del.status === 'active' && (
                  <div className="mt-4 border-t border-kali-border pt-3 flex justify-end">
                    <button
                      onClick={() => {
                        setRevokeTarget(del);
                        setRevokeReason('');
                      }}
                      className="inline-flex items-center gap-1 rounded border border-kali-critical/60 bg-[#331418] px-3 py-1 font-mono text-xs font-semibold text-kali-critical hover:bg-[#4a1c22] transition-colors"
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
            <div className="col-span-2 py-12 text-center font-mono text-xs text-slate-500 rounded-lg border border-dashed border-kali-border bg-kali-card/50">
              // NO ACTIVE DELEGATION HIERARCHIES DETECTED. CLICK "ISSUE DELEGATION" TO PROVISION.
            </div>
          )}
        </div>
      )}

      {/* CREATE DELEGATION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="PROVISION DELEGATION GRANT"
        subtitle="Cryptographically bounds parent-to-child permissions"
        icon={<GitFork className="h-5 w-5" />}
      >
        {!issuedTokenData ? (
          <form onSubmit={handleCreateDelegation} className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Parent Agent (Granter)</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({truncateId(a.id, 6)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Child Agent (Delegatee)</label>
                <select
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({truncateId(a.id, 6)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Delegated Tool</label>
                <input
                  type="text"
                  value={scopeTool}
                  onChange={(e) => setScopeTool(e.target.value)}
                  className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Allowed Operation</label>
                <input
                  type="text"
                  value={scopeOp}
                  onChange={(e) => setScopeOp(e.target.value)}
                  className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Max Delegation Depth</label>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">TTL (Hours Valid)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={hoursValid}
                  onChange={(e) => setHoursValid(Number(e.target.value))}
                  className="w-full rounded border border-kali-border bg-kali-bg px-2.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-kali-border">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded border border-kali-border bg-kali-elevated px-4 py-2 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-kali-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-kali-glow hover:bg-kali-secondaryBlue"
              >
                Sign & Issue Token
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            <div className="rounded border border-kali-secure/80 bg-[#0E2E22] p-3 text-kali-secure">
              // DELEGATION CONTRACT SIGNED & PERSISTED.
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Delegation Bearer Token</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={issuedTokenData.delegation_token || issuedTokenData.token || JSON.stringify(issuedTokenData)}
                  className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-kali-cyan select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      issuedTokenData.delegation_token || issuedTokenData.token || JSON.stringify(issuedTokenData)
                    );
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="rounded border border-kali-border bg-kali-elevated px-3 py-2 text-xs font-medium text-slate-200 hover:border-kali-primary hover:text-white"
                  title="Copy Token"
                >
                  {copiedToken ? <Check className="h-4 w-4 text-kali-secure" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-kali-border">
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded bg-kali-primary px-4 py-2 font-mono text-xs font-bold text-white hover:bg-kali-secondaryBlue"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* REVOCATION CONFIRMATION MODAL */}
      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="REVOKE DELEGATION CONTRACT"
        subtitle={`TARGET: TOKEN #${truncateId(revokeTarget?.id || '', 8)}`}
        icon={<ShieldX className="h-5 w-5 text-kali-critical" />}
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="rounded border border-kali-critical/60 bg-[#331418] p-3 text-kali-critical">
            [AUDIT NOTICE] Revoking this delegation immediately halts any child agent actions relying on this specific scoped grant.
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Revocation Justification (Required for SOC Audit)
            </label>
            <textarea
              rows={3}
              required
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Scope violation, task execution finished early, security anomaly investigation"
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-critical focus:outline-none font-sans"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-kali-border">
            <button
              onClick={() => setRevokeTarget(null)}
              className="rounded border border-kali-border bg-kali-elevated px-4 py-2 text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              disabled={!revokeReason.trim() || isRevoking}
              onClick={handleRevokeConfirm}
              className="rounded bg-kali-critical px-4 py-2 font-mono text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

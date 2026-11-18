import React, { useState } from 'react';
import {
  Bot,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Eye,
  ShieldX,
  AlertOctagon,
  PauseCircle,
  PlayCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useAgents } from '../../hooks/useAgents';
import type { Agent, AgentRegistrationResult } from '../../types';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { StatCard } from '../ui/StatCard';
import { formatTimestamp, truncateId } from '../../utils/formatters';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';

export const AgentsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const { agents, loading, refresh, registerAgent, revokeAgent } = useAgents(statusFilter);
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('general_agent');
  const [newAgentDesc, setNewAgentDesc] = useState('');
  const [newAgentOrg, setNewAgentOrg] = useState('SOC-PRIMARY');
  const [registeredKeyData, setRegisteredKeyData] = useState<AgentRegistrationResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Revocation Modal state
  const [revokeAgentTarget, setRevokeAgentTarget] = useState<Agent | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  // Suspension Modal state
  const [suspendTarget, setSuspendTarget] = useState<Agent | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);

  // Agent Comprehensive Inspector state
  const [inspectAgent, setInspectAgent] = useState<Agent | null>(null);
  const [inspectTab, setInspectTab] = useState<'overview' | 'permissions' | 'delegations' | 'activity' | 'incidents'>('overview');
  const [agentPermissions, setAgentPermissions] = useState<any[]>([]);
  const [agentDelegations, setAgentDelegations] = useState<any[]>([]);
  const [agentEvents, setAgentEvents] = useState<any[]>([]);
  const [agentIncidents, setAgentIncidents] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Grant Permission Sub-Modal state
  const [isGrantPermOpen, setIsGrantPermOpen] = useState(false);
  const [permTool, setPermTool] = useState('filesystem_tool');
  const [permOp, setPermOp] = useState('read_file');
  const [permRes, setPermRes] = useState('reports/*');
  const [permEffect, setPermEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [permPriority, setPermPriority] = useState(100);
  const [permDesc, setPermDesc] = useState('');
  const [grantingPerm, setGrantingPerm] = useState(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await registerAgent({
      name: newAgentName,
      role: newAgentRole,
      description: newAgentDesc,
      agent_metadata: { org: newAgentOrg },
    });
    if (result) {
      setRegisteredKeyData(result);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeAgentTarget || !revokeReason.trim()) return;
    setIsRevoking(true);
    const success = await revokeAgent(revokeAgentTarget.id, revokeReason);
    if (success) {
      setRevokeAgentTarget(null);
      setRevokeReason('');
      if (inspectAgent?.id === revokeAgentTarget.id) {
        setInspectAgent(null);
      }
    }
    setIsRevoking(false);
  };

  const handleSuspendConfirm = async () => {
    if (!suspendTarget) return;
    setIsSuspending(true);
    const newStatus = suspendTarget.status === 'suspended' ? 'active' : 'suspended';
    try {
      await api.updateAgent(suspendTarget.id, { status: newStatus });
      toast.success(
        newStatus === 'suspended' ? 'Agent Suspended' : 'Agent Resumed',
        `Agent '${suspendTarget.name}' status updated to ${newStatus.toUpperCase()}.`
      );
      setSuspendTarget(null);
      refresh();
      if (inspectAgent?.id === suspendTarget.id) {
        setInspectAgent({ ...inspectAgent, status: newStatus as any });
      }
    } catch (err: any) {
      toast.error('Status Update Failed', err.message);
    } finally {
      setIsSuspending(false);
    }
  };

  const handleInspect = async (agent: Agent) => {
    setInspectAgent(agent);
    setInspectTab('overview');
    setLoadingDetails(true);
    try {
      const [perms, delegations, events, incidents] = await Promise.allSettled([
        api.listPermissions(agent.id),
        api.listDelegations(),
        api.listAuditEvents({ agent_id: agent.id, limit: 15 }),
        api.listIncidents({ limit: 50 }),
      ]);

      if (perms.status === 'fulfilled' && Array.isArray(perms.value)) {
        setAgentPermissions(perms.value);
      } else {
        setAgentPermissions([]);
      }

      if (delegations.status === 'fulfilled' && Array.isArray(delegations.value)) {
        setAgentDelegations(
          delegations.value.filter(
            (d) => d.parent_agent_id === agent.id || d.child_agent_id === agent.id
          )
        );
      } else {
        setAgentDelegations([]);
      }

      if (events.status === 'fulfilled' && Array.isArray(events.value)) {
        setAgentEvents(events.value);
      } else {
        setAgentEvents([]);
      }

      if (incidents.status === 'fulfilled' && Array.isArray(incidents.value)) {
        setAgentIncidents(incidents.value.filter((i) => i.agent_id === agent.id));
      } else {
        setAgentIncidents([]);
      }
    } catch (e) {
      console.error('Failed to load full agent details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleGrantPermissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectAgent) return;
    setGrantingPerm(true);
    try {
      await api.grantPermission({
        agent_id: inspectAgent.id,
        tool_name: permTool,
        operation: permOp,
        resource_pattern: permRes,
        effect: permEffect,
        priority: permPriority,
        description: permDesc || undefined,
      });
      toast.success('Permission Granted', `Rule added for ${inspectAgent.name}.`);
      setIsGrantPermOpen(false);
      setPermDesc('');
      const perms = await api.listPermissions(inspectAgent.id);
      setAgentPermissions(perms);
    } catch (err: any) {
      toast.error('Grant Failed', err.message);
    } finally {
      setGrantingPerm(false);
    }
  };

  const handleRevokePermission = async (permId: string) => {
    if (!inspectAgent) return;
    try {
      await api.revokePermission(permId);
      toast.info('Permission Revoked', 'Permission rule deleted from agent profile.');
      const perms = await api.listPermissions(inspectAgent.id);
      setAgentPermissions(perms);
    } catch (err: any) {
      toast.error('Revocation Failed', err.message);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = agents.filter((a) => a.status === 'active').length;
  const suspendedCount = agents.filter((a) => a.status === 'suspended').length;
  const revokedCount = agents.filter((a) => a.status === 'revoked').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bot className="h-6 w-6 text-kali-cyan" />
            Agent Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cryptographic identity provisioning, permissions, and delegation control.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => {
              setRegisteredKeyData(null);
              setIsRegisterOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-4 py-2 text-xs font-semibold text-white shadow-kali-glow hover:opacity-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Enroll Agent</span>
          </button>
        </div>
      </div>

      {/* Metrics Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Enrolled"
          value={agents.length}
          description="Known identities"
          icon={<Bot className="h-4 w-4" />}
        />
        <StatCard
          label="Active Agents"
          value={activeCount}
          subValue="Healthy"
          subValueColor="text-emerald-400"
          description="Verified heartbeats"
          icon={<Bot className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          label="Suspended State"
          value={suspendedCount}
          subValue="Paused"
          subValueColor="text-amber-400"
          description="Execution paused"
          icon={<PauseCircle className="h-4 w-4 text-amber-400" />}
        />
        <StatCard
          label="Revoked Tokens"
          value={revokedCount}
          subValue="Terminated"
          subValueColor="text-rose-400"
          description="Access revoked"
          icon={<ShieldX className="h-4 w-4 text-rose-400" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter by agent name, cryptographic ID, or role..."
          className="max-w-md w-full"
        />
        <div className="flex items-center gap-2.5 text-xs">
          <span className="text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white focus:border-kali-cyan/50 focus:outline-none"
          >
            <option value="" className="bg-[#0a0d14]">All Statuses</option>
            <option value="active" className="bg-[#0a0d14]">Active Only</option>
            <option value="suspended" className="bg-[#0a0d14]">Suspended Only</option>
            <option value="revoked" className="bg-[#0a0d14]">Revoked Only</option>
            <option value="inactive" className="bg-[#0a0d14]">Inactive</option>
          </select>
        </div>
      </div>

      {/* Agents Inventory Table */}
      {loading && agents.length === 0 ? (
        <LoadingSpinner message="Loading agent identities..." />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Agent Name</th>
                  <th className="py-3 px-4 font-medium">Cryptographic ID</th>
                  <th className="py-3 px-4 font-medium">Organization</th>
                  <th className="py-3 px-4 font-medium">Assigned Role</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Last Heartbeat</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {filteredAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <Bot className="h-4 w-4 text-kali-cyan shrink-0" />
                        <div>
                          <div>{agent.name}</div>
                          {agent.description && (
                            <div className="text-[11px] text-slate-500 font-normal truncate max-w-xs mt-0.5">
                              {agent.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-white/5 px-2 py-0.5 border border-white/10 text-[11px] text-kali-cyan">
                          {truncateId(agent.id, 12)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(agent.id, agent.id)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Copy Full ID"
                        >
                          {copiedId === agent.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {agent.agent_metadata?.org || 'SOC-PRIMARY'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] border border-white/10">
                        {agent.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={agent.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {formatTimestamp((agent as any).last_heartbeat || agent.updated_at || agent.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* Inspect Dossier Button */}
                      <button
                        onClick={() => handleInspect(agent)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-200 hover:border-kali-cyan/40 hover:text-white transition-all"
                        title="Open Complete Dossier"
                      >
                        <Eye className="h-3.5 w-3.5 text-kali-cyan" />
                        <span>Inspect</span>
                      </button>

                      {/* Suspend / Resume Button */}
                      {agent.status === 'active' && (
                        <button
                          onClick={() => setSuspendTarget(agent)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-500 hover:text-black transition-all"
                          title="Suspend Agent Execution"
                        >
                          <PauseCircle className="h-3.5 w-3.5" />
                          <span>Suspend</span>
                        </button>
                      )}
                      {agent.status === 'suspended' && (
                        <button
                          onClick={() => setSuspendTarget(agent)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                          title="Resume Agent Execution"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          <span>Resume</span>
                        </button>
                      )}

                      {/* Revoke Credentials Button */}
                      {agent.status !== 'revoked' && (
                        <button
                          onClick={() => {
                            setRevokeAgentTarget(agent);
                            setRevokeReason('');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                          title="Permanently Revoke Credentials"
                        >
                          <ShieldX className="h-3.5 w-3.5" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAgents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                      No agents matching search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE AGENT DETAILS INSPECTION MODAL */}
      <Modal
        isOpen={!!inspectAgent}
        onClose={() => setInspectAgent(null)}
        title={`Agent Dossier: ${inspectAgent?.name || ''}`}
        subtitle={`ID: ${inspectAgent?.id || ''}`}
        maxWidth="2xl"
      >
        {inspectAgent && (
          <div className="space-y-5">
            {/* Inspector Navigation Tabs */}
            <div className="flex border-b border-white/10 gap-2 text-xs overflow-x-auto">
              <button
                onClick={() => setInspectTab('overview')}
                className={`px-4 py-2 border-b-2 font-medium transition-all whitespace-nowrap ${
                  inspectTab === 'overview'
                    ? 'border-kali-cyan text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Identity & Credentials
              </button>
              <button
                onClick={() => setInspectTab('permissions')}
                className={`px-4 py-2 border-b-2 font-medium transition-all whitespace-nowrap ${
                  inspectTab === 'permissions'
                    ? 'border-kali-cyan text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Permissions ({agentPermissions.length})
              </button>
              <button
                onClick={() => setInspectTab('delegations')}
                className={`px-4 py-2 border-b-2 font-medium transition-all whitespace-nowrap ${
                  inspectTab === 'delegations'
                    ? 'border-kali-cyan text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Delegations ({agentDelegations.length})
              </button>
              <button
                onClick={() => setInspectTab('activity')}
                className={`px-4 py-2 border-b-2 font-medium transition-all whitespace-nowrap ${
                  inspectTab === 'activity'
                    ? 'border-kali-cyan text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Tool Calls ({agentEvents.length})
              </button>
              <button
                onClick={() => setInspectTab('incidents')}
                className={`px-4 py-2 border-b-2 font-medium transition-all whitespace-nowrap ${
                  inspectTab === 'incidents'
                    ? 'border-kali-cyan text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Incidents ({agentIncidents.length})
              </button>
            </div>

            {loadingDetails ? (
              <LoadingSpinner message="Loading agent details..." />
            ) : (
              <>
                {/* TAB 1: OVERVIEW & CREDENTIALS */}
                {inspectTab === 'overview' && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="text-[11px] text-slate-400 uppercase font-medium">Agent Identity</div>
                        <div className="text-white font-bold text-sm mt-1">{inspectAgent.name}</div>
                        <div className="text-slate-400 text-xs mt-1">{inspectAgent.description || 'No description provided.'}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="text-[11px] text-slate-400 uppercase font-medium">Enforcement Status</div>
                        <div className="mt-1.5">
                          <StatusBadge status={inspectAgent.status} />
                        </div>
                        <div className="text-slate-400 text-xs mt-1.5">Role: {inspectAgent.role}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
                      <div className="text-xs font-semibold text-kali-cyan">Cryptographic Credentials</div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2 text-slate-300">
                        <span>Unique Identifier:</span>
                        <span className="text-white font-mono select-all">{inspectAgent.id}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2 text-slate-300">
                        <span>Credential Hash:</span>
                        <span className="text-emerald-400">SHA-256 Verified</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2 text-slate-300">
                        <span>Organization Unit:</span>
                        <span className="text-white">{inspectAgent.agent_metadata?.org || 'SOC-PRIMARY'}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Enrolled Timestamp:</span>
                        <span className="text-slate-400">{formatTimestamp(inspectAgent.created_at)}</span>
                      </div>
                    </div>

                    {/* Operational Controls Strip */}
                    <div className="flex items-center justify-end gap-2.5 border-t border-white/10 pt-4">
                      {inspectAgent.status === 'active' && (
                        <button
                          onClick={() => setSuspendTarget(inspectAgent)}
                          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500 hover:text-black transition-all"
                        >
                          Suspend Execution
                        </button>
                      )}
                      {inspectAgent.status === 'suspended' && (
                        <button
                          onClick={() => setSuspendTarget(inspectAgent)}
                          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                        >
                          Resume Execution
                        </button>
                      )}
                      {inspectAgent.status !== 'revoked' && (
                        <button
                          onClick={() => {
                            setRevokeAgentTarget(inspectAgent);
                            setRevokeReason('');
                          }}
                          className="rounded-xl bg-rose-500 hover:bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-all"
                        >
                          Revoke Identity
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: PERMISSIONS */}
                {inspectTab === 'permissions' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Granular Permission Rules</span>
                      <button
                        onClick={() => setIsGrantPermOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-kali-cyan/40 bg-kali-cyan/10 px-3 py-1.5 text-xs font-medium text-kali-cyan hover:bg-kali-cyan/20 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Grant Permission</span>
                      </button>
                    </div>

                    {agentPermissions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">
                        No explicit permissions granted. Agent operates under default-deny.
                      </div>
                    ) : (
                      agentPermissions.map((perm) => (
                        <div key={perm.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                perm.effect === 'ALLOW' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {perm.effect}
                              </span>
                              <span className="text-white font-medium">{perm.tool_name}:{perm.operation}</span>
                            </div>
                            <div className="mt-1 text-slate-400">Resource: {perm.resource_pattern}</div>
                            {perm.description && <div className="mt-0.5 text-slate-500 text-[11px]">{perm.description}</div>}
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <span className="text-slate-400 text-xs">Priority: {perm.priority}</span>
                            <button
                              onClick={() => handleRevokePermission(perm.id)}
                              className="text-rose-400 hover:text-rose-300 p-1"
                              title="Revoke Permission Grant"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 3: DELEGATIONS */}
                {inspectTab === 'delegations' && (
                  <div className="space-y-3 text-xs">
                    {agentDelegations.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">
                        No delegation contracts recorded for this agent.
                      </div>
                    ) : (
                      agentDelegations.map((del) => (
                        <div key={del.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-kali-cyan font-medium">Token #{truncateId(del.id, 8)}</span>
                            <StatusBadge status={del.status} />
                          </div>
                          <div className="text-slate-300">
                            {del.parent_agent_id === inspectAgent.id ? 'Parent Agent (Granter)' : 'Child Agent (Delegatee)'}
                          </div>
                          <div className="text-xs text-slate-400">
                            Scope: {del.scope?.tool_name}:{del.scope?.operation} • Max Depth: {del.max_depth}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 4: ACTIVITY AUDIT */}
                {inspectTab === 'activity' && (
                  <div className="space-y-2 text-xs">
                    {agentEvents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">
                        No recent gateway audit events recorded.
                      </div>
                    ) : (
                      agentEvents.map((ev) => (
                        <div key={ev.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium">{ev.tool_name}:{ev.operation}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Target: {ev.target_resource}</div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ev.decision === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {ev.decision}
                            </span>
                            <div className="text-[11px] text-slate-500 mt-1">{formatTimestamp(ev.created_at)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 5: INCIDENTS */}
                {inspectTab === 'incidents' && (
                  <div className="space-y-2 text-xs">
                    {agentIncidents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">
                        No active security incidents linked to this agent.
                      </div>
                    ) : (
                      agentIncidents.map((inc) => (
                        <div key={inc.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <SeverityBadge severity={inc.severity} />
                            <StatusBadge status={inc.status} />
                          </div>
                          <div className="font-semibold text-white text-xs mt-1">{inc.title}</div>
                          <p className="text-xs text-slate-400">{inc.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* GRANT PERMISSION MODAL */}
      <Modal
        isOpen={isGrantPermOpen}
        onClose={() => setIsGrantPermOpen(false)}
        title={`Grant Permission: ${inspectAgent?.name || ''}`}
        subtitle="Add granular RBAC authorization grant to policy engine"
      >
        <form onSubmit={handleGrantPermissionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Target Tool</label>
            <input
              type="text"
              required
              value={permTool}
              onChange={(e) => setPermTool(e.target.value)}
              placeholder="e.g. filesystem_tool, database_tool"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Target Operation</label>
            <input
              type="text"
              required
              value={permOp}
              onChange={(e) => setPermOp(e.target.value)}
              placeholder="e.g. read_file, query, *"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Resource Pattern</label>
            <input
              type="text"
              required
              value={permRes}
              onChange={(e) => setPermRes(e.target.value)}
              placeholder="e.g. reports/*, confidential/*, *"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Effect</label>
              <select
                value={permEffect}
                onChange={(e) => setPermEffect(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
              >
                <option value="ALLOW" className="bg-[#0a0d14]">ALLOW</option>
                <option value="DENY" className="bg-[#0a0d14]">DENY</option>
              </select>
            </div>
            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Priority</label>
              <input
                type="number"
                value={permPriority}
                onChange={(e) => setPermPriority(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Description</label>
            <input
              type="text"
              value={permDesc}
              onChange={(e) => setPermDesc(e.target.value)}
              placeholder="Authorized access justification..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
            />
          </div>

          <div className="border-t border-white/10 pt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsGrantPermOpen(false)}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={grantingPerm}
              className="rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-5 py-2 font-semibold text-white shadow-kali-glow hover:opacity-95 disabled:opacity-50"
            >
              {grantingPerm ? 'Committing...' : 'Commit Grant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* SUSPENSION CONFIRMATION MODAL */}
      <Modal
        isOpen={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title={suspendTarget?.status === 'suspended' ? 'Resume Agent Execution' : 'Suspend Agent Execution'}
        subtitle={`Agent: ${suspendTarget?.name || ''}`}
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-400 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>
              {suspendTarget?.status === 'suspended'
                ? `Resuming will restore execution privileges for agent '${suspendTarget?.name}'.`
                : `Suspending will temporarily pause all tool invocations for agent '${suspendTarget?.name}' without revoking credentials.`}
            </span>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setSuspendTarget(null)}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSuspending}
              onClick={handleSuspendConfirm}
              className={`rounded-xl px-5 py-2 font-semibold text-white transition-all disabled:opacity-50 ${
                suspendTarget?.status === 'suspended'
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-amber-500 text-black hover:bg-amber-600'
              }`}
            >
              {isSuspending
                ? 'Updating...'
                : suspendTarget?.status === 'suspended'
                ? 'Confirm Resume'
                : 'Confirm Suspension'}
            </button>
          </div>
        </div>
      </Modal>

      {/* REGISTRATION MODAL */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Enroll Autonomous Agent"
        subtitle="Generate signed API authorization credentials"
        icon={<Bot className="h-5 w-5" />}
      >
        {!registeredKeyData ? (
          <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Agent Name</label>
              <input
                type="text"
                required
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="e.g. Sentry-Threat-Collector"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Role</label>
                <select
                  value={newAgentRole}
                  onChange={(e) => setNewAgentRole(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
                >
                  <option value="general_agent" className="bg-[#0a0d14]">general_agent</option>
                  <option value="data_collector" className="bg-[#0a0d14]">data_collector</option>
                  <option value="incident_responder" className="bg-[#0a0d14]">incident_responder</option>
                  <option value="security_auditor" className="bg-[#0a0d14]">security_auditor</option>
                  <option value="threat_hunter" className="bg-[#0a0d14]">threat_hunter</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Organization</label>
                <input
                  type="text"
                  value={newAgentOrg}
                  onChange={(e) => setNewAgentOrg(e.target.value)}
                  placeholder="SOC-PRIMARY"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1.5">Description</label>
              <textarea
                rows={2}
                value={newAgentDesc}
                onChange={(e) => setNewAgentDesc(e.target.value)}
                placeholder="Operational purpose and scope..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
              />
            </div>

            <div className="border-t border-white/10 pt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="rounded-xl px-4 py-2 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-5 py-2 font-semibold text-white shadow-kali-glow hover:opacity-95"
              >
                Generate Credentials
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-400 flex items-start gap-2.5">
              <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Security Notice:</span> This API key will not be displayed again. Please save it securely.
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">API Authorization Token</div>
              <div className="flex items-center justify-between gap-3 bg-white/[0.03] p-3 rounded-xl border border-white/10 font-mono text-kali-cyan break-all">
                <span>{registeredKeyData.raw_api_key}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(registeredKeyData.raw_api_key);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="rounded-lg bg-kali-cyan/15 px-3 py-1.5 text-xs text-kali-cyan hover:bg-kali-cyan/25 transition-all shrink-0 font-sans"
                >
                  {copiedKey ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-white/10 pt-4">
              <button
                onClick={() => {
                  setIsRegisterOpen(false);
                  setRegisteredKeyData(null);
                }}
                className="rounded-xl bg-kali-primary px-5 py-2 font-semibold text-white hover:bg-kali-secondaryBlue"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* REVOCATION MODAL */}
      <Modal
        isOpen={!!revokeAgentTarget}
        onClose={() => setRevokeAgentTarget(null)}
        title="Revoke Credentials"
        subtitle={`Agent: ${revokeAgentTarget?.name || ''}`}
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-400 flex items-center gap-3">
            <ShieldX className="h-5 w-5 shrink-0" />
            <span>
              Revoking credentials will permanently block all tool invocations for agent '{revokeAgentTarget?.name}'. This action cannot be undone.
            </span>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">
              Revocation Reason:
            </label>
            <textarea
              rows={2}
              required
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Credential replacement or suspicion of compromise"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setRevokeAgentTarget(null)}
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

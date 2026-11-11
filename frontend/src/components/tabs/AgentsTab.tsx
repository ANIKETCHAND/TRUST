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
    } catch {
      toast.error('Inspect Error', 'Failed to retrieve agent relationships.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleGrantPermissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectAgent) return;
    setGrantingPerm(true);
    try {
      await api.createPermission({
        agent_id: inspectAgent.id,
        tool_name: permTool,
        operation: permOp,
        effect: permEffect,
        resource_pattern: permRes,
        priority: Number(permPriority),
        description: permDesc || undefined,
      });
      toast.success('Permission Granted', `Rule ${permEffect} ${permTool}:${permOp} committed.`);
      setIsGrantPermOpen(false);
      // Reload permissions
      const updatedPerms = await api.listPermissions(inspectAgent.id);
      setAgentPermissions(Array.isArray(updatedPerms) ? updatedPerms : []);
    } catch (err: any) {
      toast.error('Grant Failed', err.message);
    } finally {
      setGrantingPerm(false);
    }
  };

  const handleRevokePermission = async (permId: string) => {
    if (!inspectAgent) return;
    try {
      await api.deactivatePermission(permId);
      toast.warning('Permission Revoked', 'Rule removed from agent permission set.');
      const updatedPerms = await api.listPermissions(inspectAgent.id);
      setAgentPermissions(Array.isArray(updatedPerms) ? updatedPerms : []);
    } catch (err: any) {
      toast.error('Revoke Failed', err.message);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// AGENT_SECURITY</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">IDENTITY_REGISTRY</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Bot className="h-6 w-6 text-kali-primary" />
            Autonomous Agent Management & Identity Console
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographic identity provisioning, granular permission editing, agent suspension, and multi-agent delegation control.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>
          <button
            onClick={() => {
              setRegisteredKeyData(null);
              setIsRegisterOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded border border-transparent bg-kali-primary px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>ENROLL AGENT</span>
          </button>
        </div>
      </div>

      {/* Metrics Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[ID-01] Total Enrolled</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">{agents.length}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Known Identities</div>
        </div>
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[ID-02] Active Enforcing</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-secure">{activeCount}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Healthy Heartbeats</div>
        </div>
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[ID-03] Suspended State</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-warning">{suspendedCount}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Execution Paused</div>
        </div>
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[ID-04] Revoked Tokens</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-critical">{revokedCount}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Zero-Trust Terminated</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter by agent name, cryptographic ID, or role..."
          className="max-w-md w-full"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">STATUS:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none"
          >
            <option value="">ALL STATUSES</option>
            <option value="active">ACTIVE ONLY</option>
            <option value="suspended">SUSPENDED ONLY</option>
            <option value="revoked">REVOKED ONLY</option>
            <option value="inactive">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Agents Inventory Table */}
      {loading && agents.length === 0 ? (
        <LoadingSpinner message="VERIFYING AGENT CRYPTOGRAPHIC IDENTITIES..." />
      ) : (
        <div className="rounded-lg border border-kali-border bg-kali-card overflow-hidden shadow-kali-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-kali-border bg-kali-bg/95 font-mono text-[11px] text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Agent Name</th>
                  <th className="py-3 px-4 font-semibold">Unique Cryptographic ID</th>
                  <th className="py-3 px-4 font-semibold">Organization</th>
                  <th className="py-3 px-4 font-semibold">Assigned Role</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Last Heartbeat</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border text-slate-300">
                {filteredAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-kali-elevated/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-kali-primary shrink-0" />
                        <div>
                          <div>{agent.name}</div>
                          {agent.description && (
                            <div className="text-[10px] text-slate-500 font-normal truncate max-w-xs">
                              {agent.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-kali-bg px-2 py-0.5 border border-kali-border text-[11px] text-kali-cyan">
                          {truncateId(agent.id, 12)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(agent.id, agent.id)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Copy Full ID"
                        >
                          {copiedId === agent.id ? (
                            <Check className="h-3 w-3 text-kali-secure" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {agent.agent_metadata?.org || 'SOC-PRIMARY'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      <span className="rounded bg-kali-bg px-2 py-0.5 text-[10px] border border-kali-border uppercase">
                        {agent.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={agent.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {formatTimestamp((agent as any).last_heartbeat || agent.updated_at || agent.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 font-mono whitespace-nowrap">
                      {/* Inspect Dossier Button */}
                      <button
                        onClick={() => handleInspect(agent)}
                        className="inline-flex items-center gap-1 rounded border border-kali-border bg-kali-elevated px-2.5 py-1 text-[11px] text-slate-200 hover:border-kali-primary hover:text-white transition-colors"
                        title="Open Complete Dossier"
                      >
                        <Eye className="h-3 w-3 text-kali-cyan" />
                        <span>Inspect</span>
                      </button>

                      {/* Suspend / Resume Button */}
                      {agent.status === 'active' && (
                        <button
                          onClick={() => setSuspendTarget(agent)}
                          className="inline-flex items-center gap-1 rounded border border-kali-warning/50 bg-[#2E200C] px-2 py-1 text-[11px] text-kali-warning hover:bg-[#473212] transition-colors"
                          title="Suspend Agent Execution"
                        >
                          <PauseCircle className="h-3 w-3" />
                          <span>Suspend</span>
                        </button>
                      )}
                      {agent.status === 'suspended' && (
                        <button
                          onClick={() => setSuspendTarget(agent)}
                          className="inline-flex items-center gap-1 rounded border border-kali-secure/50 bg-[#0E2E22] px-2 py-1 text-[11px] text-kali-secure hover:bg-[#154634] transition-colors"
                          title="Resume Agent Execution"
                        >
                          <PlayCircle className="h-3 w-3" />
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
                          className="inline-flex items-center gap-1 rounded border border-kali-critical/60 bg-[#331418] px-2 py-1 text-[11px] text-kali-critical hover:bg-[#4a1c22] transition-colors"
                          title="Permanently Revoke Credentials"
                        >
                          <ShieldX className="h-3 w-3" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAgents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center font-mono text-xs text-slate-500">
                      // NO AGENTS MATCH QUERY CRITERIA
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
        title={`AGENT DOSSIER // ${inspectAgent?.name || ''}`}
        subtitle={`ID: ${inspectAgent?.id || ''}`}
        maxWidth="2xl"
      >
        {inspectAgent && (
          <div className="space-y-4">
            {/* Inspector Navigation Tabs */}
            <div className="flex border-b border-kali-border gap-2 font-mono text-xs overflow-x-auto">
              <button
                onClick={() => setInspectTab('overview')}
                className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                  inspectTab === 'overview'
                    ? 'border-kali-primary text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                IDENTITY & CREDENTIALS
              </button>
              <button
                onClick={() => setInspectTab('permissions')}
                className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                  inspectTab === 'permissions'
                    ? 'border-kali-primary text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                PERMISSIONS ({agentPermissions.length})
              </button>
              <button
                onClick={() => setInspectTab('delegations')}
                className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                  inspectTab === 'delegations'
                    ? 'border-kali-primary text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                DELEGATIONS ({agentDelegations.length})
              </button>
              <button
                onClick={() => setInspectTab('activity')}
                className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                  inspectTab === 'activity'
                    ? 'border-kali-primary text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                TOOL-CALL AUDIT ({agentEvents.length})
              </button>
              <button
                onClick={() => setInspectTab('incidents')}
                className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                  inspectTab === 'incidents'
                    ? 'border-kali-primary text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                INCIDENTS ({agentIncidents.length})
              </button>
            </div>

            {loadingDetails ? (
              <LoadingSpinner message="AGGREGATING AGENT TELEMETRY DOSSIER..." />
            ) : (
              <>
                {/* TAB 1: OVERVIEW & CREDENTIALS */}
                {inspectTab === 'overview' && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded border border-kali-border bg-kali-bg p-3">
                        <div className="text-[10px] text-slate-400 uppercase">Agent Identity</div>
                        <div className="text-white font-bold text-sm mt-0.5">{inspectAgent.name}</div>
                        <div className="text-slate-500 text-[11px] mt-1">{inspectAgent.description || 'No description provided.'}</div>
                      </div>
                      <div className="rounded border border-kali-border bg-kali-bg p-3">
                        <div className="text-[10px] text-slate-400 uppercase">Enforcement Status</div>
                        <div className="mt-1">
                          <StatusBadge status={inspectAgent.status} />
                        </div>
                        <div className="text-slate-400 text-[10px] mt-1.5">Role: {inspectAgent.role}</div>
                      </div>
                    </div>

                    <div className="rounded border border-kali-border bg-kali-bg p-3 space-y-2">
                      <div className="text-[11px] font-bold text-kali-cyan">// CRYPTOGRAPHIC CREDENTIALS</div>
                      <div className="flex items-center justify-between border-b border-kali-border/60 pb-1.5 text-slate-300">
                        <span>Unique Identifier:</span>
                        <span className="text-white select-all">{inspectAgent.id}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-kali-border/60 pb-1.5 text-slate-300">
                        <span>Credential Hash:</span>
                        <span className="text-kali-secure">SHA-256 HASH VERIFIED (SALTED)</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-kali-border/60 pb-1.5 text-slate-300">
                        <span>Organization Unit:</span>
                        <span className="text-white">{inspectAgent.agent_metadata?.org || 'SOC-PRIMARY'}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Enrolled Timestamp:</span>
                        <span className="text-slate-400">{formatTimestamp(inspectAgent.created_at)}</span>
                      </div>
                    </div>

                    {/* Operational Controls Strip */}
                    <div className="flex items-center justify-end gap-2 border-t border-kali-border pt-3">
                      {inspectAgent.status === 'active' && (
                        <button
                          onClick={() => setSuspendTarget(inspectAgent)}
                          className="rounded border border-kali-warning/50 bg-[#2E200C] px-3 py-1.5 font-mono text-xs font-bold text-kali-warning hover:bg-[#473212] transition-colors"
                        >
                          Suspend Execution
                        </button>
                      )}
                      {inspectAgent.status === 'suspended' && (
                        <button
                          onClick={() => setSuspendTarget(inspectAgent)}
                          className="rounded border border-kali-secure/50 bg-[#0E2E22] px-3 py-1.5 font-mono text-xs font-bold text-kali-secure hover:bg-[#154634] transition-colors"
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
                          className="rounded border border-kali-critical bg-kali-critical px-3 py-1.5 font-mono text-xs font-bold text-white hover:bg-rose-700 transition-colors"
                        >
                          Revoke Identity
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: PERMISSIONS */}
                {inspectTab === 'permissions' && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold">// GRANULAR_PERMISSION_RULES</span>
                      <button
                        onClick={() => setIsGrantPermOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded border border-kali-primary bg-kali-primary/20 px-2.5 py-1 text-[11px] font-bold text-kali-cyan hover:bg-kali-primary/30 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>GRANT PERMISSION</span>
                      </button>
                    </div>

                    {agentPermissions.length === 0 ? (
                      <div className="rounded border border-dashed border-kali-border p-8 text-center text-slate-500">
                        // NO EXPLICIT PERMISSION GRANTS FOUND
                        <p className="mt-1 text-[11px] text-slate-400">Agent operates under strict zero-trust default-deny.</p>
                      </div>
                    ) : (
                      agentPermissions.map((perm) => (
                        <div key={perm.id} className="rounded border border-kali-border bg-kali-bg p-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                perm.effect === 'ALLOW' ? 'bg-[#0E2E22] text-kali-secure border border-[#155E42]' : 'bg-[#331418] text-kali-critical border border-[#7A1F26]'
                              }`}>
                                {perm.effect}
                              </span>
                              <span className="text-white font-bold">{perm.tool_name}:{perm.operation}</span>
                            </div>
                            <div className="mt-1 text-slate-400">Resource: {perm.resource_pattern}</div>
                            {perm.description && <div className="mt-0.5 text-slate-500 italic text-[11px]">{perm.description}</div>}
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <span className="text-slate-400 text-[11px]">PRIORITY: {perm.priority}</span>
                            <button
                              onClick={() => handleRevokePermission(perm.id)}
                              className="text-kali-critical hover:text-rose-400 p-1"
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
                  <div className="space-y-3 font-mono text-xs">
                    {agentDelegations.length === 0 ? (
                      <div className="rounded border border-dashed border-kali-border p-8 text-center text-slate-500">
                        // ZERO DELEGATION CONTRACTS RECORDED FOR THIS AGENT
                      </div>
                    ) : (
                      agentDelegations.map((del) => (
                        <div key={del.id} className="rounded border border-kali-border bg-kali-bg p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-kali-primary font-bold">TOKEN #{truncateId(del.id, 8)}</span>
                            <StatusBadge status={del.status} />
                          </div>
                          <div className="text-slate-300">
                            {del.parent_agent_id === inspectAgent.id ? 'PARENT AGENT (Granter)' : 'CHILD AGENT (Delegatee)'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Scope: {del.scope?.tool_name}:{del.scope?.operation} • Max Depth: {del.max_depth}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 4: ACTIVITY AUDIT */}
                {inspectTab === 'activity' && (
                  <div className="space-y-2 font-mono text-xs">
                    {agentEvents.length === 0 ? (
                      <div className="rounded border border-dashed border-kali-border p-8 text-center text-slate-500">
                        // NO RECENT GATEWAY AUDIT EVENTS RECORDED
                      </div>
                    ) : (
                      agentEvents.map((ev) => (
                        <div key={ev.id} className="rounded border border-kali-border bg-kali-bg p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-white font-bold">{ev.tool_name}:{ev.operation}</div>
                            <div className="text-[11px] text-slate-400">Target: {ev.target_resource}</div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ev.decision === 'ALLOWED' ? 'bg-[#0E2E22] text-kali-secure' : 'bg-[#331418] text-kali-critical'
                            }`}>
                              {ev.decision}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-1">{formatTimestamp(ev.created_at)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 5: INCIDENTS */}
                {inspectTab === 'incidents' && (
                  <div className="space-y-2 font-mono text-xs">
                    {agentIncidents.length === 0 ? (
                      <div className="rounded border border-dashed border-kali-border p-8 text-center text-slate-500">
                        // NO ACTIVE SECURITY INCIDENTS LINKED TO THIS AGENT
                      </div>
                    ) : (
                      agentIncidents.map((inc) => (
                        <div key={inc.id} className="rounded border border-kali-border bg-kali-bg p-2.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <SeverityBadge severity={inc.severity} />
                            <StatusBadge status={inc.status} />
                          </div>
                          <div className="font-bold text-white text-xs">{inc.title}</div>
                          <p className="text-[11px] text-slate-400">{inc.description}</p>
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
        title={`GRANT PERMISSION // ${inspectAgent?.name || ''}`}
        subtitle="Commits granular RBAC authorization grant to AgentTrust PDP"
      >
        <form onSubmit={handleGrantPermissionSubmit} className="space-y-3 font-mono text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Target Tool</label>
            <input
              type="text"
              required
              value={permTool}
              onChange={(e) => setPermTool(e.target.value)}
              placeholder="e.g. filesystem_tool, database_tool, http_tool"
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Target Operation</label>
            <input
              type="text"
              required
              value={permOp}
              onChange={(e) => setPermOp(e.target.value)}
              placeholder="e.g. read_file, write_file, query, *"
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Resource Pattern</label>
            <input
              type="text"
              required
              value={permRes}
              onChange={(e) => setPermRes(e.target.value)}
              placeholder="e.g. reports/*, confidential/*, *"
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Effect</label>
              <select
                value={permEffect}
                onChange={(e) => setPermEffect(e.target.value as any)}
                className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
              >
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
              </select>
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Rule Priority</label>
              <input
                type="number"
                value={permPriority}
                onChange={(e) => setPermPriority(Number(e.target.value))}
                className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Description / Audit Justification</label>
            <input
              type="text"
              value={permDesc}
              onChange={(e) => setPermDesc(e.target.value)}
              placeholder="e.g. Authorized read access to public reporting directory"
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div className="border-t border-kali-border pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsGrantPermOpen(false)}
              className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={grantingPerm}
              className="rounded bg-kali-primary px-4 py-1.5 font-bold text-white shadow-kali-glow hover:bg-kali-secondaryBlue disabled:opacity-50"
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
        title={suspendTarget?.status === 'suspended' ? 'RESUME AGENT EXECUTION' : 'SUSPEND AGENT EXECUTION'}
        subtitle={`AGENT: ${suspendTarget?.name || ''}`}
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="rounded border border-kali-warning/50 bg-[#2E200C] p-3 text-kali-warning flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>
              {suspendTarget?.status === 'suspended'
                ? `Resuming will restore API key execution rights for agent '${suspendTarget?.name}'.`
                : `Suspending will temporarily pause all tool-call invocations for agent '${suspendTarget?.name}' without revoking credentials.`}
            </span>
          </div>

          <div className="flex justify-end gap-2 border-t border-kali-border pt-3">
            <button
              type="button"
              onClick={() => setSuspendTarget(null)}
              className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSuspending}
              onClick={handleSuspendConfirm}
              className={`rounded px-4 py-1.5 font-bold text-white transition-colors disabled:opacity-50 ${
                suspendTarget?.status === 'suspended'
                  ? 'bg-kali-secure hover:bg-emerald-700'
                  : 'bg-kali-warning text-black hover:bg-amber-500'
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
        title="ENROLL NEW AUTONOMOUS AGENT"
        subtitle="Generates cryptographically signed API authorization credentials"
        icon={<Bot className="h-5 w-5" />}
      >
        {!registeredKeyData ? (
          <form onSubmit={handleRegisterSubmit} className="space-y-4 font-mono text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Agent Identifier Name</label>
              <input
                type="text"
                required
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="e.g. Sentry-Threat-Collector"
                className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Assigned Role</label>
                <select
                  value={newAgentRole}
                  onChange={(e) => setNewAgentRole(e.target.value)}
                  className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
                >
                  <option value="general_agent">general_agent</option>
                  <option value="data_collector">data_collector</option>
                  <option value="incident_responder">incident_responder</option>
                  <option value="security_auditor">security_auditor</option>
                  <option value="threat_hunter">threat_hunter</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Organization Unit</label>
                <input
                  type="text"
                  value={newAgentOrg}
                  onChange={(e) => setNewAgentOrg(e.target.value)}
                  placeholder="SOC-PRIMARY"
                  className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Operational Description</label>
              <textarea
                rows={2}
                value={newAgentDesc}
                onChange={(e) => setNewAgentDesc(e.target.value)}
                placeholder="Primary mission and authorized operational boundaries..."
                className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
              />
            </div>

            <div className="border-t border-kali-border pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-kali-primary px-4 py-1.5 font-bold text-white shadow-kali-glow hover:bg-kali-secondaryBlue"
              >
                Generate Credentials
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            <div className="rounded border border-kali-warning/50 bg-[#2E200C] p-3 text-kali-warning flex items-start gap-2">
              <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">CRITICAL SECURITY WARNING:</span> This raw cryptographic API key will NOT be displayed again. Store it securely in your agent secret vault.
              </div>
            </div>

            <div className="rounded border border-kali-border bg-kali-bg p-3 space-y-2">
              <div className="text-slate-400 text-[10px] uppercase font-bold">API Authorization Token</div>
              <div className="flex items-center justify-between gap-2 bg-kali-card p-2 rounded border border-kali-border font-bold text-kali-cyan break-all">
                <span>{registeredKeyData.raw_api_key}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(registeredKeyData.raw_api_key);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="rounded bg-kali-primary/20 px-2.5 py-1 text-kali-primary hover:bg-kali-primary/30 transition-colors shrink-0"
                >
                  {copiedKey ? 'COPIED!' : 'COPY'}
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-kali-border pt-3">
              <button
                onClick={() => {
                  setIsRegisterOpen(false);
                  setRegisteredKeyData(null);
                }}
                className="rounded bg-kali-primary px-4 py-1.5 font-bold text-white"
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
        title="PERMANENT CREDENTIAL REVOCATION"
        subtitle={`AGENT: ${revokeAgentTarget?.name || ''}`}
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="rounded border border-kali-critical/50 bg-[#331418] p-3 text-kali-critical flex items-center gap-2">
            <ShieldX className="h-5 w-5 shrink-0" />
            <span>
              Revoking credentials will permanently block all incoming tool invocations for agent '{revokeAgentTarget?.name}'. This action is non-recoverable.
            </span>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Revocation Reason (Mandatory Audit Evidence)
            </label>
            <textarea
              rows={2}
              required
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Suspected credential exfiltration via prompt injection incident #402"
              className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-kali-border pt-3">
            <button
              type="button"
              onClick={() => setRevokeAgentTarget(null)}
              className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isRevoking || !revokeReason.trim()}
              onClick={handleRevokeConfirm}
              className="rounded bg-kali-critical px-4 py-1.5 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

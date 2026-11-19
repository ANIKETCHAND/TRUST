import React, { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  RefreshCw,
  Copy,
  Check,
  ShieldX,
  ArrowUpDown,
  X,
  Shield,
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
  const [roleFilter, setRoleFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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

  // Agent Slide-over Details Drawer
  const [inspectAgent, setInspectAgent] = useState<Agent | null>(null);
  const [inspectTab, setInspectTab] = useState<'identity' | 'permissions' | 'activity' | 'incidents'>('identity');
  const [agentPermissions, setAgentPermissions] = useState<any[]>([]);
  const [agentEvents, setAgentEvents] = useState<any[]>([]);
  const [agentIncidents, setAgentIncidents] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Grant Permission Sub-Modal state
  const [isGrantPermOpen, setIsGrantPermOpen] = useState(false);
  const [permTool, setPermTool] = useState('filesystem_tool');
  const [permOp, setPermOp] = useState('read_file');
  const [permRes, setPermRes] = useState('reports/*');
  const [permEffect, setPermEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [grantingPerm, setGrantingPerm] = useState(false);

  // Load inspector details when inspectAgent is selected
  useEffect(() => {
    if (!inspectAgent) return;
    const loadDetails = async () => {
      setLoadingDetails(true);
      try {
        const [permsRes, eventsRes, incsRes] = await Promise.allSettled([
          api.listPermissions(inspectAgent.id),
          api.listAuditEvents({ agent_id: inspectAgent.id, limit: 20 }),
          api.listIncidents(),
        ]);

        if (permsRes.status === 'fulfilled' && Array.isArray(permsRes.value)) {
          setAgentPermissions(permsRes.value);
        } else {
          setAgentPermissions([]);
        }

        if (eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value)) {
          setAgentEvents(eventsRes.value);
        } else {
          setAgentEvents([]);
        }

        if (incsRes.status === 'fulfilled' && Array.isArray(incsRes.value)) {
          setAgentIncidents(incsRes.value.filter((i) => i.agent_id === inspectAgent.id));
        } else {
          setAgentIncidents([]);
        }
      } catch (err) {
        console.error('Failed to load agent details:', err);
      } finally {
        setLoadingDetails(false);
      }
    };
    loadDetails();
  }, [inspectAgent]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) {
      toast.warning('Agent Name Required', 'Please provide a valid agent name.');
      return;
    }
    const result = await registerAgent({
      name: newAgentName,
      role: newAgentRole,
      description: newAgentDesc,
      agent_metadata: { org: newAgentOrg },
    });
    if (result) {
      setRegisteredKeyData(result);
      toast.success('Agent Registered', `Agent ${newAgentName} enrolled successfully.`);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeAgentTarget || !revokeReason.trim()) return;
    setIsRevoking(true);
    const success = await revokeAgent(revokeAgentTarget.id, revokeReason);
    if (success) {
      toast.info('Agent Revoked', `Identity and API key revoked for ${revokeAgentTarget.name}.`);
      setRevokeAgentTarget(null);
      setRevokeReason('');
      if (inspectAgent?.id === revokeAgentTarget.id) {
        setInspectAgent((prev) => (prev ? { ...prev, status: 'revoked' } : null));
      }
    }
    setIsRevoking(false);
  };

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectAgent) return;
    setGrantingPerm(true);
    try {
      await api.grantPermission({
        agent_id: inspectAgent.id,
        tool_name: permTool,
        operation: permOp,
        target_resource: permRes,
        effect: permEffect,
      });
      toast.success('Permission Granted', `Rule added for ${permTool}:${permOp}.`);
      setIsGrantPermOpen(false);
      // Refresh permissions
      const updated = await api.listPermissions(inspectAgent.id);
      setAgentPermissions(updated);
    } catch (err: any) {
      toast.error('Grant Failed', err.message || 'Failed to grant permission');
    } finally {
      setGrantingPerm(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter and sort agents
  const filteredAgents = agents
    .filter((agent) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          agent.name.toLowerCase().includes(q) ||
          agent.id.toLowerCase().includes(q) ||
          agent.role.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (roleFilter && agent.role !== roleFilter) return false;
      if (statusFilter && agent.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') comp = a.name.localeCompare(b.name);
      else if (sortBy === 'status') comp = a.status.localeCompare(b.status);
      else comp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === 'asc' ? comp : -comp;
    });

  const uniqueRoles = Array.from(new Set(agents.map((a) => a.role)));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Agent Registry
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Manage identities, access and permissions for AI agents.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => {
              setRegisteredKeyData(null);
              setNewAgentName('');
              setNewAgentDesc('');
              setIsRegisterOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] transition-all shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Register Agent</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search, Role Filter, Status Filter, Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E5EAF1] shadow-2xs">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-72">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, ID, or role..."
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            >
              <option value="">All Roles</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748B]">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="created_at">Date Enrolled</option>
            <option value="name">Agent Name</option>
            <option value="status">Status</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded-lg border border-[#E5EAF1] bg-white text-[#64748B] hover:text-[#1E293B]"
            title={`Sort order: ${sortOrder}`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Agents Table */}
      <div className="rounded-xl border border-[#E5EAF1] bg-white overflow-hidden shadow-2xs">
        {loading && agents.length === 0 ? (
          <LoadingSpinner message="Loading agent identities..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Agent ID</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Permissions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1]">
                {filteredAgents.length > 0 ? (
                  filteredAgents.map((ag) => (
                    <tr
                      key={ag.id}
                      onClick={() => setInspectAgent(ag)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                    >
                      {/* Agent Name + Avatar */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5EAF1] bg-[#EEF4FF] text-[#3B82F6]">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#1E293B] group-hover:text-[#3B82F6] transition-colors">
                              {ag.name}
                            </div>
                            <div className="text-[11px] text-[#64748B] truncate max-w-xs">
                              {ag.description || 'No description'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Agent ID */}
                      <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{truncateId(ag.id, 12)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(ag.id, ag.id);
                            }}
                            className="p-1 rounded text-[#94A3B8] hover:text-[#1E293B]"
                            title="Copy full ID"
                          >
                            {copiedId === ag.id ? (
                              <Check className="h-3 w-3 text-[#16A34A]" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                          {ag.role}
                        </span>
                      </td>

                      {/* Permissions */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#EEF4FF] text-[#3B82F6] border border-[#D4E5FF]">
                          {ag.role === 'admin_agent' ? 'Full Access' : ag.role === 'auditor_agent' ? 'Read-Only' : 'Scoped Policy'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={ag.status} />
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 text-[#64748B] whitespace-nowrap">
                        {formatTimestamp(ag.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setInspectAgent(ag)}
                            className="px-2.5 py-1 text-xs rounded-md border border-[#E5EAF1] bg-white text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#3B82F6]/50 transition-colors"
                          >
                            Inspect
                          </button>
                          {ag.status !== 'revoked' && (
                            <button
                              onClick={() => {
                                setRevokeAgentTarget(ag);
                                setRevokeReason('');
                              }}
                              className="px-2.5 py-1 text-xs rounded-md border border-[#FCD2D2] bg-white text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#64748B]">
                      No agents found matching your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Agent Details Panel */}
      {inspectAgent && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs select-none"
          onClick={() => setInspectAgent(null)}
        >
          <div
            className="w-full max-w-xl h-full bg-white border-l border-[#E5EAF1] shadow-2xl flex flex-col overflow-hidden animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#E5EAF1] p-5 bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5EAF1] bg-[#EEF4FF] text-[#3B82F6]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E293B]">{inspectAgent.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[11px] text-[#64748B]">
                      {truncateId(inspectAgent.id, 14)}
                    </span>
                    <StatusBadge status={inspectAgent.status} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectAgent(null)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#E5EAF1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation Tabs in Drawer */}
            <div className="flex border-b border-[#E5EAF1] bg-white px-5 text-xs font-medium">
              {[
                { id: 'identity', label: 'Identity & Access' },
                { id: 'permissions', label: `Permissions (${agentPermissions.length})` },
                { id: 'activity', label: 'Recent Activity' },
                { id: 'incidents', label: `Incidents (${agentIncidents.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInspectTab(tab.id as any)}
                  className={`py-3 px-3 border-b-2 transition-all ${
                    inspectTab === tab.id
                      ? 'border-[#3B82F6] text-[#3B82F6] font-semibold'
                      : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {loadingDetails ? (
                <LoadingSpinner message="Loading agent records..." />
              ) : inspectTab === 'identity' ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E5EAF1] p-4 bg-[#F8FAFC] space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Role Definition:</span>
                      <span className="font-semibold text-[#1E293B]">{inspectAgent.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Organization Tenant:</span>
                      <span className="font-medium text-[#1E293B]">{inspectAgent.agent_metadata?.org || 'SOC-PRIMARY'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Enrolled Date:</span>
                      <span className="text-[#1E293B]">{formatTimestamp(inspectAgent.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Revocation Status:</span>
                      <span className="font-medium text-[#1E293B]">{inspectAgent.status.toUpperCase()}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-[#1E293B] mb-1.5">Description</h3>
                    <p className="text-[#64748B] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-[#E5EAF1]">
                      {inspectAgent.description || 'No system description specified for this agent identity.'}
                    </p>
                  </div>

                  {inspectAgent.status !== 'revoked' && (
                    <div className="pt-4 border-t border-[#E5EAF1]">
                      <button
                        onClick={() => {
                          setRevokeAgentTarget(inspectAgent);
                          setRevokeReason('');
                        }}
                        className="w-full py-2.5 rounded-lg border border-[#FCD2D2] bg-[#FEF2F2] text-[#DC2626] font-medium hover:bg-[#FDE2E2] transition-colors"
                      >
                        Revoke Identity & Invalidate Token
                      </button>
                    </div>
                  )}
                </div>
              ) : inspectTab === 'permissions' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Granted Tool Guardrails</span>
                    <button
                      onClick={() => setIsGrantPermOpen(true)}
                      className="px-2.5 py-1 rounded-md bg-[#3B82F6] text-white font-medium hover:bg-[#2563EB]"
                    >
                      + Grant Permission
                    </button>
                  </div>

                  <div className="divide-y divide-[#E5EAF1] rounded-xl border border-[#E5EAF1] overflow-hidden">
                    {agentPermissions.length > 0 ? (
                      agentPermissions.map((p) => (
                        <div key={p.id} className="p-3 bg-white flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-[#1E293B]">
                              {p.tool_name} <span className="text-[#64748B]">:{p.operation}</span>
                            </div>
                            <div className="text-[11px] font-mono text-[#64748B] mt-0.5">
                              Resource: {p.target_resource || '*'}
                            </div>
                          </div>
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                              p.effect === 'ALLOW' ? 'bg-[#E8F7EF] text-[#16A34A]' : 'bg-[#FEF2F2] text-[#DC2626]'
                            }`}
                          >
                            {p.effect}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-[#64748B]">
                        No specific permission overrides. Inherits global security policy.
                      </div>
                    )}
                  </div>
                </div>
              ) : inspectTab === 'activity' ? (
                <div className="space-y-3">
                  <span className="text-[#64748B] font-medium">Recent Gateway Interceptions</span>
                  <div className="divide-y divide-[#E5EAF1] rounded-xl border border-[#E5EAF1] overflow-hidden">
                    {agentEvents.length > 0 ? (
                      agentEvents.map((ev) => (
                        <div key={ev.id} className="p-3 bg-white flex items-center justify-between">
                          <div>
                            <div className="font-medium text-[#1E293B]">
                              {ev.tool_name}:{ev.operation}
                            </div>
                            <div className="text-[11px] text-[#64748B] font-mono mt-0.5">
                              {ev.target_resource || '*'}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                ev.decision === 'ALLOWED'
                                  ? 'bg-[#E8F7EF] text-[#16A34A]'
                                  : 'bg-[#FEF2F2] text-[#DC2626]'
                              }`}
                            >
                              {ev.decision}
                            </span>
                            <div className="text-[10px] text-[#94A3B8] mt-1">
                              {formatTimestamp(ev.created_at)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-[#64748B]">
                        No recent activity recorded for this agent.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="text-[#64748B] font-medium">Triggered Security Incidents</span>
                  <div className="divide-y divide-[#E5EAF1] rounded-xl border border-[#E5EAF1] overflow-hidden">
                    {agentIncidents.length > 0 ? (
                      agentIncidents.map((inc) => (
                        <div key={inc.id} className="p-3 bg-white space-y-1">
                          <div className="flex items-center justify-between">
                            <SeverityBadge severity={inc.severity} />
                            <StatusBadge status={inc.status} />
                          </div>
                          <div className="font-semibold text-[#1E293B] mt-1">{inc.title}</div>
                          <div className="text-[11px] text-[#64748B]">{inc.description}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-[#64748B]">
                        No incidents linked to this agent identity. Clean posture.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register Agent Modal / Wizard */}
      {isRegisterOpen && (
        <Modal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          title="Register AI Agent"
          subtitle="Provision a verified cryptographic identity for an autonomous agent"
          icon={<Bot className="h-4 w-4 text-[#3B82F6]" />}
        >
          {registeredKeyData ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#BCE8CD] bg-[#E8F7EF] p-4 text-xs text-[#1E293B] space-y-2">
                <div className="font-semibold text-[#16A34A] flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  <span>Agent Identity Successfully Provisioned</span>
                </div>
                <p className="text-[#64748B]">
                  Save this gateway token securely. It will not be shown again.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1E293B] mb-1">
                  Agent ID
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] p-2.5 font-mono text-xs">
                  <span className="flex-1 truncate">{registeredKeyData.agent.id}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1E293B] mb-1">
                  API Key / Gateway Secret
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] p-2.5 font-mono text-xs text-[#3B82F6]">
                  <span className="flex-1 truncate">{registeredKeyData.raw_api_key}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(registeredKeyData.raw_api_key);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="p-1 rounded text-[#64748B] hover:text-[#1E293B]"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-[#16A34A]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  onClick={() => setIsRegisterOpen(false)}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1E293B] mb-1">
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. DataIngestionAgent-01"
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B] placeholder-[#94A3B8] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1E293B] mb-1">
                  Operational Role
                </label>
                <select
                  value={newAgentRole}
                  onChange={(e) => setNewAgentRole(e.target.value)}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
                >
                  <option value="general_agent">general_agent (Standard Tasks)</option>
                  <option value="data_analyst">data_analyst (Read-Only DB/Analytics)</option>
                  <option value="file_processor">file_processor (Sandbox I/O)</option>
                  <option value="security_auditor">security_auditor (Telemetry & Logs)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1E293B] mb-1">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  value={newAgentDesc}
                  onChange={(e) => setNewAgentDesc(e.target.value)}
                  placeholder="Describe the agent's delegated scope and target tasks..."
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B] placeholder-[#94A3B8] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1E293B] mb-1">
                  Tenant Cluster
                </label>
                <input
                  type="text"
                  value={newAgentOrg}
                  onChange={(e) => setNewAgentOrg(e.target.value)}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="rounded-lg border border-[#E5EAF1] px-4 py-2 text-xs font-medium text-[#64748B] hover:text-[#1E293B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB]"
                >
                  Enrol Identity
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Revocation Confirmation Modal */}
      {revokeAgentTarget && (
        <Modal
          isOpen={!!revokeAgentTarget}
          onClose={() => setRevokeAgentTarget(null)}
          title="Revoke Agent Identity"
          subtitle={`Revoke credentials for ${revokeAgentTarget.name}`}
          icon={<ShieldX className="h-4 w-4 text-[#DC2626]" />}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-[#FCD2D2] bg-[#FEF2F2] p-3.5 text-xs text-[#DC2626]">
              Warning: Revoking an agent immediately invalidates its token at the zero-trust gateway. Any in-flight requests will be denied.
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1E293B] mb-1">
                Revocation Reason *
              </label>
              <textarea
                rows={3}
                required
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="State the security or operational reason for revocation..."
                className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#DC2626] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokeAgentTarget(null)}
                className="rounded-lg border border-[#E5EAF1] px-4 py-2 text-xs font-medium text-[#64748B] hover:text-[#1E293B]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!revokeReason.trim() || isRevoking}
                onClick={handleRevokeConfirm}
                className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Grant Permission Sub-Modal */}
      {isGrantPermOpen && inspectAgent && (
        <Modal
          isOpen={isGrantPermOpen}
          onClose={() => setIsGrantPermOpen(false)}
          title="Grant Agent Permission"
          subtitle={`Assign explicit tool operation boundary for ${inspectAgent.name}`}
          icon={<Shield className="h-4 w-4 text-[#3B82F6]" />}
        >
          <form onSubmit={handleGrantPermission} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1E293B] mb-1">Tool Target</label>
              <select
                value={permTool}
                onChange={(e) => setPermTool(e.target.value)}
                className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B]"
              >
                <option value="filesystem_tool">filesystem_tool</option>
                <option value="database_tool">database_tool</option>
                <option value="http_api_tool">http_api_tool</option>
                <option value="mcp_service">mcp_service</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1E293B] mb-1">Operation</label>
              <input
                type="text"
                required
                value={permOp}
                onChange={(e) => setPermOp(e.target.value)}
                placeholder="e.g. read_file, query, get"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1E293B] mb-1">Resource Scope Pattern</label>
              <input
                type="text"
                required
                value={permRes}
                onChange={(e) => setPermRes(e.target.value)}
                placeholder="e.g. reports/*, clients_table"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1E293B] mb-1">Effect</label>
              <select
                value={permEffect}
                onChange={(e) => setPermEffect(e.target.value as any)}
                className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs text-[#1E293B]"
              >
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsGrantPermOpen(false)}
                className="rounded-lg border border-[#E5EAF1] px-4 py-2 text-xs font-medium text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={grantingPerm}
                className="rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB]"
              >
                {grantingPerm ? 'Granting...' : 'Save Permission'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

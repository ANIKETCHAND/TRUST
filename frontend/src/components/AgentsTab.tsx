import React, { useEffect, useState } from 'react';
import { Bot, Plus, ShieldX, CheckCircle, RefreshCw, Copy, Check, Eye, AlertOctagon } from 'lucide-react';
import { api } from '../api/client';

export const AgentsTab: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Registration Modal state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('general_agent');
  const [newAgentDesc, setNewAgentDesc] = useState('');
  const [registeredKeyData, setRegisteredKeyData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  
  // Revocation state
  const [revokeAgentId, setRevokeAgentId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Agent Permissions inspection modal
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [agentPermissions, setAgentPermissions] = useState<any[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await api.listAgents(statusFilter || undefined);
      setAgents(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [statusFilter]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.registerAgent({
        name: newAgentName,
        role: newAgentRole,
        description: newAgentDesc,
      });
      setRegisteredKeyData(res);
      fetchAgents();
    } catch (err: any) {
      alert(`Registration error: ${err.message}`);
    }
  };

  const handleRevoke = async () => {
    if (!revokeAgentId || !revokeReason) return;
    try {
      await api.revokeAgent(revokeAgentId, revokeReason);
      setRevokeAgentId(null);
      setRevokeReason('');
      fetchAgents();
    } catch (err: any) {
      alert(`Revocation error: ${err.message}`);
    }
  };

  const handleInspectPermissions = async (agent: any) => {
    setSelectedAgent(agent);
    setLoadingPermissions(true);
    try {
      const perms = await api.listPermissions(agent.id);
      setAgentPermissions(perms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bot className="h-7 w-7 text-cyan-400" />
            AI Agent Registry & Credential Management
          </h1>
          <p className="text-sm text-slate-400">
            Provision, inspect, and revoke authenticated identities and API keys for autonomous agents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAgents}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setRegisteredKeyData(null);
              setNewAgentName('');
              setNewAgentDesc('');
              setIsRegisterOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            Register Agent
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by agent name, role, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="revoked">Revoked Only</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Agents Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400">
              <tr>
                <th className="py-3 px-4 font-semibold">Agent Name</th>
                <th className="py-3 px-4 font-semibold">Agent ID</th>
                <th className="py-3 px-4 font-semibold">Assigned Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Created At</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                    <Bot className="h-4 w-4 text-cyan-400" />
                    <div>
                      <div>{agent.name}</div>
                      {agent.description && <div className="text-[11px] text-slate-500">{agent.description}</div>}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">{agent.id}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] border border-slate-700">
                      {agent.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {agent.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-800/60">
                        <CheckCircle className="h-3 w-3" /> ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-800/60">
                        <ShieldX className="h-3 w-3" /> REVOKED
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleInspectPermissions(agent)}
                      className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-200 hover:border-slate-600 hover:bg-slate-700"
                    >
                      <Eye className="inline h-3 w-3 mr-1" />
                      Permissions
                    </button>
                    {agent.status === 'active' && (
                      <button
                        onClick={() => {
                          setRevokeAgentId(agent.id);
                          setRevokeReason('');
                        }}
                        className="rounded border border-rose-900 bg-rose-950/40 px-2.5 py-1 text-[11px] text-rose-300 hover:bg-rose-900/60"
                      >
                        <ShieldX className="inline h-3 w-3 mr-1" />
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredAgents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No agents match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bot className="h-5 w-5 text-cyan-400" />
              Register New Autonomous Agent
            </h2>

            {!registeredKeyData ? (
              <form onSubmit={handleRegister} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Agent Name</label>
                  <input
                    type="text"
                    required
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. Threat-Intel-Collector"
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Role Classification</label>
                  <input
                    type="text"
                    required
                    value={newAgentRole}
                    onChange={(e) => setNewAgentRole(e.target.value)}
                    placeholder="e.g. security_researcher, auditor, compliance_bot"
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <textarea
                    rows={2}
                    value={newAgentDesc}
                    onChange={(e) => setNewAgentDesc(e.target.value)}
                    placeholder="Operational responsibilities and scope"
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
                  >
                    Provision Agent & Generate Key
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-emerald-800/80 bg-emerald-950/40 p-3 text-xs text-emerald-300">
                  Agent '{registeredKeyData.agent.name}' registered successfully.
                </div>
                <div className="rounded-lg border border-amber-800/80 bg-amber-950/40 p-3 text-xs text-amber-300 flex items-start gap-2">
                  <AlertOctagon className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">CRITICAL SECURITY WARNING:</span>
                    <p className="mt-1">{registeredKeyData.warning}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Cryptographic API Key</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={registeredKeyData.raw_api_key}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-cyan-300 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(registeredKeyData.raw_api_key);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => setIsRegisterOpen(false)}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
                  >
                    Done & Saved
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      {revokeAgentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-rose-800 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-rose-400" />
              Revoke Agent Credentials
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Revoking this agent will immediately invalidate all associated API credentials and block subsequent protected operations.
            </p>
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-300">Revocation Reason (Mandatory for audit trail)</label>
              <textarea
                rows={3}
                required
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Compromised secret token, agent decommissioning, abnormal behavior"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setRevokeAgentId(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={!revokeReason.trim()}
                onClick={handleRevoke}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Permissions Drawer / Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Permissions for {selectedAgent.name}</h2>
                <span className="font-mono text-xs text-slate-400">{selectedAgent.id}</span>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3">
              {loadingPermissions ? (
                <div className="py-8 text-center text-xs text-cyan-400">Loading grants...</div>
              ) : agentPermissions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No explicit permissions assigned. Agent operates under Deny-by-default.
                </div>
              ) : (
                agentPermissions.map((perm) => (
                  <div key={perm.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${perm.effect === 'ALLOW' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                          {perm.effect}
                        </span>
                        <span className="font-mono font-semibold text-white">{perm.tool_name}:{perm.operation}</span>
                      </div>
                      <div className="mt-1 text-slate-400 font-mono">Resource: {perm.resource_pattern}</div>
                      {perm.description && <div className="mt-1 text-slate-500 italic">{perm.description}</div>}
                    </div>
                    <div className="text-right text-slate-500 font-mono text-[11px]">
                      Priority: {perm.priority}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedAgent(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

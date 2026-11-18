import React, { useState, useEffect } from 'react';
import {
  Skull,
  Terminal,
  RefreshCw,
  Plus,
  AlertTriangle,
  Lock,
  Archive,
  Activity,
  Cpu,
  CheckCircle,
} from 'lucide-react';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';
import { Modal } from '../ui/Modal';
import { api } from '../../services/api.client';

interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  cpu_percent: number;
  memory_mb: number;
  started_at: string;
  cmdline: string;
  status: string;
}

interface SinkholeRecord {
  ip: string;
  reason: string;
  created_at: string;
  expires_at: string;
  duration_seconds: number;
  blocked_hits: number;
  firewall_rule_applied: boolean;
  os_rule_name: string;
}

interface QuarantineRecord {
  quarantine_id: string;
  original_path: string;
  original_filename: string;
  threat_name: string;
  size_bytes: number;
  quarantined_at: string;
  quarantined_by: string;
  is_restored: boolean;
  is_purged?: boolean;
  hashes: { sha256: string; md5: string };
}

interface CountermeasureEvent {
  action_id: string;
  timestamp: string;
  countermeasure: string;
  target_pid?: number;
  target_ip?: string;
  reason: string;
  success: boolean;
  process_name?: string;
}

export const ActiveDefenseTab: React.FC = () => {
  const { refreshTrigger } = useSecurityPlatform();
  const { showToast } = useToast();

  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [sinkholes, setSinkholes] = useState<SinkholeRecord[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantineRecord[]>([]);
  const [history, setHistory] = useState<CountermeasureEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Forms
  const [selectedPidToKill, setSelectedPidToKill] = useState<number | null>(null);
  const [killReason, setKillReason] = useState('Active Defense Operator Intervention');
  const [isKillModalOpen, setIsKillModalOpen] = useState(false);

  const [isSinkholeModalOpen, setIsSinkholeModalOpen] = useState(false);
  const [sinkholeIpInput, setSinkholeIpInput] = useState('');
  const [sinkholeReasonInput, setSinkholeReasonInput] = useState('Perimeter ingress containment');

  const [activeSubTab, setActiveSubTab] = useState<'processes' | 'sinkholes' | 'quarantine' | 'history'>('processes');

  const loadData = async () => {
    try {
      setLoading(true);
      const [procs, sHoles, qFiles, hist] = await Promise.all([
        api.listActiveDefenseProcesses().catch(() => []),
        api.listSinkholes().catch(() => []),
        api.getActiveDefenseQuarantine().catch(() => []),
        api.getCountermeasuresHistory().catch(() => []),
      ]);

      setProcesses(procs);
      setSinkholes(sHoles);
      setQuarantine(qFiles);
      setHistory(hist);
    } catch (err: any) {
      console.error('Failed to load active defense data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleExecuteKill = async () => {
    if (!selectedPidToKill) return;
    try {
      await api.killProcess({
        pid: selectedPidToKill,
        reason: killReason,
        force: true,
      });
      showToast('success', 'Process Terminated', `PID ${selectedPidToKill} forcefully neutralized.`);
      setIsKillModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('error', 'Termination Failed', err.message);
    }
  };

  const handleCreateSinkhole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sinkholeIpInput.trim()) return;
    try {
      await api.createSinkhole({
        ip: sinkholeIpInput.trim(),
        reason: sinkholeReasonInput,
        duration_seconds: 7200,
      });
      showToast('success', 'Sinkhole Created', `IP ${sinkholeIpInput} blocked at OS firewall.`);
      setIsSinkholeModalOpen(false);
      setSinkholeIpInput('');
      loadData();
    } catch (err: any) {
      showToast('error', 'Sinkhole Failed', err.message);
    }
  };

  const handleReleaseSinkhole = async (ip: string) => {
    try {
      await api.releaseSinkhole(ip);
      showToast('info', 'Sinkhole Removed', `Perimeter filter released for IP ${ip}.`);
      loadData();
    } catch (err: any) {
      showToast('error', 'Release Failed', err.message);
    }
  };

  const handleRestoreQuarantine = async (id: string) => {
    try {
      await api.restoreActiveDefenseQuarantine(id);
      showToast('success', 'File Restored', `File ${id} restored to its original path.`);
      loadData();
    } catch (err: any) {
      showToast('error', 'Restore Failed', err.message);
    }
  };

  const handlePurgeQuarantine = async (id: string) => {
    try {
      await api.purgeActiveDefenseQuarantine(id);
      showToast('info', 'File Purged', `Quarantine entry ${id} permanently wiped.`);
      loadData();
    } catch (err: any) {
      showToast('error', 'Purge Failed', err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Skull className="h-6 w-6 text-rose-400" />
            Active Defense & Containment
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time process inspection, network sinkholing, and automated file quarantine.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsSinkholeModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Sinkhole</span>
          </button>

          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Monitored Processes"
          value={processes.length}
          icon={<Cpu className="h-4 w-4 text-kali-cyan" />}
        />
        <StatCard
          label="Active IP Sinkholes"
          value={sinkholes.length}
          icon={<Lock className="h-4 w-4 text-rose-400" />}
          subValue="Active"
          subValueColor="text-rose-400"
        />
        <StatCard
          label="Quarantined Files"
          value={quarantine.filter((q) => !q.is_restored && !q.is_purged).length}
          icon={<Archive className="h-4 w-4 text-amber-400" />}
        />
        <StatCard
          label="Countermeasures"
          value={history.length}
          icon={<Activity className="h-4 w-4 text-emerald-400" />}
        />
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex border-b border-white/10 gap-2 text-xs">
        <button
          onClick={() => setActiveSubTab('processes')}
          className={`px-4 py-2.5 border-b-2 font-medium transition-all ${
            activeSubTab === 'processes'
              ? 'border-kali-cyan text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Processes ({processes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('sinkholes')}
          className={`px-4 py-2.5 border-b-2 font-medium transition-all ${
            activeSubTab === 'sinkholes'
              ? 'border-kali-cyan text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Firewall Sinkholes ({sinkholes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('quarantine')}
          className={`px-4 py-2.5 border-b-2 font-medium transition-all ${
            activeSubTab === 'quarantine'
              ? 'border-kali-cyan text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Quarantine Vault ({quarantine.length})
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2.5 border-b-2 font-medium transition-all ${
            activeSubTab === 'history'
              ? 'border-kali-cyan text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Audit Ledger ({history.length})
        </button>
      </div>

      {/* Tab 1: Running Process Monitor & 1-Click Kill Switch */}
      {activeSubTab === 'processes' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 space-y-4 backdrop-blur-md">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-kali-cyan" />
              Running Agent Processes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live execution telemetry. Terminate suspicious or rogue processes immediately.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4 font-medium">PID</th>
                  <th className="py-3 px-4 font-medium">Process Name</th>
                  <th className="py-3 px-4 font-medium">User</th>
                  <th className="py-3 px-4 font-medium">CPU %</th>
                  <th className="py-3 px-4 font-medium">Memory</th>
                  <th className="py-3 px-4 font-medium">Command Line</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {processes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No active agent processes detected.
                    </td>
                  </tr>
                ) : (
                  processes.map((proc) => (
                    <tr key={proc.pid} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4 font-mono font-medium text-kali-cyan">{proc.pid}</td>
                      <td className="py-3 px-4 text-white font-medium">{proc.name}</td>
                      <td className="py-3 px-4 text-slate-400">{proc.user}</td>
                      <td className="py-3 px-4 text-slate-200">{proc.cpu_percent}%</td>
                      <td className="py-3 px-4 text-slate-200">{proc.memory_mb} MB</td>
                      <td className="py-3 px-4 text-slate-400 font-mono max-w-[280px] truncate" title={proc.cmdline}>
                        {proc.cmdline || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedPidToKill(proc.pid);
                            setIsKillModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white px-3 py-1 text-xs font-semibold transition-all"
                        >
                          <Skull className="h-3.5 w-3.5" />
                          <span>Kill</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: OS Firewall Sinkholes */}
      {activeSubTab === 'sinkholes' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 space-y-4 backdrop-blur-md">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-400" />
              Dynamic Firewall Sinkholes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Traffic from these IP addresses is dropped at the firewall layer.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4 font-medium">Blocked IP</th>
                  <th className="py-3 px-4 font-medium">Reason</th>
                  <th className="py-3 px-4 font-medium">Created</th>
                  <th className="py-3 px-4 font-medium">Expires</th>
                  <th className="py-3 px-4 font-medium">Blocked Hits</th>
                  <th className="py-3 px-4 font-medium">Scope</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {sinkholes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No active IP sinkholes.
                    </td>
                  </tr>
                ) : (
                  sinkholes.map((s) => (
                    <tr key={s.ip} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4 font-mono font-medium text-rose-400">{s.ip}</td>
                      <td className="py-3 px-4 text-slate-200">{s.reason}</td>
                      <td className="py-3 px-4 text-slate-400">{s.created_at.slice(0, 19)}</td>
                      <td className="py-3 px-4 text-slate-400">{s.expires_at.slice(0, 19)}</td>
                      <td className="py-3 px-4 font-mono text-amber-400 font-semibold">{s.blocked_hits}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            s.firewall_rule_applied
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {s.firewall_rule_applied ? 'Firewall Applied' : 'Gateway Only'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleReleaseSinkhole(s.ip)}
                          className="rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 px-3 py-1 text-xs font-medium transition-all"
                        >
                          Release
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Quarantine Vault */}
      {activeSubTab === 'quarantine' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 space-y-4 backdrop-blur-md">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Archive className="h-4 w-4 text-amber-400" />
              Quarantine Vault
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Isolated storage for malicious files and suspicious agent payloads.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4 font-medium">Quarantine ID</th>
                  <th className="py-3 px-4 font-medium">Filename</th>
                  <th className="py-3 px-4 font-medium">Threat Name</th>
                  <th className="py-3 px-4 font-medium">SHA-256 Hash</th>
                  <th className="py-3 px-4 font-medium">Quarantined At</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {quarantine.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Quarantine vault is empty.
                    </td>
                  </tr>
                ) : (
                  quarantine.map((q) => (
                    <tr key={q.quarantine_id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4 font-mono text-kali-cyan">{q.quarantine_id}</td>
                      <td className="py-3 px-4 text-white font-medium">{q.original_filename}</td>
                      <td className="py-3 px-4 text-rose-400">{q.threat_name}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono max-w-[160px] truncate" title={q.hashes?.sha256}>
                        {q.hashes?.sha256 || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{q.quarantined_at.slice(0, 19)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            q.is_purged
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : q.is_restored
                              ? 'bg-white/5 text-slate-400 border border-white/10'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {q.is_purged ? 'Purged' : q.is_restored ? 'Restored' : 'Isolated'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {!q.is_restored && !q.is_purged && (
                          <>
                            <button
                              onClick={() => handleRestoreQuarantine(q.quarantine_id)}
                              className="rounded-lg border border-kali-cyan/30 bg-kali-cyan/10 text-kali-cyan hover:bg-kali-cyan hover:text-white px-3 py-1 text-xs font-medium transition-all"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handlePurgeQuarantine(q.quarantine_id)}
                              className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-3 py-1 text-xs font-medium transition-all"
                            >
                              Purge
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Countermeasures History Log */}
      {activeSubTab === 'history' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 space-y-4 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-kali-cyan" />
            Countermeasure Audit Ledger
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Countermeasure</th>
                  <th className="py-3 px-4 font-medium">Target</th>
                  <th className="py-3 px-4 font-medium">Reason</th>
                  <th className="py-3 px-4 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No active defense actions logged yet.
                    </td>
                  </tr>
                ) : (
                  history.map((h, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4 text-slate-400">{h.timestamp.slice(0, 19)}</td>
                      <td className="py-3 px-4 font-medium text-rose-400">{h.countermeasure}</td>
                      <td className="py-3 px-4 text-white">
                        {h.target_pid ? `PID ${h.target_pid} (${h.process_name || 'proc'})` : h.target_ip || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{h.reason}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            h.success
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {h.success ? (
                            <>
                              <CheckCircle className="h-3 w-3" /> Neutralized
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3" /> Failed
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kill Process Modal */}
      <Modal
        isOpen={isKillModalOpen}
        onClose={() => setIsKillModalOpen(false)}
        title="Confirm Process Termination"
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3 text-rose-400">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-white">Terminate Process PID {selectedPidToKill}</div>
              <p className="mt-1 text-slate-300 text-xs">
                This will immediately kill the process and all child subprocesses.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Reason for Termination:</label>
            <input
              type="text"
              value={killReason}
              onChange={(e) => setKillReason(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-white text-xs focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              onClick={() => setIsKillModalOpen(false)}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteKill}
              className="flex items-center gap-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold px-4 py-2 text-xs transition-all"
            >
              <Skull className="h-3.5 w-3.5" />
              <span>Terminate Process</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Sinkhole Modal */}
      <Modal
        isOpen={isSinkholeModalOpen}
        onClose={() => setIsSinkholeModalOpen(false)}
        title="Create IP Sinkhole"
      >
        <form onSubmit={handleCreateSinkhole} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">IP Address to Block:</label>
            <input
              type="text"
              value={sinkholeIpInput}
              onChange={(e) => setSinkholeIpInput(e.target.value)}
              placeholder="e.g. 198.51.100.1"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-white text-xs focus:outline-none focus:border-kali-cyan font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Justification:</label>
            <input
              type="text"
              value={sinkholeReasonInput}
              onChange={(e) => setSinkholeReasonInput(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-white text-xs focus:outline-none focus:border-kali-cyan"
              required
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsSinkholeModalOpen(false)}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold px-4 py-2 text-xs transition-all"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Block IP</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

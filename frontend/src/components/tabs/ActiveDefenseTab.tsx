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

      showToast('success', 'Process Neutralized', `Process PID ${selectedPidToKill} and all spawned subprocesses were successfully killed.`);
      setIsKillModalOpen(false);
      setSelectedPidToKill(null);
      loadData();
    } catch (err: any) {
      showToast('error', 'Kill Switch Failed', err.message);
    }
  };

  const handleCreateSinkhole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sinkholeIpInput.trim()) return;

    try {
      await api.createSinkhole({
        ip: sinkholeIpInput.trim(),
        reason: sinkholeReasonInput,
        duration_seconds: 86400,
      });

      showToast('success', 'Sinkhole Enforced', `Dynamic null-route established for ${sinkholeIpInput}.`);
      setIsSinkholeModalOpen(false);
      setSinkholeIpInput('');
      loadData();
    } catch (err: any) {
      showToast('error', 'Error Establishing Sinkhole', err.message);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Skull className="h-6 w-6 text-red-500" />
            Active Defense, Kill Switch & Malware Containment Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            CrowdStrike AIDR & Palo Alto-grade autonomous OS process termination, perimeter firewall null-routing, and YARA quarantine vault.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSinkholeModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 px-3 py-1.5 text-xs font-semibold shadow transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New IP Sinkhole
          </button>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Monitored Processes"
          value={processes.length}
          icon={<Cpu className="h-5 w-5 text-cyan-400" />}
        />
        <StatCard
          label="Active IP Sinkholes"
          value={sinkholes.length}
          icon={<Lock className="h-5 w-5 text-red-400" />}
          subValue="Perimeter Active"
        />
        <StatCard
          label="Quarantined Files"
          value={quarantine.filter((q) => !q.is_restored && !q.is_purged).length}
          icon={<Archive className="h-5 w-5 text-amber-400" />}
        />
        <StatCard
          label="Countermeasures Executed"
          value={history.length}
          icon={<Activity className="h-5 w-5 text-emerald-400" />}
        />
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('processes')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeSubTab === 'processes' ? 'border-red-500 text-red-400 font-bold' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          AI Agent Processes ({processes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('sinkholes')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeSubTab === 'sinkholes' ? 'border-red-500 text-red-400 font-bold' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          OS Firewall Sinkholes ({sinkholes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('quarantine')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeSubTab === 'quarantine' ? 'border-red-500 text-red-400 font-bold' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          YARA Quarantine Vault ({quarantine.length})
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeSubTab === 'history' ? 'border-red-500 text-red-400 font-bold' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Countermeasures Log ({history.length})
        </button>
      </div>

      {/* Tab 1: Running Process Monitor & 1-Click Kill Switch */}
      {activeSubTab === 'processes' && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                Live Enrolled AI Agent OS Processes & Subprocess Trees
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time execution telemetry. In case of hijacking or virus payload execution, activate the instant kill switch.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">PID</th>
                  <th className="py-2 px-3">Process Name</th>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">CPU %</th>
                  <th className="py-2 px-3">Memory (MB)</th>
                  <th className="py-2 px-3">Command Line</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {processes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No active AI runner processes detected on this endpoint.
                    </td>
                  </tr>
                ) : (
                  processes.map((proc) => (
                    <tr key={proc.pid} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-bold text-cyan-400">{proc.pid}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">{proc.name}</td>
                      <td className="py-2.5 px-3 text-slate-400">{proc.user}</td>
                      <td className="py-2.5 px-3 text-slate-300">{proc.cpu_percent}%</td>
                      <td className="py-2.5 px-3 text-slate-300">{proc.memory_mb} MB</td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[280px] truncate" title={proc.cmdline}>
                        {proc.cmdline || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedPidToKill(proc.pid);
                            setIsKillModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 ml-auto rounded bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 text-[11px] font-bold shadow-md shadow-red-950/40 transition-colors"
                        >
                          <Skull className="h-3 w-3" />
                          Kill Process
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-red-400" />
                Dynamic OS Firewall Sinkholes & IP Null-Routes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingress traffic from these IP addresses is actively severed at both the gateway layer and host firewall.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Blocked IP</th>
                  <th className="py-2 px-3">Reason</th>
                  <th className="py-2 px-3">Established At</th>
                  <th className="py-2 px-3">Expires At</th>
                  <th className="py-2 px-3">Blocked Hits</th>
                  <th className="py-2 px-3">OS Rule</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sinkholes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No active IP sinkholes. All clean perimeters.
                    </td>
                  </tr>
                ) : (
                  sinkholes.map((s) => (
                    <tr key={s.ip} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-bold text-red-400">{s.ip}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans">{s.reason}</td>
                      <td className="py-2.5 px-3 text-slate-400">{s.created_at.slice(0, 19)}</td>
                      <td className="py-2.5 px-3 text-slate-400">{s.expires_at.slice(0, 19)}</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">{s.blocked_hits}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.firewall_rule_applied
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {s.firewall_rule_applied ? 'FIREWALL APPLIED' : 'GATEWAY ONLY'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleReleaseSinkhole(s.ip)}
                          className="rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 px-2 py-1 text-[11px] transition-colors"
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Archive className="h-4 w-4 text-amber-400" />
                Isolated Quarantine Storage Vault (SHA-256 Fingerprinted)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Malicious agent files, reverse shells, and web shells held in non-executable isolation.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Quarantine ID</th>
                  <th className="py-2 px-3">Original Filename</th>
                  <th className="py-2 px-3">Threat Signature</th>
                  <th className="py-2 px-3">SHA-256 Fingerprint</th>
                  <th className="py-2 px-3">Quarantined At</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {quarantine.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Quarantine vault is empty. No infected files detected.
                    </td>
                  </tr>
                ) : (
                  quarantine.map((q) => (
                    <tr key={q.quarantine_id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-bold text-cyan-300">{q.quarantine_id}</td>
                      <td className="py-2.5 px-3 text-slate-200">{q.original_filename}</td>
                      <td className="py-2.5 px-3 text-red-400 font-semibold">{q.threat_name}</td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[160px] truncate" title={q.hashes?.sha256}>
                        {q.hashes?.sha256 || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{q.quarantined_at.slice(0, 19)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.is_purged
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : q.is_restored
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {q.is_purged ? 'PURGED' : q.is_restored ? 'RESTORED' : 'ISOLATED'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        {!q.is_restored && !q.is_purged && (
                          <>
                            <button
                              onClick={() => handleRestoreQuarantine(q.quarantine_id)}
                              className="rounded border border-cyan-800 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/60 px-2 py-1 text-[11px] transition-colors"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handlePurgeQuarantine(q.quarantine_id)}
                              className="rounded border border-red-900 bg-red-950/60 text-red-300 hover:bg-red-900/60 px-2 py-1 text-[11px] transition-colors"
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            Autonomous Countermeasure Audit Ledger
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Countermeasure</th>
                  <th className="py-2 px-3">Target</th>
                  <th className="py-2 px-3">Reason</th>
                  <th className="py-2 px-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No active defense actions logged yet.
                    </td>
                  </tr>
                ) : (
                  history.map((h, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 text-slate-400">{h.timestamp.slice(0, 19)}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-red-400">{h.countermeasure}</span>
                      </td>
                      <td className="py-2.5 px-3 text-white">
                        {h.target_pid ? `PID ${h.target_pid} (${h.process_name || 'proc'})` : h.target_ip || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans">{h.reason}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            h.success
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {h.success ? 'NEUTRALIZED' : 'FAILED'}
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
        title="Confirm Instant Malicious Process Neutralization"
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-lg bg-red-950/40 border border-red-800/80 p-3.5 flex items-start gap-3 text-red-200">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-red-300">Force Process Termination (PID {selectedPidToKill})</div>
              <p className="mt-1 text-slate-300">
                Active Defense will forcefully terminate PID {selectedPidToKill} and all recursively spawned child subprocesses (e.g., cmd.exe, powershell).
              </p>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Reason for Neutralization:</label>
            <input
              type="text"
              value={killReason}
              onChange={(e) => setKillReason(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => setIsKillModalOpen(false)}
              className="rounded px-3 py-1.5 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteKill}
              className="flex items-center gap-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 text-xs shadow-lg shadow-red-900/40 transition-colors"
            >
              <Skull className="h-3.5 w-3.5" />
              Engage Kill Switch
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Sinkhole Modal */}
      <Modal
        isOpen={isSinkholeModalOpen}
        onClose={() => setIsSinkholeModalOpen(false)}
        title="Establish Dynamic Perimeter IP Sinkhole"
      >
        <form onSubmit={handleCreateSinkhole} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Offending IP Address:</label>
            <input
              type="text"
              value={sinkholeIpInput}
              onChange={(e) => setSinkholeIpInput(e.target.value)}
              placeholder="e.g. 198.51.100.1 or 45.33.32.156"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Containment Justification:</label>
            <input
              type="text"
              value={sinkholeReasonInput}
              onChange={(e) => setSinkholeReasonInput(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsSinkholeModalOpen(false)}
              className="rounded px-3 py-1.5 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 text-xs shadow-lg shadow-red-900/40 transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
              Apply OS Firewall Drop
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

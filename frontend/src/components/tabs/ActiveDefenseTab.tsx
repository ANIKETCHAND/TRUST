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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-kali-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-kali-critical font-bold tracking-wider">[ACTIVE_DEFENSE]</span>
            <span className="text-xs text-kali-muted">AIDR & CONTAINMENT SUBSYSTEM</span>
          </div>
          <h1 className="text-xl font-bold text-kali-text flex items-center gap-2 mt-1">
            <Skull className="h-5 w-5 text-kali-critical" />
            Active Defense, Kill Switch & Malware Containment
          </h1>
          <p className="text-xs text-kali-muted mt-0.5">
            CrowdStrike AIDR & Palo Alto-grade autonomous OS process termination, perimeter firewall null-routing, and YARA quarantine vault.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSinkholeModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-kali-critical hover:bg-kali-critical/90 text-white px-3 py-1.5 text-xs font-mono font-semibold shadow-lg shadow-kali-critical/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            NEW_SINKHOLE
          </button>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-lg border border-kali-border bg-kali-card px-3 py-1.5 text-xs font-mono text-kali-text hover:bg-kali-elevated hover:border-kali-primary transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            SYNC
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
          icon={<Lock className="h-4 w-4 text-kali-critical" />}
          subValue="Perimeter Active"
        />
        <StatCard
          label="Quarantined Files"
          value={quarantine.filter((q) => !q.is_restored && !q.is_purged).length}
          icon={<Archive className="h-4 w-4 text-kali-warning" />}
        />
        <StatCard
          label="Countermeasures Executed"
          value={history.length}
          icon={<Activity className="h-4 w-4 text-kali-secure" />}
        />
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex border-b border-kali-border gap-2 text-xs font-mono">
        <button
          onClick={() => setActiveSubTab('processes')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors ${
            activeSubTab === 'processes'
              ? 'border-kali-primary text-kali-primary'
              : 'border-transparent text-kali-muted hover:text-kali-text'
          }`}
        >
          [AGENT_PROCESSES ({processes.length})]
        </button>
        <button
          onClick={() => setActiveSubTab('sinkholes')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors ${
            activeSubTab === 'sinkholes'
              ? 'border-kali-primary text-kali-primary'
              : 'border-transparent text-kali-muted hover:text-kali-text'
          }`}
        >
          [FIREWALL_SINKHOLES ({sinkholes.length})]
        </button>
        <button
          onClick={() => setActiveSubTab('quarantine')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors ${
            activeSubTab === 'quarantine'
              ? 'border-kali-primary text-kali-primary'
              : 'border-transparent text-kali-muted hover:text-kali-text'
          }`}
        >
          [QUARANTINE_VAULT ({quarantine.length})]
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors ${
            activeSubTab === 'history'
              ? 'border-kali-primary text-kali-primary'
              : 'border-transparent text-kali-muted hover:text-kali-text'
          }`}
        >
          [COUNTERMEASURES_LOG ({history.length})]
        </button>
      </div>

      {/* Tab 1: Running Process Monitor & 1-Click Kill Switch */}
      {activeSubTab === 'processes' && (
        <div className="rounded-xl border border-kali-border bg-kali-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold text-kali-text uppercase tracking-wider flex items-center gap-2">
                <Terminal className="h-4 w-4 text-kali-cyan" />
                Live Enrolled AI Agent OS Processes & Subprocess Trees
              </h2>
              <p className="text-xs text-kali-muted mt-0.5">
                Real-time execution telemetry. In case of hijacking or rogue payload execution, activate the instant kill switch.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-kali-border text-kali-muted">
                  <th className="py-2.5 px-3">PID</th>
                  <th className="py-2.5 px-3">PROCESS NAME</th>
                  <th className="py-2.5 px-3">USER</th>
                  <th className="py-2.5 px-3">CPU %</th>
                  <th className="py-2.5 px-3">MEMORY (MB)</th>
                  <th className="py-2.5 px-3">COMMAND LINE</th>
                  <th className="py-2.5 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border/60">
                {processes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-kali-muted">
                      No active AI runner processes detected on this host.
                    </td>
                  </tr>
                ) : (
                  processes.map((proc) => (
                    <tr key={proc.pid} className="hover:bg-kali-elevated/40">
                      <td className="py-2.5 px-3 font-bold text-kali-cyan">{proc.pid}</td>
                      <td className="py-2.5 px-3 text-kali-text font-semibold">{proc.name}</td>
                      <td className="py-2.5 px-3 text-kali-muted">{proc.user}</td>
                      <td className="py-2.5 px-3 text-kali-text">{proc.cpu_percent}%</td>
                      <td className="py-2.5 px-3 text-kali-text">{proc.memory_mb} MB</td>
                      <td className="py-2.5 px-3 text-kali-muted max-w-[280px] truncate" title={proc.cmdline}>
                        {proc.cmdline || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedPidToKill(proc.pid);
                            setIsKillModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded bg-kali-critical hover:bg-kali-critical/90 text-white px-2.5 py-1 text-[11px] font-bold shadow transition-colors"
                        >
                          <Skull className="h-3 w-3" />
                          KILL
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
        <div className="rounded-xl border border-kali-border bg-kali-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold text-kali-text uppercase tracking-wider flex items-center gap-2">
                <Lock className="h-4 w-4 text-kali-critical" />
                Dynamic OS Firewall Sinkholes & IP Null-Routes
              </h2>
              <p className="text-xs text-kali-muted mt-0.5">
                Ingress traffic from these IP addresses is actively severed at both the gateway layer and host firewall.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-kali-border text-kali-muted">
                  <th className="py-2.5 px-3">BLOCKED IP</th>
                  <th className="py-2.5 px-3">REASON</th>
                  <th className="py-2.5 px-3">ESTABLISHED AT</th>
                  <th className="py-2.5 px-3">EXPIRES AT</th>
                  <th className="py-2.5 px-3">BLOCKED HITS</th>
                  <th className="py-2.5 px-3">OS RULE</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border/60">
                {sinkholes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-kali-muted">
                      No active IP sinkholes. All clean perimeters.
                    </td>
                  </tr>
                ) : (
                  sinkholes.map((s) => (
                    <tr key={s.ip} className="hover:bg-kali-elevated/40">
                      <td className="py-2.5 px-3 font-bold text-kali-critical">{s.ip}</td>
                      <td className="py-2.5 px-3 text-kali-text font-sans">{s.reason}</td>
                      <td className="py-2.5 px-3 text-kali-muted">{s.created_at.slice(0, 19)}</td>
                      <td className="py-2.5 px-3 text-kali-muted">{s.expires_at.slice(0, 19)}</td>
                      <td className="py-2.5 px-3 text-kali-warning font-bold">{s.blocked_hits}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.firewall_rule_applied
                              ? 'bg-kali-secure/15 text-kali-secure border border-kali-secure/40'
                              : 'bg-kali-warning/15 text-kali-warning border border-kali-warning/40'
                          }`}
                        >
                          {s.firewall_rule_applied ? 'FIREWALL APPLIED' : 'GATEWAY ONLY'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleReleaseSinkhole(s.ip)}
                          className="rounded border border-kali-border bg-kali-bg hover:bg-kali-elevated text-kali-text px-2.5 py-1 text-[11px] font-mono transition-colors"
                        >
                          RELEASE
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
        <div className="rounded-xl border border-kali-border bg-kali-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold text-kali-text uppercase tracking-wider flex items-center gap-2">
                <Archive className="h-4 w-4 text-kali-warning" />
                Isolated Quarantine Storage Vault (SHA-256 Fingerprinted)
              </h2>
              <p className="text-xs text-kali-muted mt-0.5">
                Malicious agent files, reverse shells, and script payloads held in non-executable isolation.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-kali-border text-kali-muted">
                  <th className="py-2.5 px-3">QUARANTINE ID</th>
                  <th className="py-2.5 px-3">ORIGINAL FILENAME</th>
                  <th className="py-2.5 px-3">THREAT SIGNATURE</th>
                  <th className="py-2.5 px-3">SHA-256 FINGERPRINT</th>
                  <th className="py-2.5 px-3">QUARANTINED AT</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border/60">
                {quarantine.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-kali-muted">
                      Quarantine vault is empty. No infected files detected.
                    </td>
                  </tr>
                ) : (
                  quarantine.map((q) => (
                    <tr key={q.quarantine_id} className="hover:bg-kali-elevated/40">
                      <td className="py-2.5 px-3 font-bold text-kali-cyan">{q.quarantine_id}</td>
                      <td className="py-2.5 px-3 text-kali-text">{q.original_filename}</td>
                      <td className="py-2.5 px-3 text-kali-critical font-semibold">{q.threat_name}</td>
                      <td className="py-2.5 px-3 text-kali-muted max-w-[160px] truncate" title={q.hashes?.sha256}>
                        {q.hashes?.sha256 || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-kali-muted">{q.quarantined_at.slice(0, 19)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.is_purged
                              ? 'bg-kali-critical/15 text-kali-critical border border-kali-critical/40'
                              : q.is_restored
                              ? 'bg-kali-bg text-kali-muted border border-kali-border'
                              : 'bg-kali-warning/15 text-kali-warning border border-kali-warning/40'
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
                              className="rounded border border-kali-primary/40 bg-kali-primary/15 text-kali-primary hover:bg-kali-primary hover:text-white px-2 py-1 text-[11px] font-mono transition-colors"
                            >
                              RESTORE
                            </button>
                            <button
                              onClick={() => handlePurgeQuarantine(q.quarantine_id)}
                              className="rounded border border-kali-critical/40 bg-kali-critical/15 text-kali-critical hover:bg-kali-critical hover:text-white px-2 py-1 text-[11px] font-mono transition-colors"
                            >
                              PURGE
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
        <div className="rounded-xl border border-kali-border bg-kali-card p-5 space-y-4">
          <h2 className="text-xs font-mono font-bold text-kali-text uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4 text-kali-cyan" />
            Autonomous Countermeasure Audit Ledger
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-kali-border text-kali-muted">
                  <th className="py-2.5 px-3">TIMESTAMP</th>
                  <th className="py-2.5 px-3">COUNTERMEASURE</th>
                  <th className="py-2.5 px-3">TARGET</th>
                  <th className="py-2.5 px-3">REASON</th>
                  <th className="py-2.5 px-3">OUTCOME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border/60">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-kali-muted">
                      No active defense actions logged yet.
                    </td>
                  </tr>
                ) : (
                  history.map((h, idx) => (
                    <tr key={idx} className="hover:bg-kali-elevated/40">
                      <td className="py-2.5 px-3 text-kali-muted">{h.timestamp.slice(0, 19)}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-kali-critical">{h.countermeasure}</span>
                      </td>
                      <td className="py-2.5 px-3 text-kali-text">
                        {h.target_pid ? `PID ${h.target_pid} (${h.process_name || 'proc'})` : h.target_ip || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-kali-muted font-sans">{h.reason}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            h.success
                              ? 'bg-kali-secure/15 text-kali-secure border border-kali-secure/40'
                              : 'bg-kali-critical/15 text-kali-critical border border-kali-critical/40'
                          }`}
                        >
                          {h.success ? (
                            <>
                              <CheckCircle className="h-3 w-3" /> NEUTRALIZED
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3" /> FAILED
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
        title="Confirm Malicious Process Neutralization"
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="rounded-lg bg-kali-critical/15 border border-kali-critical/40 p-3.5 flex items-start gap-3 text-kali-critical">
            <AlertTriangle className="h-5 w-5 text-kali-critical shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-kali-critical">FORCE_TERMINATE_PROCESS (PID {selectedPidToKill})</div>
              <p className="mt-1 text-kali-text font-sans text-xs">
                Active Defense will forcefully terminate PID {selectedPidToKill} and all recursively spawned child subprocesses (e.g., cmd.exe, powershell).
              </p>
            </div>
          </div>

          <div>
            <label className="block text-kali-text font-semibold mb-1">Reason for Neutralization:</label>
            <input
              type="text"
              value={killReason}
              onChange={(e) => setKillReason(e.target.value)}
              className="w-full rounded-lg border border-kali-border bg-kali-bg px-3 py-2 text-kali-text text-xs focus:outline-none focus:border-kali-critical"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-kali-border">
            <button
              onClick={() => setIsKillModalOpen(false)}
              className="rounded px-3 py-1.5 text-kali-muted hover:text-kali-text transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleExecuteKill}
              className="flex items-center gap-1.5 rounded-lg bg-kali-critical hover:bg-kali-critical/90 text-white font-bold px-4 py-1.5 text-xs shadow-lg shadow-kali-critical/20 transition-colors"
            >
              <Skull className="h-3.5 w-3.5" />
              ENGAGE_KILL_SWITCH
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
        <form onSubmit={handleCreateSinkhole} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-kali-text font-semibold mb-1">Offending IP Address:</label>
            <input
              type="text"
              value={sinkholeIpInput}
              onChange={(e) => setSinkholeIpInput(e.target.value)}
              placeholder="e.g. 198.51.100.1 or 45.33.32.156"
              className="w-full rounded-lg border border-kali-border bg-kali-bg px-3 py-2 text-kali-text text-xs focus:outline-none focus:border-kali-primary"
              required
            />
          </div>

          <div>
            <label className="block text-kali-text font-semibold mb-1">Containment Justification:</label>
            <input
              type="text"
              value={sinkholeReasonInput}
              onChange={(e) => setSinkholeReasonInput(e.target.value)}
              className="w-full rounded-lg border border-kali-border bg-kali-bg px-3 py-2 text-kali-text text-xs focus:outline-none focus:border-kali-primary font-sans"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-kali-border">
            <button
              type="button"
              onClick={() => setIsSinkholeModalOpen(false)}
              className="rounded px-3 py-1.5 text-kali-muted hover:text-kali-text transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-kali-critical hover:bg-kali-critical/90 text-white font-bold px-4 py-1.5 text-xs shadow-lg shadow-kali-critical/20 transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
              APPLY_OS_FIREWALL_DROP
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

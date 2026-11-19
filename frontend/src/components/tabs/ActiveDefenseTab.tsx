import React, { useState, useEffect } from 'react';
import {
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
import { formatTimestamp } from '../../utils/formatters';

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
  const toast = useToast();

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
      toast.success('Process Terminated', `PID ${selectedPidToKill} neutralized.`);
      setIsKillModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error('Termination Failed', err.message);
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
      toast.success('Sinkhole Created', `IP ${sinkholeIpInput} blocked at OS firewall.`);
      setIsSinkholeModalOpen(false);
      setSinkholeIpInput('');
      loadData();
    } catch (err: any) {
      toast.error('Sinkhole Failed', err.message);
    }
  };

  const handleReleaseSinkhole = async (ip: string) => {
    try {
      await api.releaseSinkhole(ip);
      toast.info('Sinkhole Released', `Firewall rule removed for IP ${ip}.`);
      loadData();
    } catch (err: any) {
      toast.error('Release Failed', err.message);
    }
  };

  const handleRestoreQuarantine = async (id: string) => {
    try {
      await api.restoreActiveDefenseQuarantine(id);
      toast.success('File Restored', `File ${id} restored to its original path.`);
      loadData();
    } catch (err: any) {
      toast.error('Restore Failed', err.message);
    }
  };

  const handlePurgeQuarantine = async (id: string) => {
    try {
      await api.purgeActiveDefenseQuarantine(id);
      toast.info('File Purged', `Quarantine entry ${id} permanently wiped.`);
      loadData();
    } catch (err: any) {
      toast.error('Purge Failed', err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Active Defense & Containment
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time process inspection, network sinkholing, and automated file quarantine.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsSinkholeModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white px-3.5 py-2 text-xs font-semibold transition-all shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Sinkhole</span>
          </button>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tracked Processes"
          value={processes.length}
          icon={<Cpu className="h-4 w-4" />}
          subValue="Active host sentry"
        />
        <StatCard
          label="Active Sinkholes"
          value={sinkholes.length}
          icon={<Lock className="h-4 w-4" />}
          subValue="Firewall enforced"
          subValueColor="text-[#16A34A]"
        />
        <StatCard
          label="Quarantined Files"
          value={quarantine.length}
          icon={<Archive className="h-4 w-4" />}
          subValue="Sandbox vault"
        />
        <StatCard
          label="Countermeasures"
          value={history.length}
          icon={<Activity className="h-4 w-4" />}
          subValue="Automated actions"
        />
      </div>

      {/* Subtab Navigation Bar */}
      <div className="flex border-b border-[#E5EAF1] bg-white rounded-t-xl px-4 text-xs font-medium shadow-2xs">
        {[
          { id: 'processes', label: `Processes (${processes.length})` },
          { id: 'sinkholes', label: `Network Sinkholes (${sinkholes.length})` },
          { id: 'quarantine', label: `Quarantine Vault (${quarantine.length})` },
          { id: 'history', label: `Audit Log (${history.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`py-3 px-4 border-b-2 transition-all ${
              activeSubTab === tab.id
                ? 'border-[#3B82F6] text-[#3B82F6] font-semibold'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subtab Content Area */}
      <div className="rounded-b-xl border border-t-0 border-[#E5EAF1] bg-white overflow-hidden shadow-2xs p-4">
        {activeSubTab === 'processes' && (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E5EAF1] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">PID</th>
                  <th className="py-2.5 px-3">Process Name</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">CPU / Memory</th>
                  <th className="py-2.5 px-3">Command Line</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {processes.map((p) => (
                  <tr key={p.pid} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-mono text-[#64748B]">{p.pid}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#1E293B]">{p.name}</td>
                    <td className="py-2.5 px-3 text-[#64748B]">{p.user}</td>
                    <td className="py-2.5 px-3 text-[#64748B]">
                      {p.cpu_percent}% / {p.memory_mb.toFixed(1)}MB
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748B] truncate max-w-xs">
                      {p.cmdline}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedPidToKill(p.pid);
                          setIsKillModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-[#FEF2F2] text-[#DC2626] font-medium border border-[#FCD2D2] hover:bg-[#FDE2E2]"
                      >
                        Kill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeSubTab === 'sinkholes' && (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E5EAF1] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Blocked IP</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Enacted</th>
                  <th className="py-2.5 px-3">Blocked Hits</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {sinkholes.map((s) => (
                  <tr key={s.ip} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#DC2626]">{s.ip}</td>
                    <td className="py-2.5 px-3 text-[#1E293B]">{s.reason}</td>
                    <td className="py-2.5 px-3 text-[#64748B]">{formatTimestamp(s.created_at)}</td>
                    <td className="py-2.5 px-3 font-mono text-[#64748B]">{s.blocked_hits}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleReleaseSinkhole(s.ip)}
                        className="px-2.5 py-1 rounded border border-[#E5EAF1] text-[#64748B] hover:text-[#1E293B]"
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                ))}
                {sinkholes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No active sinkholes. All ingress allowed by default.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSubTab === 'quarantine' && (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E5EAF1] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Original Filename</th>
                  <th className="py-2.5 px-3">Threat Type</th>
                  <th className="py-2.5 px-3">Quarantined At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {quarantine.map((q) => (
                  <tr key={q.quarantine_id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-mono font-medium text-[#1E293B]">
                      {q.original_filename}
                    </td>
                    <td className="py-2.5 px-3 text-[#DC2626] font-semibold">{q.threat_name}</td>
                    <td className="py-2.5 px-3 text-[#64748B]">{formatTimestamp(q.quarantined_at)}</td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        onClick={() => handleRestoreQuarantine(q.quarantine_id)}
                        className="px-2 py-1 rounded border border-[#BCE8CD] bg-[#E8F7EF] text-[#16A34A]"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgeQuarantine(q.quarantine_id)}
                        className="px-2 py-1 rounded border border-[#FCD2D2] bg-[#FEF2F2] text-[#DC2626]"
                      >
                        Purge
                      </button>
                    </td>
                  </tr>
                ))}
                {quarantine.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#64748B]">
                      Quarantine vault is empty. No infected files held.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSubTab === 'history' && (
          <div className="space-y-2 text-xs">
            {history.map((h, i) => (
              <div key={i} className="p-3 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#1E293B]">{h.countermeasure}</span>
                  <span className="text-[#64748B] ml-2">Reason: {h.reason}</span>
                </div>
                <span className="font-mono text-[#94A3B8]">{formatTimestamp(h.timestamp)}</span>
              </div>
            ))}
            {history.length === 0 && (
              <div className="py-8 text-center text-[#64748B]">
                No automated countermeasure events recorded.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kill Process Modal */}
      {isKillModalOpen && (
        <Modal
          isOpen={isKillModalOpen}
          onClose={() => setIsKillModalOpen(false)}
          title="Terminate Process"
          subtitle={`Neutralize PID ${selectedPidToKill}`}
          icon={<AlertTriangle className="h-4 w-4 text-[#DC2626]" />}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Termination Justification</label>
              <input
                type="text"
                value={killReason}
                onChange={(e) => setKillReason(e.target.value)}
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsKillModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E5EAF1] text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteKill}
                className="px-4 py-2 rounded-lg bg-[#DC2626] text-white font-semibold"
              >
                Terminate Process
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Sinkhole Modal */}
      {isSinkholeModalOpen && (
        <Modal
          isOpen={isSinkholeModalOpen}
          onClose={() => setIsSinkholeModalOpen(false)}
          title="Create Perimeter Sinkhole"
          subtitle="Enact instant OS firewall rule blocking target IP"
          icon={<Lock className="h-4 w-4 text-[#3B82F6]" />}
        >
          <form onSubmit={handleCreateSinkhole} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Target IP Address *</label>
              <input
                type="text"
                required
                value={sinkholeIpInput}
                onChange={(e) => setSinkholeIpInput(e.target.value)}
                placeholder="e.g. 192.168.1.150"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 font-mono text-[#1E293B]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Block Justification</label>
              <input
                type="text"
                value={sinkholeReasonInput}
                onChange={(e) => setSinkholeReasonInput(e.target.value)}
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSinkholeModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E5EAF1] text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold"
              >
                Enact Sinkhole
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  ShieldCheck,
  RefreshCw,
  Plus,
  AlertTriangle,
  Lock,
  Unlock,
  Terminal,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { SearchInput } from '../ui/SearchInput';
import { StatCard } from '../ui/StatCard';
import { truncateId } from '../../utils/formatters';

export const EndpointsTab: React.FC = () => {
  const toast = useToast();
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [deviceDetail, setDeviceDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Containment Modal state
  const [containModalOpen, setContainModalOpen] = useState(false);
  const [containScope, setContainScope] = useState('PROCESS_SUSPENSION');
  const [containReason, setContainReason] = useState('');
  const [containAuthorizedBy, setContainAuthorizedBy] = useState('');
  const [humanApproved, setHumanApproved] = useState(true);
  const [submittingContain, setSubmittingContain] = useState(false);

  // Enroll Modal state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollHostname, setEnrollHostname] = useState('');
  const [enrollPlatform, setEnrollPlatform] = useState('windows');
  const [enrollSecret, setEnrollSecret] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const fetchEndpoints = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listEndpoints();
      setEndpoints(data);
    } catch (err: any) {
      toast.error('Endpoints Error', `Failed to load endpoints: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const loadDeviceDetail = async (deviceId: string) => {
    try {
      setDetailLoading(true);
      const detail = await api.getEndpoint(deviceId);
      setDeviceDetail(detail);
    } catch (err: any) {
      toast.error('Detail Error', `Failed to load device details: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelectDevice = (dev: any) => {
    setSelectedDevice(dev);
    loadDeviceDetail(dev.id);
  };

  const handleContainmentSubmit = async () => {
    if (!selectedDevice) return;
    if (!containReason.trim() || !containAuthorizedBy.trim()) {
      toast.error('Required Fields', 'Reason and Authorized By fields are mandatory for containment.');
      return;
    }

    try {
      setSubmittingContain(true);
      await api.containEndpoint(selectedDevice.id, {
        scope: containScope,
        reason: containReason,
        authorized_by: containAuthorizedBy,
        human_approved: humanApproved,
      });
      toast.success('Device Contained', `Device ${selectedDevice.hostname} successfully contained.`);
      setContainModalOpen(false);
      setContainReason('');
      setContainAuthorizedBy('');
      fetchEndpoints();
      loadDeviceDetail(selectedDevice.id);
    } catch (err: any) {
      toast.error('Containment Failed', err.message);
    } finally {
      setSubmittingContain(false);
    }
  };

  const handleReleaseSubmit = async (devId: string) => {
    try {
      await api.releaseEndpoint(devId, {
        released_by: 'admin_console',
        release_notes: 'Administrator released containment following verification.',
      });
      toast.success('Containment Released', 'Device status restored to ONLINE.');
      fetchEndpoints();
      if (selectedDevice && selectedDevice.id === devId) {
        loadDeviceDetail(devId);
      }
    } catch (err: any) {
      toast.error('Release Failed', err.message);
    }
  };

  const handleEnrollSubmit = async () => {
    if (!enrollHostname.trim() || !enrollSecret.trim()) {
      toast.error('Input Error', 'Hostname and Enrollment Secret are required.');
      return;
    }

    try {
      setEnrolling(true);
      const res = await api.enrollEndpoint({
        hostname: enrollHostname,
        os_platform: enrollPlatform,
        enrollment_secret: enrollSecret,
      });
      toast.success('Endpoint Enrolled', `Host ${res.hostname} enrolled! Token: ${res.token_prefix}`);
      setEnrollModalOpen(false);
      setEnrollHostname('');
      setEnrollSecret('');
      fetchEndpoints();
    } catch (err: any) {
      toast.error('Enrollment Failed', err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = endpoints.filter(
    (d) =>
      d.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.ip_address && d.ip_address.includes(searchTerm))
  );

  const totalDevices = endpoints.length;
  const onlineDevices = endpoints.filter((d) => d.status === 'ONLINE').length;
  const containedDevices = endpoints.filter((d) => d.is_contained).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Monitor className="h-6 w-6 text-kali-cyan" />
            Endpoint Security
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Host sentry containment, OS process inspection, and device telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setEnrollModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-4 py-2 text-xs font-semibold text-white shadow-kali-glow hover:opacity-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Enroll Endpoint</span>
          </button>
          <button
            onClick={fetchEndpoints}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Endpoints"
          value={totalDevices}
          description="Enrolled hosts"
          icon={<Monitor className="h-4 w-4 text-kali-cyan" />}
        />
        <StatCard
          label="Online Sentries"
          value={onlineDevices}
          subValue="Active"
          subValueColor="text-emerald-400"
          description="Receiving telemetry"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          label="Contained Hosts"
          value={containedDevices}
          subValue="Isolated"
          subValueColor="text-rose-400"
          description="Egress blocked"
          icon={<Lock className="h-4 w-4 text-rose-400" />}
        />
        <StatCard
          label="Enforcement Mode"
          value="Fail-Closed"
          subValue="Active"
          subValueColor="text-kali-cyan"
          description="Zero-trust isolation"
          icon={<ShieldCheck className="h-4 w-4 text-kali-primary" />}
        />
      </div>

      {/* Device Table & Detail Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Device Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Filter by hostname or IP address..."
                className="max-w-md w-full"
              />
              <span className="text-xs text-slate-400">{filtered.length} devices</span>
            </div>

            {loading ? (
              <div className="py-12">
                <LoadingSpinner message="Checking endpoint status..." />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                <Monitor className="h-8 w-8 text-slate-600 mb-2" />
                <p className="font-semibold text-white">No endpoints enrolled yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Enroll an endpoint using the connector client to establish telemetry.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Hostname</th>
                      <th className="py-3 px-4 font-medium">Platform</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">IP Address</th>
                      <th className="py-3 px-4 font-medium">Last Heartbeat</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {filtered.map((d) => {
                      const isSelected = selectedDevice?.id === d.id;
                      const isOnline = d.status === 'ONLINE';
                      const isContained = d.is_contained;

                      return (
                        <tr
                          key={d.id}
                          onClick={() => handleSelectDevice(d)}
                          className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${
                            isSelected ? 'bg-white/[0.04] border-l-2 border-kali-cyan' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-white flex items-center gap-2.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isContained ? 'bg-rose-400' : isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            <span>{d.hostname}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 uppercase text-xs">
                            {d.os_platform} v{d.agent_version || '1.0'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                isContained
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : isOnline
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-white/5 text-slate-400 border border-white/10'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-kali-cyan font-mono">{d.ip_address || '127.0.0.1'}</td>
                          <td className="py-3 px-4 text-slate-400 text-xs">
                            {new Date(d.last_heartbeat_at).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {d.is_contained ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReleaseSubmit(d.id);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 hover:text-white px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20 transition-all"
                              >
                                <Unlock className="h-3.5 w-3.5" /> Release
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDevice(d);
                                  setContainModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white px-3 py-1 text-xs font-medium text-rose-400 border border-rose-500/20 transition-all"
                              >
                                <Lock className="h-3.5 w-3.5" /> Contain
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Device Detail Panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
              <ShieldCheck className="h-4 w-4 text-kali-cyan" />
              <span>Host Forensic Telemetry</span>
            </h2>

            {!selectedDevice ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Select an endpoint to inspect process telemetry.
              </div>
            ) : detailLoading ? (
              <div className="py-12">
                <LoadingSpinner message="Querying host telemetry..." />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hostname:</span>
                    <span className="font-semibold text-white">{selectedDevice.hostname}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Device ID:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-kali-cyan font-mono">{truncateId(selectedDevice.id, 10)}</span>
                      <button
                        onClick={() => handleCopy(selectedDevice.id, selectedDevice.id)}
                        className="text-slate-500 hover:text-white"
                        title="Copy Device ID"
                      >
                        {copiedId === selectedDevice.id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Token Prefix:</span>
                    <span className="text-slate-300 font-mono">{selectedDevice.token_prefix}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Local MAC:</span>
                    <span className="text-slate-400 font-mono">{selectedDevice.mac_address || '00:1A:2B:3C:4D:5E'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Containment:</span>
                    <span className={`font-semibold ${selectedDevice.is_contained ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {selectedDevice.is_contained ? `Contained (${selectedDevice.containment_reason})` : 'Active (Online)'}
                    </span>
                  </div>
                </div>

                {/* Telemetry Stream */}
                <div>
                  <h3 className="font-semibold text-slate-300 mb-2 flex items-center gap-2 text-xs">
                    <Terminal className="h-3.5 w-3.5 text-kali-cyan" />
                    <span>Recent Process Telemetry</span>
                  </h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {deviceDetail?.recent_telemetry?.length === 0 ? (
                      <div className="text-slate-500 p-6 text-center text-xs rounded-xl border border-dashed border-white/10">
                        No suspicious process telemetry detected.
                      </div>
                    ) : (
                      deviceDetail?.recent_telemetry?.map((te: any) => (
                        <div key={te.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                          <div className="flex justify-between text-slate-400">
                            <span className="font-semibold text-white">{te.process_name} (PID: {te.process_pid})</span>
                            <span className={te.severity === 'SUSPICIOUS' ? 'text-rose-400 font-semibold' : 'text-kali-cyan'}>
                              {te.severity}
                            </span>
                          </div>
                          <div className="text-slate-400 truncate mt-1 text-[11px] font-mono">{te.command_line}</div>
                          <div className="text-slate-500 text-[10px] mt-1">{new Date(te.recorded_at).toLocaleTimeString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Containment Safeguard Modal */}
      <Modal
        isOpen={containModalOpen}
        onClose={() => setContainModalOpen(false)}
        title={`Authorize Host Containment: ${selectedDevice?.hostname || ''}`}
        icon={<Lock className="h-5 w-5 text-rose-400" />}
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 flex items-start gap-3 text-rose-400">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-white">Reversible Containment</div>
              <p className="mt-1 text-slate-300 text-xs">
                Containment gracefully suspends agent subprocesses or restricts network egress.
              </p>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Containment Scope</label>
            <select
              value={containScope}
              onChange={(e) => setContainScope(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
            >
              <option value="PROCESS_SUSPENSION" className="bg-[#0a0d14]">PROCESS_SUSPENSION (Pause runner PIDs)</option>
              <option value="NETWORK_ISOLATION" className="bg-[#0a0d14]">NETWORK_ISOLATION (Block non-SOC egress)</option>
              <option value="TOTAL_QUARANTINE" className="bg-[#0a0d14]">TOTAL_QUARANTINE (Process kill + network block)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Containment Reason (Mandatory Audit Evidence)</label>
            <textarea
              rows={2}
              required
              value={containReason}
              onChange={(e) => setContainReason(e.target.value)}
              placeholder="e.g. Rogue child process spawned by compromised agent"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Authorized Operator Sign-off</label>
            <input
              type="text"
              required
              value={containAuthorizedBy}
              onChange={(e) => setContainAuthorizedBy(e.target.value)}
              placeholder="Operator username / role"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="human_approved"
              checked={humanApproved}
              onChange={(e) => setHumanApproved(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/[0.03] text-kali-cyan focus:ring-0"
            />
            <label htmlFor="human_approved" className="text-slate-300 text-xs">
              Confirm human-in-the-loop authorization
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
            <button
              onClick={() => setContainModalOpen(false)}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleContainmentSubmit}
              disabled={submittingContain || !containReason.trim() || !containAuthorizedBy.trim()}
              className="rounded-xl bg-rose-500 hover:bg-rose-600 px-5 py-2 font-semibold text-white disabled:opacity-50 transition-all"
            >
              {submittingContain ? 'Applying...' : 'Enforce Containment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Enroll Endpoint Modal */}
      <Modal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title="Enroll Sentry Endpoint"
        icon={<Plus className="h-5 w-5 text-kali-cyan" />}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Hostname</label>
            <input
              type="text"
              value={enrollHostname}
              onChange={(e) => setEnrollHostname(e.target.value)}
              placeholder="e.g. SOC-RUNNER-NODE-01"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">OS Platform</label>
            <select
              value={enrollPlatform}
              onChange={(e) => setEnrollPlatform(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none"
            >
              <option value="windows" className="bg-[#0a0d14]">Windows (PowerShell / Win32)</option>
              <option value="linux" className="bg-[#0a0d14]">Linux (eBPF / systemd)</option>
              <option value="darwin" className="bg-[#0a0d14]">macOS (Endpoint Security Framework)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Enrollment Secret Token</label>
            <input
              type="password"
              value={enrollSecret}
              onChange={(e) => setEnrollSecret(e.target.value)}
              placeholder="Pre-shared enrollment cluster secret"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-cyan focus:outline-none font-mono"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
            <button
              onClick={() => setEnrollModalOpen(false)}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleEnrollSubmit}
              disabled={enrolling || !enrollHostname.trim() || !enrollSecret.trim()}
              className="rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue px-5 py-2 font-semibold text-white shadow-kali-glow hover:opacity-95 disabled:opacity-50 transition-all"
            >
              {enrolling ? 'Enrolling...' : 'Enroll Host'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Search,
  RefreshCw,
  Plus,
  AlertTriangle,
  Lock,
  Unlock,
  Terminal,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export const EndpointsTab: React.FC = () => {
  const { error: toastError, success: toastSuccess } = useToast();
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [deviceDetail, setDeviceDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      toastError(`Failed to load endpoints: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const loadDeviceDetail = async (deviceId: string) => {
    try {
      setDetailLoading(true);
      const detail = await api.getEndpoint(deviceId);
      setDeviceDetail(detail);
    } catch (err: any) {
      toastError(`Failed to load device details: ${err.message}`);
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
      toastError('Reason and Authorized By fields are mandatory for containment.');
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
      toastSuccess(`Device ${selectedDevice.hostname} contained successfully.`);
      setContainModalOpen(false);
      setContainReason('');
      setContainAuthorizedBy('');
      fetchEndpoints();
      loadDeviceDetail(selectedDevice.id);
    } catch (err: any) {
      toastError(`Containment failed: ${err.message}`);
    } finally {
      setSubmittingContain(false);
    }
  };

  const handleReleaseSubmit = async (devId: string) => {
    try {
      await api.releaseEndpoint(devId, {
        released_by: 'admin_console',
        release_notes: 'Administrator released containment after investigation.',
      });
      toastSuccess('Containment released. Status restored to ONLINE.');
      fetchEndpoints();
      if (selectedDevice && selectedDevice.id === devId) {
        loadDeviceDetail(devId);
      }
    } catch (err: any) {
      toastError(`Failed to release containment: ${err.message}`);
    }
  };

  const handleEnrollSubmit = async () => {
    if (!enrollHostname.trim() || !enrollSecret.trim()) {
      toastError('Hostname and Enrollment Secret are required.');
      return;
    }

    try {
      setEnrolling(true);
      const res = await api.enrollEndpoint({
        hostname: enrollHostname,
        os_platform: enrollPlatform,
        enrollment_secret: enrollSecret,
      });
      toastSuccess(`Endpoint ${res.hostname} enrolled! Token: ${res.token_prefix}`);
      setEnrollModalOpen(false);
      setEnrollHostname('');
      setEnrollSecret('');
      fetchEndpoints();
    } catch (err: any) {
      toastError(`Enrollment failed: ${err.message}`);
    } finally {
      setEnrolling(false);
    }
  };

  const filtered = endpoints.filter((d) =>
    d.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.ip_address && d.ip_address.includes(searchTerm))
  );

  const totalDevices = endpoints.length;
  const onlineDevices = endpoints.filter((d) => d.status === 'ONLINE').length;
  const containedDevices = endpoints.filter((d) => d.is_contained).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Monitor className="h-6 w-6 text-cyan-400" />
            AgentTrust Endpoint Connector
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Native host enforcement surface for authorized AI-agent workflows and controlled containment.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchEndpoints}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setEnrollModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Enroll Device
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Enrolled Devices"
          value={totalDevices}
          icon={<Monitor className="h-5 w-5 text-cyan-400" />}
          description="Managed Windows & Linux workloads"
        />
        <StatCard
          label="Online & Synchronized"
          value={onlineDevices}
          subValue={totalDevices > 0 ? `${Math.round((onlineDevices / totalDevices) * 100)}%` : '0%'}
          subValueColor="text-emerald-400"
          icon={<Radio className="h-5 w-5 text-emerald-400" />}
          description="Active heartbeat within threshold"
        />
        <StatCard
          label="Contained Endpoints"
          value={containedDevices}
          subValue={containedDevices > 0 ? 'ACTIVE' : 'NONE'}
          subValueColor={containedDevices > 0 ? 'text-rose-400' : 'text-slate-400'}
          icon={<ShieldAlert className="h-5 w-5 text-rose-400" />}
          description="Safeguarded isolation state"
        />
      </div>

      {/* Main Grid: Device List and Details Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Device Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by hostname or IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
              <span className="text-xs text-slate-400 font-mono">{filtered.length} devices</span>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-slate-500">
                <Monitor className="h-10 w-10 text-slate-600 mb-2" />
                <p className="text-sm font-medium">No enrolled endpoints found</p>
                <p className="text-xs mt-1">Enroll an endpoint or run the connector CLI to stream telemetry.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400">
                    <tr>
                      <th className="p-3">Device Hostname</th>
                      <th className="p-3">OS / Version</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">IP Address</th>
                      <th className="p-3">Last Heartbeat</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filtered.map((d) => {
                      const isSelected = selectedDevice?.id === d.id;
                      return (
                        <tr
                          key={d.id}
                          onClick={() => handleSelectDevice(d)}
                          className={`cursor-pointer transition hover:bg-slate-800/40 ${
                            isSelected ? 'bg-cyan-950/30 border-l-2 border-cyan-400' : ''
                          }`}
                        >
                          <td className="p-3 font-semibold text-white flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                d.status === 'ONLINE'
                                  ? 'bg-emerald-400'
                                  : d.status === 'CONTAINED'
                                  ? 'bg-rose-500'
                                  : 'bg-slate-500'
                              }`}
                            />
                            {d.hostname}
                          </td>
                          <td className="p-3 capitalize text-slate-400 font-mono">
                            {d.os_platform} {d.agent_version}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                                d.status === 'ONLINE'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : d.status === 'CONTAINED'
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-400">{d.ip_address || '127.0.0.1'}</td>
                          <td className="p-3 text-slate-400">
                            {new Date(d.last_heartbeat_at).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-right">
                            {d.is_contained ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReleaseSubmit(d.id);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] font-semibold text-emerald-400 border border-slate-700"
                              >
                                <Unlock className="h-3 w-3" /> Release
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDevice(d);
                                  setContainModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-rose-950/60 hover:bg-rose-900 px-2 py-1 text-[11px] font-semibold text-rose-300 border border-rose-800/80"
                              >
                                <Lock className="h-3 w-3" /> Contain
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
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              Device Forensic & Telemetry Panel
            </h2>

            {!selectedDevice ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Select an endpoint from the table to inspect telemetry and containment records.
              </div>
            ) : detailLoading ? (
              <div className="flex h-48 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hostname:</span>
                    <span className="font-semibold text-white">{selectedDevice.hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Device ID:</span>
                    <span className="font-mono text-cyan-400">{selectedDevice.id.slice(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Token Prefix:</span>
                    <span className="font-mono text-slate-300">{selectedDevice.token_prefix}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Local MAC:</span>
                    <span className="font-mono text-slate-400">{selectedDevice.mac_address || 'Local Segment Only'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Containment:</span>
                    <span className={`font-semibold ${selectedDevice.is_contained ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {selectedDevice.is_contained ? `CONTAINED (${selectedDevice.containment_reason})` : 'SECURE (Online)'}
                    </span>
                  </div>
                </div>

                {/* Telemetry Stream */}
                <div>
                  <h3 className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                    Authorized Workflow Telemetry
                  </h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {deviceDetail?.recent_telemetry?.length === 0 ? (
                      <div className="text-slate-500 italic p-2 text-center">No telemetry events logged yet.</div>
                    ) : (
                      deviceDetail?.recent_telemetry?.map((te: any) => (
                        <div key={te.id} className="rounded bg-slate-950 p-2 border border-slate-800/80 font-mono text-[11px]">
                          <div className="flex justify-between text-slate-400">
                            <span className="font-bold text-white">{te.process_name} (PID: {te.process_pid})</span>
                            <span className={te.severity === 'SUSPICIOUS' ? 'text-rose-400 font-bold' : 'text-cyan-400'}>
                              {te.severity}
                            </span>
                          </div>
                          <div className="text-slate-400 truncate mt-1">{te.command_line}</div>
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
        title={`Authorize Controlled Containment: ${selectedDevice?.hostname}`}
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-lg bg-rose-950/40 border border-rose-800 p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-300">Enterprise Containment Safeguards</div>
              <p className="text-rose-200/80">
                Containment is non-destructive and fully reversible. It does NOT terminate arbitrary system processes,
                hack back, or perform unreviewed deletions.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Containment Scope</label>
            <select
              value={containScope}
              onChange={(e) => setContainScope(e.target.value)}
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-white"
            >
              <option value="PROCESS_SUSPENSION">Graceful Agent Process Suspension (SIGSTOP / SuspendThread)</option>
              <option value="WORKSPACE_RESTRICTION">Agent Workspace Isolation (Read-Only Restriction)</option>
              <option value="NETWORK_ISOLATION">Network Egress Quarantine (Managed Outbound Block)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Forensic Justification / Reason</label>
            <textarea
              rows={3}
              value={containReason}
              onChange={(e) => setContainReason(e.target.value)}
              placeholder="e.g. Prompt injection attempted unauthorized exfiltration outside sandbox boundary"
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Authorized Administrator</label>
            <input
              type="text"
              value={containAuthorizedBy}
              onChange={(e) => setContainAuthorizedBy(e.target.value)}
              placeholder="e.g. secops_admin@corp.internal"
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="human-approved-check"
              checked={humanApproved}
              onChange={(e) => setHumanApproved(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-cyan-600 focus:ring-cyan-500"
            />
            <label htmlFor="human-approved-check" className="text-slate-300 font-medium">
              I confirm explicit human verification and authorization for this endpoint action.
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setContainModalOpen(false)}
              className="rounded px-3 py-1.5 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleContainmentSubmit}
              disabled={submittingContain || !humanApproved}
              className="rounded bg-rose-600 hover:bg-rose-500 px-4 py-1.5 font-bold text-white disabled:opacity-50"
            >
              {submittingContain ? 'Applying...' : 'Enforce Containment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Enroll Device Modal */}
      <Modal isOpen={enrollModalOpen} onClose={() => setEnrollModalOpen(false)} title="Enroll Authorized Endpoint Device">
        <div className="space-y-4 text-xs">
          <p className="text-slate-400">
            Enrolling a host provisions a cryptographic device token stored as an immutable SHA-256 hash.
          </p>
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Hostname</label>
            <input
              type="text"
              value={enrollHostname}
              onChange={(e) => setEnrollHostname(e.target.value)}
              placeholder="e.g. DESKTOP-SEC-NODE-01"
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Platform</label>
            <select
              value={enrollPlatform}
              onChange={(e) => setEnrollPlatform(e.target.value)}
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-white"
            >
              <option value="windows">Microsoft Windows (x86_64)</option>
              <option value="linux">Linux (eBPF / Auditd - Phase 2)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Enrollment Secret Key</label>
            <input
              type="password"
              value={enrollSecret}
              onChange={(e) => setEnrollSecret(e.target.value)}
              placeholder="Enterprise ENROLLMENT_SECRET"
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button onClick={() => setEnrollModalOpen(false)} className="rounded px-3 py-1.5 text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={handleEnrollSubmit}
              disabled={enrolling}
              className="rounded bg-cyan-600 hover:bg-cyan-500 px-4 py-1.5 font-bold text-white disabled:opacity-50"
            >
              {enrolling ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

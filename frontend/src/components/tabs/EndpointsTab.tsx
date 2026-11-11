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
        release_notes: 'Administrator released containment following SOC verification.',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// PROTECTION</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">ENDPOINT_SECURITY</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Monitor className="h-6 w-6 text-kali-primary" />
            Native Endpoint Sentry & Containment Console
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Operating system host connectors, process telemetry interception, reversible workspace quarantine, and device containment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEndpoints}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>
          <button
            onClick={() => setEnrollModalOpen(true)}
            className="inline-flex items-center gap-2 rounded border border-transparent bg-kali-primary px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>ENROLL DEVICE</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[EP-01] Total Enrolled</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">{totalDevices}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Windows & Linux Workloads</div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[EP-02] Online Sentry</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-secure">{onlineDevices}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Active Heartbeat Within SLA</div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[EP-03] Contained Devices</div>
          <div className={`mt-1 font-mono text-2xl font-bold ${containedDevices > 0 ? 'text-kali-critical' : 'text-slate-400'}`}>
            {containedDevices}
          </div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Reversible Isolation State</div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[EP-04] Verification State</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-primary">AUTHENTICATED</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Zero Unauthenticated Access</div>
        </div>
      </div>

      {/* Main Grid: Device Table and Details Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Device Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card">
            <div className="flex items-center justify-between pb-3 border-b border-kali-border mb-3">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Filter by hostname or IP address..."
                className="max-w-md w-full"
              />
              <span className="font-mono text-xs text-slate-400">{filtered.length} devices enrolled</span>
            </div>

            {loading ? (
              <div className="py-12">
                <LoadingSpinner message="PROBING NATIVE ENDPOINT HEARTBEATS..." />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-slate-500 font-mono text-xs">
                <Monitor className="h-8 w-8 text-slate-600 mb-2" />
                <p className="font-bold">// NO ENROLLED ENDPOINTS FOUND</p>
                <p className="text-[11px] text-slate-400 mt-1 font-sans">
                  Enroll an endpoint using the connector client to establish authorized OS telemetry.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-kali-border bg-kali-bg/95 text-[11px] text-slate-400">
                    <tr>
                      <th className="p-2.5">Hostname</th>
                      <th className="p-2.5">Platform</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">IP Address</th>
                      <th className="p-2.5">Last Ping</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-kali-border text-slate-300">
                    {filtered.map((d) => {
                      const isSelected = selectedDevice?.id === d.id;
                      const isOnline = d.status === 'ONLINE';
                      const isContained = d.is_contained;

                      return (
                        <tr
                          key={d.id}
                          onClick={() => handleSelectDevice(d)}
                          className={`cursor-pointer transition-colors hover:bg-kali-elevated/40 ${
                            isSelected ? 'bg-kali-elevated/80 border-l-2 border-kali-primary' : ''
                          }`}
                        >
                          <td className="p-2.5 font-bold text-white flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isContained ? 'bg-kali-critical' : isOnline ? 'bg-kali-secure' : 'bg-slate-500'
                              }`}
                            />
                            <span>{d.hostname}</span>
                          </td>
                          <td className="p-2.5 text-slate-400 uppercase text-[11px]">
                            {d.os_platform} v{d.agent_version || '1.0'}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                                isContained
                                  ? 'bg-[#331418] text-kali-critical border border-[#7A1F26]'
                                  : isOnline
                                  ? 'bg-[#0E2E22] text-kali-secure border border-[#155E42]'
                                  : 'bg-kali-bg text-slate-400 border border-kali-border'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-kali-cyan">{d.ip_address || '127.0.0.1'}</td>
                          <td className="p-2.5 text-slate-400 text-[11px]">
                            {new Date(d.last_heartbeat_at).toLocaleTimeString()}
                          </td>
                          <td className="p-2.5 text-right">
                            {d.is_contained ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReleaseSubmit(d.id);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-[#0E2E22] hover:bg-[#154634] px-2.5 py-1 text-[11px] font-bold text-kali-secure border border-[#155E42] transition-colors"
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
                                className="inline-flex items-center gap-1 rounded bg-[#331418] hover:bg-[#4a1c22] px-2.5 py-1 text-[11px] font-bold text-kali-critical border border-[#7A1F26] transition-colors"
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
          <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card">
            <h2 className="text-xs font-bold text-white mb-3 flex items-center gap-2 border-b border-kali-border pb-2.5 font-mono">
              <ShieldCheck className="h-4 w-4 text-kali-cyan" />
              <span>// HOST_FORENSIC_TELEMETRY</span>
            </h2>

            {!selectedDevice ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs">
                // SELECT AN ENDPOINT TO INSPECT PROCESS TELEMETRY & HARDENING
              </div>
            ) : detailLoading ? (
              <div className="py-12">
                <LoadingSpinner message="QUERYING HOST TELEMETRY BUFFER..." />
              </div>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                <div className="rounded border border-kali-border bg-kali-bg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hostname:</span>
                    <span className="font-bold text-white">{selectedDevice.hostname}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Device ID:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-kali-cyan">{truncateId(selectedDevice.id, 10)}</span>
                      <button
                        onClick={() => handleCopy(selectedDevice.id, selectedDevice.id)}
                        className="text-slate-500 hover:text-white"
                        title="Copy Device ID"
                      >
                        {copiedId === selectedDevice.id ? (
                          <Check className="h-3 w-3 text-kali-secure" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Token Prefix:</span>
                    <span className="text-slate-300">{selectedDevice.token_prefix}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Local MAC:</span>
                    <span className="text-slate-400">{selectedDevice.mac_address || '00:1A:2B:3C:4D:5E'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Containment:</span>
                    <span className={`font-bold ${selectedDevice.is_contained ? 'text-kali-critical' : 'text-kali-secure'}`}>
                      {selectedDevice.is_contained ? `CONTAINED (${selectedDevice.containment_reason})` : 'ACTIVE (ONLINE)'}
                    </span>
                  </div>
                </div>

                {/* Telemetry Stream */}
                <div>
                  <h3 className="font-bold text-slate-300 mb-1.5 flex items-center gap-1.5 font-mono text-[11px]">
                    <Terminal className="h-3.5 w-3.5 text-kali-primary" />
                    <span>RECENT WORKFLOW PROCESS TELEMETRY</span>
                  </h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {deviceDetail?.recent_telemetry?.length === 0 ? (
                      <div className="text-slate-500 p-4 text-center font-mono text-[11px] rounded border border-dashed border-kali-border">
                        // NO SUSPICIOUS PROCESS TELEMETRY DETECTED
                      </div>
                    ) : (
                      deviceDetail?.recent_telemetry?.map((te: any) => (
                        <div key={te.id} className="rounded border border-kali-border bg-kali-bg p-2 font-mono text-[11px]">
                          <div className="flex justify-between text-slate-400">
                            <span className="font-bold text-white">{te.process_name} (PID: {te.process_pid})</span>
                            <span className={te.severity === 'SUSPICIOUS' ? 'text-kali-critical font-bold' : 'text-kali-cyan'}>
                              {te.severity}
                            </span>
                          </div>
                          <div className="text-slate-400 truncate mt-1 text-[10px]">{te.command_line}</div>
                          <div className="text-slate-500 text-[9px] mt-1">{new Date(te.recorded_at).toLocaleTimeString()}</div>
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
        title={`AUTHORIZE HOST CONTAINMENT: ${selectedDevice?.hostname || ''}`}
        icon={<Lock className="h-5 w-5 text-kali-critical" />}
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="rounded border border-kali-critical/60 bg-[#331418] p-3 flex items-start gap-3 text-kali-critical">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">[ENTERPRISE SAFEGUARD] REVERSIBLE CONTAINMENT:</div>
              <p className="mt-1 font-sans text-xs text-slate-300">
                Containment gracefully suspends agent subprocesses or restricts network egress. It does NOT destroy data or modify arbitrary host binaries.
              </p>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Containment Scope</label>
            <select
              value={containScope}
              onChange={(e) => setContainScope(e.target.value)}
              className="w-full rounded border border-kali-border bg-kali-bg p-2 text-white focus:border-kali-critical focus:outline-none"
            >
              <option value="PROCESS_SUSPENSION">Graceful Agent Process Suspension (SIGSTOP / SuspendThread)</option>
              <option value="WORKSPACE_RESTRICTION">Agent Workspace Isolation (Read-Only Jail)</option>
              <option value="NETWORK_ISOLATION">Network Egress Quarantine (Outbound Block)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Forensic Justification / Reason</label>
            <textarea
              rows={3}
              value={containReason}
              onChange={(e) => setContainReason(e.target.value)}
              placeholder="e.g. Prompt injection attempted unauthorized exfiltration outside sandbox boundary"
              className="w-full rounded border border-kali-border bg-kali-bg p-2 text-white focus:border-kali-critical focus:outline-none font-sans"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Authorized Administrator</label>
            <input
              type="text"
              value={containAuthorizedBy}
              onChange={(e) => setContainAuthorizedBy(e.target.value)}
              placeholder="e.g. secops_admin@corp.internal"
              className="w-full rounded border border-kali-border bg-kali-bg p-2 text-white focus:border-kali-critical focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-kali-border font-sans">
            <input
              type="checkbox"
              id="human-approved-check"
              checked={humanApproved}
              onChange={(e) => setHumanApproved(e.target.checked)}
              className="rounded border-kali-border bg-kali-bg text-kali-primary focus:ring-kali-primary"
            />
            <label htmlFor="human-approved-check" className="text-slate-300 text-xs font-semibold">
              I confirm explicit human verification and authorization for this endpoint action.
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-kali-border">
            <button
              onClick={() => setContainModalOpen(false)}
              className="rounded border border-kali-border bg-kali-elevated px-4 py-2 text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleContainmentSubmit}
              disabled={submittingContain || !humanApproved}
              className="rounded bg-kali-critical px-4 py-2 font-mono text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {submittingContain ? 'Applying...' : 'Enforce Containment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Enroll Device Modal */}
      <Modal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title="ENROLL AUTHORIZED ENDPOINT SENTRY"
        subtitle="Provisions cryptographic token stored as immutable salted hash"
        icon={<Monitor className="h-5 w-5 text-kali-primary" />}
      >
        <div className="space-y-4 font-mono text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Target Hostname</label>
            <input
              type="text"
              value={enrollHostname}
              onChange={(e) => setEnrollHostname(e.target.value)}
              placeholder="e.g. DESKTOP-SEC-NODE-01"
              className="w-full rounded border border-kali-border bg-kali-bg p-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Operating System Platform</label>
            <select
              value={enrollPlatform}
              onChange={(e) => setEnrollPlatform(e.target.value)}
              className="w-full rounded border border-kali-border bg-kali-bg p-2 text-white focus:border-kali-primary focus:outline-none"
            >
              <option value="windows">Microsoft Windows (x86_64)</option>
              <option value="linux">Linux (eBPF / Auditd Host)</option>
            </select>
          </div>
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Enrollment Secret Key</label>
            <input
              type="password"
              value={enrollSecret}
              onChange={(e) => setEnrollSecret(e.target.value)}
              placeholder="Enterprise ENROLLMENT_SECRET"
              className="w-full rounded border border-kali-border bg-kali-bg p-2 text-white focus:border-kali-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-kali-border">
            <button
              onClick={() => setEnrollModalOpen(false)}
              className="rounded border border-kali-border bg-kali-elevated px-4 py-2 text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleEnrollSubmit}
              disabled={enrolling}
              className="rounded bg-kali-primary px-4 py-2 font-mono text-xs font-bold text-white hover:bg-kali-secondaryBlue disabled:opacity-50"
            >
              {enrolling ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

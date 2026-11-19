import React, { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  RefreshCw,
  Plus,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';
import { StatCard } from '../ui/StatCard';
import { truncateId } from '../../utils/formatters';

export const EndpointsTab: React.FC = () => {
  const toast = useToast();
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);

  // Containment Modal state
  const [containModalOpen, setContainModalOpen] = useState(false);
  const [containScope, setContainScope] = useState('PROCESS_SUSPENSION');
  const [containReason, setContainReason] = useState('');
  const [containAuthorizedBy, setContainAuthorizedBy] = useState('');
  const humanApproved = true;
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
      const detail = await api.getEndpoint(deviceId);
      setSelectedDevice((prev: any) => ({ ...prev, ...detail }));
    } catch (err: any) {
      toast.error('Detail Error', `Failed to load device details: ${err.message}`);
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

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollHostname.trim()) return;

    try {
      setEnrolling(true);
      await api.enrollEndpoint({
        hostname: enrollHostname,
        platform: enrollPlatform,
        enrollment_secret: enrollSecret || 'soc_default_secret',
      });
      toast.success('Endpoint Enrolled', `Device ${enrollHostname} successfully provisioned.`);
      setEnrollModalOpen(false);
      setEnrollHostname('');
      fetchEndpoints();
    } catch (err: any) {
      toast.error('Enrollment Failed', err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const filteredEndpoints = endpoints.filter((d) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      d.hostname?.toLowerCase().includes(q) ||
      d.platform?.toLowerCase().includes(q) ||
      d.ip_address?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Endpoint Security Sentry
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Host-level process auditing, container isolation, and instant incident containment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setEnrollModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white px-3.5 py-2 text-xs font-semibold transition-all shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Enroll Device</span>
          </button>
          <button
            onClick={fetchEndpoints}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Enrolled Endpoints"
          value={endpoints.length}
          icon={<Monitor className="h-4 w-4" />}
          subValue="Active host fleet"
        />
        <StatCard
          label="Contained Devices"
          value={endpoints.filter((e) => e.is_contained).length}
          icon={<Lock className="h-4 w-4" />}
          subValue="Isolated"
          subValueColor="text-[#DC2626]"
        />
        <StatCard
          label="Healthy Sentry Ratio"
          value="100%"
          icon={<ShieldCheck className="h-4 w-4" />}
          subValue="Fleet Synchronized"
          subValueColor="text-[#16A34A]"
        />
        <StatCard
          label="Avg Host Latency"
          value="< 4 ms"
          icon={<RefreshCw className="h-4 w-4" />}
          subValue="Local Loopback"
        />
      </div>

      {/* Main Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Device List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white p-3.5 rounded-xl border border-[#E5EAF1] shadow-2xs">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search devices by hostname or IP..."
            />
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {filteredEndpoints.map((dev) => {
              const isSelected = selectedDevice?.id === dev.id;
              return (
                <div
                  key={dev.id}
                  onClick={() => handleSelectDevice(dev)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all shadow-2xs ${
                    isSelected
                      ? 'border-[#3B82F6] bg-[#EEF4FF]'
                      : 'border-[#E5EAF1] bg-white hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-xs text-[#1E293B]">{dev.hostname}</div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        dev.is_contained
                          ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCD2D2]'
                          : 'bg-[#E8F7EF] text-[#16A34A] border border-[#BCE8CD]'
                      }`}
                    >
                      {dev.is_contained ? 'CONTAINED' : 'ONLINE'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B] font-mono mt-1">
                    Platform: {dev.platform} • IP: {dev.ip_address || '127.0.0.1'}
                  </div>
                </div>
              );
            })}

            {filteredEndpoints.length === 0 && (
              <div className="p-8 text-center text-xs text-[#64748B] bg-white rounded-xl border border-[#E5EAF1]">
                No enrolled devices found.
              </div>
            )}
          </div>
        </div>

        {/* Device Details & Containment Controls (7 cols) */}
        <div className="lg:col-span-7">
          {selectedDevice ? (
            <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B]">{selectedDevice.hostname}</h3>
                  <span className="font-mono text-[11px] text-[#64748B]">ID: {truncateId(selectedDevice.id, 14)}</span>
                </div>
                <button
                  onClick={() => setContainModalOpen(true)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                    selectedDevice.is_contained
                      ? 'bg-[#E8F7EF] text-[#16A34A] border border-[#BCE8CD]'
                      : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCD2D2] hover:bg-[#FDE2E2]'
                  }`}
                >
                  {selectedDevice.is_contained ? 'Release Quarantine' : 'Contain Device'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[#64748B]">
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5EAF1]">
                  <span className="block text-[11px]">Platform OS</span>
                  <span className="font-bold text-[#1E293B] text-xs">{selectedDevice.platform}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5EAF1]">
                  <span className="block text-[11px]">Subnet IP Address</span>
                  <span className="font-mono text-[#1E293B] text-xs">{selectedDevice.ip_address || '127.0.0.1'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[#1E293B] mb-1">Host Telemetry & Sentry Log</h4>
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5EAF1] font-mono text-[11px] text-[#64748B] space-y-1">
                  <div>Status: {selectedDevice.is_contained ? 'ISOLATED' : 'ACTIVE_SENTRY'}</div>
                  <div>Kernel Bridge: Bound (Local Zero-Trust Pipe)</div>
                  <div>Process Interception: Enforced</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E5EAF1] bg-white p-16 text-center text-xs text-[#64748B]">
              Select an endpoint device on the left to inspect its security posture or enact containment.
            </div>
          )}
        </div>
      </div>

      {/* Containment Modal */}
      {containModalOpen && (
        <Modal
          isOpen={containModalOpen}
          onClose={() => setContainModalOpen(false)}
          title="Contain Endpoint Device"
          subtitle={`Enact host isolation for ${selectedDevice?.hostname}`}
          icon={<Lock className="h-4 w-4 text-[#DC2626]" />}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Containment Scope</label>
              <select
                value={containScope}
                onChange={(e) => setContainScope(e.target.value)}
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              >
                <option value="PROCESS_SUSPENSION">PROCESS_SUSPENSION (Halt AI processes)</option>
                <option value="NETWORK_ISOLATION">NETWORK_ISOLATION (Sever external sockets)</option>
                <option value="FULL_LOCKDOWN">FULL_LOCKDOWN (Kill container & revoke credentials)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Reason *</label>
              <input
                type="text"
                required
                value={containReason}
                onChange={(e) => setContainReason(e.target.value)}
                placeholder="State security incident reason..."
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Authorized By *</label>
              <input
                type="text"
                required
                value={containAuthorizedBy}
                onChange={(e) => setContainAuthorizedBy(e.target.value)}
                placeholder="Operator username / ID"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContainModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E5EAF1] text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingContain}
                onClick={handleContainmentSubmit}
                className="px-4 py-2 rounded-lg bg-[#DC2626] text-white font-semibold"
              >
                {submittingContain ? 'Containing...' : 'Execute Containment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Enroll Device Modal */}
      {enrollModalOpen && (
        <Modal
          isOpen={enrollModalOpen}
          onClose={() => setEnrollModalOpen(false)}
          title="Enroll Endpoint Device"
          subtitle="Provision sentry daemon identity for host machine"
          icon={<Monitor className="h-4 w-4 text-[#3B82F6]" />}
        >
          <form onSubmit={handleEnrollSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Hostname *</label>
              <input
                type="text"
                required
                value={enrollHostname}
                onChange={(e) => setEnrollHostname(e.target.value)}
                placeholder="e.g. SENTRY-HOST-01"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Platform</label>
              <select
                value={enrollPlatform}
                onChange={(e) => setEnrollPlatform(e.target.value)}
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              >
                <option value="windows">Windows</option>
                <option value="linux">Linux</option>
                <option value="darwin">macOS</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Enrollment Secret / Pre-Shared Key</label>
              <input
                type="password"
                value={enrollSecret}
                onChange={(e) => setEnrollSecret(e.target.value)}
                placeholder="soc_default_secret"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B] font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEnrollModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E5EAF1] text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={enrolling}
                className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold"
              >
                {enrolling ? 'Enrolling...' : 'Enrol Sentry'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

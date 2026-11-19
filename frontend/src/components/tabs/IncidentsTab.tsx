import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  X,
  Lock,
  RefreshCw,
  Download,
  ArrowUpDown,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { Incident } from '../../types';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { SearchInput } from '../ui/SearchInput';
import { formatTimestamp, truncateId } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const IncidentsTab: React.FC = () => {
  const toast = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'severity' | 'title'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Status update & Notes
  const [newStatus, setNewStatus] = useState<
    'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE'
  >('OPEN');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [containConfirmOpen, setContainConfirmOpen] = useState(false);

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listIncidents({
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
      });
      setIncidents(res as Incident[]);
    } catch (err: any) {
      toast.error('Incident Load Failed', err.message || 'Failed to load security incidents');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter, toast]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleOpenInvestigate = (inc: Incident) => {
    setSelectedIncident(inc);
    setNewStatus((inc.status as any) || 'OPEN');
    setResolutionNotes(inc.resolution_notes || '');
  };

  const handleUpdateStatus = async (status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE') => {
    if (!selectedIncident) return;
    if (status === 'CONTAINED') {
      setContainConfirmOpen(true);
      return;
    }
    setUpdating(true);
    try {
      const updated = await api.updateIncident(selectedIncident.id, {
        status,
        resolution_notes: resolutionNotes ? `${resolutionNotes} [Status changed to ${status}]` : `Status marked as ${status} via SOC triage.`,
      });
      setSelectedIncident(updated as Incident);
      toast.success('Incident Updated', `Incident marked as ${status}.`);
      fetchIncidents();
    } catch (err: any) {
      toast.error('Update Failed', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedIncident) return;
    setUpdating(true);
    try {
      const updated = await api.updateIncident(selectedIncident.id, {
        status: newStatus,
        resolution_notes: resolutionNotes,
      });
      setSelectedIncident(updated as Incident);
      toast.success('Notes Saved', 'Investigation report notes updated.');
      fetchIncidents();
    } catch (err: any) {
      toast.error('Save Failed', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmContainment = async () => {
    if (!selectedIncident) return;
    setUpdating(true);
    try {
      const updated = await api.updateIncident(selectedIncident.id, {
        status: 'CONTAINED',
        resolution_notes: resolutionNotes ? `${resolutionNotes} [Contained by authorized SOC Operator]` : `Immediate containment executed on affected agent.`,
      });
      setSelectedIncident(updated as Incident);
      toast.info('Threat Contained', `Incident #${truncateId(selectedIncident.id, 8)} agent identity contained.`);
      setContainConfirmOpen(false);
      fetchIncidents();
    } catch (err: any) {
      toast.error('Containment Failed', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleExportReport = async (format: 'html' | 'json') => {
    if (!selectedIncident) return;
    setExportingReport(true);
    try {
      const report = await api.exportIncidentReport(selectedIncident.id, format);
      const blob = new Blob([typeof report === 'string' ? report : JSON.stringify(report, null, 2)], {
        type: format === 'html' ? 'text/html' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incident_${truncateId(selectedIncident.id, 8)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report Exported', `Downloaded incident dossier in ${format.toUpperCase()}.`);
    } catch (err: any) {
      toast.error('Export Error', err.message);
    } finally {
      setExportingReport(false);
    }
  };

  // Summary counts
  const criticalCount = incidents.filter((i) => i.severity === 'CRITICAL').length;
  const highCount = incidents.filter((i) => i.severity === 'HIGH').length;
  const mediumCount = incidents.filter((i) => i.severity === 'MEDIUM' || i.severity === 'LOW').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  const getTypeFromIncident = (inc: Incident): string => {
    const text = `${inc.title} ${inc.description}`.toLowerCase();
    if (text.includes('injection') || text.includes('jailbreak')) return 'PROMPT_INJECTION';
    if (text.includes('traversal') || text.includes('path') || text.includes('etc/passwd')) return 'PATH_TRAVERSAL';
    if (text.includes('ssrf') || text.includes('metadata')) return 'SSRF_ATTEMPT';
    if (text.includes('exfiltration') || text.includes('leak') || text.includes('dump')) return 'DATA_EXFILTRATION';
    if (text.includes('policy') || text.includes('denied')) return 'POLICY_VIOLATION';
    return 'SECURITY_ANOMALY';
  };

  const severityOrder: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  // Filtered and sorted incidents
  const filteredIncidents = useMemo(() => {
    return incidents
      .filter((inc) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          const matches =
            inc.title?.toLowerCase().includes(q) ||
            inc.description?.toLowerCase().includes(q) ||
            inc.id?.toLowerCase().includes(q) ||
            inc.agent_id?.toLowerCase().includes(q) ||
            getTypeFromIncident(inc).toLowerCase().includes(q);
          if (!matches) return false;
        }
        if (severityFilter && inc.severity !== severityFilter) return false;
        if (statusFilter && inc.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const sA = severityOrder[a.severity] || 0;
          const sB = severityOrder[b.severity] || 0;
          return sortOrder === 'asc' ? sA - sB : sB - sA;
        }
        if (sortBy === 'title') {
          const comp = a.title.localeCompare(b.title);
          return sortOrder === 'asc' ? comp : -comp;
        }
        const tA = new Date(a.created_at).getTime();
        const tB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? tA - tB : tB - tA;
      });
  }, [incidents, search, severityFilter, statusFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Security Incidents
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Investigate and manage security events and threat containment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchIncidents}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip: Compact Elements */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#FCD2D2] bg-[#FEF2F2] p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#DC2626]">Critical Severity</div>
          <div className="mt-1.5 text-2xl font-bold text-[#DC2626]">{criticalCount}</div>
          <div className="text-[11px] text-[#DC2626] mt-0.5">Immediate intervention required</div>
        </div>

        <div className="rounded-xl border border-[#FDE3B7] bg-[#FFF4E5] p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#D97706]">High Risk</div>
          <div className="mt-1.5 text-2xl font-bold text-[#D97706]">{highCount}</div>
          <div className="text-[11px] text-[#D97706] mt-0.5">Policy violations & breaches</div>
        </div>

        <div className="rounded-xl border border-[#D4E5FF] bg-[#EEF4FF] p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">Medium / Low</div>
          <div className="mt-1.5 text-2xl font-bold text-[#2563EB]">{mediumCount}</div>
          <div className="text-[11px] text-[#2563EB] mt-0.5">Monitored anomalies</div>
        </div>

        <div className="rounded-xl border border-[#BCE8CD] bg-[#E8F7EF] p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#16A34A]">Resolved</div>
          <div className="mt-1.5 text-2xl font-bold text-[#16A34A]">{resolvedCount}</div>
          <div className="text-[11px] text-[#16A34A] mt-0.5">Closed investigations</div>
        </div>
      </div>

      {/* Toolbar: Search, Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E5EAF1] shadow-2xs">
        <div className="flex-1 sm:max-w-md">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by title, description, type, or agent ID..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#E5EAF1] bg-white px-3 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="CONTAINED">Contained</option>
            <option value="RESOLVED">Resolved</option>
            <option value="FALSE_POSITIVE">False Positive</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-[#E5EAF1] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="created_at">Timestamp</option>
            <option value="severity">Severity</option>
            <option value="title">Title</option>
          </select>

          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded-lg border border-[#E5EAF1] bg-white text-[#64748B] hover:text-[#1E293B]"
            title={`Sort order: ${sortOrder}`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Incident Table */}
      <div className="rounded-xl border border-[#E5EAF1] bg-white overflow-hidden shadow-2xs">
        {loading && incidents.length === 0 ? (
          <LoadingSpinner message="Loading security incidents..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Incident ID</th>
                  <th className="py-3 px-4">Incident Title</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1]">
                {filteredIncidents.length > 0 ? (
                  filteredIncidents.map((inc) => (
                    <tr
                      key={inc.id}
                      onClick={() => handleOpenInvestigate(inc)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                        #{truncateId(inc.id, 8)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1E293B] group-hover:text-[#3B82F6] transition-colors">
                          {inc.title}
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate max-w-sm">
                          {inc.description}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                        {truncateId(inc.agent_id || 'System', 10)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                          {getTypeFromIncident(inc)}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SeverityBadge severity={inc.severity} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={inc.status} />
                      </td>
                      <td className="py-3 px-4 text-[#64748B] whitespace-nowrap">
                        {formatTimestamp(inc.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenInvestigate(inc)}
                          className="px-3 py-1 rounded-md border border-[#E5EAF1] bg-white text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#3B82F6]/50 transition-colors"
                        >
                          Investigate
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#64748B]">
                      No security incidents found matching current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incident Investigation Workspace / Drawer */}
      {selectedIncident && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs select-none"
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="w-full max-w-xl h-full bg-white border-l border-[#E5EAF1] shadow-2xl flex flex-col overflow-hidden animate-slide-left text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5EAF1] p-5 bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#FEF2F2] border border-[#FCD2D2] text-[#DC2626]">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E293B]">{selectedIncident.title}</h2>
                  <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
                    Incident #{truncateId(selectedIncident.id, 12)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#E5EAF1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Status and Severity */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5EAF1] bg-[#F8FAFC]">
                <div className="space-y-1">
                  <span className="text-[11px] text-[#64748B] block">Severity Level</span>
                  <SeverityBadge severity={selectedIncident.severity} />
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-[11px] text-[#64748B] block">Triage Status</span>
                  <StatusBadge status={selectedIncident.status} />
                </div>
              </div>

              {/* Description & Detection */}
              <div>
                <h3 className="font-semibold text-[#1E293B] mb-1.5">Detection & Anomaly Reason</h3>
                <p className="p-3 rounded-xl border border-[#E5EAF1] bg-[#F8FAFC] text-[#1E293B] leading-relaxed">
                  {selectedIncident.description}
                </p>
              </div>

              {/* Affected Entity Information */}
              <div className="rounded-xl border border-[#E5EAF1] p-4 bg-[#F8FAFC] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Affected Agent ID:</span>
                  <span className="font-mono text-[#1E293B]">{selectedIncident.agent_id || 'Global Policy'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Detected At:</span>
                  <span className="text-[#1E293B]">{formatTimestamp(selectedIncident.created_at)}</span>
                </div>
              </div>

              {/* Quick Status Triage Actions */}
              <div>
                <h3 className="font-semibold text-[#1E293B] mb-2">Triage & Containment Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateStatus('INVESTIGATING')}
                    className="p-2.5 rounded-lg border border-[#D4E5FF] bg-[#EEF4FF] text-[#2563EB] font-medium hover:bg-[#E0EDFF] transition-colors"
                  >
                    Mark Investigating
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    className="p-2.5 rounded-lg border border-[#BCE8CD] bg-[#E8F7EF] text-[#16A34A] font-medium hover:bg-[#D9F3E3] transition-colors"
                  >
                    Resolve Incident
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('CONTAINED')}
                    className="p-2.5 rounded-lg border border-[#FCD2D2] bg-[#FEF2F2] text-[#DC2626] font-medium hover:bg-[#FDE2E2] transition-colors"
                  >
                    Contain Agent
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('FALSE_POSITIVE')}
                    className="p-2.5 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] font-medium hover:bg-[#F1F5F9] transition-colors"
                  >
                    False Positive
                  </button>
                </div>
              </div>

              {/* Investigation Notes */}
              <div>
                <h3 className="font-semibold text-[#1E293B] mb-1.5">Investigation Log & Notes</h3>
                <textarea
                  rows={4}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record SOC analyst findings, root cause, and remediation steps..."
                  className="w-full rounded-xl border border-[#E5EAF1] bg-white p-3 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    disabled={updating}
                    className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-xs"
                  >
                    {updating ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>

              {/* Export Dossier */}
              <div className="pt-3 border-t border-[#E5EAF1] flex items-center justify-between">
                <span className="text-[#64748B]">Export Forensic Dossier</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportReport('html')}
                    disabled={exportingReport}
                    className="px-3 py-1.5 rounded-lg border border-[#E5EAF1] bg-white text-[#1E293B] hover:bg-[#F8FAFC] flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5 text-[#3B82F6]" />
                    <span>HTML</span>
                  </button>
                  <button
                    onClick={() => handleExportReport('json')}
                    disabled={exportingReport}
                    className="px-3 py-1.5 rounded-lg border border-[#E5EAF1] bg-white text-[#1E293B] hover:bg-[#F8FAFC] flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5 text-[#3B82F6]" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Containment Confirmation Modal */}
      {containConfirmOpen && (
        <Modal
          isOpen={containConfirmOpen}
          onClose={() => setContainConfirmOpen(false)}
          title="Contain Affected Agent"
          subtitle="Isolate agent identity and revoke network token"
          icon={<Lock className="h-4 w-4 text-[#DC2626]" />}
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-[#FCD2D2] bg-[#FEF2F2] p-3 text-[#DC2626]">
              Warning: Immediate containment will sever agent API connections and blacklist token credentials from the zero-trust gateway.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContainConfirmOpen(false)}
                className="rounded-lg border border-[#E5EAF1] px-4 py-2 text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmContainment}
                className="rounded-lg bg-[#DC2626] px-4 py-2 font-semibold text-white hover:bg-[#B91C1C]"
              >
                Execute Containment
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

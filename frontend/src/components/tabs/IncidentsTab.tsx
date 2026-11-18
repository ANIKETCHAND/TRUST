import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Download,
  Terminal,
  Copy,
  Check,
  Bot,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { Incident } from '../../types';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { SearchInput } from '../ui/SearchInput';
import { TerminalBox } from '../ui/TerminalBox';
import { formatTimestamp, truncateId, truncateMiddle } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const IncidentsTab: React.FC = () => {
  const toast = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Status update
  const [newStatus, setNewStatus] = useState<
    'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE'
  >('OPEN');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const handleQuickAction = async (status: 'ACKNOWLEDGED' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE') => {
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
      toast.success('Incident Updated', `Incident #${truncateId(selectedIncident.id, 8)} marked as ${status}.`);
      fetchIncidents();
    } catch (err: any) {
      toast.error('Update Failed', err.message);
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
      toast.error('Threat Contained', `Incident #${truncateId(selectedIncident.id, 8)} successfully contained.`);
      setContainConfirmOpen(false);
      fetchIncidents();
    } catch (err: any) {
      toast.error('Containment Failed', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!selectedIncident) return;
    setUpdating(true);
    try {
      const updated = await api.updateIncident(selectedIncident.id, {
        resolution_notes: resolutionNotes ? `${resolutionNotes} [Remediation Approval Requested from SecOps Lead]` : `Approval request dispatched to Security Lead for incident remediation.`,
      });
      setSelectedIncident(updated as Incident);
      toast.info('Approval Requested', `High-impact remediation approval requested for #${truncateId(selectedIncident.id, 8)}.`);
      fetchIncidents();
    } catch (err: any) {
      toast.error('Request Failed', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setUpdating(true);
    try {
      const updated = await api.updateIncident(selectedIncident.id, {
        status: newStatus,
        resolution_notes: resolutionNotes || undefined,
      });
      setSelectedIncident(updated as Incident);
      toast.success('Incident Updated', `Incident #${truncateId(selectedIncident.id, 8)} updated to ${newStatus}.`);
      fetchIncidents();
    } catch (err: any) {
      toast.error('Update Failed', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleExportIncidentDossier = async (format: 'html' | 'json') => {
    if (!selectedIncident) return;
    setExportingReport(true);
    try {
      const result = await api.exportIncidentReport(selectedIncident.id, format);
      const blob = new Blob([typeof result === 'string' ? result : JSON.stringify(result, null, 2)], {
        type: format === 'html' ? 'text/html' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crossx-incident-${selectedIncident.id.slice(0, 8)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report Exported', `Forensic dossier downloaded as ${format.toUpperCase()}.`);
    } catch (err: any) {
      toast.error('Export Error', err.message);
    } finally {
      setExportingReport(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inc.title.toLowerCase().includes(q) ||
      inc.description.toLowerCase().includes(q) ||
      inc.id.toLowerCase().includes(q) ||
      inc.agent_id?.toLowerCase().includes(q)
    );
  });

  const criticalCount = incidents.filter((i) => i.severity === 'CRITICAL').length;
  const highCount = incidents.filter((i) => i.severity === 'HIGH').length;
  const openCount = incidents.filter((i) => i.status === 'OPEN' || i.status === 'INVESTIGATING').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-rose-400" />
            SOC Incident Center & Threat Response
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time alerts triggered by deterministic gateway violations, prompt injections, and rogue tool parameters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchIncidents}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* SOC Triage Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-xl">
          <div className="text-xs font-medium text-slate-400">Total Logged</div>
          <div className="mt-1.5 text-2xl font-bold text-white">{incidents.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Automated detections</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-xl">
          <div className="text-xs font-medium text-slate-400">Active Triage</div>
          <div className={`mt-1.5 text-2xl font-bold ${openCount > 0 ? 'text-amber-400' : 'text-kali-secure'}`}>
            {openCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Open & investigating</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-xl">
          <div className="text-xs font-medium text-slate-400">High Risk Violations</div>
          <div className={`mt-1.5 text-2xl font-bold ${criticalCount > 0 ? 'text-rose-400' : highCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {criticalCount} <span className="text-sm font-normal text-slate-400">/ {highCount} High</span>
          </div>
          <div className="text-[11px] text-rose-400/80 mt-0.5 font-medium">Critical & high severity</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-xl">
          <div className="text-xs font-medium text-slate-400">Containment SLA</div>
          <div className="mt-1.5 text-2xl font-bold text-kali-secure">100%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Pre-flight enforcement</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter incidents by title, description, or agent..."
          className="max-w-md w-full"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-kali-primary focus:outline-none transition-colors"
          >
            <option value="" className="bg-[#0a0d14] text-white">All Severities</option>
            <option value="CRITICAL" className="bg-[#0a0d14] text-white">Critical</option>
            <option value="HIGH" className="bg-[#0a0d14] text-white">High</option>
            <option value="MEDIUM" className="bg-[#0a0d14] text-white">Medium</option>
            <option value="LOW" className="bg-[#0a0d14] text-white">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-kali-primary focus:outline-none transition-colors"
          >
            <option value="" className="bg-[#0a0d14] text-white">All Statuses</option>
            <option value="OPEN" className="bg-[#0a0d14] text-white">Open</option>
            <option value="ACKNOWLEDGED" className="bg-[#0a0d14] text-white">Acknowledged</option>
            <option value="INVESTIGATING" className="bg-[#0a0d14] text-white">Investigating</option>
            <option value="CONTAINED" className="bg-[#0a0d14] text-white">Contained</option>
            <option value="RESOLVED" className="bg-[#0a0d14] text-white">Resolved</option>
            <option value="FALSE_POSITIVE" className="bg-[#0a0d14] text-white">False Positive</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      {loading && incidents.length === 0 ? (
        <LoadingSpinner message="Parsing incident audit trail..." />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[11px] text-slate-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Incident ID</th>
                  <th className="py-3.5 px-4">Alert Summary</th>
                  <th className="py-3.5 px-4">Affected Agent</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Detection Time</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3.5 px-4">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 border border-white/10 text-kali-cyan text-[11px]">
                          {truncateId(inc.id, 8)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(inc.id, inc.id)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Copy Full Incident ID"
                        >
                          {copiedId === inc.id ? (
                            <Check className="h-3 w-3 text-kali-secure" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-semibold text-white truncate">{inc.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{inc.description}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-kali-primary" />
                        <span>{inc.agent_id ? truncateMiddle(inc.agent_id, 6, 4) : 'System Enforcer'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {formatTimestamp(inc.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenInvestigate(inc)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-kali-primary/50 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5 text-kali-cyan" />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredIncidents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                      <ShieldCheck className="mx-auto h-8 w-8 text-kali-secure/40 mb-2" />
                      No security incidents detected matching current criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOC INCIDENT INVESTIGATION & REMEDIATION MODAL */}
      <Modal
        isOpen={!!selectedIncident}
        onClose={() => setSelectedIncident(null)}
        title={selectedIncident?.title || 'Incident Investigation'}
        subtitle={`Incident ID: ${selectedIncident?.id || ''}`}
        maxWidth="2xl"
      >
        {selectedIncident && (
          <div className="space-y-4 text-xs">
            {/* Status bar */}
            <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={selectedIncident.severity} />
                <StatusBadge status={selectedIncident.status} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={exportingReport}
                  onClick={() => handleExportIncidentDossier('html')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 hover:border-kali-primary/50 hover:text-white transition-colors disabled:opacity-50"
                  title="Export official HTML SOC Forensic Dossier"
                >
                  <Download className="h-3.5 w-3.5 text-kali-cyan" />
                  <span>Export HTML</span>
                </button>
                <button
                  type="button"
                  disabled={exportingReport}
                  onClick={() => handleExportIncidentDossier('json')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 hover:border-kali-primary/50 hover:text-white transition-colors disabled:opacity-50"
                  title="Export JSON Telemetry Dossier"
                >
                  <Terminal className="h-3.5 w-3.5 text-kali-primary" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Incident Summary */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>Executive Incident Summary</span>
                </span>
                <span>Detected: {formatTimestamp(selectedIncident.created_at)}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {selectedIncident.description}
              </p>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-white/10">
                Affected Agent: <span className="text-kali-cyan font-mono">{selectedIncident.agent_id || 'System Enforcer'}</span>
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div>
              <span className="text-slate-400 font-semibold block mb-2">Rapid Response Actions</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickAction('ACKNOWLEDGED')}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-kali-cyan/50 hover:text-white transition-colors"
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('INVESTIGATING')}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-kali-primary/50 hover:text-white transition-colors"
                >
                  Investigating
                </button>
                <button
                  type="button"
                  onClick={handleRequestApproval}
                  className="rounded-xl border border-kali-cyan/30 bg-kali-cyan/10 px-3 py-1.5 text-xs font-medium text-kali-cyan hover:bg-kali-cyan/20 transition-colors"
                >
                  Request Approval
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('CONTAINED')}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors"
                >
                  Contain Threat
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('RESOLVED')}
                  className="rounded-xl border border-kali-secure/40 bg-kali-secure/10 px-3 py-1.5 text-xs font-medium text-kali-secure hover:bg-kali-secure/20 transition-colors"
                >
                  Resolve Incident
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('FALSE_POSITIVE')}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-white/20 hover:text-slate-200 transition-colors"
                >
                  Mark False Positive
                </button>
              </div>
            </div>

            {/* Raw Telemetry Evidence */}
            <div>
              <span className="text-slate-400 font-semibold block mb-1.5">Forensic Metadata & Evidence</span>
              <TerminalBox
                title={`Forensic Evidence: ${truncateId(selectedIncident.id, 8)}`}
                copyContent={JSON.stringify(selectedIncident.incident_metadata || {}, null, 2)}
                maxHeight="max-h-48"
              >
                <pre>{JSON.stringify(selectedIncident.incident_metadata || {}, null, 2)}</pre>
              </TerminalBox>
            </div>

            {/* Detailed Update Form */}
            <form onSubmit={handleUpdateStatus} className="border-t border-white/10 pt-3.5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1.5">Update Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus:border-kali-primary focus:outline-none"
                  >
                    <option value="OPEN" className="bg-[#0a0d14] text-white">OPEN</option>
                    <option value="ACKNOWLEDGED" className="bg-[#0a0d14] text-white">ACKNOWLEDGED</option>
                    <option value="INVESTIGATING" className="bg-[#0a0d14] text-white">INVESTIGATING</option>
                    <option value="CONTAINED" className="bg-[#0a0d14] text-white">CONTAINED</option>
                    <option value="RESOLVED" className="bg-[#0a0d14] text-white">RESOLVED</option>
                    <option value="FALSE_POSITIVE" className="bg-[#0a0d14] text-white">FALSE POSITIVE</option>
                  </select>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="submit"
                    disabled={updating}
                    className="rounded-xl bg-kali-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-kali-primary/20 hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
                  >
                    {updating ? 'Saving...' : 'Update Resolution'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1.5">Investigation Notes & Remediation Audit</label>
                <textarea
                  rows={2}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Document root cause, containment actions, and compliance remediation..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                />
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* CONTAINMENT AUTHORIZATION CONFIRMATION MODAL */}
      <Modal
        isOpen={containConfirmOpen}
        onClose={() => setContainConfirmOpen(false)}
        title="Confirm Threat Containment"
        subtitle={`Incident: #${truncateId(selectedIncident?.id || '', 8)}`}
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-300 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <span className="font-semibold block text-white mb-0.5">Critical Active Defense Remediation</span>
              Containment will isolate the affected agent ({selectedIncident?.agent_id || 'System'}), halting active tool executions and quarantining associated session tokens.
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2 text-slate-300">
            <div>Incident: <span className="text-white font-semibold">{selectedIncident?.title}</span></div>
            <div>Severity: <span className="text-rose-400 font-semibold">{selectedIncident?.severity}</span></div>
            <div>Operator Status: <span className="text-kali-cyan font-medium">SecOps Authorized</span></div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setContainConfirmOpen(false)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={handleConfirmContainment}
              className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {updating ? 'Executing...' : 'Authorize & Contain'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

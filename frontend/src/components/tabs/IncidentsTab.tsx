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
      a.download = `agenttrust-incident-${selectedIncident.id.slice(0, 8)}.${format}`;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// THREAT_OPERATIONS</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">INCIDENT_CENTER</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <ShieldAlert className="h-6 w-6 text-kali-critical" />
            SOC Incident Center & Threat Response
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated alerts triggered by deterministic gateway violations, indirect prompt injections, and rogue tool parameters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchIncidents}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* SOC Triage Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[INC-01] Total Logged</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">{incidents.length}</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Automated SOC Detections</div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[INC-02] Active Triage</div>
          <div className={`mt-1 font-mono text-2xl font-bold ${openCount > 0 ? 'text-kali-warning' : 'text-kali-secure'}`}>
            {openCount}
          </div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Open & Investigating</div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[INC-03] Critical & High</div>
          <div className={`mt-1 font-mono text-2xl font-bold ${criticalCount > 0 ? 'text-kali-critical' : highCount > 0 ? 'text-kali-warning' : 'text-slate-400'}`}>
            {criticalCount} <span className="text-sm font-normal text-slate-400">/ {highCount} High</span>
          </div>
          <div className="font-mono text-[10px] text-kali-critical mt-0.5">High-Risk Violations</div>
        </div>

        <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
          <div className="font-mono text-[10px] text-slate-400 uppercase">[INC-04] Containment SLA</div>
          <div className="mt-1 font-mono text-2xl font-bold text-kali-secure">100%</div>
          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Deterministic Pre-Flight Drop</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter incidents by title, description, or target agent..."
          className="max-w-md w-full"
        />

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">SEVERITY:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded border border-kali-border bg-kali-bg px-2.5 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none"
          >
            <option value="">ALL SEVERITIES</option>
            <option value="CRITICAL">CRITICAL ONLY</option>
            <option value="HIGH">HIGH ONLY</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <span className="font-mono text-xs text-slate-400 ml-2">STATUS:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-kali-border bg-kali-bg px-2.5 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none"
          >
            <option value="">ALL STATUSES</option>
            <option value="OPEN">OPEN</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="CONTAINED">CONTAINED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="FALSE_POSITIVE">FALSE POSITIVE</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      {loading && incidents.length === 0 ? (
        <LoadingSpinner message="PARSING PERSISTENT INCIDENT AUDIT TRAIL..." />
      ) : (
        <div className="rounded-lg border border-kali-border bg-kali-card overflow-hidden shadow-kali-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-kali-border bg-kali-bg/95 font-mono text-[11px] text-slate-400">
                <tr>
                  <th className="py-3 px-3.5 font-semibold">Severity</th>
                  <th className="py-3 px-3.5 font-semibold">Incident ID</th>
                  <th className="py-3 px-3.5 font-semibold">Alert Summary</th>
                  <th className="py-3 px-3.5 font-semibold">Affected Agent</th>
                  <th className="py-3 px-3.5 font-semibold">Status</th>
                  <th className="py-3 px-3.5 font-semibold">Detection Time</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Triage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border text-slate-300">
                {filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-kali-elevated/40 transition-colors">
                    <td className="py-3 px-3.5">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-kali-bg px-1.5 py-0.5 border border-kali-border text-kali-cyan text-[11px]">
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
                    <td className="py-3 px-3.5 max-w-sm">
                      <div className="font-semibold text-white truncate">{inc.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 font-sans">{inc.description}</div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-kali-primary" />
                        <span>{inc.agent_id ? truncateMiddle(inc.agent_id, 6, 4) : 'SYSTEM_ENFORCER'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-400 text-[11px]">
                      {formatTimestamp(inc.created_at)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono">
                      <button
                        onClick={() => handleOpenInvestigate(inc)}
                        className="inline-flex items-center gap-1 rounded border border-kali-border bg-kali-elevated px-2.5 py-1 text-[11px] text-slate-200 hover:border-kali-primary hover:text-white transition-colors"
                      >
                        <Eye className="h-3 w-3 text-kali-cyan" />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredIncidents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center font-mono text-xs text-slate-500">
                      <ShieldCheck className="mx-auto h-8 w-8 text-kali-secure/40 mb-2" />
                      // ZERO SECURITY INCIDENTS DETECTED MATCHING CURRENT POSTURE CRITERIA
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
        title={`INCIDENT INVESTIGATION // ${selectedIncident?.title || ''}`}
        subtitle={`ID: ${selectedIncident?.id || ''}`}
        maxWidth="2xl"
      >
        {selectedIncident && (
          <div className="space-y-4 font-mono text-xs">
            {/* Status bar */}
            <div className="flex items-center justify-between border-b border-kali-border pb-3">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={selectedIncident.severity} />
                <StatusBadge status={selectedIncident.status} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={exportingReport}
                  onClick={() => handleExportIncidentDossier('html')}
                  className="inline-flex items-center gap-1 rounded border border-kali-border bg-kali-bg px-2.5 py-1 text-[11px] text-slate-200 hover:border-kali-primary hover:text-white transition-colors disabled:opacity-50"
                  title="Export official HTML SOC Forensic Dossier"
                >
                  <Download className="h-3 w-3 text-kali-cyan" />
                  <span>Export HTML</span>
                </button>
                <button
                  type="button"
                  disabled={exportingReport}
                  onClick={() => handleExportIncidentDossier('json')}
                  className="inline-flex items-center gap-1 rounded border border-kali-border bg-kali-bg px-2.5 py-1 text-[11px] text-slate-200 hover:border-kali-primary hover:text-white transition-colors disabled:opacity-50"
                  title="Export JSON Telemetry Dossier"
                >
                  <Terminal className="h-3 w-3 text-kali-primary" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Incident Summary */}
            <div className="rounded border border-kali-border bg-kali-bg p-3.5 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <AlertTriangle className="h-4 w-4 text-kali-warning" />
                  <span>Executive Incident Summary</span>
                </span>
                <span>Detected: {formatTimestamp(selectedIncident.created_at)}</span>
              </div>
              <p className="font-sans text-xs text-slate-200 leading-relaxed">
                {selectedIncident.description}
              </p>
              <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-kali-border/60">
                AFFECTED AGENT ID: <span className="text-kali-cyan">{selectedIncident.agent_id || 'SYSTEM_ENFORCER'}</span>
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div>
              <span className="text-slate-400 font-semibold block mb-1.5">// SOC_RAPID_RESPONSE_ACTIONS:</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickAction('ACKNOWLEDGED')}
                  className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-kali-cyan hover:text-white transition-colors"
                >
                  [1] Acknowledge
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('INVESTIGATING')}
                  className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-kali-primary hover:text-white transition-colors"
                >
                  [2] Set Investigating
                </button>
                <button
                  type="button"
                  onClick={handleRequestApproval}
                  className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-xs font-semibold text-kali-cyan hover:border-kali-cyan transition-colors"
                >
                  [3] Request Approval
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('CONTAINED')}
                  className="rounded border border-kali-critical/60 bg-[#331418] px-3 py-1.5 text-xs font-semibold text-kali-critical hover:bg-[#4a1c22] transition-colors"
                >
                  [4] Contain Threat
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('RESOLVED')}
                  className="rounded border border-kali-secure/60 bg-[#0E2E22] px-3 py-1.5 text-xs font-semibold text-kali-secure hover:bg-[#154634] transition-colors"
                >
                  [5] Resolve Incident
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAction('FALSE_POSITIVE')}
                  className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
                >
                  [6] Mark False Positive
                </button>
              </div>
            </div>

            {/* Raw Telemetry Evidence */}
            <div>
              <span className="text-slate-400 font-semibold block mb-1.5">// FORENSIC_METADATA_EVIDENCE:</span>
              <TerminalBox
                title={`FORENSIC EVIDENCE // ${truncateId(selectedIncident.id, 8)}`}
                copyContent={JSON.stringify(selectedIncident.incident_metadata || {}, null, 2)}
                maxHeight="max-h-48"
              >
                <pre>{JSON.stringify(selectedIncident.incident_metadata || {}, null, 2)}</pre>
              </TerminalBox>
            </div>

            {/* Detailed Update Form */}
            <form onSubmit={handleUpdateStatus} className="border-t border-kali-border pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Target Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-white focus:border-kali-primary focus:outline-none"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                    <option value="INVESTIGATING">INVESTIGATING</option>
                    <option value="CONTAINED">CONTAINED</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="FALSE_POSITIVE">FALSE POSITIVE</option>
                  </select>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="submit"
                    disabled={updating}
                    className="rounded bg-kali-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
                  >
                    {updating ? 'Saving...' : 'Update Resolution'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Investigation Notes & Remediation Audit</label>
                <textarea
                  rows={2}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Document root cause, containment actions, and compliance remediation..."
                  className="w-full rounded border border-kali-border bg-kali-bg px-3 py-2 text-white focus:border-kali-primary focus:outline-none font-sans"
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
        title="CONFIRM THREAT CONTAINMENT"
        subtitle={`INCIDENT: #${truncateId(selectedIncident?.id || '', 8)}`}
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="rounded border border-kali-critical/60 bg-[#331418] p-3 text-kali-critical flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">CRITICAL ACTIVE DEFENSE REMEDIATION:</span>
              Containment will isolate the affected agent ({selectedIncident?.agent_id || 'System'}), halting active tool executions and quarantining associated session tokens.
            </div>
          </div>

          <div className="rounded border border-kali-border bg-kali-bg p-3 space-y-1.5 text-slate-300">
            <div>Incident: <span className="text-white font-bold">{selectedIncident?.title}</span></div>
            <div>Severity: <span className="text-kali-critical font-bold">{selectedIncident?.severity}</span></div>
            <div>Operator: <span className="text-kali-cyan font-bold">SOC_OPERATOR_VERIFIED</span></div>
          </div>

          <div className="flex justify-end gap-2 border-t border-kali-border pt-3">
            <button
              type="button"
              onClick={() => setContainConfirmOpen(false)}
              className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={handleConfirmContainment}
              className="rounded bg-kali-critical px-4 py-1.5 font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
            >
              {updating ? 'Executing...' : 'Authorize & Contain'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

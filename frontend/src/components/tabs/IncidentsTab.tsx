import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Filter, RefreshCw, Eye, ShieldCheck, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api.client';
import type { Incident } from '../../types';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatTimestamp, truncateMiddle } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const IncidentsTab: React.FC = () => {
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Status update
  const [newStatus, setNewStatus] = useState<'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE'>('OPEN');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listIncidents({
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
      });
      setIncidents(res as Incident[]);
    } catch (err: any) {
      showToast(err.message || 'Failed to load security incidents', 'error');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleOpenInvestigate = (inc: Incident) => {
    setSelectedIncident(inc);
    setNewStatus((inc.status as any) || 'OPEN');
    setResolutionNotes(inc.resolution_notes || '');
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
      showToast(`Incident #${selectedIncident.id.slice(0, 8)} updated to ${newStatus}`, 'success');
      fetchIncidents();
    } catch (err: any) {
      showToast(`Failed to update incident: ${err.message}`, 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-rose-400" />
            Security Alerts & Incident Management
          </h1>
          <p className="text-sm text-slate-400">
            Automated alerts generated from blocked tool requests, policy violations, and suspicious indirect injection patterns.
          </p>
        </div>
        <button
          onClick={fetchIncidents}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Incidents
        </button>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          aria-label="Filter by severity"
          className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open Only</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="CONTAINED">Contained</option>
          <option value="RESOLVED">Resolved</option>
          <option value="FALSE_POSITIVE">False Positive</option>
        </select>
      </div>

      {/* Incidents Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur overflow-hidden">
        {loading && incidents.length === 0 ? (
          <div className="py-12">
            <LoadingSpinner message="Scanning security incident log..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Severity</th>
                  <th className="py-3 px-4 font-semibold">Incident Title</th>
                  <th className="py-3 px-4 font-semibold">Target Agent</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Reported At</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="py-3 px-4 font-medium text-white max-w-[280px]">
                      <div>{inc.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{inc.description}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {inc.agent_id ? truncateMiddle(inc.agent_id, 6, 4) : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {formatTimestamp(inc.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenInvestigate(inc)}
                        className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                      >
                        <Eye className="inline h-3 w-3 mr-1" />
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500/40 mb-2" />
                      Zero security incidents recorded. System running with no active violations.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incident Investigation Modal */}
      <Modal
        isOpen={!!selectedIncident}
        onClose={() => setSelectedIncident(null)}
        title={selectedIncident?.title || 'Security Incident'}
        subtitle={`Incident ID: ${selectedIncident?.id || ''}`}
        size="lg"
      >
        {selectedIncident && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={selectedIncident.severity} />
              <StatusBadge status={selectedIncident.status} />
              <span className="text-slate-400 font-mono text-[11px]">
                Reported {formatTimestamp(selectedIncident.created_at)}
              </span>
            </div>

            <div className="rounded bg-slate-950 p-3 text-slate-300 border border-slate-800">
              <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                Incident Summary:
              </span>
              <p className="mt-1 text-slate-200">{selectedIncident.description}</p>
            </div>

            <div>
              <span className="font-semibold text-slate-400">Telemetry Payload / Forensic Metadata:</span>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-950 p-3 font-mono text-[11px] text-cyan-300 border border-slate-800">
                {JSON.stringify(selectedIncident.incident_metadata || {}, null, 2)}
              </pre>
            </div>

            {/* Status Update Form */}
            <form onSubmit={handleUpdateStatus} className="border-t border-slate-800 pt-3 space-y-3">
              <div>
                <label className="font-semibold text-slate-300">Resolution Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  aria-label="Resolution status"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="CONTAINED">CONTAINED</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-300">Resolution Notes & Forensic Assessment</label>
                <textarea
                  rows={2}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Document root cause and remediation steps taken..."
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Update Resolution'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
};

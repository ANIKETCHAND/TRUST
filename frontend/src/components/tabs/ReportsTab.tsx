import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Shield,
  ShieldAlert,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  Code,
  RefreshCw,
} from 'lucide-react';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';
import { api } from '../../services/api.client';

interface ExecutiveSummary {
  posture_score: number;
  posture_status: string;
  total_inspected_actions: number;
  blocked_violations: number;
  authorized_actions: number;
  blocked_ratio_percent: number;
  guardrails_active: string[];
  active_defense_status: {
    process_killer_ready: boolean;
    perimeter_sinkholes_active: number;
    firewall_containment: string;
  };
  recommendations: string[];
  generated_at: string;
}

interface IncidentItem {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

export const ReportsTab: React.FC = () => {
  const { refreshTrigger } = useSecurityPlatform();
  const toast = useToast();

  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [reportPreviewHtml, setReportPreviewHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, incList] = await Promise.all([
        api.getExecutiveSummary().catch(() => null),
        api.listIncidents().catch(() => []),
      ]);

      if (sumData) setSummary(sumData);
      setIncidents(incList);
      if (incList.length > 0) {
        setSelectedIncidentId(incList[0].id);
      } else {
        setSelectedIncidentId('');
        setReportPreviewHtml('');
      }
    } catch (err: any) {
      console.error('Failed to load reports telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateReportPreview = async (incidentId: string) => {
    if (!incidentId) return;
    try {
      setGenerating(true);
      const html = await api.exportIncidentReport(incidentId, 'html');
      setReportPreviewHtml(html as string);
    } catch (err: any) {
      console.error('Failed to generate HTML dossier:', err);
      setReportPreviewHtml('');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedIncidentId) {
      generateReportPreview(selectedIncidentId);
    }
  }, [selectedIncidentId]);

  const handleExport = async (format: 'html' | 'json' | 'csv') => {
    if (!selectedIncidentId) {
      toast.error('No Incident Selected', 'Please select a valid incident to export.');
      return;
    }
    try {
      const data = await api.exportIncidentReport(selectedIncidentId, format);
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/html',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crossx_incident_${selectedIncidentId}_forensics.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Report Downloaded', `Dossier exported in ${format.toUpperCase()} format.`);
    } catch (err: any) {
      toast.error('Export Failed', err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-kali-cyan" />
            Forensics & Threat Reports
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated MITRE ATT&CK framework mapping, timeline reconstruction, and executive compliance dossiers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Posture Score"
          value={summary ? `${summary.posture_score}/100` : '100/100'}
          icon={<Shield className="h-4 w-4" />}
          subValue={summary?.posture_status || 'STRONG'}
          subValueColor="text-kali-secure"
          description="Overall defensive posture rating"
        />
        <StatCard
          label="Blocked Violations"
          value={summary?.blocked_violations ?? 0}
          icon={<ShieldAlert className="h-4 w-4 text-kali-critical" />}
          subValue="Pre-Flight"
          subValueColor="text-rose-400"
          description="Unauthorized tool invocations"
        />
        <StatCard
          label="Guardrails Active"
          value={summary?.guardrails_active.length ?? 3}
          icon={<Layers className="h-4 w-4 text-kali-cyan" />}
          subValue="3-Tier Pipeline"
          subValueColor="text-kali-cyan"
          description="NeMo, Regex, Heuristic Checks"
        />
        <StatCard
          label="Sinkholes Active"
          value={summary?.active_defense_status.perimeter_sinkholes_active ?? 0}
          icon={<CheckCircle2 className="h-4 w-4 text-kali-secure" />}
          subValue="Firewall Rules"
          subValueColor="text-kali-secure"
          description="Quarantined perimeter nodes"
        />
      </div>

      {/* Incident Selection & Export Actions */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white block">Select Incident Dossier</label>
            <select
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white focus:border-kali-primary focus:outline-none min-w-[280px]"
            >
              {incidents.length === 0 ? (
                <option value="" className="bg-[#0a0d14] text-white">No incidents recorded</option>
              ) : (
                incidents.map((inc) => (
                  <option key={inc.id} value={inc.id} className="bg-[#0a0d14] text-white">
                    {inc.id.slice(0, 12)} • {inc.title} ({inc.severity})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExport('html')}
              disabled={!selectedIncidentId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-kali-primary px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-kali-primary/20 hover:bg-kali-secondaryBlue transition-colors disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export HTML</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={!selectedIncidentId}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-kali-primary/50 hover:text-white transition-colors disabled:opacity-40"
            >
              <Code className="h-3.5 w-3.5 text-kali-primary" />
              <span>JSON</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={!selectedIncidentId}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-kali-secure/50 hover:text-white transition-colors disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-kali-secure" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Live HTML Dossier Render Sandbox */}
        <div className="rounded-xl border border-white/10 overflow-hidden bg-black/60">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02] text-xs text-slate-400 font-medium">
            <span>Dossier Live Preview: {selectedIncidentId ? `${selectedIncidentId.slice(0, 16)}...` : 'No Incident Selected'}</span>
            {generating && <span className="text-kali-cyan animate-pulse">Rendering Dossier...</span>}
          </div>

          <div className="p-1 max-h-[600px] overflow-y-auto bg-black">
            {reportPreviewHtml ? (
              <iframe
                title="Incident Report Preview"
                srcDoc={reportPreviewHtml}
                className="w-full h-[580px] border-none rounded bg-transparent"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="py-20 text-center text-slate-500 text-xs">
                {incidents.length === 0
                  ? 'No active security incidents detected. System is clean.'
                  : 'Select an incident dossier above to render the forensic report.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Frameworks & Recommendations */}
      {summary && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-3.5 text-xs">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <CheckCircle2 className="h-4 w-4 text-kali-secure" />
            <span>Posture Assessment & Recommendations</span>
          </h2>
          <ul className="space-y-2.5 text-slate-300 text-xs">
            {summary.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-kali-cyan/10 border border-kali-cyan/20 text-[10px] font-semibold text-kali-cyan">
                  {idx + 1}
                </span>
                <span className="leading-relaxed mt-0.5">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

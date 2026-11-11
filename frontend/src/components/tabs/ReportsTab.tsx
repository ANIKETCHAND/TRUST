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
      a.download = `agenttrust_incident_${selectedIncidentId}_forensics.${format}`;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// THREAT_OPERATIONS</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">FORENSICS_AND_REPORTS</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <FileText className="h-6 w-6 text-kali-primary" />
            Forensic Incident Dossier & Executive Compliance Reports
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated MITRE ATT&CK framework mapping, microsecond timeline reconstruction, and publication-ready SOC incident reporting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC DOSSIER</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          tag="REP-01"
          label="Posture Score"
          value={summary ? `${summary.posture_score}/100` : '100/100'}
          icon={<Shield className="h-4 w-4" />}
          subValue={summary?.posture_status || 'STRONG'}
          subValueColor="text-kali-secure"
          description="Overall defensive posture rating"
        />
        <StatCard
          tag="REP-02"
          label="Blocked Violations"
          value={summary?.blocked_violations ?? 0}
          icon={<ShieldAlert className="h-4 w-4 text-kali-critical" />}
          subValue="Pre-Flight"
          subValueColor="text-kali-critical"
          description="Unauthorized tool invocations"
        />
        <StatCard
          tag="REP-03"
          label="Guardrails Active"
          value={summary?.guardrails_active.length ?? 3}
          icon={<Layers className="h-4 w-4 text-kali-cyan" />}
          subValue="3-Tier Pipeline"
          subValueColor="text-kali-cyan"
          description="NeMo, Regex, Heuristic Checks"
        />
        <StatCard
          tag="REP-04"
          label="Sinkholes Active"
          value={summary?.active_defense_status.perimeter_sinkholes_active ?? 0}
          icon={<CheckCircle2 className="h-4 w-4 text-kali-secure" />}
          subValue="Firewall Rules"
          subValueColor="text-kali-secure"
          description="Quarantined perimeter nodes"
        />
      </div>

      {/* Incident Selection & Export Actions */}
      <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-kali-border pb-3">
          <div className="space-y-1">
            <label className="font-bold text-white block">// SELECT_INCIDENT_DOSSIER:</label>
            <select
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              className="rounded border border-kali-border bg-kali-bg px-3 py-1.5 font-mono text-xs text-white focus:border-kali-primary focus:outline-none min-w-[280px]"
            >
              {incidents.length === 0 ? (
                <option value="">No incidents recorded</option>
              ) : (
                incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.id.slice(0, 12)} • {inc.title} ({inc.severity})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('html')}
              disabled={!selectedIncidentId}
              className="inline-flex items-center gap-1.5 rounded bg-kali-primary px-3 py-1.5 font-mono text-xs font-bold text-white shadow-kali-glow hover:bg-kali-secondaryBlue transition-colors disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export HTML / PDF</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={!selectedIncidentId}
              className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-bg px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:text-white transition-colors disabled:opacity-40"
            >
              <Code className="h-3.5 w-3.5 text-kali-primary" />
              <span>JSON</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={!selectedIncidentId}
              className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-bg px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-secure hover:text-white transition-colors disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-kali-secure" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Live HTML Dossier Render Sandbox */}
        <div className="rounded border border-kali-border overflow-hidden bg-kali-bg">
          <div className="flex items-center justify-between px-4 py-2 border-b border-kali-border bg-kali-secondary text-xs text-slate-400">
            <span className="font-mono">FORENSIC REPORT PREVIEW // {selectedIncidentId || 'NO_INCIDENT_SELECTED'}</span>
            {generating && <span className="text-kali-cyan animate-pulse">Rendering Dossier...</span>}
          </div>

          <div className="p-1 max-h-[600px] overflow-y-auto bg-[#070A0F]">
            {reportPreviewHtml ? (
              <iframe
                title="Incident Report Preview"
                srcDoc={reportPreviewHtml}
                className="w-full h-[580px] border-none rounded bg-transparent"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="py-20 text-center text-slate-500 font-mono text-xs">
                {incidents.length === 0
                  ? '// NO ACTIVE SECURITY INCIDENTS. ZERO ROGUE TOOL ACTIVITY DETECTED.'
                  : '// SELECT AN INCIDENT DOSSIER ABOVE TO PREVIEW COMPLIANCE REPORT.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Frameworks & Recommendations */}
      {summary && (
        <div className="rounded-lg border border-kali-border bg-kali-card p-5 shadow-kali-card space-y-3 font-mono text-xs">
          <h2 className="text-xs font-bold text-white flex items-center gap-2 border-b border-kali-border pb-2.5">
            <CheckCircle2 className="h-4 w-4 text-kali-secure" />
            <span>// POSTURE_ASSESSMENT_AND_REMEDIATION_RECOMMENDATIONS</span>
          </h2>
          <ul className="space-y-2 text-slate-300 font-sans text-xs">
            {summary.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-kali-cyan font-bold font-mono">[{idx + 1}]</span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

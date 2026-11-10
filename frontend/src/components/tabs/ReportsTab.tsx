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
  const { showToast } = useToast();

  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('sample-incident-001');
  const [reportPreviewHtml, setReportPreviewHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, incRes] = await Promise.all([
        fetch('/api/v1/reports/executive-summary'),
        fetch('/api/v1/audit/incidents'),
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (incRes.ok) {
        const incList = await incRes.json();
        setIncidents(incList);
        if (incList.length > 0) {
          setSelectedIncidentId(incList[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateReportPreview = async (incidentId: string) => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/v1/reports/incident/${incidentId}/export?format=html`, {
        method: 'POST',
      });
      if (res.ok) {
        const html = await res.text();
        setReportPreviewHtml(html);
      }
    } catch (err: any) {
      console.error('Failed to generate HTML dossier:', err);
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
    try {
      const res = await fetch(`/api/v1/reports/incident/${selectedIncidentId}/export?format=${format}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Export request failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agenttrust_incident_${selectedIncidentId}_forensics.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast('success', 'Report Downloaded', `Dossier exported in ${format.toUpperCase()} format.`);
    } catch (err: any) {
      showToast('error', 'Export Failed', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-cyan-400" />
            Forensic Incident Dossier & Executive Compliance Exporter
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated MITRE ATT&CK framework mapping, microsecond timeline reconstruction, and publication-ready SOC incident reporting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Posture Score"
          value={summary ? `${summary.posture_score} / 100` : '100 / 100'}
          icon={<Shield className="h-5 w-5 text-cyan-400" />}
          subValue={summary?.posture_status || 'STRONG'}
        />
        <StatCard
          label="Blocked Violations"
          value={summary?.blocked_violations ?? 0}
          icon={<ShieldAlert className="h-5 w-5 text-red-400" />}
        />
        <StatCard
          label="Guardrails Active"
          value={summary?.guardrails_active.length ?? 3}
          icon={<Layers className="h-5 w-5 text-cyan-400" />}
          subValue="3-Tier NeMo Pipeline"
        />
        <StatCard
          label="Sinkholes Active"
          value={summary?.active_defense_status.perimeter_sinkholes_active ?? 0}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
        />
      </div>

      {/* Incident Selection & Export Actions */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Select Incident Dossier to Inspect:</label>
            <select
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="incident-demo-prompt-injection">DEMO: Critical Prompt Injection & Subprocess Spawn</option>
              {incidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.id.slice(0, 16)} &bull; {inc.title} ({inc.severity})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('html')}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 text-xs font-semibold shadow transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download HTML / PDF
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <Code className="h-3.5 w-3.5 text-cyan-400" />
              JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              CSV
            </button>
          </div>
        </div>

        {/* Live HTML Dossier Render Sandbox */}
        <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-900/50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900 text-xs text-slate-400">
            <span className="font-mono">FORENSIC REPORT PREVIEW ({selectedIncidentId})</span>
            {generating && <span className="text-cyan-400 animate-pulse">Rendering Dossier...</span>}
          </div>

          <div className="p-1 max-h-[600px] overflow-y-auto bg-slate-950">
            {reportPreviewHtml ? (
              <iframe
                title="Incident Report Preview"
                srcDoc={reportPreviewHtml}
                className="w-full h-[580px] border-none rounded bg-transparent"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs">
                Generating forensic dossier...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Frameworks & Recommendations */}
      {summary && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Autonomous Posture & Executive Remediation Recommendations
          </h2>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {summary.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

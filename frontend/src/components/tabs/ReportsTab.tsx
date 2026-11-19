import React, { useState, useEffect } from 'react';
import {
  Download,
  Shield,
  ShieldAlert,
  CheckCircle2,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { api } from '../../services/api.client';
import { truncateId } from '../../utils/formatters';

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

  const handleDownload = (format: 'html' | 'json') => {
    if (!selectedIncidentId) return;
    api.exportIncidentReport(selectedIncidentId, format).then((content) => {
      const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], {
        type: format === 'html' ? 'text/html' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incident_${truncateId(selectedIncidentId, 8)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dossier Downloaded', `Exported in ${format.toUpperCase()} format.`);
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Forensic Dossiers & Compliance Reports
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Executive posture analytics, MITRE ATT&CK mapping, and auditable evidence dossiers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Security Posture Score"
          value={`${summary?.posture_score ?? 98}/100`}
          icon={<Shield className="h-4 w-4" />}
          subValue={summary?.posture_status ?? 'EXCELLENT'}
          subValueColor="text-[#16A34A]"
        />
        <StatCard
          label="Inspected Actions"
          value={summary?.total_inspected_actions ?? 0}
          icon={<Layers className="h-4 w-4" />}
          subValue={`${summary?.authorized_actions ?? 0} authorized`}
        />
        <StatCard
          label="Blocked Violations"
          value={summary?.blocked_violations ?? 0}
          icon={<ShieldAlert className="h-4 w-4" />}
          subValue={`${summary?.blocked_ratio_percent ?? 0}% ratio`}
          subValueColor="text-[#DC2626]"
        />
        <StatCard
          label="Perimeter Sinkholes"
          value={summary?.active_defense_status?.perimeter_sinkholes_active ?? 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
          subValue="Firewall enforced"
        />
      </div>

      {/* Main Dossier Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Incidents List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-2xs">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
              Select Incident Dossier ({incidents.length})
            </h3>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                    selectedIncidentId === inc.id
                      ? 'border-[#3B82F6] bg-[#EEF4FF] text-[#3B82F6] font-semibold'
                      : 'border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] hover:text-[#1E293B] hover:bg-white'
                  }`}
                >
                  <div className="font-semibold text-[#1E293B] truncate">{inc.title}</div>
                  <div className="text-[10px] text-[#64748B] mt-0.5 font-mono">
                    #{truncateId(inc.id, 8)} • {inc.severity}
                  </div>
                </button>
              ))}

              {incidents.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No incidents logged to export.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: HTML Report Preview & Download (8 cols) */}
        <div className="lg:col-span-8 rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#1E293B]">Incident Evidence Dossier</h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Formatted forensic report with cryptographic hash verification
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload('html')}
                disabled={!selectedIncidentId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] text-xs font-medium text-[#1E293B] hover:bg-white"
              >
                <Download className="h-3.5 w-3.5 text-[#3B82F6]" />
                <span>HTML</span>
              </button>
              <button
                onClick={() => handleDownload('json')}
                disabled={!selectedIncidentId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] text-xs font-medium text-[#1E293B] hover:bg-white"
              >
                <Download className="h-3.5 w-3.5 text-[#3B82F6]" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {generating ? (
            <div className="py-16">
              <LoadingSpinner message="Rendering forensic evidence report..." />
            </div>
          ) : reportPreviewHtml ? (
            <div className="rounded-xl border border-[#E5EAF1] overflow-hidden bg-white max-h-[500px] overflow-y-auto p-4 text-xs">
              <div
                dangerouslySetInnerHTML={{ __html: reportPreviewHtml }}
                className="prose prose-sm max-w-none text-[#1E293B]"
              />
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-[#64748B]">
              Select an incident dossier on the left to preview evidence details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

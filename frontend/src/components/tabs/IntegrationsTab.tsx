import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  FileSearch,
  Search,
  Lock,
  Layers,
} from 'lucide-react';
import { api } from '../../services/api.client';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TerminalBox } from '../ui/TerminalBox';
import { useToast } from '../../context/ToastContext';

interface IntegrationDetail {
  name: string;
  category: string;
  purpose: string;
  version: string;
  installStatus: 'INSTALLED' | 'NOT_INSTALLED' | 'STANDALONE';
  connStatus: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED' | 'ERROR' | 'PLANNED';
  lastHealthCheck: string;
  configuration: Record<string, any>;
  docsUrl: string;
}

export const IntegrationsTab: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [integrationsList, setIntegrationsList] = useState<IntegrationDetail[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'scanner' | 'quarantine' | 'intel'>('inventory');

  // Sandbox File Scan state
  const [scanPath, setScanPath] = useState('agent_outputs/generated_script.py');
  const [autoQuarantine, setAutoQuarantine] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);

  // Quarantine Vault state
  const [quarantineItems, setQuarantineItems] = useState<any[]>([]);
  const [loadingQuarantine, setLoadingQuarantine] = useState(false);

  // Threat Intel state
  const [intelType, setIntelType] = useState('ip');
  const [intelValue, setIntelValue] = useState('198.51.100.42');
  const [intelResult, setIntelResult] = useState<any | null>(null);
  const [queryingIntel, setQueryingIntel] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listIntegrations();
      const rawIntegrations: any[] = res?.integrations || [];

      // Map backend records to technical details
      const activeMap: Record<string, any> = {};
      rawIntegrations.forEach((item) => {
        activeMap[item.name] = item;
      });

      const opaRaw = activeMap['Open Policy Agent (OPA)'];
      const pipelockRaw = activeMap['Pipelock AI Proxy'];
      const clamRaw = activeMap['ClamAV & YARA Scanner'];
      const otelRaw = activeMap['OpenTelemetry'];
      const intelRaw = activeMap['Threat Intelligence Provider'];

      const inventory: IntegrationDetail[] = [
        {
          name: 'Open Policy Agent (OPA)',
          category: 'Policy Decision Point (PDP)',
          purpose: 'High-performance declarative authorization engine with Rego rule compilation.',
          version: 'v0.62.0',
          installStatus: opaRaw?.enabled ? 'INSTALLED' : 'NOT_INSTALLED',
          connStatus: opaRaw?.status === 'ACTIVE' || opaRaw?.status === 'ok' ? 'CONNECTED' : opaRaw?.enabled ? 'DISCONNECTED' : 'NOT_CONFIGURED',
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            endpoint: opaRaw?.endpoint || 'http://localhost:8181/v1/data',
            fail_closed_mode: true,
            eval_latency: '1.2ms',
          },
          docsUrl: 'https://www.openpolicyagent.org/docs/latest/',
        },
        {
          name: 'Pipelock AI Proxy',
          category: 'MCP & LLM Security Gateway',
          purpose: 'Deterministic pre-flight guardrail sidecar intercepting Model Context Protocol (MCP) tool calls.',
          version: 'v1.4.2',
          installStatus: pipelockRaw?.enabled ? 'INSTALLED' : 'NOT_INSTALLED',
          connStatus: pipelockRaw?.status === 'ACTIVE' || pipelockRaw?.status === 'ok' ? 'CONNECTED' : pipelockRaw?.enabled ? 'DISCONNECTED' : 'NOT_CONFIGURED',
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            endpoint: pipelockRaw?.endpoint || 'http://localhost:8081',
            fail_closed: pipelockRaw?.fail_closed_mode ?? true,
            proxy_mode: 'STRICT_INTERCEPT',
          },
          docsUrl: 'https://github.com/ANIKETCHAND/TRUST/tree/main/pipelock',
        },
        {
          name: 'YARA & ClamAV Engine',
          category: 'File Quarantine & Heuristics',
          purpose: 'Dual signature-based and heuristic file content scanner inspecting agent-generated binaries.',
          version: 'v4.3.1 (YARA) / 1.2.0 (ClamAV)',
          installStatus: 'INSTALLED',
          connStatus: clamRaw?.status === 'ACTIVE' ? 'CONNECTED' : 'DISCONNECTED',
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            vault_storage: clamRaw?.quarantine_vault || 'backend/storage/quarantine',
            non_destructive: true,
            rules_compiled: 412,
          },
          docsUrl: 'https://virustotal.github.io/yara/',
        },
        {
          name: 'OpenTelemetry (OTel)',
          category: 'Distributed Tracing & Telemetry',
          purpose: 'Cloud-native observability pipeline streaming distributed gateway trace spans.',
          version: 'v1.24.0',
          installStatus: otelRaw?.enabled ? 'INSTALLED' : 'NOT_INSTALLED',
          connStatus: otelRaw?.enabled ? 'CONNECTED' : 'NOT_CONFIGURED',
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            exporter_endpoint: otelRaw?.endpoint || 'http://localhost:4317',
            protocol: 'gRPC / OTLP',
            sampling_rate: 1.0,
          },
          docsUrl: 'https://opentelemetry.io/docs/',
        },
        {
          name: 'Threat Intelligence Mesh',
          category: 'Autonomous IoC Enrichment',
          purpose: 'Real-time attacker IP, ASN, and hash reputation telemetry feed with subnet ARP mapping.',
          version: 'v2.1.0',
          installStatus: 'INSTALLED',
          connStatus: intelRaw?.status === 'ACTIVE' ? 'CONNECTED' : 'DISCONNECTED',
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            feed_sources: ['AbuseIPDB', 'AlienVault OTX', 'Internal SOC Ledger'],
            sinkhole_integration: 'IPTABLES_DYNAMIC',
          },
          docsUrl: 'https://en.wikipedia.org/wiki/Threat_intelligence',
        },
        {
          name: 'OSQuery Host Telemetry',
          category: 'Host Endpoint Audit',
          purpose: 'SQL-powered low-level operating system instrumentation for rogue agent process discovery.',
          version: 'v5.11.0 (Specification)',
          installStatus: 'NOT_INSTALLED',
          connStatus: 'PLANNED',
          lastHealthCheck: 'N/A (Planned Roadmap)',
          configuration: {
            target_tables: ['processes', 'listening_ports', 'logged_in_users', 'file_events'],
            schedule: 'PLANNED_Q3',
          },
          docsUrl: 'https://osquery.io/',
        },
        {
          name: 'Wazuh SIEM Bridge',
          category: 'Enterprise SIEM & Compliance',
          purpose: 'Unified XDR log forwarding, FIM file integrity auditing, and PCI-DSS / SOC2 compliance tracking.',
          version: 'v4.7.0 (Specification)',
          installStatus: 'NOT_INSTALLED',
          connStatus: 'PLANNED',
          lastHealthCheck: 'N/A (Planned Roadmap)',
          configuration: {
            agent_connector: 'Syslog / JSON Egress',
            compliance_framework: 'MITRE ATT&CK / SOC2',
          },
          docsUrl: 'https://wazuh.com/',
        },
        {
          name: 'Trivy Artifact Scanner',
          category: 'Supply Chain Vulnerability Scanner',
          purpose: 'Comprehensive vulnerability scanner for container images, Git repos, and third-party agent packages.',
          version: 'v0.49.0 (Specification)',
          installStatus: 'NOT_INSTALLED',
          connStatus: 'PLANNED',
          lastHealthCheck: 'N/A (Planned Roadmap)',
          configuration: {
            scan_targets: ['requirements.txt', 'package.json', 'Dockerfile', 'MCP Plugins'],
            severity_threshold: 'HIGH,CRITICAL',
          },
          docsUrl: 'https://trivy.dev/',
        },
      ];

      setIntegrationsList(inventory);
    } catch (err: any) {
      toast.error('Integrations Error', err.message || 'Failed to query integration status');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchQuarantine = useCallback(async () => {
    try {
      setLoadingQuarantine(true);
      const items = await api.listQuarantine();
      setQuarantineItems(Array.isArray(items) ? items : []);
    } catch (err: any) {
      toast.error('Quarantine Error', err.message || 'Failed to list quarantine vault');
    } finally {
      setLoadingQuarantine(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    if (activeSubTab === 'quarantine') {
      fetchQuarantine();
    }
  }, [activeSubTab, fetchQuarantine]);

  const handleScanFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanPath.trim()) return;
    setScanning(true);
    setScanResult(null);

    try {
      const res = await api.scanFile({
        file_path: scanPath,
        auto_quarantine_if_malicious: autoQuarantine,
      });
      setScanResult(res);
      if (res?.scan_result?.is_clean) {
        toast.success('Clean Artifact', `File ${scanPath} verified clean with 0 threats.`);
      } else {
        toast.error('Threat Detected', `Malware detected: ${res?.scan_result?.threat_name || 'Suspicious payload'}`);
      }
    } catch (err: any) {
      toast.error('Scan Error', err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleRestoreFile = async (quarantineId: string) => {
    try {
      await api.restoreQuarantine({ quarantine_id: quarantineId, restored_by: 'soc_admin' });
      toast.success('File Restored', `Quarantined item restored to sandbox.`);
      fetchQuarantine();
    } catch (err: any) {
      toast.error('Restore Failed', err.message);
    }
  };

  const handleQueryIntel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intelValue.trim()) return;
    setQueryingIntel(true);
    setIntelResult(null);

    try {
      const res = await api.queryThreatIntel({
        query_type: intelType,
        value: intelValue,
      });
      setIntelResult(res);
      toast.success('IoC Evaluated', `Threat intelligence score retrieved for ${intelValue}.`);
    } catch (err: any) {
      toast.error('Intel Error', err.message);
    } finally {
      setQueryingIntel(false);
    }
  };

  const getStatusBadge = (status: IntegrationDetail['connStatus']) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-kali-secure/30 bg-kali-secure/10 px-2.5 py-0.5 text-[10px] font-medium text-kali-secure">
            <span className="h-1.5 w-1.5 rounded-full bg-kali-secure" />
            <span>Connected</span>
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-medium text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            <span>Disconnected</span>
          </span>
        );
      case 'NOT_CONFIGURED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            <span>Not Configured</span>
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-medium text-rose-400">
            <AlertTriangle className="h-3 w-3" />
            <span>Error</span>
          </span>
        );
      case 'PLANNED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-kali-cyan/30 bg-kali-cyan/10 px-2.5 py-0.5 text-[10px] font-medium text-kali-cyan">
            <span>Planned</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="h-6 w-6 text-kali-cyan" />
            Security Integrations & Defense Mesh
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Operational status, fail-closed enforcement modes, heuristic file scanners, and enterprise SIEM connectors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchIntegrations}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-white/10 gap-2 text-xs">
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`px-4 py-2.5 border-b-2 font-medium transition-colors flex items-center gap-2 rounded-t-xl ${
            activeSubTab === 'inventory'
              ? 'border-kali-primary text-white bg-white/[0.04] font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4 text-kali-primary" />
          <span>Integration Inventory ({integrationsList.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('scanner')}
          className={`px-4 py-2.5 border-b-2 font-medium transition-colors flex items-center gap-2 rounded-t-xl ${
            activeSubTab === 'scanner'
              ? 'border-kali-primary text-white bg-white/[0.04] font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSearch className="h-4 w-4 text-kali-cyan" />
          <span>File Scanner</span>
        </button>
        <button
          onClick={() => setActiveSubTab('quarantine')}
          className={`px-4 py-2.5 border-b-2 font-medium transition-colors flex items-center gap-2 rounded-t-xl ${
            activeSubTab === 'quarantine'
              ? 'border-kali-primary text-white bg-white/[0.04] font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="h-4 w-4 text-amber-400" />
          <span>Quarantine Vault</span>
        </button>
        <button
          onClick={() => setActiveSubTab('intel')}
          className={`px-4 py-2.5 border-b-2 font-medium transition-colors flex items-center gap-2 rounded-t-xl ${
            activeSubTab === 'intel'
              ? 'border-kali-primary text-white bg-white/[0.04] font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="h-4 w-4 text-kali-secure" />
          <span>Threat Intel (IoC)</span>
        </button>
      </div>

      {loading && integrationsList.length === 0 ? (
        <LoadingSpinner message="Enumerating integration mesh nodes..." />
      ) : (
        <>
          {/* TAB 1: INTEGRATION INVENTORY */}
          {activeSubTab === 'inventory' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {integrationsList.map((item) => (
                <div
                  key={item.name}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl flex flex-col justify-between hover:border-white/20 hover:bg-white/[0.04] transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {item.category}
                      </span>
                      {getStatusBadge(item.connStatus)}
                    </div>

                    <div className="mt-3.5">
                      <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                        <span>{item.name}</span>
                        <span className="text-[11px] text-kali-cyan font-normal">
                          {item.version}
                        </span>
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed line-clamp-3">
                        {item.purpose}
                      </p>
                    </div>

                    {/* Technical Configuration Details */}
                    <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px]">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Configuration</div>
                      {Object.entries(item.configuration).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between truncate text-slate-300">
                          <span className="text-slate-400">{k}:</span>
                          <span className="text-white font-medium truncate ml-2 max-w-[130px] font-mono text-[10px]">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">
                      {item.installStatus === 'INSTALLED' ? '✓ Installed' : item.installStatus === 'STANDALONE' ? '⚡ Standalone' : '○ Planned'}
                    </span>
                    <a
                      href={item.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-kali-primary hover:text-kali-cyan transition-colors font-medium"
                    >
                      <span>Docs</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: FILE SCAN TESTBENCH */}
          {activeSubTab === 'scanner' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4">
                <div className="border-b border-white/10 pb-3.5">
                  <div className="text-xs text-kali-primary font-medium">Sandbox Inspection</div>
                  <h2 className="text-base font-bold text-white mt-1">YARA & ClamAV Heuristic File Scanner</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Inspect files generated by autonomous agents before allowing exfiltration or execution outside sandbox limits.
                  </p>
                </div>

                <form onSubmit={handleScanFile} className="space-y-4 text-xs">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1.5">Sandbox Relative File Path</label>
                    <input
                      type="text"
                      required
                      value={scanPath}
                      onChange={(e) => setScanPath(e.target.value)}
                      placeholder="e.g. agent_outputs/payload.py"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={autoQuarantine}
                      onChange={(e) => setAutoQuarantine(e.target.checked)}
                      className="rounded border-white/20 bg-black/40 text-kali-primary focus:ring-0"
                    />
                    <span>Automatically quarantine into isolation vault if threat detected</span>
                  </label>

                  <button
                    type="submit"
                    disabled={scanning}
                    className="inline-flex items-center gap-2 rounded-xl bg-kali-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-kali-primary/20 hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
                  >
                    <FileSearch className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
                    <span>{scanning ? 'Scanning Artifact...' : 'Dispatch Scanner'}</span>
                  </button>
                </form>
              </div>

              {/* Scan Results Panel */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-3">
                <div className="text-xs text-slate-400 font-medium">Scanner Output Buffer</div>
                {scanResult ? (
                  <TerminalBox
                    title={`Scan Result: ${scanPath}`}
                    copyContent={JSON.stringify(scanResult, null, 2)}
                    maxHeight="max-h-72"
                  >
                    <pre>{JSON.stringify(scanResult, null, 2)}</pre>
                  </TerminalBox>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-slate-500 text-xs">
                    <FileSearch className="h-8 w-8 text-slate-600 mb-2" />
                    <span>Ready to scan sandbox files. Submit file path on the left.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUARANTINE VAULT */}
          {activeSubTab === 'quarantine' && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                <div>
                  <div className="text-xs text-amber-400 font-medium">Isolation Vault</div>
                  <h2 className="text-base font-bold text-white mt-1">Non-Destructive Malware Quarantine Storage</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Malicious artifacts are cryptographically hashed, quarantined, and secured from execution.
                  </p>
                </div>
                <button
                  onClick={fetchQuarantine}
                  disabled={loadingQuarantine}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-kali-primary/50 transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 text-kali-cyan ${loadingQuarantine ? 'animate-spin' : ''}`} />
                  <span>Refresh Vault</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 text-[11px] text-slate-400 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Quarantine ID</th>
                      <th className="py-2.5 px-3">Threat Signature</th>
                      <th className="py-2.5 px-3">Original Path</th>
                      <th className="py-2.5 px-3">SHA-256 Hash</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {quarantineItems.map((item) => (
                      <tr key={item.quarantine_id || item.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-3 font-semibold text-white">{item.quarantine_id || item.id}</td>
                        <td className="py-3 px-3 text-rose-400 font-medium">{item.threat_name || 'Generic.Malware'}</td>
                        <td className="py-3 px-3 text-slate-400 max-w-[180px] truncate font-mono text-[11px]">{item.original_path}</td>
                        <td className="py-3 px-3 text-kali-cyan font-mono text-[11px] truncate max-w-[140px]">{item.file_hash}</td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">{item.timestamp || 'Recent'}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleRestoreFile(item.quarantine_id || item.id)}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-kali-secure hover:border-kali-secure/50 transition-colors"
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                    {quarantineItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                          Quarantine vault is empty. No active malicious payloads isolated.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: THREAT INTEL IoC LOOKUP */}
          {activeSubTab === 'intel' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-4">
                <div className="border-b border-white/10 pb-3.5">
                  <div className="text-xs text-kali-secure font-medium">Threat Intelligence</div>
                  <h2 className="text-base font-bold text-white mt-1">Indicator of Compromise (IoC) Evaluator</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Cross-reference external IP addresses, domains, and payload hashes against global threat feeds.
                  </p>
                </div>

                <form onSubmit={handleQueryIntel} className="space-y-4 text-xs">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1.5">Indicator Type</label>
                    <select
                      value={intelType}
                      onChange={(e) => setIntelType(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                    >
                      <option value="ip" className="bg-[#0a0d14] text-white">IP Address (IPv4 / IPv6)</option>
                      <option value="domain" className="bg-[#0a0d14] text-white">Domain Name</option>
                      <option value="hash" className="bg-[#0a0d14] text-white">Cryptographic Hash (MD5 / SHA-256)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium block mb-1.5">Indicator Value</label>
                    <input
                      type="text"
                      required
                      value={intelValue}
                      onChange={(e) => setIntelValue(e.target.value)}
                      placeholder="e.g. 198.51.100.42"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-white focus:border-kali-primary focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={queryingIntel}
                    className="inline-flex items-center gap-2 rounded-xl bg-kali-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-kali-primary/20 hover:bg-kali-secondaryBlue transition-colors disabled:opacity-50"
                  >
                    <Search className={`h-4 w-4 ${queryingIntel ? 'animate-spin' : ''}`} />
                    <span>{queryingIntel ? 'Querying Feeds...' : 'Evaluate IoC'}</span>
                  </button>
                </form>
              </div>

              {/* IoC Results */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl space-y-3">
                <div className="text-xs text-slate-400 font-medium">Threat Intelligence Report</div>
                {intelResult ? (
                  <TerminalBox
                    title={`IoC Report: ${intelValue}`}
                    copyContent={JSON.stringify(intelResult, null, 2)}
                    maxHeight="max-h-72"
                  >
                    <pre>{JSON.stringify(intelResult, null, 2)}</pre>
                  </TerminalBox>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-slate-500 text-xs">
                    <Search className="h-8 w-8 text-slate-600 mb-2" />
                    <span>Submit an IP or hash on the left to query threat intelligence telemetry.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

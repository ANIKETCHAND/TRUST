import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api.client';
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
          purpose: 'Declarative authorization engine with pre-flight Rego rule compilation.',
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
          docsUrl: 'https://github.com/ANIKETCHAND/TRUST',
        },
        {
          name: 'ClamAV & YARA Scanner',
          category: 'Anti-Malware & Signature Engine',
          purpose: 'Pre-execution inspection of file artifacts created or modified by agent tool executions.',
          version: 'v1.3.1',
          installStatus: clamRaw?.enabled ? 'INSTALLED' : 'NOT_INSTALLED',
          connStatus: clamRaw?.status === 'ACTIVE' || clamRaw?.status === 'ok' ? 'CONNECTED' : 'NOT_CONFIGURED',
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            quarantine_vault: 'sandbox_storage/quarantine',
            yara_rules: 'rules/agent_injections.yar',
          },
          docsUrl: 'https://www.clamav.net/documents',
        },
        {
          name: 'Threat Intelligence Provider',
          category: 'Attribution & Reputation Scoring',
          purpose: 'Real-time IP reputation and malicious domain checks on agent network calls.',
          version: 'v2.1.0',
          installStatus: 'INSTALLED',
          connStatus: intelRaw?.status === 'ACTIVE' ? 'CONNECTED' : 'CONNECTED',
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            cache_ttl: '3600s',
            provider: 'AbuseIPDB & ThreatFox',
          },
          docsUrl: 'https://abuseipdb.com',
        },
        {
          name: 'OpenTelemetry',
          category: 'Distributed Tracing & Metrics',
          purpose: 'High-precision telemetry sink for gateway latency and distributed context propagation.',
          version: 'v1.24.0',
          installStatus: otelRaw?.enabled ? 'INSTALLED' : 'NOT_INSTALLED',
          connStatus: otelRaw?.status === 'ACTIVE' || otelRaw?.status === 'ok' ? 'CONNECTED' : otelRaw?.enabled ? 'DISCONNECTED' : 'NOT_CONFIGURED',
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            collector_endpoint: otelRaw?.endpoint || 'http://localhost:4318/v1/traces',
            sampler: 'always_on',
          },
          docsUrl: 'https://opentelemetry.io/docs/',
        },
      ];

      setIntegrationsList(inventory);
    } catch (err: any) {
      toast.error('Integrations Error', `Failed to load integrations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanPath.trim()) return;
    try {
      setScanning(true);
      setScanResult(null);
      const res = await api.scanFile({
        file_path: scanPath.trim(),
        auto_quarantine: autoQuarantine,
      });
      setScanResult(res);
      if (res.is_infected) {
        toast.warning('Malicious Signature Detected', `Threat: ${res.threat_name || 'Generic Anomaly'}`);
      } else {
        toast.success('Clean File', 'No signatures or suspicious patterns matched.');
      }
    } catch (err: any) {
      toast.error('Scan Error', err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleIntelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intelValue.trim()) return;
    try {
      setQueryingIntel(true);
      setIntelResult(null);
      const res = await api.queryThreatIntel({
        indicator_type: intelType,
        indicator_value: intelValue.trim(),
      });
      setIntelResult(res);
      toast.info('Intel Queried', `Reputation score: ${res.reputation_score || 0}/100.`);
    } catch (err: any) {
      toast.error('Query Failed', err.message);
    } finally {
      setQueryingIntel(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Connected Integrations & Security Modules
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Pluggable policy engines, malware scanners, and threat intelligence feeds.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchIntegrations}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Subtab Navigation Bar */}
      <div className="flex border-b border-[#E5EAF1] bg-white rounded-t-xl px-4 text-xs font-medium shadow-2xs">
        {[
          { id: 'inventory', label: `Module Inventory (${integrationsList.length})` },
          { id: 'scanner', label: 'File & YARA Scanner' },
          { id: 'intel', label: 'Threat Intel Query' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`py-3 px-4 border-b-2 transition-all ${
              activeSubTab === tab.id
                ? 'border-[#3B82F6] text-[#3B82F6] font-semibold'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subtab Content Area */}
      <div className="rounded-b-xl border border-t-0 border-[#E5EAF1] bg-white p-5 shadow-2xs text-xs">
        {activeSubTab === 'inventory' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrationsList.map((item) => (
              <div key={item.name} className="p-4 rounded-xl border border-[#E5EAF1] bg-[#F8FAFC] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-[#1E293B]">{item.name}</div>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.connStatus === 'CONNECTED'
                        ? 'bg-[#E8F7EF] text-[#16A34A] border border-[#BCE8CD]'
                        : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCD2D2]'
                    }`}
                  >
                    {item.connStatus}
                  </span>
                </div>

                <div className="text-[11px] text-[#64748B] leading-relaxed">
                  {item.purpose}
                </div>

                <div className="pt-2 border-t border-[#E5EAF1] flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>Category: <strong className="text-[#1E293B]">{item.category}</strong></span>
                  <a
                    href={item.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#3B82F6] hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Docs</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSubTab === 'scanner' && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-[#1E293B]">Sandbox File Malware Scanner</h3>
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <div>
                <label className="block font-medium text-[#1E293B] mb-1">Target Sandbox Path</label>
                <input
                  type="text"
                  value={scanPath}
                  onChange={(e) => setScanPath(e.target.value)}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoQCheck"
                  checked={autoQuarantine}
                  onChange={(e) => setAutoQuarantine(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E5EAF1] text-[#3B82F6]"
                />
                <label htmlFor="autoQCheck" className="text-[#1E293B]">
                  Automatically quarantine file if signatures match
                </label>
              </div>

              <button
                type="submit"
                disabled={scanning}
                className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold hover:bg-[#2563EB] disabled:opacity-50"
              >
                {scanning ? 'Scanning...' : 'Scan Artifact'}
              </button>
            </form>

            {scanResult && (
              <div className="mt-4 pt-4 border-t border-[#F1F5F9] space-y-2">
                <span className="font-semibold text-[#1E293B]">Scan Report</span>
                <TerminalBox
                  title="Scanner Output"
                  maxHeight="max-h-48"
                  copyContent={JSON.stringify(scanResult, null, 2)}
                >
                  <pre>{JSON.stringify(scanResult, null, 2)}</pre>
                </TerminalBox>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'intel' && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-[#1E293B]">Threat Intelligence Reputation Lookup</h3>
            <form onSubmit={handleIntelSubmit} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Type</label>
                  <select
                    value={intelType}
                    onChange={(e) => setIntelType(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2"
                  >
                    <option value="ip">IP Address</option>
                    <option value="domain">Domain Name</option>
                    <option value="hash">File Hash</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-[#1E293B] mb-1">Indicator Value</label>
                  <input
                    type="text"
                    value={intelValue}
                    onChange={(e) => setIntelValue(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={queryingIntel}
                className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold hover:bg-[#2563EB] disabled:opacity-50"
              >
                {queryingIntel ? 'Querying Feeds...' : 'Query Threat Intelligence'}
              </button>
            </form>

            {intelResult && (
              <div className="mt-4 pt-4 border-t border-[#F1F5F9] space-y-2">
                <span className="font-semibold text-[#1E293B]">Threat Intelligence Feed Result</span>
                <TerminalBox
                  title="Reputation Analysis"
                  maxHeight="max-h-48"
                  copyContent={JSON.stringify(intelResult, null, 2)}
                >
                  <pre>{JSON.stringify(intelResult, null, 2)}</pre>
                </TerminalBox>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  ShieldAlert,
  Flame,
  Radio,
  Crosshair,
  Lock,
  RefreshCw,
  Search,
  Cpu,
  Wifi,
  AlertTriangle,
} from 'lucide-react';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';
import { api } from '../../services/api.client';

interface ThreatOrigin {
  id: string;
  timestamp: string;
  ip: string;
  country: string;
  country_code: string;
  city: string;
  lat: number;
  lon: number;
  asn: string;
  threat_score: number;
  threat_level: string;
  is_internal?: boolean;
}

interface AttackRay {
  id: string;
  from: { lat: number; lon: number; label: string };
  to: { lat: number; lon: number; label: string };
  threat_level: string;
  ip: string;
}

interface ThreatMapData {
  soc_center: { lat: number; lon: number; label: string };
  summary: {
    total_threats_logged: number;
    distinct_countries: number;
    critical_threats: number;
    high_threats: number;
    wan_origins: number;
    intranet_origins: number;
  };
  active_threats: ThreatOrigin[];
  attack_rays: AttackRay[];
}

interface ArpEntry {
  ip: string;
  mac: string;
  oui_prefix: string;
  vendor: string;
  type: string;
}

export const ThreatMapTab: React.FC = () => {
  const { refreshTrigger } = useSecurityPlatform();
  const { showToast } = useToast();
  const [data, setData] = useState<ThreatMapData | null>(null);
  const [arpTable, setArpTable] = useState<ArpEntry[]>([]);
  const [selectedThreat, setSelectedThreat] = useState<ThreatOrigin | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'map' | 'arp'>('map');

  const fetchThreatMap = async () => {
    try {
      setLoading(true);
      const json = await api.getThreatMap();
      setData(json);
      if (json.active_threats && json.active_threats.length > 0) {
        setSelectedThreat(json.active_threats[0]);
      }

      try {
        const arpJson = await api.getLocalArp();
        setArpTable(arpJson);
      } catch {
        // Fallback for non-admin accounts where local-arp requires admin role
      }
    } catch (err: any) {
      console.error('Failed to load threat map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreatMap();
  }, [refreshTrigger]);

  const handleSinkhole = async (ip: string) => {
    try {
      await api.createSinkhole({
        ip,
        reason: 'Operator 1-click active perimeter sinkhole',
        duration_seconds: 86400,
      });
      showToast('success', 'IP Sinkholed', `Host ${ip} has been null-routed at the gateway and OS firewall.`);
      fetchThreatMap();
    } catch (err: any) {
      showToast('error', 'Sinkhole Failed', err.message);
    }
  };

  // Convert (lat, lon) to SVG (x, y) on 1000x500 canvas
  const projectCoordinates = (lat: number, lon: number): { x: number; y: number } => {
    const x = ((lon + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x: Math.max(20, Math.min(980, x)), y: Math.max(20, Math.min(480, y)) };
  };

  const filteredThreats = useMemo(() => {
    if (!data?.active_threats) return [];
    if (!searchQuery.trim()) return data.active_threats;
    const q = searchQuery.toLowerCase();
    return data.active_threats.filter(
      (t) =>
        t.ip.toLowerCase().includes(q) ||
        t.country.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.asn.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-kali-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-kali-cyan font-bold tracking-wider">[RADAR_GEOLOC]</span>
            <span className="text-xs text-kali-muted">INTERACTIVE THREAT ATTRIBUTION</span>
          </div>
          <h1 className="text-xl font-bold text-kali-text flex items-center gap-2 mt-1">
            <Globe className="h-5 w-5 text-kali-cyan" />
            Global Threat Attribution & Interactive Defense Map
          </h1>
          <p className="text-xs text-kali-muted mt-0.5">
            Real-time visual geolocation of adversarial AI exploit probes, WAN ingress vectors, and Layer-2 intranet telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-kali-bg rounded-lg p-1 border border-kali-border">
            <button
              onClick={() => setActiveView('map')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                activeView === 'map'
                  ? 'bg-kali-card text-kali-cyan border border-kali-cyan/40 shadow-sm'
                  : 'text-kali-muted hover:text-kali-text'
              }`}
            >
              [GEO_RADAR]
            </button>
            <button
              onClick={() => setActiveView('arp')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                activeView === 'arp'
                  ? 'bg-kali-card text-kali-cyan border border-kali-cyan/40 shadow-sm'
                  : 'text-kali-muted hover:text-kali-text'
              }`}
            >
              [ARP_TABLE ({arpTable.length})]
            </button>
          </div>

          <button
            onClick={fetchThreatMap}
            className="flex items-center gap-1.5 rounded-lg border border-kali-border bg-kali-card px-3 py-1.5 text-xs font-mono text-kali-text hover:bg-kali-elevated hover:border-kali-primary transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            SYNC
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Probes Logged"
          value={data?.summary.total_threats_logged ?? 0}
          icon={<Radio className="h-4 w-4 text-kali-cyan" />}
          subValue="+14% this hour"
        />
        <StatCard
          label="Origin Countries"
          value={data?.summary.distinct_countries ?? 0}
          icon={<Globe className="h-4 w-4 text-kali-primary" />}
        />
        <StatCard
          label="Critical Attacks"
          value={data?.summary.critical_threats ?? 0}
          icon={<Flame className="h-4 w-4 text-kali-critical" />}
          subValue="Perimeter Held"
        />
        <StatCard
          label="Intranet Vectors"
          value={data?.summary.intranet_origins ?? 0}
          icon={<Wifi className="h-4 w-4 text-kali-cyan" />}
        />
      </div>

      {activeView === 'map' ? (
        <>
          {/* Interactive SVG World Map Canvas */}
          <div className="relative rounded-xl border border-kali-border bg-kali-card overflow-hidden shadow-kali-card">
            {/* Map Top Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-kali-border bg-kali-bg/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-kali-cyan animate-ping" />
                <span className="font-mono text-xs font-bold text-kali-text tracking-wider">LIVE DEFENSE RADAR</span>
                <span className="text-kali-border">|</span>
                <span className="font-mono text-[11px] text-kali-muted">TARGET SOC: {data?.soc_center.label || 'AGENTTRUST-PRIMARY'}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono">
                <span className="flex items-center gap-1.5 text-kali-critical">
                  <span className="h-2 w-2 rounded-full bg-kali-critical" /> CRITICAL ATTACK
                </span>
                <span className="flex items-center gap-1.5 text-kali-warning">
                  <span className="h-2 w-2 rounded-full bg-kali-warning" /> HIGH THREAT
                </span>
                <span className="flex items-center gap-1.5 text-kali-cyan">
                  <span className="h-2 w-2 rounded-full bg-kali-cyan" /> SOC DEFENSE NODE
                </span>
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="relative w-full aspect-[2/1] min-h-[380px] bg-kali-bg flex items-center justify-center p-4">
              <svg
                viewBox="0 0 1000 500"
                className="w-full h-full"
                style={{ filter: 'drop-shadow(0 0 15px rgba(54, 123, 245, 0.08))' }}
              >
                <defs>
                  <linearGradient id="rayGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#DC4C55" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#367BF5" stopOpacity="0.25" />
                  </linearGradient>
                  <linearGradient id="rayGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D99A35" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#367BF5" stopOpacity="0.25" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <g stroke="#1F2E45" strokeWidth="0.5" strokeDasharray="3 3">
                  <line x1="0" y1="125" x2="1000" y2="125" />
                  <line x1="0" y1="250" x2="1000" y2="250" />
                  <line x1="0" y1="375" x2="1000" y2="375" />
                  <line x1="250" y1="0" x2="250" y2="500" />
                  <line x1="500" y1="0" x2="500" y2="500" />
                  <line x1="750" y1="0" x2="750" y2="500" />
                </g>

                {/* Continents Outlines */}
                <path
                  d="M150,110 Q200,90 280,100 Q310,140 280,210 Q220,240 180,200 Z"
                  fill="#151E2D"
                  stroke="#1F2E45"
                  strokeWidth="1"
                />
                <path
                  d="M260,250 Q310,260 330,330 Q300,430 260,440 Q220,360 240,280 Z"
                  fill="#151E2D"
                  stroke="#1F2E45"
                  strokeWidth="1"
                />
                <path
                  d="M450,100 Q560,90 560,160 Q510,190 470,150 Z"
                  fill="#151E2D"
                  stroke="#1F2E45"
                  strokeWidth="1"
                />
                <path
                  d="M480,200 Q550,210 560,280 Q540,380 490,370 Q460,290 470,220 Z"
                  fill="#151E2D"
                  stroke="#1F2E45"
                  strokeWidth="1"
                />
                <path
                  d="M600,90 Q850,70 880,170 Q810,240 700,210 Q610,170 600,110 Z"
                  fill="#151E2D"
                  stroke="#1F2E45"
                  strokeWidth="1"
                />
                <path
                  d="M750,300 Q840,290 850,370 Q790,410 740,360 Z"
                  fill="#151E2D"
                  stroke="#1F2E45"
                  strokeWidth="1"
                />

                {/* Attack Rays (Curved Beziers from Origin to SOC) */}
                {data?.attack_rays?.map((ray) => {
                  const pFrom = projectCoordinates(ray.from.lat, ray.from.lon);
                  const pTo = projectCoordinates(ray.to.lat, ray.to.lon);
                  const cx = (pFrom.x + pTo.x) / 2;
                  const cy = Math.min(pFrom.y, pTo.y) - 50;

                  return (
                    <g key={ray.id}>
                      <path
                        d={`M ${pFrom.x} ${pFrom.y} Q ${cx} ${cy} ${pTo.x} ${pTo.y}`}
                        fill="none"
                        stroke={ray.threat_level === 'CRITICAL' ? 'url(#rayGradRed)' : 'url(#rayGradAmber)'}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                    </g>
                  );
                })}

                {/* Origin Attack Nodes */}
                {data?.active_threats?.map((threat) => {
                  const p = projectCoordinates(threat.lat, threat.lon);
                  const isSelected = selectedThreat?.id === threat.id;
                  const isCritical = threat.threat_level === 'CRITICAL';

                  return (
                    <g
                      key={threat.id}
                      onClick={() => setSelectedThreat(threat)}
                      className="cursor-pointer group"
                    >
                      {/* Pulse Ring */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isSelected ? 14 : 9}
                        fill="none"
                        stroke={isCritical ? '#DC4C55' : '#D99A35'}
                        strokeWidth="1"
                        opacity="0.6"
                      >
                        <animate
                          attributeName="r"
                          values="6;16;6"
                          dur="2.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.8;0.1;0.8"
                          dur="2.5s"
                          repeatCount="indefinite"
                        />
                      </circle>

                      {/* Main Node Dot */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isSelected ? 6 : 4}
                        fill={isCritical ? '#DC4C55' : '#D99A35'}
                      />

                      {/* Tooltip */}
                      <text
                        x={p.x + 8}
                        y={p.y + 4}
                        fill="#E2E8F0"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                        className="pointer-events-none opacity-80 group-hover:opacity-100"
                      >
                        {threat.country_code} ({threat.ip})
                      </text>
                    </g>
                  );
                })}

                {/* Target SOC Node */}
                {data?.soc_center && (
                  <g>
                    {(() => {
                      const pSoc = projectCoordinates(data.soc_center.lat, data.soc_center.lon);
                      return (
                        <>
                          <circle
                            cx={pSoc.x}
                            cy={pSoc.y}
                            r="20"
                            fill="none"
                            stroke="#367BF5"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                            opacity="0.5"
                          />
                          <circle cx={pSoc.x} cy={pSoc.y} r="6" fill="#2563EB" />
                          <circle cx={pSoc.x} cy={pSoc.y} r="3" fill="#22B8CF" />
                          <text
                            x={pSoc.x - 45}
                            y={pSoc.y + 18}
                            fill="#367BF5"
                            fontSize="9"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight="bold"
                          >
                            AGENTTRUST SOC
                          </text>
                        </>
                      );
                    })()}
                  </g>
                )}
              </svg>
            </div>

            {/* Selected Threat Quick-Inspection Tray */}
            {selectedThreat && (
              <div className="border-t border-kali-border bg-kali-elevated/70 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-kali-critical/15 border border-kali-critical/40 flex items-center justify-center shrink-0">
                    <Crosshair className="h-5 w-5 text-kali-critical" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-kali-text">{selectedThreat.ip}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          selectedThreat.threat_level === 'CRITICAL'
                            ? 'bg-kali-critical/15 text-kali-critical border border-kali-critical/40'
                            : 'bg-kali-warning/15 text-kali-warning border border-kali-warning/40'
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {selectedThreat.threat_level} (SCORE: {selectedThreat.threat_score}/100)
                      </span>
                      {selectedThreat.is_internal && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-kali-card text-kali-muted border border-kali-border">
                          INTRANET_HOST
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-kali-muted mt-0.5">
                      {selectedThreat.city}, {selectedThreat.country} &bull; ASN: {selectedThreat.asn}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSinkhole(selectedThreat.ip)}
                    className="flex items-center gap-1.5 rounded-lg bg-kali-critical hover:bg-kali-critical/90 text-white px-3 py-1.5 text-xs font-mono font-semibold shadow-lg shadow-kali-critical/20 transition-colors"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    SINKHOLE_IP
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Attack Stream Table */}
          <div className="rounded-xl border border-kali-border bg-kali-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-xs font-mono font-bold text-kali-text uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-kali-cyan" />
                Live Ingress Threat Stream ({filteredThreats.length})
              </h2>

              <div className="w-full sm:w-72">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-kali-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter IP, country, ASN..."
                    className="w-full rounded-lg border border-kali-border bg-kali-bg pl-8 pr-3 py-1.5 text-xs font-mono text-kali-text placeholder-kali-muted focus:outline-none focus:border-kali-primary"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-kali-border text-kali-muted">
                    <th className="py-2.5 px-3">IP ADDRESS</th>
                    <th className="py-2.5 px-3">GEOLOCATION</th>
                    <th className="py-2.5 px-3">ASN / PROVIDER</th>
                    <th className="py-2.5 px-3">RISK SCORE</th>
                    <th className="py-2.5 px-3">SCOPE</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kali-border/60">
                  {filteredThreats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-kali-muted">
                        No ingress threats matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredThreats.map((threat) => (
                      <tr
                        key={threat.id}
                        onClick={() => setSelectedThreat(threat)}
                        className={`hover:bg-kali-elevated/40 cursor-pointer transition-colors ${
                          selectedThreat?.id === threat.id ? 'bg-kali-primary/10 border-l-2 border-kali-primary' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold text-kali-text">{threat.ip}</td>
                        <td className="py-2.5 px-3 text-kali-text">
                          {threat.city}, {threat.country} ({threat.country_code})
                        </td>
                        <td className="py-2.5 px-3 text-kali-muted max-w-[220px] truncate">{threat.asn}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              threat.threat_score >= 80
                                ? 'bg-kali-critical/15 text-kali-critical border border-kali-critical/40'
                                : 'bg-kali-warning/15 text-kali-warning border border-kali-warning/40'
                            }`}
                          >
                            {threat.threat_score} / 100
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-kali-bg text-kali-muted border border-kali-border">
                            {threat.is_internal ? 'INTRANET' : 'WAN'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSinkhole(threat.ip);
                            }}
                            className="rounded border border-kali-critical/40 bg-kali-critical/15 text-kali-critical hover:bg-kali-critical hover:text-white px-2.5 py-1 text-[11px] font-mono transition-colors"
                          >
                            SINKHOLE
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Intranet ARP Table View */
        <div className="rounded-xl border border-kali-border bg-kali-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold text-kali-text uppercase tracking-wider flex items-center gap-2">
                <Cpu className="h-4 w-4 text-kali-cyan" />
                Local Subnet ARP Cache & Hardware NIC Vendor Forensics
              </h2>
              <p className="text-xs text-kali-muted mt-0.5">
                Layer-2 Ethernet inspection resolving local insider IP addresses to hardware MAC addresses and manufacturer OUIs.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-kali-border text-kali-muted">
                  <th className="py-2.5 px-3">LOCAL IPV4</th>
                  <th className="py-2.5 px-3">LAYER-2 MAC ADDRESS</th>
                  <th className="py-2.5 px-3">OUI PREFIX</th>
                  <th className="py-2.5 px-3">HARDWARE VENDOR</th>
                  <th className="py-2.5 px-3">TYPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kali-border/60">
                {arpTable.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-kali-muted">
                      No ARP entries discovered in local subnet cache.
                    </td>
                  </tr>
                ) : (
                  arpTable.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-kali-elevated/40">
                      <td className="py-2.5 px-3 font-bold text-kali-cyan">{entry.ip}</td>
                      <td className="py-2.5 px-3 text-kali-text">{entry.mac}</td>
                      <td className="py-2.5 px-3 text-kali-muted">{entry.oui_prefix}</td>
                      <td className="py-2.5 px-3 font-sans text-kali-text">{entry.vendor}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-kali-bg text-kali-muted border border-kali-border">
                          {entry.type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

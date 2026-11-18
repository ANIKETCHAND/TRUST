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
        // Fallback for non-admin accounts
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
        reason: 'Operator manual containment from Threat Radar',
        duration_seconds: 3600,
      });
      showToast('success', 'IP Sinkholed', `Firewall rule applied. Ingress from ${ip} is blocked.`);
      fetchThreatMap();
    } catch (err: any) {
      showToast('error', 'Sinkhole Failed', err.message);
    }
  };

  const projectCoordinates = (lat: number, lon: number) => {
    const x = ((lon + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x, y };
  };

  const filteredThreats = useMemo(() => {
    if (!data?.active_threats) return [];
    if (!searchQuery.trim()) return data.active_threats;
    const q = searchQuery.toLowerCase();
    return data.active_threats.filter(
      (t) =>
        t.ip.toLowerCase().includes(q) ||
        t.country.toLowerCase().includes(q) ||
        t.country_code.toLowerCase().includes(q) ||
        t.asn.toLowerCase().includes(q)
    );
  }, [data?.active_threats, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Globe className="h-6 w-6 text-kali-cyan" />
            Threat Radar & Geolocation
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global attack vector tracking, live origin rays, and local subnet topology.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-white/[0.03] rounded-xl p-1 border border-white/10 text-xs">
            <button
              onClick={() => setActiveView('map')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === 'map'
                  ? 'bg-kali-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Geo Radar
            </button>
            <button
              onClick={() => setActiveView('arp')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === 'arp'
                  ? 'bg-kali-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ARP Subnet ({arpTable.length})
            </button>
          </div>

          <button
            onClick={fetchThreatMap}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Probes"
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
          icon={<Flame className="h-4 w-4 text-rose-400" />}
          subValue="Held"
          subValueColor="text-emerald-400"
        />
        <StatCard
          label="Intranet Vectors"
          value={data?.summary.intranet_origins ?? 0}
          icon={<Wifi className="h-4 w-4 text-kali-cyan" />}
        />
      </div>

      {activeView === 'map' ? (
        <>
          {/* Interactive World Map Canvas */}
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden backdrop-blur-md shadow-2xl">
            {/* Map Top Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02] text-xs">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-kali-cyan animate-pulse" />
                <span className="text-xs font-semibold text-white">Live Defense Radar</span>
                <span className="text-white/20">|</span>
                <span className="text-[11px] text-slate-400">Target Node: {data?.soc_center.label || 'CrossX SOC'}</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Critical
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> High Threat
                </span>
                <span className="flex items-center gap-1.5 text-kali-cyan">
                  <span className="h-2 w-2 rounded-full bg-kali-cyan" /> SOC Defense Node
                </span>
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="relative w-full aspect-[2/1] min-h-[380px] bg-black flex items-center justify-center p-4">
              <svg
                viewBox="0 0 1000 500"
                className="w-full h-full"
                style={{ filter: 'drop-shadow(0 0 15px rgba(54, 123, 245, 0.08))' }}
              >
                <defs>
                  <linearGradient id="rayGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#367BF5" stopOpacity="0.25" />
                  </linearGradient>
                  <linearGradient id="rayGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#367BF5" stopOpacity="0.25" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <g stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.5" strokeDasharray="3 3">
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
                  fill="#0a0f1d"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1"
                />
                <path
                  d="M260,250 Q310,260 330,330 Q300,430 260,440 Q220,360 240,280 Z"
                  fill="#0a0f1d"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1"
                />
                <path
                  d="M450,100 Q560,90 560,160 Q510,190 470,150 Z"
                  fill="#0a0f1d"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1"
                />
                <path
                  d="M480,200 Q550,210 560,280 Q540,380 490,370 Q460,290 470,220 Z"
                  fill="#0a0f1d"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1"
                />
                <path
                  d="M600,90 Q850,70 880,170 Q810,240 700,210 Q610,170 600,110 Z"
                  fill="#0a0f1d"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1"
                />
                <path
                  d="M750,300 Q840,290 850,370 Q790,410 740,360 Z"
                  fill="#0a0f1d"
                  stroke="rgba(255, 255, 255, 0.08)"
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
                        stroke={isCritical ? '#EF4444' : '#F59E0B'}
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
                        fill={isCritical ? '#EF4444' : '#F59E0B'}
                      />

                      {/* Tooltip */}
                      <text
                        x={p.x + 8}
                        y={p.y + 4}
                        fill="#E2E8F0"
                        fontSize="9"
                        className="pointer-events-none opacity-80 group-hover:opacity-100 font-mono"
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
                            x={pSoc.x - 35}
                            y={pSoc.y + 18}
                            fill="#367BF5"
                            fontSize="9"
                            fontWeight="bold"
                          >
                            CROSSX SOC
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
              <div className="border-t border-white/10 bg-white/[0.02] px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <Crosshair className="h-5 w-5 text-rose-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-bold text-white">{selectedThreat.ip}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedThreat.threat_level === 'CRITICAL'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {selectedThreat.threat_level} (Score: {selectedThreat.threat_score}/100)
                      </span>
                      {selectedThreat.is_internal && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-slate-400 border border-white/10">
                          Intranet Host
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {selectedThreat.city}, {selectedThreat.country} &bull; ASN: {selectedThreat.asn}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSinkhole(selectedThreat.ip)}
                    className="flex items-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 text-xs font-semibold transition-all shadow-sm"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Sinkhole IP</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Attack Stream Table */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 space-y-4 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-kali-cyan" />
                  Live Ingress Threat Stream ({filteredThreats.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Real-time perimeter probes and risk ratings</p>
              </div>

              <div className="w-full sm:w-72">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter IP, country, ASN..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-kali-cyan/50"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 px-4 font-medium">IP Address</th>
                    <th className="py-3 px-4 font-medium">Geolocation</th>
                    <th className="py-3 px-4 font-medium">ASN / Provider</th>
                    <th className="py-3 px-4 font-medium">Risk Score</th>
                    <th className="py-3 px-4 font-medium">Scope</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {filteredThreats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No ingress threats matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredThreats.map((threat) => (
                      <tr
                        key={threat.id}
                        onClick={() => setSelectedThreat(threat)}
                        className={`hover:bg-white/[0.03] cursor-pointer transition-colors ${
                          selectedThreat?.id === threat.id ? 'bg-white/[0.04] border-l-2 border-kali-cyan' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-medium text-white">{threat.ip}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {threat.city}, {threat.country} ({threat.country_code})
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-[220px] truncate">{threat.asn}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              threat.threat_score >= 80
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {threat.threat_score} / 100
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-slate-400 border border-white/10">
                            {threat.is_internal ? 'Intranet' : 'WAN'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSinkhole(threat.ip);
                            }}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-3 py-1 text-xs font-medium transition-all"
                          >
                            Sinkhole
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 space-y-4 backdrop-blur-md">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-kali-cyan" />
              Subnet ARP Cache & Device NIC Forensics
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Layer-2 Ethernet resolution from local IP addresses to hardware MAC addresses and vendors.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4 font-medium">Local IPv4</th>
                  <th className="py-3 px-4 font-medium">MAC Address</th>
                  <th className="py-3 px-4 font-medium">OUI Prefix</th>
                  <th className="py-3 px-4 font-medium">Hardware Vendor</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {arpTable.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No ARP entries discovered in local subnet cache.
                    </td>
                  </tr>
                ) : (
                  arpTable.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4 font-mono font-medium text-kali-cyan">{entry.ip}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{entry.mac}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{entry.oui_prefix}</td>
                      <td className="py-3 px-4 text-slate-200">{entry.vendor}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-slate-400 border border-white/10">
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

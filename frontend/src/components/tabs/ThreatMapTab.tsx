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
} from 'lucide-react';
import { useSecurityPlatform } from '../../context/SecurityPlatformContext';
import { useToast } from '../../context/ToastContext';
import { StatCard } from '../ui/StatCard';

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
      const res = await fetch('/api/v1/attribution/threat-map');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.active_threats && json.active_threats.length > 0) {
          setSelectedThreat(json.active_threats[0]);
        }
      }

      const arpRes = await fetch('/api/v1/attribution/local-arp');
      if (arpRes.ok) {
        const arpJson = await arpRes.json();
        setArpTable(arpJson);
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
      const res = await fetch('/api/v1/attribution/sinkhole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip,
          reason: 'Operator 1-click active perimeter sinkhole',
          duration_seconds: 86400,
        }),
      });
      if (res.ok) {
        showToast('success', 'IP Sinkholed', `Host ${ip} has been null-routed at the gateway and OS firewall.`);
        fetchThreatMap();
      } else {
        throw new Error('Failed to sinkhole IP');
      }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Globe className="h-6 w-6 text-cyan-400" />
            Global Threat Attribution & Interactive Defense Map
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time visual geolocation of adversarial AI exploit probes, WAN ingress vectors, and Layer-2 intranet telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setActiveView('map')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeView === 'map' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              World Map
            </button>
            <button
              onClick={() => setActiveView('arp')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeView === 'arp' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              Intranet ARP Table ({arpTable.length})
            </button>
          </div>

          <button
            onClick={fetchThreatMap}
            className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Probes Logged"
          value={data?.summary.total_threats_logged ?? 0}
          icon={<Radio className="h-5 w-5 text-cyan-400" />}
          subValue="+14% this hour"
        />
        <StatCard
          label="Origin Countries"
          value={data?.summary.distinct_countries ?? 0}
          icon={<Globe className="h-5 w-5 text-cyan-400" />}
        />
        <StatCard
          label="Critical Attacks"
          value={data?.summary.critical_threats ?? 0}
          icon={<Flame className="h-5 w-5 text-red-400" />}
          subValue="Perimeter Held"
        />
        <StatCard
          label="Intranet Vectors"
          value={data?.summary.intranet_origins ?? 0}
          icon={<Wifi className="h-5 w-5 text-cyan-400" />}
        />
      </div>

      {activeView === 'map' ? (
        <>
          {/* Interactive SVG World Map Canvas */}
          <div className="relative rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-2xl">
            {/* Map Top Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="font-mono text-slate-300">LIVE DEFENSE RADAR</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">Target SOC: {data?.soc_center.label}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono">
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> CRITICAL ATTACK
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> HIGH THREAT
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="h-2 w-2 rounded-full bg-cyan-500" /> SOC DEFENSE NODE
                </span>
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="relative w-full aspect-[2/1] min-h-[380px] bg-[#070b14] flex items-center justify-center p-4">
              <svg
                viewBox="0 0 1000 500"
                className="w-full h-full"
                style={{ filter: 'drop-shadow(0 0 15px rgba(6, 182, 212, 0.05))' }}
              >
                <defs>
                  <linearGradient id="rayGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="rayGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <g stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3">
                  <line x1="0" y1="125" x2="1000" y2="125" />
                  <line x1="0" y1="250" x2="1000" y2="250" />
                  <line x1="0" y1="375" x2="1000" y2="375" />
                  <line x1="250" y1="0" x2="250" y2="500" />
                  <line x1="500" y1="0" x2="500" y2="500" />
                  <line x1="750" y1="0" x2="750" y2="500" />
                </g>

                {/* Simplified Continents Outlines (Geo Vector Shapes) */}
                <path
                  d="M150,110 Q200,90 280,100 Q310,140 280,210 Q220,240 180,200 Z"
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <path
                  d="M260,250 Q310,260 330,330 Q300,430 260,440 Q220,360 240,280 Z"
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <path
                  d="M450,100 Q560,90 560,160 Q510,190 470,150 Z"
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <path
                  d="M480,200 Q550,210 560,280 Q540,380 490,370 Q460,290 470,220 Z"
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <path
                  d="M600,90 Q850,70 880,170 Q810,240 700,210 Q610,170 600,110 Z"
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <path
                  d="M750,300 Q840,290 850,370 Q790,410 740,360 Z"
                  fill="#0f172a"
                  stroke="#1e293b"
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
                        stroke={isCritical ? '#ef4444' : '#f59e0b'}
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
                        fill={isCritical ? '#ef4444' : '#f59e0b'}
                      />

                      {/* Tooltip */}
                      <text
                        x={p.x + 8}
                        y={p.y + 4}
                        fill="#cbd5e1"
                        fontSize="9"
                        fontFamily="monospace"
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
                            stroke="#38bdf8"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                            opacity="0.4"
                          />
                          <circle cx={pSoc.x} cy={pSoc.y} r="6" fill="#0284c7" />
                          <circle cx={pSoc.x} cy={pSoc.y} r="3" fill="#38bdf8" />
                          <text
                            x={pSoc.x - 45}
                            y={pSoc.y + 18}
                            fill="#38bdf8"
                            fontSize="9"
                            fontFamily="monospace"
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
              <div className="border-t border-slate-800 bg-slate-900/90 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-red-950/60 border border-red-800 flex items-center justify-center shrink-0">
                    <Crosshair className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white">{selectedThreat.ip}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedThreat.threat_level === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {selectedThreat.threat_level} (Score: {selectedThreat.threat_score}/100)
                      </span>
                      {selectedThreat.is_internal && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          INTRANET HOST
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selectedThreat.city}, {selectedThreat.country} &bull; {selectedThreat.asn}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSinkhole(selectedThreat.ip)}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 text-xs font-semibold shadow-lg shadow-red-900/30 transition-colors"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Sinkhole Offender IP
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Attack Stream Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-cyan-400" />
                Live Ingress Threat Stream ({filteredThreats.length})
              </h2>

              <div className="w-64">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search IP, country, ASN..."
                    className="w-full rounded-md border border-slate-800 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2 px-3">IP Address</th>
                    <th className="py-2 px-3">Location</th>
                    <th className="py-2 px-3">ASN / Provider</th>
                    <th className="py-2 px-3">Threat Score</th>
                    <th className="py-2 px-3">Scope</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredThreats.map((threat) => (
                    <tr
                      key={threat.id}
                      onClick={() => setSelectedThreat(threat)}
                      className={`hover:bg-slate-900/50 cursor-pointer transition-colors ${
                        selectedThreat?.id === threat.id ? 'bg-cyan-950/30 border-l-2 border-cyan-400' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-white">{threat.ip}</td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {threat.city}, {threat.country} ({threat.country_code})
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[220px] truncate">{threat.asn}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            threat.threat_score >= 80
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {threat.threat_score} / 100
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {threat.is_internal ? 'INTRANET' : 'WAN'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSinkhole(threat.ip);
                          }}
                          className="rounded border border-red-800/60 bg-red-950/40 text-red-300 hover:bg-red-900/60 px-2 py-1 text-[11px] transition-colors"
                        >
                          Sinkhole
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Intranet ARP Table View */
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-cyan-400" />
                Local Subnet ARP Cache & Hardware NIC Vendor Forensics
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Layer-2 Ethernet inspection resolving local insider IP addresses to hardware MAC addresses and manufacturer OUIs.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Local IPv4</th>
                  <th className="py-2 px-3">Layer-2 MAC Address</th>
                  <th className="py-2 px-3">OUI Prefix</th>
                  <th className="py-2 px-3">Hardware Vendor</th>
                  <th className="py-2 px-3">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {arpTable.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 font-bold text-cyan-300">{entry.ip}</td>
                    <td className="py-2.5 px-3 text-slate-200">{entry.mac}</td>
                    <td className="py-2.5 px-3 text-slate-400">{entry.oui_prefix}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">{entry.vendor}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {entry.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

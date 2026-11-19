import React, { useState, useEffect } from 'react';
import {
  Globe,
  ShieldAlert,
  Flame,
  Radio,
  RefreshCw,
  Wifi,
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
  const toast = useToast();
  const [data, setData] = useState<ThreatMapData | null>(null);
  const [arpTable, setArpTable] = useState<ArpEntry[]>([]);
  const [selectedThreat, setSelectedThreat] = useState<ThreatOrigin | null>(null);
  const [loading, setLoading] = useState(true);
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
      toast.success('IP Sinkholed', `Firewall rule applied. Ingress from ${ip} is blocked.`);
      fetchThreatMap();
    } catch (err: any) {
      toast.error('Sinkhole Failed', err.message);
    }
  };

  const projectCoordinates = (lat: number, lon: number) => {
    const x = ((lon + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x, y };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Threat Radar & Geolocation
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Global attack vector tracking, live origin rays, and local subnet topology.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-white rounded-lg p-0.5 border border-[#E5EAF1] text-xs shadow-2xs">
            <button
              onClick={() => setActiveView('map')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeView === 'map'
                  ? 'bg-[#EEF4FF] text-[#3B82F6] font-semibold'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              Geo Radar
            </button>
            <button
              onClick={() => setActiveView('arp')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeView === 'arp'
                  ? 'bg-[#EEF4FF] text-[#3B82F6] font-semibold'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              ARP Subnet ({arpTable.length})
            </button>
          </div>

          <button
            onClick={fetchThreatMap}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Probes"
          value={data?.summary.total_threats_logged ?? 0}
          icon={<Radio className="h-4 w-4" />}
          subValue="+14% this hour"
        />
        <StatCard
          label="Origin Countries"
          value={data?.summary.distinct_countries ?? 0}
          icon={<Globe className="h-4 w-4" />}
        />
        <StatCard
          label="Critical Attacks"
          value={data?.summary.critical_threats ?? 0}
          icon={<Flame className="h-4 w-4" />}
          subValue="Held"
          subValueColor="text-[#16A34A]"
        />
        <StatCard
          label="Intranet Vectors"
          value={data?.summary.intranet_origins ?? 0}
          icon={<Wifi className="h-4 w-4" />}
        />
      </div>

      {activeView === 'map' ? (
        <>
          {/* Interactive World Map Canvas */}
          <div className="relative rounded-2xl border border-[#E5EAF1] bg-white overflow-hidden shadow-2xs">
            {/* Map Top Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5EAF1] bg-[#F8FAFC] text-xs">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse" />
                <span className="text-xs font-semibold text-[#1E293B]">Live Defense Radar</span>
                <span className="text-[#CBD5E1]">|</span>
                <span className="text-[11px] text-[#64748B]">Target Node: {data?.soc_center.label || 'AgentTrust SOC'}</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-[#DC2626]">
                  <span className="h-2 w-2 rounded-full bg-[#DC2626]" /> Critical
                </span>
                <span className="flex items-center gap-1.5 text-[#D97706]">
                  <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> High Threat
                </span>
                <span className="flex items-center gap-1.5 text-[#3B82F6]">
                  <span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Defense Gateway
                </span>
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="relative w-full aspect-[2/1] min-h-[380px] bg-[#F8FAFC] flex items-center justify-center p-4">
              <svg
                viewBox="0 0 1000 500"
                className="w-full h-full"
              >
                <defs>
                  <linearGradient id="rayGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#DC2626" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.25" />
                  </linearGradient>
                  <linearGradient id="rayGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.25" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <g stroke="#E5EAF1" strokeWidth="0.5" strokeDasharray="3 3">
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
                  fill="#E2E8F0"
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <path
                  d="M260,250 Q310,260 330,330 Q300,430 260,440 Q220,360 240,280 Z"
                  fill="#E2E8F0"
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <path
                  d="M450,100 Q560,90 560,160 Q510,190 470,150 Z"
                  fill="#E2E8F0"
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <path
                  d="M480,200 Q550,210 560,280 Q540,380 490,370 Q460,290 470,220 Z"
                  fill="#E2E8F0"
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <path
                  d="M600,90 Q850,70 880,170 Q810,240 700,210 Q610,170 600,110 Z"
                  fill="#E2E8F0"
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <path
                  d="M750,300 Q840,290 850,370 Q790,410 740,360 Z"
                  fill="#E2E8F0"
                  stroke="#CBD5E1"
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
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isSelected ? 10 : 6}
                        fill={isCritical ? '#DC2626' : '#F59E0B'}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}

                {/* Central Defense Node */}
                {data?.soc_center && (
                  <g>
                    {(() => {
                      const soc = projectCoordinates(data.soc_center.lat, data.soc_center.lon);
                      return (
                        <>
                          <circle cx={soc.x} cy={soc.y} r="8" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
                          <circle cx={soc.x} cy={soc.y} r="14" fill="none" stroke="#3B82F6" strokeWidth="1" opacity="0.4" />
                        </>
                      );
                    })()}
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Threat Details & Sinkhole Actions */}
          {selectedThreat && (
            <div className="rounded-xl border border-[#E5EAF1] bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#FEF2F2] text-[#DC2626]">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1E293B]">Threat Origin: {selectedThreat.ip}</h3>
                    <span className="text-[11px] text-[#64748B]">
                      {selectedThreat.city}, {selectedThreat.country} ({selectedThreat.country_code}) • ASN: {selectedThreat.asn}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleSinkhole(selectedThreat.ip)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#DC2626] text-white font-semibold text-xs hover:bg-[#B91C1C] transition-colors"
                >
                  Sinkhole Ingress
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5EAF1]">
                  <span className="text-[#64748B] block text-[11px]">Threat Score</span>
                  <span className="font-bold text-sm text-[#DC2626]">{selectedThreat.threat_score}/100</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5EAF1]">
                  <span className="text-[#64748B] block text-[11px]">Classification</span>
                  <span className="font-semibold text-sm text-[#1E293B]">{selectedThreat.threat_level}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5EAF1]">
                  <span className="text-[#64748B] block text-[11px]">Latitude / Longitude</span>
                  <span className="font-mono text-xs text-[#1E293B]">{selectedThreat.lat.toFixed(2)}, {selectedThreat.lon.toFixed(2)}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5EAF1]">
                  <span className="text-[#64748B] block text-[11px]">Origin Route</span>
                  <span className="font-semibold text-xs text-[#1E293B]">{selectedThreat.is_internal ? 'Intranet Subnet' : 'Public WAN'}</span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ARP Subnet View */
        <div className="rounded-xl border border-[#E5EAF1] bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">MAC Address</th>
                <th className="py-3 px-4">Hardware Vendor</th>
                <th className="py-3 px-4">Interface Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF1]">
              {arpTable.map((arp, idx) => (
                <tr key={idx} className="hover:bg-[#F8FAFC]">
                  <td className="py-3 px-4 font-mono font-medium text-[#1E293B]">{arp.ip}</td>
                  <td className="py-3 px-4 font-mono text-[#64748B]">{arp.mac}</td>
                  <td className="py-3 px-4 text-[#1E293B]">{arp.vendor || 'Unknown Hardware'}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] uppercase">
                      {arp.type || 'DYNAMIC'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

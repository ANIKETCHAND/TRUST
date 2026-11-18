import React from 'react';
import {
  CheckCircle,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
} from 'lucide-react';
import type {
  AgentStatus,
  DelegationStatus,
  IncidentSeverity,
  IncidentStatus,
  PolicyDecision,
  TrustLevel,
} from '../../types';

export const StatusBadge: React.FC<{
  status: AgentStatus | DelegationStatus | IncidentStatus | string;
  size?: 'sm' | 'md';
}> = ({ status, size = 'sm' }) => {
  const norm = (status || '').toString().toLowerCase();
  const py = size === 'sm' ? 'py-0.5' : 'py-1';
  const px = size === 'sm' ? 'px-2' : 'px-2.5';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';

  if (norm === 'active' || norm === 'resolved' || norm === 'healthy' || norm === 'online') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${text} ${px} ${py} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}
        title={`Status: ${status}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="capitalize">{status.toLowerCase()}</span>
      </span>
    );
  }
  if (norm === 'revoked' || norm === 'open' || norm === 'critical' || norm === 'blocked' || norm === 'contained') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${text} ${px} ${py} bg-rose-500/10 text-rose-400 border border-rose-500/20`}
        title={`Status: ${status}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        <span className="capitalize">{status.toLowerCase()}</span>
      </span>
    );
  }
  if (norm === 'investigating' || norm === 'acknowledged' || norm === 'held') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${text} ${px} ${py} bg-blue-500/10 text-blue-400 border border-blue-500/20`}
        title={`Status: ${status}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="capitalize">{status.toLowerCase()}</span>
      </span>
    );
  }
  if (norm === 'warning' || norm === 'false_positive' || norm === 'suspended') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${text} ${px} ${py} bg-amber-500/10 text-amber-400 border border-amber-500/20`}
        title={`Status: ${status}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="capitalize">{status.toLowerCase().replace('_', ' ')}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${text} ${px} ${py} bg-white/5 text-slate-300 border border-white/10`}
      title={`Status: ${status}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      <span className="capitalize">{(status || 'unknown').toLowerCase()}</span>
    </span>
  );
};

export const DecisionBadge: React.FC<{ decision: PolicyDecision | string }> = ({ decision }) => {
  const norm = (decision || '').toUpperCase();
  if (norm === 'ALLOWED' || norm === 'PERMIT') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20"
        title="Decision: ALLOWED"
      >
        <CheckCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Allowed</span>
      </span>
    );
  }
  if (norm === 'REQUIRES_APPROVAL' || norm === 'HELD') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20"
        title="Decision: HELD"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Review</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-500/20"
      title="Decision: BLOCKED"
    >
      <ShieldX className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>Blocked</span>
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: IncidentSeverity | string }> = ({ severity }) => {
  const norm = (severity || 'LOW').toUpperCase();
  switch (norm) {
    case 'CRITICAL':
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-500/25"
          title="Incident Severity: CRITICAL"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span>Critical</span>
        </span>
      );
    case 'HIGH':
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/25"
          title="Incident Severity: HIGH"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>High</span>
        </span>
      );
    case 'MEDIUM':
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/25"
          title="Incident Severity: MEDIUM"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span>Medium</span>
        </span>
      );
    default:
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-400 border border-white/10"
          title="Incident Severity: LOW"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          <span>Low</span>
        </span>
      );
  }
};

export const TrustBadge: React.FC<{ level?: TrustLevel | string; trust?: TrustLevel | string }> = ({
  level,
  trust,
}) => {
  const effective = (level || trust || 'MEDIUM').toString().toUpperCase();
  if (effective === 'HIGH' || effective === 'ADMIN' || effective === 'VERIFIED') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-kali-cyan border border-cyan-500/25"
        title={`Trust Level: ${effective}`}
      >
        <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Verified</span>
      </span>
    );
  }
  if (effective === 'MEDIUM') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/25"
        title={`Trust Level: ${effective}`}
      >
        <span>Standard</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-400 border border-white/10"
      title={`Trust Level: ${effective}`}
    >
      <span>Restricted</span>
    </span>
  );
};

import React from 'react';
import {
  CheckCircle,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  XCircle,
  AlertTriangle,
  Clock,
  Info,
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
        className={`inline-flex items-center gap-1 rounded font-mono font-semibold ${text} ${px} ${py} bg-[#0E2E22] text-[#16A36A] border border-[#155E42]`}
        title={`Status: ${status}`}
      >
        <CheckCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{status.toUpperCase()}</span>
      </span>
    );
  }
  if (norm === 'revoked' || norm === 'open' || norm === 'critical' || norm === 'blocked' || norm === 'contained') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-mono font-semibold ${text} ${px} ${py} bg-[#331418] text-[#DC4C55] border border-[#7A1F26]`}
        title={`Status: ${status}`}
      >
        <ShieldX className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{status.toUpperCase()}</span>
      </span>
    );
  }
  if (norm === 'investigating' || norm === 'acknowledged' || norm === 'held') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-mono font-semibold ${text} ${px} ${py} bg-[#0F2240] text-[#367BF5] border border-[#1D4ED8]`}
        title={`Status: ${status}`}
      >
        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{status.toUpperCase()}</span>
      </span>
    );
  }
  if (norm === 'warning' || norm === 'false_positive' || norm === 'suspended') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-mono font-semibold ${text} ${px} ${py} bg-[#2E200C] text-[#D99A35] border border-[#6E4C19]`}
        title={`Status: ${status}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{status.toUpperCase()}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono font-semibold ${text} ${px} ${py} bg-[#151E2D] text-slate-300 border border-[#1E293B]`}
      title={`Status: ${status}`}
    >
      <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{(status || 'UNKNOWN').toUpperCase()}</span>
    </span>
  );
};

export const DecisionBadge: React.FC<{ decision: PolicyDecision | string }> = ({ decision }) => {
  const norm = (decision || '').toUpperCase();
  if (norm === 'ALLOWED' || norm === 'PERMIT') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-[#0E2E22] px-2 py-0.5 text-[10px] font-mono font-bold text-[#16A36A] border border-[#155E42]"
        title="Decision: ALLOWED"
      >
        <CheckCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>[PASS] ALLOWED</span>
      </span>
    );
  }
  if (norm === 'REQUIRES_APPROVAL' || norm === 'HELD') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-[#2E200C] px-2 py-0.5 text-[10px] font-mono font-bold text-[#D99A35] border border-[#6E4C19]"
        title="Decision: HELD"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>[HELD] REVIEW</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-[#331418] px-2 py-0.5 text-[10px] font-mono font-bold text-[#DC4C55] border border-[#7A1F26]"
      title="Decision: BLOCKED"
    >
      <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>[DENY] BLOCKED</span>
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: IncidentSeverity | string }> = ({ severity }) => {
  const norm = (severity || 'LOW').toUpperCase();
  switch (norm) {
    case 'CRITICAL':
      return (
        <span
          className="inline-flex items-center gap-1 rounded bg-[#331418] px-2 py-0.5 text-[10px] font-mono font-bold text-[#DC4C55] border border-[#7A1F26]"
          title="Incident Severity: CRITICAL"
        >
          <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>[SEV-1] CRITICAL</span>
        </span>
      );
    case 'HIGH':
      return (
        <span
          className="inline-flex items-center gap-1 rounded bg-[#2E200C] px-2 py-0.5 text-[10px] font-mono font-bold text-[#D99A35] border border-[#6E4C19]"
          title="Incident Severity: HIGH"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>[SEV-2] HIGH</span>
        </span>
      );
    case 'MEDIUM':
      return (
        <span
          className="inline-flex items-center gap-1 rounded bg-[#0F2240] px-2 py-0.5 text-[10px] font-mono font-bold text-[#367BF5] border border-[#1D4ED8]"
          title="Incident Severity: MEDIUM"
        >
          <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>[SEV-3] MEDIUM</span>
        </span>
      );
    default:
      return (
        <span
          className="inline-flex items-center gap-1 rounded bg-[#151E2D] px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 border border-[#1E293B]"
          title="Incident Severity: LOW"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
          <span>[SEV-4] LOW</span>
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
        className="inline-flex items-center gap-1 rounded bg-[#0A2633] px-2 py-0.5 text-[10px] font-mono font-semibold text-[#22B8CF] border border-[#125866]"
        title={`Trust Level: ${effective}`}
      >
        <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>TRUST:{effective}</span>
      </span>
    );
  }
  if (effective === 'MEDIUM') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-[#0F2240] px-2 py-0.5 text-[10px] font-mono font-semibold text-[#367BF5] border border-[#1D4ED8]"
        title={`Trust Level: ${effective}`}
      >
        <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>TRUST:{effective}</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-[#151E2D] px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-400 border border-[#1E293B]"
      title={`Trust Level: ${effective}`}
    >
      <span>TRUST:{effective}</span>
    </span>
  );
};

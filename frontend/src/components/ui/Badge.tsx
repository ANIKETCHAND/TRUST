import React from 'react';
import { CheckCircle, ShieldAlert, ShieldCheck, ShieldX, Sparkles, XCircle } from 'lucide-react';
import type { AgentStatus, DelegationStatus, IncidentSeverity, IncidentStatus, PolicyDecision, TrustLevel } from '../../types';

export const StatusBadge: React.FC<{ status: AgentStatus | DelegationStatus | IncidentStatus | string }> = ({ status }) => {
  const norm = status.toLowerCase();
  if (norm === 'active' || norm === 'resolved') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-800/80">
        <CheckCircle className="h-3 w-3" /> {status.toUpperCase()}
      </span>
    );
  }
  if (norm === 'revoked' || norm === 'open') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-800/80">
        <ShieldX className="h-3 w-3" /> {status.toUpperCase()}
      </span>
    );
  }
  if (norm === 'investigating') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-cyan-950/80 px-2 py-0.5 text-[11px] font-semibold text-cyan-400 border border-cyan-800/80">
        {status.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700">
      {status.toUpperCase()}
    </span>
  );
};

export const DecisionBadge: React.FC<{ decision: PolicyDecision | string }> = ({ decision }) => {
  if (decision === 'ALLOWED') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-800/80">
        <CheckCircle className="h-3 w-3" /> ALLOWED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-800/80">
      <XCircle className="h-3 w-3" /> BLOCKED
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: IncidentSeverity | string }> = ({ severity }) => {
  const norm = severity.toUpperCase();
  switch (norm) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-950 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-800">
          <ShieldAlert className="h-3 w-3" /> CRITICAL
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800">
          <ShieldAlert className="h-3 w-3" /> HIGH
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="rounded bg-yellow-950 px-2 py-0.5 text-[10px] font-bold text-yellow-400 border border-yellow-800">
          MEDIUM
        </span>
      );
    default:
      return (
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 border border-slate-700">
          LOW
        </span>
      );
  }
};

export const TrustBadge: React.FC<{ level?: TrustLevel | string; trust?: TrustLevel | string }> = ({ level, trust }) => {
  const effective = (level || trust || 'MEDIUM').toString();
  const norm = effective.toLowerCase();
  if (norm === 'high' || norm === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-cyan-950/80 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 border border-cyan-800/80">
        <ShieldCheck className="h-3 w-3" /> {effective}
      </span>
    );
  }
  if (norm === 'medium') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-indigo-950/80 px-2 py-0.5 text-[11px] font-semibold text-indigo-300 border border-indigo-800/80">
        <Sparkles className="h-3 w-3" /> {effective}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-400 border border-slate-700">
      {effective}
    </span>
  );
};

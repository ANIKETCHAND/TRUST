import React from 'react';
import {
  CheckCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  XCircle,
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
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs';

  if (norm === 'active' || norm === 'resolved' || norm === 'healthy' || norm === 'online') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md font-medium ${text} ${px} ${py} bg-[#E8F7EF] text-[#16A34A] border border-[#BCE8CD]`}
        title={`Status: ${status}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
        <span className="capitalize">{status.toLowerCase()}</span>
      </span>
    );
  }
  if (norm === 'revoked' || norm === 'open' || norm === 'critical' || norm === 'blocked' || norm === 'contained') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md font-medium ${text} ${px} ${py} bg-[#FEF2F2] text-[#DC2626] border border-[#FCD2D2]`}
        title={`Status: ${status}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
        <span className="capitalize">{status.toLowerCase()}</span>
      </span>
    );
  }
  if (norm === 'investigating' || norm === 'acknowledged' || norm === 'held' || norm === 'pending') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md font-medium ${text} ${px} ${py} bg-[#EEF4FF] text-[#3B82F6] border border-[#D4E5FF]`}
        title={`Status: ${status}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
        <span className="capitalize">{status.toLowerCase()}</span>
      </span>
    );
  }
  if (norm === 'warning' || norm === 'false_positive' || norm === 'suspended') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md font-medium ${text} ${px} ${py} bg-[#FFF4E5] text-[#D97706] border border-[#FDE3B7]`}
        title={`Status: ${status}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
        <span className="capitalize">{status.toLowerCase().replace('_', ' ')}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${text} ${px} ${py} bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]`}
      title={`Status: ${status}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]" />
      <span className="capitalize">{(status || 'unknown').toLowerCase()}</span>
    </span>
  );
};

export const DecisionBadge: React.FC<{ decision: PolicyDecision | string }> = ({ decision }) => {
  const norm = (decision || '').toUpperCase();
  if (norm === 'ALLOWED' || norm === 'PERMIT') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-[#E8F7EF] px-2 py-0.5 text-[11px] font-medium text-[#16A34A] border border-[#BCE8CD]"
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
        className="inline-flex items-center gap-1 rounded-md bg-[#FFF4E5] px-2 py-0.5 text-[11px] font-medium text-[#D97706] border border-[#FDE3B7]"
        title="Decision: HELD"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Review</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-medium text-[#DC2626] border border-[#FCD2D2]"
      title="Decision: BLOCKED"
    >
      <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
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
          className="inline-flex items-center gap-1.5 rounded-md bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#DC2626] border border-[#FCD2D2]"
          title="Incident Severity: CRITICAL"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
          <span>Critical</span>
        </span>
      );
    case 'HIGH':
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-[#FFF4E5] px-2 py-0.5 text-[11px] font-medium text-[#D97706] border border-[#FDE3B7]"
          title="Incident Severity: HIGH"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
          <span>High</span>
        </span>
      );
    case 'MEDIUM':
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-[#EEF4FF] px-2 py-0.5 text-[11px] font-medium text-[#2563EB] border border-[#D4E5FF]"
          title="Incident Severity: MEDIUM"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
          <span>Medium</span>
        </span>
      );
    default:
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-medium text-[#64748B] border border-[#E2E8F0]"
          title="Incident Severity: LOW"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]" />
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
  if (effective === 'HIGH' || effective === 'ADMIN' || effective === 'VERIFIED' || effective === 'TRUSTED') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-[#E8F7EF] px-2 py-0.5 text-[11px] font-medium text-[#16A34A] border border-[#BCE8CD]"
        title={`Trust Level: ${effective}`}
      >
        <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Trusted</span>
      </span>
    );
  }
  if (effective === 'SANITIZED') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-[#EEF4FF] px-2 py-0.5 text-[11px] font-medium text-[#2563EB] border border-[#D4E5FF]"
        title={`Trust Level: ${effective}`}
      >
        <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Sanitized</span>
      </span>
    );
  }
  if (effective === 'MEDIUM' || effective === 'STANDARD') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-[#FFF4E5] px-2 py-0.5 text-[11px] font-medium text-[#D97706] border border-[#FDE3B7]"
        title={`Trust Level: ${effective}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Standard</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-medium text-[#DC2626] border border-[#FCD2D2]"
      title={`Trust Level: ${effective}`}
    >
      <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>Untrusted</span>
    </span>
  );
};

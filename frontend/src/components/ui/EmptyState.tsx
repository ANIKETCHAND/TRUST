import React from 'react';
import { Shield, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Shield,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-12 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-kali-cyan mb-4 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs text-slate-400">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white hover:border-kali-cyan/40 hover:bg-white/[0.08] transition-all"
        >
          {action.icon && React.createElement(action.icon, { className: 'h-3.5 w-3.5 text-kali-cyan' })}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};

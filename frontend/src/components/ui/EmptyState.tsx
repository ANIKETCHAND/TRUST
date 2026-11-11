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
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-kali-border bg-kali-card/50 p-10 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-kali-border bg-kali-bg text-kali-cyan/70 mb-3 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <div className="font-mono text-xs uppercase tracking-wider text-kali-primary font-bold">
        // NO_TELEMETRY_RECORD
      </div>
      <h3 className="mt-1 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-400 font-sans">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-elevated px-3 py-1.5 font-mono text-xs font-semibold text-white hover:border-kali-primary hover:bg-kali-secondary transition-colors"
        >
          {action.icon && React.createElement(action.icon, { className: 'h-3.5 w-3.5 text-kali-cyan' })}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};

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
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center ${className}`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4E5FF] bg-[#EEF4FF] text-[#3B82F6] mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#1E293B]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-[#64748B] leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#2563EB] shadow-2xs transition-all"
        >
          {action.icon && React.createElement(action.icon, { className: 'h-3.5 w-3.5' })}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};

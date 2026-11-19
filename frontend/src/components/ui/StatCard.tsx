import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  subValueColor?: string;
  description?: string;
  icon: React.ReactNode;
  tag?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  subValueColor = 'text-[var(--ink-2)]',
  description,
  icon,
  tag,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] p-4.5 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-[var(--accent)]/50 hover:shadow-xs' : 'hover:border-[var(--line)]'
      } shadow-[0_4px_16px_rgba(90,105,130,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tag && (
            <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-[var(--accent-ink)] bg-[var(--tint)] border border-[var(--line)] px-1.5 py-0.5 rounded">
              {tag.replace(/[\[\]]/g, '')}
            </span>
          )}
          <span className="text-[11px] font-semibold text-[var(--ink-2)] tracking-wider uppercase">
            {label}
          </span>
        </div>
        <div className="text-[var(--accent)] p-1.5 rounded-lg bg-[var(--tint)] border border-[var(--line-2)]">
          {icon}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-[var(--ink)]">
          {value}
        </span>
        {subValue && (
          <span className={`text-xs font-medium ${subValueColor}`}>
            {subValue}
          </span>
        )}
      </div>

      {description && (
        <div className="mt-1 text-xs text-[var(--ink-2)] line-clamp-1">
          {description}
        </div>
      )}
    </div>
  );
};

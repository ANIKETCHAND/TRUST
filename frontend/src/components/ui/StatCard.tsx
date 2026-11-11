import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  subValueColor?: string;
  description?: string;
  icon: React.ReactNode;
  tag?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  subValueColor = 'text-slate-400',
  description,
  icon,
  tag,
}) => {
  return (
    <div className="relative overflow-hidden rounded-lg border border-kali-border bg-kali-card p-4 transition-all duration-150 hover:border-kali-borderLight hover:bg-kali-elevated/70 shadow-kali-card">
      {/* Subtle top indicator bar */}
      <div className="flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-1.5">
          {tag && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-kali-primary/80">
              [{tag}]
            </span>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            {label}
          </span>
        </div>
        <div className="text-kali-primary shrink-0 opacity-90">{icon}</div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-2xl lg:text-3xl font-bold tracking-tight text-white">
          {value}
        </span>
        {subValue && (
          <span className={`font-mono text-xs font-semibold ${subValueColor}`}>
            {subValue}
          </span>
        )}
      </div>

      {description && (
        <div className="mt-2 text-[11px] text-slate-400/90 font-sans flex items-center gap-1">
          <span className="text-kali-borderLight font-mono">›</span>
          <span className="truncate">{description}</span>
        </div>
      )}
    </div>
  );
};

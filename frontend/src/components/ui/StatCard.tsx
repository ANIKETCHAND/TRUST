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
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.045] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tag && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-kali-cyan bg-kali-cyan/10 border border-kali-cyan/20 px-1.5 py-0.5 rounded">
              {tag.replace(/[\[\]]/g, '')}
            </span>
          )}
          <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
            {label}
          </span>
        </div>
        <div className="text-slate-400 p-1.5 rounded-lg bg-white/[0.03] border border-white/5">{icon}</div>
      </div>

      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="font-mono text-2xl lg:text-3xl font-bold tracking-tight text-white">
          {value}
        </span>
        {subValue && (
          <span className={`text-xs font-medium ${subValueColor}`}>
            {subValue}
          </span>
        )}
      </div>

      {description && (
        <div className="mt-2 text-xs text-slate-400 line-clamp-1">
          {description}
        </div>
      )}
    </div>
  );
};

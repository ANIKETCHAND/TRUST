import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  subValueColor?: string;
  description?: string;
  icon: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  subValueColor = 'text-slate-400',
  description,
  icon,
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur transition-all hover:border-slate-700">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold text-white">{value}</span>
        {subValue && <span className={`text-xs font-medium ${subValueColor}`}>{subValue}</span>}
      </div>
      {description && <div className="mt-2 text-xs text-slate-500">{description}</div>}
    </div>
  );
};

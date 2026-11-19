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
  subValueColor = 'text-[#64748B]',
  description,
  icon,
  tag,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-[#E5EAF1] bg-white p-4.5 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-[#3B82F6]/50 hover:shadow-xs' : 'hover:border-[#CBD5E1]'
      } shadow-2xs`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tag && (
            <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-[#3B82F6] bg-[#EEF4FF] border border-[#D4E5FF] px-1.5 py-0.5 rounded">
              {tag.replace(/[\[\]]/g, '')}
            </span>
          )}
          <span className="text-[11px] font-semibold text-[#64748B] tracking-wider uppercase">
            {label}
          </span>
        </div>
        <div className="text-[#3B82F6] p-1.5 rounded-lg bg-[#EEF4FF] border border-[#E0EDFF]">
          {icon}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-[#1E293B]">
          {value}
        </span>
        {subValue && (
          <span className={`text-xs font-medium ${subValueColor}`}>
            {subValue}
          </span>
        )}
      </div>

      {description && (
        <div className="mt-1 text-xs text-[#64748B] line-clamp-1">
          {description}
        </div>
      )}
    </div>
  );
};

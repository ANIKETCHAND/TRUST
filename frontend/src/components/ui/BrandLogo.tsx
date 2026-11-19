import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = true,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
    xl: 'h-12 w-12',
  }[size];

  const titleSize = {
    sm: 'text-xs',
    md: 'text-sm font-semibold',
    lg: 'text-base font-bold',
    xl: 'text-lg font-bold',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* AgentTrust Shield & AI Gateway Symbol */}
      <div
        className={`relative flex ${iconDimensions} shrink-0 items-center justify-center rounded-lg border border-[#E5EAF1] bg-[#EEF4FF] shadow-xs`}
      >
        <svg viewBox="0 0 32 32" fill="none" className="h-[75%] w-[75%]">
          <defs>
            <linearGradient id="atBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>
          {/* Hexagonal Shield Outline */}
          <path
            d="M16 3 L27 8 V17 C27 23.5 22 28 16 30 C10 28 5 23.5 5 17 V8 Z"
            stroke="url(#atBlueGrad)"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="#FFFFFF"
          />
          {/* Central AI Gateway Node */}
          <circle cx="16" cy="14" r="2.2" fill="#3B82F6" />
          <circle cx="11.5" cy="20" r="1.6" fill="#60A5FA" />
          <circle cx="20.5" cy="20" r="1.6" fill="#60A5FA" />
          <circle cx="16" cy="24.5" r="1.3" fill="#16A34A" />

          {/* Connection vectors */}
          <line x1="16" y1="14" x2="11.5" y2="20" stroke="#3B82F6" strokeWidth="1.4" />
          <line x1="16" y1="14" x2="20.5" y2="20" stroke="#3B82F6" strokeWidth="1.4" />
          <line x1="11.5" y1="20" x2="16" y2="24.5" stroke="#60A5FA" strokeWidth="1.2" />
          <line x1="20.5" y1="20" x2="16" y2="24.5" stroke="#60A5FA" strokeWidth="1.2" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className={`${titleSize} tracking-tight text-[#1E293B]`}>
            Agent<span className="text-[#3B82F6] font-bold">Trust</span>
          </div>
          {showSubtitle && (
            <div className="text-[10px] font-medium tracking-wide text-[#64748B] mt-0.5">
              AI Security Platform
            </div>
          )}
        </div>
      )}
    </div>
  );
};

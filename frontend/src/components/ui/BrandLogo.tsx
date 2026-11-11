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
    xl: 'h-14 w-14',
  }[size];

  const titleSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-xl',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Kali-inspired Minimal Geometric Shield & Connected Node Symbol */}
      <div
        className={`relative flex ${iconDimensions} shrink-0 items-center justify-center rounded-lg border border-kali-primary/40 bg-kali-card shadow-sm transition-transform hover:border-kali-primary`}
      >
        <svg viewBox="0 0 32 32" fill="none" className="h-[75%] w-[75%]">
          <defs>
            <linearGradient id="shieldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#367BF5" />
              <stop offset="100%" stopColor="#22B8CF" />
            </linearGradient>
          </defs>
          {/* Hexagonal Shield Outline */}
          <path
            d="M16 3 L27 8 V17 C27 23.5 22 28 16 30 C10 28 5 23.5 5 17 V8 Z"
            stroke="url(#shieldStroke)"
            strokeWidth="1.8"
            strokeLinejoin="round"
            fill="#0D1420"
          />
          {/* Inner Node Network */}
          <circle cx="16" cy="14" r="2.2" fill="#367BF5" />
          <circle cx="11.5" cy="20" r="1.6" fill="#22B8CF" />
          <circle cx="20.5" cy="20" r="1.6" fill="#22B8CF" />
          <circle cx="16" cy="24.5" r="1.3" fill="#16A36A" />

          {/* Connection vectors */}
          <line x1="16" y1="14" x2="11.5" y2="20" stroke="#367BF5" strokeWidth="1.2" />
          <line x1="16" y1="14" x2="20.5" y2="20" stroke="#367BF5" strokeWidth="1.2" />
          <line x1="11.5" y1="20" x2="16" y2="24.5" stroke="#22B8CF" strokeWidth="1" />
          <line x1="20.5" y1="20" x2="16" y2="24.5" stroke="#22B8CF" strokeWidth="1" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className={`${titleSize} font-bold tracking-wider text-white`}>
            AGENT<span className="text-kali-primary font-extrabold ml-0.5">TRUST</span>
          </div>
          {showSubtitle && (
            <div className="text-[9px] font-mono tracking-widest text-kali-cyan/90 uppercase mt-0.5">
              COMMAND CENTER
            </div>
          )}
        </div>
      )}
    </div>
  );
};

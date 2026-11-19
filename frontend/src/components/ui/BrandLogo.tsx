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
  const markSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-9 h-9',
  }[size];

  const titleSize = {
    sm: 'text-xs',
    md: 'text-sm font-medium',
    lg: 'text-base font-medium',
    xl: 'text-lg font-medium',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Ferrow Signature Brand Mark */}
      <span
        className={`${markSize} shrink-0`}
        style={{
          background: 'var(--accent)',
          clipPath: 'polygon(0 0, 100% 0, 100% 62.5%, 62.5% 100%, 0 100%)',
        }}
        aria-hidden="true"
      />

      {showText && (
        <div className="flex flex-col leading-none">
          <div className={`${titleSize} tracking-tight text-[var(--ink)] font-sans`}>
            Cross<span className="text-[var(--accent)] font-semibold">X</span>
          </div>
          {showSubtitle && (
            <div className="text-[10px] font-mono tracking-wider uppercase text-[var(--ink-2)] mt-0.5">
              Zero-Trust SOC
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BrandLogo;

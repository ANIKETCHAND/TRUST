import React from 'react';
import { Loader2, Radio } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'INITIALIZING TELEMETRY STREAM...',
  size = 'md',
  fullScreen = false,
}) => {
  const spinnerSize = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-9 w-9',
  }[size];

  const content = (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="relative flex items-center justify-center">
        <Radio className={`${spinnerSize} animate-ping text-kali-cyan/40 absolute`} />
        <Loader2 className={`${spinnerSize} animate-spin text-kali-primary`} />
      </div>
      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider text-kali-cyan">
        <span>›</span>
        <span>{message}</span>
      </div>
      <div className="font-mono text-[10px] text-slate-500">
        SECURITY PROTOCOL: DETERMINISTIC_SOC
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-kali-bg/95 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return content;
};

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'TELEMETRY AGGREGATION IN PROGRESS...',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-5 w-5',
    lg: 'h-7 w-7',
  };

  const containerPadding = {
    sm: 'p-2',
    md: 'py-8',
    lg: 'py-16',
  };

  return (
    <div className={`flex items-center justify-center ${containerPadding[size]}`}>
      <div className="flex items-center gap-3 text-cyan-400">
        <RefreshCw className={`${sizeClasses[size]} animate-spin`} />
        {message && <span className="font-mono text-xs tracking-wider">{message}</span>}
      </div>
    </div>
  );
};

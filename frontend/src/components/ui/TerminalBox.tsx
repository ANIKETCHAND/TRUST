import React, { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

interface TerminalBoxProps {
  title?: string;
  command?: string;
  children: React.ReactNode;
  maxHeight?: string;
  copyContent?: string;
  className?: string;
}

export const TerminalBox: React.FC<TerminalBoxProps> = ({
  title = 'Console Output',
  command,
  children,
  maxHeight = 'max-h-72',
  copyContent,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!copyContent) return;
    navigator.clipboard.writeText(copyContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/10 bg-black/80 font-mono shadow-sm ${className}`}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Terminal className="h-3.5 w-3.5 text-kali-cyan" />
            <span>{title}</span>
          </div>
        </div>

        {copyContent && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 hover:border-kali-cyan/40 hover:text-white transition-all"
            title="Copy buffer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-kali-cyan" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Optional Command Prompt line */}
      {command && (
        <div className="border-b border-white/5 bg-white/[0.015] px-4 py-2 text-xs text-kali-cyan flex items-center gap-2">
          <span className="text-kali-primary font-semibold">$</span>
          <span className="text-white font-medium">{command}</span>
        </div>
      )}

      {/* Body */}
      <div
        className={`p-4 overflow-y-auto text-xs leading-relaxed text-slate-300 font-mono-tech ${maxHeight}`}
      >
        {children}
      </div>
    </div>
  );
};

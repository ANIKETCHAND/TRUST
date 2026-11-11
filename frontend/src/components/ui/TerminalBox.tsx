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
  title = 'TERMINAL // AGENTTRUST_CLI',
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
      className={`overflow-hidden rounded-lg border border-kali-border bg-kali-bg font-mono shadow-kali-card ${className}`}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b border-kali-border bg-kali-secondary/90 px-3.5 py-2">
        <div className="flex items-center gap-2">
          {/* Kali Linux terminal dots */}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-kali-critical/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-kali-warning/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-kali-secure/80 inline-block" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 ml-2">
            <Terminal className="h-3.5 w-3.5 text-kali-primary" />
            <span>{title}</span>
          </div>
        </div>

        {copyContent && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded border border-kali-border bg-kali-elevated/70 px-2 py-0.5 text-[10px] text-slate-300 hover:border-kali-primary hover:text-white transition-colors"
            title="Copy terminal buffer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-kali-secure" />
                <span className="text-kali-secure">COPIED</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-kali-cyan" />
                <span>COPY</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Optional Command Prompt line */}
      {command && (
        <div className="border-b border-kali-border/50 bg-[#070A0F] px-3.5 py-1.5 text-xs text-kali-cyan flex items-center gap-1.5">
          <span className="text-kali-primary font-bold">root@agenttrust:~#</span>
          <span className="text-white font-medium">{command}</span>
        </div>
      )}

      {/* Body */}
      <div
        className={`p-3.5 overflow-y-auto text-xs leading-relaxed text-slate-300 font-mono-tech ${maxHeight}`}
      >
        {children}
      </div>
    </div>
  );
};

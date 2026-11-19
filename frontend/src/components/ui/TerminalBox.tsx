import React, { useState } from 'react';
import { Code, Copy, Check } from 'lucide-react';

interface TerminalBoxProps {
  title?: string;
  command?: string;
  children: React.ReactNode;
  maxHeight?: string;
  copyContent?: string;
  className?: string;
}

export const TerminalBox: React.FC<TerminalBoxProps> = ({
  title = 'Output',
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
      className={`overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-2)] shadow-2xs ${className}`}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink)]">
          <Code className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>{title}</span>
        </div>

        {copyContent && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md border border-[var(--line-2)] bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--bg-2)] transition-all"
            title="Copy buffer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[#16A34A]" />
                <span className="text-[#16A34A] font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-[var(--ink-2)]" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Optional Command Prompt line */}
      {command && (
        <div className="border-b border-[var(--line)] bg-[var(--bg)] px-4 py-1.5 text-xs text-[var(--accent)] font-mono flex items-center gap-2">
          <span className="text-[var(--ink-3)] font-semibold">$</span>
          <span className="text-[var(--ink)] font-medium">{command}</span>
        </div>
      )}

      {/* Body */}
      <div
        className={`p-4 overflow-y-auto text-xs leading-relaxed text-[var(--ink)] font-mono ${maxHeight}`}
      >
        {children}
      </div>
    </div>
  );
};

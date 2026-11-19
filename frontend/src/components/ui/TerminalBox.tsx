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
      className={`overflow-hidden rounded-xl border border-[#E5EAF1] bg-[#F8FAFC] shadow-2xs ${className}`}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b border-[#E5EAF1] bg-white px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-[#1E293B]">
          <Code className="h-3.5 w-3.5 text-[#3B82F6]" />
          <span>{title}</span>
        </div>

        {copyContent && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md border border-[#E5EAF1] bg-[#F8FAFC] px-2 py-0.5 text-[11px] text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9] transition-all"
            title="Copy buffer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[#16A34A]" />
                <span className="text-[#16A34A] font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-[#64748B]" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Optional Command Prompt line */}
      {command && (
        <div className="border-b border-[#E5EAF1] bg-[#F1F5F9] px-4 py-1.5 text-xs text-[#3B82F6] font-mono flex items-center gap-2">
          <span className="text-[#64748B] font-semibold">$</span>
          <span className="text-[#1E293B] font-medium">{command}</span>
        </div>
      )}

      {/* Body */}
      <div
        className={`p-4 overflow-y-auto text-xs leading-relaxed text-[#1E293B] font-mono ${maxHeight}`}
      >
        {children}
      </div>
    </div>
  );
};

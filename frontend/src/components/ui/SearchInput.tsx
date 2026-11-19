import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  shortcutHint?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Filter...',
  className = '',
  shortcutHint,
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3.5 h-3.5 w-3.5 text-[#64748B] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#E5EAF1] bg-white pl-9 pr-9 py-2 text-xs text-[#1E293B] placeholder-[#94A3B8] transition-all focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] shadow-2xs"
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 rounded p-0.5 text-[#94A3B8] hover:text-[#1E293B] transition-colors"
          title="Clear search"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      ) : shortcutHint ? (
        <span className="absolute right-3 font-mono text-[10px] text-[#94A3B8] pointer-events-none">
          {shortcutHint}
        </span>
      ) : null}
    </div>
  );
};

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
      <Search className="absolute left-3.5 h-3.5 w-3.5 text-kali-cyan/80 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 transition-all focus:border-kali-cyan/50 focus:bg-white/[0.05] focus:outline-none"
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 rounded p-0.5 text-slate-400 hover:text-white transition-colors"
          title="Clear search"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      ) : shortcutHint ? (
        <span className="absolute right-3 font-mono text-[10px] text-slate-500 pointer-events-none">
          {shortcutHint}
        </span>
      ) : null}
    </div>
  );
};

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
  placeholder = 'Query filter...',
  className = '',
  shortcutHint,
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3 h-3.5 w-3.5 text-kali-cyan/70 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-kali-border bg-kali-bg/90 pl-9 pr-8 py-1.5 font-mono text-xs text-white placeholder-slate-500 transition-colors focus:border-kali-primary focus:bg-kali-secondary focus:outline-none"
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 rounded p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
          title="Clear search"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      ) : shortcutHint ? (
        <span className="absolute right-2.5 font-mono text-[10px] text-slate-500 pointer-events-none">
          {shortcutHint}
        </span>
      ) : null}
    </div>
  );
};

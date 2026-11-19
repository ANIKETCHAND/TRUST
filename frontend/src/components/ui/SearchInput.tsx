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
      <Search className="absolute left-3.5 h-3.5 w-3.5 text-[var(--ink-3)] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--card)] pl-9 pr-9 py-2 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] transition-all focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] shadow-[inset_0_1px_2px_rgba(90,105,130,0.06)]"
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 rounded p-0.5 text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          title="Clear search"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      ) : shortcutHint ? (
        <span className="absolute right-3 font-mono text-[10px] text-[var(--ink-3)] pointer-events-none">
          {shortcutHint}
        </span>
      ) : null}
    </div>
  );
};

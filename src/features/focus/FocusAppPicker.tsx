import { useMemo, useRef, useState } from 'react';
import { Check, X, Search, Globe } from 'lucide-react';

export interface KnownApp {
  app: string;
  category: string;
  last_used: string;
  is_browser_tracking?: number;
}

interface FocusAppPickerProps {
  knownApps: KnownApp[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  addLabel?: string;
  showBrowserBadge?: boolean;
}

export function FocusAppPicker({
  knownApps,
  selected,
  onChange,
  placeholder = 'Type to search tracked apps...',
  emptyText = 'Type to search tracked apps...',
  addLabel = "custom app",
  showBrowserBadge = false,
}: FocusAppPickerProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return knownApps;
    return knownApps.filter(a => a.app.toLowerCase().includes(q));
  }, [knownApps, query]);

  const exactMatch = query.trim().length > 0
    && !knownApps.some(a => a.app.toLowerCase() === query.trim().toLowerCase());
  const listItems = exactMatch ? filtered : filtered;
  const customEntry = exactMatch ? query.trim() : null;
  const totalRows = listItems.length + (customEntry ? 1 : 0);

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(totalRows - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= listItems.length && customEntry) {
        toggle(customEntry);
        setQuery('');
      } else if (listItems[activeIndex]) {
        toggle(listItems[activeIndex].app);
      }
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(v => (
            <span
              key={v}
              className="flex items-center gap-1 bg-pink-500/15 text-pink-300 text-[11px] px-2 py-0.5 rounded-md"
            >
              {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                className="text-pink-300/60 hover:text-pink-200"
                aria-label={`Remove ${v}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="bg-zinc-800/40 border border-zinc-800/50 rounded-xl p-3">
        <div className="relative">
          <Search className="w-3 h-3 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="w-full bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg pl-8 pr-3 py-2 text-[13px] text-zinc-200 focus:border-pink-500/40 outline-none placeholder:text-zinc-600"
          />
        </div>

        <div className="max-h-48 overflow-y-auto ws-scroll mt-2">
          {listItems.map((item, index) => {
            const isSelected = selected.includes(item.app);
            const isActive = index === activeIndex;
            return (
              <button
                type="button"
                key={item.app}
                onClick={() => toggle(item.app)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex items-center justify-between w-full px-2 py-1.5 rounded-md text-[12px] transition-colors ${
                  isActive ? 'bg-zinc-700/50' : 'hover:bg-zinc-700/50'
                } ${isSelected ? 'text-pink-300' : 'text-zinc-300'}`}
              >
                <span className="truncate mr-2">{item.app}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {showBrowserBadge && item.is_browser_tracking === 1 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-md">
                      <Globe className="w-2.5 h-2.5" />
                      browser
                    </span>
                  )}
                  {item.category && (
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500">{item.category}</span>
                  )}
                  {isSelected && <Check className="w-3 h-3 text-pink-400" />}
                </span>
              </button>
            );
          })}

          {customEntry && (
            <button
              type="button"
              onClick={() => {
                toggle(customEntry);
                setQuery('');
              }}
              onMouseEnter={() => setActiveIndex(listItems.length)}
              className={`flex items-center justify-between w-full px-2 py-1.5 rounded-md text-[12px] transition-colors ${
                activeIndex >= listItems.length ? 'bg-zinc-700/50' : 'hover:bg-zinc-700/50'
              } text-pink-300`}
            >
              <span className="truncate">+ Add &apos;{customEntry}&apos; as {addLabel}</span>
              <Check className="w-3 h-3 text-pink-400 shrink-0" />
            </button>
          )}

          {listItems.length === 0 && !customEntry && (
            <p className="px-2 py-3 text-[11px] text-zinc-600 text-center">{emptyText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

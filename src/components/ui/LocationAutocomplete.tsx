import { motion } from 'motion/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Plus, X, Loader2 } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { cn } from '../../lib/utils';

interface LocationOption {
  id: string;
  name: string;
  address?: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Called when user creates a new location. Should return the created location's name. */
  onCreateNew?: (name: string) => Promise<string | null> | string | null;
  /** Optional: fetch existing locations (e.g. from DB) */
  fetchLocations?: (query: string) => Promise<LocationOption[]>;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Search or add location...',
  className,
  disabled = false,
  onCreateNew,
  fetchLocations,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setOptions([]); return; }
    setLoading(true);
    try {
      let results: LocationOption[];
      if (fetchLocations) {
        results = await fetchLocations(q);
      } else {
        const api = (window as any).deskflowAPI;
        const res = await api?.getAllLocations?.();
        results = (res?.locations ?? []).map((loc: string) => ({ id: loc, name: loc })).filter(l => l.name.toLowerCase().includes(q.toLowerCase()));
      }
      setOptions(results);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [fetchLocations]);

  useEffect(() => {
    if (query.trim()) {
      search(query);
    } else {
      setOptions([]);
    }
  }, [query, search]);

  const handleSelect = (opt: LocationOption) => {
    onChange(opt.name);
    setQuery(opt.name);
    setOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleCreateNew = async () => {
    if (!onCreateNew || !query.trim()) return;
    const name = query.trim();
    try {
      const created = await onCreateNew(name);
      if (created) {
        onChange(created);
        setQuery(created);
        setOpen(false);
      }
    } catch {
      // error handled by parent
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
        setSelectedIndex(e.key === 'ArrowDown' ? 0 : options.length - 1);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, options.length + (onCreateNew && query.trim() ? 1 : 0) - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < options.length) {
          handleSelect(options[selectedIndex]);
        } else if (selectedIndex === options.length && onCreateNew && query.trim()) {
          handleCreateNew();
        }
        break;
      case 'Escape':
        setOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div className={cn('relative w-full', className)} ref={listRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); onChange(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            aria-label="Clear location"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (options.length > 0 || (onCreateNew && query.trim())) && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="absolute z-50 w-full mt-1 rounded-lg border border-zinc-700 bg-zinc-900 light:bg-[var(--ws-surface-raised)] light:border-zinc-300 shadow-lg overflow-hidden"
        >
          {options.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors',
                selectedIndex === i
                  ? 'bg-zinc-800 light:bg-zinc-100 text-zinc-100 light:text-zinc-900'
                  : 'text-zinc-300 light:text-zinc-700 hover:bg-zinc-800/50 light:hover:bg-zinc-200'
              )}
            >
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-zinc-500 light:text-zinc-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate">{opt.name}</span>
                  {opt.address && <span className="block truncate text-[11px] text-zinc-500 light:text-zinc-400">{opt.address}</span>}
                </div>
              </div>
            </button>
          ))}
          {onCreateNew && query.trim() && (
            <button
              type="button"
              onClick={handleCreateNew}
              onMouseEnter={() => setSelectedIndex(options.length)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors',
                selectedIndex === options.length
                  ? 'bg-zinc-800 light:bg-zinc-100 text-zinc-100 light:text-zinc-900'
                  : 'text-emerald-400 hover:bg-zinc-800/50 light:hover:bg-zinc-200'
              )}
              disabled={loading}
            >
              <Plus size={13} className="flex-shrink-0" />
              <span className="flex-1 truncate">
                {loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin inline mr-1" />
                    Creating...
                  </>
                ) : (
                  `Create "${query.trim()}"`
                )}
              </span>
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Re-export for convenience
export { LocationAutocomplete as default } from './LocationAutocomplete';

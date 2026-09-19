import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Command,
  Hash,
} from 'lucide-react';
import type { SearchHit } from '../services/search/index';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect?: (hit: SearchHit) => void;
  shortcutHint?: string;
}

const DEBOUNCE_MS = 80;
const MAX_RESULTS = 30;
const AUTOCOMPLETE_LIMIT = 8;

interface Result extends SearchHit {}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} className="bg-white/15 text-amber-200 rounded-sm px-0.5">{p}</mark> : p
  );
}

function pageLabel(pageId: string): string {
  const map: Record<string, string> = {
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    settings: 'Settings',
    sessions: 'Sessions',
    activities: 'Activities',
    external: 'External',
    projects: 'Projects',
    browser: 'Browser Profiles',
    ai: 'AI Bridge',
    terminal: 'Terminal',
    gaps: 'Gap Fill',
  };
  return map[pageId] ?? pageId;
}

export default function SmartSearchOverlay({
  open,
  onClose,
  onSelect,
  shortcutHint = '\u2318F',
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; text: string; pageId: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [stats, setStats] = useState<{ indexed: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastQueryRef = useRef('');

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSuggestions([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx, results]);

  useEffect(() => {
    if (!open) return;
    window.deskflowAPI?.smartSearchStats().then(setStats).catch(() => {});
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    lastQueryRef.current = q;
    setLoading(true);
    try {
      const [hits, sug] = await Promise.all([
        window.deskflowAPI?.smartSearchQuery(q, { limit: MAX_RESULTS, ctxChars: 100 }) ?? [],
        window.deskflowAPI?.smartSearchSuggest(q, { limit: q.length >= 2 ? AUTOCOMPLETE_LIMIT : 0 }) ?? [],
      ]);
      setResults(hits as Result[]);
      setSuggestions(sug as Array<{ id: string; text: string; pageId: string }>);
      setActiveIdx(0);
    } catch {
      setResults([]);
      setSuggestions([]);
    }
    setLoading(false);
  }, []);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), DEBOUNCE_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = query.trim() ? results : suggestions;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[activeIdx]) {
      e.preventDefault();
      onSelect?.(items[activeIdx] as Result);
      onClose();
    } else if (e.key === 'Tab' && suggestions.length > 0 && !query.trim()) {
      e.preventDefault();
      setQuery(suggestions[activeIdx]?.text.split(' \u2014 ')[0] ?? '');
    }
  };

  const activeItem = (() => {
    const items = query.trim() ? results : suggestions;
    return items[activeIdx] ?? null;
  })();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Search className="w-5 h-5 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search this page\u2026"
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 text-sm outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-zinc-500 text-[10px] font-mono border border-white/5">
            <Command className="w-3 h-3" />
            <span>{shortcutHint}</span>
          </kbd>
        </div>

        {stats && (
          <div className="px-4 py-1.5 bg-zinc-900/50 border-b border-white/5 flex items-center gap-4 text-[11px] text-zinc-600">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3 h-3" />
              {stats.indexed.toLocaleString()} items indexed
            </span>
            {query.trim() && (
              <span className="text-zinc-500">
                {loading ? 'searching\u2026' : `${results.length} result${results.length === 1 ? '' : 's'}`}
              </span>
            )}
          </div>
        )}

        {suggestions.length > 0 && !query.trim() && (
          <div className="px-2 py-1">
            <div className="text-[10px] text-zinc-600 px-2 pb-1 uppercase tracking-wider font-medium">
              Pages
            </div>
            <div className="space-y-0.5">
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { setQuery(s.text.split(' \u2014 ')[0]); onSelect?.({ id: s.id, pageId: s.pageId, title: s.text, section: '', snippet: '', score: 0 } as Result); onClose(); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors flex items-center gap-2 ${i === activeIdx ? 'bg-zinc-800/60 text-zinc-200' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <Hash className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <span className="truncate">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-[min(420px,55vh)] overflow-y-auto">
            {results.map((hit, i) => (
              <button
                key={hit.id}
                onClick={() => onSelect?.(hit)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-white/5 last:border-b-0 transition-colors ${i === activeIdx ? 'bg-zinc-800/40' : 'hover:bg-zinc-800/20'}`}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-[10px] font-medium border border-white/5 whitespace-nowrap max-w-[100px] truncate">
                  {pageLabel(hit.pageId)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 font-medium mb-0.5 truncate">
                    {highlight(hit.title, query)}
                  </div>
                  {hit.section && (
                    <div className="text-[11px] text-zinc-600 mb-1 truncate">
                      {highlight(hit.section, query)}
                    </div>
                  )}
                  <div className="text-[12px] text-zinc-500 leading-relaxed line-clamp-2 break-words">
                    {highlight(hit.snippet, query)}
                  </div>
                </div>
                {hit.score > 0.5 && (
                  <div className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-amber-400/60" title="high relevance" />
                )}
              </button>
            ))}
            <div ref={resultsEndRef} />
          </div>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <div className="py-8 text-center text-zinc-600 text-sm">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p>No results for <span className="text-zinc-500 font-medium">"{query}"</span></p>
            <p className="text-[11px] mt-1">Try different keywords or check spelling</p>
          </div>
        )}

        {!query.trim() && results.length === 0 && !loading && (
          <div className="px-4 py-5 text-center text-zinc-600 text-xs">
            Start typing to search {stats ? `${stats.indexed.toLocaleString()} indexed items` : '\u2026'}
          </div>
        )}
      </div>
    </div>
  );
}

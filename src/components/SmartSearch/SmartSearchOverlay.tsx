import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowUp, ArrowDown, X, Hash, Globe, FileText, FolderOpen } from 'lucide-react';
import type { SearchHit } from '../services/search/index';

// ── Floating find-in-page bar (Ctrl+F) ──────────────────────────────────────
// Compact bar anchored to top of viewport — page content stays visible behind it.
// Scope toggle: All (app-wide) / This Page / Subpage.

export default function SmartSearchBar({
  open,
  onClose,
  onSelect,
  currentPageId,
  shortcutHint = '\u2318F',
}: {
  open: boolean;
  onClose: () => void;
  onSelect?: (hit: SearchHit) => void;
  currentPageId?: string;
  shortcutHint?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ indexed: number } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [scope, setScope] = useState<'all' | 'page' | 'subpage'>('page');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIdx(0);
      setScope(currentPageId ? 'page' : 'all');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, currentPageId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Fetch stats when bar opens
  useEffect(() => {
    if (!open) return;
    window.deskflowAPI?.smartSearchStats().then(setStats).catch(() => {});
  }, [open]);

  // Search
  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const hits = await window.deskflowAPI?.smartSearchQuery(q, {
        limit: 30,
        ctxChars: 80,
      }) ?? [];

      let filtered: SearchHit[];
      if (scope === 'page') {
        filtered = hits.filter((h) => h.pageId === currentPageId);
      } else if (scope === 'subpage') {
        // Subpage: same pageId but with a specific section context
        // For now, treat as page scope (section filtering happens at display)
        filtered = hits.filter((h) => h.pageId === currentPageId);
      } else {
        filtered = hits;
      }

      setResults(filtered as SearchHit[]);
      setActiveIdx(0);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [scope, currentPageId]);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 80);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (query.trim() && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect?.(results[activeIdx]);
        onClose();
      }
    }
  };

  const scopeOptions = [
    { value: 'all', label: 'All', icon: Globe, desc: 'App-wide' },
    { value: 'page', label: 'Page', icon: FileText, desc: currentPageId ? 'This page' : 'Current' },
    { value: 'subpage', label: 'Section', icon: FolderOpen, desc: 'Subpage scope' },
  ] as const;

  if (!open) return null;

  return (
    <div
      className="bg-zinc-900/30"
      style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 520, margin: '48px auto 0' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900/80 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* ── Search bar row ── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 rounded-t-xl" style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find in page\u2026"
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 text-sm outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
              className="flex items-center justify-center w-6 h-6 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px] font-mono border border-white/5 ml-1">
            {shortcutHint}
          </kbd>
        </div>

        {/* ── Scope toggle ── */}
        <div className="flex items-center gap-1 px-3 pt-1.5 border-b border-white/5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {scopeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = scope === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { setScope(opt.value); if (query.trim()) doSearch(query); }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-zinc-800/80 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="text-[9px] opacity-60">{opt.desc}</span>
              </button>
            );
          })}
        </div>

        {/* ── Results dropdown ── */}
        {query.trim() && (
          <div style={{ maxHeight: '360px' }}>
            {loading && (
              <div className="px-3 py-2 text-center text-zinc-600 text-xs">
                Searching\u2026
              </div>
            )}

            {!loading && results.length === 0 && (
              <div className="px-3 py-4 text-center text-zinc-600 text-sm">
                <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p>No results for <span className="text-zinc-500 font-medium">"{query}"</span></p>
                <p className="text-[10px] mt-1 text-zinc-600">
                  {scope === 'all'
                    ? 'Try a different query.'
                    : scope === 'page'
                    ? 'Nothing on this page matches.'
                    : 'Nothing in this section matches.'}
                </p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="px-2 pb-2">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
                  <span>
                    {results.length} result{results.length === 1 ? '' : 's'}
                    {scope === 'page' && ' on this page'}
                    {scope === 'subpage' && ' in this section'}
                    {scope === 'all' && ' across app'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="w-2.5 h-2.5" />
                    {stats?.indexed.toLocaleString()} indexed
                  </span>
                </div>
                <div className="space-y-0.5">
                  {results.map((hit, i) => (
                    <button
                      key={hit.id}
                      onClick={() => { onSelect?.(hit); onClose(); }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        i === activeIdx ? 'bg-zinc-800/80 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                      }`}
                      onMouseEnter={() => setActiveIdx(i)}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="shrink-0 px-1 py-0.5 rounded bg-zinc-800 text-[9px] font-medium text-zinc-500 border border-white/5 truncate max-w-[80px]">
                          {hit.section || hit.pageId}
                        </span>
                        <span className="truncate text-zinc-600 text-[10px]">{hit.pageId}</span>
                      </div>
                      <div className="text-sm font-medium text-zinc-200 truncate">
                        {hit.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 break-words mt-0.5">
                        {hit.snippet}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 border-t border-white/5 text-[10px] text-zinc-600">
                  <span className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    Alt+Up
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" />
                    Alt+Down
                  </span>
                  <span className="ml-auto">Enter: go to</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!query.trim() && (
          <div className="px-3 py-3 text-center text-zinc-600 text-xs">
            Type to search {scope === 'all' ? 'across the app' : scope === 'page' ? 'on this page' : 'in this section'}\u2026
            {stats && (
              <span className="block mt-1 text-[10px] text-zinc-600">
                {stats.indexed.toLocaleString()} items indexed
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

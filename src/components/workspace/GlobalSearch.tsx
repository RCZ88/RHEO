import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Package, Grid, Zap, Paintbrush, Code2, Sparkles, Rabbit, Wind, ExternalLink } from 'lucide-react';

interface GlobalSearchResult {
  id: string;
  name: string;
  description: string;
  source: string;
  sourceLabel: string;
  category: string;
  slug: string;
}

interface GlobalSearchProps {
  libraries: { id: string; label: string; enabled: boolean }[];
  onAddComponent: (component: any) => void;
}

const SOURCE_ICONS: Record<string, any> = {
  '21st-dev': Package,
  'aceternity': Grid,
  'refero': Zap,
  'cult-ui': Paintbrush,
  'fragments-ui': Code2,
  'shadcn-ui-mcp': Code2,
  'aidesigner': Sparkles,
  'reactbits': Rabbit,
  'magicui': Sparkles,
  'swishy-motion': Wind,
};

const SOURCE_ACCENTS: Record<string, string> = {
  '21st-dev': '#22d3ee',
  'aceternity': '#a78bfa',
  'refero': '#34d399',
  'cult-ui': '#f97316',
  'fragments-ui': '#06b6d4',
  'shadcn-ui-mcp': '#38bdf8',
  'aidesigner': '#c084fc',
  'reactbits': '#f472b6',
  'magicui': '#f472b6',
  'swishy-motion': '#fbbf24',
};

export function GlobalSearch({ libraries, onAddComponent }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const dapi = (window as any).deskflowAPI;
    const all: GlobalSearchResult[] = [];
    const enabled = libraries.filter(l => l.enabled);
    for (const lib of enabled) {
      try {
        let res: any = null;
        if (lib.id === '21st-dev') {
          res = await dapi?.mcpCallTool?.('21st-dev', 'search_components', { query: q });
        } else if (lib.id === 'aceternity') {
          res = await dapi?.aceternityFetchRegistry?.();
          if (res?.success && res?.components) {
            const matched = res.components.filter((c: any) =>
              c.name?.toLowerCase().includes(q.toLowerCase()) || c.description?.toLowerCase().includes(q.toLowerCase())
            );
            for (const c of matched) all.push({ id: c.slug, name: c.name, description: c.description || '', source: lib.id, sourceLabel: lib.label, category: c.category || 'General', slug: c.slug });
          }
        } else if (lib.id === 'refero') {
          res = await dapi?.mcpCallTool?.('refero', 'search_components', { query: q });
        } else if (lib.id === 'magicui') {
          res = await dapi?.mcpCallTool?.('magicui', 'search_registry_items', { query: q });
        } else if (lib.id === 'shadcn-ui-mcp') {
          res = await dapi?.mcpCallTool?.('shadcn-ui-mcp', 'list_components', { query: q });
        } else if (lib.id === 'cult-ui') {
          res = await dapi?.mcpCallTool?.('cult-ui', 'search_components', { query: q });
        } else if (lib.id === 'fragments-ui') {
          res = await dapi?.mcpCallTool?.('fragments-ui', 'search_components', { query: q });
        } else if (lib.id === 'reactbits') {
          res = await dapi?.mcpCallTool?.('reactbits', 'search_components', { query: q });
        }
        if (res?.success && res?.result?.content) {
          const content = res.result.content[0]?.text;
          if (content) {
            try {
              const parsed = typeof content === 'string' ? JSON.parse(content) : content;
              const items = parsed.components || parsed.items || parsed;
              if (Array.isArray(items)) {
                for (const item of items) {
                  all.push({ id: item.slug || item.id || item.name, name: item.name, description: item.description || '', source: lib.id, sourceLabel: lib.label, category: item.category || 'General', slug: item.slug || item.name });
                }
              }
            } catch {}
          }
        }
      } catch {}
    }
    setResults(all.slice(0, 50));
    setLoading(false);
  }, [libraries]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search all libraries..."
          className="w-full pl-10 pr-10 py-2.5 bg-zinc-800/60 border border-zinc-800/60 rounded-lg
            text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-pink-400/40
            transition-colors duration-150"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 rounded hover:bg-zinc-700/60"
          >
            <X className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && query && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 mt-1 w-full rounded-lg bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-800/60 shadow-xl overflow-hidden"
          >
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                <span className="ml-2 text-xs text-zinc-500">Searching...</span>
              </div>
            )}
            {!loading && results.length === 0 && query && (
              <div className="text-center py-6">
                <p className="text-xs text-zinc-500">No results found</p>
              </div>
            )}
            {!loading && results.length > 0 && (
              <div className="max-h-60 overflow-y-auto">
                {results.map((item, idx) => {
                  const Icon = SOURCE_ICONS[item.source] || Package;
                  const accent = SOURCE_ACCENTS[item.source] || '#22d3ee';
                  return (
                    <div
                      key={`${item.source}-${item.slug}-${idx}`}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-800/60 cursor-pointer transition-colors duration-100 border-b border-zinc-800/30 last:border-0"
                      onClick={() => {
                        onAddComponent({ slug: item.slug, name: item.name, description: item.description, category: item.category, source: item.source, code: '' });
                        setOpen(false);
                        setQuery('');
                        setResults([]);
                      }}
                    >
                      <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center shrink-0" style={{ color: accent }}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200 truncate">{item.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ color: accent, backgroundColor: `${accent}15` }}>
                            {item.sourceLabel}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-zinc-500 truncate mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-1" />
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

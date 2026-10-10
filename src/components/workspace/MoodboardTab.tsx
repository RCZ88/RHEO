import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Sparkles, AlertCircle, Loader2, Image, Send } from 'lucide-react';

interface AestheticResult {
  title: string;
  description: string;
  imageUrl: string;
  source: string;
}

interface MoodboardTabProps {
  activeTerminalId: string | null;
  onInjectContext: (item: AestheticResult) => void;
}

export function MoodboardTab({ activeTerminalId, onInjectContext }: MoodboardTabProps) {
  const [items, setItems] = useState<AestheticResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setItems([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const dapi = (window as any).deskflowAPI;
      const result = await dapi?.designSuiteScrapeCari?.(query.trim());
      if (result?.success && result.data) {
        setItems(result.data);
      } else {
        setError(result?.error || 'Failed to fetch aesthetic data');
      }
    } catch (e) {
      setError('Network error. Check your connection.');
    }
    setIsLoading(false);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 500);
  }, [doSearch]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search aesthetic vibes (e.g., Frutiger Aero, Y2K, Cyberpunk)..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-800/60 text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-150"
          disabled={isLoading}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="columns-2 md:columns-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-4">
              <div className="rounded-xl bg-zinc-800/50 animate-pulse h-64 w-full" />
              <div className="mt-2 space-y-1.5">
                <div className="h-3 bg-zinc-800/50 rounded animate-pulse w-3/4" />
                <div className="h-2.5 bg-zinc-800/50 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-zinc-400 text-center max-w-xs">{error}</p>
          <button
            onClick={() => doSearch(searchQuery)}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors duration-150"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Sparkles className="w-8 h-8 text-zinc-600" />
          <p className="text-sm text-zinc-500 text-center max-w-xs">
            Search for an aesthetic vibe to load visual inspiration
          </p>
          <p className="text-xs text-zinc-600">Try: Frutiger Aero, Y2K, Cyberpunk, Corporate Memphis</p>
        </div>
      )}

      {/* Populated State — Masonry Grid */}
      {!isLoading && !error && items.length > 0 && (
        <div className="columns-2 md:columns-3 gap-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="break-inside-avoid mb-4 group relative rounded-xl overflow-hidden bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-48 bg-zinc-800/40 flex items-center justify-center">
                  <Image className="w-8 h-8 text-zinc-700" />
                </div>
              )}

              {/* Hover Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3 transition-opacity duration-200 ${hoveredIndex === idx ? 'opacity-100' : 'opacity-0'}`}>
                <h3 className="text-xs font-semibold text-zinc-200 mb-0.5">{item.title}</h3>
                {item.description && (
                  <p className="text-[10px] text-zinc-400 line-clamp-2 mb-2">{item.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{item.source}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onInjectContext(item); }}
                    disabled={!activeTerminalId}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500 text-black text-[10px] font-semibold hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <Send className="w-2.5 h-2.5" />
                    Inject Context
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

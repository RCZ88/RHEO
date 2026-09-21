import { useEffect, useRef, useState } from 'react';
import { Search, X, ArrowDown, ArrowUp } from 'lucide-react';

interface NativeFindOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function NativeFindOverlay({ open, onClose }: NativeFindOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ text: string; section: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        // Let native Ctrl+F work — close overlay
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (results[selectedIndex]) {
          console.log('[NativeFind] Select:', results[selectedIndex].text);
        }
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, query, results, selectedIndex, onClose]);

  // Simulate search results from document text
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const hits: { text: string; section: string }[] = [];
    document.querySelectorAll('h1, h2, h3, h4, p, li, td, span').forEach(el => {
      const text = el.textContent || '';
      if (text.toLowerCase().includes(query.toLowerCase())) {
        hits.push({ text: text.slice(0, 120), section: el.parentElement?.tagName || 'body' });
      }
    });
    setResults(hits.slice(0, 20));
  }, [query]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: '#1e1e2e', borderColor: '#3b3b5c' }}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#3b3b5c' }}>
          <Search size={18} color="#8888aa" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Find in page..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
            style={{ color: '#e0e0f0' }}
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono border" style={{ borderColor: '#3b3b5c', color: '#666688' }}>ESC</kbd>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-700/50 transition-colors">
            <X size={16} color="#8888aa" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {results.length === 0 && query ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No results found</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-zinc-600">
              Type to search the page
            </div>
          ) : (
            results.map((hit, i) => (
              <div
                key={i}
                onClick={() => { console.log('[NativeFind] Click:', hit.text); onClose(); }}
                className={`px-4 py-2.5 cursor-pointer text-sm transition-colors ${i === selectedIndex ? 'bg-zinc-700/60' : 'hover:bg-zinc-800/40'}`}
                style={{ color: i === selectedIndex ? '#e0e0f0' : '#9999bb' }}
              >
                <span style={{ color: '#8888aa', fontSize: '10px', marginRight: '8px' }}>{hit.section}</span>
                <span>{hit.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-[10px] text-zinc-600" style={{ borderColor: '#3b3b5c' }}>
          <span><kbd className="px-1 py-0.5 rounded border" style={{ borderColor: '#3b3b5c' }}>↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 rounded border" style={{ borderColor: '#3b3b5c' }}>Enter</kbd> Select</span>
          <span><kbd className="px-1 py-0.5 rounded border" style={{ borderColor: '#3b3b5c' }}>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

export default NativeFindOverlay;
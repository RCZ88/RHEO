import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight, RotateCw, ExternalLink } from 'lucide-react';

/**
 * Hosts the native embedded-browser view.
 *
 * The page itself is NOT an iframe — it is a `WebContentsView` layered over the
 * window by the main process. So this component only has to (a) reserve an empty
 * rectangle and (b) keep that rectangle's screen coords in sync, which it does
 * with a ResizeObserver + scroll/resize listeners. If the rect drifts, the
 * native view floats over the wrong part of the UI — which looks exactly like a
 * black panel — so the sync is the whole point of this file.
 */

const w = window as any;

export interface EmbeddedSite { id: string; name: string; url: string; }

export const SITES: EmbeddedSite[] = [
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new' },
  { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com/' },
];

export default function EmbeddedBrowser({ defaultUrl }: { defaultUrl?: string }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<{ url?: string; title?: string; canGoBack?: boolean; canGoForward?: boolean }>({});
  const [url, setUrl] = useState(defaultUrl || SITES[0].url);

  const syncBounds = useCallback(async () => {
    const el = slotRef.current;
    if (!el || !open) return;
    const r = el.getBoundingClientRect();
    // Skip the degenerate rect while collapsed, or the native view detaches.
    if (r.width < 40 || r.height < 40) return;
    try { await w.embeddedBrowser?.resize({ x: r.left, y: r.top, width: r.width, height: r.height }); }
    catch { /* the view reports its own failures */ }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    syncBounds();
    const ro = new ResizeObserver(() => { void syncBounds(); });
    if (slotRef.current) ro.observe(slotRef.current);
    window.addEventListener('resize', syncBounds);
    window.addEventListener('scroll', syncBounds, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncBounds);
      window.removeEventListener('scroll', syncBounds, true);
    };
  }, [open, syncBounds]);

  const refresh = useCallback(async () => {
    try { setState(await w.embeddedBrowser?.state()); } catch { /* ignore */ }
  }, []);

  const launch = async (target: string) => {
    setBusy('Opening…');
    setError('');
    try {
      const res = await w.embeddedBrowser?.open(target);
      if (!res?.success) {
        setError(String(res?.error || 'The browser panel could not be opened.'));
        setBusy('');
        return;
      }
      setOpen(true);
      setBusy('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
      setBusy('');
    }
  };

  // Keep the toolbar in step with what the native view is actually showing.
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
  }, [open, refresh]);

  const close = async () => {
    await w.embeddedBrowser?.close().catch(() => {});
    setOpen(false);
    setState({});
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden flex flex-col" style={{ height: 'min(72vh, 760px)' }}>
      {/* ── toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
        {!open ? (
          <>
            <span className="text-xs font-semibold text-white mr-1">In-app browser</span>
            <div className="flex flex-wrap gap-1.5">
              {SITES.map(s => (
                <button
                  key={s.id}
                  onClick={() => launch(s.url)}
                  className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 transition-colors"
                >
                  {s.name}
                </button>
              ))}
              {defaultUrl && (
                <button onClick={() => launch(defaultUrl)} className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/80">Open</button>
              )}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => w.embeddedBrowser?.navigate(state.url || '')} title="Back" className="text-white/50 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
            <button onClick={refresh} title="Forward" className="text-white/50 hover:text-white"><ArrowRight className="w-4 h-4" /></button>
            <button onClick={() => w.embeddedBrowser?.reload()} title="Reload" className="text-white/50 hover:text-white"><RotateCw className="w-3.5 h-3.5" /></button>
            <form
              className="flex-1 min-w-0"
              onSubmit={(e) => {
                e.preventDefault();
                let target = url.trim();
                if (target && !/^https?:\/\//i.test(target)) target = 'https://' + target;
                if (target) { setUrl(target); void w.embeddedBrowser?.navigate(target); }
              }}
            >
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
                aria-label="Address"
                className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-1.5 text-[11px] font-mono text-white/85 outline-none focus:border-amber-300/40"
              />
            </form>
            <button onClick={() => state.url && w.embeddedBrowser?.navigate(state.url).then(refresh)} title="Go" className="text-white/50 hover:text-white"><ExternalLink className="w-3.5 h-3.5" /></button>
            <button onClick={close} title="Close the panel" className="text-white/50 hover:text-red-300"><X className="w-4 h-4" /></button>
          </>
        )}
      </div>

      {/* ── the slot the native view is positioned over ─────────────────── */}
      <div className="relative flex-1 min-h-0">
        {!open && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <div className="text-sm font-semibold text-white">Nothing open</div>
              <p className="text-[11px] text-white/45 mt-1.5 max-w-sm leading-relaxed">
                Pick a site above and it opens <em>inside</em> this window — no separate browser, and your
                sign-in is remembered between restarts.
              </p>
              {busy && <div className="mt-2 text-[11px] text-amber-200">{busy}</div>}
              {error && <div className="mt-2 text-[11px] text-red-300 whitespace-pre-wrap text-left max-w-md">{error}</div>}
            </div>
          </div>
        )}
        <div ref={slotRef} className="absolute inset-0" data-testid="embedded-browser-slot" />
        {open && error && (
          <div className="absolute inset-0 grid place-items-center p-6 pointer-events-none">
            <div className="text-[11px] text-red-300">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
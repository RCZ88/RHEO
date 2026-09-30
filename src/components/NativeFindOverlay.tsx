import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronUp, ChevronDown, Settings2, Globe, FileText, FolderOpen, GripHorizontal } from 'lucide-react';
import type { SearchHit } from '../services/search/index';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Find & Scope bar  (Ctrl+F / ⌘F)
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE CONTROL, TWO CAPABILITIES — they are the same question asked at two
 * altitudes, so they live on one bar instead of fighting over one keybinding:
 *
 *   Page     — the LIVE page is the text. DOM find: every match highlighted,
 *              the active one solid + scrolled to centre. Instant, zero latency.
 *   All      — the whole APP is the text. Indexed search across every page that
 *              registered segments; results list, click navigates + scrolls.
 *   Section  — this page's registered sections. Indexed, narrowed to here.
 *              Falls back to live Page find when the page has no index, so the
 *              control is never a dead end.
 *
 * The scope was previously a separate overlay that could not be opened at all
 * (`setSmartSearchOpen(true)` existed nowhere), so it was invisible. It is here
 * now, on the same surface as the shortcut that people actually press.
 *
 * PLACEMENT — the bar is yours to position. A hardcoded `right: 16` collided
 * with the title bar's window controls and the terminal's right-hand inspector.
 * Two mechanisms, one concept (a 3×3 anchor grid):
 *   1. drag the grip → snaps to whichever cell you release over
 *   2. ⚙ → click a cell in the 3×3 picker
 * Snapping (rather than free drag) is deliberate: free drag can strand the bar
 * off-screen or behind the sidebar with no way back. Persisted in localStorage —
 * it is a fact about your eyes and your monitor, not about the document.
 *
 * DESIGN INTENT
 *   The bar is a LENS, not a curtain. No backdrop, no dim, no blur, no
 *   click-to-close scrim — the page stays lit, visible and interactive, because
 *   the page is the thing being searched and dimming it destroys the only
 *   context that makes a match meaningful.
 *
 *   Signal hue: amber #fbbf24 — the SAME hue as the highlight it paints, so one
 *   rule is learned: amber means "match". Nothing else here is coloured.
 *
 * MOTION: L1. 120ms colour/mark transitions, one 1.1s ring pulse on active
 *   change, 100ms on placement snap, 1:1 while dragging. All off under
 *   prefers-reduced-motion.
 *
 * KEYS: Enter / ↓ next · Shift+Enter / ↑ prev · Esc close · Ctrl+F refocus
 * ─────────────────────────────────────────────────────────────────────────────
 */

const FIND_STYLE_ID = 'df-find-in-page-styles';
const MARK_ATTR = 'data-df-find';
const ACTIVE_ATTR = 'data-df-find-active';
const PULSE_ATTR = 'data-df-find-pulse';
const PLACEMENT_KEY = 'deskflow:find-bar-anchor';
const GAP = 12;

const FIND_CSS = `
mark[${MARK_ATTR}] {
  background: rgba(251, 191, 36, 0.26);
  color: inherit;
  border-radius: 3px;
  padding: 0 1px;
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.20);
  transition: background-color 120ms ease-out, box-shadow 120ms ease-out, color 120ms ease-out;
}
mark[${MARK_ATTR}][${ACTIVE_ATTR}] {
  background: #fbbf24;
  color: #18181b;
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.9);
}
@keyframes df-find-ring {
  0%   { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.75); }
  70%  { box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); }
  100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
}
mark[${MARK_ATTR}][${PULSE_ATTR}] {
  animation: df-find-ring 1.1s ease-out 1;
}
@media (prefers-reduced-motion: reduce) {
  mark[${MARK_ATTR}] { transition: none; }
  mark[${MARK_ATTR}][${PULSE_ATTR}] { animation: none; }
}
`;

/** Subtrees we never walk into — no layout, no text, or not ours. */
const SKIP_SELECTOR = [
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object',
  'input', 'textarea', 'select', 'option', 'optgroup',
  '[contenteditable="true"]', '[contenteditable=""]',
  '[data-df-find-bar]', `[${MARK_ATTR}]`,
].join(', ');

// ── Placement model ───────────────────────────────────────────────────────────

type AnchorV = 'top' | 'bottom';
type AnchorH = 'left' | 'center' | 'right';
interface Anchor { v: AnchorV; h: AnchorH }

const ANCHOR_CELLS: Anchor[] = [
  { v: 'top', h: 'left' }, { v: 'top', h: 'center' }, { v: 'top', h: 'right' },
  { v: 'bottom', h: 'left' }, { v: 'bottom', h: 'center' }, { v: 'bottom', h: 'right' },
];

const DEFAULT_ANCHOR: Anchor = { v: 'top', h: 'right' };

function isAnchor(a: unknown): a is Anchor {
  if (!a || typeof a !== 'object') return false;
  const o = a as Anchor;
  return (o.v === 'top' || o.v === 'bottom') && (o.h === 'left' || o.h === 'center' || o.h === 'right');
}

function loadAnchor(): Anchor {
  try {
    const raw = localStorage.getItem(PLACEMENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isAnchor(parsed)) return parsed;
    }
  } catch { /* localStorage unavailable — fall through to default */ }
  return DEFAULT_ANCHOR;
}

function saveAnchor(a: Anchor): void {
  try { localStorage.setItem(PLACEMENT_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

/** CSS for a fixed-position bar docked to one of the 9 anchor cells. */
function anchorStyle(a: Anchor): React.CSSProperties {
  const s: React.CSSProperties = { position: 'fixed', zIndex: 9999 };
  if (a.v === 'top') s.top = GAP; else s.bottom = GAP;
  if (a.h === 'left') s.left = GAP;
  else if (a.h === 'right') s.right = GAP;
  else { s.left = '50%'; s.transform = 'translateX(-50%)'; }
  return s;
}

const sameAnchor = (a: Anchor, b: Anchor) => a.v === b.v && a.h === b.h;

// ── DOM find primitives ──────────────────────────────────────────────────────

function ensureFindStyles() {
  if (document.getElementById(FIND_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = FIND_STYLE_ID;
  el.textContent = FIND_CSS;
  document.head.appendChild(el);
}

/** Undo every mark we injected, leaving the DOM as we found it. */
function clearHighlights(): void {
  const marks = Array.from(document.querySelectorAll(`mark[${MARK_ATTR}]`));
  if (marks.length === 0) return;
  const parents = new Set<Node>();
  for (const m of marks) {
    const parent = m.parentNode;
    if (!parent) continue;
    parents.add(parent);
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
  }
  parents.forEach((p) => (p as Element).normalize?.());
}

function splitAndMark(node: Text, needle: string, out: HTMLModElement[]): void {
  const value = node.nodeValue || '';
  const hay = value.toLowerCase();
  if (!hay.includes(needle)) return;
  const parent = node.parentNode;
  if (!parent) return;

  const frag = document.createDocumentFragment();
  let cursor = 0;
  let at = hay.indexOf(needle, cursor);
  while (at !== -1) {
    if (at > cursor) frag.appendChild(document.createTextNode(value.slice(cursor, at)));
    const mark = document.createElement('mark') as HTMLModElement;
    mark.setAttribute(MARK_ATTR, '');
    mark.textContent = value.slice(at, at + needle.length);
    frag.appendChild(mark);
    out.push(mark);
    cursor = at + needle.length;
    at = hay.indexOf(needle, cursor);
  }
  if (cursor < value.length) frag.appendChild(document.createTextNode(value.slice(cursor)));
  parent.replaceChild(frag, node);
}

/** Collect matching text nodes first, mutate second — a TreeWalker cannot
 *  survive its own DOM surgery. */
function highlightAll(query: string): HTMLModElement[] {
  clearHighlights();
  const needle = query.toLowerCase();
  if (!needle || !document.body) return [];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      const text = (node as Text).nodeValue;
      if (!text || !text.toLowerCase().includes(needle)) return NodeFilter.FILTER_REJECT;
      // Zero-size nodes cannot be seen, so highlighting them is noise.
      if (parent.getClientRects().length === 0) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets: Text[] = [];
  let n: Node | null = walker.nextNode();
  while (n) { targets.push(n as Text); n = walker.nextNode(); }

  const marks: HTMLModElement[] = [];
  for (const t of targets) {
    if (!t.parentNode) continue; // detached by an earlier split
    splitAndMark(t, needle, marks);
  }
  return marks;
}

/** Scroll the active match into the middle of the content column. */
function revealMatch(mark: HTMLElement): void {
  mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  // scrollIntoView can miss inside custom scroll containers. Verify, then
  // correct the nearest scrollable ancestor by hand.
  window.setTimeout(() => {
    const r = mark.getBoundingClientRect();
    const margin = 120;
    const offTop = r.top < margin;
    const offBottom = r.bottom > window.innerHeight - margin;
    if (!offTop && !offBottom) return;
    let el = mark.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (/auto|scroll|overlay/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        if (offTop) el.scrollTop -= (margin - r.top);
        else el.scrollTop += (r.bottom - (window.innerHeight - margin));
        return;
      }
      el = el.parentElement;
    }
    if (offTop) window.scrollBy({ top: r.top - margin, behavior: 'smooth' });
    else window.scrollBy({ top: r.bottom - (window.innerHeight - margin), behavior: 'smooth' });
  }, 220);
}

/** "Where is it pointing?" — nearest preceding heading, else a data-section label. */
function contextFor(mark: HTMLElement): string {
  const host = mark.closest<HTMLElement>('[data-section], [data-page-section], [data-tab], [aria-label]');
  if (host) {
    const label =
      host.getAttribute('data-section') ||
      host.getAttribute('data-page-section') ||
      host.getAttribute('data-tab') ||
      host.getAttribute('aria-label');
    if (label) return label;
  }
  const headings = document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, [role="heading"]');
  let best = '';
  headings.forEach((h) => {
    if (mark.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING) return;
    const t = (h.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) best = t;
  });
  return best;
}

// ── Component ────────────────────────────────────────────────────────────────

type Scope = 'page' | 'all' | 'section';

const SCOPES: { value: Scope; label: string; icon: typeof Globe; hint: string }[] = [
  { value: 'page', label: 'Page', icon: FileText, hint: 'This screen only — highlights as you type' },
  { value: 'all', label: 'All', icon: Globe, hint: 'Every indexed page in the app' },
  { value: 'section', label: 'Section', icon: FolderOpen, hint: 'Indexed sections on this page' },
];

interface NativeFindOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Scope to open with. 'page' is what Ctrl+F means; 'all' is what the sidebar button means. */
  initialScope?: Scope;
  currentPageId?: string;
  /** Called when the user picks a result in an indexed scope. */
  onSelect?: (hit: SearchHit) => void;
}

export function NativeFindOverlay({
  open,
  onClose,
  initialScope = 'page',
  currentPageId,
  onSelect,
}: NativeFindOverlayProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>(initialScope);
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(0);
  const [where, setWhere] = useState('');
  const [version, setVersion] = useState(0);
  const [anchor, setAnchor] = useState<Anchor>(DEFAULT_ANCHOR);
  const [anchorLoaded, setAnchorLoaded] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [hitIdx, setHitIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const [indexed, setIndexed] = useState<number | null>(null);
  const [indexFailed, setIndexFailed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<HTMLModElement[]>([]);
  const activeRef = useRef(0);
  const hitIdxRef = useRef(0);
  const suppressMutation = useRef(false);
  const queryRef = useRef('');

  activeRef.current = active;
  hitIdxRef.current = hitIdx;
  queryRef.current = query;

  const live = scope === 'page';
  // Section degrades to live find when this page has no index — a control that
  // can produce nothing is worse than one that falls back.
  const effectiveLive = live || (scope === 'section' && indexed === 0);

  // ── Teardown: always hand the page back untouched ──
  useEffect(() => () => { clearHighlights(); }, []);

  // ── Placement: load once, then keep it on-screen ──
  useEffect(() => {
    setAnchor(loadAnchor());
    setAnchorLoaded(true);
  }, []);

  useEffect(() => {
    if (!anchorLoaded) return;
    const keepOnScreen = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // If a window shrink pushed the card out of reach, fall back to the default
      // corner rather than leaving the user with no way to grab it.
      const off =
        r.right > window.innerWidth + 1 || r.left < -1 ||
        r.bottom > window.innerHeight + 1 || r.top < -1;
      if (off) { setAnchor(DEFAULT_ANCHOR); saveAnchor(DEFAULT_ANCHOR); }
    };
    window.addEventListener('resize', keepOnScreen);
    return () => window.removeEventListener('resize', keepOnScreen);
  }, [anchorLoaded]);

  const moveTo = useCallback((next: Anchor) => {
    setAnchor(next);
    saveAnchor(next);
  }, []);

  // ── Open / close lifecycle ──
  useEffect(() => {
    if (!open) {
      clearHighlights();
      marksRef.current = [];
      setCount(0);
      setActive(0);
      setWhere('');
      setHits([]);
      setHitIdx(0);
      setQuery('');
      setPlaceOpen(false);
      return;
    }
    ensureFindStyles();
    setScope(initialScope);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(t);
  }, [open, initialScope]);

  // ── Indexed search (All / Section) ──
  useEffect(() => {
    if (!open || live) return;
    const q = query.trim();
    if (!q) { setHits([]); setIndexFailed(false); return; }
    let cancelled = false;
    setSearching(true);
    setIndexFailed(false);
    const t = window.setTimeout(async () => {
      try {
        const res = (await window.deskflowAPI?.smartSearchQuery(q, { limit: 40, ctxChars: 90 })) ?? [];
        if (cancelled) return;
        setIndexFailed(false);
        setHits(res as SearchHit[]);
        setHitIdx(0);
      } catch {
        if (!cancelled) { setHits([]); setIndexFailed(true); }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 120);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [open, live, query, currentPageId]);

  useEffect(() => {
    if (!open || live) return;
    window.deskflowAPI?.smartSearchStats()
      .then((s) => setIndexed(s?.indexed ?? 0))
      .catch(() => setIndexFailed(true));
  }, [open, live, scope]);

  // Filter to the current page for Section scope.
  const visibleHits = useMemo(() => {
    if (scope !== 'section' || !currentPageId) return hits;
    return hits.filter((h) => h.pageId === currentPageId);
  }, [hits, scope, currentPageId]);

  // ── Build the mark set. Active is re-applied off `version`, never off
  //    setCount(n): React bails out of a setState with an unchanged value, which
  //    used to strand the page with no active match. ──
  const build = useCallback((raw: string, keepIndex: number, useLive: boolean) => {
    suppressMutation.current = true;
    const marks = useLive ? highlightAll(raw) : [];
    marksRef.current = marks;
    setCount(marks.length);
    const idx = marks.length ? Math.min(keepIndex, marks.length - 1) : 0;
    setActive(idx);
    activeRef.current = idx;
    setVersion((v) => v + 1);
    window.setTimeout(() => { suppressMutation.current = false; }, 0);
  }, []);

  useEffect(() => {
    if (!open || !effectiveLive) return;
    build(query, 0, true);
  }, [open, query, effectiveLive, build]);

  // Clear the other scope's artefacts when leaving live find.
  useEffect(() => {
    if (open && effectiveLive) return;
    clearHighlights();
    marksRef.current = [];
    setCount(0);
    setActive(0);
  }, [open, effectiveLive]);

  // ── Point at the active match ──
  useEffect(() => {
    if (!open || !effectiveLive) return;
    const marks = marksRef.current;
    marks.forEach((m) => { m.removeAttribute(ACTIVE_ATTR); m.removeAttribute(PULSE_ATTR); });
    const mark = marks[active];
    if (!mark) { setWhere(''); return; }
    mark.setAttribute(ACTIVE_ATTR, '');
    void mark.offsetWidth; // restart the ring animation
    mark.setAttribute(PULSE_ATTR, '');
    setWhere(contextFor(mark));
    revealMatch(mark);
  }, [open, active, version, effectiveLive]);

  // ── Keep highlights honest if the page re-renders underneath the bar ──
  useEffect(() => {
    if (!open || !effectiveLive || !query.trim()) return;
    let timer = 0;
    const obs = new MutationObserver((records) => {
      if (suppressMutation.current) return;
      for (const r of records) {
        const t = r.target as Element | null;
        if (t?.closest?.(`[${MARK_ATTR}], [data-df-find-bar]`)) continue;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => build(queryRef.current, activeRef.current, true), 300);
        return;
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { obs.disconnect(); window.clearTimeout(timer); };
  }, [open, query, effectiveLive, build]);

  // ── Navigation, both scopes ──
  const step = useCallback((delta: number) => {
    if (!effectiveLive) {
      const total = visibleHits.length;
      if (total === 0) return;
      const next = (hitIdxRef.current + delta + total) % total;
      setHitIdx(next);
      const hit = visibleHits[next];
      if (hit) {
        setWhere(hit.title);
        if (hit.section) {
          const samePage = !currentPageId || hit.pageId === currentPageId;
          if (samePage) {
            // Land the user on the hit, not just on the page containing it.
            window.setTimeout(() => {
              const el = document.querySelector<HTMLElement>(`[data-section="${CSS.escape(hit.section!)}"]`);
              (el ?? null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 40);
          }
        }
      }
      return;
    }
    setActive((prev) => {
      const total = marksRef.current.length;
      if (total === 0) return 0;
      return (prev + delta + total) % total;
    });
  }, [effectiveLive, visibleHits, currentPageId]);

  const commit = useCallback(() => {
    if (effectiveLive) return;
    const hit = visibleHits[hitIdx];
    if (hit) onSelect?.(hit);
    onClose();
  }, [effectiveLive, visibleHits, hitIdx, onSelect, onClose]);

  // ── Drag to reposition (snaps to the nearest of the 9 cells) ──
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      const h: AnchorH = x < window.innerWidth / 3 ? 'left' : x > (window.innerWidth * 2) / 3 ? 'right' : 'center';
      const v: AnchorV = y < window.innerHeight / 2 ? 'top' : 'bottom';
      const next = { v, h };
      setAnchor((prev) => (sameAnchor(prev, next) ? prev : next));
    };
    const onUp = () => {
      setDragging(false);
      setAnchor((a) => { saveAnchor(a); return a; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // ── Keys ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'f') {
        // Chrome behaviour: Ctrl+F while open re-focuses, it does not dismiss.
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPlaceOpen(false); onClose(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (e.key === 'Enter' && e.shiftKey) { step(-1); return; }
        if (e.key === 'Enter') { effectiveLive ? step(1) : commit(); return; }
        step(1);
        return;
      }
      if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); return; }
      if (e.key === 'Tab') e.preventDefault(); // never tab out of the find field
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose, step, commit, effectiveLive]);

  // ── Derived readouts ──
  const total = effectiveLive ? count : visibleHits.length;
  const pos = effectiveLive ? active : hitIdx;

  const status = useMemo(() => {
    if (!query.trim()) return null;
    if (indexFailed && !effectiveLive) return <span className="text-[10px] text-rose-400">index offline</span>;
    if (total === 0) return <span className="text-[10px] text-zinc-500">0</span>;
    return (
      <span className="text-[11px] font-mono tabular-nums text-zinc-400">
        {pos + 1}<span className="text-zinc-600">/{total}</span>
      </span>
    );
  }, [query, total, pos, indexFailed, effectiveLive]);

  if (!open) return null;

  const panelOpen = !!query.trim();
  const panelBelow = anchor.v === 'top';

  return (
    <div ref={rootRef} data-df-find-bar style={anchorStyle(anchor)} className="w-fit max-w-[min(92vw,420px)]">
      {/* ── The instrument ── */}
      <div
        role="search"
        aria-label="Find in page"
        className={`flex items-center gap-1.5 rounded-[12px] border border-white/10 bg-zinc-900/95 pl-1 pr-1.5 py-1.5 transition-shadow ${
          dragging ? 'shadow-xl shadow-black/60' : 'shadow-lg shadow-black/40'
        }`}
      >
        {/* Drag grip — the discoverable way to move the bar. Drag only; the
            ⚙ beside it owns the click-to-place path, so neither control is a
            two-in-one. */}
        <button
          type="button"
          aria-label="Move find bar"
          title="Drag to reposition"
          onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
          className="grid h-6 w-5 shrink-0 cursor-grab place-items-center rounded-[8px] text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
        >
          <GripHorizontal size={14} />
        </button>
        <button
          type="button"
          aria-label="Find bar position"
          title="Position"
          aria-expanded={placeOpen}
          onClick={() => setPlaceOpen((p) => !p)}
          className={`grid h-6 w-5 shrink-0 place-items-center rounded-[8px] transition-colors ${
            placeOpen ? 'bg-zinc-800 text-amber-200' : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300'
          }`}
        >
          <Settings2 size={13} />
        </button>

        <Search size={15} className="shrink-0 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={live ? 'Find in page' : `Search ${scope === 'all' ? 'the whole app' : 'this page'}`}
          aria-label={live ? 'Find in page' : 'Search indexed content'}
          className="w-[132px] bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
        />

        <div className="w-[46px] shrink-0 text-right">{status}</div>

        <button
          type="button"
          aria-label="Previous match"
          disabled={total === 0}
          onClick={() => step(-1)}
          className="grid h-6 w-6 place-items-center rounded-[8px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          aria-label="Next match"
          disabled={total === 0}
          onClick={() => step(1)}
          className="grid h-6 w-6 place-items-center rounded-[8px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronDown size={15} />
        </button>
        <button
          type="button"
          aria-label="Close find"
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-[8px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Scope row (progressive disclosure: always visible, one tap) ── */}
      <div
        className={`mt-1 flex items-center gap-1 rounded-[8px] border border-white/5 bg-zinc-900/95 p-0.5 ${
          panelBelow ? '' : 'flex-row-reverse'
        }`}
      >
        {SCOPES.map((s) => {
          const Icon = s.icon;
          const on = scope === s.value;
          return (
            <button
              key={s.value}
              type="button"
              title={s.hint}
              aria-pressed={on}
              onClick={() => setScope(s.value)}
              className={`flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] font-medium transition-colors ${
                on
                  ? 'bg-amber-400/15 text-amber-200 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.28)]'
                  : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
              }`}
            >
              <Icon size={12} />
              {s.label}
            </button>
          );
        })}
        <span className="ml-auto pr-1 text-[10px] text-zinc-600">
          {indexed === null ? '' : `${indexed.toLocaleString()} indexed`}
        </span>
      </div>

      {/* ── Placement picker (only when asked for) ── */}
      {placeOpen && (
        <div
          className={`absolute z-10 rounded-[12px] border border-white/10 bg-zinc-900/97 p-2.5 shadow-xl shadow-black/50 ${
            panelBelow ? 'left-0 top-full mt-1.5' : 'left-0 bottom-full mb-1.5'
          }`}
        >
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Position</p>
          <div className="grid grid-cols-3 gap-1">
            {ANCHOR_CELLS.map((cell) => {
              const on = sameAnchor(anchor, cell);
              return (
                <button
                  key={`${cell.v}-${cell.h}`}
                  type="button"
                  aria-label={`${cell.v} ${cell.h}`}
                  aria-pressed={on}
                  onClick={() => { moveTo(cell); setPlaceOpen(false); }}
                  className={`grid h-7 w-12 place-items-center rounded-[8px] border transition-colors ${
                    on
                      ? 'border-amber-400/50 bg-amber-400/15'
                      : 'border-white/10 bg-zinc-800/40 hover:border-white/20 hover:bg-zinc-800'
                  }`}
                >
                  <span className={`block rounded-[2px] ${on ? 'bg-amber-300' : 'bg-zinc-600'}`}
                        style={{ width: cell.h === 'center' ? 16 : 9, height: 5 }} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 max-w-[220px] text-[10px] leading-relaxed text-zinc-600">
            Or drag the grip. Saved for this machine.
          </p>
        </div>
      )}

      {/* ── Results / context panel ── */}
      {panelOpen && (
        <div
          className={`absolute left-0 right-0 overflow-hidden rounded-[12px] border border-white/10 bg-zinc-900/97 shadow-xl shadow-black/50 ${
            panelBelow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          }`}
        >
          {/* Live find: where the active match actually is. */}
          {effectiveLive && (
            <div className="px-2.5 py-1.5 text-[10px]">
              {where ? (
                <span className="text-zinc-600">in <span className="text-zinc-400">{where}</span></span>
              ) : total === 0 ? (
                <span className="text-zinc-500">No matches on this page.</span>
              ) : (
                <span className="text-zinc-600">Enter next · Shift+Enter previous</span>
              )}
            </div>
          )}

          {/* Indexed scopes: the result list. */}
          {!effectiveLive && (
            <div className="max-h-[340px] overflow-y-auto">
              {searching && (
                <div className="px-3 py-3 text-center text-[11px] text-zinc-600">Searching…</div>
              )}

              {!searching && indexFailed && (
                <div className="px-3 py-3 text-center text-[11px] text-rose-400">
                  Search index unavailable.
                </div>
              )}

              {!searching && !indexFailed && visibleHits.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <Search size={18} className="mx-auto mb-1.5 text-zinc-700" />
                  <p className="text-[11px] text-zinc-500">
                    No indexed results for <span className="text-zinc-400">“{query.trim()}”</span>
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    {scope === 'section' ? 'Try the Page scope to search what you can see.' : 'Only pages that registered content are indexed.'}
                  </p>
                </div>
              )}

              {!searching && visibleHits.length > 0 && (
                <div className="p-1">
                  {visibleHits.map((hit, i) => (
                    <button
                      key={hit.id}
                      type="button"
                      onMouseEnter={() => setHitIdx(i)}
                      onClick={() => { setHitIdx(i); onSelect?.(hit); onClose(); }}
                      className={`w-full rounded-[8px] px-2 py-1.5 text-left transition-colors ${
                        i === hitIdx ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <span className="max-w-[120px] truncate rounded-[4px] border border-white/5 bg-zinc-800 px-1 py-px text-[9px] font-medium text-zinc-500">
                          {hit.section || hit.pageId}
                        </span>
                        {hit.pageId !== currentPageId && (
                          <span className="truncate text-[9px] text-zinc-600">↗ {hit.pageId}</span>
                        )}
                      </div>
                      <div className="truncate text-[12px] font-medium text-zinc-200">{hit.title}</div>
                      {hit.snippet && (
                        <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{hit.snippet}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NativeFindOverlay;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Layers, Trash2, Copy, Check, Keyboard, Save, X, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import TokenMeter from '../components/TokenMeter';
import InlineNotice from '../components/InlineNotice';
import api from '../lib/api';
import { detectLanguage } from '../lib/lang';
import { composePrompt, selectionTokens, KIND_ORDER, KIND_LABEL, type SourceItem, type SourceKind } from '../lib/compose';
import {
  initialSelectState, toggle, extendRange, moveCursor, selectAll, clearSelection, moveInList, SHORTCUTS,
} from '../lib/selection';

const MAX_TOKENS = 8000;

export default function Compose() {
  const [items, setItems] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [task, setTask] = useState('Explain the selected material like I missed the lecture, then quiz me.');
  const [order, setOrder] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [budget, setBudget] = useState(MAX_TOKENS);
  const [copied, setCopied] = useState(false);

  const [sel, setSel] = useState(initialSelectState);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchFocused = useRef(false);

  // ── load every source type, so mixing them is one list ────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const collected: SourceItem[] = [];
      const grab = async <T,>(path: string): Promise<T[]> => {
        try { const r = await api.get(path); return Array.isArray(r) ? (r as T[]) : []; } catch { return []; }
      };
      try {
        const [decks, slides, transcripts, webs, images, prompts] = await Promise.all([
          grab<any>('/api/decks'), grab<any>('/api/slides'), grab<any>('/api/transcripts'),
          grab<any>('/api/web-sources'), grab<any>('/api/images'), grab<any>('/api/prompts'),
        ]);

        const deckById = new Map<number, string>(decks.map(d => [Number(d.id), String(d.title || d.filename || 'Deck')]));
        const slidesByDeck = new Map<number, string[]>();
        for (const s of slides) {
          const k = Number(s.deck_id);
          slidesByDeck.set(k, [...(slidesByDeck.get(k) || []), String(s.title || 'Slide ' + s.slide_number)]);
        }

        for (const d of decks) {
          const outline = (slidesByDeck.get(Number(d.id)) || []).map((t, i) => `${i + 1}. ${t}`).join('\n');
          collected.push({
            id: `deck:${d.id}`, kind: 'deck', title: String(d.title || 'Deck'),
            sub: `${d.slide_count} slides · ${(d.total_tokens || 0).toLocaleString()} tok`,
            text: outline || `Deck "${d.title}" with ${d.slide_count} slides.`,
            tokens: Math.max(1, Math.round(outline.length / 4)),
          });
        }
        for (const s of slides) {
          const text = [s.text_content, s.notes].filter(Boolean).join('\n\n').trim();
          if (!text) continue;
          collected.push({
            id: `slide:${s.id}`, kind: 'slide',
            title: String(s.title || 'Slide ' + s.slide_number),
            sub: `${deckById.get(Number(s.deck_id)) || 'deck'} · slide ${s.slide_number}`,
            text, tokens: Number(s.token_estimate) || undefined,
          });
        }
        for (const t of transcripts) {
          const text = String(t.content || '');
          if (!text.trim()) continue;
          collected.push({
            id: `transcript:${t.id}`, kind: 'transcript',
            title: String(t.title || 'Transcript'),
            sub: `${t.detected_language || 'en'} · ${(text.length / 1000).toFixed(1)}k chars`,
            text: text.slice(0, 12000), tokens: Math.round(text.length / 4),
          });
        }
        for (const w of webs) {
          const text = String(w.extracted_text || w.prompt_pack || '');
          if (!text.trim()) continue;
          collected.push({
            id: `web:${w.id}`, kind: 'web',
            title: String(w.title || w.url || 'Web source'),
            sub: `${w.source_type === 'youtube' ? 'YouTube' : 'web'} · ${(text.length / 1000).toFixed(1)}k chars`,
            text: text.slice(0, 12000), tokens: Math.round(text.length / 4),
          });
        }
        for (const im of images) {
          const text = [im.ocr_text, im.caption].filter(Boolean).join('\n\n').trim();
          if (!text.trim()) continue;
          collected.push({
            id: `image:${im.id}`, kind: 'image',
            title: String(im.filename || 'Figure'),
            sub: 'vision text + caption', text, tokens: Number(im.token_estimate) || undefined,
          });
        }
        for (const p of prompts) {
          const text = String(p.content || '');
          if (!text.trim()) continue;
          collected.push({
            id: `prompt:${p.id}`, kind: 'prompt',
            title: String(p.title || 'Prompt'),
            sub: `${p.prompt_type} → ${p.target_ai}`, text,
          });
        }
        setItems(collected);
      } catch (e: any) {
        setLoadError('Could not load sources: ' + (e?.message || String(e)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── filter + group ────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = needle
      ? items.filter(i => (i.title + ' ' + (i.sub || '') + ' ' + i.text).toLowerCase().includes(needle))
      : items;
    // Grouped by kind, in a fixed kind order — predictable positions matter when
    // Shift-extending a range across the list.
    return hit.slice().sort((a, b) => (KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)));
  }, [items, q]);

  const rowRefs = useMemo(() => visible.map(i => ({ id: i.id })), [visible]);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  // Drop selected ids that no longer exist (e.g. after a reload).
  useEffect(() => {
    setSel(s => ({ ...s, selected: s.selected.filter(id => byId.has(id)), lastRange: s.lastRange.filter(id => byId.has(id)) }));
  }, [byId]);

  // `order` is the tray sequence; seeds from first selection, then follows it.
  const tray = useMemo(() => {
    const ids = order.filter(id => sel.selected.includes(id) && byId.has(id));
    const missing = sel.selected.filter(id => !ids.includes(id));
    return [...ids, ...missing];
  }, [order, sel.selected, byId]);

  const trayItems = useMemo(() => tray.map(id => byId.get(id)!).filter(Boolean), [tray, byId]);
  const lang = useMemo(() => detectLanguage(trayItems.map(t => t.text).join(' ')).lang, [trayItems]);
  const result = useMemo(
    () => composePrompt(trayItems, { task, lang: lang === 'mixed' ? 'en' : lang, maxTokens: budget }),
    [trayItems, task, lang, budget],
  );

  // ── actions ───────────────────────────────────────────────────────────────
  const focusSearch = () => { searchRef.current?.focus(); searchRef.current?.select(); };

  const copyResult = useCallback(async () => {
    if (!result.text.trim() || result.included.length === 0) {
      setNotice({ tone: 'error', text: 'Select at least one source first — press Space on a highlighted row.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      setNotice({
        tone: result.dropped.length ? 'info' : 'success',
        text: `Copied ${result.included.length} source${result.included.length === 1 ? '' : 's'} — ${result.tokens.toLocaleString()} tokens` +
          (result.dropped.length ? `; ${result.dropped.length} omitted to stay under ${budget}.` : '.'),
      });
    } catch { setNotice({ tone: 'error', text: 'Clipboard write was blocked by the OS.' }); }
  }, [result, budget]);

  const saveResult = async () => {
    if (!result.included.length) { setNotice({ tone: 'error', text: 'Nothing composed yet.' }); return; }
    try {
      await api.post('/api/prompts', {
        title: 'Combo: ' + (result.included[0].title || 'sources').slice(0, 50) +
          (result.included.length > 1 ? ` +${result.included.length - 1}` : ''),
        prompt_type: 'combo',
        source_ref: tray.join(',').slice(0, 200),
        content: result.text.slice(0, 12000),
        token_estimate: result.tokens,
        target_ai: 'chatgpt',
      });
      setNotice({ tone: 'success', text: 'Composed prompt saved to Prompt Forge.' });
    } catch (e: any) {
      setNotice({ tone: 'error', text: 'Save failed: ' + (e?.message || String(e)) });
    }
  };

  // ── keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && /^(INPUT|TEXTAREA)$/.test(t.tagName);

      if (e.key === '?' && !typing) { e.preventDefault(); setShowHelp(v => !v); return; }
      if (e.key === '/' && !typing) { e.preventDefault(); focusSearch(); return; }
      if (e.key === 'Escape') {
        if (showHelp) { setShowHelp(false); return; }
        if (typing) { (t as HTMLInputElement).blur(); return; }
        setSel(clearSelection); return;
      }
      if (typing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault(); setSel(s => selectAll(s, rowRefs)); return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        // Alt+Arrow reorders the focused tray row instead of moving the cursor.
        if (e.altKey && tray.length) {
          const id = tray[Math.max(0, Math.min(tray.length - 1, sel.cursor))];
          if (id) { setOrder(o => moveInList(o.length ? o : tray, id, d)); e.preventDefault(); }
          return;
        }
        setSel(s => moveCursor(s, rowRefs, d, e.shiftKey));
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        const row = rowRefs[Math.max(0, Math.min(rowRefs.length - 1, sel.cursor))];
        if (!row) return;
        e.preventDefault();
        setSel(s => e.shiftKey ? extendRange(s, rowRefs, row.id) : toggle(s, rowRefs, row.id, 'toggle'));
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); void copyResult(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rowRefs, sel.cursor, tray, showHelp, copyResult]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel.cursor}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [sel.cursor]);

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="text-sm text-white/50">Loading sources…</div>;
  if (loadError) return <InlineNotice tone="error">{loadError}</InlineNotice>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">Prompt Composer</h1>
          <p className="text-sm text-white/50 mt-1">
            Combine any mix of sources — decks, slides, transcripts, YouTube digests, figures — into one attributed prompt.
            Press <kbd className="font-mono text-white/70">?</kbd> for shortcuts.
          </p>
        </div>
        <button
          onClick={() => setShowHelp(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs text-white/70 hover:text-white"
        >
          <Keyboard className="w-3.5 h-3.5" /> Shortcuts
        </button>
      </div>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      {showHelp && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {SHORTCUTS.map(s => (
              <div key={s.keys} className="flex items-center justify-between gap-3 text-xs">
                <kbd className="font-mono rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">{s.keys}</kbd>
                <span className="text-white/55">{s.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px_minmax(0,1.05fr)] gap-4 items-start">
        {/* ── source browser ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/10 px-3">
            <Search className="w-3.5 h-3.5 text-white/35 shrink-0" />
            <input
              ref={searchRef}
              value={q}
              onChange={e => { setQ(e.target.value); setSel(s => ({ ...s, cursor: 0 })); }}
              onFocus={() => { searchFocused.current = true; }}
              placeholder="Search sources…  (press / to jump here)"
              className="flex-1 bg-transparent text-sm text-white py-2.5 outline-none placeholder:text-white/25"
            />
            {q && <button onClick={() => { setQ(''); setSel(s => ({ ...s, cursor: 0 })); }} title="Clear search"><X className="w-3.5 h-3.5 text-white/40 hover:text-white" /></button>}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-white/40 px-1">
            <span>{visible.length} shown{sel.selected.length ? ` · ${sel.selected.length} selected` : ''}</span>
            <div className="flex gap-1.5">
              <button onClick={() => setSel(s => selectAll(s, rowRefs))} className="rounded-md border border-white/10 px-1.5 py-0.5 hover:text-white">select all</button>
              <button onClick={() => setSel(clearSelection)} className="rounded-md border border-white/10 px-1.5 py-0.5 hover:text-white">clear</button>
            </div>
          </div>

          <div ref={listRef} className="mt-1 max-h-[520px] overflow-y-auto pr-1" role="listbox" aria-label="Sources" tabIndex={0}>
            {visible.map((it, i) => {
              const on = sel.selected.includes(it.id);
              const isCursor = i === sel.cursor;
              return (
                <button
                  key={it.id}
                  data-idx={i}
                  role="option"
                  aria-selected={on}
                  onMouseDown={() => { searchFocused.current = false; }}
                  onClick={(e) => {
                    setSel(s => e.shiftKey ? extendRange(s, rowRefs, it.id)
                      : e.ctrlKey || e.metaKey ? toggle(s, rowRefs, it.id, 'add')
                      : toggle(s, rowRefs, it.id, 'toggle'));
                    setSel(s => ({ ...s, cursor: i }));
                  }}
                  className={'w-full text-left rounded-xl px-2.5 py-2 border transition-colors flex items-start gap-2.5 ' +
                    (on ? 'border-emerald-300/45 bg-emerald-300/10'
                      : isCursor ? 'border-amber-300/40 bg-amber-300/[0.07]' : 'border-transparent hover:bg-white/[0.04]')}
                >
                  <span className={'mt-0.5 shrink-0 text-[9px] font-bold rounded-md px-1.5 py-0.5 border ' +
                    (on ? 'border-emerald-400/40 text-emerald-200 bg-emerald-400/10' : 'border-white/10 text-white/35')}>
                    {KIND_LABEL[it.kind as SourceKind].slice(0, 5)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-white truncate">{it.title}</span>
                    {it.sub && <span className="block text-[10px] font-mono text-white/35 truncate">{it.sub}</span>}
                  </span>
                  <span className="text-[10px] font-mono text-white/30 shrink-0">{(it.tokens || Math.round(it.text.length / 4)).toLocaleString()}</span>
                </button>
              );
            })}
            {visible.length === 0 && <div className="text-xs text-white/35 p-4 text-center">Nothing matches “{q}”.</div>}
          </div>
        </div>

        {/* ── tray ───────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-white">Selected <span className="font-mono text-white/40">{trayItems.length}</span></div>
            <span className="text-[10px] font-mono text-white/40">{selectionTokens(trayItems).toLocaleString()} tok</span>
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {trayItems.map((it, i) => (
              <div key={it.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <div className="flex items-center gap-1.5">
                  <GripVertical className="w-3 h-3 text-white/25 shrink-0" />
                  <span className="text-[10px] font-mono text-white/35 shrink-0">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-[11px] text-white/80 truncate">{it.title}</span>
                  <button
                    onClick={() => setOrder(o => moveInList(o.length ? o : tray, it.id, -1))}
                    disabled={i === 0} title="Move up (Alt+↑)"
                    className="text-white/30 hover:text-white disabled:opacity-20"
                  ><ChevronUp className="w-3 h-3" /></button>
                  <button
                    onClick={() => setOrder(o => moveInList(o.length ? o : tray, it.id, 1))}
                    disabled={i === trayItems.length - 1} title="Move down (Alt+↓)"
                    className="text-white/30 hover:text-white disabled:opacity-20"
                  ><ChevronDown className="w-3 h-3" /></button>
                  <button onClick={() => setSel(s => toggle(s, rowRefs, it.id, 'toggle'))} title="Remove" className="text-white/30 hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {trayItems.length === 0 && (
              <div className="text-[11px] text-white/35 leading-relaxed p-2">
                Nothing selected yet. Click a source, or press <kbd className="font-mono">↑</kbd> then{' '}
                <kbd className="font-mono">Space</kbd>. Shift-click / Shift+<kbd className="font-mono">↑↓</kbd> to grab a range.
              </div>
            )}
          </div>

          <div className="mt-auto space-y-2 pt-2 border-t border-white/10">
            <label className="text-[10px] font-mono text-white/40">What should the AI do with it?</label>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              rows={3}
              className="w-full rounded-xl bg-black/30 border border-white/10 text-xs text-white/85 p-2.5 outline-none focus:border-amber-300/40"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/40 shrink-0">budget</span>
              <input
                type="range" min={1000} max={20000} step={500} value={budget}
                onChange={e => setBudget(Number(e.target.value))}
                aria-label="Token budget"
                className="flex-1 accent-amber-400"
              />
              <span className="text-[10px] font-mono text-white/60 w-14 text-right">{budget.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── preview ────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-white">
              Composed prompt
              <span className="ml-2 font-mono text-[10px] text-white/40">
                {result.included.length}/{trayItems.length} sources · {result.tokens.toLocaleString()} tok
              </span>
            </div>
          </div>
          <TokenMeter value={result.tokens} max={budget} label="" />
          {result.dropped.length > 0 && (
            <div className="mt-2 text-[10px] font-mono text-amber-200/80">
              {result.dropped.length} source{result.dropped.length === 1 ? '' : 's'} omitted to fit the budget — raise it above.
            </div>
          )}
          <pre className="mt-3 max-h-[420px] overflow-y-auto whitespace-pre-wrap text-[11px] font-mono text-white/75 leading-relaxed rounded-xl bg-black/30 border border-white/10 p-3">
            {result.text}
          </pre>
          <div className="mt-3 flex gap-2">
            <button
              onClick={copyResult} disabled={!result.included.length}
              data-testid="compose-copy"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold py-2.5 disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={saveResult} disabled={!result.included.length}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold py-2.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          {trayItems.length === 0 && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-white/35">
              <Layers className="w-3.5 h-3.5" /> Pick sources on the left to build a combined prompt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Sparkles, Loader2, MousePointerClick, MessageCircleQuestion, StickyNote, Files, ClipboardList } from 'lucide-react';
import InlineNotice from '../components/InlineNotice';
import api from '../lib/api';
import TokenMeter from '../components/TokenMeter';
import AIBridge from '../components/AIBridge';
import { estimateTokens, optimizePrompt } from '../lib/tokens';
import { detectLanguage } from '../lib/lang';
import { buildDeckText, buildDeckPrompt, describeSelection } from '../lib/deck';
const Q_TEMPLATES = [
  'Explain this slide to me like I missed the lecture.',
  'Give a worked CS/math example for the key idea here.',
  'Turn this slide into 5 exam questions with answers.',
  'Jelaskan slide ini dalam Bahasa Indonesia yang sederhana.',
  'What are common misconceptions about this topic?',
];
export default function SlideViewer() {
  const { id } = useParams();
  const [deck, setDeck] = useState<any>(null);
  const [slides, setSlides] = useState<any[]>([]);
  const [active, setActive] = useState(0);
  const [elements, setElements] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [question, setQuestion] = useState(Q_TEMPLATES[0]);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);
  /** Slide ids chosen for deck-level copy. Empty = "all slides". */
  const [selSlides, setSelSlides] = useState<Set<number>>(new Set());
  const [bulkCopied, setBulkCopied] = useState<'text' | 'prompt' | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const decks = await api.get('/api/decks');
        const found = (decks || []).find((d: any) => String(d.id) === String(id));
        if (!found) setNotice({ tone: 'error', text: `Deck ${id} no longer exists — it may have been deleted.` });
        setDeck(found);
        const s = await api.get('/api/slides?deck_id=' + id);
        setSlides(Array.isArray(s) ? s : []);
      } catch (e: any) {
        setNotice({ tone: 'error', text: 'Could not load this deck: ' + (e?.message || String(e)) });
      } finally { setLoading(false); }
    })();
  }, [id]);
  useEffect(() => {
    (async () => {
      if (!slides[active]) return;
      const els = await api.get('/api/slide-elements?slide_id=' + slides[active].id).catch((e: any) => {
        setNotice({ tone: 'error', text: 'Could not load slide elements: ' + (e?.message || String(e)) });
        return [];
      });
      setElements(Array.isArray(els) ? els : []);
      setPicked(new Set());
    })();
  }, [active, slides]);

  // Arrow-key navigation, so reviewing a deck doesn't require reaching for the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'ArrowLeft') { setActive(a => Math.max(0, a - 1)); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setActive(a => Math.min(slides.length - 1, a + 1)); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);
  useEffect(() => {
    const s = slides[active];
    if (!s) return;
    const selEls = elements.filter(e => picked.has(e.id));
    const content = selEls.length ? selEls.map(e => '- [' + e.element_type + '] ' + e.content).join('\n') : (s.text_content || '');
    const lang = detectLanguage(content).lang;
    const head = lang === 'id' ? '[KONTEKS] Deck "' + (deck?.title || '') + '" - Slide ' + s.slide_number + ': ' + s.title : '[CONTEXT] Deck "' + (deck?.title || '') + '" - Slide ' + s.slide_number + ': ' + s.title;
    setPrompt(optimizePrompt(head + '\n\n[SELECTED ELEMENTS]\n' + content.slice(0, 3000) + '\n\n[TASK] ' + question + '\nGround every claim in the slide content above. End with 2 retrieval questions.'));
  }, [slides, active, elements, picked, question, deck]);
  const toggle = (eid: number) => { const n = new Set(picked); if (n.has(eid)) n.delete(eid); else n.add(eid); setPicked(n); };

  // ── Deck-level ("copy the whole PPT at once") ──────────────────────────────
  const orderedSlides = [...slides].sort((a, b) => (a.slide_number || 0) - (b.slide_number || 0));
  // Empty selection means the whole deck — that is the default the user asked
  // for, so the common case is one click with no setup.
  const scopeSlides = selSlides.size
    ? orderedSlides.filter(s => selSlides.has(s.id))
    : orderedSlides;

  const toggleSlide = (sid: number) => {
    const n = new Set(selSlides);
    if (n.has(sid)) n.delete(sid); else n.add(sid);
    setSelSlides(n);
  };

  const deckDoc = { title: deck?.title || 'Deck', slides: scopeSlides };
  const deckTextOut = buildDeckText(deckDoc);
  const deckLang = detectLanguage(deckTextOut).lang;
  const deckPromptOut = buildDeckPrompt(deckDoc, question, deckLang, 8000);

  const copyBulk = async (kind: 'text' | 'prompt') => {
    const payload = kind === 'text' ? deckTextOut : deckPromptOut.text;
    if (!payload.trim()) {
      setNotice({ tone: 'error', text: 'Nothing to copy — the selected slides have no extracted text.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setBulkCopied(kind);
      setTimeout(() => setBulkCopied(null), 1600);
      const scope = describeSelection(scopeSlides);
      if (kind === 'text') {
        setNotice({ tone: 'success', text: `Copied the full deck text (slides ${scope}) — ${estimateTokens(payload).toLocaleString()} tokens.` });
      } else {
        const { included, omitted } = deckPromptOut;
        setNotice({
          tone: omitted ? 'info' : 'success',
          text: `Copied a whole-deck prompt (slides ${scope}) — ${included} slide${included === 1 ? '' : 's'} included` +
            (omitted ? `, ${omitted} omitted to stay within 8000 tokens.` : '.') ,
        });
      }
    } catch {
      setNotice({ tone: 'error', text: 'Clipboard write was blocked by the OS.' });
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setNotice({ tone: 'error', text: 'Clipboard write was blocked by the OS.' }); }
  };
  const save = async () => {
    const s = slides[active];
    if (!s) return;
    try {
      await api.post('/api/prompts', {
        title: 'Slide ' + s.slide_number + ': ' + String(s.title || '').slice(0, 60),
        prompt_type: 'slide_qa',
        source_ref: 'deck:' + id + '/slide:' + s.slide_number,
        content: prompt,
        token_estimate: estimateTokens(prompt),
        target_ai: 'chatgpt',
      });
      setNotice({ tone: 'success', text: 'Prompt saved to Prompt Forge.' });
    } catch (e: any) {
      setNotice({ tone: 'error', text: 'Save failed: ' + (e?.message || String(e)) });
    }
  };
  if (loading) return <div className="text-white/50 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading slides...</div>;
  if (!slides.length) return <div className="text-white/50 text-sm">No slides found. <Link to="/lecture/ingest" className="underline text-amber-300">Back</Link></div>;
  const s = slides[active];
  return (
    <div className="space-y-4">
      <Link to="/lecture/ingest" className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" /> All files</Link>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div><h1 className="font-display text-xl font-bold text-white tracking-tight">{deck?.title || 'Deck'}</h1><p className="text-xs text-white/45 mt-0.5">Slide {s.slide_number} of {slides.length} — click elements to scope your prompt (← → to navigate)</p></div>
        <div className="flex gap-2"><button onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold px-3 py-2">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied!' : 'Copy prompt'}</button>
        <button onClick={save} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold px-3 py-2"><Sparkles className="w-3.5 h-3.5" /> Save to Forge</button></div>
      </div>
      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      {/* ── Bulk copy: the whole PPT, not one slide at a time ─────────────── */}
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-100">
            <Files className="w-4 h-4" /> Copy the whole deck
          </div>
          <span className="text-[11px] font-mono text-white/45">
            scope: {selSlides.size ? `${scopeSlides.length}/${slides.length} selected (slides ${describeSelection(scopeSlides)})` : `all ${slides.length} slides`}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={() => copyBulk('text')}
              data-testid="lecture-copy-all-text"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold px-3 py-2"
            >
              {bulkCopied === 'text' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {bulkCopied === 'text' ? 'Copied' : 'Copy all text'}
            </button>
            <button
              onClick={() => copyBulk('prompt')}
              data-testid="lecture-copy-all-prompt"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold px-3 py-2"
            >
              {bulkCopied === 'prompt' ? <Check className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />}
              {bulkCopied === 'prompt' ? 'Copied' : 'Copy whole-deck prompt'}
            </button>
          </div>
        </div>
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-mono text-white/40 mb-1">Deck text · {estimateTokens(deckTextOut).toLocaleString()} tok</div>
            <TokenMeter value={estimateTokens(deckTextOut)} max={8000} label="" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-white/40 mb-1">Deck prompt · {deckPromptOut.included} of {scopeSlides.length} slides</div>
            <TokenMeter value={deckPromptOut.tokens} max={8000} label="" />
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-[220px_1fr_380px] gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2 max-h-[560px] overflow-y-auto space-y-1.5">
          <div className="flex items-center gap-2 px-1 pb-1">
            <button
              onClick={() => setSelSlides(selSlides.size ? new Set() : new Set(slides.map(s => s.id)))}
              className="text-[10px] font-mono rounded-lg border border-white/10 px-2 py-1 text-white/50 hover:text-white hover:border-white/25 transition-colors"
            >
              {selSlides.size ? 'Clear selection' : 'Select all'}
            </button>
            <span className="text-[10px] font-mono text-white/30">checkbox = bulk-copy scope</span>
          </div>
          {slides.map((sl, i) => (
            <button key={sl.id} onClick={() => setActive(i)} className={'w-full text-left rounded-xl p-2.5 border transition-all flex items-start gap-2 ' + (i === active ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06]')}>
              <input
                type="checkbox"
                checked={selSlides.has(sl.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleSlide(sl.id)}
                aria-label={`Include slide ${sl.slide_number} in bulk copy`}
                className="mt-0.5 accent-amber-400 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-mono text-white/40">SLIDE {sl.slide_number} · {(sl.token_estimate || 0)} tok</span>
                <span className="block text-xs font-semibold text-white mt-0.5 line-clamp-2">{sl.title}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#171c33] to-[#101426] p-5 min-h-[260px]">
            <div className="text-[10px] tracking-widest font-bold text-amber-300/80">SLIDE {s.slide_number} PREVIEW</div>
            <h2 className="mt-1 font-display text-lg font-bold text-white">{s.title}</h2>
            <div className="mt-3 space-y-2">
              {(elements.length ? elements : [{ id: -1, element_type: 'body', content: s.text_content }]).map((el: any) => {
                const isNotes = el.element_type === 'notes';
                return (
                  <button
                    key={el.id}
                    onClick={() => el.id > 0 && toggle(el.id)}
                    className={'w-full text-left rounded-xl border p-3 transition-all ' + (picked.has(el.id) ? 'border-emerald-300/50 bg-emerald-300/10' : isNotes ? 'border-violet-400/20 bg-violet-500/[0.07] hover:border-violet-300/35' : 'border-white/10 bg-black/25 hover:border-amber-300/30')}
                  >
                    <div className="flex items-center gap-2">
                      {isNotes ? <StickyNote className="w-3 h-3 text-violet-300/70" /> : <MousePointerClick className="w-3 h-3 text-white/35" />}
                      <span className={'text-[10px] font-mono uppercase tracking-wider ' + (isNotes ? 'text-violet-300/80' : 'text-white/40')}>
                        {isNotes ? 'speaker notes' : el.element_type}
                      </span>
                      {picked.has(el.id) && <span className="ml-auto text-[10px] font-bold text-emerald-300">SELECTED</span>}
                    </div>
                    <div className="mt-1 text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap line-clamp-6">{el.content}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white"><MessageCircleQuestion className="w-4 h-4 text-amber-300" /> Per-slide question</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{Q_TEMPLATES.map(q => <button key={q} onClick={() => setQuestion(q)} className={'text-[11px] rounded-lg px-2.5 py-1.5 border transition-all ' + (question === q ? 'border-amber-300/50 bg-amber-300/10 text-amber-100' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white')}>{q.slice(0, 42)}{q.length > 42 ? '...' : ''}</button>)}</div>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 text-sm text-white p-3 outline-none focus:border-amber-300/40" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-white mb-2">Generated prompt</div>
            <TokenMeter value={estimateTokens(prompt)} max={4000} />
            <pre className="mt-3 max-h-[380px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-white/75 font-mono rounded-xl bg-white/[0.03] border border-white/10 p-3">{prompt}</pre>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs font-semibold text-white mb-2">Ask free AI</div>
            <AIBridge compact />
          </div>
        </div>
      </div>
    </div>
  );
}

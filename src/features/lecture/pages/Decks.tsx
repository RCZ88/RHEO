import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileUp, Loader2, Trash2, ChevronRight, Presentation } from 'lucide-react';
import InlineNotice from '../components/InlineNotice';
import api from '../lib/api';
import { parsePptx, slideTokens, type ParsedSlide } from '../lib/pptx';
import { detectLanguage } from '../lib/lang';
import { getLocalStatus, runVision, VISION_FALLBACKS, type OllamaStatus } from '../lib/localai';

type Notice = { tone: 'info' | 'error' | 'success' | 'busy'; text: string } | null;

/** Inline images make a big base64 blob; keep the ones a VLM can actually read. */
const VISION_BYTE_BUDGET = 900 * 1024;

export default function Decks() {
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [readImages, setReadImages] = useState(true);

  const fetchDecks = async () => {
    try { setLoading(true); setDecks(await api.get('/api/decks')); }
    catch (e: any) { setError(e.message || 'Could not load decks.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDecks(); }, []);
  useEffect(() => {
    getLocalStatus().then(s => {
      setOllama(s.ollama);
      if (!s.ollama.visionModels.length) setReadImages(false);
    });
  }, []);

  const visionModels = ollama?.visionModels ?? [];
  const visionModel = visionModels[0] || '';
  const canReadImages = readImages && !!visionModel;

  /** Ask the local model what is drawn on this slide; fall back to text-only. */
  const readSlideImage = async (s: ParsedSlide): Promise<string> => {
    let budget = VISION_BYTE_BUDGET;
    for (const im of s.images) {
      const approxBytes = im.base64.length * 0.75;
      if (approxBytes > budget) continue;
      budget -= approxBytes;
      const res = await runVision({
        model: visionModel,
        imageBase64: im.base64,
        prompt:
          'This is a figure embedded in a lecture slide. Transcribe every piece of text exactly as written ' +
          '(title, axis labels, legend entries, annotations, formulas), then describe in 2-3 sentences what the ' +
          'figure depicts and what concept it illustrates.',
      });
      if (res.text) return `[FIGURE — read by ${res.model}]\n${res.text}`;
    }
    return '';
  };

  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files).find(f => f.name.toLowerCase().endsWith('.pptx'));
    if (!file) { setError('Please drop a .pptx file.'); return; }

    setError(''); setNotice(null);
    setBusy(`Parsing ${file.name}…`);

    try {
      const parsed = await parsePptx(file);
      if (!parsed.slides.length) throw new Error('No slides found in that file. Is it a real .pptx (not a renamed .ppt)?');

      const allText = parsed.slides.map(s => s.allText).join('\n');
      const lang = detectLanguage(allText).lang;
      const total = parsed.slides.reduce((a, s) => a + slideTokens(s), 0);

      const withNotes = parsed.slides.filter(s => s.notes).length;
      const withImages = parsed.slides.filter(s => s.images.length).length;
      const visionTotal = parsed.slides.reduce((a, s) => a + s.images.length, 0);

      setBusy(`Saving ${parsed.slides.length} slides…`);
      const deck: any = await api.post('/api/decks', {
        title: file.name.replace(/\.pptx$/i, ''),
        filename: file.name,
        slide_count: parsed.slides.length,
        status: 'ready',
        total_tokens: total,
        language: lang,
      });
      if (deck?.error) throw new Error(String(deck.error));

      // Read the figures BEFORE inserting, so the stored slide text already
      // contains what the local vision model saw.
      const visionBySlide = new Map<number, string>();
      if (canReadImages && visionTotal > 0) {
        const imgs = parsed.slides.filter(s => s.images.length);
        for (let i = 0; i < imgs.length; i++) {
          const s = imgs[i];
          setBusy(`${visionModel}: reading slide ${s.number} figure (${i + 1}/${imgs.length})…`);
          visionBySlide.set(s.number, await readSlideImage(s));
        }
      }

      const slideRows = parsed.slides.map(s => {
        const vision = visionBySlide.get(s.number) || '';
        // Speaker notes used to be hardcoded to '' — they are usually the most
        // valuable text in a lecture deck, so they are persisted and labelled.
        const notes = [s.notes && `[SPEAKER NOTES]\n${s.notes}`, vision].filter(Boolean).join('\n\n');
        return {
          deck_id: deck.id,
          slide_number: s.number,
          title: s.title,
          text_content: s.allText.slice(0, 6000),
          shapes_json: s.shapes.slice(0, 40),
          notes,
          token_estimate: slideTokens(s),
        };
      });
      const saved: any = await api.post('/api/slides', slideRows);
      if (!Array.isArray(saved)) throw new Error(String(saved?.error || 'Slides were not saved.'));

      const elRows: any[] = [];
      saved.forEach((sv: any, i: number) => {
        const parsedSlide = parsed.slides[i];
        if (!parsedSlide) return;
        parsedSlide.shapes.slice(0, 20).forEach(sh => elRows.push({
          slide_id: sv.id,
          element_type: sh.kind,
          content: sh.text.slice(0, 1500),
          position_json: { level: sh.level },
          token_estimate: Math.max(1, Math.round(sh.text.length / 4)),
        }));
        // One element carrying the notes/figure read, so the SlideViewer's
        // element picker can scope a question to it.
        if (parsedSlide.notes || visionBySlide.get(parsedSlide.number)) {
          elRows.push({
            slide_id: sv.id,
            element_type: 'notes',
            content: [parsedSlide.notes && `[SPEAKER NOTES]\n${parsedSlide.notes}`, visionBySlide.get(parsedSlide.number)].filter(Boolean).join('\n\n').slice(0, 3000),
            position_json: null,
            token_estimate: Math.max(1, Math.round((parsedSlide.notes || '').length / 4)),
          });
        }
      });
      if (elRows.length) await api.post('/api/slide-elements', elRows);

      setBusy('');
      await fetchDecks();
      const bits = [`${parsed.slides.length} slides`];
      if (withNotes) bits.push(`${withNotes} with speaker notes`);
      if (withImages) bits.push(`${withImages} with figures`);
      if (visionTotal) bits.push(`${visionTotal} figure${visionTotal > 1 ? 's' : ''} read by ${visionModel}`);
      if (parsed.warnings.length) {
        // Never let a partially-unreadable deck look like a clean import.
        setNotice({
          tone: 'error',
          text: `“${file.name}” ingested with ${parsed.warnings.length} unreadable part(s) — those slides are blank:\n` +
            parsed.warnings.slice(0, 4).join('\n') +
            (parsed.warnings.length > 4 ? `\n…and ${parsed.warnings.length - 4} more.` : ''),
        });
      } else {
        setNotice({ tone: 'success', text: `“${file.name}” ingested — ${bits.join(', ')}.` });
      }
    } catch (e: any) {
      setBusy('');
      setError('Parse failed: ' + (e?.message || String(e)));
    }
  };

  const remove = async (id: number, title: string) => {
    if (!confirm(`Delete “${title}” and all of its slides?`)) return;
    try {
      await api.del('/api/decks', { id });
      await fetchDecks();
      setNotice({ tone: 'success', text: `Deleted “${title}”.` });
    } catch (e: any) {
      setError('Delete failed: ' + (e?.message || String(e)));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Slide decks</h1>
        <p className="text-sm text-white/50 mt-1">
          PPTX files are parsed in your browser (JSZip + XML) — text, bullets, tables, <span className="text-white/70">speaker notes</span> and <span className="text-white/70">embedded figures</span> — then compressed into per-slide prompts. Nothing is uploaded.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={'rounded-xl border-2 border-dashed p-8 text-center transition-all ' + (drag ? 'border-amber-300 bg-amber-300/5' : 'border-white/15 bg-white/[0.02]')}
      >
        <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center shadow-lg shadow-violet-600/30"><Upload className="w-6 h-6 text-white" /></div>
        <div className="mt-3 font-display font-semibold text-white">Drop a .pptx here</div>
        <div className="text-xs text-white/45 mt-1">or click to browse — parsed locally; only the digested text is stored</div>

        {/* Local-vision toggle: only meaningful once a model is actually installed. */}
        <div className="mt-4 inline-flex flex-col items-start gap-1.5 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-left">
          <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={readImages}
              disabled={!visionModel}
              onChange={(e) => setReadImages(e.target.checked)}
              data-testid="lecture-deck-read-images"
              className="accent-amber-400"
            />
            Read each slide’s figures with the local vision model
            {visionModel && <span className="font-mono text-[10px] text-emerald-300">({visionModel})</span>}
          </label>
          {!visionModel && (
            <span className="text-[10px] text-white/35">
              No vision model installed — figures are still counted, but not read. Run <code className="font-mono">ollama pull {VISION_FALLBACKS[0]}</code> to enable.
            </span>
          )}
        </div>

        <label className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white text-black text-sm font-semibold px-4 py-2.5 cursor-pointer hover:bg-amber-200 transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} {busy || 'Choose PPTX'}
          <input type="file" accept=".pptx" className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.currentTarget.value = ''; }} />
        </label>
        {error && <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2 inline-block">{error}</div>}
      </div>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      {loading ? (
        <div className="text-sm text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading decks…</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {decks.map(d => (
            <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400/40 to-violet-600/40 border border-white/10 grid place-items-center shrink-0"><Presentation className="w-5 h-5 text-amber-100" /></div>
                <div className="min-w-0 flex-1"><div className="font-semibold text-white text-sm truncate">{d.title}</div><div className="text-[11px] text-white/40 font-mono mt-0.5 truncate">{d.filename || '—'}</div></div>
                <button onClick={() => remove(d.id, d.title)} title="Delete deck" className="text-white/30 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono">
                <span className="rounded-lg bg-white/5 px-2 py-1 text-white/70">{d.slide_count} slides</span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-emerald-300">{(d.total_tokens || 0).toLocaleString()} tok</span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-sky-300">{d.language}</span>
              </div>
              <Link to={'/lecture/decks/' + d.id} className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold py-2 transition-colors">
                Open and question slides <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
          {decks.length === 0 && (
            <div className="col-span-full text-sm text-white/35 rounded-xl border border-white/5 p-6 text-center">
              No decks yet. Drop a PPTX above to see per-slide questioning in action.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

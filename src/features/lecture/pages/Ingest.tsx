import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, FileUp, Loader2, Trash2, ChevronRight, Presentation, Files, Check,
  FileText, ScanLine,
} from 'lucide-react';
import InlineNotice from '../components/InlineNotice';
import api from '../lib/api';
import { parsePptx, slideTokens, type ParsedSlide } from '../lib/pptx';
import { buildDeckText } from '../lib/deck';
import { estimateTokens } from '../lib/tokens';
import { detectLanguage } from '../lib/lang';
import { getLocalStatus, runVision, formatMs, VISION_FALLBACKS, type OllamaStatus } from '../lib/localai';
import { parsePdf, type PdfPage } from '../lib/pdf';

type Notice = { tone: 'info' | 'error' | 'success' | 'busy'; text: string } | null;

/** Inline images make a big base64 blob; keep the ones a VLM can actually read. */
const VISION_BYTE_BUDGET = 900 * 1024;

const ACCEPT = [
  { ext: '.pptx', label: 'PowerPoint', icon: Presentation, note: 'Text, bullet levels, tables, speaker notes and embedded figures' },
  { ext: '.pdf', label: 'PDF', icon: FileText, note: 'Text layer via Poppler; scanned pages are rasterised and read by the local vision model' },
];

export default function Ingest() {
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [readImages, setReadImages] = useState(true);
  const [copiedDeck, setCopiedDeck] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ name: string; pages: PdfPage[] } | null>(null);
  /** The File itself, held so "Save" does not have to re-read it from disk. */
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);

  const fetchDecks = async () => {
    try { setLoading(true); setDecks(await api.get('/api/decks')); }
    catch (e: any) { setError(e.message || 'Could not load documents.'); }
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

  // ── PPTX ──────────────────────────────────────────────────────────────────
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

  const ingestPptx = async (file: File) => {
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
          deck_id: deck.id, slide_number: s.number, title: s.title,
          text_content: s.allText.slice(0, 6000), shapes_json: s.shapes.slice(0, 40),
          notes, token_estimate: slideTokens(s),
        };
      });
      const saved: any = await api.post('/api/slides', slideRows);
      if (!Array.isArray(saved)) throw new Error(String(saved?.error || 'Slides were not saved.'));

      const elRows: any[] = [];
      saved.forEach((sv: any, i: number) => {
        const ps = parsed.slides[i];
        if (!ps) return;
        ps.shapes.slice(0, 20).forEach(sh => elRows.push({
          slide_id: sv.id, element_type: sh.kind, content: sh.text.slice(0, 1500),
          position_json: { level: sh.level },
          token_estimate: Math.max(1, Math.round(sh.text.length / 4)),
        }));
        const noteBlock = [ps.notes && `[SPEAKER NOTES]\n${ps.notes}`, visionBySlide.get(ps.number)].filter(Boolean).join('\n\n');
        if (noteBlock) {
          elRows.push({
            slide_id: sv.id, element_type: 'notes', content: noteBlock.slice(0, 3000),
            position_json: null, token_estimate: Math.max(1, Math.round(noteBlock.length / 4)),
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
      setNotice(parsed.warnings.length
        ? { tone: 'error', text: `“${file.name}” ingested with ${parsed.warnings.length} unreadable part(s) — those slides are blank:\n` + parsed.warnings.slice(0, 4).join('\n') }
        : { tone: 'success', text: `“${file.name}” ingested — ${bits.join(', ')}.` });
    } catch (e: any) {
      setBusy(''); setError('PPTX import failed: ' + (e?.message || String(e)));
    }
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const ingestPdf = async (file: File, pages: PdfPage[]) => {
    setError(''); setNotice(null);
    setBusy(`Saving ${pages.length} pages…`);
    try {
      const text = pages.map(p => p.text).join('\n');
      const lang = detectLanguage(text).lang;
      const total = pages.reduce((a, p) => a + estimateTokens(p.text), 0);

      const deck: any = await api.post('/api/decks', {
        title: (file.name.replace(/\.pdf$/i, '')) || 'PDF import',
        filename: file.name,
        slide_count: pages.length,
        status: 'ready',
        total_tokens: total,
        language: lang,
      });
      if (deck?.error) throw new Error(String(deck.error));

      const rows = pages.map(p => ({
        deck_id: deck.id,
        slide_number: p.number,
        title: p.title || `Page ${p.number}`,
        text_content: p.text.slice(0, 6000),
        shapes_json: [],
        notes: p.ocrText || '',
        token_estimate: estimateTokens(p.text + (p.ocrText || '')),
      }));
      const saved: any = await api.post('/api/slides', rows);
      if (!Array.isArray(saved)) throw new Error(String(saved?.error || 'Pages were not saved.'));

      const elRows: any[] = [];
      saved.forEach((sv: any, i: number) => {
        const p = pages[i];
        if (!p?.ocrText) return;
        elRows.push({
          slide_id: sv.id, element_type: 'notes',
          content: p.ocrText.slice(0, 3000), position_json: null,
          token_estimate: Math.max(1, Math.round(p.ocrText.length / 4)),
        });
      });
      if (elRows.length) await api.post('/api/slide-elements', elRows);

      setBusy(''); setPreview(null); setPendingPdf(null);
      await fetchDecks();
      const scanned = pages.filter(p => p.scanned).length;
      const ocr = pages.filter(p => p.ocrText).length;
      const bits = [`${pages.length} pages`, `${total.toLocaleString()} tokens`];
      if (scanned) bits.push(`${scanned} scanned`);
      if (ocr) bits.push(`${ocr} read by ${visionModel}`);
      setNotice({ tone: 'success', text: `“${file.name}” ingested — ${bits.join(', ')}.` });
    } catch (e: any) {
      setBusy(''); setError('PDF import failed: ' + (e?.message || String(e)));
    }
  };

  // Pick the file, then either parse PPTX directly or extract the PDF first.
  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.pptx')) { setPreview(null); setPendingPdf(null); return ingestPptx(file); }
    if (!name.endsWith('.pdf')) {
      setError(`Unsupported file type. Accepted: ${ACCEPT.map(a => a.ext).join(', ')}`);
      return;
    }

    setError(''); setNotice(null);
    setBusy(`Extracting text from ${file.name}…`);
    try {
      const res = await parsePdf(file, { rasteriseScanned: canReadImages });
      if (res.error) { setBusy(''); setError(res.error); return; }
      setBusy('');

      // A document with no text layer at all would import as blank pages.
      // Say so instead of storing nothing.
      if (!res.meta.hasTextLayer && !res.pages.some(p => p.imageBase64)) {
        setError(
          `“${file.name}” has no extractable text (${res.meta.pageCount} page(s), 0 characters). ` +
          'It is most likely a scan. Pull a vision model (ollama pull ' + VISION_FALLBACKS[0] + ') and re-import — ' +
          'scanned pages are then rasterised and read locally.',
        );
        return;
      }

      // Read any scanned page that was rasterised.
      const pages = res.pages.map(p => ({ ...p }));
      const toRead = pages.filter(p => p.scanned && p.imageBase64);
      for (let i = 0; i < toRead.length; i++) {
        const p = toRead[i];
        setBusy(`${visionModel}: reading page ${p.number} (${i + 1}/${toRead.length})…`);
        const v = await runVision({
          model: visionModel, imageBase64: p.imageBase64 ?? '',
          prompt: 'Transcribe every word on this page exactly as written (headings, body, table cells, captions, page numbers). Preserve the reading order and any table layout. If it is only a figure, transcribe its labels then describe it.',
        });
        if (v.text) p.ocrText = `[READ BY ${v.model} IN ${formatMs(v.elapsedMs)}]\n${v.text}`;
      }
      setBusy('');
      setPendingPdf(file);
      setPendingPdf(file);
      setPreview({ name: file.name, pages });
    } catch (e: any) {
      setBusy(''); setError('PDF read failed: ' + (e?.message || String(e)));
    }
  };

  const copyWholeDeck = async (d: any) => {
    try {
      const rows = await api.get('/api/slides?deck_id=' + d.id);
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) { setNotice({ tone: 'error', text: `“${d.title}” has no pages to copy.` }); return; }
      const text = buildDeckText({ title: d.title || d.filename || 'Deck', slides: list });
      await navigator.clipboard.writeText(text);
      setCopiedDeck(d.id);
      setTimeout(() => setCopiedDeck(null), 1800);
      setNotice({ tone: 'success', text: `Copied all ${list.length} pages of “${d.title}” — ${estimateTokens(text).toLocaleString()} tokens.` });
    } catch (e: any) {
      setNotice({ tone: 'error', text: 'Copy failed: ' + (e?.message || String(e)) });
    }
  };

  const remove = async (id: number, title: string) => {
    if (!confirm(`Delete “${title}” and all of its pages?`)) return;
    try {
      await api.del('/api/decks', { id });
      await fetchDecks();
      setNotice({ tone: 'success', text: `Deleted “${title}”.` });
    } catch (e: any) {
      setError('Delete failed: ' + (e?.message || String(e)));
    }
  };

  const isPdf = (f: string) => f.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">File Ingestion</h1>
        <p className="text-sm text-white/50 mt-1">
          Bring in lecture material. Everything is parsed on this machine and stored as a document of
          pages, so per-slide questioning, whole-document copy and the prompt composer all work the same way.
        </p>
      </div>

      {/* ── accepted formats, stated up front ─────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3">
        {ACCEPT.map(a => (
          <div key={a.ext} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 flex gap-3">
            <a.icon className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white">{a.ext}</span>
                <span className="text-xs text-white/70">{a.label}</span>
              </div>
              <p className="text-[11px] text-white/45 mt-1 leading-relaxed">{a.note}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── local-vision toggle ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
            <input
              type="checkbox" checked={readImages} disabled={!visionModel}
              onChange={e => setReadImages(e.target.checked)}
              data-testid="lecture-read-images"
              className="accent-amber-400"
            />
            Read embedded figures and scanned pages with the local vision model
            {visionModel && <span className="font-mono text-[10px] text-emerald-300">({visionModel})</span>}
          </label>
          {!visionModel && (
            <span className="text-[11px] text-white/40">
              No vision model installed — figures are counted but not read. Run{' '}
              <code className="font-mono text-white/60">ollama pull {VISION_FALLBACKS[0]}</code> to enable.
            </span>
          )}
        </div>
      </div>

      {/* ── dropzone ──────────────────────────────────────────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={'rounded-xl border-2 border-dashed p-8 text-center transition-all ' +
          (drag ? 'border-amber-300 bg-amber-300/5' : 'border-white/15 bg-white/[0.02]')}
      >
        <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center shadow-lg shadow-violet-600/30">
          <Upload className="w-6 h-6 text-white" />
        </div>
        <div className="mt-3 font-display font-semibold text-white">Drop a file here</div>
        <div className="text-xs text-white/45 mt-1">
          {ACCEPT.map(a => a.ext).join(' or ')} — parsed locally; only the extracted text is stored
        </div>
        <label className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white text-black text-sm font-semibold px-4 py-2.5 cursor-pointer hover:bg-amber-200 transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} {busy || 'Choose file'}
          <input
            type="file" accept={ACCEPT.map(a => a.ext).join(',')}
            className="hidden" disabled={!!busy}
            data-testid="lecture-ingest-input"
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.currentTarget.value = ''; }}
          />
        </label>
        {error && <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2 inline-block whitespace-pre-wrap text-left">{error}</div>}
      </div>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      {/* ── PDF review step: nothing is stored until confirmed ─────────────── */}
      {preview && (
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ScanLine className="w-4 h-4" /> Review extracted text — “{preview.name}”
              </div>
              <div className="text-[11px] text-white/50 mt-1">
                {preview.pages.length} page(s) ·{' '}
                {preview.pages.reduce((a, p) => a + estimateTokens(p.text), 0).toLocaleString()} tokens ·{' '}
                {preview.pages.filter(p => p.scanned).length} scanned
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPreview(null); setPendingPdf(null); }} className="rounded-xl border border-white/15 px-3 py-2 text-xs text-white/70 hover:text-white">Cancel</button>
              <button
                onClick={() => { if (pendingPdf) void ingestPdf(pendingPdf, preview.pages); }}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold px-4 py-2"
              >
                Save {preview.pages.length} page(s)
              </button>
            </div>
          </div>
          <div className="mt-3 max-h-[260px] overflow-y-auto space-y-1.5">
            {preview.pages.map(p => (
              <div key={p.number} className="rounded-lg border border-white/5 bg-black/25 p-2.5">
                <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                  <span>PAGE {p.number}</span><span>· {p.chars} chars</span>
                  {p.scanned && <span className="text-amber-300">· scanned {p.ocrText ? '· read' : '· no text layer'}</span>}
                </div>
                <div className="mt-1 text-[11px] font-mono text-white/70 line-clamp-3 whitespace-pre-wrap">
                  {p.ocrText || p.text || <span className="text-white/30">(nothing extracted)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── library ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-sm text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading documents…</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {decks.map(d => {
            const pdf = isPdf(String(d.filename || ''));
            return (
              <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors">
                <div className="flex items-start gap-3">
                  <div className={'w-11 h-11 rounded-xl border border-white/10 grid place-items-center shrink-0 ' +
                    (pdf ? 'bg-gradient-to-br from-rose-400/40 to-orange-600/40' : 'bg-gradient-to-br from-amber-400/40 to-violet-600/40')}>
                    {pdf ? <FileText className="w-5 h-5 text-rose-100" /> : <Presentation className="w-5 h-5 text-amber-100" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white text-sm truncate">{d.title}</div>
                    <div className="text-[11px] text-white/40 font-mono mt-0.5 truncate">{d.filename || '—'}</div>
                  </div>
                  <button onClick={() => remove(d.id, d.title)} title="Delete" className="text-white/30 hover:text-red-300 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono">
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-white/70">{d.slide_count} {pdf ? 'pages' : 'slides'}</span>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-emerald-300">{(d.total_tokens || 0).toLocaleString()} tok</span>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-sky-300">{d.language}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => copyWholeDeck(d)}
                    data-testid="lecture-deck-copy-all"
                    title="Copy every page's text in one click"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-3 py-2 transition-colors"
                  >
                    {copiedDeck === d.id ? <Check className="w-3.5 h-3.5" /> : <Files className="w-3.5 h-3.5" />}
                    {copiedDeck === d.id ? 'Copied' : 'Copy all'}
                  </button>
                  <Link to={'/lecture/decks/' + d.id} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold py-2 transition-colors">
                    {pdf ? 'Open and question pages' : 'Open and question slides'} <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
          {decks.length === 0 && (
            <div className="col-span-full text-sm text-white/35 rounded-xl border border-white/5 p-6 text-center">
              Nothing ingested yet. Drop a {ACCEPT.map(a => a.ext).join(' or ')} above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
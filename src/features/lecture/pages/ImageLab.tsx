import { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, Brain, Loader2, Copy, Check, Save, Eraser, Terminal, RefreshCw } from 'lucide-react';
import RegionSelector from '../components/RegionSelector';
import type { Region } from '../components/RegionSelector';
import TokenMeter from '../components/TokenMeter';
import AIBridge from '../components/AIBridge';
import InlineNotice from '../components/InlineNotice';
import api from '../lib/api';
import { estimateTokens, optimizePrompt } from '../lib/tokens';
import { detectLanguage } from '../lib/lang';
import { fileToDataUrl, getLocalStatus, runVision, formatMs, VISION_FALLBACKS, type OllamaStatus } from '../lib/localai';

type Notice = { tone: 'info' | 'error' | 'success' | 'busy'; text: string } | null;

export default function ImageLab() {
  const [img, setImg] = useState<string | null>(null);
  const [fname, setFname] = useState('');
  const [region, setRegion] = useState<Region | null>(null);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [visionText, setVisionText] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [model, setModel] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const models = ollama?.visionModels ?? [];
  const activeModel = model || models[0] || '';
  const canRun = !!img && !!activeModel && !busy;

  const refresh = useCallback(async () => {
    setChecking(true);
    const s = await getLocalStatus();
    setOllama(s.ollama);
    setChecking(false);
  }, []);

  useEffect(() => { api.get('/api/images').then(setHistory).catch(() => {}); }, []);
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15000);
    return () => clearInterval(iv);
  }, [refresh]);
  // A previously-selected model may disappear on refresh; fall back to what's there.
  useEffect(() => { if (model && models.length && !models.includes(model)) setModel(models[0]); }, [models, model]);

  const onFile = async (f: File) => {
    if (!f.type.startsWith('image/')) { setNotice({ tone: 'error', text: `${f.name} is not an image.` }); return; }
    try {
      setFname(f.name); setVisionText(''); setCaption('');
      setRegion(null); setCropUrl(null); setNotice(null);
      setImg(await fileToDataUrl(f));
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.message || 'Could not read that image.' });
    }
  };

  const recognize = async () => {
    if (!img) return;
    if (!ollama?.online) { setNotice({ tone: 'error', text: 'Ollama is not running. Start it with `ollama serve`, then pull a vision model.' }); return; }
    if (!activeModel) { setNotice({ tone: 'error', text: `No vision model installed. Run: ollama pull ${VISION_FALLBACKS[0]}` }); return; }

    setBusy(true);
    setNotice({ tone: 'busy', text: `Asking ${activeModel} to read the ${cropUrl ? 'selected region' : 'full image'}…` });
    const started = Date.now();
    const res = await runVision({
      model: activeModel,
      imageBase64: cropUrl || img,
      prompt: region
        ? 'Extract ALL text from this selected region of the image. Return every word, label, axis value, legend entry and caption exactly as written. Be thorough.'
        : 'Extract ALL text from this image. Return every word, label, axis value, legend entry and caption exactly as written. Be thorough.',
    });

    if (res.error) {
      setNotice({ tone: 'error', text: res.error });
    } else if (res.text) {
      setVisionText(res.text);
      setNotice({ tone: 'success', text: `${res.model} finished in ${formatMs(res.elapsedMs || Date.now() - started)} · ${res.text.split(/\s+/).length} words.` });
    } else {
      setNotice({ tone: 'info', text: 'The model returned nothing. Try a tighter region, or type the visible text below.' });
    }
    setBusy(false);
  };

  const lang = useMemo(() => detectLanguage(visionText + ' ' + caption), [visionText, caption]);

  const prompt = optimizePrompt(
    '[CONTEXT] Figure from lecture material (' + (fname || 'image') +
      (region ? ` — region ${Math.round(region.x)},${Math.round(region.y)} ${Math.round(region.w)}x${Math.round(region.h)}` : ' — full image') + ')\n\n' +
      '[VISION TEXT — LOCAL MODEL]\n' + (visionText || '(none yet — run the local vision model, or type/paste the visible text)') +
      '\n\n[STUDENT CAPTION]\n' + (caption || '(describe axes, diagram labels, or what confuses you)') +
      `\n\n[TASK] Explain this figure step by step. First transcribe/interpret the visual precisely, then connect it to the underlying CS/math concept with a small worked example. Detected language: ${lang.lang}.`
  );

  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setNotice({ tone: 'error', text: 'Clipboard write was blocked by the OS.' }); }
  };

  const saveAll = async () => {
    if (!img) { setNotice({ tone: 'error', text: 'Upload an image before saving.' }); return; }
    setBusy(true);
    try {
      // Persist the actual pixels: the library used to store image_url:'' so every
      // saved figure was an unrecoverable text stub with no thumbnail.
      const rec: any = await api.post('/api/images', {
        filename: fname || 'figure.png',
        ocr_text: visionText.slice(0, 4000),
        caption: caption.slice(0, 2000),
        region_json: region,
        token_estimate: estimateTokens(visionText + caption),
        image_url: img,
      });
      if (rec?.error) throw new Error(String(rec.error));
      await api.post('/api/prompts', {
        title: 'Figure: ' + (fname || 'image'),
        prompt_type: 'region',
        source_ref: 'image:' + rec.id,
        content: prompt,
        token_estimate: estimateTokens(prompt),
        target_ai: 'gemini',
      });
      setHistory(await api.get('/api/images'));
      setNotice({ tone: 'success', text: 'Saved to the library and to Prompt Forge.' });
    } catch (e: any) {
      setNotice({ tone: 'error', text: 'Save failed: ' + (e?.message || String(e)) });
    } finally {
      setBusy(false);
    }
  };

  const statusLine = checking
    ? 'checking local models…'
    : !ollama?.online
      ? 'offline — start Ollama'
      : models.length
        ? `${models.length} vision model${models.length > 1 ? 's' : ''} available`
        : `online, but no vision model (ollama pull ${VISION_FALLBACKS[0]})`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Image Lab — local vision model to prompt</h1>
        <p className="text-sm text-white/50 mt-1">Upload a slide screenshot, diagram or whiteboard photo. Drag a region, read it with a local vision model, then forge a prompt.</p>
      </div>

      {/* Local-AI status: what is actually installed, not a hopeful label. */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/40">Local AI:</span>
            {checking && <span className="text-white/30 italic">checking…</span>}
            {!checking && ollama?.online && <span className="text-emerald-400 font-medium">Ollama {ollama.version ? `v${ollama.version}` : 'online'}</span>}
            {!checking && !ollama?.online && <span className="text-red-400 font-medium">offline</span>}
            {!checking && <span className="text-white/35 text-xs">· {statusLine}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-sm">model:</span>
            {models.length > 0 ? (
              <select
                value={activeModel}
                onChange={e => setModel(e.target.value)}
                data-testid="lecture-vision-model"
                className="rounded-lg border border-white/10 bg-black/30 text-white text-sm px-2 py-1 outline-none focus:border-amber-300/40"
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <span className="text-xs text-white/40 font-mono">none installed</span>
            )}
          </div>
          <button onClick={refresh} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/60 hover:text-white hover:border-white/20 transition-colors">
            <RefreshCw className="w-3 h-3" /> Re-check
          </button>
        </div>
        {!checking && ollama?.online && models.length === 0 && (
          <div className="mt-3">
            <InlineNotice tone="info">
              {`Ollama is running but has no vision model. Pull one, then press Re-check:\n  ollama pull ${VISION_FALLBACKS[0]}\nOther options: ${VISION_FALLBACKS.slice(1).join(', ')}`}
            </InlineNotice>
          </div>
        )}
      </div>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ── Left: image + region + caption ─────────────────────────────── */}
        <div className="space-y-3">
          {!img ? (
            <label
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
              className="block rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] p-10 text-center cursor-pointer hover:border-amber-300/40 transition-colors"
            >
              <Upload className="w-6 h-6 text-white/40 mx-auto" />
              <div className="mt-2 text-sm font-semibold text-white">Drop a figure / screenshot</div>
              <div className="text-[11px] text-white/40 mt-1">PNG · JPG · WebP — processed locally, never uploaded</div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ''; }} />
            </label>
          ) : (
            <>
              <RegionSelector src={img} onRegion={(r, url) => { setRegion(r); setCropUrl(url); }} />
              <div className="flex gap-2">
                <button
                  onClick={recognize}
                  disabled={!canRun}
                  data-testid="lecture-vision-run"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black text-sm font-semibold px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  {busy ? 'Reading…' : cropUrl ? 'Recognize region' : 'Recognize full image'}
                </button>
                <button
                  onClick={() => { setImg(null); setVisionText(''); setCaption(''); setRegion(null); setCropUrl(null); setNotice(null); }}
                  title="Clear image"
                  className="rounded-xl border border-white/15 px-3 text-white/60 hover:text-white"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>
              {!activeModel && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3">
                  <div className="flex items-start gap-2 text-[11px] text-amber-100/85 leading-relaxed">
                    <Terminal className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>No local vision model yet. In a terminal:<br /><code className="font-mono">ollama pull {VISION_FALLBACKS[0]}</code><br />then press Re-check above. You can still type the text below and forge the prompt.</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <label className="text-xs font-semibold text-white">Student caption — what should the AI focus on?</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="e.g. The red decision boundary in the SVM plot — why is the margin asymmetric?" className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 text-sm text-white p-3 outline-none focus:border-amber-300/40" />
          </div>
        </div>

        {/* ── Right: vision text + forged prompt ─────────────────────────── */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-white">
                Vision text
                <span className="ml-1 font-mono text-[10px] text-sky-300">lang: {lang.lang} ({Math.round(lang.confidence * 100)}%)</span>
              </div>
              <div className="text-[10px] font-mono text-white/30 truncate">{activeModel ? `local · ${activeModel}` : 'local · no model'}</div>
            </div>
            <textarea value={visionText} onChange={(e) => setVisionText(e.target.value)} rows={6} placeholder="Vision model output appears here — editable. You can also type or paste text manually." className="mt-2 w-full rounded-xl bg-white/[0.03] border border-white/10 text-[13px] font-mono text-white/85 p-3 outline-none focus:border-amber-300/40" />
            <div className="mt-3"><TokenMeter value={estimateTokens(prompt)} max={4000} label="Prompt tokens" /></div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs font-semibold text-white mb-2">Forged prompt</div>
            <pre className="max-h-[260px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-white/75 leading-relaxed rounded-xl bg-black/30 border border-white/10 p-3">{prompt}</pre>
            <div className="mt-3 flex gap-2">
              <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold py-2.5">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
              <button onClick={saveAll} disabled={busy || !img} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold py-2.5 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> Save + Forge</button>
            </div>
            <div className="mt-3"><AIBridge compact /></div>
          </div>
        </div>
      </div>

      {/* ── History: full width, with the actual figure ──────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Vision library <span className="text-[11px] font-mono text-white/35">{history.length} saved</span></h3>
        {history.length === 0 ? (
          <div className="text-xs text-white/35">Nothing saved yet — recognize a figure and press “Save + Forge”.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {history.map(h => (
              <div key={h.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                {h.image_url ? (
                  <img src={h.image_url} alt={h.filename} className="w-full h-24 object-contain rounded-lg bg-black/40 border border-white/5 mb-2" />
                ) : (
                  <div className="w-full h-24 rounded-lg bg-black/40 border border-white/5 mb-2 grid place-items-center text-[10px] text-white/25">no preview</div>
                )}
                <div className="text-xs font-medium text-white truncate">{h.filename || 'figure'}</div>
                <div className="text-[11px] text-white/40 mt-1 line-clamp-2">{(h.ocr_text || '').slice(0, 120) || '—'}</div>
                <div className="text-[10px] font-mono text-emerald-300 mt-1">{h.token_estimate || 0} tok</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

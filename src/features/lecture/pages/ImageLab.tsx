import { useEffect, useState } from 'react';
import { Upload, ScanText, Loader2, Copy, Check, Save, Eraser } from 'lucide-react';
import RegionSelector, { Region } from '../components/RegionSelector';
import TokenMeter from '../components/TokenMeter';
import AIBridge from '../components/AIBridge';
import api from '../lib/api';
import { estimateTokens, optimizePrompt } from '../lib/tokens';
import { detectLanguage } from '../lib/lang';
declare global { interface Window { Tesseract?: any } }
function loadTesseract(): Promise<any> {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error('CDN failed'));
    document.head.appendChild(s);
  });
}
export default function ImageLab() {
  const [img, setImg] = useState<string | null>(null);
  const [fname, setFname] = useState('');
  const [region, setRegion] = useState<Region | null>(null);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [ocr, setOcr] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [progress, setProgress] = useState('');
  useEffect(() => { api.get('/api/images').then(setHistory).catch(() => {}); }, []);
  const onFile = (f: File) => { setFname(f.name); setOcr(''); setCaption(''); setRegion(null); setCropUrl(null); const r = new FileReader(); r.onload = () => setImg(String(r.result)); r.readAsDataURL(f); };
  const runOcr = async () => {
    if (!img) return;
    setBusy(true); setProgress('Loading OCR engine (eng+ind)...');
    try {
      const T = await loadTesseract();
      setProgress('Recognizing ' + (cropUrl ? 'selected region' : 'full image') + '...');
      const worker = await T.createWorker(['eng', 'ind']);
      const { data } = await worker.recognize(cropUrl || img);
      await worker.terminate();
      setOcr((data.text || '').trim() || '(no text detected — try a tighter region or describe the figure in the caption box)');
      setProgress('');
    } catch {
      setProgress('');
      setOcr('(OCR engine unreachable offline — type or paste the visible text here and the prompt builder still works)');
    } finally { setBusy(false); }
  };
  const lang = detectLanguage(ocr + ' ' + caption);
  const prompt = optimizePrompt('[CONTEXT] Figure from lecture material (' + (fname || 'image') + (region ? ' - region ' + Math.round(region.x) + ',' + Math.round(region.y) + ' ' + Math.round(region.w) + 'x' + Math.round(region.h) : ' - full image') + ')\n\n[OCR TEXT]\n' + (ocr || '(none yet)') + '\n\n[STUDENT CAPTION]\n' + (caption || '(describe axes, diagram labels, or what confuses you)') + '\n\n[TASK] Explain this figure step by step. First transcribe/interpret the visual precisely, then connect it to the underlying CS/math concept with a small worked example. Detected language: ' + lang.lang + '.');
  const copy = async () => { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const saveAll = async () => {
    const rec = await api.post('/api/images', { filename: fname || 'figure.png', ocr_text: ocr.slice(0, 4000), caption: caption.slice(0, 2000), region_json: region, token_estimate: estimateTokens(ocr + caption), image_url: '' });
    await api.post('/api/prompts', { title: 'Figure: ' + (fname || 'image'), prompt_type: 'region', source_ref: 'image:' + rec.id, content: prompt, token_estimate: estimateTokens(prompt), target_ai: 'gemini' });
    setHistory(await api.get('/api/images')); alert('Saved to library + Forge');
  };
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-bold text-white tracking-tight">Image Lab — region OCR to prompt</h1><p className="text-sm text-white/50 mt-1">Upload a slide screenshot, diagram or whiteboard photo. Drag a region, run bilingual OCR (EN + ID), then forge a vision-model-ready prompt.</p></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {!img ? (
            <label className="block rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.02] p-10 text-center cursor-pointer hover:border-amber-300/40 transition-colors">
              <Upload className="w-6 h-6 text-white/40 mx-auto" />
              <div className="mt-2 text-sm font-semibold text-white">Drop a figure / screenshot</div>
              <div className="text-[11px] text-white/40 mt-1">PNG - JPG - WebP, processed locally</div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          ) : (
            <>
              <RegionSelector src={img} onRegion={(r, url) => { setRegion(r); setCropUrl(url); }} />
              <div className="flex gap-2">
                <button onClick={runOcr} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black text-sm font-semibold px-4 py-2.5 disabled:opacity-60">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}{busy ? progress || 'Working...' : cropUrl ? 'OCR selected region' : 'OCR full image'}</button>
                <button onClick={() => { setImg(null); setOcr(''); setCaption(''); }} className="rounded-xl border border-white/15 px-3 text-white/60 hover:text-white"><Eraser className="w-4 h-4" /></button>
              </div>
            </>
          )}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="text-xs font-semibold text-white">Student caption — what should the AI focus on?</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="e.g. The red decision boundary in the SVM plot — why is the margin asymmetric?" className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 text-sm text-white p-3 outline-none focus:border-amber-300/40" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between"><div className="text-xs font-semibold text-white">OCR output <span className="ml-1 font-mono text-[10px] text-sky-300">lang: {lang.lang} ({Math.round(lang.confidence * 100)}%)</span></div></div>
            <textarea value={ocr} onChange={(e) => setOcr(e.target.value)} rows={6} placeholder="OCR text appears here — editable." className="mt-2 w-full rounded-xl bg-white/[0.03] border border-white/10 text-[13px] font-mono text-white/85 p-3 outline-none focus:border-amber-300/40" />
            <div className="mt-3"><TokenMeter value={estimateTokens(prompt)} max={4000} label="Prompt tokens" /></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs font-semibold text-white mb-2">Forged prompt</div>
            <pre className="max-h-[260px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-white/75 leading-relaxed rounded-xl bg-black/30 border border-white/10 p-3">{prompt}</pre>
            <div className="mt-3 flex gap-2">
              <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold py-2.5">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
              <button onClick={saveAll} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold py-2.5"><Save className="w-3.5 h-3.5" /> Save + Forge</button>
            </div>
            <div className="mt-3"><AIBridge compact /></div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white mb-2">OCR history</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {history.slice(0, 8).map(h => <div key={h.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3"><div className="text-xs font-medium text-white truncate">{h.filename}</div><div className="text-[11px] text-white/40 mt-1 line-clamp-2">{h.ocr_text?.slice(0, 120) || '—'}</div><div className="text-[10px] font-mono text-emerald-300 mt-1">{h.token_estimate} tok</div></div>)}
          {history.length === 0 && <div className="text-xs text-white/35">Nothing OCRd yet.</div>}
        </div>
      </div>
    </div>
  );
}

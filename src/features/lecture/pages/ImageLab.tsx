import { useEffect, useState } from 'react';
import { Upload, Brain, Loader2, Copy, Check, Save, Eraser } from 'lucide-react';
import RegionSelector, { Region } from '../components/RegionSelector';
import TokenMeter from '../components/TokenMeter';
import AIBridge from '../components/AIBridge';
import api from '../lib/api';
import { estimateTokens, optimizePrompt } from '../lib/tokens';
import { detectLanguage } from '../lib/lang';
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
  const [progress, setProgress] = useState('');
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [ollamaModel, setOllamaModel] = useState('llama3.2-vision');
  useEffect(() => { api.get('/api/images').then(setHistory).catch(() => {}); }, []);
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('http://localhost:11434/api/version');
        setOllamaOnline(r.ok);
      } catch { setOllamaOnline(false); }
    };
    check();
    const iv = setInterval(check, 15000);
    return () => clearInterval(iv);
  }, []);

  const onFile = (f: File) => {
    setFname(f.name); setVisionText(''); setCaption('');
    setRegion(null); setCropUrl(null);
    const r = new FileReader();
    r.onload = () => setImg(String(r.result));
    r.readAsDataURL(f);
  };

  const recognizeWithOllama = async () => {
    if (!img) return;
    setBusy(true);
    setProgress('Checking Ollama...');
    try {
      const base = 'http://localhost:11434';
      const t0 = performance.now();
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: region
                ? 'Extract ALL text from this selected region of the image. Return every word, label, axis value, legend entry, and caption exactly as written. Be thorough.'
                : 'Extract ALL text from this image. Return every word, label, axis value, legend entry, and caption exactly as written. Be thorough.'
              },
              { type: 'image_url', image_url: { url: cropUrl || img } },
            ],
          }],
          max_tokens: 4000,
          stream: false,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Ollama HTTP ${res.status}: ${errBody.slice(0, 300)}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      if (text) {
        setVisionText(text);
        setProgress(`Done in ${elapsed}s · ${text.split(/\s+/).length} words`);
      } else {
        setVisionText('(no text detected — try a tighter region or describe the figure in the caption box)');
        setProgress('');
      }
    } catch (err: any) {
      setProgress('');
      const msg = err?.message || String(err);
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('Network request failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        setVisionText('(Ollama not reachable at localhost:11434 — start Ollama with a vision model like llama3.2-vision or qwen2.5-vl, then type or paste the visible text here)');
      } else {
        setVisionText(`(Vision model error: ${msg.slice(0, 200)} — type or paste the visible text here)`);
      }
    } finally {
      setBusy(false);
    }
  };
  const lang = detectLanguage(visionText + ' ' + caption);
  const prompt = optimizePrompt('[CONTEXT] Figure from lecture material (' + (fname || 'image') + (region ? ' - region ' + Math.round(region.x) + ',' + Math.round(region.y) + ' ' + Math.round(region.w) + 'x' + Math.round(region.h) : ' - full image') + ')\n\n[VISION TEXT — LOCAL OLLAMA VLM]\n' + (visionText || '(none yet — run local Ollama vision recognition or type/paste the visible text)') + '\n\n[STUDENT CAPTION]\n' + (caption || '(describe axes, diagram labels, or what confuses you)') + '\n\n[TASK] Explain this figure step by step. First transcribe/interpret the visual precisely, then connect it to the underlying CS/math concept with a small worked example. Detected language: ' + lang.lang + '.');
  const copy = async () => { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const saveAll = async () => {
    const rec = await api.post('/api/images', { filename: fname || 'figure.png', ocr_text: visionText.slice(0, 4000), caption: caption.slice(0, 2000), region_json: region, token_estimate: estimateTokens(visionText + caption), image_url: '' });
    await api.post('/api/prompts', { title: 'Figure: ' + (fname || 'image'), prompt_type: 'region', source_ref: 'image:' + rec.id, content: prompt, token_estimate: estimateTokens(prompt), target_ai: 'gemini' });
    setHistory(await api.get('/api/images')); alert('Saved to library + Forge');
  };
  return (
    <div className="space-y-5">
    <div><h1 className="font-display text-2xl font-bold text-white tracking-tight">Image Lab — local vision model to prompt</h1><p className="text-sm text-white/50 mt-1">Upload a slide screenshot, diagram or whiteboard photo. Drag a region, run a local Ollama vision model, then forge a prompt.</p></div>
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-white/40">Ollama:</span>
        {ollamaOnline === null && <span className="text-white/30 italic">checking...</span>}
        {ollamaOnline === true && <span className="text-emerald-400 font-medium">online</span>}
        {ollamaOnline === false && <span className="text-red-400 font-medium">offline — start Ollama</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-sm">model:</span>
        <select value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 text-white text-sm px-2 py-1 outline-none focus:border-amber-300/40">
          <option value="llama3.2-vision">llama3.2-vision</option>
          <option value="qwen2.5-vl:3b">qwen2.5-vl:3b</option>
          <option value="moondream">moondream</option>
          <option value="llava">llava</option>
        </select>
      </div>
    </div>
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
              <button onClick={recognizeWithOllama} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black text-sm font-semibold px-4 py-2.5 disabled:opacity-60">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}{busy ? progress || 'Working...' : cropUrl ? 'Recognize region (Ollama)' : 'Recognize full image (Ollama)'}</button>
              <button onClick={() => { setImg(null); setVisionText(''); setCaption(''); }} className="rounded-xl border border-white/15 px-3 text-white/60 hover:text-white"><Eraser className="w-4 h-4" /></button>
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
          <div className="flex items-center justify-between"><div className="text-xs font-semibold text-white">Vision text <span className="ml-1 font-mono text-[10px] text-sky-300">lang: {lang.lang} ({Math.round(lang.confidence * 100)}%)</span></div><div className="text-[10px] font-mono text-white/30">local Ollama VLM · {ollamaModel}</div></div>
          <textarea value={visionText} onChange={(e) => setVisionText(e.target.value)} rows={6} placeholder="Vision model output appears here — editable. You can also type or paste text manually." className="mt-2 w-full rounded-xl bg-white/[0.03] border border-white/10 text-[13px] font-mono text-white/85 p-3 outline-none focus:border-amber-300/40" />
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
        <h3 className="text-sm font-semibold text-white mb-2">Vision history</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {history.slice(0, 8).map(h => <div key={h.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3"><div className="text-xs font-medium text-white truncate">{h.filename}</div><div className="text-[11px] text-white/40 mt-1 line-clamp-2">{h.ocr_text !== undefined ? h.ocr_text?.slice(0, 120) || '—' : h.vision_text?.slice(0, 120) || '—'}</div><div className="text-[10px] font-mono text-emerald-300 mt-1">{h.token_estimate} tok</div></div>)}
          {history.length === 0 && <div className="text-xs text-white/35">Nothing recognized yet.</div>}
        </div>
      </div>
    </div>
  );
}

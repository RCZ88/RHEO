import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Save, AudioWaveform, Copy, Check, Languages } from 'lucide-react';
import TokenMeter from '../components/TokenMeter';
import AIBridge from '../components/AIBridge';
import api from '../lib/api';
import { estimateTokens, optimizePrompt, chunkText } from '../lib/tokens';
import { detectLanguage, highlightTerms } from '../lib/lang';
export default function Transcriber() {
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<'auto' | 'en-US' | 'id-ID'>('auto');
  const [liveLang, setLiveLang] = useState('en-US');
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [title, setTitle] = useState('CS201 Lecture - ' + new Date().toLocaleDateString());
  const [level, setLevel] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [supported] = useState(() => typeof window !== 'undefined' && !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition));
  const recRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const detected = detectLanguage(text);
  const terms = highlightTerms(text);
  useEffect(() => { api.get('/api/transcripts').then(setHistory).catch(() => {}); return () => { cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); }; }, []);
  const startMeter = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => { an.getByteFrequencyData(buf); const avg = buf.reduce((a, b) => a + b, 0) / buf.length; setLevel(Math.min(100, Math.round(avg))); rafRef.current = requestAnimationFrame(tick); };
      tick();
    } catch {}
  };
  const stopMeter = () => { cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setLevel(0); };
  const start = () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert('Live mic transcription needs Chrome/Edge (Web Speech API). You can still paste/upload transcript text.'); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true;
    rec.lang = lang === 'auto' ? liveLang : lang;
    rec.onresult = (e: any) => {
      let fin = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript + ' '; else inter += r[0].transcript; }
      if (fin) setText(prev => (prev + ' ' + fin).trim());
      setInterim(inter);
      if (lang === 'auto' && fin) { const d = detectLanguage(fin); setLiveLang(d.lang === 'id' ? 'id-ID' : 'en-US'); }
    };
    rec.onend = () => { if (recRef.current) { try { rec.start(); } catch {} } };
    recRef.current = rec;
    rec.start(); setListening(true); startMeter();
  };
  const stop = () => { try { recRef.current?.stop(); } catch {} recRef.current = null; setListening(false); setInterim(''); stopMeter(); };
  const chunks = chunkText(text, 1200);
  const prompt = optimizePrompt('[CONTEXT] Lecture transcript "' + title + '" - detected: ' + detected.lang + ' (' + Math.round(detected.confidence * 100) + '%) - CS/math terms: ' + (terms.slice(0, 12).join(', ') || 'none') + '\n\n[TRANSCRIPT CHUNK 1/' + Math.max(1, chunks.length) + ']\n' + (chunks[0] || '(press the mic and lecture, or paste transcript)').slice(0, 2800) + '\n\n[TASK] Reconstruct clean lecture notes: key definitions, theorems with intuition, worked examples, and common pitfalls. Then quiz me with 4 questions. Reply in ' + (detected.lang === 'id' ? 'Bahasa Indonesia' : 'English') + '.');
  const copy = async () => { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const save = async () => {
    if (!text.trim()) { alert('Nothing to save yet.'); return; }
    await api.post('/api/transcripts', { title, source_type: 'mic', language: lang, detected_language: detected.lang, content: text.slice(0, 12000), duration_sec: 0 });
    await api.post('/api/prompts', { title: 'Lecture: ' + title.slice(0, 60), prompt_type: 'lecture', source_ref: 'transcript', content: prompt, token_estimate: estimateTokens(prompt), target_ai: 'chatgpt' });
    setHistory(await api.get('/api/transcripts')); alert('Transcript + prompt saved');
  };
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-bold text-white tracking-tight">Lecture transcriber</h1><p className="text-sm text-white/50 mt-1">Live mic STT with EN/ID auto-detect, lecturer sound-level meter, and CS/math term boosting. Best in Chrome/Edge.</p></div>
      {!supported && <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 text-amber-100/90 text-xs p-3">This browser lacks the Web Speech API — mic streaming is disabled, but paste + language detection still work.</div>}
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-3">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1030] to-[#0e1428] p-6 text-center relative overflow-hidden">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-widest text-white/40"><Languages className="w-3.5 h-3.5" /> RECOGNITION LANGUAGE</div>
            <div className="mt-2 inline-flex rounded-xl border border-white/10 bg-black/30 p-1 gap-1">
              {(['auto', 'en-US', 'id-ID'] as const).map(l => <button key={l} onClick={() => setLang(l)} className={'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ' + (lang === l ? 'bg-white text-black' : 'text-white/55 hover:text-white')}>{l === 'auto' ? 'Auto EN-ID' : l}</button>)}
            </div>
            <button onClick={listening ? stop : start} className={'mt-5 mx-auto w-20 h-20 rounded-full grid place-items-center transition-all shadow-xl ' + (listening ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30 animate-pulse' : 'bg-gradient-to-br from-amber-300 to-orange-500 shadow-orange-500/30 hover:scale-105')}>
              {listening ? <Square className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-black" />}
            </button>
            <div className="mt-2 text-xs text-white/60">{listening ? 'Listening... speak naturally (live: ' + liveLang + ')' : 'Tap to start lecturer capture'}</div>
            <div className="mt-4 max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-[10px] text-white/40 mb-1"><AudioWaveform className="w-3.5 h-3.5" /> MIC LEVEL {level}%</div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 via-amber-300 to-red-400 rounded-full transition-all" style={{ width: level + '%' }} /></div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="text-xs font-semibold text-white">Session title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-xl bg-black/30 border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40" />
            <label className="text-xs font-semibold text-white mt-3 block">Transcript <span className="font-mono text-[10px] text-sky-300 ml-1">detected: {detected.lang} - {Math.round(detected.confidence * 100)}%</span></label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Live words appear here... or paste an existing transcript." className="mt-1.5 w-full rounded-xl bg-black/30 border border-white/10 text-sm text-white/85 p-3 outline-none focus:border-amber-300/40 leading-relaxed" />
            {interim && <div className="mt-1.5 text-xs text-amber-200/70 italic">...{interim}</div>}
            {terms.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{terms.slice(0, 14).map(t => <span key={t} className="text-[10px] font-mono rounded-lg bg-violet-500/15 border border-violet-400/20 text-violet-200 px-2 py-1">{t}</span>)}</div>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-white mb-2">Context prompt - {chunks.length || 0} chunk(s) x ~1200 tok</div>
            <TokenMeter value={estimateTokens(prompt)} max={4000} />
            <pre className="mt-3 max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-white/75 leading-relaxed rounded-xl bg-white/[0.03] border border-white/10 p-3">{prompt}</pre>
            <div className="mt-3 flex gap-2">
              <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold py-2.5">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
              <button onClick={save} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold py-2.5"><Save className="w-3.5 h-3.5" /> Save all</button>
            </div>
            <div className="mt-3"><AIBridge compact /></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-xs font-semibold text-white mb-2">Sessions</h3>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {history.map(h => <div key={h.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5"><div className="text-xs font-medium text-white truncate">{h.title}</div><div className="text-[10px] font-mono text-white/40 mt-0.5">{h.detected_language} - {(h.content || '').length} chars</div></div>)}
              {history.length === 0 && <div className="text-[11px] text-white/35">No sessions yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

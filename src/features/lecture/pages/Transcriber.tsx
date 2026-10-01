import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Save, AudioWaveform, Copy, Check, Languages, FileAudio, Trash2, Loader2 } from 'lucide-react';
import TokenMeter from '../components/TokenMeter';
import AIBridge from '../components/AIBridge';
import InlineNotice from '../components/InlineNotice';
import api from '../lib/api';
import { estimateTokens, optimizePrompt, chunkText } from '../lib/tokens';
import { detectLanguage, highlightTerms } from '../lib/lang';
import { fileToBase64, getLocalStatus, runStt, formatMs, type SttEndpoint } from '../lib/localai';

type Notice = { tone: 'info' | 'error' | 'success' | 'busy'; text: string } | null;

const AUDIO_ACCEPT = 'audio/*,.webm,.m4a,.mp3,.wav,.ogg,.opus,.aac,.flac,.mp4';

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
  const [notice, setNotice] = useState<Notice>(null);

  // Local speech-to-text backends discovered by the main process.
  const [sttEndpoints, setSttEndpoints] = useState<SttEndpoint[]>([]);
  const [sttCli, setSttCli] = useState<string | null>(null);
  const [sttEndpoint, setSttEndpoint] = useState('');
  const [sttModel, setSttModel] = useState('');
  const [audioFile, setAudioFile] = useState<{ name: string; mime: string; size: number } | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const [supported] = useState(() => typeof window !== 'undefined' && !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition));

  const recRef = useRef<any>(null);
  const stopRequestedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const langRef = useRef(lang);
  const liveLangRef = useRef(liveLang);
  const audioRef = useRef<{ name: string; mime: string; base64: string } | null>(null);

  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { liveLangRef.current = liveLang; }, [liveLang]);

  const detected = detectLanguage(text);
  const terms = highlightTerms(text);

  useEffect(() => {
    api.get('/api/transcripts').then(setHistory).catch(() => {});
    getLocalStatus().then(s => {
      setSttEndpoints(s.stt.endpoints);
      setSttCli(s.stt.cli);
      if (!sttEndpoint && s.stt.endpoints[0]) setSttEndpoint(s.stt.endpoints[0].base);
    });
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopRequestedRef.current = true;
      try { recRef.current?.abort(); } catch { /* already dead */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mic level meter ───────────────────────────────────────────────────────
  const startMeter = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setLevel(Math.min(100, Math.round(avg)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* meter is cosmetic — transcription continues */ }
  };

  const stopMeter = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setLevel(0);
  };

  // ── Live recognition ──────────────────────────────────────────────────────
  // `rec.lang` is fixed at construction time, so "Auto EN-ID" used to detect the
  // language and then never apply it: the session kept running in whatever
  // language was active when the button was pressed. Flipping `liveLang` now
  // tears the recogniser down and restarts it against the new language.
  const startRec = useCallback((langCode: string) => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return false;
    stopRequestedRef.current = false;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langCode;
    rec.onresult = (e: any) => {
      let fin = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript + ' ';
        else inter += r[0].transcript;
      }
      if (fin) setText(prev => (prev + ' ' + fin).trim());
      setInterim(inter);
      if (langRef.current === 'auto' && fin) {
        const d = detectLanguage(fin);
        const next = d.lang === 'id' ? 'id-ID' : 'en-US';
        if (next !== liveLangRef.current) setLiveLang(next);
      }
    };
    rec.onerror = (e: any) => {
      const err = String(e?.error || '');
      if (err === 'no-speech' || err === 'aborted') return; // routine
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setNotice({ tone: 'error', text: 'Microphone permission was denied, or this build of Chromium has no speech service. Use “Transcribe audio file” below instead.' });
        stopRequestedRef.current = true;
      } else if (err) {
        setNotice({ tone: 'error', text: 'Live recognition error: ' + err });
      }
    };
    rec.onend = () => {
      // Chromium ends the session on its own after a pause; restart unless the
      // user (or a language switch) asked us to stop.
      if (!stopRequestedRef.current && recRef.current) {
        try { rec.start(); } catch { /* already starting */ }
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch { return false; }
    return true;
  }, []);

  const start = () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      setNotice({ tone: 'error', text: 'Live mic transcription needs the Web Speech API (Chrome/Edge). Use “Transcribe audio file” below, or paste transcript text.' });
      return;
    }
    const code = lang === 'auto' ? liveLang : lang;
    if (!startRec(code)) {
      setNotice({ tone: 'error', text: 'Could not start the recogniser.' });
      return;
    }
    setListening(true);
    setNotice(null);
    startMeter();
  };

  const stop = () => {
    stopRequestedRef.current = true;
    try { recRef.current?.stop(); } catch { /* noop */ }
    recRef.current = null;
    setListening(false);
    setInterim('');
    stopMeter();
  };

  // Apply a detected language switch to the LIVE session.
  useEffect(() => {
    if (!listening || lang !== 'auto') return;
    const code = liveLang;
    const active = recRef.current;
    if (active && active.lang === code) return;
    if (!active) { startRec(code); return; }
    active.onend = null;               // don't let the old instance auto-restart itself
    try { active.stop(); } catch { /* noop */ }
    recRef.current = null;
    startRec(code);
  }, [liveLang, listening, lang, startRec]);

  const toggleLang = (next: 'auto' | 'en-US' | 'id-ID') => {
    setLang(next);
    if (next === 'auto') setLiveLang(liveLangRef.current);
    else setLiveLang(next);
    if (listening) {
      // Same teardown path as the auto-switch above.
      const active = recRef.current;
      stopRequestedRef.current = true;
      if (active) { active.onend = null; try { active.stop(); } catch { /* noop */ } }
      recRef.current = null;
      stopRequestedRef.current = false;
      startRec(next === 'auto' ? liveLangRef.current : next);
    }
  };

  // ── Audio-file transcription (local backend) ─────────────────────────────
  const pickAudio = async (f: File) => {
    if (f.size > 200 * 1024 * 1024) { setNotice({ tone: 'error', text: 'That file is over 200 MB. Trim the lecture or split it first.' }); return; }
    try {
      const base64 = await fileToBase64(f);
      audioRef.current = { name: f.name, mime: f.type || guessMime(f.name), base64 };
      setAudioFile({ name: f.name, mime: audioRef.current.mime, size: f.size });
      setNotice(null);
    } catch (e: any) {
      setNotice({ tone: 'error', text: e?.message || 'Could not read that audio file.' });
    }
  };

  const transcribeFile = async () => {
    const a = audioRef.current;
    if (!a) { setNotice({ tone: 'error', text: 'Choose an audio file first.' }); return; }
    setTranscribing(true);
    setNotice({ tone: 'busy', text: `Transcribing ${a.name} (${(a.base64.length * 0.75 / 1024 / 1024).toFixed(1)} MB) on the local backend…` });
    const res = await runStt({
      audioBase64: a.base64,
      mime: a.mime,
      filename: a.name,
      model: sttModel.trim(),
      endpoint: sttEndpoint.trim(),
      // Only send a language hint when the user pinned one; otherwise let the
      // backend auto-detect, which is what handles code/technical speech best.
      language: lang === 'auto' ? '' : lang.split('-')[0],
    });
    if (res.error) {
      setNotice({ tone: 'error', text: res.error });
    } else if (res.text) {
      const transcript = res.text;
      setText(prev => (prev ? prev + '\n\n' + transcript : transcript));
      const d = detectLanguage(transcript);
      setLiveLang(d.lang === 'id' ? 'id-ID' : 'en-US');
      setNotice({ tone: 'success', text: `Transcribed ${transcript.split(/\s+/).length} words via ${res.engine} (${res.model}) in ${formatMs(res.elapsedMs)}.` });
    } else {
      setNotice({ tone: 'error', text: 'The backend returned an empty transcript.' });
    }
    setTranscribing(false);
  };

  const sttReady = sttEndpoints.length > 0 || !!sttCli;
  const selectedEp = sttEndpoints.find(e => e.base === sttEndpoint);

  const chunks = chunkText(text, 1200);
  const prompt = optimizePrompt(
    '[CONTEXT] Lecture transcript "' + title + '" - detected: ' + detected.lang +
    ' (' + Math.round(detected.confidence * 100) + '%) - CS/math terms: ' + (terms.slice(0, 12).join(', ') || 'none') +
    '\n\n[TRANSCRIPT CHUNK 1/' + Math.max(1, chunks.length) + ']\n' +
    (chunks[0] || '(press the mic and lecture, or transcribe a file, or paste a transcript)').slice(0, 2800) +
    '\n\n[TASK] Reconstruct clean lecture notes: key definitions, theorems with intuition, worked examples, and common pitfalls. Then quiz me with 4 questions. Reply in ' +
    (detected.lang === 'id' ? 'Bahasa Indonesia' : 'English') + '.'
  );

  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setNotice({ tone: 'error', text: 'Clipboard write was blocked by the OS.' }); }
  };

  const save = async () => {
    if (!text.trim()) { setNotice({ tone: 'error', text: 'Nothing to save yet.' }); return; }
    try {
      await api.post('/api/transcripts', {
        title, source_type: audioFile ? 'file' : 'mic', language: lang,
        detected_language: detected.lang, content: text.slice(0, 12000), duration_sec: 0,
      });
      await api.post('/api/prompts', {
        title: 'Lecture: ' + title.slice(0, 60), prompt_type: 'lecture', source_ref: 'transcript',
        content: prompt, token_estimate: estimateTokens(prompt), target_ai: 'chatgpt',
      });
      setHistory(await api.get('/api/transcripts'));
      setNotice({ tone: 'success', text: 'Transcript and prompt saved.' });
    } catch (e: any) {
      setNotice({ tone: 'error', text: 'Save failed: ' + (e?.message || String(e)) });
    }
  };

  const clearAll = () => { setText(''); setInterim(''); setNotice(null); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Lecture transcriber</h1>
        <p className="text-sm text-white/50 mt-1">Live mic STT with EN/ID auto-detect, or transcribe a recorded file on your own machine. Lecturer sound-level meter and CS/math term boosting included.</p>
      </div>

      {!supported && (
        <InlineNotice tone="info">
          This build has no Web Speech API, so live mic capture is disabled. “Transcribe audio file” below uses your local backend instead, and you can still paste transcript text.
        </InlineNotice>
      )}

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-3">
          {/* ── Live capture ─────────────────────────────────────────────── */}
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#1a1030] to-[#0e1428] p-6 text-center relative overflow-hidden">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-widest text-white/40"><Languages className="w-3.5 h-3.5" /> RECOGNITION LANGUAGE</div>
            <div className="mt-2 inline-flex rounded-xl border border-white/10 bg-black/30 p-1 gap-1">
              {(['auto', 'en-US', 'id-ID'] as const).map(l => (
                <button key={l} onClick={() => toggleLang(l)} className={'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ' + (lang === l ? 'bg-white text-black' : 'text-white/55 hover:text-white')}>
                  {l === 'auto' ? 'Auto EN-ID' : l}
                </button>
              ))}
            </div>
            <button
              onClick={listening ? stop : start}
              disabled={!supported}
              data-testid="lecture-mic-toggle"
              className={'mt-5 mx-auto w-20 h-20 rounded-full grid place-items-center transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed ' + (listening ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30 animate-pulse' : 'bg-gradient-to-br from-amber-300 to-orange-500 shadow-orange-500/30 hover:scale-105')}
            >
              {listening ? <Square className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-black" />}
            </button>
            <div className="mt-2 text-xs text-white/60">
              {listening ? `Listening… speak naturally (live: ${liveLang})` : 'Tap to start lecturer capture'}
            </div>
            <div className="mt-4 max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-[10px] text-white/40 mb-1"><AudioWaveform className="w-3.5 h-3.5" /> MIC LEVEL {level}%</div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 via-amber-300 to-red-400 rounded-full transition-all" style={{ width: level + '%' }} /></div>
            </div>
          </div>

          {/* ── Audio-file transcription ─────────────────────────────────── */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white"><FileAudio className="w-3.5 h-3.5" /> Transcribe a recorded file</div>
            <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
              Runs on your own machine — nothing is uploaded. Backend:
              {sttReady
                ? selectedEp?.base || sttCli || 'local'
                : ' none found yet'}
            </p>

            {!sttReady && (
              <div className="mt-2">
                <InlineNotice tone="info">
                  {`No local speech-to-text backend detected. Install one, then reload:\n` +
                    `  • faster-whisper-server  →  pip install faster-whisper-server  (port 8000)\n` +
                    `  • whisper.cpp server     →  ./server -m models/ggml-base.bin --port 8080\n` +
                    `  • whisper.cpp CLI        →  put whisper-cli on your PATH (wav only)\n` +
                    `Live mic capture keeps working regardless.`}
                </InlineNotice>
              </div>
            )}

            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              <label className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] hover:border-amber-300/40 transition-colors px-3 py-2.5 cursor-pointer flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-white/40 shrink-0" />
                <span className="text-xs text-white/70 truncate">{audioFile ? audioFile.name : 'Choose audio file…'}</span>
                <input type="file" accept={AUDIO_ACCEPT} className="hidden" data-testid="lecture-audio-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickAudio(f); e.currentTarget.value = ''; }} />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={transcribeFile}
                  disabled={!audioFile || transcribing}
                  data-testid="lecture-transcribe-file"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold px-3 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {transcribing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {transcribing ? 'Transcribing…' : 'Transcribe'}
                </button>
                {audioFile && (
                  <button onClick={() => { audioRef.current = null; setAudioFile(null); }} title="Remove file" className="rounded-xl border border-white/15 px-2.5 text-white/60 hover:text-white">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {(sttEndpoints.length > 0 || sttEndpoint) && (
              <div className="mt-2 grid sm:grid-cols-2 gap-2">
                <select
                  value={sttEndpoint}
                  onChange={(e) => { setSttEndpoint(e.target.value); setSttModel(''); }}
                  aria-label="STT endpoint"
                  className="rounded-xl bg-black/30 border border-white/10 text-xs text-white px-2.5 py-2 outline-none focus:border-amber-300/40"
                >
                  {sttEndpoints.length === 0 && <option value="">auto-detect</option>}
                  {sttEndpoints.map(e => <option key={e.base} value={e.base}>{e.base}</option>)}
                  <option value="whisper-cli">whisper-cli (wav only)</option>
                  <option value="">custom URL…</option>
                </select>
                <input
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value)}
                  placeholder={selectedEp?.models[0] ? `model (e.g. ${selectedEp.models[0]})` : 'model name (optional)'}
                  aria-label="STT model"
                  className="rounded-xl bg-black/30 border border-white/10 text-xs text-white px-2.5 py-2 outline-none focus:border-amber-300/40 placeholder:text-white/25"
                />
              </div>
            )}
          </div>

          {/* ── Transcript ───────────────────────────────────────────────── */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white">Session title</label>
              {text && <button onClick={clearAll} className="text-[11px] text-white/35 hover:text-red-300">Clear</button>}
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-xl bg-black/30 border border-white/10 text-sm text-white p-2.5 outline-none focus:border-amber-300/40" />
            <label className="text-xs font-semibold text-white mt-3 block">
              Transcript <span className="font-mono text-[10px] text-sky-300 ml-1">detected: {detected.lang} — {Math.round(detected.confidence * 100)}%</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              data-testid="lecture-transcript"
              placeholder="Live words appear here… or transcribe a file, or paste an existing transcript."
              className="mt-1.5 w-full rounded-xl bg-black/30 border border-white/10 text-sm text-white/85 p-3 outline-none focus:border-amber-300/40 leading-relaxed"
            />
            {interim && <div className="mt-1.5 text-xs text-amber-200/70 italic">…{interim}</div>}
            {terms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {terms.slice(0, 14).map(t => <span key={t} className="text-[10px] font-mono rounded-lg bg-violet-500/15 border border-violet-400/20 text-violet-200 px-2 py-1">{t}</span>)}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: prompt + sessions ──────────────────────────── */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-white mb-2">Context prompt — {chunks.length || 0} chunk(s) × ~1200 tok</div>
            <TokenMeter value={estimateTokens(prompt)} max={4000} />
            <pre className="mt-3 max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[12px] font-mono text-white/75 leading-relaxed rounded-xl bg-white/[0.03] border border-white/10 p-3">{prompt}</pre>
            <div className="mt-3 flex gap-2">
              <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-black text-xs font-semibold py-2.5">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
              <button onClick={save} data-testid="lecture-transcriber-save" className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-semibold py-2.5"><Save className="w-3.5 h-3.5" /> Save all</button>
            </div>
            <div className="mt-3"><AIBridge compact /></div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-xs font-semibold text-white mb-2">Sessions <span className="text-[11px] font-mono text-white/35">{history.length}</span></h3>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {history.map(h => (
                <button
                  key={h.id}
                  onClick={() => { setText(h.content || ''); setTitle(h.title || ''); }}
                  title="Load into the editor"
                  className="w-full text-left rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] p-2.5 transition-colors"
                >
                  <div className="text-xs font-medium text-white truncate">{h.title}</div>
                  <div className="text-[10px] font-mono text-white/40 mt-0.5">{h.detected_language} · {h.source_type} · {(h.content || '').length} chars</div>
                </button>
              ))}
              {history.length === 0 && <div className="text-[11px] text-white/35">No sessions yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function guessMime(name: string): string {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  return ({
    webm: 'audio/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
    ogg: 'audio/ogg', opus: 'audio/opus', aac: 'audio/aac', flac: 'audio/flac', mp4: 'audio/mp4',
  } as Record<string, string>)[ext] || 'application/octet-stream';
}

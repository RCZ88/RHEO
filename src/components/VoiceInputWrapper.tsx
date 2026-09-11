/**
 * VoiceInputWrapper — Self-contained voice input with portal-based panel
 * Panel renders via React Portal at document body level — never clipped
 * by parent overflow, scroll containers, or z-index stacking contexts.
 */

import { useRef, useCallback, useEffect, useState, type ReactElement, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square, Delete, AlertCircle, WifiOff } from 'lucide-react';
import { sttGetStatus, sttStartApi, sttStartNative } from '../lib/stt';

interface VoiceInputWrapperProps {
  children: ReactElement;
  silenceMs?: number;
}

interface InputMetrics {
  height: number;
  width: number;
  fontSize: number;
  borderRadius: number;
  rect: DOMRect;
}

export function VoiceInputWrapper({ children, silenceMs = 8000 }: VoiceInputWrapperProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [bars, setBars] = useState<number[]>(new Array(24).fill(0));
  const [volume, setVolume] = useState(0);
  const [sentences, setSentences] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const retriesRef = useRef(0);
  const networkRetriesRef = useRef(0);
  const MAX_RETRIES = 5;
  const engineStopRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [processing, setProcessing] = useState(false);
  const [engineLabel, setEngineLabel] = useState<string | null>(null);

  // Measure input and compute absolute portal position
  const [portalPos, setPortalPos] = useState<{
    top: number; left: number; width: number; height: number;
    panelWidth: number; panelAbove: boolean; fontSize: number; borderRadius: number;
  } | null>(null);

  const measure = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const height = el.offsetHeight || 32;
    const width = el.offsetWidth || 200;
    const fontSize = parseFloat(cs.fontSize) || 14;
    const borderRadius = parseFloat(cs.borderRadius) || 8;

    const panelWidth = Math.max(280, Math.min(width, 500));
    const panelHeight = 72;
    const MARGIN = 6;

    // Determine above or below
    const spaceBelow = window.innerHeight - rect.bottom - MARGIN;
    const panelAbove = spaceBelow < panelHeight && rect.top > spaceBelow;

    // Horizontal: left edge of input, clamped to viewport
    let left = rect.left;
    if (left + panelWidth > window.innerWidth - MARGIN) {
      left = window.innerWidth - panelWidth - MARGIN;
    }
    if (left < MARGIN) left = MARGIN;

    // Vertical
    const top = panelAbove
      ? rect.top - panelHeight - MARGIN
      : rect.bottom + MARGIN;

    setPortalPos({
      top, left, width, height, panelWidth, panelAbove, fontSize, borderRadius,
    });
  }, []);

  useEffect(() => {
    if (!listening) { setPortalPos(null); return; }
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [listening, measure]);

  // Mic button size
  const micSize = Math.max(28, Math.min((portalPos?.height || 32) - 4, 40));
  const micIconSize = Math.max(12, Math.min(micSize - 12, 18));
  const btnRadius = Math.max(4, (portalPos?.borderRadius || 8) - 2);
  const fontSize = portalPos?.fontSize || 14;

  // ── Audio Visualizer ────────────────────────────────────────────────
  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const newBars = new Array(24).fill(0);
        for (let i = 0; i < 24; i++) {
          const idx = Math.floor(Math.pow(i / 24, 1.5) * data.length);
          newBars[i] = (data[idx] || 0) / 255;
        }
        setBars(newBars);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setVolume(sum / data.length / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError('Microphone access denied');
      setTimeout(() => setError(null), 2000);
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setBars(new Array(24).fill(0));
    setVolume(0);
  }, []);

  // ── Text insertion ──────────────────────────────────────────────────
  const insertText = useCallback((text: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const spacer = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
    const newValue = before + spacer + text + after;
    const pos = start + spacer.length + text.length;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, newValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.setSelectionRange(pos, pos);
  }, []);

  const removeLastSentence = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const parts = el.value.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const newText = parts.slice(0, -1).join('. ') + (parts.length > 1 ? '.' : '');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, newText);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setSentences(prev => prev.slice(0, -1));
  }, []);

  // ── Speech Recognition (engine-aware: API → Windows native → browser) ─
  const stopListening = useCallback(() => {
    sessionRef.current++;
    retriesRef.current = 0;
    networkRetriesRef.current = 0;
    setReconnecting(false);
    setProcessing(false);
    setListening(false);
    setInterim('');
    setError(null);
    if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); errorTimerRef.current = null; }
    if (engineStopRef.current) {
      try { engineStopRef.current(); } catch {}
      engineStopRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    stopAudio();
  }, [stopAudio]);

  const startBrowserListening = useCallback((lang: string, session: number, fail: (msg: string) => void, resetSilence: () => void) => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      fail('Speech recognition not available — add a speech API key in Settings → General → Voice & Speech.');
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      if (sessionRef.current !== session) return;
      let interimStr = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r.isFinal) { interimStr += r[0].transcript; }
        else { setInterim(''); setSentences(p => [...p, r[0].transcript]); insertText(r[0].transcript); }
      }
      if (interimStr) setInterim(interimStr);
      retriesRef.current = 0;
      networkRetriesRef.current = 0;
      setReconnecting(false);
      resetSilence();
    };

    recognition.onerror = (event: any) => {
      if (sessionRef.current !== session) return;
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'network') {
        networkRetriesRef.current++;
        setReconnecting(true);
        return;
      }
      fail(event.error === 'not-allowed' ? 'Microphone permission denied' : 'Voice error');
    };

    recognition.onend = () => {
      if (!recognitionRef.current) return;

      // Network errors: always restart, never count toward limit
      if (networkRetriesRef.current > 0) {
        const delay = Math.min(1000 * Math.pow(1.5, Math.min(networkRetriesRef.current - 1, 4)), 5000);
        setTimeout(() => {
          if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch { stopListening(); }
          }
        }, delay);
        return;
      }

      // Non-network errors: backoff with retry limit
      if (retriesRef.current >= MAX_RETRIES) {
        fail('Connection lost');
        return;
      }
      const delay = Math.min(300 * Math.pow(2, retriesRef.current), 3000);
      retriesRef.current++;
      setTimeout(() => {
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { stopListening(); }
        }
      }, delay);
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { fail('Voice error'); return; }
    resetSilence();
  }, [insertText, stopListening]);

  const startListening = useCallback(() => {
    const session = ++sessionRef.current;
    setListening(true);
    setSentences([]);
    setInterim('');
    setError(null);
    setProcessing(false);
    setEngineLabel(null);
    if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); errorTimerRef.current = null; }

    const fail = (msg: string) => {
      setError(msg);
      // Stop recognition engines WITHOUT clearing the error state
      sessionRef.current++;
      retriesRef.current = 0;
      networkRetriesRef.current = 0;
      setReconnecting(false);
      setProcessing(false);
      setInterim('');
      if (engineStopRef.current) {
        try { engineStopRef.current(); } catch {}
        engineStopRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      stopAudio();
      // Clear error AFTER a delay so user can read it; then set listening=false
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setError(null);
        setListening(false);
        errorTimerRef.current = null;
      }, 3000);
    };

    const resetSilence = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => stopListening(), silenceMs);
    };

    startAudio();
    const lang = localStorage.getItem('voice-lang') || navigator.language || 'en-US';

    sttGetStatus().then((status) => {
      if (sessionRef.current !== session) return;
      if (status.engine === 'api') {
        setEngineLabel('Cloud API');
        engineStopRef.current = sttStartApi(lang, {
          onState: (s) => {
            if (sessionRef.current === session && s === 'processing') setProcessing(true);
          },
          onFinal: (text) => {
            if (sessionRef.current !== session) return;
            setProcessing(false);
            setSentences(p => [...p, text]);
            insertText(text);
            stopListening();
          },
          onError: (msg) => fail(msg),
        });
        resetSilence();
      } else if (status.engine === 'native') {
        setEngineLabel('Windows speech');
        engineStopRef.current = sttStartNative(lang, {
          onFinal: (text) => {
            if (sessionRef.current !== session) return;
            setSentences(p => [...p, text]);
            insertText(text);
            resetSilence();
          },
          onError: (msg) => fail(msg),
        });
        resetSilence();
      } else {
        startBrowserListening(lang, session, fail, resetSilence);
      }
    }).catch(() => fail('Speech not available'));
  }, [silenceMs, insertText, startAudio, stopListening, startBrowserListening]);

  const toggle = useCallback(() => { listening ? stopListening() : startListening(); }, [listening, startListening, stopListening]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && listening) stopListening(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [listening, stopListening]);

  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    stopListening();
  }, [stopListening]);

  const supported = typeof window !== 'undefined' && (!!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition) || !!window.deskflowAPI);
  if (!supported) return <>{children}</>;

  const childWithRef = cloneElement(children, {
    ref: (node: any) => {
      inputRef.current = node;
      const r = (children.props as any).ref;
      if (typeof r === 'function') r(node);
      else if (r && 'current' in r) r.current = node;
    },
    className: `${(children.props as any).className || ''} pr-10`,
  });

  // ── Portal Panel ────────────────────────────────────────────────────
  const panel = portalPos && (listening || error || reconnecting) ? createPortal(
    <AnimatePresence>
      <motion.div
        key="voice-panel"
        initial={{ opacity: 0, y: portalPos.panelAbove ? 6 : -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: portalPos.panelAbove ? 6 : -6, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        style={{
          position: 'fixed',
          top: portalPos.top,
          left: portalPos.left,
          width: portalPos.panelWidth,
          zIndex: 99999,
        }}
      >
        <div
          className="rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 shadow-xl shadow-black/20 overflow-hidden"
          style={{ padding: Math.max(8, fontSize * 0.75) }}
        >
          <div className="flex items-center gap-2">
            {/* Sound Wave */}
            <div className="flex-shrink-0 flex items-end gap-[2px]" style={{ height: micSize * 0.8 }} aria-hidden="true">
              {bars.map((value, i) => {
                const h = Math.max(3, Math.round(value * micSize * 0.7));
                const opacity = 0.4 + value * 0.6;
                const isCenter = i >= 8 && i <= 15;
                return (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-75"
                    style={{
                      width: 3, height: listening ? h : 3,
                      backgroundColor: isCenter ? `rgba(232,134,107,${opacity})` : `rgba(217,104,70,${opacity * 0.8})`,
                    }}
                  />
                );
              })}
            </div>

            <div className="w-px bg-zinc-700/50 flex-shrink-0" style={{ height: micSize * 0.6 }} />

            {/* Interim text */}
            <div className="flex-1 min-w-0">
              {error ? (
                <div className="flex items-center gap-1 text-red-400" style={{ fontSize: fontSize * 0.85 }}>
                  <AlertCircle className="flex-shrink-0" style={{ width: micIconSize, height: micIconSize }} />
                  <span className="truncate">{error}</span>
                </div>
              ) : reconnecting ? (
                <div className="flex items-center gap-1 text-amber-400/80" style={{ fontSize: fontSize * 0.85 }}>
                  <WifiOff className="flex-shrink-0 animate-pulse" style={{ width: micIconSize, height: micIconSize }} />
                  <span className="truncate">Reconnecting...</span>
                </div>
              ) : interim ? (
                <p className="text-zinc-300 italic truncate" style={{ fontSize: fontSize * 0.85 }}>{interim}</p>
              ) : processing ? (
                <p className="text-zinc-400 italic truncate" style={{ fontSize: fontSize * 0.85 }}>
                  {engineLabel ? `${engineLabel} — transcribing…` : 'Transcribing…'}
                </p>
              ) : (
                <p className="text-zinc-500 italic" style={{ fontSize: fontSize * 0.85 }}>
                  {engineLabel ? `${engineLabel} — listening…` : 'Listening...'}
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={removeLastSentence}
                disabled={sentences.length === 0}
                className={`grid place-items-center rounded transition-colors ${
                  sentences.length === 0 ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-700/60'
                }`}
                style={{ width: micSize * 0.85, height: micSize * 0.85 }}
                aria-label="Remove last sentence"
              >
                <Delete style={{ width: micIconSize * 0.85, height: micIconSize * 0.85 }} />
              </button>
              <button
                type="button"
                onClick={stopListening}
                className="grid place-items-center rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                style={{ width: micSize * 0.85, height: micSize * 0.85 }}
                aria-label="Stop voice input"
              >
                <Square className="fill-current" style={{ width: micIconSize * 0.7, height: micIconSize * 0.7 }} />
              </button>
            </div>
          </div>

          {/* Volume bar */}
          <div className="mt-1.5 rounded-full bg-zinc-800 overflow-hidden" style={{ height: 3 }}>
            <div className="h-full rounded-full bg-[#e8866b]/60 transition-all duration-100" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <>
      <div className="relative inline-block w-full">
        {childWithRef}

        {/* Mic Button — sized to match input height */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10">
          <button
            type="button"
            onClick={toggle}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={listening}
            style={{
              width: micSize, height: micSize, minWidth: micSize, minHeight: micSize,
              borderRadius: btnRadius,
            }}
            className={`
              relative grid place-items-center p-0
              transition-all duration-150
              focus-visible:ring-2 focus-visible:ring-[#e8866b]/60 focus-visible:outline-none
              ${error
                ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/40'
                : listening
                  ? 'bg-[#d96846]/15 text-[#e8866b] ring-1 ring-[#d96846]/30'
                  : 'text-zinc-400 bg-zinc-900/60 ring-1 ring-zinc-800/60 hover:text-[#e8866b] hover:ring-[#d96846]/30'
              }
            `}
          >
            {listening && !error && (
              <span className="absolute inset-0 rounded-[inherit] animate-[pulse-ring_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite] pointer-events-none" />
            )}
            {error ? <MicOff style={{ width: micIconSize, height: micIconSize }} /> : listening ? <Mic style={{ width: micIconSize, height: micIconSize }} /> : <MicOff style={{ width: micIconSize, height: micIconSize }} />}
          </button>
        </div>
      </div>

      {/* Portal panel — rendered at document.body, never clipped */}
      {panel}
    </>
  );
}

/**
 * useVoiceInput — Speech Recognition Hook (v3)
 * Uses refs for context values to prevent recognition re-creation on state changes.
 */

import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { useVoiceContext } from '../context/VoiceContext';
import { getStoredLanguage, insertAtCursor, getCursorPosition } from '../lib/voice-utils';
import { sttGetStatus, sttStartApi, sttStartNative } from '../lib/stt';

// ── Types ─────────────────────────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
  }
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';
export type VoiceError = 'no-permission' | 'no-speech' | 'aborted' | 'unknown';

export interface UseVoiceInput {
  supported: boolean;
  state: VoiceState;
  interim: string;
  solidifying: boolean;
  error?: VoiceError;
  start: () => void;
  stop: () => void;
  countdownMs: number;
  lang: string;
  setLang: (lang: string) => void;
  backspace: () => void;
  sentences: string[];
  isActive: boolean;
}

export interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  silenceMs?: number;
  lang?: string;
  mode?: 'append' | 'replace';
  elementRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useVoiceInput({
  onTranscript,
  silenceMs = 5000,
  lang: langProp,
  mode = 'append',
  elementRef,
}: UseVoiceInputOptions): UseVoiceInput {
  const inputId = useId();
  const ctx = useVoiceContext();

  // Local state for backwards compatibility
  const [localState, setLocalState] = useState<VoiceState>('idle');
  const [localInterim, setLocalInterim] = useState('');
  const [localSolidifying, setLocalSolidifying] = useState(false);
  const [localError, setLocalError] = useState<VoiceError | undefined>();
  const [localCountdown, setLocalCountdown] = useState(silenceMs);

  const [sentences, setSentences] = useState<string[]>([]);
  const [lang, setLangState] = useState(langProp || getStoredLanguage());

  // ── Refs (stable — never cause re-renders) ─────────────────────────
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solidifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userStoppedRef = useRef(false);
  const startedAtRef = useRef<number>(0);
  const retriesRef = useRef(0);
  const networkRetriesRef = useRef(0);
  const MAX_RETRIES = 5;
  const engineRef = useRef<'browser' | 'api' | 'native'>('browser');
  const engineStopRef = useRef<(() => void) | null>(null);

  // Refs for values used inside recognition callbacks (avoid stale closures)
  const onTranscriptRef = useRef(onTranscript);
  const elementRefRef = useRef(elementRef);
  const hasProvider = !!ctx;
  const ctxRef = useRef(ctx);
  const modeRef = useRef(mode);
  const langRef = useRef(lang);
  const silenceMsRef = useRef(silenceMs);
  const sentencesRef = useRef(sentences);

  // Keep refs up to date
  onTranscriptRef.current = onTranscript;
  elementRefRef.current = elementRef;
  ctxRef.current = ctx;
  modeRef.current = mode;
  langRef.current = lang;
  silenceMsRef.current = silenceMs;
  sentencesRef.current = sentences;

  // ── State derivation ───────────────────────────────────────────────
  const state = hasProvider ? ctx.state : localState;
  const interim = hasProvider ? ctx.interim : localInterim;
  const solidifying = hasProvider ? ctx.solidifying : localSolidifying;
  const error = hasProvider ? ctx.error : localError;
  const countdownMs = hasProvider ? ctx.countdownMs : localCountdown;
  const isActive = hasProvider ? ctx.activeInputId === inputId : state === 'listening';

  // ── Helpers ─────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    if (solidifyTimerRef.current) { clearTimeout(solidifyTimerRef.current); solidifyTimerRef.current = null; }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const setter = hasProvider ? ctx.setCountdownMs : setLocalCountdown;
    setter(silenceMsRef.current);
    silenceTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
    }, silenceMsRef.current);
  }, [hasProvider, ctx]);

  // ── Engine helpers (API / Windows native) ────────────────────────────
  const endSession = useCallback(() => {
    const c = ctxRef.current;
    if (c) c.stopSession();
    else { setLocalState('idle'); setLocalInterim(''); }
    clearTimers();
    retriesRef.current = 0;
    networkRetriesRef.current = 0;
  }, [clearTimers]);

  const handleFinal = useCallback((text: string) => {
    const c = ctxRef.current;
    if (c) c.setInterim('');
    else setLocalInterim('');
    if (c) c.setSolidifying(true);
    else setLocalSolidifying(true);
    setSentences(prev => [...prev, text]);

    // Cursor-aware insertion
    const el = elementRefRef.current?.current;
    if (el && modeRef.current === 'append') {
      const cursor = getCursorPosition(el);
      const { newValue, newCursor } = insertAtCursor(el.value, text, cursor, 'append');
      el.value = newValue;
      el.setSelectionRange(newCursor.start, newCursor.end);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    onTranscriptRef.current(text);

    if (solidifyTimerRef.current) clearTimeout(solidifyTimerRef.current);
    solidifyTimerRef.current = setTimeout(() => {
      if (c) c.setSolidifying(false);
      else setLocalSolidifying(false);
    }, 800);
  }, []);

  const handleEngineError = useCallback((code: VoiceError) => {
    const c = ctxRef.current;
    const errSession = sessionRef.current; // capture current session
    if (c) {
      // Set error first, then stop engines — do NOT call stopSession() which clears error immediately
      c.setError(code);
      clearTimers();
      if (engineStopRef.current) { try { engineStopRef.current(); } catch {} engineStopRef.current = null; }
      // Defer session stop until after error is visible, but only if no new session started
      setTimeout(() => {
        if (sessionRef.current === errSession) c.stopSession();
      }, 1200);
    } else {
      setLocalState('error');
      setLocalError(code);
      clearTimers();
      if (engineStopRef.current) { try { engineStopRef.current(); } catch {} engineStopRef.current = null; }
      setTimeout(() => {
        if (sessionRef.current === errSession) {
          setLocalState('idle');
          setLocalError(undefined);
        }
      }, 1200);
    }
  }, [clearTimers]);

  const resetSilenceTimerEngine = useCallback((endAfterSilence: boolean) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const setter = hasProvider ? ctx.setCountdownMs : setLocalCountdown;
    setter(silenceMsRef.current);
    silenceTimerRef.current = setTimeout(() => {
      const stopFn = engineStopRef.current;
      engineStopRef.current = null;
      if (stopFn) { try { stopFn(); } catch {} }
      if (endAfterSilence) endSession();
    }, silenceMsRef.current);
  }, [hasProvider, ctx, endSession]);

  // ── Backspace ────────────────────────────────────────────────────────
  const backspace = useCallback(() => {
    if (sentencesRef.current.length === 0) return;
    const last = sentencesRef.current[sentencesRef.current.length - 1];
    setSentences(prev => prev.slice(0, -1));
    onTranscriptRef.current(`\x00BACKSPACE:${last}`);
  }, []);

  // ── Language ───────────────────────────────────────────────────────
  const setLang = useCallback((newLang: string) => {
    setLangState(newLang);
    if (hasProvider) ctx.setLanguage(newLang);
    if (state === 'listening') {
      if (engineRef.current !== 'browser') {
        const stopFn = engineStopRef.current;
        engineStopRef.current = null;
        if (stopFn) { try { stopFn(); } catch {} }
        endSession();
        return;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.lang = newLang;
            try { recognitionRef.current.start(); } catch { /* ignore */ }
          }
        }, 200);
      }
    }
  }, [state, hasProvider, ctx, endSession]);

  // ── SpeechRecognition Setup (NO ctx dependency!) ──────────────────
  useEffect(() => {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langRef.current;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimStr = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) {
          interimStr += result[0].transcript;
        }
      }

      // Update interim
      const c = ctxRef.current;
      if (c) c.setInterim(interimStr);
      else setLocalInterim(interimStr);

      // Process final results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript;

          // Clear interim
          if (c) c.setInterim('');
          else setLocalInterim('');

          // Set solidifying
          if (c) c.setSolidifying(true);
          else setLocalSolidifying(true);

          // Track sentence
          setSentences(prev => [...prev, text]);

          // Cursor-aware insertion
          const el = elementRefRef.current?.current;
          if (el && modeRef.current === 'append') {
            const cursor = getCursorPosition(el);
            const { newValue, newCursor } = insertAtCursor(el.value, text, cursor, 'append');
            el.value = newValue;
            el.setSelectionRange(newCursor.start, newCursor.end);
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }

          onTranscriptRef.current(text);

          if (solidifyTimerRef.current) clearTimeout(solidifyTimerRef.current);
          solidifyTimerRef.current = setTimeout(() => {
            if (c) c.setSolidifying(false);
            else setLocalSolidifying(false);
          }, 800);
        }
      }

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      retriesRef.current = 0;
      networkRetriesRef.current = 0;
      const currentSilenceMs = silenceMsRef.current;
      const countdownSetter = c ? c.setCountdownMs : setLocalCountdown;
      countdownSetter(currentSilenceMs);
      silenceTimerRef.current = setTimeout(() => {
        recognitionRef.current?.stop();
      }, currentSilenceMs);
    };

    recognition.onerror = (event: Event & { error: string }) => {
      const c = ctxRef.current;

      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (c) c.setError(event.error === 'no-speech' ? 'no-speech' : 'aborted');
        else setLocalError(event.error === 'no-speech' ? 'no-speech' : 'aborted');
        setTimeout(() => {
          if (c) c.setError(undefined);
          else setLocalError(undefined);
        }, 1200);
        return;
      }

      if (event.error === 'network') {
        networkRetriesRef.current++;
        if (c) c.setError(undefined);
        else setLocalError(undefined);
        return;
      }

      if (c) {
        if (event.error === 'not-allowed') c.setError('no-permission');
        else c.setError('unknown');
        c.stopSession();
      } else {
        setLocalState('error');
        if (event.error === 'not-allowed') setLocalError('no-permission');
        else setLocalError('unknown');
        setTimeout(() => {
          setLocalState('idle');
          setLocalError(undefined);
        }, 1200);
      }
      clearTimers();
    };

    recognition.onend = () => {
      if (userStoppedRef.current) {
    userStoppedRef.current = false;
    retriesRef.current = 0;
    networkRetriesRef.current = 0;
        networkRetriesRef.current = 0;
        const c = ctxRef.current;
        if (c) c.stopSession();
        else {
          setLocalState('idle');
          setLocalInterim('');
        }
        clearTimers();
        return;
      }

      // Network errors: always restart, never count toward limit
      if (networkRetriesRef.current > 0) {
        const delay = Math.min(1000 * Math.pow(1.5, Math.min(networkRetriesRef.current - 1, 4)), 5000);
        setTimeout(() => {
          if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch {
              const c = ctxRef.current;
              if (c) c.stopSession();
              else setLocalState('idle');
              clearTimers();
              retriesRef.current = 0;
              networkRetriesRef.current = 0;
            }
          }
        }, delay);
        return;
      }

      // Non-network errors: backoff with retry limit
      if (retriesRef.current >= MAX_RETRIES) {
        const c = ctxRef.current;
        if (c) { c.setError('unknown'); c.stopSession(); }
        else { setLocalState('idle'); setLocalError('unknown'); }
        clearTimers();
        retriesRef.current = 0;
        return;
      }
      const delay = Math.min(300 * Math.pow(2, retriesRef.current), 3000);
      retriesRef.current++;
      setTimeout(() => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            const c = ctxRef.current;
            if (c) c.stopSession();
            else setLocalState('idle');
            clearTimers();
            retriesRef.current = 0;
          }
        }
      }, delay);
    };

    recognitionRef.current = recognition;
    return () => { recognition.abort(); clearTimers(); };
  }, []); // ← EMPTY dependency array — recognition created once

  // ── Start ────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (!recognitionRef.current && !window.deskflowAPI) return;

    userStoppedRef.current = false;

    if (hasProvider) {
      ctx.startSession({
        inputId,
        element: elementRefRef.current?.current ?? null,
        onTranscript: onTranscriptRef.current,
        onBackspace: backspace,
        onStop: () => {
          if (engineRef.current !== 'browser') {
            const stopFn = engineStopRef.current;
            engineStopRef.current = null;
            if (stopFn) { try { stopFn(); } catch {} }
            endSession();
          } else {
            recognitionRef.current?.stop();
          }
        },
      });
    } else {
      setLocalState('listening');
    }

    const setInterimFn = hasProvider ? ctx.setInterim : setLocalInterim;
    const setCountdownFn = hasProvider ? ctx.setCountdownMs : setLocalCountdown;

    setInterimFn('');
    setSentences([]);
    if (hasProvider) ctx.setError(undefined);
    else setLocalError(undefined);

    setCountdownFn(silenceMsRef.current);
    startedAtRef.current = Date.now();

    sttGetStatus().then((status) => {
      if (userStoppedRef.current) return;

      if (status.engine === 'api' || status.engine === 'native') {
        engineRef.current = status.engine;
        const stopFn = status.engine === 'api'
          ? sttStartApi(langRef.current, {
              onState: (s) => {
                if (s === 'processing' && !hasProvider) setLocalState('processing');
              },
              onFinal: (text) => { handleFinal(text); endSession(); },
              onError: (msg) => handleEngineError(msg === 'No speech detected' ? 'no-speech' : 'unknown'),
            })
          : sttStartNative(langRef.current, {
              onFinal: (text) => { handleFinal(text); resetSilenceTimerEngine(false); },
              onError: (msg) => handleEngineError('unknown'),
            });
        engineStopRef.current = stopFn;
        resetSilenceTimerEngine(status.engine === 'native');
        countdownTimerRef.current = setInterval(() => {
          setCountdownFn(prev => Math.max(0, prev - 100));
        }, 100);
        return;
      }

      engineRef.current = 'browser';
      if (!recognitionRef.current) { endSession(); return; }
      try {
        recognitionRef.current.lang = langRef.current;
        recognitionRef.current.start();
      } catch {
        endSession();
        return;
      }
      resetSilenceTimer();
      countdownTimerRef.current = setInterval(() => {
        setCountdownFn(prev => Math.max(0, prev - 100));
      }, 100);
    }).catch(() => handleEngineError('unknown'));
  }, [hasProvider, ctx, inputId, backspace, resetSilenceTimer, resetSilenceTimerEngine, handleFinal, handleEngineError, endSession]);

  // ── Stop ─────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    userStoppedRef.current = true;
    if (engineRef.current !== 'browser') {
      const stopFn = engineStopRef.current;
      engineStopRef.current = null;
      if (stopFn) { try { stopFn(); } catch {} }
      endSession();
      return;
    }
    if (!recognitionRef.current) { endSession(); return; }
    if (state === 'listening') {
      if (!hasProvider) setLocalState('processing');
      setTimeout(() => {
        if (recognitionRef.current) recognitionRef.current.stop();
      }, 200);
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [state, hasProvider, endSession]);

  // Cleanup
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Stop any running API/native engine on unmount
  useEffect(() => () => {
    const stopFn = engineStopRef.current;
    engineStopRef.current = null;
    if (stopFn) { try { stopFn(); } catch {} }
  }, []);

  const supported = typeof window !== 'undefined' && (!!(window.webkitSpeechRecognition || window.SpeechRecognition) || !!window.deskflowAPI);

  return {
    supported,
    state,
    interim,
    solidifying,
    error,
    start,
    stop,
    countdownMs,
    lang,
    setLang,
    backspace,
    sentences,
    isActive,
  };
}

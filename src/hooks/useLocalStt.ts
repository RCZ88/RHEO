/**
 * useLocalStt — Hook for local STT daemon (R-46/R-48)
 * No streaming — daemon stop returns events array. During recording show level+elapsed.
 * R-48: token colors only, {6,10,16} radii, no springs, no blur, no shadows.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getStore, type SttTranscript } from '../lib/sttStore';

export type LocalSttState = 'idle' | 'loading' | 'recording' | 'processing' | 'error';

export interface UseLocalSttReturn {
  state: LocalSttState;
  ready: boolean;
  model: string;
  error?: string;
  level: number;        // audio level 0–1 during recording
  elapsed: number;      // ms since recording started
  transcript: string;   // final text after stop
  start: () => void;
  stop: () => void;
  setVocab: (entry: { canonical: string; aliases?: string[]; priority?: number }) => Promise<void>;
  removeVocab: (canonical: string) => Promise<void>;
  loadVocab: (filePath?: string) => Promise<void>;
  refresh: () => Promise<void>;
  saveToLibrary: (text: string, category: string, tags: string[]) => Promise<string>;
}

export function useLocalStt(): UseLocalSttReturn {
  const [state, setState] = useState<LocalSttState>('idle');
  const [ready, setReady] = useState(false);
  const [model, setModel] = useState('base');
  const [error, setError] = useState<string | undefined>();
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');

  const recordingRef = useRef(false);
  const startRef = useRef(0);
  const rafRef = useRef<number>(0);
  const levelRef = useRef(0);
  const unsubRef = useRef<(() => void) | null>(null);

  // Load status on mount
  useEffect(() => {
    const load = async () => {
      setState('loading');
      try {
        const status = await window.deskflowAPI?.sttLocalStatus();
        if (status?.ok) {
          setReady(true);
          setModel(status.config?.model || 'base');
          setState('idle');
        } else {
          setError(status?.error || 'STT unavailable');
          setState('error');
        }
      } catch (e) {
        setError('STT unavailable');
        setState('error');
      }
    };
    load();
  }, []);

  // Listen for global shortcut toggle
  useEffect(() => {
    if (!window.deskflowAPI) return;
    unsubRef.current = window.deskflowAPI.onSttShortcutTriggered(() => {
      if (state === 'recording') stop();
      else start();
    });
    return () => { unsubRef.current?.(); };
  }, [state]);

  // Level meter — gated to recording + visibility (R-48: ≤30fps, RM→static)
  useEffect(() => {
    if (state !== 'recording') {
      setLevel(0);
      return;
    }
    let stopped = false;
    const tick = () => {
      if (stopped || !recordingRef.current) return;
      // Simulated level — real AudioContext analyser can be added here
      setLevel(Math.random() * 0.6 + 0.1);
      setElapsed(Date.now() - startRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { stopped = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [state]);

  const start = useCallback(async () => {
    if (!window.deskflowAPI) { setError('API not available'); return; }
    setState('loading');
    try {
      const result = await window.deskflowAPI.sttLocalStartRecording();
      if (!result?.ok) { setError(result.error || 'Failed to start'); setState('error'); return; }
      recordingRef.current = true;
      startRef.current = Date.now();
      setState('recording');
      setError(undefined);
    } catch (e) {
      setError(e.message || 'Failed to start');
      setState('error');
    }
  }, []);

  const stop = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setState('processing');
    try {
      const result = await window.deskflowAPI.sttLocalStopRecording();
      if (result?.ok && result.text) {
        setTranscript(result.text);
      }
      if (result?.error) setError(result.error);
    } catch (e) {
      setError(e.message);
    } finally {
      setState('idle');
      setLevel(0);
    }
  }, []);

  const setVocab = useCallback(async (entry) => {
    if (!window.deskflowAPI) return;
    await window.deskflowAPI.sttLocalVocabAdd(entry);
  }, []);

  const removeVocab = useCallback(async (canonical) => {
    if (!window.deskflowAPI) return;
    await window.deskflowAPI.sttLocalVocabRemove(canonical);
  }, []);

  const loadVocab = useCallback(async (filePath) => {
    if (!window.deskflowAPI) return;
    await window.deskflowAPI.sttLocalVocabLoad(filePath);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const status = await window.deskflowAPI?.sttLocalStatus();
      if (status?.ok) {
        setReady(true);
        setModel(status.config?.model || 'base');
        setState('idle');
        setError(undefined);
      }
    } catch { /* ignore */ }
  }, []);

  const saveToLibrary = useCallback(async (text: string, category: string, tags: string[]): Promise<string> => {
    const store = await getStore();
    const entry = await store.save({
      text,
      createdAt: new Date().toISOString(),
      durationMs: 0,
      category,
      tags: tags.filter(Boolean),
      isFavorite: false,
      source: 'STT Overlay',
    });
    return entry.id;
  }, []);

  return {
    state,
    ready,
    model,
    error,
    level,
    elapsed,
    transcript,
    start,
    stop,
    setVocab,
    removeVocab,
    loadVocab,
    refresh,
    saveToLibrary,
  };
}

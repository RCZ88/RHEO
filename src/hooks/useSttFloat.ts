/**
 * useSttFloat — the recording engine behind the floating Speech-to-Text panel.
 *
 * WHY THIS EXISTS INSTEAD OF `useLocalStt`
 * ----------------------------------------
 * `useLocalStt` (src/hooks/useLocalStt.ts) drives `stt:local-start-recording` /
 * `stt:local-stop-recording`, and BOTH of those handlers are stubs in main.ts:
 * they return `{ ok: true }` and `{ ok: true, text: '' }` without ever touching a
 * microphone. That pipeline can therefore only ever yield an empty transcript.
 * Its waveform was also `Math.random()` (useLocalStt.ts:86), i.e. decorative.
 *
 * This hook records for real. ONE `getUserMedia` stream feeds both:
 *   - an AudioContext AnalyserNode  -> a genuine RMS level for the waveform
 *   - a MediaRecorder               -> the audio that actually gets transcribed
 * so we never open the microphone twice on the normal path.
 *
 * On stop the recorded audio is sent to whatever OpenAI-compatible endpoint is
 * configured (`stt:transcribe`). When NO key is configured and the platform is
 * Windows, it falls back to the native `System.Speech` engine, which streams
 * live text instead of batch audio.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { sttGetStatus, sttStartNative, sttTranscribeAuto, type SttStatus } from '../lib/stt';

export type SttFloatState =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'processing'
  | 'error';

export interface SttEngineInfo {
  label: string;
  engine: SttStatus['engine'];
  apiConfigured: boolean;
  nativeAvailable: boolean;
  /** faster-whisper present and runnable. */
  localAvailable: boolean;
  /** Why on-device is unusable, phrased for a human. */
  localReason: string;
  /** The command that fixes it, e.g. `pip install faster-whisper`. */
  localInstall: string;
  /** True while we have not heard back from the status probe yet. */
  detecting: boolean;
}

export interface UseSttFloatOptions {
  /** Fired once per completed recording, with the final text + duration. */
  onFinish?: (text: string, durationMs: number) => void;
}

export interface UseSttFloatReturn {
  state: SttFloatState;
  error?: string;
  engine: SttEngineInfo;
  /** 0–1, live microphone level. Genuine RMS, not simulated. */
  level: number;
  /** ms since recording started. */
  elapsed: number;
  /** Text produced live by the native engine while recording. */
  interim: string;
  /** Final text of the last completed recording. */
  transcript: string;
  start: () => void;
  stop: () => void;
  clearTranscript: () => void;
  dismissError: () => void;
}

/** Level meter is a FUNCTIONAL loop, so it survives LAMINAR §6 — but cap it. */
const METER_FPS = 24;
const UNKNOWN_ENGINE: SttEngineInfo = {
  label: 'Checking engine…',
  engine: 'browser',
  apiConfigured: false,
  nativeAvailable: false,
  localAvailable: false,
  localReason: '',
  localInstall: '',
  detecting: true,
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read audio'));
    reader.readAsDataURL(blob);
  });
}

export function useSttFloat(options: UseSttFloatOptions = {}): UseSttFloatReturn {
  const onFinishRef = useRef(options.onFinish);
  onFinishRef.current = options.onFinish;

  const [state, setState] = useState<SttFloatState>('idle');
  const [error, setError] = useState<string | undefined>();
  const [engine, setEngine] = useState<SttEngineInfo>(UNKNOWN_ENGINE);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const startedAtRef = useRef(0);
  const levelRef = useRef(0);
  const nativeStopRef = useRef<(() => void) | null>(null);
  // This ref is read AFTER an `await`, so TypeScript cannot see that React state
  // may have changed in the meantime. It is deliberately widened off the
  // narrowed `SttFloatState` union for exactly that reason.
  const stateRef = useRef<string>(state);
  stateRef.current = state;

  // ── Engine detection ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    sttGetStatus()
      .then((s) => {
        if (cancelled) return;
        setEngine({
          label: s.label,
          engine: s.engine,
          apiConfigured: s.apiConfigured,
          nativeAvailable: s.nativeAvailable,
          localAvailable: !!s.localAvailable,
          localReason: s.localReason || '',
          localInstall: s.localInstall || '',
          detecting: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setEngine({
            label: 'No engine',
            engine: 'browser',
            apiConfigured: false,
            nativeAvailable: false,
            localAvailable: false,
            localReason: 'RHEO could not check for on-device transcription.',
            localInstall: 'pip install faster-whisper',
            detecting: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Teardown: release mic + audio graph + native child, always ─────
  const releaseAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      }
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      void ctx.close().catch(() => undefined);
    }
    if (nativeStopRef.current) {
      const stopFn = nativeStopRef.current;
      nativeStopRef.current = null;
      try {
        stopFn();
      } catch {
        /* ignore */
      }
    }
    setLevel(0);
    levelRef.current = 0;
  }, []);

  useEffect(() => releaseAudio, [releaseAudio]);

  // ── Level meter: real RMS from an AnalyserNode ─────────────────────
  const startMeter = useCallback((stream: MediaStream) => {
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return; // meter is cosmetic; never block recording on it
    }
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    let last = 0;

    const tick = (now: number) => {
      // Cap at METER_FPS — a 60Hz React state churn in a tiny window is waste.
      if (now - last >= 1000 / METER_FPS) {
        last = now;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // 3.2× gain so normal speech sits mid-scale instead of hugging zero.
        const next = Math.min(1, rms * 3.2);
        levelRef.current = next;
        setLevel(next);
        setElapsed(Date.now() - startedAtRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Start ─────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (stateRef.current === 'recording' || stateRef.current === 'requesting') return;
    if (stateRef.current === 'processing') return;

    setError(undefined);
    setInterim('');
    setTranscript('');
    setState('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setError(
        'Microphone unavailable. Grant mic access to RHEO in your system settings, then start again.',
      );
      setState('error');
      return;
    }

    // User may have bailed out while we awaited permission.
    if (stateRef.current !== 'requesting') {
      for (const t of stream.getTracks()) t.stop();
      return;
    }

    streamRef.current = stream;
    startedAtRef.current = Date.now();
    setElapsed(0);
    startMeter(stream);

    // No API key but Windows is present -> stream live text from the native
    // engine instead of batching audio. It owns its own capture.
    if (!engine.apiConfigured && engine.nativeAvailable) {
      const stopFn = sttStartNative(undefined, {
        onState: () => undefined,
        onFinal: (text) => {
          setInterim(text);
        },
        onError: (msg) => {
          setError(msg);
          setState('error');
        },
      });
      nativeStopRef.current = stopFn;
      setState('recording');
      return;
    }

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      releaseAudio();
      setError('This system cannot record audio in a supported format.');
      setState('error');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;

    try {
      recorder.start();
    } catch {
      releaseAudio();
      setError('Could not start the recorder. Try again.');
      setState('error');
      return;
    }

    setState('recording');
  }, [engine, releaseAudio, startMeter]);

  // ── Stop ──────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    if (stateRef.current !== 'recording') return;
    setState('processing');
    const durationMs = Date.now() - startedAtRef.current;

    // Native path already produced live text.
    if (nativeStopRef.current) {
      const stopFn = nativeStopRef.current;
      nativeStopRef.current = null;
      try {
        stopFn();
      } catch {
        /* ignore */
      }
      releaseAudio();
      const text = interim.trim();
      if (text) {
        setTranscript(text);
        onFinishRef.current?.(text, durationMs);
      } else {
        setError('No speech detected. Hold the key, get closer to the mic, and try again.');
        setState('error');
      }
      return;
    }

    const recorder = recorderRef.current;
    recorderRef.current = null;
    const mime = recorder?.mimeType || 'audio/webm';

    const blob = await new Promise<Blob>((resolve) => {
      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob(chunksRef.current, { type: mime }));
        return;
      }
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: mime }));
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(chunksRef.current, { type: mime }));
      }
    });

    releaseAudio();
    chunksRef.current = [];

    if (blob.size < 512) {
      setError('No speech detected. Recording was too short — hold to talk, then stop.');
      setState('error');
      return;
    }

    try {
      const audioBase64 = await blobToBase64(blob);
      const api = window.deskflowAPI;
      if (!api) {
        setError('Speech service is unavailable. Restart RHEO and try again.');
        setState('error');
        return;
      }

      // ONE shared engine for the whole app (local-first, cloud only as a
      // fallback). The per-field mic buttons go through the very same function,
      // so there is a single place where dictation behaviour is decided.
      const res = await sttTranscribeAuto({ audioBase64, mime });

      if (res.ok && res.text) {
        setInterim('');
        setTranscript(res.text);
        onFinishRef.current?.(res.text, durationMs);
        setState('idle');
        return;
      }

      // Actionable message: name the missing piece and the command that fixes it.
      setError(res.install ? `${res.error} Run: ${res.install}` : (res.error || 'No speech detected.'));
      setState('error');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Speech service failed.');
      setState('error');
    }
  }, [interim, releaseAudio]);

  const clearTranscript = useCallback(() => setTranscript(''), []);
  const dismissError = useCallback(() => {
    setError(undefined);
    setState('idle');
  }, []);

  // Never leave the mic hot if the window is closed mid-recording.
  useEffect(() => {
    const onBeforeUnload = () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      releaseAudio();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [releaseAudio]);

  return {
    state,
    error,
    engine,
    level,
    elapsed,
    interim,
    transcript,
    start,
    stop,
    clearTranscript,
    dismissError,
  };
}
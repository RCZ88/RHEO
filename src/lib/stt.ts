// Shared speech-to-text engine lib — API primary, Windows native fallback.
// The browser webkitSpeechRecognition path stays inside the hooks/components.

export interface SttStatus {
  engine: 'local' | 'api' | 'native' | 'browser';
  apiConfigured: boolean;
  nativeAvailable: boolean;
  label: string;
  /** faster-whisper is installed and runnable — the preferred, offline engine. */
  localAvailable: boolean;
  localPython: boolean;
  localVersion: string | null;
  localReason: string;
  localInstall: string;
}

export interface SttCallbacks {
  onState?: (state: 'recording' | 'processing' | 'listening') => void;
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

function getLang(): string {
  try {
    return localStorage.getItem('voice-lang') || navigator.language || 'en-US';
  } catch {
    return 'en-US';
  }
}

export interface SttTranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
  /** 'local' = on-device faster-whisper, 'api' = cloud, undefined on failure. */
  engine?: 'local' | 'api';
  /** The command that fixes a missing local engine, when that was the problem. */
  install?: string;
}

/**
 * THE single transcription path for the whole app.
 *
 * Both the per-field mic buttons (VoiceInputWrapper -> useVoiceInput ->
 * sttStartApi) and the floating dictation overlay (useSttFloat) call this, so
 * there is exactly ONE engine in RHEO instead of two that drift.
 *
 * On-device faster-whisper is tried first and is the expected path: dictation
 * must work offline, with no account and no key. The cloud endpoint is only a
 * fallback for someone who has actually set a key AND has no local engine —
 * audio should never leave the machine when it does not have to.
 */
export function sttTranscribeAuto(payload: {
  audioBase64: string;
  mime?: string;
  lang?: string;
}): Promise<SttTranscribeResult> {
  const api = window.deskflowAPI;
  if (!api) {
    return Promise.resolve({ ok: false, error: 'Speech is unavailable. Restart RHEO.' });
  }

  const run = async (): Promise<SttTranscribeResult> => {
    if (api.sttTranscribeLocal) {
      try {
        const local = await api.sttTranscribeLocal(payload);
        if (local?.ok && local.text) return { ok: true, text: local.text, engine: 'local' };
        return {
          ok: false,
          error: local?.error,
          install: local?.install,
        };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'On-device transcription failed.' };
      }
    }
    return { ok: false, error: 'On-device transcription is unavailable.' };
  };

  return run().then((localResult) => {
    // Local produced a real answer, or failed for a reason a cloud call cannot fix.
    const missingLocal =
      !!localResult.install || /not installed|Python/i.test(localResult.error || '');
    if (localResult.ok || !missingLocal) return localResult;

    return sttGetStatus().then((status) => {
      if (!status.apiConfigured) return localResult;
      return api.sttTranscribe(payload).then(
        (cloud): SttTranscribeResult => {
          if (cloud?.ok && cloud.text) return { ok: true, text: cloud.text, engine: 'api' };
          return { ok: false, error: cloud?.error || 'Speech service failed.' };
        },
        (err: any): SttTranscribeResult => ({
          ok: false,
          error: err?.message || 'Speech service failed.',
        }),
      );
    });
  });
}

export function sttGetStatus(): Promise<SttStatus> {
  if (!window.deskflowAPI) {
    return Promise.resolve({
      engine: 'browser', apiConfigured: false, nativeAvailable: false,
      label: 'No engine', localAvailable: false, localPython: false,
      localVersion: null, localReason: 'RHEO APIs are unavailable.',
      localInstall: 'pip install faster-whisper',
    } as SttStatus);
  }
  return window.deskflowAPI.sttGetStatus();
}

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

export interface SttStop {
  (): void;
}

export function sttStartApi(lang: string | undefined, cb: SttCallbacks): SttStop {
  const api = window.deskflowAPI;
  if (!api) {
    cb.onError('Speech not available');
    return () => undefined;
  }
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stopped = false;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (stopped) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (chunks.length === 0) return;
        cb.onState?.('processing');
        try {
          const blob = new Blob(chunks, { type: mime || 'audio/webm' });
          const audioBase64 = await blobToBase64(blob);
          const res = await sttTranscribeAuto({
            audioBase64,
            mime: mime || 'audio/webm',
            lang: lang || getLang(),
          });
          if (res.ok && res.text) {
            cb.onFinal(res.text);
          } else if (!stopped) {
            // Name the missing piece and the command that fixes it, rather than
            // a bare "no speech detected" that sends people hunting in Settings.
            const msg = res.install
              ? `${res.error} Run: ${res.install}`
              : (res.error || 'No speech detected');
            cb.onError(msg);
          }
        } catch (err: any) {
          if (!stopped) cb.onError(err?.message || 'Speech service failed');
        }
      };
      recorder.start();
      cb.onState?.('recording');
    } catch {
      if (!stopped) cb.onError('Microphone access denied');
    }
  };

  startRecording();

  return () => {
    stopped = true;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
  };
}

export function sttStartNative(lang: string | undefined, cb: SttCallbacks): SttStop {
  const api = window.deskflowAPI;
  if (!api) {
    cb.onError('Speech not available');
    return () => undefined;
  }
  let stopped = false;
  let unsubscribe: (() => void) | null = null;
  let gotFirstEvent = false;

  // Timeout: if no events arrive within 5s, the native engine likely failed to start
  const startupTimer = setTimeout(() => {
    if (!stopped && !gotFirstEvent) {
      cb.onError('Windows speech engine not responding — check microphone access');
    }
  }, 5000);

  const handler = (ev: { type: string; text?: string }) => {
    if (stopped) return;
    gotFirstEvent = true;
    clearTimeout(startupTimer);
    if (ev.type === 'final' && ev.text) {
      cb.onFinal(ev.text);
    } else if (ev.type === 'error') {
      cb.onError(ev.text || 'Windows speech failed');
    }
  };

  api
    .sttNativeStart(lang || getLang())
    .then((res) => {
      if (stopped) {
        api.sttNativeStop();
        return;
      }
      if (!res.ok) {
        cb.onError(res.error || 'Windows speech failed to start');
        return;
      }
      unsubscribe = api.onSttNativeEvent(handler);
      cb.onState?.('listening');
    })
    .catch((err: any) => {
      if (!stopped) cb.onError(err?.message || 'Windows speech failed to start');
    });

  return () => {
    stopped = true;
    clearTimeout(startupTimer);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch {
        /* ignore */
      }
    }
    api.sttNativeStop();
  };
}

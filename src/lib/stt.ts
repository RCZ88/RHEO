// Shared speech-to-text engine lib — API primary, Windows native fallback.
// The browser webkitSpeechRecognition path stays inside the hooks/components.

export interface SttStatus {
  engine: 'api' | 'native' | 'browser';
  apiConfigured: boolean;
  nativeAvailable: boolean;
  label: string;
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

export function sttGetStatus(): Promise<SttStatus> {
  if (!window.deskflowAPI) {
    return Promise.resolve({ engine: 'browser', apiConfigured: false, nativeAvailable: false, label: 'Browser speech' });
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
          const res = await api.sttTranscribe({ audioBase64, mime: mime || 'audio/webm', lang: lang || getLang() });
          if (res.ok && res.text) {
            cb.onFinal(res.text);
          } else if (!stopped) {
            cb.onError(res.error || 'No speech detected');
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

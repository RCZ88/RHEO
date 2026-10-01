// Typed renderer wrapper over the main-process local-AI channels.
// Every call goes through IPC — never a bare renderer `fetch('http://localhost…')`,
// which is subject to CORS preflight + the app's CSP and fails without a usable
// error message.

const w = window as any;

export interface OllamaStatus {
  online: boolean;
  version?: string;
  models: string[];
  visionModels: string[];
  error?: string;
}

export interface SttEndpoint { base: string; models: string[]; }

export interface LocalAiStatus {
  ollama: OllamaStatus;
  stt: { endpoints: SttEndpoint[]; cli: string | null };
  checkedAt: number;
}

export interface VisionResult { text?: string; model?: string; elapsedMs?: number; error?: string; visionModels?: string[]; }
export interface SttResult { text?: string; model?: string; engine?: string; elapsedMs?: number; bytes?: number; error?: string; }

/** Families worth suggesting when Ollama is online but has no vision model. */
export const VISION_FALLBACKS = ['llama3.2-vision', 'qwen2.5vl:3b', 'minicpm-v', 'moondream', 'llava-llama3'];

function unwrap(res: any): any {
  if (!res) return { error: 'No response from the main process.' };
  if (res.error) return { error: String(res.error) };
  return res;
}

export function getLocalStatus(): Promise<LocalAiStatus> {
  return w.deskflowAPI.lectureLocalStatus().catch((err: any) => ({
    ollama: { online: false, models: [], visionModels: [], error: String(err?.message || err) },
    stt: { endpoints: [], cli: null },
    checkedAt: Date.now(),
  }));
}

export function runVision(opts: { model?: string; imageBase64?: string; prompt?: string }): Promise<VisionResult> {
  return w.deskflowAPI.lectureLocalVision(opts).then(unwrap);
}

export function runStt(opts: {
  audioBase64?: string; mime?: string; filename?: string; language?: string; model?: string; endpoint?: string;
}): Promise<SttResult> {
  return w.deskflowAPI.lectureLocalStt(opts).then(unwrap);
}

/** Strip a `data:` prefix so we ship bare base64 across IPC. */
export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => resolve(dataUrlToBase64(String(reader.result || '')));
    reader.readAsDataURL(file);
  });
}

/** Read a File as a data URL (keeps the prefix, needed for <img src>). */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export function formatMs(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

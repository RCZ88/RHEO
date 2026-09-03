import { ipcMain, BrowserWindow, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';

// Inline types (mirrors src/features/critique/types.ts — keep in sync)
interface CritiqueResult {
  schema_version: string; image: any; ocr_text: any[]; palette: any[]; gradients: any[];
  contrast_issues: any[]; elements: any[]; spacing_issues: any[]; alignment: any;
  description: string; critique: any; scores: Record<string, number>; verification: any; meta: any;
}
interface VisionHealth { status: string; gpu: string | null; vram_free_mb: number | null; models: string[]; version: string; }
interface AnalyzeProgress { jobId: string; pass: string; pct: number; partial: Partial<CritiqueResult> | null; }
interface AnalyzeRequest { image_path: string; passes?: string[]; resolution?: any; tiling?: any; models?: any; temps?: any; rubric_version?: string; use_cache?: boolean; }

let sidecarProcess: ChildProcess | null = null;
let sidecarPort: number | null = null;
let sidecarRetries = 0;
const MAX_RETRIES = 3;
let shuttingDown = false;

function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function httpRequest(url: string, options?: { method?: string; body?: string; timeout?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options?.method || 'GET',
      headers: options?.body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(options.body) } : {},
      timeout: options?.timeout || 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options?.body) req.write(options.body);
    req.end();
  });
}

export async function startSidecar(): Promise<boolean> {
  if (sidecarProcess) return true;
  if (shuttingDown) return false;

  try {
    sidecarPort = await getRandomPort();
    const sidecarDir = path.resolve(__dirname, '..', '..', '..', 'vision-sidecar');
    const venvPython = path.join(sidecarDir, '.venv', 'Scripts', 'python.exe');
    const systemPython = 'python';

    const pythonExe = fs.existsSync(venvPython) ? venvPython : systemPython;

    sidecarProcess = spawn(pythonExe, [
      '-m', 'vision_sidecar.server',
      '--port', String(sidecarPort),
    ], {
      cwd: sidecarDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    sidecarProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      console.log(`[vision-sidecar] ${msg}`);
      if (msg.startsWith('READY')) {
        sidecarRetries = 0;
      }
    });

    sidecarProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[vision-sidecar:err] ${data.toString().trim()}`);
    });

    sidecarProcess.on('exit', (code) => {
      console.log(`[vision-sidecar] exited with code ${code}`);
      sidecarProcess = null;
      if (!shuttingDown && sidecarRetries < MAX_RETRIES) {
        sidecarRetries++;
        setTimeout(() => startSidecar(), 1000 * sidecarRetries);
      }
    });

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const health = await httpRequest(`http://127.0.0.1:${sidecarPort}/health`);
        const parsed: VisionHealth = JSON.parse(health);
        console.log(`[vision-sidecar] health OK: ${JSON.stringify(parsed)}`);
        return true;
      } catch { }
    }

    console.warn('[vision-sidecar] failed to start within 15s');
    killSidecar();
    return false;
  } catch (err) {
    console.error('[vision-sidecar] spawn error:', err);
    return false;
  }
}

export function killSidecar(): void {
  if (sidecarProcess) {
    shuttingDown = true;
    try {
      sidecarProcess.kill('SIGTERM');
      setTimeout(() => {
        if (sidecarProcess) {
          try { sidecarProcess.kill('SIGKILL'); } catch { }
          sidecarProcess = null;
        }
      }, 3000);
    } catch { }
    sidecarProcess = null;
  }
}

function forwardSSE(jobId: string, win: BrowserWindow): void {
  if (!sidecarPort) return;
  const req = http.get(`http://127.0.0.1:${sidecarPort}/jobs/${jobId}/events`, (res) => {
    let buffer = '';
    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data: AnalyzeProgress = JSON.parse(line.slice(6));
            win.webContents.send('vision:progress', data);
          } catch { }
        }
      }
    });
  });
  req.on('error', () => { });
}

export function registerVisionHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('vision:health', async () => {
    if (!sidecarPort) return { status: 'disconnected', gpu: null, vram_free_mb: null, models: [], version: '0.0.0' };
    try {
      const raw = await httpRequest(`http://127.0.0.1:${sidecarPort}/health`);
      return JSON.parse(raw);
    } catch {
      return { status: 'unreachable', gpu: null, vram_free_mb: null, models: [], version: '0.0.0' };
    }
  });

  ipcMain.handle('vision:start-sidecar', async () => {
    const ok = await startSidecar();
    return { ok };
  });

  ipcMain.handle('vision:analyze', async (_event, request: AnalyzeRequest) => {
    if (!sidecarPort) {
      const started = await startSidecar();
      if (!started) throw new Error('Sidecar failed to start');
    }
    const body = JSON.stringify(request);
    const raw = await httpRequest(`http://127.0.0.1:${sidecarPort}/analyze`, { method: 'POST', body, timeout: 300000 });
    const { job_id } = JSON.parse(raw);
    const win = getMainWindow();
    if (win) forwardSSE(job_id, win);
    return { jobId: job_id };
  });

  ipcMain.handle('vision:get-result', async (_event, jobId: string) => {
    if (!sidecarPort) throw new Error('Sidecar not running');
    const raw = await httpRequest(`http://127.0.0.1:${sidecarPort}/jobs/${jobId}`);
    return JSON.parse(raw) as CritiqueResult;
  });

  ipcMain.handle('vision:cancel', async (_event, jobId: string) => {
    if (!sidecarPort) return { ok: false };
    await httpRequest(`http://127.0.0.1:${sidecarPort}/jobs/${jobId}/cancel`, { method: 'POST' });
    return { ok: true };
  });

  app.on('before-quit', () => {
    killSidecar();
  });
}

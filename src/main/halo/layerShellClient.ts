/**
 * HALO LAYER-SHELL CLIENT
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The island used to be an Electron `BrowserWindow` — a real toplevel. Electron runs under
 * `--ozone-platform=x11` on this box, so that toplevel lives in the X11 stacking group, and every
 * NATIVE Wayland window (Firefox, VS Code) sits above it permanently. `setAlwaysOnTop` only
 * reorders siblings inside X11; it cannot reach the Wayland surface list. That is the whole reason
 * the island never appeared over other apps, and the whole reason it read as a separate window.
 *
 * A `zwlr_layer_shell` surface is not a window. The compositor places it in the shell's own layer
 * stack above every toplevel, which is why panels and status bars are immune to focus changes.
 * This client drives the native helper that owns one.
 *
 * CONTRACT WITH THE HELPER — one JSON object per line, stdin/stdout.
 *   -> {"type":"show","url":"...","x":N,"y":N,"w":N,"h":N}
 *   -> {"type":"hide"}
 *   <- {"type":"ready"}
 *
 * FAILURE IS LOUD ON PURPOSE. If the binary is missing or dies, `start()` rejects. A silent
 * fallback to a BrowserWindow would put back the exact bug this file exists to remove, and the
 * user would see a working-looking island that is still a window.
 */

import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface LayerShellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const READY_TIMEOUT_MS = 8000;

export class HaloLayerShellError extends Error {}

export class HaloLayerShellClient {
  private child: ChildProcessByStdio<Writable, Readable, null> | null = null;
  private readyPromise: Promise<void> | null = null;
  private stdoutBuffer = '';

  /* Declared as a field, not a constructor parameter property: `erasableSyntaxOnly` is enabled
   * project-wide, and parameter properties are not erasable (TS1294). */
  private readonly binaryPath: string;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
  }

  /** True when the helper was compiled. Used by the caller to report the real state, not a guess. */
  isAvailable(): boolean {
    return existsSync(this.binaryPath);
  }

  async start(): Promise<void> {
    if (this.child) return;
    if (!this.isAvailable()) {
      throw new HaloLayerShellError(
        `layer-shell helper not found at ${this.binaryPath} — build it with ` +
          `\`ninja -C native/halo-layer-shell/build\`. Without it the island is an X11 toplevel ` +
          `and cannot appear above other apps.`,
      );
    }

    const child = spawn(this.binaryPath, [], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    this.child = child;

    /* A dead helper must NEVER take the main process with it. An unhandled 'error' on a
     * ChildProcess, or an EPIPE when we write to a closed stdin, will otherwise surface as an
     * uncaught exception and kill Electron — which is a far worse failure than a missing island. */
    child.on('error', (err) => {
      this.child = null;
      console.error('[halo/layer-shell] helper process error:', err.message);
    });
    child.stdin.on('error', () => {
      /* EPIPE / closed pipe when the helper is gone. Swallowed deliberately; `child.on('error')`
       * already reported the death. */
    });

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.onStdout(chunk));

    child.on('exit', (code, signal) => {
      console.error(`[halo/layer-shell] helper exited code=${code} signal=${signal}`);
      this.child = null;
    });

    await this.waitForReady();
  }

  private waitForReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new HaloLayerShellError(
            `layer-shell helper did not report ready within ${READY_TIMEOUT_MS}ms — ` +
              `the compositor may not support zwlr_layer_shell_v1.`,
          ),
        );
      }, READY_TIMEOUT_MS);

      const finish = (): void => {
        clearTimeout(timer);
        this.offReady = null;
        resolve();
      };
      this.offReady = finish;

      if (this.gotReady) {
        this.gotReady = false;
        finish();
      }
    });

    return this.readyPromise;
  }

  private gotReady = false;
  private offReady: (() => void) | null = null;

  private onStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let nl = this.stdoutBuffer.indexOf('\n');
    while (nl !== -1) {
      const line = this.stdoutBuffer.slice(0, nl).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(nl + 1);
      if (line) {
        try {
          const msg = JSON.parse(line) as { type?: string };
          if (msg.type === 'ready' && !this.gotReady) {
            this.gotReady = true;
            this.offReady?.();
          }
        } catch {
          /* The helper writes one object per line; anything else is not ours to act on. */
        }
      }
      nl = this.stdoutBuffer.indexOf('\n');
    }
  }

  private send(msg: Record<string, unknown>): void {
    if (!this.child?.stdin.writable) {
      throw new HaloLayerShellError('layer-shell helper is not running');
    }
    this.child.stdin.write(JSON.stringify(msg) + '\n');
  }

  /** Position and show the surface. `url` is the page the helper's WebKit view loads. */
  show(url: string, rect: LayerShellRect): void {
    this.send({
      type: 'show',
      url,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.w),
      h: Math.round(rect.h),
    });
  }

  hide(): void {
    if (!this.child) return;
    try {
      this.send({ type: 'hide' });
    } catch {
      /* Already gone; `exit` will have logged it. Hiding a dead helper is not an error. */
    }
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    this.readyPromise = null;
    this.gotReady = false;
    if (!child) return;
    child.stdin.end();
    /* SIGTERM first so the helper's own cleanup runs; SIGKILL only if it ignores that. */
    child.kill('SIGTERM');
    const t = setTimeout(() => child.kill('SIGKILL'), 2000);
    child.once('exit', () => clearTimeout(t));
  }
}

/** The compiled helper, in the packaged tree and in the repo. */
export function resolveLayerShellBinary(appRoot: string): string {
  const name = process.platform === 'win32' ? 'halo-layer-shell.exe' : 'halo-layer-shell';
  return join(appRoot, 'native', 'halo-layer-shell', 'build', name);
}
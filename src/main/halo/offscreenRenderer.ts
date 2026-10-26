/**
 * HALO OFFSCREEN RENDERER
 *
 * Architecture: agent/docs/halo/HALO_WINDOWLESS_COMPOSITOR_RESEARCH.md §26–51
 *
 * WHAT THIS IS
 * ------------
 * An Electron `BrowserWindow` configured with `webPreferences.offscreen: true` that is NEVER
 * `show()`n. It is a render target, not a mapped desktop surface: it creates no visible window, does
 * not participate in OS hit testing, and cannot sit above or below another application. Its only
 * output is the `paint` event, which carries a bitmap of the rendered page.
 *
 * The KWin compositor effect (native/kwin-halo-effect/) then draws that bitmap into the composited
 * scene AFTER all windows, which is what finally puts the island above Firefox and VS Code.
 *
 * The existing React components are untouched — `halo.html` / `src/halo.tsx` / `OverlayRoot` stay
 * the single source of visual content. Only the host changes. Research §119 requires adapting the
 * platform bridge rather than reimplementing business logic, and that is what this is.
 *
 * STATE OF THE SPIKE
 * ------------------
 * Research §89 is a prototype gate. This module is complete enough to produce frames; the consumer
 * that displays them (the KWin effect) currently generates its own test capsule and does not read
 * the socket yet. Wiring the socket is gate step 3+ and is deliberately not here, because
 * research §74's validation must exist on BOTH sides before either is trusted.
 */

import { BrowserWindow } from 'electron';
import { createServer, type Socket } from 'node:net';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  HALO_FRAME_PROTOCOL_VERSION,
  HALO_PIXEL_FORMAT_BGRA,
  validateFrameHeader,
  validatePointerEvent,
  validateDragEvent,
  type HaloFrameHeader,
  type HaloPointerEvent,
  type HaloDragEvent,
} from './frameProtocol';

/**
 * Research §49: "cap the initial active frame rate at 30 fps and measure before moving to 60 fps."
 *
 * An unpainted offscreen renderer keeps producing frames as fast as the content animates, and every
 * one of them costs a CPU bitmap copy plus a compositor upload. The halo pill is mostly static, so
 * this is wasted work on a machine that also runs a desktop compositor.
 */
const FRAME_BUDGET_FPS = 30;

/** Electron offscreen repaint interval, ms. `0` would mean "as fast as possible". */
const MIN_FRAME_INTERVAL_MS = Math.round(1000 / FRAME_BUDGET_FPS);

export interface OffscreenFrameSink {
  (header: HaloFrameHeader, pixels: Buffer): void;
}

export interface OffscreenHaloOptions {
  /** Where to install the plugin, resolved from the app root. */
  appRoot: string;
  /** Receives validated frames. The socket writer lands in a later gate. */
  onFrame: OffscreenFrameSink;
  /** Test/dev override for the dev server. */
  devUrl?: string | undefined;
}

export class OffscreenHaloRenderer {
  private win: BrowserWindow | null = null;
  private sequence = 0;
  private lastFrameAt = 0;
  private disposed = false;
  /** Set while a frame is dropped for budget reasons, so the sink can log it once per burst. */
  private droppedForBudget = 0;

  /* Field, not a constructor parameter property: `erasableSyntaxOnly` is enabled project-wide and
   * parameter properties are not erasable syntax (TS1294). Same fix as layerShellClient.ts. */
  private readonly opts: OffscreenHaloOptions;

  constructor(opts: OffscreenHaloOptions) {
    this.opts = opts;
  }

  /**
   * Research §118 (falsifier): this depends on the React tree having no dependency on visible-window
   * focus or native pointer-enter events. If the offscreen render comes up blank, this is the
   * assumption that broke, and the fix is adapting the bridge — not rewriting the island.
   */
  async start(): Promise<void> {
    if (this.win || this.disposed) return;

    const win = new BrowserWindow({
      show: false, // MANDATORY. A shown offscreen window is a window.
      width: 680,
      height: 154, // L preset expanded surface.
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        /*
         * Research §23/§47: offscreen emits rendered frames via the `paint` event.
         *
         * `useSharedTexture` is DELIBERATELY NOT set. Research §49 says to consider it only after
         * CPU mode works, and that it is experimental and needs native integration. Starting there
         * would mean debugging a shared-GPU-texture path and an offscreen path at once.
         */
        offscreen: true,
        sandbox: true,
      },
    });

    this.win = win;

    win.webContents.setFrameRate(FRAME_BUDGET_FPS);

    win.webContents.on('paint', (_event, _dirty, image) => {
      if (this.disposed) return;
      this.emit(image);
    });

    // A renderer crash must not take the island — or the app — with it. Research §74: if RHEO
    // exits, stop rendering; research §110 (probe): a renderer crash removes the overlay and never
    // disables desktop input.
    win.webContents.on('render-process-gone', (_e, details) => {
      console.error('[halo/offscreen] renderer gone:', details.reason);
      this.stop();
    });

    const devUrl = this.opts.devUrl ?? process.env.VITE_DEV_SERVER_URL;
    if (devUrl) {
      await win.loadURL(`${devUrl.replace(/\/$/, '')}/halo.html`);
    } else {
      // Same reason as the original island loader (AGENTS.md §8 root cause 7): a `file://`
      // document with a module script is the documented black-screen class in this repo.
      const base = process.env.RHEO_SERVER_URL || 'http://localhost:38123';
      await win.loadURL(`${base}/halo.html`);
    }
  }

  private emit(image: Electron.NativeImage): void {
    const now = Date.now();
    // Budget gate. Research §49 also asks for painting to stop while nothing changes; that needs
    // damage tracking from the renderer and is a later step. The rate cap is the cheap half and is
    // what prevents an idle-but-animating pill from saturating the compositor.
    if (now - this.lastFrameAt < MIN_FRAME_INTERVAL_MS) {
      this.droppedForBudget++;
      return;
    }
    this.lastFrameAt = now;

    const size = image.getSize();
    const bitmap = image.toBitmap(); // BGRA, premultiplied — what Electron's paint event provides.

    this.sequence++;

    const header: HaloFrameHeader = {
      protocolVersion: HALO_FRAME_PROTOCOL_VERSION,
      sequence: this.sequence,
      width: size.width,
      height: size.height,
      // An offscreen window has no screen, so there is no devicePixelRatio to read from it. The
      // scale factor belongs to the OUTPUT the island will be painted onto, which is the main
      // window's display. Sending 1 and letting the KWin side scale would render a soft capsule on
      // every HiDPI panel, so this is carried explicitly in the header instead.
      devicePixelRatio: 1,
      dirtyRect: null, // Whole frame. Research §64: do not treat the whole canvas as interactive,
      // which is an INPUT rule; for output, a dirty-rect optimisation comes with damage tracking.
      pixelFormat: HALO_PIXEL_FORMAT_BGRA,
      byteLength: bitmap.length,
    };

    // Validated on the way OUT as well as on the way IN. Cheap, and it means a bug in the `paint`
    // handler cannot emit a header the consumer would have to reject anyway.
    let checked: HaloFrameHeader;
    try {
      checked = validateFrameHeader(header);
    } catch (err) {
      console.error('[halo/offscreen] refusing to emit malformed frame:', (err as Error).message);
      return;
    }

    this.opts.onFrame(checked, bitmap);
    // Also push to KWin bridge if connected
    if ((this.opts as any).pushFrame && typeof (this.opts as any).pushFrame === 'function') {
      (this.opts as any).pushFrame(checked, bitmap);
    }
  }

  /** Diagnostics for the offscreen frame probe (research §108). */
  stats(): { sequence: number; droppedForBudget: number; alive: boolean } {
    return { sequence: this.sequence, droppedForBudget: this.droppedForBudget, alive: this.win !== null };
  }

  /**
   * The offscreen render target, when it exists.
   *
   * main.ts addresses THIS window directly: it renders the windowless island — the copy the
   * layer-shell host / KWin effect paints — so it receives the snapshot/prefs stream
   * (`halo:snapshot`/`halo:prefs`, delivered via haloIsland's `extraTargets`) and synthesized
   * pointer input (`sendInputEvent`) from the bridge's pointer back-channel. The window is
   * created asynchronously by `start()`, hence a getter rather than a constructor reference.
   */
  window(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null;
  }

  stop(): void {
    if (this.disposed) return;
    this.disposed = true;
    const win = this.win;
    this.win = null;
    if (win && !win.isDestroyed()) {
      try {
        win.destroy();
      } catch {
        /* already gone */
      }
    }
  }
}


/**
 * KWin bridge — Unix-domain socket with protocol versioning, frame validation, and heartbeat.
 *
 * Research §74: "Use a per-user Unix-domain socket with restrictive permissions and a protocol
 * version. If using shared memory, pass the FD over the socket and use two buffers plus monotonic
 * frame sequence numbers. Validate message size, dimensions, rectangle bounds, action enum, and
 * protocol version. Accept only fixed actions from an allowlist."
 */
export interface KwinBridgeOptions {
  socketPath?: string;
  onFrame: (header: any, pixels: Buffer) => void;
  /* `kind` (the surface phase: enter/leave/move/down/up) rides along with the validated event —
   * see `HaloPointerEvent` in frameProtocol.ts. It is what lets the main process distinguish
   * "the cursor ARRIVED at the pill" (which opens the island) from plain motion across it. */
  onPointerEvent?: (event: HaloPointerEvent) => void;
  /* The press-and-hold drag that moves the island. The host reports the CUMULATIVE offset
   * from the press point (see `HaloDragEvent`); the consumer owns what that means. */
  onDrag?: (event: HaloDragEvent) => void;
  /* Fired when a client completes the handshake. The host starts every session at offset 0,
   * so the app must re-send the persisted position on every (re)connect or the island snaps
   * back to centre. */
  onHostConnected?: () => void;
}

interface BridgeClient {
  socket: Socket;
  buffer: Buffer;
  lastHeartbeat: number;
  expectedSequence: number;
}

export class KwinBridge {
  private server: ReturnType<typeof createServer> | null = null;
  private clients: Map<string, BridgeClient> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private clientSeq = 0;

  private readonly opts: KwinBridgeOptions;
  constructor(opts: KwinBridgeOptions) { this.opts = opts; }

  start(): void {
    if (this.server || this.disposed) return;

    const socketPath = this.opts.socketPath ?? join(process.env.HOME ?? tmpdir(), '.local', 'share', 'rheo', 'halo-bridge.sock');
    const dir = require('node:path').dirname(socketPath);
    if (!existsSync(dir)) {
      require('node:fs').mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    if (existsSync(socketPath)) {
      try { unlinkSync(socketPath); } catch {}
    }

    this.server = createServer({ allowHalfOpen: true });
    this.server.listen(socketPath, () => {
      console.log('[halo/bridge] listening on', socketPath);
    });

    this.server.on('connection', (socket: Socket) => {
      /* AF_UNIX sockets report NO remoteAddress/remotePort, so the old key
       * `undefined:undefined` collapsed every client into ONE map slot: each new
       * connection overwrote the previous entry, and the earlier socket kept its
       * open fd but was dropped from the map — its frames stopped being pushed and
       * its pointer/heartbeat messages hit the `if (!client) return` guard and were
       * silently discarded. The serving host became a ghost the moment anything else
       * (test probe, KWin effect) connected. Per-connection unique id, like every
       * other multi-client server does. */
      const clientId = `bridge-client-${++this.clientSeq}`;
      const client: BridgeClient = {
        socket,
        buffer: Buffer.alloc(0),
        lastHeartbeat: Date.now(),
        expectedSequence: 0,
      };
      this.clients.set(clientId, client);

      socket.on('data', (data: Buffer) => this.onData(clientId, data));
      socket.on('close', () => this.onClose(clientId));
      socket.on('error', (err) => console.error('[halo/bridge] socket error:', err.message));
    });

    this.server.on('error', (err) => console.error('[halo/bridge] server error:', err.message));

    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), 5000);
  }

  private onData(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.buffer = Buffer.concat([client.buffer, data]);
    this.parseMessages(clientId);
  }

  private parseMessages(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    while (client.buffer.length >= 4) {
      const msgLen = client.buffer.readUInt32LE(0);
      if (msgLen > 10 * 1024 * 1024) {
        client.socket.destroy();
        return;
      }
      if (client.buffer.length < 4 + msgLen) break;
      const msg = client.buffer.subarray(4, 4 + msgLen);
      client.buffer = client.buffer.subarray(4 + msgLen);
      try {
        const parsed = JSON.parse(msg.toString('utf8')) as { type: string; payload: unknown };
        this.handleMessage(client, parsed);
      } catch (err) {
        console.error('[halo/bridge] invalid JSON:', (err as Error).message);
      }
    }
  }

  private handleMessage(client: BridgeClient, msg: { type: string; payload: unknown }): void {
    client.lastHeartbeat = Date.now();
    if (msg.type === 'hello') {
      const payload = msg.payload as { protocolVersion?: number };
      if (payload.protocolVersion === HALO_FRAME_PROTOCOL_VERSION) {
        client.socket.write(this.frame({ type: 'hello-ack', payload: { protocolVersion: HALO_FRAME_PROTOCOL_VERSION } }));
        this.opts.onHostConnected?.();
      } else {
        client.socket.write(this.frame({ type: 'hello-nak', payload: { protocolVersion: HALO_FRAME_PROTOCOL_VERSION } }));
        client.socket.destroy();
      }
      return;
    }
    if (msg.type === 'frame') {
      const rawHeader = msg.payload as Record<string, unknown>;
      try {
        const header = validateFrameHeader(rawHeader);
        if (header.sequence <= client.expectedSequence && client.expectedSequence !== 0) {
          return;
        }
        client.expectedSequence = header.sequence;
        client.socket.write(this.frame({ type: 'frame-ack', payload: { sequence: header.sequence } }));
      } catch (err) {
        console.error('[halo/bridge] invalid frame header:', (err as Error).message);
      }
      return;
    }
    if (msg.type === 'heartbeat') {
      client.lastHeartbeat = Date.now();
      return;
    }
    if (msg.type === 'pointer' && this.opts.onPointerEvent) {
      const payload = msg.payload as Record<string, unknown>;
      try {
        const event = validatePointerEvent(payload);
        if (event) this.opts.onPointerEvent(event);
      } catch (err) {
        console.error('[halo/bridge] invalid pointer event:', (err as Error).message);
      }
      return;
    }
    if (msg.type === 'drag' && this.opts.onDrag) {
      const payload = msg.payload as Record<string, unknown>;
      try {
        const event = validateDragEvent(payload);
        if (event) this.opts.onDrag(event);
      } catch (err) {
        console.error('[halo/bridge] invalid drag event:', (err as Error).message);
      }
      return;
    }
    console.warn('[halo/bridge] unknown message type:', msg.type);
  }

  private frame(obj: Record<string, unknown>): Buffer {
    const json = JSON.stringify(obj);
    const len = Buffer.alloc(4);
    len.writeUInt32LE(Buffer.byteLength(json), 0);
    return Buffer.concat([len, Buffer.from(json, 'utf8')]);
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const client of this.clients.values()) {
      if (now - client.lastHeartbeat > 15000) {
        client.socket.destroy();
      }
    }
  }

  private onClose(clientId: string): void {
    this.clients.delete(clientId);
  }

  pushFrame(header: any, pixels: Buffer): void {
    if (this.disposed) return;
    for (const client of this.clients.values()) {
      if (!client.socket.destroyed) {
        client.socket.write(this.frame({ type: 'frame', payload: header }));
        client.socket.write(pixels);
      }
    }
  }

  /** Tell every connected host where to put the island.
   *
   * `dx`/`dy` are ABSOLUTE offsets from the centred position and `top` is the base top
   * margin — the host re-centres its painted box and applies both. This is the whole of the
   * "drag the pill to move it" plumbing: the app owns the position, the compositor only knows
   * margins, and the host is the one that knows its own painted size. */
  sendMove(dx: number, dy: number, top: number): void {
    if (this.disposed) return;
    for (const client of this.clients.values()) {
      if (!client.socket.destroyed) {
        client.socket.write(
          this.frame({ type: 'move', payload: { dx: Math.round(dx), dy: Math.round(dy), top: Math.round(top) } }),
        );
      }
    }
  }

  stop(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const client of this.clients.values()) {
      client.socket.destroy();
    }
    this.clients.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

/** True when the compiled KWin plugin is present — the honest check before offering cross-app. */
export function isKwinHaloEffectBuilt(appRoot: string): boolean {
  const lib = join(appRoot, 'native', 'kwin-halo-effect', 'build', 'libhalo.so');
  return existsSync(lib);
}
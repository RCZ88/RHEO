/**
 * HALO OFFSCREEN FRAME PROTOCOL
 *
 * Architecture: agent/docs/halo/HALO_WINDOWLESS_COMPOSITOR_RESEARCH.md
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The island could not appear over other apps because it was an Electron `BrowserWindow`. Electron
 * runs under `--ozone-platform=x11` on this machine, so its toplevel lives in the X11 stacking
 * group and every native Wayland window sits above it permanently. `setAlwaysOnTop()` is
 * documented as unsupported on the Wayland backend.
 *
 * The fix is to render the island OFFSCREEN — a `BrowserWindow` with `webPreferences.offscreen`
 * that is never `show()`n, so it never maps a desktop surface — and let the KWin compositor effect
 * paint the frames into the composited scene. No app-owned window exists at any point.
 *
 * WHAT THIS IS NOT YET
 * --------------------
 * Research §89 is a prototype gate: prove a solid capsule is painted after the normal scene
 * (step 1) before porting anything. The KWin side of step 1 generates its own capsule and does not
 * read these frames yet. This module is the RHEO side of the frame channel, built now because the
 * validation rules it encodes cannot be retrofitted safely later.
 *
 * THE VALIDATION IS THE POINT
 * ---------------------------
 * Research §74: "Validate message size, dimensions, rectangle bounds, action enum, and protocol
 * version. Accept only fixed actions from an allowlist; the KWin plugin must not accept arbitrary
 * commands, file paths, URLs, or renderer-supplied IPC channel names."
 *
 * This is a same-user socket read by code running INSIDE THE COMPOSITOR (research §24: a crash
 * there takes the desktop with it). So every field that arrives from another process is treated as
 * hostile, even though the only legitimate sender is RHEO. A malformed `width` is not a nuisance
 * error, it is a heap corruption vector in kwin.
 *
 * Pixels are never serialised into JSON. Frames move as raw shared memory / file descriptors over
 * the socket; only the small header travels as JSON.
 */

export const HALO_FRAME_PROTOCOL_VERSION = 1;

/** Frame payload formats, as the `paint` event reports them. */
export const HALO_PIXEL_FORMAT_RGBA = 0;
export const HALO_PIXEL_FORMAT_BGRA = 1;

export type HaloPixelFormat = typeof HALO_PIXEL_FORMAT_RGBA | typeof HALO_PIXEL_FORMAT_BGRA;

/**
 * Hard bounds on anything arriving from the socket.
 *
 * These are NOT arbitrary. The largest preset is L at 680x154 (research §64 references the
 * canvas sizes), and `devicePixelFactor` can be 2 or 3 on a HiDPI panel, so 680x3 x 154x3 is the
 * true worst case. `MAX_FRAME_BYTES` is that surface at 4 bytes per pixel, which is what a naive
 * read of a corrupt length field would try to allocate.
 */
export const HALO_MAX_FRAME_WIDTH = 680 * 3;
export const HALO_MAX_FRAME_HEIGHT = 154 * 3;
export const HALO_MAX_FRAME_BYTES = HALO_MAX_FRAME_WIDTH * HALO_MAX_FRAME_HEIGHT * 4;

/** Never trust a dirty rect from another process; clamp to the frame it belongs to. */
export const HALO_MAX_DIRTY_RECT = 64;

/**
 * Actions the KWin effect is permitted to forward to the renderer.
 *
 * Research §74 requires an allowlist and forbids arbitrary IPC channel names. An enum encoded as
 * integers is used rather than strings because a string channel name from another process would
 * let that process name any preload bridge method it liked. An integer outside this set is
 * rejected outright.
 */
export const HALO_ALLOWED_ACTIONS = {
  none: 0,
  pillPrimary: 1,
  pillOpen: 2,
  pillClose: 3,
  railSelect: 4,
  rowClick: 5,
} as const;

export type HaloActionName = keyof typeof HALO_ALLOWED_ACTIONS;
export const HALO_ALLOWED_ACTION_VALUES: readonly number[] = Object.values(HALO_ALLOWED_ACTIONS);

export interface HaloFrameHeader {
  protocolVersion: number;
  /** Monotonic. Strictly increasing per producer; the consumer drops anything not newer. */
  sequence: number;
  width: number;
  height: number;
  devicePixelRatio: number;
  /** `[x, y, w, h]` in frame-local pixels. Empty/null means "whole frame". */
  dirtyRect: [number, number, number, number] | null;
  pixelFormat: HaloPixelFormat;
  /** Byte length of the pixel buffer accompanying this header. Validated against the above. */
  byteLength: number;
}

export class HaloFrameValidationError extends Error {}

function fail(reason: string): never {
  throw new HaloFrameValidationError(reason);
}

/**
 * Validates an untrusted header. Throws `HaloFrameValidationError` with the specific reason.
 *
 * This is deliberately a pure function with no I/O so it can be fuzzed directly. The consumer in
 * the KWin effect runs inside the compositor, so "reject and continue" has to be the only failure
 * behaviour available — there is no caller to return an error to.
 */
export function validateFrameHeader(raw: unknown): HaloFrameHeader {
  // `typeof [] === 'object'`, so an array reaches the member reads and fails on
  // `protocolVersion === undefined` instead of on the type. It was still rejected, but by
  // accident rather than by the check that is supposed to catch it, and a JSON peer can send
  // `[...]` as easily as `{...}`. Arrays are rejected explicitly.
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('header is not an object');
  }

  const h = raw as Record<string, unknown>;

  // Numeric coercion is NOT used. `width: "680"` from another process is a type confusion, not a
  // convenience, and `Number("...")` happily yields NaN which then flows into a buffer size.
  const requireInt = (key: string, value: unknown, min: number, max: number): number => {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      fail(`${key} must be an integer, got ${typeof value}`);
    }
    if (value < min || value > max) fail(`${key} out of range: ${value} not in [${min}, ${max}]`);
    return value;
  };

  /*
   * Version is range-checked against a wide sanity band FIRST, then compared, so that a NEWER
   * producer reports "unsupported" rather than the misleading "out of range". The ordering matters
   * for diagnosis, not safety — both reject.
   *
   * Fail closed on a mismatch rather than attempting a partial parse: a newer producer may have
   * added fields this validator does not understand, and guessing is how a compositor segfaults.
   */
  const protocolVersion = requireInt('protocolVersion', h.protocolVersion, 1, 0xff);
  if (protocolVersion !== HALO_FRAME_PROTOCOL_VERSION) {
    fail(`unsupported protocolVersion ${protocolVersion}, this build speaks ${HALO_FRAME_PROTOCOL_VERSION}`);
  }

  const sequence = requireInt('sequence', h.sequence, 0, Number.MAX_SAFE_INTEGER);
  const width = requireInt('width', h.width, 1, HALO_MAX_FRAME_WIDTH);
  const height = requireInt('height', h.height, 1, HALO_MAX_FRAME_HEIGHT);
  const devicePixelRatio = requireInt('devicePixelRatio', h.devicePixelRatio, 1, 4);
  const byteLength = requireInt('byteLength', h.byteLength, 1, HALO_MAX_FRAME_BYTES);

  if (byteLength !== width * height * 4) {
    // Not a range error: an inconsistency between declared size and declared payload. Either the
    // producer is buggy or this is malformed, and both must not reach a buffer allocation.
    fail(`byteLength ${byteLength} != width*height*4 (${width * height * 4})`);
  }

  const pixelFormat = h.pixelFormat;
  if (pixelFormat !== HALO_PIXEL_FORMAT_RGBA && pixelFormat !== HALO_PIXEL_FORMAT_BGRA) {
    fail(`unknown pixelFormat ${String(pixelFormat)}`);
  }

  let dirtyRect: [number, number, number, number] | null = null;
  if (h.dirtyRect !== null && h.dirtyRect !== undefined) {
    const r = h.dirtyRect;
    if (!Array.isArray(r) || r.length !== 4) fail('dirtyRect must be null or a 4-element array');
    const [x, y, w, hh] = r as unknown[];
    const rectW = requireInt('dirtyRect.w', w, 0, HALO_MAX_DIRTY_RECT * 4);
    const rectH = requireInt('dirtyRect.h', hh, 0, HALO_MAX_DIRTY_RECT * 4);
    const rectX = requireInt('dirtyRect.x', x, 0, width);
    const rectY = requireInt('dirtyRect.y', y, 0, height);
    // A partially-off-frame rect would read past the buffer it claims to describe.
    if (rectX + rectW > width || rectY + rectH > height) fail('dirtyRect exceeds frame bounds');
    dirtyRect = [rectX, rectY, rectW, rectH];
  }

  return { protocolVersion, sequence, width, height, devicePixelRatio, dirtyRect, pixelFormat, byteLength };
}

/** Research §69: "Do not consume press or only release; preserve event pairs and modifiers."
 *
 * `kind` is the SURFACE-LEVEL phase, and it is not derivable from any other field: `enter`,
 * `leave` and `move` are all "not pressed". Without it a consumer cannot tell that the cursor
 * has just ARRIVED at the pill — which is the island's whole open interaction — from a plain
 * movement across it. The layer-shell host distinguishes these at the surface level, so the
 * field is carried end-to-end. Optional (null when absent) so a producer that predates it
 * stays valid. */
export const HALO_POINTER_KINDS = ['enter', 'leave', 'move', 'down', 'up'] as const;
export type HaloPointerKind = (typeof HALO_POINTER_KINDS)[number];

export interface HaloPointerEvent {
  action: HaloActionName | 'none';
  /** Surface-level pointer phase; null when the producer predates the field. */
  kind: HaloPointerKind | null;
  /** Logical screen coordinates, validated against the current output geometry by the consumer. */
  x: number;
  y: number;
  button: number;
  pressed: boolean;
  modifiers: number;
}

export function validatePointerEvent(raw: unknown): HaloPointerEvent | null {
  if (raw === null || typeof raw !== 'object') fail('pointer event is not an object');
  const e = raw as Record<string, unknown>;

  const actionNum = e.action;
  if (typeof actionNum !== 'number' || !Number.isInteger(actionNum)) fail('action must be an integer');
  if (!HALO_ALLOWED_ACTION_VALUES.includes(actionNum)) {
    // The allowlist check. A value outside it means the sender is trying to name a bridge method
    // that does not exist, which is precisely the attack research §74 names.
    fail(`action ${actionNum} is not in the allowlist`);
  }
  const action = (Object.keys(HALO_ALLOWED_ACTIONS) as HaloActionName[]).find(
    (k) => HALO_ALLOWED_ACTIONS[k] === actionNum,
  )!;

  const num = (key: string, min: number, max: number): number => {
    const v = e[key];
    if (typeof v !== 'number' || !Number.isInteger(v)) fail(`${key} must be an integer`);
    if (v < min || v > max) fail(`${key} out of range`);
    return v;
  };

  let kind: HaloPointerKind | null = null;
  if (e.kind !== undefined && e.kind !== null) {
    if (typeof e.kind !== 'string' || !(HALO_POINTER_KINDS as readonly string[]).includes(e.kind)) {
      // Present-but-unknown is a type confusion, not an older producer: reject it the same way
      // an unknown action is rejected, rather than guessing a phase.
      fail(`kind ${String(e.kind)} is not an allowed pointer kind`);
    }
    kind = e.kind as HaloPointerKind;
  }

  return {
    action,
    kind,
    x: num('x', -32768, 32767),
    y: num('y', -32768, 32767),
    button: num('button', 0, 7),
    pressed: e.pressed === true,
    modifiers: num('modifiers', 0, 0xffff),
  };
}

/**
 * Research §74: "two buffers plus monotonic frame sequence numbers... render the latest frame
 * rather than queuing frames."
 *
 * A queue is the failure mode this exists to prevent. If frame production outruns consumption the
 * queue grows without bound inside the compositor's memory and the desktop eventually stalls. The
 * newest frame always supersedes anything older.
 */
export function shouldAcceptFrame(lastAccepted: number, incoming: number): boolean {
  return Number.isInteger(incoming) && incoming > lastAccepted;
}
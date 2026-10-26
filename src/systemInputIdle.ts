/**
 * DEVICE-WIDE INPUT CLOCK (Linux) — the only honest AFK signal on this machine.
 *
 * WHY THIS EXISTS
 * `powerMonitor.getSystemIdleTime()` returns 0 forever under Linux/Electron, so
 * every idle-driven feature has been guessing. The app tried to guess from
 * window focus, foreground-window changes and title churn, and the daemon
 * guessed from "has the foreground app changed". Both guesses share the same
 * fatal blind spot: they measure whether you are looking at RHEO / switching
 * windows, NOT whether you are touching the machine. So working in one window
 * for ten minutes read as AFK, and coming back required a click on RHEO before
 * tracking resumed.
 *
 * WHAT IT DOES
 * Reads the kernel's evdev devices (`/dev/input/event*`), which see every
 * keystroke, pointer move, click, wheel tick and touch — regardless of which
 * app, window, or compositor has focus. It keeps exactly ONE number: the
 * timestamp of the last human input. No key codes, no text, no device names,
 * no history are stored or transmitted.
 *
 * WHY POLLED, NOT STREAMS
 * An evdev file blocks until the next event. `fs.createReadStream` would park a
 * libuv threadpool thread per device, and with ~20 devices on a desktop that
 * deadlocks the 4-thread pool the whole process shares. Instead each fd is
 * opened O_NONBLOCK and drained with a cheap readSync on an interval; EAGAIN
 * means "no input", which is the normal case. ~20 read syscalls every 500 ms is
 * negligible, and the worst-case return latency is half a second against a
 * five-minute AFK threshold.
 *
 * FALLBACK
 * `getSystemInputIdleMs()` returns `null` when no device could be opened (the
 * user is not in the `input` group, non-Linux, tests). Callers must then fall
 * back to their previous clock. Returning `0` instead would silently claim the
 * user is present forever.
 */

import * as fs from 'node:fs';

/** struct input_event on x86_64: timeval(16) + type(2) + code(2) + value(4). */
const EVENT_SIZE = 24;
const EV_KEY = 1;
const EV_REL = 2;
const EV_ABS = 3;

const READ_BUFFER_SIZE = EVENT_SIZE * 64;
const DRAIN_INTERVAL_MS = 500;
const RESCAN_INTERVAL_MS = 30_000;

interface Device {
  fd: number;
  path: string;
}

const devices = new Map<string, Device>();
const readBuffer = Buffer.alloc(READ_BUFFER_SIZE);

let lastInputAt = Date.now();
let available = false;
let started = false;
let drainTimer: NodeJS.Timeout | null = null;
let rescanTimer: NodeJS.Timeout | null = null;
let lastScanAt = 0;
let openedDeviceCount = 0;

/**
 * Is this event a human interaction?
 *
 * EV_KEY value 0 is a release (useful, but the press/repeat already counted);
 * value 1 is a press and 2 is autorepeat. EV_REL carries mouse movement, wheel
 * and horizontal scroll. EV_ABS covers touchscreens, pens and gamepad sticks.
 * Everything else (EV_SYN, EV_MSC, EV_LED, EV_SND, EV_REP, EV_SW, EV_PWR) is
 * either noise or not input at all.
 */
function isHumanInput(type: number, _code: number, value: number): boolean {
  if (type === EV_KEY) return value === 1 || value === 2;
  if (type === EV_REL) return value !== 0;
  if (type === EV_ABS) return true;
  return false;
}

function closeDevice(name: string): void {
  const dev = devices.get(name);
  if (!dev) return;
  devices.delete(name);
  try { fs.closeSync(dev.fd); } catch { /* already gone */ }
}

/**
 * Open every readable /dev/input/event*. Unreadable devices are normal (some
 * are root-only); they are skipped without noise. Rescans pick up hotplugged
 * keyboards/mice without a restart.
 */
function scanDevices(): void {
  lastScanAt = Date.now();
  let names: string[] = [];
  try {
    names = fs.readdirSync('/dev/input').filter((n) => /^event\d+$/.test(n));
  } catch {
    return;
  }

  for (const name of names) {
    if (devices.has(name)) continue;
    const devicePath = `/dev/input/${name}`;
    try {
      const fd = fs.openSync(devicePath, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
      devices.set(name, { fd, path: devicePath });
    } catch {
      // EACCES for devices outside our groups; ENODEV for races. Both are fine.
    }
  }

  // Drop devices that were unplugged. Without this a stale fd stays in the map
  // forever and the rescan never retries that name if it returns.
  for (const name of Array.from(devices.keys())) {
    if (!names.includes(name)) closeDevice(name);
  }

  openedDeviceCount = devices.size;
  available = openedDeviceCount > 0;
}

/** Drain every device until EAGAIN. A human event updates the one timestamp. */
function drainDevices(): void {
  for (const [name, dev] of Array.from(devices)) {
    for (;;) {
      let bytes = 0;
      try {
        bytes = fs.readSync(dev.fd, readBuffer, 0, READ_BUFFER_SIZE, null);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EAGAIN' || code === 'EWOULDBLOCK') break;
        // ENODEV/EBADF: the device disappeared or was closed under us.
        closeDevice(name);
        break;
      }
      if (bytes <= 0) break;

      const now = Date.now();
      for (let offset = 0; offset + EVENT_SIZE <= bytes; offset += EVENT_SIZE) {
        const type = readBuffer.readUInt16LE(offset + 16);
        const code = readBuffer.readUInt16LE(offset + 18);
        const value = readBuffer.readInt32LE(offset + 20);
        if (isHumanInput(type, code, value)) lastInputAt = now;
      }

      // A short read means the queue is empty; a full buffer may have more.
      if (bytes < READ_BUFFER_SIZE) break;
    }
  }
  available = devices.size > 0;
}

/**
 * Begin watching. Idempotent. Returns a small diagnostic object so the boot log
 * can say whether the clock is real or whether callers are on the fallback.
 */
export function startSystemInputWatcher(): { available: boolean; devices: number } {
  if (started) return { available, devices: openedDeviceCount };
  started = true;
  lastInputAt = Date.now();
  scanDevices();

  drainTimer = setInterval(drainDevices, DRAIN_INTERVAL_MS);
  drainTimer.unref?.();
  rescanTimer = setInterval(() => scanDevices(), RESCAN_INTERVAL_MS);
  rescanTimer.unref?.();

  return { available, devices: openedDeviceCount };
}

export function stopSystemInputWatcher(): void {
  if (drainTimer) clearInterval(drainTimer);
  if (rescanTimer) clearInterval(rescanTimer);
  drainTimer = null;
  rescanTimer = null;
  for (const name of Array.from(devices.keys())) closeDevice(name);
  available = false;
  started = false;
}

/**
 * Milliseconds since the last human input on ANY device, or `null` when the
 * kernel devices are not readable and the caller must use its fallback.
 */
export function getSystemInputIdleMs(): number | null {
  if (!available) return null;
  return Math.max(0, Date.now() - lastInputAt);
}

/** Epoch ms of the last human input, or null when unavailable. */
export function getLastSystemInputAt(): number | null {
  return available ? lastInputAt : null;
}

export function isSystemInputWatcherAvailable(): boolean {
  return available;
}

/** Diagnostics for the tracker heartbeat / Settings, no privacy-sensitive data. */
export function getSystemInputWatcherStatus(): {
  available: boolean;
  devices: number;
  lastInputAgeMs: number | null;
  lastScanAt: number;
} {
  return {
    available,
    devices: openedDeviceCount,
    lastInputAgeMs: available ? Math.max(0, Date.now() - lastInputAt) : null,
    lastScanAt,
  };
}

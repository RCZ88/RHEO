/**
 * Stopwatch → island relay contract.
 *
 * WHY A RELAY EXISTS AT ALL
 * -------------------------
 * `src/lib/stopwatchStore.ts` is a RENDERER-REALM SINGLETON persisted to
 * `localStorage['rheo-stopwatch-v1']`. The Halo Island is a SECOND BrowserWindow,
 * i.e. a second JavaScript realm with its own module instance and its own
 * storage partition. If the island imported the store it would hydrate a
 * competing copy and overwrite the real window's totals on its next debounced
 * write — two clocks fighting over one key.
 *
 * So the main renderer is the only writer, and it publishes an immutable snapshot
 * over IPC. Main caches it and hands it to the island. One writer, one value,
 * one formatter (`formatStopwatch`) — the invariant that stops the sidebar and the
 * island disagreeing.
 *
 * This module lives in `src/shared/` because `scripts/build.mjs` pre-compiles
 * shared code for the main process while the renderer reaches it through the `@`
 * alias, so BOTH sides validate against the same definition.
 */

import type { StopwatchPayload } from './types';

/** Upper bound accepted for any single field, to reject a malformed publish. */
const MAX_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_LABEL = 120;

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_MS
    ? Math.round(value)
    : fallback;
}

function tier(value: unknown): StopwatchPayload['tier'] {
  return value === 'productive' || value === 'neutral' || value === 'distracting' ? value : 'neutral';
}

function source(value: unknown): StopwatchPayload['displaySource'] {
  return value === 'external' || value === 'productive' || value === 'distracting' || value === 'idle'
    ? value
    : 'idle';
}

/**
 * HALO §43: main validates every payload. A renderer is not authoritative, and
 * an unvalidated snapshot would let a malformed publish render `NaN:NaN` on the
 * surface. Returns null when the payload cannot be trusted.
 */
export function validateStopwatchPayload(raw: unknown): StopwatchPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const displayMs = num(r.displayMs, 0);
  const productiveMs = num(r.productiveMs, 0);
  const distractingMs = num(r.distractingMs, 0);

  return {
    displayMs,
    productiveMs,
    distractingMs,
    tier: tier(r.tier),
    displaySource: source(r.displaySource),
    paused: r.paused === true,
    resetCount: num(r.resetCount, 0),
    externalLabel:
      typeof r.externalLabel === 'string' && r.externalLabel.length > 0
        ? r.externalLabel.slice(0, MAX_LABEL)
        : null,
  };
}

export const STOPWATCH_PUBLISH_CHANNEL = 'stopwatch:publish';
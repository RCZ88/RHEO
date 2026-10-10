/**
 * HALO ISLAND — domain model.
 *
 * Layering rule from HALO_ISLAND.md §1: the main process owns display geometry,
 * the activity router, hover policy and platform capabilities; the renderer only
 * draws. Every type here is therefore plain data with no Electron import, so the
 * same module can be imported by the main process, by the overlay renderer, and by
 * a headless probe.
 */

export type IslandPhase =
  | 'hidden'
  | 'compact'
  | 'opening'
  | 'expanded'
  | 'closing';

export type InteractionMode =
  | 'passive'
  | 'hover'
  | 'interactive'
  | 'pinned';

/**
 * HALO §127 is EXPLICIT here: `"top" | "left" | "right"`, and the same section ends with
 * "Do not introduce arbitrary freeform positioning in the core model." A `bottom` edge and
 * per-axis pixel offsets were both added here and then removed — they are not a judgement
 * call about whether they are useful, they are named prohibitions. `Anchor` and freeform
 * offsets live outside this type for the same reason.
 *
 * What the user actually wanted from "make the location customizable" is already in this
 * union: three positions. The real defect was that the renderer hardcoded `data-edge="top"`
 * and painted at `top: 0; left: 50%`, so choosing left or right moved the window and changed
 * nothing visible.
 */
export type OverlayEdge = 'top' | 'left' | 'right';

/**
 * DIP (device-independent pixel) is Electron's display-space unit. HALO §29
 * forbids silently mixing DIP with physical pixels, AppKit points or CSS px, so
 * every geometry field below is DIP and the renderer is the only place a
 * conversion to CSS px may happen.
 */
import type { HaloSize, FittedSize } from './sizes';

export type Dip = number;

export interface Point {
  x: Dip;
  y: Dip;
}

export interface Rect {
  x: Dip;
  y: Dip;
  width: Dip;
  height: Dip;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Activity kinds. The first block is RHEO's own vocabulary; the second block is
 * the generic kinds HALO §4 defines, kept so a future port does not have to
 * re-invent the envelope.
 */
export type ActivityKind =
  // ── RHEO ────────────────────────────────────────────────────────────────
  | 'stopwatch'
  | 'dictation'
  | 'focus'
  | 'afkGap'
  | 'now'
  | 'tierBreakdown'
  | 'nextDeadline'
  | 'pinnedActivity'
  | 'clock'
  /* HALO spec section 6 compact kinds (HALO_STATES.html board 1). */
  | 'website'
  | 'private'
  | 'stopwatchSite'
  // ── generic HALO §4 ─────────────────────────────────────────────────────
  | 'liveActivity'
  | 'hud'
  | 'critical'
  | 'download'
  | 'battery'
  | 'aiUsage'
  | 'clipboard'
  | 'custom';

/**
 * Stopwatch snapshot, mirrored from `src/lib/stopwatchStore.ts` StopwatchSnapshot.
 *
 * `displayMs` is the single number every surface shows and `displaySource` says
 * which bucket it came from — reproducing that contract is what stops the island
 * and the dashboard from becoming two clocks wearing the same label.
 *
 * `resetCount` is included because the totals are NOT monotonic: a tier flip with
 * neutralAction:'reset', an AFK reset, or a day rollover can zero both buckets.
 * A consumer that animates between values needs to know a real reset happened.
 */
export interface StopwatchPayload {
  displayMs: number;
  productiveMs: number;
  distractingMs: number;
  tier: 'productive' | 'neutral' | 'distracting';
  displaySource: 'external' | 'productive' | 'distracting' | 'idle';
  paused: boolean;
  resetCount: number;
  externalLabel: string | null;
}

export interface DictationPayload {
  state: 'idle' | 'requesting' | 'recording' | 'processing' | 'error';
  level: number;
  elapsedMs: number;
  /** Empty on the faster-whisper path — transcription is batch-on-stop. */
  interim: string;
  transcript: string;
  engineLabel: string;
  engineMissing: boolean;
  /** The failure reason, so the surface can tell "mic blocked" from any other error. */
  error?: string;
}

export interface FocusPayload {
  active: boolean;
  endsAt: number | null;
  durationSec: number;
  strictness: 'distracting' | 'non_allowed';
  allowedApps: string[];
  outcome: string | null;
}

export interface NowPayload {
  app: string;
  category: string;
  tier: 'productive' | 'neutral' | 'distracting';
  /**
   * The site the user is on. THREE states, and the distinction is load-bearing:
   *   a domain string - a browser is focused on that site
   *   `null`           - a browser IS focused but the site is unknown (extension late, stale
   *                      heartbeat, or the window is PRIVATE, which must never carry a domain)
   *   `undefined`      - the foreground app is not a browser at all
   * Collapsing `null` into `undefined` would render "Not in a browser" while the user is
   * looking at a real browser, which is a lie. `unknown !== absent`.
   */
  domain?: string | null;
  /** True only for a VERIFIED private/incognito window. Never inferred from a missing domain. */
  isPrivate?: boolean;
  /**
   * Milliseconds in the current app, when known. `undefined` means UNKNOWN, and the Now page
   * then renders no duration at all rather than a fabricated "0 min" — a zero is a measurement,
   * an absent reading is not one.
   */
  secondsInApp?: number;
}

/**
 * Ambient payloads — added by the two-RESULT curation merge (2026-10-05).
 *
 * The curation specs specify a widget per promoted kind but shipped only
 * `NowPayload` / `TierBreakdownPayload`. These are the missing shapes.
 *
 * EVERY field is optional and every consumer must treat absent as UNKNOWN, never as
 * zero — that is the binding honesty rule (RESULT.md 5.3): `unknown !== 0`. A widget
 * whose producer has not landed renders its explicit empty sentence, not a `0`.
 */

/** `afkGap` — heartbeat-fed, because getSystemIdleTime() returns 0 on Linux. */
export interface AfkGapPayload {
  /** ms the user has been away. Absent = not yet known. */
  awayMs?: number;
  /** ISO timestamp of when the gap began. */
  since?: string;
}

/** `aiUsage` — channels `get-ai-stats` + `get-model-usage` (payload still unverified). */
/**
 * `nextDeadline` producer payload, from the EXISTING `deadlines` table.
 *
 * `count` is a MEASUREMENT, not a presence flag. `count: 0` means the table answered and the
 * answer was "none" — that is a real state and it renders the spec's `zero_literal`. It is NOT
 * the unknown literal; the unknown literal is for when the table could not be read at all,
 * which the renderer signals by producing NO activity for this kind.
 */
export interface NextDeadlinePayload {
  /** number of OPEN (non-terminal) deadlines. 0 is a real measurement. */
  count: number;
  /** the soonest open deadline, or null when count === 0 */
  title?: string;
  /** epoch ms of `due_date`, parsed from the stored ISO-8601 UTC string */
  dueAtMs?: number;
  /** dueAtMs - now. NEGATIVE means overdue. */
  deltaMs?: number;
  isOverdue?: boolean;
}

export interface AiUsagePayload {
  tokensToday?: number;
  sessionCount?: number;
  topModel?: string;
  /**
   * A REAL fraction 0..1, or undefined when no denominator exists.
   *
   * Board 2 draws `AI USAGE 62%` with a filled bar, so the bar belongs in the design — I removed
   * it earlier by calling the number fabricated, which was wrong: every value on that board is
   * placeholder art (`00:42:18`, `18 min`, `34 days overdue`), so 62% is the mock's sample value,
   * not a claim about real data.
   *
   * So the bar is restored, but it is driven by THIS field and renders only when it is present.
   * A producer with a quota or a period cap fills it; a producer that cannot report a percentage
   * leaves it undefined and the row shows the token count alone. That is RESULT.md §5.3's
   * `forbidden: generic_placeholder_numbers` without discarding the design's own element.
   */
  usageFraction?: number;
}

/** `hud` — the ambient-instrument family; first occupant is the console widget. */
export interface HudPayload {
  activeSessions?: number;
  commandsToday?: number;
  handbookPercent?: number;
}

/** `focus` — no producer exists yet; shape per the RESULT's countdown spec. */
export interface FocusPayload {
  intent?: string;
  endsAtMs?: number;
  remainingMs?: number;
}

/** `critical` — the toast crown. `route` is only honoured when the producer sends one. */
export interface CriticalPayload {
  message?: string;
  source?: string;
  route?: string;
}

export interface TierBreakdownPayload {
  productiveSeconds: number;
  neutralSeconds: number;
  distractingSeconds: number;
}

export interface DeadlinePayload {
  title: string;
  dueAt: string;
}

export interface IslandActivity<P = unknown> {
  /**
   * Stable identity. HALO §4 is emphatic that a new id must NOT be minted per
   * update — `layoutId` transitions and queue replacement both key off this.
   */
  id: string;
  kind: ActivityKind;
  priority: number;
  /** Persistent activities are never expired and never dropped as a toast. */
  persistent: boolean;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  replaceGroup?: string;
  minimumDisplayMs?: number;
  payload: P;
}

export interface NotchGeometry {
  hasNotch: boolean;
  width: number;
  height: number;
  source: 'appkit' | 'fallback' | 'none';
}

export interface IslandGeometry {
  displayId: number;
  displayBounds: Rect;
  workArea: Rect;
  scaleFactor: number;
  /** Fixed native canvas. NEVER resized for compact <-> expanded (HALO §10). */
  canvas: Rect;
  edge: OverlayEdge;
  notch: NotchGeometry;
  compactSize: Size;
  expandedSize: Size;
  /** the resolved S/M/L preset this geometry was built from (Figma board `1 / Sizes`). */
  size: HaloSize;
  /**
   * How that preset was fitted to the canvas that actually exists.
   *
   * `tight` means there genuinely was not enough room, and the renderer must drop chrome rather
   * than overflow. `wide` means there is surplus width and a row may distribute it. Both are
   * decisions the RENDERER has to make, so they cannot live only in the geometry.
   */
  fit: FittedSize;
  /**
   * The trigger rect the hover FSM tests while COLLAPSED. It is the compact pill plus the
   * user's `trigger.padX/padY` — never the transparent canvas (HALO §49).
   */
  hotZone: Rect;
  /**
   * The trigger rect the hover FSM must test while EXPANDED.
   *
   * WHY THIS IS A SEPARATE FIELD AND NOT A RECOMPUTED `hotZone`
   * -------------------------------------------------------
   * The island grew from a 232x40 pill to a 460x236 panel, but the trigger stayed pinned to
   * the collapsed pill. The FSM therefore classified most of the island's own painted surface
   * as `outside`, so moving the cursor down onto the expanded content — the exact thing a user
   * does after opening it — started the close timer and the island shut under the cursor. A
   * numeric probe put it at 4 of 6 sample cursor positions on the painted island reporting
   * `inside: false`.
   *
   * The rule is therefore: `inside` must be true for every point the user can SEE, in BOTH
   * phases. Collapsed uses the pill (touch only the visible small UI, per the user's
   * request); expanded uses this rect, which is the union of the pill and the expanded
   * surface, so moving anywhere on the island keeps it open and moving off it closes it.
   *
   * This is a HOVER region only. It must never become a click region — `applyClickRegion` in
   * `haloIsland.ts` shapes the window separately and exclusively.
   */
  hotZoneExpanded: Rect;
}

export interface IslandState {
  phase: IslandPhase;
  interaction: InteractionMode;
  activeActivityId: string | null;
  queuedActivityIds: string[];
  pinned: boolean;
  displayId: number | null;
  edge: OverlayEdge;
  reducedMotion: boolean;
}
/**
 * Halo slot model — lanes, composition, rotation.
 *
 * MERGED SPEC (2026-10-05). Two external RESULTs disagreed; responsibilities were split:
 *   - BACKEND  <- RESULT.md (Downloads, 1722 lines)  §6.2 backend audit: which channel is
 *                 real / stub / absent. `tracking-heartbeat` is the AFK + now producer,
 *                 because powerMonitor.getSystemIdleTime() returns 0 on Linux.
 *   - FRONTEND <- result.md (GLM, exact px)          §1.1-1.3 occlusion-not-eviction lanes.
 *
 * THE ONE IDEA: **priority orders attention; it never deletes existence.** The resident
 * (stopwatch) cannot be evicted at any priority. A critical alert OCCLUDES the compact pill
 * for its minimumDisplayMs, then collapses to a 4px dot, and the timer returns with elapsed
 * intact because it never stopped accumulating.
 *
 * PURE LOGIC. No IPC, no React, no DOM, no main.ts. Everything is a function of
 * (activities, time) so it can be probed with printed numbers.
 */

import type { ActivityKind, IslandActivity, IslandPhase } from './types';
import { HERO_KIND, priorityForKind } from './activityPriority';

/* ────────────────────────────────────────────────────────────────────────────
 * LANES — the front-end half of the merge (GLM §1.1)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Resident is never evicted. Live states displace each other strictly by the EXISTING
 * PRIORITY ranks (recording 750 > focus 600 > afkGap 450) — no new numeric values were
 * added to PRIORITY. Toast is fully evictable and owns `minimumDisplayMs` as its floor.
 */
export type Lane = 'resident' | 'live' | 'toast';

export const INTERRUPT_PRECEDENCE: Record<string, number> = {
  critical: 1,
  directUserFeedback: 2,
  recording: 3,
  hud: 4,
  otherTransient: 5,
};

/**
 * GLM §1.1 lane assignment. `afkGap` is a LIVE state here (it explains a stalled hero) even
 * though RESULT.md §2.1 rejected it as a standalone *card* — that is not a contradiction:
 * RESULT.md rejected it as competition for a slot, GLM gave it the pip as live state. This
 * merge keeps it as live-state-only, never as an ambient rail card.
 */
export const LANE_OF: Record<ActivityKind, Lane> = {
  stopwatch: 'resident',
  now: 'resident',
  pinnedActivity: 'resident',

  dictation: 'live',
  focus: 'live',
  afkGap: 'live',

  critical: 'toast',
  hud: 'resident',

  tierBreakdown: 'resident',
  nextDeadline: 'resident',
  aiUsage: 'resident',
  clock: 'resident',
  liveActivity: 'resident',
  download: 'resident',
  battery: 'resident',
  clipboard: 'resident',
  custom: 'resident',
  /* The site-aware kinds (HALO spec section 6). `private` is LIVE rather than resident: an
   * unshown private window is exactly the moment the user needs the island to say so. */
  website: 'resident',
  stopwatchSite: 'resident',
  private: 'live',
};

/** Verbatim verdicts — RESULT.md §2.1 + GLM §2, reconciled. Zero new ActivityKinds. */
export const VERDICT: Record<ActivityKind, 'promote' | 'keep' | 'reject'> = {
  stopwatch: 'promote',
  dictation: 'promote',
  focus: 'promote',
  afkGap: 'promote',
  now: 'promote',
  tierBreakdown: 'promote',
  nextDeadline: 'promote',
  pinnedActivity: 'promote',
  hud: 'promote',
  critical: 'promote',
  aiUsage: 'promote',

  // kept as reserved carriers — envelope only, never a dedicated slot
  clock: 'keep',
  liveActivity: 'keep',
  custom: 'keep',

  // rejected
  download: 'reject',
  battery: 'reject',
  clipboard: 'reject',

  /* Site-aware kinds: `website`/`stopwatchSite` are ordinary informational kinds and follow
     the same policy as `now`; `private` is never promoted, because a private window is not
     competing for attention with anything — it is a label. */
  website: 'promote',
  stopwatchSite: 'promote',
  private: 'keep',
};

/**
 * Hard ceiling on simultaneously visible widgets.
 *
 * The spec: "232px cannot hold three legible units and pretending otherwise produces 6px
 * type." So 3 is the most the compact pill can honestly show, and the expanded rail shows
 * 2 per page. Raising this past 3 would push overflow into identity dots rather than
 * shrinking type — dots are honest, 6px type is not.
 */
export const MAX_VISIBLE_CEILING = 3;

/** Ambient rail roster — fixed, learnable, NOT priority-shuffled (GLM per-promoted). */
export const AMBIENT_ORDER: ActivityKind[] = [
  'pinnedActivity',
  'aiUsage',
  'hud',
  'nextDeadline',
  'tierBreakdown',
];

/* ────────────────────────────────────────────────────────────────────────────
 * PRESENTATION POLICY — pure numbers, never IPC data
 * ──────────────────────────────────────────────────────────────────────────── */

/** GLM §3: expanded rail dwell per page; compact ambient pip dwell. */
export const DWELL = {
  /** GLM §3 compact ambient pip dwell. */
  compactAmbientMs: 15000,
  /** GLM §3 expanded rail dwell per page (2 cards). */
  expandedRailPageMs: 8000,
  /** RESULT.md §1.10 policy floor values. */
  residentCarouselMs: 3600,
  interruptMs: 1200,
  criticalMs: 6000,
  hudMs: 900,
  recordingMs: 1000,
} as const;

export const ROTATION_FADE_MS = 160;

export function minimumDisplayMsFor(kind: ActivityKind): number {
  switch (kind) {
    case 'critical':
      return DWELL.criticalMs;
    case 'hud':
      return DWELL.hudMs;
    case 'dictation':
      return DWELL.recordingMs;
    default:
      return DWELL.residentCarouselMs;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * GEOMETRY — verified against the real canvas budget
 * ──────────────────────────────────────────────────────────────────────────── */

/** Compact is fixed 232x40; inner width is 208 after 12px side padding (GLM §7.1). */
export const COMPACT = {
  width: 232,
  height: 40,
  paddingX: 12,
  inner: 208,
  heroAtOne: 208,
  /* GLM §7.1 Layout 2 specifies hero 116 + divider 1 + pip 71 = 188 of 208 inner, leaving
     20px of dead trailing space inside a FIXED 232px capsule. The capsule cannot shrink
     (232x40 is the compact geometry token), so that gap reads as a layout bug rather than
     as breathing room. The remainder goes to the PIP because that is the slot which
     degrades first under truncation — the hero keeps its elapsed digits. Divider stays 1. */
  heroAtTwo: 116,
  divider: 1,
  pipAtTwo: 91,
  dotZone: 20,
  maxDots: 3,
} as const;

/**
 * Expanded composition. GLM §1.2 sums 96+12+120+12+24+32 = 296 against a 300px canvas —
 * VERIFIED, 4px headroom. I REJECTED GLM's "island height shrinks to 232 on a toast":
 * `types.ts:167` states the canvas is never resized for compact<->expanded, and
 * haloIsland.ts issues one setBounds for placement, so a per-toast resize would fight the
 * placement guard. The toast swaps CONTENT inside the fixed canvas instead.
 */
export const EXPANDED = {
  canvasWidth: 520,
  canvasHeight: 300,
  padding: 16,
  inner: 488,
  heroStage: 96,
  strip: 120,
  footer: 24,
  cardGap: 12,
  cardWidth: 238,
  cardInnerWidth: 214,
  cardInnerHeight: 96,
  toastStrip: 56,
  total: 296,
  headroom: 4,
} as const;

export type ExpandedWidthClass = 'SM' | 'MD' | 'LG';

/** SM 360 hero only · MD 460 one strip unit · LG 520 two strip units. */
export function widthClassFor(concurrency: number): ExpandedWidthClass {
  if (concurrency >= 3) return 'LG';
  if (concurrency === 2) return 'MD';
  return 'SM';
}

/* ────────────────────────────────────────────────────────────────────────────
 * HONEST EMPTY STATES — verbatim strings (RESULT.md §5.2 + GLM §5)
 *
 * THE BLOOD RULE: unknown renders the sentence, NEVER 0. A plausible number reading as a
 * live measurement is the canonical defect of this surface.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface EmptyCopy {
  loading: 'static_skeleton';
  zero: string;
  unknown: string;
  error: string;
  retry: string;
}

export const EMPTY_COPY: Partial<Record<ActivityKind, EmptyCopy>> = {
  stopwatch: {
    loading: 'static_skeleton',
    zero: '0:00:00',
    unknown: 'No app detected',
    error: 'Tracking offline',
    retry: 'Retry',
  },
  now: {
    loading: 'static_skeleton',
    zero: '0 active apps',
    unknown: 'No app detected',
    error: 'Tracking offline',
    retry: 'Retry',
  },
  dictation: {
    loading: 'static_skeleton',
    zero: '0:00',
    unknown: 'No active dictation',
    error: 'Microphone unavailable',
    retry: 'Retry',
  },
  focus: {
    loading: 'static_skeleton',
    zero: '0:00',
    unknown: 'No focus session',
    error: 'Focus state unavailable',
    retry: 'Retry',
  },
  afkGap: {
    loading: 'static_skeleton',
    zero: '0m',
    unknown: 'No gap recorded',
    error: 'Tracking offline',
    retry: 'Retry',
  },
  aiUsage: {
    loading: 'static_skeleton',
    zero: '0 sessions',
    unknown: 'No AI sessions yet',
    error: 'AI stats unavailable',
    retry: 'Retry',
  },
  hud: {
    loading: 'static_skeleton',
    zero: '0 active',
    unknown: 'No terminal sessions yet',
    error: 'Terminal stats unavailable',
    retry: 'Retry',
  },
  nextDeadline: {
    loading: 'static_skeleton',
    // RESULT.md §2.7 states `zero_literal: "0 deadlines"` verbatim, and adds: "If the verified
    // source explicitly reports zero upcoming deadlines, render `0 deadlines`; do not substitute
    // the unknown-data sentence." The model said "Nothing due", which is a softer wording the
    // spec does not authorise. The spec wins.
    zero: '0 deadlines',
    unknown: 'No deadline data yet',
    error: 'Deadlines unavailable',
    retry: 'Retry',
  },
  tierBreakdown: {
    loading: 'static_skeleton',
    zero: '0m tracked',
    unknown: 'No time tracked today',
    error: 'Insights unavailable',
    retry: 'Retry',
  },
  critical: {
    loading: 'static_skeleton',
    zero: '0 critical alerts',
    unknown: 'No critical alerts',
    error: 'Critical alert data unavailable',
    retry: 'Retry',
  },
  pinnedActivity: {
    loading: 'static_skeleton',
    zero: 'No pin set',
    unknown: 'Pinned source unavailable',
    error: 'Pinned source unavailable',
    retry: 'Unpin',
  },
};

/** GLM §1.3 item 4 — the honest strip when nothing is publishable yet. */
export const NOTHING_TO_ROTATE = 'Nothing to rotate — widgets appear as features publish';

/* ────────────────────────────────────────────────────────────────────────────
 * COMPOSE — the pure selector
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ComposedIsland {
  /** Never evicted. Always present, even when honestly empty. */
  resident: IslandActivity | null;
  /** Highest-priority live state (recording 750 > focus 600 > afkGap 450). */
  live: IslandActivity | null;
  /** Transient, fully evictable, owns minimumDisplayMs as its floor. */
  toast: IslandActivity | null;
  /** Ambient rail roster, already filtered to publishable. */
  rail: IslandActivity[];
  /** Compact 232x40 segment widths. */
  compact: {
    heroPx: number;
    dividerPx: number;
    pipPx: number;
    dots: ActivityKind[];
    /** True when a toast occupies the whole pill (occlusion). */
    occluded: boolean;
  };
  expanded: {
    widthClass: ExpandedWidthClass;
    /** GLM §1.3 precedence: toast > live+rail > rail > honest-empty. */
    stripMode: 'toast' | 'live+rail' | 'rail' | 'empty';
    totalPx: number;
    fitsCanvas: boolean;
  };
  /** Concurrency of VISIBLE activities, drives the width class. */
  concurrency: number;
}

export interface ComposeOptions {
  now: number;
  /**
   * User layout: the widget sequence to rotate, already filtered to visible widgets by
   * `visibleOrder()` in HaloPreferences. When omitted the learnable DEFAULT order is used,
   * so the model is fully functional with no preference store wired.
   */
  order?: ActivityKind[];
  /** Hide specific kinds entirely. Applied AFTER order, so a hidden widget cannot sneak
   *  back in through the default roster. */
  hidden?: ReadonlySet<ActivityKind>;
  /**
   * Ceiling on simultaneously VISIBLE widgets (1–3). This is the density control: the spec
   * forbids rendering three legible text segments inside 232x40, so raising this past the
   * live-state slots would push overflow into dots rather than shrinking the type.
   */
  maxVisible?: number;
  /**
   * The compact pill's roster, in the user's chosen order.
   *
   * WHY THIS IS AN INPUT RATHER THAN BEING DERIVED FROM `rail`
   * `rail` is filtered on `hasData()`, so deriving the compact dots from it makes their
   * presence a function of telemetry: a widget whose producer is briefly silent loses its
   * dot and the pill appears to flicker. Passing the roster in means the caller states which
   * widgets may appear in the 232px pill, and this module decides only how to fit them.
   *
   * Omitted = fall back to the previous data-derived behaviour.
   */
  compactRoster?: readonly ActivityKind[];
  /**
   * The kind the user picked as the pill's MAIN item (`prefs.pill.resident`).
   *
   * The handoff §6 says the hero "is decided by the existing promotion logic, not by the user",
   * and the Specialist's ruling keeps the part that protects the user while relaxing the rest:
   * this only chooses the DEFAULT item. An occluding interrupt still takes the whole pill — that
   * branch runs later and clears `dots` outright — so an overdue alert still outranks this, and
   * the rule that matters survives the customisation.
   *
   * An unknown or currently-unavailable kind falls back to the existing priority behaviour, so
   * setting an item the user has no data for never blanks the pill.
   */
  residentKind?: ActivityKind;
  /** GLM §3: pointer engagement freezes everything (pinnedUserInteraction = 1000). */
  pointerEngaged?: boolean;
  phase?: IslandPhase;
  /** Ambient rail cursor index; preserved across interrupts so nothing starves. */
  railCursor?: number;
}

function isExpired(a: IslandActivity, now: number): boolean {
  return a.expiresAt !== undefined && a.expiresAt <= now;
}

function hasData(a: IslandActivity): boolean {
  // A publisher that supplies a payload means populated. Absent payload = honest empty,
  // which still renders the resident but never joins the ambient rail.
  return a.payload !== null && a.payload !== undefined;
}

function liveRank(a: IslandActivity): number {
  return priorityForKind(a.kind);
}

/** Rail cards get a compact dot only when they cannot have compact content of their own. */
function composed_rail_kinds(
  railKinds: ActivityKind[],
  residentKind: ActivityKind | undefined,
  liveKind: ActivityKind | undefined,
): ActivityKind[] {
  return railKinds.filter((k) => k !== residentKind && k !== liveKind);
}

export function composeIsland(
  activities: IslandActivity[],
  opts: ComposeOptions,
): ComposedIsland {
  const { now } = opts;
  const alive = activities.filter((a) => !isExpired(a, now));

  /* Resident: highest priority persistent, else the HERO_KIND identity. Never evicted. */
  const residentPool = alive.filter((a) => a.persistent || a.kind === HERO_KIND);
  /* The user's chosen pill item wins the DEFAULT slot, but only if it is actually alive — and
   * only over the ordinary priority ranking. `persistent` entries and the hero are still the
   * fallback, so nothing that used to lead the pill can stop leading it because of a setting. */
  const chosenResident =
    opts.residentKind ? alive.find((a) => a.kind === opts.residentKind) : undefined;
  const resident =
    chosenResident ??
    residentPool.sort((a, b) => priorityForKind(b.kind) - priorityForKind(a.kind))[0] ??
    alive.find((a) => a.kind === HERO_KIND) ??
    null;

  /* Live: one visible. Higher live rank wins; it is a state, so the loser is not dropped. */
  const live = alive
    .filter((a) => LANE_OF[a.kind] === 'live' && a.kind !== resident?.kind)
    .sort((a, b) => liveRank(b) - liveRank(a))[0] ?? null;

  /* Toast: the interrupt lane. `critical` outranks everything in it. */
  const toast =
    alive
      .filter((a) => LANE_OF[a.kind] === 'toast')
      .sort((a, b) => priorityForKind(b.kind) - priorityForKind(a.kind))[0] ?? null;

  /* Ambient rail: fixed order, never priority-shuffled. Unpopulated entries do NOT enter —
     "never rotate empty activities solely to make the carousel look busy" (RESULT §3.3). */
  const roster = opts.order ?? AMBIENT_ORDER;
  const hidden = opts.hidden ?? new Set<ActivityKind>();
  /* Clamp here, not just in the preference validator. `composeIsland` is a public pure
   * function with other callers (the probe, future surfaces), and an unclamped 99 would
   * admit every roster entry — defeating the ceiling the whole density rule rests on. */
  const requested = opts.maxVisible ?? 3;
  const maxVisible = Math.min(MAX_VISIBLE_CEILING, Math.max(1, Math.round(requested)));
  const rail = roster
    .filter((k) => !hidden.has(k))
    .map((kind) => alive.find((a) => a.kind === kind))
    .filter((a): a is IslandActivity => !!a && hasData(a) && a.kind !== 'pinnedActivity')
    .slice(0, Math.max(1, maxVisible));
  const pinned = alive.find((a) => a.pinned) ?? null;
  if (pinned && !rail.some((r) => r.kind === pinned.kind)) rail.unshift(pinned);
  const rail_kinds = rail.map((r) => r.kind);

  /* Pointer engagement outranks every publisher (GLM §1.6 pinnedUserInteraction). */
  const engaged = opts.pointerEngaged === true;
  const effectiveToast = engaged && toast && toast.kind !== 'critical' ? null : toast;

  /* ── Compact 232x40 ─────────────────────────────────────────────────────── */
  const dots: ActivityKind[] = [];
  // `COMPACT` is `as const`, so each field's type is its literal. A segment width is a
  // VARIABLE here (hero is 208 at 1-up and 116 at 2-up), so widen explicitly rather than
  // letting TS infer the narrow literal and reject the legitimate reassignment.
  const visibleCount = [resident, live, effectiveToast].filter(Boolean).length;

  let heroPx: number = COMPACT.heroAtOne;
  let dividerPx: number = 0;
  let pipPx: number = 0;
  let occluded = false;

  /* Trailing dots are computed INDEPENDENTLY of the segment layout. Anything visible that
     does not get a text segment becomes a 4px dot. This must not be nested inside an
     `else` branch: with a live state present, a concurrent non-critical toast or pin was
     being dropped from the compact surface entirely — visible in the model, invisible on
     screen, which is the exact "right code, zero effect" shape PROVE Step 5 exists to catch. */
  const extras = [pinned?.kind, effectiveToast?.kind].filter(
    (k): k is ActivityKind => !!k && k !== resident?.kind && k !== live?.kind && k !== 'critical',
  );
  /* Rail cards have NO compact presence of their own — they live in the expanded strip.
     When a live state already owns the pip, the pip is full and the rail has nowhere to
     go, so each rail card becomes a trailing dot. Without this the model silently DROPS
     them from the compact surface: correct in the expanded layout, invisible at 232x40. */
  const railKinds = composed_rail_kinds(rail_kinds, resident?.kind, live?.kind);

  if (opts.compactRoster) {
    /* DETERMINISTIC COMPACT. The caller states which widgets may appear in the pill; this
     * function only decides how many fit. `extras` (a pin, a non-critical toast) still lead,
     * because an interrupt genuinely outranks a roster entry and the user must see it.
     *
     * A roster entry with no fresh sample is STILL emitted as a dot. Rendering it dimmed
     * rather than omitting it is the whole point: the pill's job is to show which widgets
     * exist, and a dot that vanishes between samples is worse than a dot that reads "idle",
     * because the user cannot tell a quiet widget from a missing one. `idle` is carried in
     * `CompactDot` so the renderer can dim it without inventing a value. */
    const roster = opts.compactRoster.filter(
      (k) => !dots.includes(k) && k !== resident?.kind && k !== live?.kind,
    );
    for (const k of [...extras, ...roster]) {
      if (dots.length >= COMPACT.maxDots) break;
      dots.push(k);
    }
  } else {
    for (const k of [...extras, ...railKinds]) {
      if (dots.length >= COMPACT.maxDots) break;
      dots.push(k);
    }
  }

  if (effectiveToast && effectiveToast.kind === 'critical') {
    /* Full-pill occlusion. The timer is covered, never deleted.
     *
     * `dots` is CLEARED here. It used to be pushed before this branch, so an occluding
     * alert painted its dots on top of the very hero it was covering — the "small thing gets
     * covered" symptom. An alert that replaces the whole pill replaces all of it. */
    occluded = true;
    heroPx = COMPACT.inner;
    dots.length = 0;
    pipPx = 0;
    dividerPx = 0;
  } else if (live || (opts.compactRoster && opts.compactRoster.length > 0)) {
    /* The pip segment is reserved whenever SOMETHING has a place in the pill, not only when
     * a `live` activity exists. Under a deterministic roster the pill must keep the same
     * layout every time, or the numeral shifts horizontally each time a producer goes
     * quiet — which reads as the island twitching rather than as data arriving. */
    heroPx = COMPACT.heroAtTwo;
    dividerPx = COMPACT.divider;
    pipPx = COMPACT.pipAtTwo;
  }

  /* ── Expanded 520x300 ───────────────────────────────────────────────────── */
  const stripMode: ComposedIsland['expanded']['stripMode'] = effectiveToast
    ? 'toast'
    : live
      ? 'live+rail'
      : rail.length > 0
        ? 'rail'
        : 'empty';

  const expandedVisible =
    (resident ? 1 : 0) + (live ? 1 : 0) + (stripMode === 'toast' ? 0 : rail.length) + (effectiveToast ? 1 : 0);

  return {
    resident,
    live,
    toast: effectiveToast,
    rail,
    compact: { heroPx, dividerPx, pipPx, dots, occluded },
    expanded: {
      widthClass: widthClassFor(expandedVisible),
      stripMode,
      totalPx: EXPANDED.total,
      fitsCanvas: EXPANDED.total <= EXPANDED.canvasHeight,
    },
    concurrency: visibleCount,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * ROTATION — a CURSOR, not an animation (GLM §3.6)
 *
 * This is the fix for the broken-half-state: nothing animates toward a destination the
 * logic has not committed to, so `stepHover` collapsing mid-rotation cannot strand a
 * half-finished frame.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface RotationState {
  cursor: number;
  /** ms at which the current item may advance; null when frozen. */
  advanceAt: number | null;
  /** The item currently committed, so a collapse can restore it. */
  committedId: string | null;
}

export function initialRotation(): RotationState {
  return { cursor: 0, advanceAt: null, committedId: null };
}

/**
 * @returns the next rotation state. `advanceAt` is null whenever rotation is frozen —
 * by pointer engagement, by phase transition, or by an empty rail.
 */
export function stepRotation(
  state: RotationState,
  composed: ComposedIsland,
  now: number,
  opts: { pointerEngaged?: boolean; phase?: IslandPhase; dwellMs?: number },
): RotationState {
  // IslandPhase is 'hidden'|'compact'|'opening'|'expanded'|'closing' (types.ts:11).
  // An earlier version of this file compared against 'expanding'/'collapsing', which do
  // not exist in the union — so the transition-freeze below could never fire. Verified
  // by scoped tsc, NOT by esbuild, which passed the nonsense silently.
  const transitioning = opts.phase === 'opening' || opts.phase === 'closing';
  const frozen =
    opts.pointerEngaged === true || transitioning || composed.expanded.stripMode === 'toast';

  const roster = composed.rail;
  if (roster.length === 0) {
    return { cursor: 0, advanceAt: null, committedId: composed.resident?.id ?? null };
  }

  const current = roster[state.cursor % roster.length];
  const dwell = opts.dwellMs ?? DWELL.compactAmbientMs;

  if (frozen) {
    // Freeze at the current card. `committedId` is what a collapse restores.
    return { ...state, advanceAt: null, committedId: current?.id ?? state.committedId };
  }

  if (state.advanceAt === null) {
    return { cursor: state.cursor, advanceAt: now + dwell, committedId: current?.id ?? null };
  }

  if (now >= state.advanceAt) {
    // RESULT §3.5: do NOT reset to index 0 — that starves low-priority cards.
    const nextCursor = (state.cursor + 1) % roster.length;
    return { cursor: nextCursor, advanceAt: now + dwell, committedId: roster[nextCursor]?.id ?? null };
  }

  return { ...state, committedId: current?.id ?? state.committedId };
}

/** GLM §3.6 step 3 — on collapse, restore the last committed card, not a half-state. */
export function collapseRotation(state: RotationState, composed: ComposedIsland): RotationState {
  const restored = composed.rail.findIndex((r) => r.id === state.committedId);
  return {
    cursor: restored >= 0 ? restored : 0,
    advanceAt: null,
    committedId: state.committedId,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * CURATED SURFACES — §2 per-promoted content (GLM), icons verified lucide names
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CuratedSurface {
  kind: ActivityKind;
  lane: Lane;
  icon: string;
  /** Compact pip glyph budget — 232x40 cannot hold a card. */
  compactChars: number;
  /** true when this kind may only exist as live state, never as an ambient rail card. */
  liveOnly: boolean;
  route: string | null;
}

export const SURFACES: CuratedSurface[] = [
  { kind: 'stopwatch', lane: 'resident', icon: 'timer', compactChars: 8, liveOnly: false, route: '/' },
  { kind: 'now', lane: 'resident', icon: 'target', compactChars: 12, liveOnly: false, route: '/activity' },
  { kind: 'dictation', lane: 'live', icon: 'mic', compactChars: 5, liveOnly: false, route: null },
  { kind: 'focus', lane: 'live', icon: 'target', compactChars: 6, liveOnly: false, route: null },
  { kind: 'afkGap', lane: 'live', icon: 'coffee', compactChars: 6, liveOnly: true, route: '/activity' },
  { kind: 'aiUsage', lane: 'resident', icon: 'sparkles', compactChars: 6, liveOnly: false, route: '/ai' },
  { kind: 'hud', lane: 'toast', icon: 'terminal', compactChars: 7, liveOnly: false, route: '/penguin-console' },
  { kind: 'nextDeadline', lane: 'resident', icon: 'calendar-clock', compactChars: 6, liveOnly: false, route: '/life' },
  { kind: 'tierBreakdown', lane: 'resident', icon: 'layers', compactChars: 7, liveOnly: false, route: '/reports' },
  { kind: 'critical', lane: 'toast', icon: 'triangle-alert', compactChars: 30, liveOnly: false, route: null },
  { kind: 'pinnedActivity', lane: 'resident', icon: 'pin', compactChars: 6, liveOnly: false, route: null },
  { kind: 'website', lane: 'resident', icon: 'globe', compactChars: 18, liveOnly: false, route: '/activity' },
  { kind: 'private', lane: 'resident', icon: 'lock', compactChars: 14, liveOnly: false, route: null },
  { kind: 'stopwatchSite', lane: 'resident', icon: 'timer', compactChars: 18, liveOnly: false, route: '/activity' },
];

export function surfaceFor(kind: ActivityKind): CuratedSurface | null {
  return SURFACES.find((s) => s.kind === kind) ?? null;
}
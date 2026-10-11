# CONTEXT BUNDLE — Halo Island MASTER

> **Verbatim extracts from the repository.** You have no access to this codebase. Everything
> you need to verify a claim is here. **Anything not in this bundle, say `UNVERIFIED:` and
> name the command that would verify it** — do not guess, and do not invent a column.

## 0. The product

**RHEO** — an Electron + React + better-sqlite3 desktop productivity tracker. The Halo is a
macOS-Dynamic-Island-style always-on-top transparent window at the top-centre of the screen that
expands on hover and works while any other application has focus.

Host platform: **native Wayland (KDE Plasma)**. Electron does not reliably honour programmatic
window position, always-on-top, or cursor position there, so the overlay runs with
`ELECTRON_OZONE_PLATFORM_HINT=x11` (XWayland). Transparency must be guarded per-platform.

## 1. The real trigger geometry — this is where it broke

```ts
export function computeSurfaceRect(canvas: Rect, surface: Size, edge: OverlayEdge = 'top'): Rect {
  const { xFrac, yFrac } = surfaceAnchorFractions(edge);
  return {
    x: canvas.x + Math.round((canvas.width - surface.width) * xFrac),
    y: canvas.y + Math.round((canvas.height - surface.height) * yFrac),
    width: surface.width,
    height: surface.height,
  };
}
export function computeHotZone(
  canvas: Rect,
  compact: Size,
  options: HotZoneOptions = { padX: 0, padY: 0 },
  edge: OverlayEdge = 'top',
): Rect {
  const surface = computeSurfaceRect(canvas, compact, edge);
  const padX = Math.max(0, Math.round(options.padX || 0));
  const padY = Math.max(0, Math.round(options.padY || 0));

  // A side edge pads along Y only; the top edge pads along X. Padding toward the attached
  // edge is not subtracted, because those pixels are off-screen.
  const verticalSide = edge === 'left' || edge === 'right';
  const growTop = verticalSide ? padX : 0;
  const growBottom = verticalSide ? padX : 0;
  const growLeft = verticalSide ? 0 : padX;
  const growRight = verticalSide ? 0 : padX;
  const growDown = verticalSide ? 0 : padY;

  return {
    x: surface.x - growLeft,
    y: surface.y - growTop,
    width: compact.width + growLeft + growRight,
    height: compact.height + growTop + growBottom + growDown,
  };
}
export function unionRect(a: Rect, b: Rect): Rect {
  if (a.width <= 0 || a.height <= 0) return { ...b };
  if (b.width <= 0 || b.height <= 0) return { ...a };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}
```

The two per-phase rects, from `computeGeometry`:
```ts
  const compactZone = computeHotZone(canvas, compactSize, hotZone, edge);
  const expandedZone = computeHotZone(
    canvas,
    expandedSize,
    hotZone,
    edge,
  );

  return {
    displayId: input.displayId,
    displayBounds: bounds,
    workArea: input.workArea,
    scaleFactor: input.scaleFactor,
    canvas,
    edge,
    notch: {
      ...notch,
      width: Math.max(0, notch.width + calibration.notchWidthDelta),
      height: Math.max(0, notch.height + calibration.notchHeightDelta),
    },
    compactSize,
    expandedSize,
    hotZone: compactZone,
    hotZoneExpanded: unionRect(compactZone, expandedZone),
  };
}
```

### The bug, with numbers

`computeHotZone` derives the trigger from a size. Passing **only** `compactSize` produced a
232x40 trigger that was then tested forever against a 460x276 expanded island. Measured against
the live window geometry (canvas `x=764 y=0 520x300`):

```
CURSOR PATH (all points ON the visible island)      OLD    NEW
  land on pill             1024,  20   inside   inside
  move down 100px          1024, 120   OUTSIDE  inside
  left wing                 814, 120   OUTSIDE  inside
  right wing               1234, 120   OUTSIDE  inside
  bottom edge              1024, 270   OUTSIDE  inside

  called OUTSIDE while standing on the island:  OLD 4/6 -> NEW 0/6
```

**The invariant:** `inside` must be `true` for every pixel the user can SEE, in every phase.
The union of all phases' rects is monotonically larger than any single one, so it cannot
under-cover during the open/close animation.

### The phase selector (main process poll tick)
```ts
    const triggerRect =
      (h.expanded ? h.geometry.hotZoneExpanded : undefined) ?? h.geometry.hotZone;
    const inZone =
      hoverEnabled && point !== null
        ? pointInHotZone(triggerRect, point.x, point.y, hoverConfig.leaveMarginPx)
        : false;
```

## 2. Trigger vs CLICK region — two different rectangles

The trigger is a HOVER region and may be generous. The click region may never be generous: an
always-on-top transparent window whose click region is its full canvas swallows clicks on the
app underneath. They must derive from one shared surface rect.

`applyClickRegion` delegates the pass-through flag to `setClickThrough`, which is where
`setIgnoreMouseEvents` actually lives — the entire collapsed-phase contract:

```ts
function setClickThrough(win: BrowserWindow, collapsed: boolean): void {
  try {
    win.setIgnoreMouseEvents(collapsed, collapsed ? { forward: true } : undefined);
  } catch {
    /* ignore */
  }
}
```

And the function that does the shaping:

```ts
function applyClickRegion(h: HaloHandle, prefs: HaloPrefs): void {
  const win = h.window;
  if (win.isDestroyed()) return;

  if (!h.expanded) {
    // Collapsed: no click region at all. Reset the shape so a later expand starts clean.
    setClickThrough(win, true);
    try {
      win.setShape([]);
    } catch {
      /* platform has no window shapes; pass-through already covers this phase */
    }
    return;
  }

  setClickThrough(win, false);
  if (prefs.clickShield === 'canvas') return; // legacy: the whole window is interactive

  /* THE SIZE MUST COME FROM THE TOKENS THE RENDERER PAINTS WITH.
   *
   * A numeric probe caught this being wrong. `geometry.expandedSize` resolves to
   * `{ width: calibration.expandedWidth, height: calibration.expandedHeight || MAX_CANVAS_HEIGHT }`,
   * and `expandedHeight` is 0 unless a caller sets it — so it silently became 460x300, the
   * whole CANVAS. Shaping the click region to that made the island swallow clicks across the
   * entire transparent window, which is precisely the interference the user reported: a large
   * hitbox appeared to "block clicks near the stuff". The hitbox padding was never the cause;
   * the click region was simply the canvas.
   *
   * So the click region is derived from `HALO_SIZE_TOKENS` + the user's scale — the exact
   * call `OverlayRoot` makes to decide what to paint. One source, so the clickable pixels and
   * the visible pixels cannot diverge again. */
  const painted = scaled(HALO_SIZE_TOKENS, prefs.scale);
  const surface = computeSurfaceRect(
    h.geometry.canvas,
    h.expanded ? { width: painted.expandedWidth, height: painted.expandedHeight } : h.geometry.compactSize,
    prefs.edge,
  );
  try {
    win.setShape([
      {
        x: Math.round(surface.x - h.geometry.canvas.x),
        y: Math.round(surface.y - h.geometry.canvas.y),
        width: Math.round(surface.width),
        height: Math.round(surface.height),
      },
    ]);
    diag('click-region-shaped', {
      w: Math.round(surface.width),
      h: Math.round(surface.height),
    });
  } catch (e) {
    // macOS and any composited path: fall back to the canvas region rather than leaving a
    // stale shape behind, and record it so the limitation is visible in the trail.
    diag('click-region-UNSUPPORTED', { message: String((e as Error)?.message ?? e).slice(0, 160) });
    try {
      win.setShape([]);
    } catch {
      /* nothing further to try */
    }
  }
}
```

## 3. The hover FSM

```ts
import type { Rect } from './types';

/**
 * HALO §50 hover intent.
 *
 * This is a pure function on purpose. HALO §46 requires the MAIN process to own
 * hover intent — a click-through window cannot be trusted to deliver a renderer
 * mouseleave — which means it must be pollable from a cursor sample and therefore
 * testable without a window. HALO §151 lists the nine cases it has to satisfy;
 * `agent/probes/halo-core.probe.mts` asserts all nine.
 */
export interface HoverConfig {
  openDelayMs: number;
  closeDelayMs: number;
  leaveMarginPx: number;
}

/** HALO §48 starting values. */
export const DEFAULT_HOVER_CONFIG: HoverConfig = {
  openDelayMs: 110,
  closeDelayMs: 280,
  leaveMarginPx: 24,
};

export interface HoverState {
  hovered: boolean;
  /** 0 when the cursor is inside; otherwise the exit timestamp. */
  outsideSince: number;
  /** 0 when no open intent is pending; otherwise the entry timestamp. */
  intentSince: number;
  inside: boolean;
  pinned: boolean;
}

export type HoverIntent = 'open' | 'close' | 'none';

export interface HoverInput {
  now: number;
  /** Cursor is within the hot zone or the island body. */
  inside: boolean;
  pinned: boolean;
}

export function initialHoverState(): HoverState {
  return { hovered: false, outsideSince: 0, intentSince: 0, inside: false, pinned: false };
}

function rectContains(r: Rect, x: number, y: number, margin = 0): boolean {
  return (
    x >= r.x - margin &&
    x <= r.x + r.width + margin &&
    y >= r.y - margin &&
    y <= r.y + r.height + margin
  );
}

export function pointInHotZone(hotZone: Rect, x: number, y: number, margin = 0): boolean {
  return rectContains(hotZone, x, y, margin);
}

/**
 * Advances the hover machine by one poll tick and reports the resulting intent.
 *
 * Note what this does NOT do: it never resizes anything and never reads layout.
 * It only converts a cursor sample into an open/close intention.
 */
export type HoverTriggerMode = 'hover' | 'click' | 'hotkey' | 'hover-or-click';

/**
 * WHY THE TRIGGER MODE LIVES IN THE MACHINE, NOT ONLY AT THE CALL SITE
 * -----------------------------------------------------------------
 * The poll loop in `haloIsland.ts` could gate `inside` to false for a click-only island and
 * that would appear to work — until it didn't: the timer would still run, the cursor would
 * still cross a zone that does nothing, and nothing would say "this island does not open on
 * hover". Deciding it here means the state machine enforces it, so every caller gets it
 * right and the probe can assert it with no window at all.
 */
export function stepHover(
  prev: HoverState,
  input: HoverInput,
  config: HoverConfig = DEFAULT_HOVER_CONFIG,
  mode: HoverTriggerMode = 'hover',
): { state: HoverState; intent: HoverIntent } {
  const { now, pinned } = input;

  // Pinning overrides ordinary cursor-based collapse (HALO §51). `inside` is forced true
  // rather than passed through: a pinned island is open BY DESIGN and must stay open with
  // the pointer anywhere — including nowhere near it. Echoing the real cursor position here
  // would make `inside` flap and the expanded chrome would flicker with it.
  if (pinned) {
    return {
      state: { hovered: true, outsideSince: 0, intentSince: 0, inside: true, pinned: true },
      intent: prev.pinned ? 'none' : 'open',
    };
  }

  // A click-only or hotkey-only island has no hover channel at all. Falling through to a
  // clean "not hovered" state (rather than returning early) keeps every machine invariant
  // intact — notably that it never reports itself hovered when it was never open, which is
  // the stuck-hover failure HALO §216 lists as release-blocking.
  const hoverEnabled = mode === 'hover' || mode === 'hover-or-click';
  const inside = hoverEnabled ? input.inside : false;

  if (inside) {
    // HALO §50 sets hovered the moment the cursor is in the zone; `hovered`
    // therefore means "cursor is inside", NOT "the surface is open". The open
    // decision is carried separately by the returned intent, which only fires
    // once the open delay has matured.
    const intentSince = prev.inside ? prev.intentSince : now;
    const matured = now - intentSince >= config.openDelayMs;
    return {
      state: { hovered: true, outsideSince: 0, intentSince, inside: true, pinned: false },
      intent: matured ? 'open' : 'none',
    };
  }

  // There is nothing to close when the surface was never open. Without this gate
  // a cursor that starts outside begins an exit timestamp on its very first
  // sample and the machine reports itself hovered indefinitely — HALO §216 lists
  // "stuck hover state" as a release-blocking failure.
  if (!prev.hovered) {
    return {
      state: { hovered: false, outsideSince: 0, intentSince: 0, inside: false, pinned: false },
      intent: 'none',
    };
  }

  // First exit starts the grace period; the surface does NOT close immediately.
  const outsideSince = prev.outsideSince > 0 ? prev.outsideSince : now;
  const graceElapsed = now - outsideSince >= config.closeDelayMs;

  if (graceElapsed) {
    return {
      state: { hovered: false, outsideSince, intentSince: 0, inside: false, pinned: false },
      intent: 'close',
    };
  }

  // Crossing filter (HALO §48): an intent that never matured is cancelled when the
  // cursor contradicts it, so a brush past the zone does not open the island.
  return {
    state: {
      hovered: true,
      outsideSince,
      intentSince: prev.outsideSince > 0 ? 0 : prev.intentSince,
      inside: false,
      pinned: false,
    },
    intent: 'none',
  };
}

/** HALO §47 poll rates. Hover detection is not an animation clock. */
export const HOVER_POLL_IDLE_MS = 120;
export const HOVER_POLL_EXPANDED_MS = 40;
```

## 4. Slot model — lanes and the 17 kinds

```ts
export type Lane = 'resident' | 'live' | 'toast';

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

```

## 4b. Composition — activities become slots

This is the function that decides what is actually on the island, in what lane, in what
order, and how many are visible.

```ts
export function composeIsland(
  activities: IslandActivity[],
  opts: ComposeOptions,
): ComposedIsland {
  const { now } = opts;
  const alive = activities.filter((a) => !isExpired(a, now));

  /* Resident: highest priority persistent, else the HERO_KIND identity. Never evicted. */
  const residentPool = alive.filter((a) => a.persistent || a.kind === HERO_KIND);
  const resident =
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
```

## 5. Preferences — defaults are the tight ones

```ts
export const HALO_DEFAULTS: HaloPrefs = {
  enabled: true,
  scale: 1,
  edge: 'top',
  displayId: null,
  widgets: {},
  order: [...HALO_DEFAULT_ORDER],
  maxVisible: 3,
  shape: 'capsule',
  radius: 12,
  trigger: {
    mode: 'hover',
    padX: 0,
    padY: 0,
    openDelayMs: 110,
    closeDelayMs: 280,
    leaveMarginPx: 24,
  },
  motion: {
    durationMs: 250,
    easing: 'expo',
    liveliness: 'full',
  },
  showPin: true,
  clickShield: 'surface',
  compactStyle: 'auto',
};
```
```ts
export function normalizeHaloPrefs(raw: unknown): HaloPrefs {
  if (!raw || typeof raw !== 'object') return { ...HALO_DEFAULTS };
  const r = raw as Record<string, unknown>;
  /* widgets: keep only plain boolean flags under orderable kinds. Anything else is
   * dropped rather than trusted — this bag is untyped on disk. */
  const widgets: Record<string, HaloWidgetPrefs> = {};
  const rawWidgets = r.widgets;
  if (rawWidgets && typeof rawWidgets === 'object') {
    for (const [k, v] of Object.entries(rawWidgets as Record<string, unknown>)) {
      if (!(HALO_ORDERABLE as readonly string[]).includes(k)) continue;
      if (!v || typeof v !== 'object') continue;
      const entry = v as Record<string, unknown>;
      const vis = entry.visible;
      const cmp = entry.compact;
      // `compact` is only meaningful alongside a visible widget; a hidden widget that also
      // says compact:true is contradictory, so visibility wins and `compact` is not kept.
      if (vis === false) {
        widgets[k] = { visible: false };
        continue;
      }
      widgets[k] = { visible: typeof vis === 'boolean' ? vis : true };
      if (typeof cmp === 'boolean') widgets[k].compact = cmp;
    }
  }

  /* order: de-dupe, drop unknown/stale kinds, then append anything missing so a partial
   * stored array can never shrink the roster below the default. */
  const rawOrder = Array.isArray(r.order) ? (r.order as unknown[]) : [];
  const seen = new Set<string>();
  const order: string[] = [];
  for (const k of rawOrder) {
    if (typeof k !== 'string') continue;
    if (!(HALO_ORDERABLE as readonly string[]).includes(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    order.push(k);
  }
  for (const k of HALO_DEFAULT_ORDER) if (!seen.has(k)) order.push(k);

  const displayId =
    typeof r.displayId === 'number' && Number.isFinite(r.displayId) ? r.displayId : null;

  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : HALO_DEFAULTS.enabled,
    scale: clampScale(r.scale),
    edge: pickEnum(r.edge, HALO_EDGES, HALO_DEFAULTS.edge),
    displayId,
    widgets,
    order,
    maxVisible: clampMaxVisible(r.maxVisible),
    shape: pickEnum(r.shape, HALO_SHAPES, HALO_DEFAULTS.shape),
    radius: Math.round(clampNumber(r.radius, HALO_RADIUS_MIN, HALO_RADIUS_MAX, HALO_DEFAULTS.radius)),
    trigger: normalizeHaloTrigger(r.trigger),
    motion: normalizeHaloMotion(r.motion),
    showPin: typeof r.showPin === 'boolean' ? r.showPin : HALO_DEFAULTS.showPin,
    clickShield: pickEnum(r.clickShield, HALO_CLICK_SHIELDS, HALO_DEFAULTS.clickShield),
    compactStyle: pickEnum(r.compactStyle, HALO_COMPACT_STYLES, HALO_DEFAULTS.compactStyle),
  };
}
```

## 6. Where preferences are stored — and the trap

Preferences live in a **JSON file**, not SQLite:

```ts
const prefsPath = path_1.default.join(userDataPath, 'deskflow-prefs.json');
function loadPreferences() {
    try {
        if (fs_1.default.existsSync(prefsPath)) {
            const data = fs_1.default.readFileSync(prefsPath, 'utf-8');
            userPreferences = JSON.parse(data);
            console.log('[DeskFlow] 📄 Loaded preferences');
        }
    }
    catch (err) {
        console.warn('[DeskFlow] Failed to load preferences:', err);
        userPreferences = {};
    }
    DEBUG_TRACKING = !!userPreferences.debugTracking;
```
```ts
249:export const HALO_PREFS_KEY = 'haloIsland';
103:import { createHaloIsland, registerHaloIpc, reconcileHaloGeometry, toggleHaloIsland, sendHaloCommand, configureHaloPrefs, destroyHaloIsland } from "./main/halo/haloIsland";
23018:      configureHaloPrefs(() => userPreferences[HALO_PREFS_KEY]);
23020:        prefs: () => userPreferences[HALO_PREFS_KEY],
```

> **TRAP — verified this cycle.** `halo:prefs` is only ever *sent* main→renderer. Check every
> preference you specify for a **reader**, not just a writer. A stored-but-never-read preference
> is indistinguishable from a working one until runtime.

## 7. Real schemas — use these, do not invent

```sql
          CREATE TABLE IF NOT EXISTS deadlines (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            course TEXT,
            due_date TEXT NOT NULL,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            description TEXT,
            reminder_sent INTEGER DEFAULT 0,
            notified_at TEXT DEFAULT '{}',
            snoozed_until TEXT,
            recurrence TEXT,
            recurrence_end TEXT,
            category TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `);
          CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            due_date TEXT,
            goal_id TEXT,
            done INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            due_time TEXT
          )
        `);
```
```sql
      CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        tool TEXT NOT NULL,
        date DATE NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        model TEXT,
        message_count INTEGER DEFAULT 0,
        project_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
            CREATE TABLE IF NOT EXISTS terminal_sessions (
              id TEXT PRIMARY KEY,
              preset_id TEXT,
              project_id TEXT,
              agent TEXT,
              resume_id TEXT,
              topic TEXT,
              working_directory TEXT,
              terminal_id TEXT,
              total_tokens INTEGER DEFAULT 0,
              total_cost REAL DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
```

`focus` has **no table anywhere in `main.ts`** (measured: 0 matches). `deadlines` and
`reminders` **do exist**, so `nextDeadline` is a READ, not a build.

## 8. The two IPC handlers that were actually added

```ts
    // ── HALO WIDGET PRODUCERS ──────────────────────────────────────────────────
    // The curation RESULT §6.2 marked `aiUsage` and `hud` as "real channels, payload
    // unverified" and every other promoted kind as absent. These two handlers close that
    // gap against the REAL schemas, and they do it defensively:
    //
    //   * `useJson` — this app can run on a JSON store with no SQLite file at all
    //     (main.ts:2298). Every existing stat handler starts with an early return of
    //     zeros for that case; these follow the same rule, because a widget that throws
    //     in the main process is far worse than a widget that honestly reads zero.
    //   * no fabricated columns. Only `ai_usage.*` and `terminal_sessions.*` columns
    //     that exist in the CREATE TABLE are read.
    //   * `unknown` is distinguishable from zero: `tokensToday`/`activeSessions` are
    //     `null` when there is genuinely no row for today, and only 0 when a real row
    //     sums to zero. That is RESULT §5.2's blood rule.
    try {
      electron_1.ipcMain.handle('halo:get-ai-usage', () => {
        if (useJson || !db) return { tokensToday: null, sessionCount: null, topModel: null };
        try {
          const today = getLocalDateStr(new Date());
          const row = db
            .prepare(
              `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
                      COALESCE(SUM(message_count), 0)      AS messages
                 FROM ai_usage WHERE date = ?`,
            )
            .get(today);
          const top = db
            .prepare(
              `SELECT model, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
                 FROM ai_usage
                WHERE date = ? AND model IS NOT NULL AND model != ''
                GROUP BY model ORDER BY tokens DESC LIMIT 1`,
            )
            .get(today);
          const tokens = Number(row?.tokens ?? 0);
          const messages = Number(row?.messages ?? 0);
          // No row for today -> genuinely "nothing yet", which is `null`, NOT 0.
          const hasRow = !!db
            .prepare(`SELECT 1 FROM ai_usage WHERE date = ? LIMIT 1`)
            .get(today);
          return {
            tokensToday: hasRow ? tokens : null,
            sessionCount: hasRow ? messages : null,
            topModel: top?.model ?? null,
          };
        } catch (e) {
          return { tokensToday: null, sessionCount: null, topModel: null, error: String(e?.message ?? e) };
        }
      });

      electron_1.ipcMain.handle('halo:get-terminal-usage', () => {
        if (useJson || !db) return { activeSessions: null, commandsToday: null, handbookPercent: null };
        try {
          // "Active" = a session updated within the last 5 minutes. There is no
          // is_active column, so this is derived from updated_at rather than invented.
          const active = db
            .prepare(
              `SELECT COUNT(*) AS n FROM terminal_sessions
                WHERE updated_at IS NOT NULL
                  AND updated_at >= datetime('now', '-5 minutes')`,
            )
            .get();
          return {
            activeSessions: Number(active?.n ?? 0),
            commandsToday: null, // no command-count column exists; reported as unknown
            handbookPercent: null, // handbook progress has no table; unknown, not fake
          };
        } catch (e) {
          return { activeSessions: null, commandsToday: null, handbookPercent: null, error: String(e?.message ?? e) };
        }
```

Note the `useJson` guard: this app can run on a JSON store with **no SQLite file at all**, and
every existing stat handler early-returns zeros for that case. A widget that throws in the main
process is far worse than one that honestly reads zero.

## 9. The halo renderer has NO deskflowAPI

```ts
contextBridge.exposeInMainWorld('haloBridge', {
  getSnapshot: () => ipcRenderer.invoke('halo:get-snapshot'),
  open: () => ipcRenderer.invoke('halo:open'),
  close: () => ipcRenderer.invoke('halo:close'),
  setPinned: (pinned: boolean) => ipcRenderer.invoke('halo:set-pinned', !!pinned),
    // Re-read + push every preference to the LIVE island. Without this the renderer only
    // ever saw the prefs that existed at `did-finish-load`, so every setting in the Halo
    // section of Settings was stored and ignored until a relaunch.
    applyPrefs: () => ipcRenderer.invoke('halo:apply-prefs'),
    // Monitor list for the position picker. See listHaloDisplays in haloIsland.ts.
    listDisplays: () => ipcRenderer.invoke('halo:list-displays'),
    // HALO §51 "click outside -> unpin + collapse". Sent by the island's own document-level
    // pointer listener, so it can only fire for a click that did NOT land on the island.
    clickOutside: () => ipcRenderer.invoke('halo:click-outside'),
  onPrefs: (cb: (prefs: unknown) => void) => {
    const handler = (_event: unknown, prefs: unknown) => cb(prefs);
    ipcRenderer.on('halo:prefs', handler);
    return () => ipcRenderer.removeListener('halo:prefs', handler);
  },
  onCommand: (cb: (cmd: { command: string }) => void) => {
    const handler = (_event: unknown, cmd: { command?: string }) =>
      cb({ command: String(cmd?.command ?? '') });
```

Getting this wrong is fatal and silent: the island window loads `halo.html` with only
`haloBridge`. Calling `window.deskflowAPI` there returns `undefined`.

## 10. Live renderer measurements (read from the running app's own bundle)

```
phase              : compact
root rect          : 0,0 780x437     (pointer-events: none)
surface rect       : 274,0 232x40    (pointer-events: auto)
surface radius     : 9999px
haloBridge         : undefined in a plain browser (correct — it only exists in Electron)
```

The renderer is correct: `pointer-events: none` on the root, `auto` on the painted surface. A
CSS-only hit region is **not** sufficient for an always-on-top window, because once the OS has
delivered the event to that window, whether the click then reaches the window underneath depends
on the compositor — and on X11 it does not. Only a real window shape makes it deterministic.

## 11. The stopwatch store — single source of truth

```ts
// a third private value. Read through a getter because the value can change at
// runtime while the app is open.
function idleThresholdMs(): number {
  return afkThresholdMs();
}

export interface StopwatchSnapshot {
  productiveMs: number;
  distractingMs: number;
  paused: boolean;
  /** tier the timer is currently attributing to */
  activeTier: StopwatchTier;
  /**
   * THE number every surface displays. Derived here, once, so the sidebar and
   * the dashboard hero are reading the same value from the same clock rather
   * than each reimplementing "which total applies right now".
   */
  displayMs: number;
  /** which total `displayMs` came from — used for labels/colour */
  displaySource: StopwatchSource;
  /** bumps only on a REAL reset, so the reset overlay cannot lie */
  resetCount: number;
  externalLabel: string;
}

interface Store {
  productiveAccumulatedMs: number;
  distractingAccumulatedMs: number;
  /** epoch ms when the running segment began, or 0 when stopped/paused */
  runningSinceMs: number;
  paused: boolean;
  activeTier: StopwatchTier;
  /** the tier we were on last tick, so a productive↔distracting flip is detected once */
  lastTickTier: StopwatchTier | null;
  /** last recorded user interaction, used to exclude idle time */
  lastInteractionAtMs: number;
  /**
   * LOCAL calendar day the accumulators belong to, as YYYY-MM-DD.
   *
   * The timer used to persist with no day at all, so yesterday's totals were
   * still on screen this morning and simply kept counting up. Built from local
   * getters, never toISOString(): that yields the UTC day, which is the previous
   * date for the first 7 hours of every day in UTC+7.
   */
  dayKey: string;
  /**
   * Is there a real foreground window to time? Without this the store happily
   * accumulated a segment while nothing was being tracked, so the total drifted
   * upward for no visible reason.
   */
  hasRealApp: boolean;
  /**
   * External activity session (Gym, Study, …). Its clock is session-scoped, not
   * day-scoped, so it lives separately and simply takes over `displayMs` while
   * running. Owned here rather than in DashboardPage's `useState` because the
   * sidebar has to show it too, and page-local state dies on every navigation.
   */
  external: { running: boolean; startedAtMs: number; label: string };
  /** bumped only by a real user/AFK reset */
  resetCount: number;
  listeners: Set<() => void>;
```
```ts
const store: Store = hydrate();

let snapshot: StopwatchSnapshot = computeSnapshot();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function computeSnapshot(): StopwatchSnapshot {
  const live = liveSegment();
  const productiveMs = store.productiveAccumulatedMs + (store.activeTier === 'productive' ? live : 0);
  const distractingMs = store.distractingAccumulatedMs + (store.activeTier === 'distracting' ? live : 0);

  // ── Which total is on screen ────────────────────────────────────────────
  // ONE decision, made here, so every surface shows the same number. It used to
  // be reimplemented per component: the sidebar showed App.tsx's per-app
  // `elapsedTime` (seconds, zeroed on every window switch) while the dashboard
  // showed these totals (ms, day-scoped) — two clocks, so they never matched.
  let displayMs: number;
  let displaySource: StopwatchSource;
  if (store.external.running && store.external.startedAtMs > 0) {
    displayMs = Math.max(0, Date.now() - store.external.startedAtMs);
    displaySource = 'external';
  } else if (store.activeTier === 'distracting') {
    displayMs = distractingMs;
    displaySource = 'distracting';
  } else {
    displayMs = productiveMs;
    displaySource = store.paused ? 'idle' : 'productive';
  }

  return {
    productiveMs,
    distractingMs,
    paused: store.paused,
    activeTier: store.activeTier,
    displayMs,
    displaySource,
    resetCount: store.resetCount,
    externalLabel: store.external.label,
  };
}

/** ms earned by the segment currently in flight, or 0 when not running. */
function liveSegment(): number {
  if (store.paused || store.runningSinceMs === 0) return 0;
  if (store.external.running) return 0; // the external clock owns the readout
  if (!store.hasRealApp) return 0;
  if (Date.now() - store.lastInteractionAtMs > idleThresholdMs()) return 0;
  return Date.now() - store.runningSinceMs;
}

function emit() {
  snapshot = computeSnapshot();
```
```ts
354:  halt(): void {
371:  setTier(tier: StopwatchTier): void {
445:  reset(): void {
```

Two live defects in this file's consumers:
- `StopwatchSnapshot` exposes `activeTier`, **not** `tier`. Reading `.tier` yields `undefined`.
- `halt()` stops the current segment but is **not** a persisted pause/resume toggle.

**Anti-pattern this replaced:** two surfaces once showed different values for "the same" number
because one was a per-component `useState` counter in seconds and the other read a module-scope
store in milliseconds. There must be exactly ONE field and ONE formatter, living at module scope.

## 12. Design constitution — LAMINAR, non-negotiable
From `RESULT.md` §7.1, verbatim:

```yaml
design_laws:
  radius:
    allowed: [8px, 12px, pill]
    forbidden: [16px, 20px, 24px, arbitrary_large_card_radii]

  glass:
    backdrop_blur: forbidden
    glassmorphism_chrome: forbidden

  motion:
    spring: forbidden
    bounce: forbidden
    hover_scale: forbidden
    animated_counters: forbidden
    decorative_gradients: forbidden
    decorative_glow: forbidden

  typography:
    max_font_families_per_expanded_view: 2
    allowed_system: [Inter, JetBrains Mono, Space Grotesk]
    time_numerals: tabular_monospace
    seconds: de_emphasized

  iconography:
    source: lucide
    emoji: forbidden

  reduced_motion:
    required: true
```

## 13. Sizes and geometry, measured

```
compact surface      232 x 40
expanded surface     460 x 236   (canvas budget 460 x 276 after clamp)
canvas               520 x 300   (MAX_CANVAS_WIDTH x MAX_CANVAS_HEIGHT)
expanded click rect  460 x 236   <- the ONLY region that may receive a click
collapsed trigger    232 x 40    <- the ONLY region that may open the island (padX/padY = 0)
leaveMarginPx        24          (tolerance added at poll time)
openDelayMs          110
closeDelayMs         280
type sizes           5 roles: micro 9, eyebrow 10, label 11, value 13, display 28
font families        2: Inter, JetBrains Mono
radii                8 / 12 / pill only. Expanded caps `capsule` at 12 (a 9999 pill on a
                      460x236 box is a lozenge, not a capsule).
backdrop-filter      removed — forbidden on chrome
```

## 14. Process and verification rules the implementer must obey

- `dist/` and `dist-electron/` ARE the running application. Never delete them.
- An agent NEVER runs a build. CZ builds.
- There is no test runner. Use scoped `tsc`, `esbuild` parse, and probes that PRINT NUMBERS.
- A repo-wide `tsc --noEmit` reports 8,000+ pre-existing errors, and suppresses ALL semantic
  diagnostics whenever any file has a syntax error. Use a throwaway tsconfig with `"files": [...]`.
- Scope every check to the files you touched.
- Claim files before editing them; other agents are working in the same tree.
- Never `pkill node`. Kill only PIDs you recorded starting.
- A probe that prints numbers finds what reading cannot — but when a probe assertion fails,
  check whether the EXPECTATION is wrong before changing the code. A correct `unionRect` was
  nearly "fixed" because a hand-computed constant was wrong.
- Never fabricate data. A stored value that is never read looks identical to one that works.
```

## 15. What is already DONE — do not redo it

- Wayland/X11 backend, transparent window, placement verified live (`placement-ok`).
- Hover + click region separated; per-phase trigger rects (this bundle §1).
- Slot model with 3 lanes, rotation, dwell, honest-empty copy, show/hide/order/maxVisible.
- Shapes `capsule` / `notch` / `square`, phase-aware radii.
- Design system: 5-role type scale, 2 font families, radii `{8,12,pill}`, no backdrop blur,
  reduced-motion honoured.
- `aiUsage` + `hud` producers wired against the real schemas, with `null`-vs-`0` semantics.
- Settings UI for show/hide, order, maxVisible, shape, hitbox padding.
- Probes: pure slot model 63/63, halo-core 33/33, trigger laws 19/19.

## 16. What is NOT done — the actual remaining work

- `focus`, `nextDeadline`, `critical`, `afkGap`, `tierBreakdown`, `clock`, `pinnedActivity`
  have **no producer**. `nextDeadline` is the cheapest win: `deadlines` + `reminders` tables
  already exist, so it is a read.
- The `empty` state is genuinely missing from the card component (loading + error exist).
- `critical` was in the `resident` lane, which the spec forbids for the side rail.
- The stopwatch: cross-window proof against the running app with a detected app has never been
  done, and the two defects in §11 are unfixed.
- The surface has no product name.
- No MCP-sourced components were ever pulled; PAINT's source phase was skipped for lack of a
  registry tool. Do not claim otherwise.
```

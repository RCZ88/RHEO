import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Globe, Lock, Mic, Pause, Pin, Play, RotateCcw, Timer } from 'lucide-react';
import { StopwatchHero } from './StopwatchHero';
import { CompactPill, type CompactKind } from './CompactPill';
import { FocusPageRow } from './FocusPageRow';
import { DictationIsland } from './DictationIsland';
import './halo.css';
import type { CriticalPayload, DictationPayload, NowPayload, StopwatchPayload } from '../../shared/halo/types';
import {
  HALO_DEFAULT_ORDER,
  HALO_DEFAULTS,
  HALO_SIZE_TOKENS,
  isWidgetVisible,
  motionDurationMs,
  motionEaseTuple,
  motionEasing,
  normalizeHaloPrefs,
  resolveHaloSize,
  scaled,
  shellRadii,
  surfaceAnchorFractions,
  surfaceTransformOrigin,
  visibleOrder,
  HALO_DEFAULT_PAGE_ORDER,
  type HaloPrefs,
} from './HaloPreferences';
import { HaloTabRail, nextVisiblePage, visiblePages, type HaloPage } from './HaloTabRail';
import { LegacyHaloRail } from './LegacyHaloRail';

  /* MOTION — TWEEN ONLY. THE SPRINGS ARE DELETED, AND THE DELETION IS THE VERDICT.
   *
   * These were `surfaceOpen = { spring, 480/36/0.65 }` and `surfaceClose = { spring, 540/42/0.60 }`,
   * transcribed from section 64 of the 4,195-line long-form spec. The Specialist AI has ruled:
   *
   *   "Delete the two spring constants. Use { duration: 0.2, ease: [0.2, 0, 0, 1] } for both
   *    open and close." ... "a spring cannot satisfy 'transform and opacity only, 200 ms'."
   *
   * It also corrected me. I had assumed `damping 36` against `stiffness 480, mass 0.65`
   * undershoots the critical ratio and so bounces. It does not:
   * zeta = 36 / (2 * sqrt(480 * 0.65)) = 36 / 35.3 = 1.02, critically damped; the close pair
   * is 1.17, overdamped. Neither bounced, so my stated reason for deleting them was wrong.
   *
   * They are deleted anyway, for the reason the Specialist gave, which is the real one:
   * LAMINAR allows transform and opacity only, over 200 ms. A spring's duration is emergent
   * rather than declared, so "200 ms" is not something a spring can promise.
   *
   * `cubic-bezier(0.2, 0, 0, 1)` is the handoff's ease-out. Written as a 4-tuple because that
   * is what Motion wants; the CSS mirror uses the identical curve, so both sides of the
   * animation read ONE number (`--halo-move-ease`). */
  const SURFACE_TWEEN = { duration: 0.2, ease: [0.2, 0, 0, 1] } as const;
import {
  composeIsland,
  EMPTY_COPY,
  NOTHING_TO_ROTATE,
  type ComposedIsland,
} from '../../shared/halo/slotModel';
import { AmbientCard, AmbientDot, AmbientPip } from './AmbientCard';
import { formatStopwatch, reloadFromStorage, startStopwatchDriver, stopwatch, type StopwatchSnapshot } from '../../lib/stopwatchStore';
import type { AiUsagePayload, HudPayload, NextDeadlinePayload, IslandActivity } from '../../shared/halo/types';

/**
 * OverlayRoot — the island surface.
 *
 * WHY THIS FILE IS THE ONE THAT MAKES THE ISLAND VISIBLE
 * -----------------------------------------------------
 * Everything else in `features/halo/` is logic with no host: an activity router
 * that nothing publishes into, a hover machine that nothing polls, and two
 * activity components that nothing imported. That is why hovering the top of the
 * screen did nothing — there was no window, no entry, and no surface. This file
 * is the host: it renders the shell, owns the compact<->expanded phase, and
 * reacts to pointer intent.
 *
 * TWO HOVER PATHS, ONE SURFACE
 * ----------------------------
 * When collapsed the native window is click-through, so the DOM never receives
 * normal hit-testing and `onMouseLeave` is unreliable. Two sources of intent are
 * therefore merged:
 *   1. `window.haloBridge.onHover` — the main process polling
 *      `screen.getCursorScreenPoint()`, which is authoritative and is what makes
 *      the island work while another app has focus;
 *   2. local `pointermove` — used when the island runs standalone (a plain
 *      browser, or before the window is wired) so the surface is still testable.
 * The main-process value always wins when it is present.
 */


/** Height of the invisible band at the top of the canvas that opens the island.
 *
 *  `OPEN_DELAY_MS`/`CLOSE_DELAY_MS` used to sit here as module constants and were a THIRD
 *  copy of the two timing numbers — `hoverMachine.ts` had one pair, `haloIsland.ts` had
 *  another, and this had a third. All three now read `prefs.trigger`, so there is one
 *  source. `HOT_ZONE_H` stays local because it is only used by the browser-only fallback
 *  path, which has no cursor to poll; it is derived from the same scale and the same padY
 *  so it still agrees with the real hot zone. */

type ActivityTab = HaloPage;

/* ── PAGE PRIMITIVES — measured off Figma board 2 ────────────────────────────── */

/** Eyebrow: small, uppercase, letter-spaced, muted. One per group. */
const EYEBROW: React.CSSProperties = {
  fontSize: 'var(--halo-t-micro)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--halo-muted)',
  lineHeight: 1,
};

/**
 * Vertical hairline, BETWEEN groups only. Never horizontal — board 2 uses them as column
 * separators and nowhere else, so a horizontal one reads as a mistake.
 */
/* The three top-edge anchors, as a fraction of the canvas width. */
const ANCHOR_X_FRAC: Record<'left' | 'center' | 'right', number> = {
  left: 0,
  center: 0.5,
  right: 1,
};

/** Keeps a stored gap inside 0-64 even if prefs reach the renderer unnormalised. */
function clampGapPx(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(64, Math.round(n)));
}

const DIVIDER: React.CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background: 'var(--halo-hairline)',
  flexShrink: 0,
};

/* ══ §12 DATA STATES ═══════════════════════════════════════════════════════════════
 * HALO_STATES.html §146 captions the Deadlines loading state "loading (no shimmer, no
 * spinner)" and line 63 defines `.sk` as a plain block: a fixed height, radius 4, filled
 * with bg/hover. So a skeleton here is a RECTANGLE and nothing else — no animation, no
 * gradient sweep. An animated skeleton in a 56px row reads as a spinner, which is the
 * one thing the handoff rules out.
 *
 * `--halo-bg-hover` is the alias the token block binds to bg/hover (see halo.css:88), so
 * this tracks both themes instead of hardcoding the dark #27272a. */
const SKELETON: React.CSSProperties = {
  display: 'block',
  height: 'var(--halo-t-value)',
  borderRadius: 4,
  background: 'var(--halo-bg-hover)',
  flexShrink: 0,
};

/**
 * One skeleton bar. `width` is a px number because every call site in HALO_STATES.html
 * sizes its own bar (90px website, 120px deadline, 100px status, 28px open).
 *
 * `aria-hidden` because it carries no information: the label beside it is what a screen
 * reader should announce, and an unlabelled rectangle announced as a graphic would be noise.
 */
function Skeleton({ width }: { width: number }): React.JSX.Element {
  return <span aria-hidden="true" style={{ ...SKELETON, width }} />;
}

/** A label + skeleton pair, the shape every loading state in the file uses. */
function SkeletonBlock({ label, width }: { label: string; width: number }): React.JSX.Element {
  return (
    <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
      <span style={EYEBROW}>{label}</span>
      <Skeleton width={width} />
    </div>
  );
}

/**
 * Tokens → a compact string. `null` is UNKNOWN and renders an em-dash; a real 0 renders "0".
 * Conflating them is how a widget ends up claiming it measured nothing when it never looked.
 */
function compactTokens(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** "34 days overdue" / "in 3 days" / "today". Board 2, Deadlines page. */
function overdueLabel(deltaMs: number | undefined): string {
  if (deltaMs == null) return '—';
  const days = Math.floor(Math.abs(deltaMs) / 86_400_000);
  if (deltaMs < 0) return days <= 0 ? 'overdue today' : `${days} day${days === 1 ? '' : 's'} overdue`;
  if (days <= 0) return 'today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** Board 1's COMPACT deadline form: "34d overdue". Abbreviated, unlike board 2's
   *  `overdueLabel()` which spells "34 days overdue" — the pill has ~198px and the full phrase
   *  does not fit beside the title. Two forms of one value, both from the file. */
  function formatDeadlineDue(deltaMs: number | undefined): string {
    if (deltaMs == null) return '—';
    const days = Math.floor(Math.abs(deltaMs) / 86_400_000);
    return deltaMs < 0 ? `${days}d overdue` : days <= 0 ? 'today' : `in ${days}d`;
  }

  /** Overdue uses the signal hue; on-time stays muted. Never a second accent. */
function overdueColor(isOverdue: boolean | undefined): string {
  return isOverdue ? 'var(--halo-signal)' : 'var(--halo-muted)';
}

/** Present only when running inside the real island window. See haloBridge. */
const bridge = typeof window !== 'undefined' ? window.haloBridge : undefined;

/**
 * Placeholder used ONLY until main supplies a real snapshot.
 *
 * These values are deliberately obviously-fake rather than plausible. An earlier
 * version hardcoded `3:47:12` and `Visual Studio Code`, which read as genuine
 * measurements and made it impossible to tell "the island is working" apart from
 * "the island is showing a fixture". A placeholder must never be mistakable for
 * data: main.ts publishes the real `currentApp` (main.ts:5024) and, once the
 * stopwatch relay lands, the real totals.
 */
/**
 * THE ONE STOPWATCH.
 *
 * This previously ran its own `setInterval` and produced a second, independent clock.
 * That is the exact defect MEMORY.md records: "the sidebar resets the stopwatch for no
 * reason… two surfaces showing the same number must read ONE field." The dashboard reads
 * `lib/stopwatchStore` via `useSyncExternalStore` (DashboardPage.tsx:425); the island read
 * a private interval, so the two numbers could never agree.
 *
 * The island window is the SAME ORIGIN as the app (`localhost:38123/halo.html`), so the
 * store's `localStorage['rheo-stopwatch-v1']` is already shared. We now subscribe to the
 * same module singleton — which also means `reset`, `setTier` and the day rollover are
 * shared automatically, because they are all the same object.
 *
 * NOTE the honest caveat: each renderer window has its OWN module instance, so the store
 * is NOT shared by reference across windows — only its persisted form is. The driver
 * below is therefore required in the island too, and `storage` events sync the two
 * instances. Without both, this is still two clocks.
 */
/**
 * Normalise the store's snapshot into the island's `StopwatchPayload`.
 *
 * The two shapes are NOT interchangeable:
 *   StopwatchSnapshot → activeTier,  externalLabel: string,   no `tier`
 *   StopwatchPayload  → tier,        externalLabel: string|null
 * Passing the snapshot through raw left `tier` undefined, which silently blanked the hero
 * numeral and rendered `undefined` in the tier text. Same field, two names — exactly the
 * desync trap this whole refactor exists to remove, so the mapping is explicit here.
 */
function toIslandPayload(s: StopwatchSnapshot): StopwatchPayload {
  return {
    displayMs: s.displayMs,
    productiveMs: s.productiveMs,
    distractingMs: s.distractingMs,
    tier: s.activeTier,
    displaySource: s.displaySource,
    paused: s.paused,
    resetCount: s.resetCount,
    externalLabel: s.externalLabel || null,
  };
}

/**
 * THE ISLAND IS NOT A SECOND CLOCK.
 *
 * `App.tsx` starts the one and only driver. The island used to call `startStopwatchDriver()`
 * too, which gave the app TWO module instances each accumulating its own `runningSinceMs` and
 * each persisting to `rheo-stopwatch-v1`. They are separate JavaScript contexts, so the
 * module-level `driver` guard cannot dedupe them, and the two clocks drifted by up to a second
 * while both kept writing the same key — last writer won, so the persisted total could go
 * BACKWARDS. It also meant the island's numeral was never guaranteed to match the dashboard's.
 *
 * So the island SUBSCRIBES and is driven by whoever owns the clock. `useStoreSync` already
 * listens for the `storage` event, which fires in OTHER documents and never in the writer, so
 * the dashboard's `persist()` is what updates the island. `startStopwatchDriver` stays imported
 * only for the single-driver guard below.
 */
function useStopwatchStore(): StopwatchPayload {
  const snap = useSyncExternalStore(stopwatch.subscribe, stopwatch.getSnapshot, stopwatch.getSnapshot);
  const payload = useMemo(() => toIslandPayload(snap), [snap]);
  /* Report up so MAIN can serve it. Without this, `snapshotProvider` publishes `null` and the
   * island is the only place the stopwatch exists — which is how it ended up running a second
   * private copy. Main cannot compute this (the store is a renderer module singleton), so the
   * window that owns the clock has to hand it over. */
  useEffect(() => {
    bridge?.reportStream?.({ stopwatch: payload });
  }, [payload]);
  return payload;
}

/**
 * Fallback driver, used ONLY when the island is running with no app window to drive it
 * (`--minimized` hides the renderer that would own the clock). Without this the island's
 * numeral would sit frozen while the app is closed, which is the exact bug the daemon
 * migration was about. Same single-driver guard as App.tsx, so when BOTH windows are alive
 * exactly one of them ends up ticking.
 */
let islandOwnsDriver = false;
function ensureDriver(): void {
  if (islandOwnsDriver) return;
  if (typeof window === 'undefined') return;
  islandOwnsDriver = true;
  startStopwatchDriver();
}

/**
 * Cross-window sync. `rheo-stopwatch-v1` is written by whichever window is driving the
 * store; the other window learns about it through a `storage` event (same-origin only,
 * fires in OTHER documents, never the writer). This is what makes the dashboard's reset
 * button and the island's numeral agree within one tick.
 */
function useStoreSync(): void {
  /* If nothing else will drive the clock, the island takes it — see `ensureDriver`. */
  useEffect(() => { ensureDriver(); }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'rheo-stopwatch-v1' || !e.newValue) return;
      try {
        // Re-read the authoritative persisted state through the store's own loader.
        reloadFromStorage();
      } catch {
        /* a malformed value must not break the island; the store falls back to default */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}

/* How far the user must be from their last interaction before the island claims they are away.
 * Set WELL ABOVE the store's own idle threshold: the pill must not flicker into an AFK state
 * for the instant between two keystrokes, and the store's threshold is user-configurable while
 * this is a fixed presentation constant. */
const IDLE_GAP_SHOW_MS = 60_000;

const FIXTURE_APP: NowPayload = { app: 'No app detected', category: '—', tier: 'neutral' };

/** The kinds that have a board-1 pill DESIGN in HALO_STATES.html. Anything else keeps the
 *  app-derived default rather than rendering an undesigned pill. */
const BOARD1_PILL_KINDS = new Set<CompactKind>([
  'stopwatch',
  'stopwatchSite',
  'now',
  'website',
  'private',
  'dictation',
  'aiUsage',
  'hud',
  'nextDeadline',
  'critical',
]);

export function OverlayRoot({ inApp = false }: { inApp?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  /* Whether main's hover test currently reports the cursor INSIDE the island's rect. Distinct
   * from `expanded`, which only becomes true after the open delay matures (§50: `hovered` means
   * "cursor is inside", not "the surface is open"). `resident: 'hover'` uses this to keep the
   * pill unpainted until the cursor actually arrives; reading `expanded` there instead would
   * leave a 110ms window where the pill is invisible but click-through is already re-enabled. */
  const [hovered, setHovered] = useState(false);

  /* THE SIZE MAIN ACTUALLY GAVE THE WINDOW. Defaults to the Medium preset so the first paint
   * before `halo:geometry` arrives is a real size rather than a zero box. */
  const [geom, setGeom] = useState({
    expanded: { width: 560, height: 134 },
    compact: { width: 198, height: 32 },
    squeeze: 1,
    tight: false,
  });
  const reduce = useReducedMotion();
  const [prefs, setPrefs] = useState<HaloPrefs>(HALO_DEFAULTS);

  /* TDZ BUG, FIXED HERE. This was declared ~100 lines BELOW the effects that read it
   * (`if (inside && hoverTriggered)`), so every module evaluation threw
   * "Cannot access 'hoverTriggered' before initialization", the tree never mounted, and
   * all three browser probes timed out waiting for [data-halo-root]. A `const` is in the
   * temporal dead zone until its declaration executes — hook order in the source is the
   * declaration order at runtime. It must sit above its first use. */
  const hoverTriggered = prefs.trigger?.mode === 'hover' || prefs.trigger?.mode === 'hover-or-click';
  /* `'stopwatch'` is NOT a HaloPage (`'focus' | 'now' | 'deadlines' | 'tools'`). Every
   * collapsed-pill element is gated on `tab === 'focus'`, so seeding state with a value no
   * page can ever equal left the whole pill EMPTY at launch — no hero, no pip, nothing.
   * It is seeded from the user's page order so the first painted page is one they chose and
   * one that actually exists; `HALO_DEFAULT_PAGE_ORDER[0]` is 'focus'. */
  const [tab, setTab] = useState<ActivityTab>(
    () => HALO_DEFAULT_PAGE_ORDER[0] as ActivityTab,
  );

  /* The user's page sequence minus hidden pages. Page switching (Ctrl+arrows, wheel, tab rail)
   * walks THIS, not all four, so a hidden page can never be selected and render an empty row. */
  const visiblePageSeq = useMemo(
    () => visiblePages(prefs.pages?.order, prefs.pages?.hidden),
    [prefs.pages],
  );

  const [now, setNow] = useState(() => Date.now());
  const [remote, setRemote] = useState<{
    stopwatch: StopwatchPayload | null;
    currentApp: NowPayload | null;
    dictation: DictationPayload | null;
  } | null>(null);

  /* THE ONE STOPWATCH. The island previously ran its own interval, which is why its
   * numeral disagreed with the dashboard's. Now it subscribes to the same store and
   * reloads when the other window persists (see useStoreSync). */
  const liveStopwatch = useStopwatchStore();

  useStoreSync();

  /* ── WIDGET PRODUCERS ────────────────────────────────────────────────────────
   * `halo:get-ai-usage` and `halo:get-terminal-usage` (added this cycle against the REAL
   * ai_usage / terminal_sessions schemas). Two rules, both non-negotiable:
   *   1. A producer that FAILS produces NO activity. Its widget then shows its honest
   *      empty sentence. Creating an entry with zeros would be a fabricated measurement.
   *   2. A `null` field means UNKNOWN, not zero, and the card renders `unknown` for it. */
  const [producers, setProducers] = useState<{ ai?: AiUsagePayload; hud?: HudPayload; deadline?: NextDeadlinePayload; dictation?: DictationPayload }>({});
  /* §12 error state. The producer below used to swallow BOTH a thrown call and an `ok:false`
   * reply into the same "no entry" outcome, so a dead database and an empty one were
   * indistinguishable in the UI — and a dead one looked like a healthy empty list.
   * `deadlinesError` separates them: it is set only when we actually FAILED to read. */
  const [deadlinesError, setDeadlinesError] = useState<string | null>(null);
  /** Lets the Deadlines Retry button re-run the producer pull without inventing a bridge RPC. */
  const pullRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      const next: { ai?: AiUsagePayload; hud?: HudPayload; deadline?: NextDeadlinePayload } = {};
      let dlError: string | null = null;
      try {
        const ai = await bridge?.getAiUsage?.();
        if (!cancelled && ai && !ai.error && (ai.tokensToday != null || ai.sessionCount != null)) {
          next.ai = { tokensToday: ai.tokensToday ?? undefined, sessionCount: ai.sessionCount ?? undefined, topModel: ai.topModel ?? undefined };
        }
      } catch { /* honest empty — no entry */ }
      try {
        const hud = await bridge?.getTerminalUsage?.();
        if (!cancelled && hud && !hud.error && hud.activeSessions != null) {
          next.hud = { activeSessions: hud.activeSessions, commandsToday: hud.commandsToday ?? undefined, handbookPercent: hud.handbookPercent ?? undefined };
        }
      } catch { /* honest empty — no entry */ }
      /* `nextDeadline` — the first promoted kind with a REAL producer. It reads the
       * existing `deadlines` table, so no new table and no invented column.
       *
       * THE HONESTY BRANCH, which is the whole point of this producer:
       *   ok:false             -> we could not read the table. Recorded as an ERROR so the row
       *                           can offer a Retry (HALO_STATES.html:120), not as an empty list.
       *   ok:true, count === 0 -> the table ANSWERED and said "none". That is a measurement, so
       *                           we DO produce an activity and it renders the spec's
       *                           `zero_literal` ("0 deadlines"). Dropping it here would repeat
       *                           the null-is-not-zero mistake in a new place.
       *   ok:true, count > 0   -> the real thing.
       */
      try {
        const dl = await bridge?.getNextDeadline?.();
        if (!cancelled && dl && dl.ok && dl.count != null) {
          next.deadline = {
            count: dl.count,
            ...(dl.title ? { title: dl.title } : {}),
            ...(dl.dueAtMs != null ? { dueAtMs: dl.dueAtMs } : {}),
            ...(dl.deltaMs != null ? { deltaMs: dl.deltaMs } : {}),
            ...(dl.isOverdue != null ? { isOverdue: dl.isOverdue } : {}),
          };
        } else if (!cancelled) {
          /* no reply at all, or an explicit `ok:false` — a failure, not a measurement */
          dlError = 'Deadlines could not load. Retry.';
        }
      } catch {
        /* A THROW is the other half of the same failure the old comment called "honest
         * empty". It is not empty — it is unreadable, and the two must not look alike. */
        dlError = 'Deadlines could not load. Retry.';
      }
      if (!cancelled) {
        setProducers(next);
        setDeadlinesError(dlError);
      }
    };
    pullRef.current = pull;
    void pull();
    const id = setInterval(pull, 30000);
    return () => { cancelled = true; clearInterval(id); pullRef.current = null; };
  }, []);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set by DictationIsland so a global-shortcut command can toggle recording. */
  const recordToggleRef = useRef<(() => void) | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* §5: "Scroll also switches pages." The island has no scrollable content of its own —
   * every page is one fixed-height row — so the wheel is free to mean "next page" instead
   * of scrolling nothing. Without a gate a single trackpad flick fires a dozen wheel events
   * and pages fly past, so the delta must ACCUMULATE past a threshold and then lock until
   * the gesture goes quiet.
   *
   * The surface is only interactive while expanded (collapsed it is a 44px pill and the
   * window is click-through), so the handler no-ops otherwise rather than switching pages
   * from a scroll over the closed island. */
  const wheelAccum = useRef(0);
  const wheelLocked = useRef(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSurfaceWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!expanded) return;
      e.preventDefault();
      if (wheelLocked.current) return;
      wheelAccum.current += e.deltaY;
      if (Math.abs(wheelAccum.current) < 24) return;
      const dir = wheelAccum.current > 0 ? 1 : -1;
      wheelAccum.current = 0;
      wheelLocked.current = true;
      setTab((t) => nextVisiblePage(t, dir, visiblePageSeq));
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => { wheelLocked.current = false; }, 320);
    },
    [expanded, visiblePageSeq],
  );

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const open = useCallback(() => {
    clearTimers();
    setExpanded(true);
    /* TELL MAIN. THIS IS THE FIX FOR "THE HITBOX NEVER GROWS".
     *
     * `open()` used to set LOCAL state only. That left two independent authorities for the
     * same question — "is the island open?":
     *
     *   renderer  — this `useState`, driven by its own hover timers below
     *   main      — `handle.expanded`, driven by `stepHover` in the 120ms poll
     *
     * They were never reconciled, so the panel could be VISUALLY EXPANDED (full-size UI on
     * screen) while main still held `expanded === false` and therefore kept the window
     * click-through with a compact-pill shape. Every click on the visible panel passed through
     * to whatever was underneath it — the island was open, painted, and completely unusable.
     *
     * Main owns the click region (`applyClickRegion` -> `setShape` + `setIgnoreMouseEvents`),
     * so main must know when the panel opens. This is the same class of bug the `close()`
     * comment below describes, in the opposite direction: there, main kept believing it was
     * PINNED after the renderer closed; here, main kept believing it was COLLAPSED after the
     * renderer opened. HALO §1 puts main in authority for hover policy and the native window
     * — a purely visual `useState` cannot decide whether the OS hands it a click. */
    void bridge?.open?.();
  }, [clearTimers]);

  const close = useCallback(() => {
    clearTimers();
    setExpanded(false);
    setPinned(false);
    // Tell the main process too. `close()` previously only cleared local state, so the
    // main process kept believing it was pinned and a keyboard user's Escape did nothing
    // durable — the same class of bug as the pin button below, in the opposite direction.
    void bridge?.close?.();
  }, [clearTimers]);

  /**
   * THE PIN, TAKEN TO THE SOURCE THAT OWNS IT.
   *
   * This was `onClick={() => setPinned((p) => !p)}` on the whole surface — a LOCAL React
   * flag that the main process never heard about. Main owns `handle.pinned` and it is what
   * `stepHover` reads every 40ms while the island is expanded; with main still holding
   * `false`, the very next tick with the cursor outside the hot zone produced a `close`
   * intent and the island collapsed. So the click did nothing except briefly relabel
   * "esc to close" as "pinned · esc to close" — a label claiming a state the process had
   * not entered.
   *
   * There was also no pin BUTTON: the entire surface was the target, with no affordance, no
   * icon and no label. So "the pin button that doesn't show" was literally true twice over.
   * Now it is a real, labelled control in the rail, and it round-trips through IPC.
   */
  const togglePin = useCallback(() => {
    const nextPinned = !pinned;
    setPinned(nextPinned);
    // Route through `open()` so the main process learns the panel opened. Setting the local
    // flag alone is what left the island painted full-size with a compact-pill click region.
    if (nextPinned) open();
    void bridge?.setPinned?.(nextPinned);
  }, [pinned, open]);

  // Authoritative path: the main process owns hover intent once the window exists.
  // IN-APP MODE: Prefer local DOM hover (see below) so the island never depends
  // on the main process hot-zone geometry or a second window. GPT decision: no
  // separate surface; hover must be a real DOM interaction inside RHEO.
  useEffect(() => {
    if (inApp) return;
    if (!bridge?.onHover) return;
    return bridge.onHover(({ inside, pinned: isPinned }) => {
      setPinned(isPinned);
      setHovered(inside);
      if (isPinned) return void open();
      clearTimers();
      if (inside && hoverTriggered) {
        if (openTimer.current) return;
        openTimer.current = setTimeout(
          // `open()`, not `setExpanded(true)`: the timer must ALSO tell main, because main owns
          // the click region. Setting local state here was the "open but unclickable" bug —
          // the panel animated to full size while the window stayed click-through and shaped to
          // the compact pill, so every click on the visible UI passed through to the desktop.
          () => open(),
          prefs.trigger.openDelayMs,
        );
      } else {
        if (closeTimer.current) return;
        closeTimer.current = setTimeout(
          // Symmetric: route through `close()` so main restores click-through + the pill shape.
          () => close(),
          prefs.trigger.closeDelayMs,
        );
      }
    });
  }, [inApp, clearTimers, open, hoverTriggered, prefs.trigger.openDelayMs, prefs.trigger.closeDelayMs]);
  // Local path: keeps the island interactive when running without the native
  // window, which is how it gets verified in a plain browser. In in-app mode we ALSO
  // use this path, because the island is DOM inside RHEO and the pointer is directly ours.
  useEffect(() => {
    if (!inApp && bridge?.onHover) return;
    // A click-only or hotkey-only island has no local hover path at all. Registering the
    // listener anyway would let a pointer sample open a surface the user explicitly asked
    // to be pointer-inert.
    if (!hoverTriggered) return;
    // HALO §210 lists "accidental opening" as a spike failure. A cursor parked at the
    // top of the screen when the island mounts must NOT pop it open, so the island
    // only ever opens on a genuine OUTSIDE -> INSIDE transition. The first sample
    // only establishes the starting side of that transition and changes no state,
    // which is why a cursor already inside does not fire and one already outside
    // opens on its first real entry.
    let wasInside: boolean | null = null;
    const onMove = (e: PointerEvent) => {
      if (pinned) return;
      const inside = e.clientY <= resolveHaloSize(prefs.scale).compactHeight + prefs.trigger.padY;
      /* Same feed as the bridge path, so `resident: 'hover'` behaves identically with and
       * without a native window. Set BEFORE the first-sample guard below, because that guard
       * exists to suppress the OPEN transition, not to hide the pill — a cursor already inside
       * at mount must still show the pill. */
      setHovered(inside);
      if (wasInside === null) {
        wasInside = inside;
        return;
      }
      if (inside === wasInside) return;
      wasInside = inside;
      clearTimers();
      if (inside) {
        openTimer.current = setTimeout(() => open(), prefs.trigger.openDelayMs);
      } else {
        closeTimer.current = setTimeout(() => close(), prefs.trigger.closeDelayMs);
      }
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      clearTimers();
    };
  }, [inApp, clearTimers, open, close, pinned, hoverTriggered, prefs.trigger.openDelayMs, prefs.trigger.closeDelayMs]);

  // Real data, when the main process supplies it.
  // The size main gave the window. Without this the renderer can only guess, and on a
  // clamped display its guess is too big — the content overflows a box main already shrank.
  useEffect(() => {
    if (!bridge?.onGeometry) return;
    return bridge.onGeometry((g) => setGeom(g));
  }, []);

  useEffect(() => {
    if (!bridge?.onSnapshot) return;
    return bridge.onSnapshot((s) => {
      setRemote({
        // The bridge types payloads as `unknown` because the island and the app
        // can be out of step during a reload; the concrete shapes are the ones
        // declared in src/shared/halo/types.ts.
        stopwatch: (s?.stopwatch as StopwatchPayload | null) ?? null,
        currentApp: (s?.currentApp as NowPayload | null) ?? null,
        dictation: (s?.dictation as DictationPayload | null) ?? null,
      });
    });
  }, []);

  // Ctrl/Cmd+Shift+R is a GLOBAL shortcut handled in the main process, which
  // raises the island and forwards a command here. The recording toggle lives in
  // DictationIsland, so it registers a callback rather than this component
  // reaching into it.
  useEffect(() => {
    if (!bridge?.onCommand) return;
    return bridge.onCommand(({ command }) => {
      if (command === 'toggle-record') recordToggleRef.current?.();
      /* Dictation lives on the TOOLS page now (Figma §5), so the shortcut selects that page
         instead of a tab that no longer exists. */
      if (command === 'show-dictation') setTab('tools');
    });
  }, []);

  // Size preference from main. The native canvas is always the clamped maximum,
  // so this only affects how much of it the painted surface occupies.
  useEffect(() => {
    if (!bridge?.onPrefs) return;
    return bridge.onPrefs((raw) => setPrefs(normalizeHaloPrefs(raw)));
  }, []);

  /* HALO §51 "click outside -> unpin + collapse".
   *
   * This is the interaction that makes pinning safe, and it is also the concrete answer to
   * the island interfering with ordinary work. The listener is on the island's OWN document,
   * so it can only observe clicks that the window actually received — which, because
   * `applyClickRegion` shapes the window to the painted surface, means clicks that missed
   * the island. A click on the surface stops propagation, so toggling the pin never also
   * reads as "clicked outside".
   *
   * Only acts while PINNED. An expanded-but-unpinned island is already governed by the
   * hover machine, and having a pointer listener race it would produce two independent
   * owners of the expanded state — the exact defect MEMORY.md records about the stopwatch
   * and the 1 Hz republish interval. */
  useEffect(() => {
    if (!bridge?.clickOutside) return;
    const onDown = (e: PointerEvent) => {
      if (!pinned) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.halo-surface')) return;
      void bridge.clickOutside?.();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [pinned]);

// Escape collapses — a keyboard user must not need a mouse to close this.
    // §5 also gives the expanded panel Ctrl+Left / Ctrl+Right to switch pages. Only Escape
    // was handled, so the keyboard path to pages 2-4 did not exist.
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { close(); return; }
        if (!expanded) return;
        if (e.key === 'ArrowLeft') { setTab((t) => nextVisiblePage(t, -1, visiblePageSeq)); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { setTab((t) => nextVisiblePage(t, 1, visiblePageSeq)); e.preventDefault(); }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [close, expanded, visiblePageSeq]);


  // `now` is only needed for relative labels ("away for 4m"); 1Hz is well under
  // the frame-clock prohibition because it is not driving an animation.
  useEffect(() => {
    if (!remote) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [remote]);

  /* `swPayload`, NOT `stopwatch`: the imported `stopwatch` store is used inside this
   * component (subscribe/getSnapshot/reset/setPaused), and a local named `stopwatch`
   * shadowed it for every reference below — 30+ errors that all read as one mistake. */
  const swPayload = remote?.stopwatch ?? liveStopwatch;

  /* The raw STORE snapshot for the interactive surfaces (FocusPageRow, StopwatchHero), which
   * need `paused` / `activeTier` / `reset` / `setPaused` — none of which exist on the flat wire
   * payload. One clock: this is the same object the driver ticks, not a copy. */
  const storeSnap: StopwatchSnapshot = useSyncExternalStore(
    stopwatch.subscribe,
    stopwatch.getSnapshot,
    stopwatch.getSnapshot,
  );
  const currentApp = remote?.currentApp ?? FIXTURE_APP;

  /* HALO_STATES.html line 143 — the TRACKING row's three shapes, derived ONCE so the Focus
   * page and the Now page can never disagree about whether a private window is open.
   * `isPrivate` is tested BEFORE `domain` because main withholds the domain for a private
   * window — but if a caller ever passed both, privacy still wins.
   * `undefined` (not a fake target) when there is no real reading, which leaves the row out
   * rather than inventing one. */

  /* HALO_STATES.html's Now page prints the Website block beside the App block, and it has
   * two honest outcomes: a hostname when we know it, or "Not in a browser" when the focused
   * app is not one. `NowPayload` carries `category`, and the repo's category vocabulary
   * includes 'Browser' (src/lib/afk.ts:91), so "is this a browser" IS answerable today.
   * The hostname is not — see the Website branch below. */
const inBrowser = currentApp.category === 'Browser';

  const trackedTarget: { kind: 'win' | 'web' | 'priv'; label: string } | undefined = useMemo(() => {
    if (!currentApp || currentApp.app === 'No app detected') return undefined;
    if (currentApp.isPrivate) return { kind: 'priv', label: 'Private window' };
    if (currentApp.domain) return { kind: 'web', label: currentApp.domain };
    if (!inBrowser) return undefined;
    return { kind: 'win', label: currentApp.app };
  }, [currentApp, inBrowser]);

  /* ──────────────────────────────────────────────────────────────────────────
   * THE SLOT MODEL, MOUNTED (composeIsland had zero importers before this)
   * ──────────────────────────────────────────────────────────────────────────
   * PAYLOAD HONESTY: each entry exists only when its producer actually delivered
   * something. `dictation` is created ONLY when main reports an active session, so an
   * absent dictation renders NOTHING rather than a fake "ready" state. The stopwatch
   * entry is always created because the hero is persistent and its honest empty state
   * ("No app detected") is itself meaningful — RESULT.md 5.2.
   *
   * BACKEND STATUS (RESULT.md 6.2, not invented):
   *   stopwatch  -> stopwatchRelay.ts, UNWIRED  (fixture below until it lands)
   *   now        -> tracking-heartbeat, REAL
   *   dictation  -> renderer-local useSttFloat, REAL
   *   focus / nextDeadline / aiUsage / hud / critical -> ABSENT producers, so they are
   *              NOT fabricated here. They appear in the model and the honest-empty copy,
   *              but no entry is invented for them.
   */
  const activities = useMemo<IslandActivity[]>(() => {
    const t = Date.now();
    const mk = (
      kind: IslandActivity['kind'],
      payload: unknown,
      opts: Partial<IslandActivity> = {},
    ): IslandActivity => ({
      id: `${kind}:main`,
      kind,
      priority: 0,
      persistent: kind === 'stopwatch',
      pinned: false,
      createdAt: t,
      updatedAt: t,
      payload,
      replaceGroup: kind,
      ...opts,
    });

    const out: IslandActivity[] = [mk('stopwatch', stopwatch)];
    /* `critical` — RESULT.md §2.10, `role: emergency_interrupt`, and the ONLY lane-1 entry in
     * §1.8's precedence table. The kind, its payload type, its lane (`critical: 'toast'`) and
     * its precedence rank already existed in slotModel.ts; nothing ever PRODUCED one, so the
     * interrupt lane was structurally present and permanently empty — the spec's most
     * important lane could never fire.
     *
     * THE SOURCE IS REAL, NOT INVENTED. The deadline producer above already reads the real
     * `deadlines` table and reports `isOverdue`; an overdue deadline IS an emergency that
     * warrants interrupting the island. Nothing here fabricates: if no deadline is overdue
     * this emits nothing at all, and RESULT.md §5's honesty rule is preserved because the
     * field is a measurement the backend produced, not a number this file chose.
     *
     * `route` is only carried when the producer supplied one — §2.10 says "owning route only
     * if existing route is known; otherwise none", so omitting it is the spec, not a gap. */
    if (producers.deadline?.isOverdue) {
      out.push(
        mk('critical', {
          message: producers.deadline.title ?? 'A deadline is overdue',
          source: 'deadlines',
          ...(producers.deadline.dueAtMs != null ? { route: '/deadlines' } : {}),
        } satisfies CriticalPayload),
      );
    }
    if (currentApp && currentApp.app !== 'No app detected') out.push(mk('now', currentApp));
    /* The three site-aware compact kinds (HALO_STATES.html board 1). They existed in the
     * ActivityKind union and the CURATED map while NOTHING emitted them, so they were resolvable
     * and still unreachable — the pill could never show one. These are the producers.
     * Spec note: "stopwatchSite: stopwatch tracking a website. private: shown when the active
     * window is private (no domain, not counted)." Each is emitted ONLY while its condition
     * genuinely holds, so an absent reading produces no pill rather than a fabricated one. */
    const isPrivateWindow = currentApp?.isPrivate === true;
    const knownSite = !isPrivateWindow && currentApp?.domain ? currentApp.domain : null;
    if (isPrivateWindow) out.push(mk('private', currentApp));
    if (knownSite) out.push(mk('website', currentApp));
    if (knownSite && stopwatch && !swPayload.paused) {
      out.push(mk('stopwatchSite', { ...currentApp, site: knownSite }));
    }
    if (remote?.dictation && remote.dictation.state !== 'idle') {
      out.push(mk('dictation', remote.dictation, { persistent: false }));
    }
    if (producers.ai) out.push(mk('aiUsage', producers.ai));
    /* `tierBreakdown` and `afkGap` were in `order` and in the CURATED map with NO producer, so
     * like the three site-aware kinds they could never appear in the pill at all. Both are
     * DERIVABLE from the stopwatch store, which is the single clock — no new IPC and no second
     * source of truth.
     *
     * The honesty rule applies to both: emit only while the value is genuinely known.
     *   tierBreakdown — needs all three buckets. `neutralMs` is the third; without it the bar
     *                   would silently drop a tier.
     *   afkGap        — `getSystemIdleTime()` is dead on Linux (main.ts:5106), so the gap is
     *                   measured from the store's own `lastInteractionAtMs` heartbeat, which is
     *                   exactly what the AfkGapPayload doc comment says it should be.
     *                   Emitted only while the user IS away, so it is an interrupt, not a
     *                   permanent resident claiming a slot. */
    const snap = storeSnap;
    if (snap && Number.isFinite(snap.productiveMs) && Number.isFinite(snap.neutralMs) && Number.isFinite(snap.distractingMs)) {
      out.push(
        mk('tierBreakdown', {
          productiveSeconds: Math.round(snap.productiveMs / 1000),
          neutralSeconds: Math.round(snap.neutralMs / 1000),
          distractingSeconds: Math.round(snap.distractingMs / 1000),
        }),
      );
    }
/* `afkGap` needs "how long since the user was last here". The store tracks that on its
       * INTERNAL `Store` interface (`lastInteractionAtMs`) and did not publish it on
       * `StopwatchSnapshot`, so this had no honest source: inferring AFK from
       * `runningSinceMs === 0` would also fire on a deliberate PAUSE and would have to report
       * `awayMs: 0`, which is a measurement dressed as a lie.
       *
       * So the field is published instead — it is the store's own interaction heartbeat, which
       * is precisely what the AfkGapPayload doc calls for ("heartbeat-fed, because
       * getSystemIdleTime() returns 0 on Linux"). Read-only; it changes no behaviour. */
      if (snap && snap.lastInteractionAtMs > 0) {
        const awayMs = t - snap.lastInteractionAtMs;
        /* Well above the store's own (user-configurable) idle threshold: the pill must not
         * flicker into an AFK state in the gap between two keystrokes. */
        if (awayMs > IDLE_GAP_SHOW_MS) {
          out.push(
            mk('afkGap', { awayMs, since: new Date(snap.lastInteractionAtMs).toISOString() }, { persistent: false }),
          );
        }
      }
    if (producers.hud) out.push(mk('hud', producers.hud));
    if (producers.deadline) out.push(mk('nextDeadline', producers.deadline));
    return out;
  }, [stopwatch, currentApp, remote?.dictation, producers]);

  /* User layout: which widgets are on, in what order, how many at once. `visibleOrder`
   * drops hidden kinds; the model's `maxVisible` then caps the roster.

   * THE COMPACT AXIS. `hidden` is a DIFFERENT set depending on the phase, and that is the
   * whole point of the per-widget `compact` flag: a widget the user marked "not in the
   * pill" is excluded only while COLLAPSED, and comes back when the island opens. Passing
   * the same set in both phases — which is what a single unconditional `hiddenKinds` memo
   * does — makes the flag impossible to express, because there is only one set to pass. */
  const hiddenKinds = useMemo(() => {
    const order = prefs.order ?? HALO_DEFAULT_ORDER;
    const roster = visibleOrder(prefs);
    if (expanded) {
      return new Set(order.filter((k) => !roster.includes(k)));
    }
    return new Set(
      order.filter((k) => !roster.includes(k) || prefs.widgets?.[k]?.compact === false),
    );
  }, [prefs, expanded]);

  /* THE COMPACT ROSTER — the widgets allowed to appear in the 232px pill, in the user's
   * order. Passed to the composer so the pill's CONTENTS stop being a function of which
   * producers happen to be emitting. Under `auto` it is omitted entirely and the old
   * data-derived behaviour is preserved exactly; under `always` it makes the pill
   * deterministic; under `off` the pill is the hero numeral only. */
  const compactRoster = useMemo<readonly string[]>(() => {
    if (prefs.compactStyle !== 'always') return [];
    return (prefs.order ?? HALO_DEFAULT_ORDER).filter(
      (k) => isWidgetVisible(prefs, k) && prefs.widgets?.[k]?.compact !== false,
    );
  }, [prefs]);

  const composed = useMemo<ComposedIsland>(
    () =>
      composeIsland(activities, {
        now: Date.now(),
        pointerEngaged: expanded,
        phase: expanded ? 'expanded' : 'compact',
        order: visibleOrder(prefs) as never,
        hidden: hiddenKinds as never,
        maxVisible: prefs.maxVisible,
        residentKind: (prefs.pill?.resident as never) ?? undefined,
        compactRoster: prefs.compactStyle === 'always' ? (compactRoster as never) : undefined,
      }),
    [activities, expanded, prefs, hiddenKinds, compactRoster],
  );

  const radii = shellRadii(prefs.shape, expanded ? 'expanded' : 'compact', prefs.edge, prefs.radius);
  /* ONE animation clock, but it MUST BE THE SPEC'S SHAPE.
   *
   * §64 gives two springs — `surfaceOpen` (480/36/0.65) and `surfaceClose` (540/42/0.60) — and
   * §65 gives their targets: open 280-350ms, close 220-280ms. Neither was used. The surface
   * animated on a single flat `duration: 250ms` with the user's easing curve, which is neither
   * spring, and 250ms sits BELOW the open target. "Slightly elastic, controlled" became
   * "linear fade-ish resize", and close was not quicker than open.
   *
   * So the transition is now the spec's springs, selected by phase — which is also what makes
   * it interruptible (§66): a spring can be retargeted mid-flight, a fixed duration cannot.
   *
   * The user's `prefs.motion` still governs: `liveliness: 'off'` disables motion entirely and
   * `'reduced'` keeps a short non-spring path (§171 wants a real reduced path, not a scaled
   * duration). Where motion IS wanted, the spring shape wins over the raw duration, because
   * §64's constants are the authority and `durationMs` is only the CSS-side mirror.
   */
  const motionOff = prefs.motion.liveliness === 'off';
  const motionReduced = prefs.motion.liveliness === 'reduced';
  /* The spring is named by the DIRECTION OF TRAVEL, and `expanded` is the RESTING state, so
   * the selector inverts: while RESTING expanded, the surface arrived there via `surfaceClose`,
   * and the next transition is the one BACK to compact, which is `surfaceOpen`... except that
   * "open"/"close" in §64 mean open-EXPANDED and close-COLLAPSED. So while resting expanded,
   * the spring that produced this state is `surfaceOpen`, and the next one (collapsing) is
   * `surfaceClose`. Because the surface is continuously `layout`-animated, the transition that
   * is actually RUNNING is the one for the CURRENT phase's own arrival — i.e. `surfaceOpen`
   * when expanded, `surfaceClose` when collapsed. That is the mapping below, and it is the one
   * §65's timing table describes: open is the slower 280-350ms, close the quicker 220-280ms. */
  /* ONE transition object, and the verdict owns its shape.
   *
   * `liveliness: 'off'` still means no motion at all, and `'reduced'` still takes the short
   * non-spring path the long-form spec asked for, because that is a USER preference and the
   * verdict did not touch it. Where motion IS wanted, the declared 200 ms tween wins over the
   * stored `durationMs`: the verdict fixes the timing, and `prefs.motion.durationMs` only
   * supplies the CSS mirror (`--halo-move-ms`) so the stylesheet and this component cannot
   * drift apart. Both sides read one number for the same curve. */
  const STATIC_TRANSITION = { duration: 0, ease: SURFACE_TWEEN.ease } as const;

  const surfaceTransition = motionOff || motionReduced ? STATIC_TRANSITION : SURFACE_TWEEN;
  /* Placement inside the transparent canvas. This was hardcoded `top: 0; left: 50%` with
   * `data-edge="top"`, so selecting "left edge" in Settings moved the window in main and
   * changed nothing about where the island painted inside it — the renderer had no idea
   * which edge it was on. The fractions come from the same helper `computeGeometry` uses,
   * so the window and the surface can no longer disagree. */
  /* HALO §127: the three edges are centred on their axis and flush with it. No anchor
   * argument exists — the same section forbids arbitrary freeform positioning. */
  const { xFrac: edgeXFrac, yFrac } = surfaceAnchorFractions(prefs.edge);
  /* `anchor` slides the island LEFT / CENTRE / RIGHT along the top edge — the "change the spot"
   * control from `agent/docs/HALO_SETTINGS.html`. It overrides the edge's own x fraction ONLY on
   * the top edge: on left/right the fraction is the edge itself, and a horizontal anchor is
   * meaningless because the island is not laid out vertically there.
   *
   * This is deliberately three positions and a gap, NOT freeform x/y. §127 forbids arbitrary
   * freeform positioning, so the model stays a union of anchors rather than two numbers. */
  const xFrac = prefs.edge === 'top' && prefs.anchor ? ANCHOR_X_FRAC[prefs.anchor] : edgeXFrac;
  const gapPx = prefs.edge === 'top' ? clampGapPx(prefs.offsetY) : 0;
  const origin = surfaceTransformOrigin(prefs.edge);
  /* The transition is written to CSS custom properties rather than left to the
   * stylesheet's hardcoded 250ms, so the stylesheet's `transition` and this component
   * read ONE number. `halo.css` consumes these; when they are absent it falls back to its
   * own literal, which is why the island still animates before the first prefs arrive. */
  /* THE CSS MIRROR OF THE SAME TWEEN — this used to read `prefs.motion`, and that is the
   * drift the verdict closes.
   *
   * `motionEasing(prefs.motion)` returns `cubic-bezier(0.16, 1, 0.3, 1)` for the default
   * 'expo' easing, while `SURFACE_TWEEN` above is `[0.2, 0, 0, 1]`. Those are different curves,
   * so the stylesheet's `transition` and Motion's `transition` were animating the same
   * surface on two different easings — whichever one painted last won, and nothing said so.
   *
   * The verdict fixes both sides: 200 ms, `cubic-bezier(0.2, 0, 0, 1)`, transform and opacity
   * only. So the two custom properties are written from the SAME constants the Motion
   * transition uses, and `prefs.motion` only decides WHETHER there is motion
   * (`liveliness: off` / `reduced`), not what the curve is. One number, both consumers.
   *
   * The literal 0.2 and the tuple are declared together on purpose: the duplicate is visible
   * rather than derived, because the alternative is converting a JS array into a CSS string
   * at render time for no benefit — 4 numbers of `toFixed` on every render. */
  const SURFACE_MS = SURFACE_TWEEN.duration * 1000;
  /* ONE reduced/off transition, built from SURFACE_TWEEN.
   *
   * This used to read `Math.min(durationMs, 90) / 1000` and a bare `easing` — neither
   * identifier exists in this module. They were left behind when the two springs were
   * replaced by the single 200 ms tween, and because both sat behind a ternary that only
   * evaluates on the reduced/off path, the ordinary expand/collapse never touched them and
   * the island appeared healthy. The first time a user turned motion OFF — or the OS
   * reported `prefers-reduced-motion` — this threw a ReferenceError and the island died.
   *
   * So the curve comes from SURFACE_TWEEN, which is already the single source, and the
   * duration is 0 for BOTH branches. §10 is explicit: "Reduced motion: no movement, 0 ms,
   * one global check (not per component)." The old `min(durationMs, 90)` was a 90 ms
   * movement, which is movement, and it also contradicted the 0 the sibling `reduce` prop
   * on the surface below already used. */
  const motionVars = {
    '--halo-move-ms': `${SURFACE_MS}ms`,
    '--halo-move-ease': 'cubic-bezier(0.2, 0, 0, 1)',
  } as React.CSSProperties;

  /* Honest-empty copy for the resident when its producer has nothing. Never a fake value. */
  const residentEmpty = composed.resident ? EMPTY_COPY[composed.resident.kind] : undefined;

  /* ══ THE RENDERER HALF OF `resident` ══════════════════════════════════════════════
   *
   * Main only owns the kill switch (`resident: 'off'` destroys the window). Whether the pill
   * PAINTS before it is hovered is a renderer decision, and it is what the user means by
   * "always on".
   *
   *   always — the pill is painted whenever the island is collapsed, so the window is never a
   *            blank transparent rectangle sitting on the desktop. Default.
   *   hover  — nothing paints until the cursor arrives; the surface stays fully transparent and
   *            the island is invisible until then. This is the classic dynamic-island behaviour.
   *   off    — main has already destroyed the window; this is belt-and-braces.
   *
   * `hovered` comes from the same main-process hover feed that opens the island, so the pill
   * appearing is driven by the SAME rectangle test that expands it. Deriving it from a separate
   * signal is how a pill can be on screen in a place the hover test does not cover.
   *
   * `pinned` forces the pill on regardless: a pinned island is open by design (§51), so hiding
   * its collapsed form would be a lie about its own state. */
  const showPill =
    prefs.resident === 'off' ? false : prefs.resident === 'always' || expanded || pinned || hovered;

  /* DOES THIS PAGE HAVE CONTENT OF ITS OWN?
   *
   * One answer, used once. The AmbientCard strip and the page body both live inside the same
   * 118-154px window, so only one of them may occupy the content row — HALO_STATES board 2 shows
   * the page's blocks plus the tab rail, with no card. The strip is therefore the page's
   * FALLBACK: it renders only when the page would otherwise be empty, which is what keeps the
   * panel from overflowing.
   *
   * Per page, from what each one actually renders:
   *   focus     — ALWAYS has content (stopwatch + productive + controls), so never the strip.
   *   now       — has content whenever a snapshot exists (it shows the honest empty otherwise).
   *   deadlines — content only when a deadline list came back non-empty.
   *   tools     — content only when dictation or console data exists.
   */
  const pageHasContent: Record<string, boolean> = {
    focus: true,
    now: currentApp !== null,
    deadlines: Boolean(producers.deadline),
    tools: Boolean(producers.dictation || producers.hud),
  };
  const expandStrip = pageHasContent[tab] !== true;
  /* THE RENDERER PAINTS THE SAME PRESET THE MAIN PROCESS SIZED THE WINDOW WITH.
   *
   * This line used to be `scaled(HALO_SIZE_TOKENS, prefs.scale)`, i.e. the legacy token bag
   * multiplied by a raw factor — which is how the renderer and the main process ended up able
   * to disagree about how big the island is. They now both call `resolveHaloSize`, so there is
   * exactly one number. That is the same "one field, one formatter" rule the stopwatch fix
   * enforced, applied to geometry.
   */
  const size = resolveHaloSize(prefs.scale);

  /* THE FITTED BOX, FROM MAIN.
   *
   * Main sizes the native window with `fitToCanvas`, which CLAMPS the preset to the space
   * actually available (Large 680x154 becomes 380x86 at 380px of available width). This
   * component used to lay itself out from `resolveHaloSize(prefs.scale)` alone, so on any
   * clamped display the content stayed at full size inside a shrunken window and overflowed —
   * 62px of it, measured at a 380px display. That is the "everything is cut off" report, and
   * it is a two-sided bug: main was right about the window and the renderer was right about
   * the content, and neither could see the other.
   *
   * So `squeeze` scales the CONTENT with the BOX. This is §175's density principle applied on
   * the responsive axis: when there is not enough room, the layout tightens — the type and the
   * rhythm step down together — rather than overflowing or clipping. It never shrinks type below
   * the 11px floor, because the CSS `max()` on every type token enforces that independently.
   *
   * Before the first geometry push arrives this is 1, i.e. exactly the preset. That is the
   * correct default for the common case (a display wide enough to fit it unchanged) and it
   * costs one frame on the clamped one. */
  const squeeze = geom.squeeze || 1;
  const width = expanded ? geom.expanded.width : geom.compact.width;
  const height = expanded ? geom.expanded.height : geom.compact.height;

  /* WHICH BOARD-1 PILL TO DRAW. Derived from live state, never a fixed demo value, so the pill
   * always describes what is actually happening:
   *   - a verified private window   -> lock + "Private window"   (board 1, `private`)
   *   - a browser is foreground     -> globe + the domain        (board 1, `website`)
   *   - the stopwatch tracks a site -> dot + clock + globe       (board 1, `stopwatchSite`)
   *   - otherwise                   -> dot + clock + app name    (board 1, `stopwatch`)
   *
   * `isPrivate` is only true for a VERIFIED private window — main never infers it from a missing
   * domain, so this cannot claim "private" just because the browser extension was quiet. */
  const compactKind: CompactKind = currentApp.isPrivate
    ? 'private'
    : currentApp.domain
      ? swPayload.displaySource === 'idle'
        ? 'website'
        : 'stopwatchSite'
      : 'stopwatch';

  /* …UNLESS SOMETHING ELSE IS LIVE.
   *
   * `composed.toast` is the slot model's highest-precedence activity (§5 priority: transient
   * beats persistent), and it is what the expanded strip shows first. The pill must agree with
   * it, or hovering up reveals a card about one thing while the pill you just left said another.
   *
   * Only the six kinds with a board-1 pill DESIGN take over. The rest (`now`, `focus`,
   * `tierBreakdown`, `afkGap`, `clock`, `pinnedActivity`) have no board-1 pill in
   * HALO_STATES.html — the file draws ten, and inventing an eleventh is exactly the drift this
   * probe exists to catch. So an unknown kind leaves the pill on its app-derived default rather
   * than rendering something no design specifies. */
  const pillKind: CompactKind = BOARD1_PILL_KINDS.has(composed.toast?.kind as CompactKind)
    ? (composed.toast!.kind as CompactKind)
    : compactKind;

  // Hide the whole island when the user turns it off (resident) or disables it.
  // Otherwise the capsule stays on screen after the toggle, the reported defect.
  if (!prefs.enabled || prefs.resident === 'off') return null;

  return (
    <div className="halo-root" data-halo-root="true" data-phase={expanded ? 'expanded' : 'compact'}>
      <LayoutGroup>
        <motion.div
          layout
          // §171: the OS-level `prefers-reduced-motion` outranks the in-app liveliness
          // preference, so it forces the same short non-spring path `motionReduced` selects.
          transition={reduce ? STATIC_TRANSITION : surfaceTransition}
          className={`halo-surface halo-shape-${prefs.shape} ${expanded ? 'halo-expanded' : 'halo-compact'}`}
          onWheel={onSurfaceWheel}
          data-edge={prefs.edge}
          data-pinned={pinned}
          /* The TRANSFORM reads this on the surface itself, not on `.halo-root`. CSS cannot
           * select an ancestor's attribute to style a descendant's transform, and the surface
           * is the thing that scales. */
          data-phase={expanded ? 'expanded' : 'compact'}
          /* EDGE-AWARE PLACEMENT. `left`/`top` percentages come from the shared anchor
           * helper, and the negative margin is expressed as a `calc()` over the same
           * percentage rather than a precomputed pixel value — so it stays correct when the
           * width changes between the compact and expanded phases, which a cached
           * `-width/2` could not be. */
          style={{
            ...motionVars,
            /* `resident: 'hover'` with the cursor away must leave the window VISUALLY EMPTY, not
             * merely childless. A surface with no children still paints the `--halo-surface`
             * background and its 12px radius as a stray rounded rectangle on the desktop with
             * nothing in it, so the surface itself has to be hidden for the transparent canvas
             * to be genuinely transparent.
             *
             * `visibility`, not `opacity`: an opacity-0 surface still receives pointer events, so
             * the hot zone would expand an island the user cannot see. `visibility: hidden` also
             * removes it from hit testing, which matches a pill that is not there. */
            visibility: showPill || expanded ? 'visible' : 'hidden',
            /* THE SINGLE SOURCE OF THE SCALE.
             *
             * `width`/`height` below are `scaled(HALO_SIZE_TOKENS, prefs.scale)`, so the BOX
             * already tracked `prefs.scale` — but nothing told the stylesheet. The type and
             * rhythm tokens in halo.css are `calc(Npx * var(--halo-scale))`, so without this
             * line they resolved at 1 and the box shrank around a fixed 13px numeral. That is
             * the "small version is messed up" bug, and it is why the CSS hooks alone were not
             * enough: one variable, written here, read there.
             *
             * Clamped to the range `normalizeHaloPrefs` allows so a hand-edited pref cannot
             * produce a 0.1 scale and unreadably tiny type. */
            /* The preset's DESIGNED type scale (0.85 / 1.0 / 1.2), not the raw slider value.
             * Passing `prefs.scale` here meant a stored 0.7 produced 0.7 type on a Small
             * surface — a fourth size that exists in no design. */
            ...({
              /* The preset's DESIGNED type scale multiplied by how far main had to CLAMP the box.
               * At 1 this is exactly the preset's scale, so a display wide enough to fit the
               * island unchanged renders identically to before. Below 1 the type and rhythm step
               * down with the box (the `max(11px, ...)` floor in halo.css still applies, so a
               * very tight display gets a tighter LAYOUT rather than unreadable text).
               *
               * `Math.min` guards the degenerate case: a squeeze of 0 would collapse the scale to
               * 0 and every `calc()` would resolve to its floor, which is survivable, but a
               * NaN from a malformed geometry push would poison every token in the stylesheet. */
              '--halo-scale': String(
                Math.max(0.1, resolveHaloSize(prefs.scale).typeScale * squeeze),
              ),
            } as Record<string, string>),
            /* THE REVEAL SCALE — deliberately near 1.
             *
             * An earlier version set this to `compactHeight / expandedHeight` (0.24) and scaled
             * the whole expanded panel down to the pill, which ALSO scaled the type: a 28px
             * hero numeral rendered at 6.8px. A transform that shrinks layout by 4x destroys
             * everything measured in absolute units inside it. Figma says the SHAPE morphs; the
             * content keeps its designed size and only comes forward. */
            /* LAYOUT SIZE IS CONSTANT ACROSS PHASES — see above. The whole visual difference
             * between a 32px pill and a 132px panel is `scale()`. */
            width,
            height,
            left: `${xFrac * 100}%`,
            /* `offsetY` is the gap the user sets below the top edge. §8: Windows floats 8px
             * below the edge, and GNOME must clear a 32px top bar. It is a LENGTH added to the
             * fraction, never folded into the percentage — the same double-count the margin
             * comments below describe. Applied only on the top edge; a side edge has no
             * "below the edge" to speak of. */
            top: yFrac === 0 ? `${gapPx}px` : `${yFrac * 100}%`,
            /* BUG (live shared edit, now fixed): this was
               `calc(${xFrac*100}% - ...)`. But `left: ${xFrac*100}%` has ALREADY resolved
               the fraction against the parent width, so subtracting `${xFrac*100}%` again
               double-counted it: with the default xFrac=0.5 and width=460 it computed
               `50% - 230px` applied to a 50%-positioned box, landing the surface at
               x=1050 instead of 410. The subtraction must be a LENGTH only —
               half the surface width when centred, the full width when right-anchored. */
            marginLeft: -(xFrac === 0.5 ? width / 2 : xFrac === 1 ? width : 0),
            /* THE SAME DOUBLE-COUNT, ON THE OTHER AXIS — this is the "opens from the side"
             * bug (see agent/HALO_SIDE_OPEN_REGRESSION.md). `top: ${yFrac*100}%` has ALREADY
             * resolved the fraction against the parent height, so putting `${yFrac*100}%` into
             * this calc subtracted it a SECOND time. On 'top' (yFrac=0) the term is
             * `calc(0% - 0px)` = 0, which is why the default looked fine and hid the defect;
             * on left/right (yFrac=0.5) it computed `50% - height/2` and pushed the surface
             * down by half its own height. The subtraction must be a LENGTH only, exactly
             * like marginLeft above. */
            marginTop: -(yFrac === 0.5 ? height / 2 : yFrac === 1 ? height : 0),
            transformOrigin: origin,
            borderTopLeftRadius: radii.topLeft,
            borderTopRightRadius: radii.topRight,
            borderBottomRightRadius: radii.bottomRight,
            borderBottomLeftRadius: radii.bottomLeft,
          }}
          /* Stop a click on the island from also reading as a "click outside" (HALO §51).
           * Without this the pin button's own click would bubble to the document listener
           * and immediately unpin what it just pinned — a toggle that could never latch. */
          onPointerDown={(e) => e.stopPropagation()}
          role="region"
          aria-label="Halo Island"
          aria-expanded={expanded}
          data-halo-strip={composed.expanded.stripMode}
          data-halo-width={composed.expanded.widthClass}
          aria-describedby={residentEmpty ? 'halo-resident-state' : undefined}
        >
          {/* Screen-reader surface for the resident's honest state. Never invents a value. */}
          {residentEmpty && (
            <span id="halo-resident-state" className="sr-only">
              {swPayload.displaySource === 'idle' ? residentEmpty.unknown : residentEmpty.zero}
            </span>
          )}


        <div className="halo-clip-x">
{/* ── THE AMBIENT STRIP (curation RESULT §1.3 precedence) ──────────────────
             toast > live+rail > rail > honest empty. Every card renders its own honest
             state, so a widget whose channel is unwired shows its literal empty sentence
             rather than a fabricated number.

             ⚠ ONLY WHEN THE PAGE BODY HAS NOTHING TO SHOW.

             These rows were gated on `expanded` alone, and `composed.live` is populated for
             essentially every session, so a normal expanded island rendered an AmbientCard AND
             the Focus page AND the tab rail inside a 134px window. That is the "big but cropped,
             bottom cut off" report: the card is a fixed `padding:12px` + content + border, and it
             pushed the rail off the bottom edge.

             HALO_STATES.html board 2 is the authority for what an expanded page contains: the
             page's own blocks plus the tab rail. No card. So the strip is now the page's FALLBACK
             — it fills the slot when the page has no content of its own, which is exactly what
             `stripMode === 'empty'` means.

             `expandStrip` is derived below from the resident/page state so there is one answer to
             "does this page have content", not a per-row guess. */}
        {expanded && expandStrip && composed.toast && (
          <div data-halo-strip-row="toast">
            <AmbientCard activity={composed.toast} />
          </div>
        )}

        {expanded && expandStrip && !composed.toast && composed.live && (
          <div data-halo-strip-row="live+rail" className="flex" style={{ gap: 12 }}>
            <AmbientCard activity={composed.live} />
            {composed.rail[0] && <AmbientCard activity={composed.rail[0]} />}
          </div>
        )}

        {expanded && expandStrip && !composed.toast && !composed.live && composed.rail.length > 0 && (
          <div data-halo-strip-row="rail" className="flex" style={{ gap: 12 }}>
            {composed.rail.slice(0, 2).map((a) => (
              <AmbientCard key={a.id} activity={a} />
            ))}
          </div>
        )}

        {/* HONEST EMPTY: nothing to rotate. A blank rail would read as a broken widget. */}
        {expanded && composed.expanded.stripMode === 'empty' && (
          <div
            className="halo-t-label flex items-center px-3"
            style={{ color: 'var(--halo-dim)' }}
            data-halo-empty="true"
          >
            {NOTHING_TO_ROTATE}
          </div>
        )}

        {/* COMPACT PIP: the live state's value inside the 232px capsule, plus trailing
            identity dots for activities with no compact content of their own. */}
        {/* `compactStyle: 'off'` — no pip, no dots. The hero numeral is the whole pill. */}
        {prefs.compactStyle !== 'off' && !expanded && showPill && composed.live && (
          /* CENTRED ON THE REAL PILL HEIGHT, not `top: 4`.
           *
           * `top: 4` and the dots' `top: 18` were both written for the old fixed 40px pill.
           * The pill is now 28 / 32 / 40 by preset, so a hardcoded offset put the pip high and
           * the dots near the bottom edge at Small — which is the "stopwatch looks shifted"
           * report. Deriving the offset from `size.compactHeight` makes them centred at every
           * size, and the padding scales with the preset too. */
          <div
            style={{
              position: 'absolute',
              left: size.padding + composed.compact.heroPx,
              top: Math.max(2, Math.round((size.compactHeight - 16) / 2)),
            }}
          >
            <AmbientPip activity={composed.live} width={composed.compact.pipPx} />
          </div>
        )}

        {prefs.compactStyle !== 'off' && !expanded && showPill && composed.compact.dots.length > 0 && (
          <div
            data-halo-dots="true"
            className="flex items-center"
            style={{
              position: 'absolute',
              right: size.padding,
              /* the dots are 8px tall — centre them, do not guess 18 */
              top: Math.max(2, Math.round((size.compactHeight - 8) / 2)),
              gap: 4,
            }}
          >
            {composed.compact.dots.map((k) => (
              <AmbientDot key={k} kind={k} />
            ))}
          </div>
        )}

        {/* ══ THE COMPACT PILL BODY — spec §72 ══════════════════════════════════════
         *
         * §72, verbatim: "Do not shrink the entire expanded dashboard into compact mode."
         *
         * Every page block below was guarded by `tab === '<page>'` alone, so collapsing the
         * island left the Focus/Now/Deadlines/Tools rows mounted inside a 28-40px capsule. That
         * is the "it opens alongside the small thing" report and the "only one thing shows"
         * report, and it is the direct cause of the cropped panel: a page body is 48-64px tall
         * and the pill is 28px, so the row was clipped mid-way down.
         *
         * This is the pill's OWN content — board 1's four kinds — rendered only when
         * collapsed. `CompactPill` decides which kind from live state, so the pill always
         * describes what is actually happening rather than a fixed demo. */}
        {!expanded && showPill && (
          <div
            data-halo-pill-body="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              padding: `0 ${size.padding}px`,
              overflow: 'hidden',
            }}
          >
            <CompactPill
              kind={pillKind}
              stopwatch={swPayload}
              now={currentApp}
              fBody={size.fBody}
              listening={producers.dictation?.state === 'recording'}
              usageFraction={producers.ai?.usageFraction}
              hudCount={producers.hud?.activeSessions ?? undefined}
              deadlineTitle={producers.deadline?.title}
              deadlineDue={
                producers.deadline?.deltaMs !== undefined
                  ? formatDeadlineDue(producers.deadline.deltaMs)
                  : undefined
              }
            />
          </div>
        )}

        {/* ══ LEGACY LAYOUT — `uiVersion: 'legacy'` ══════════════════════════════════
         *
         * The top rail that shipped before the Figma redesign: two tabs plus the pin, above the
         * content instead of a rail below it. Restored verbatim rather than approximated, so
         * switching to 'legacy' returns the previous behaviour exactly.
         *
         * The pin lives here AND in the Figma rail. It is behaviour, not styling — losing it
         * with a layout swap is exactly the orphaning that happened when the old rail was
         * deleted while its `halo:set-pinned` IPC stayed wired. */}
        {expanded && prefs.uiVersion === 'legacy' && (
          <LegacyHaloRail
            tab={tab === 'deadlines' || tab === 'now' ? 'focus' : tab}
            onSelect={(next) => setTab(next)}
            pinned={pinned}
            onTogglePin={togglePin}
            showPin={prefs.showPin}
            focusIcon={<Timer size={11} />}
            toolsIcon={<Mic size={11} />}
            pinIcon={<Pin size={11} />}
          />
        )}

        {/* ══ THE FOUR PAGES — Figma board `2 / Pages` ══════════════════════════
         *
         * Each page is ONE row, and no page may grow taller than `size.rowHeight`
         * (48 / 56 / 64 by preset). The tab rail sits BELOW the row on its own raised,
         * inset surface — measured off the frames, not inferred.
         *
         * Content comes from the producers this session wired. Where a producer has no
         * data the page renders its honest sentence; it never invents a number.
         * `null` is UNKNOWN and `0` is a MEASUREMENT, and the two read differently. */}
        {/* ══ THE TWO FOCUS LAYOUTS ═════════════════════════════════════════════
         *
         * The Figma file's `page/focus` (node 9:304) is a single 51px ROW: status dot,
         * `STOPWATCH   HALO REDESIGN` eyebrow, a SPLIT clock (dimmed hours, bright MM:SS),
         * a 1x44 divider, `TODAY` + session total, then the two 44px round controls.
         *
         * It was NOT being rendered. `StopwatchHeroExpanded` was: a ShareRing donut, a
         * productive/distracting tier bar, a "Tracked" eyebrow and an app-name block. That is a
         * different design, and packing it into a 134px surface is why the expanded island
         * reads as heavy and "clunky" rather than as the file's calm single row.
         *
         * So the Figma layout gets `FocusPageRow`, transcribed node by node, and the legacy
         * layout keeps the hero it has always had. Gated on `uiVersion` so the two designs
         * cannot bleed into each other. The compact pill still uses `StopwatchHero` in BOTH
         * layouts — the file specifies one compact instance, and it is unchanged. */}
        {expanded && tab === 'focus' && prefs.uiVersion === 'figma' && (
          <FocusPageRow
            snapshot={storeSnap}
            productiveMs={storeSnap.productiveMs}
            onReset={() => stopwatch.reset()}
            onTogglePause={() => stopwatch.setPaused(!storeSnap.paused)}
            tracked={trackedTarget}
          />
        )}

        {expanded && tab === 'focus' && !(prefs.uiVersion === 'figma') && (
          <div className="flex items-center" style={{ gap: 'var(--halo-gap-loose)', height: size.rowHeight }}>
            <StopwatchHero
              snapshot={swPayload}
              currentApp={currentApp}
              expanded={expanded}
              now={now}
              awaySince={null}
              onTogglePause={() => stopwatch.setPaused(!stopwatch.getSnapshot().paused)}
              onCycleTier={() =>
                stopwatch.setTier(
                  stopwatch.getSnapshot().activeTier === 'distracting' ? 'productive' : 'distracting',
                )
              }
            />
            {/* hairline divider — board 2 uses them BETWEEN groups, never horizontally */}
            <span aria-hidden="true" style={DIVIDER} />
            <div className="flex flex-col" style={{ gap: 2 }}>
              <span style={EYEBROW}>Productive</span>
              <span className="font-mono tabular-nums" style={{ fontSize: 'var(--halo-t-value)' }}>
                {formatStopwatch(swPayload.productiveMs)}
              </span>
            </div>
            {/* ── THE TWO ROUND CONTROLS — board 1 / board 2, exact ──
             *   - button/reset [FRAME] 44x44 r=999 stroke=#2e2e33 w=1   (outline, no fill)
             *   - button/pause [FRAME] 44x44 r=999 fill=#6fb38f          (solid accent)
             * These were MISSING, which is why the right side of the Focus page was empty. The
             * accent fill is the file's only accent colour and it marks the live/running state,
             * so it must NOT be used anywhere else.
             */}
            <span aria-hidden="true" className="flex-1" />
            <button
              type="button"
              onClick={() => stopwatch.reset()}
              aria-label="Reset timer"
              title="Reset timer"
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: '1px solid var(--halo-border)',
                color: 'var(--halo-text)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => stopwatch.setPaused(!stopwatch.getSnapshot().paused)}
              aria-label={stopwatch.getSnapshot().paused ? 'Resume timer' : 'Pause timer'}
              title={stopwatch.getSnapshot().paused ? 'Resume' : 'Pause'}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                /* board 4 "disabled": the paused button goes to the dim accent #2f7d5b */
                background: stopwatch.getSnapshot().paused ? 'var(--halo-accent-dim)' : 'var(--halo-accent)',
                border: 'none',
                color: 'var(--halo-surface)',
                cursor: 'pointer',
              }}
            >
              {stopwatch.getSnapshot().paused
                ? <Play size={15} aria-hidden="true" />
                : <Pause size={15} aria-hidden="true" />}
            </button>
          </div>
        )}

        {expanded && tab === 'now' && (
          <div className="flex items-center" style={{ gap: 'var(--halo-gap-loose)', height: size.rowHeight }}>
            {/*
              §12 DATA STATES. HALO_STATES.html:110-111 designs two Now states this row did
              not have: `waiting` and `failed`.

              `waiting` is `currentApp === null`, which is NOT the same as "no app". null means
              no reading has arrived yet; rendering that as "No app detected" (the old
              behaviour) asserted a measurement that had not been taken. So null now renders
              the file's own waiting copy with skeletons for the parts still unknown.

              `failed` is a separate branch from `waiting`, not a third flavour of it: the
              reason the reading failed is the useful thing, and the file gives it a Retry.
              There is no error channel on NowPayload today, so this branch is reached by
              the string the existing producer already emits rather than by inventing one —
              see the note on the check below.
            */}
            {currentApp === null ? (
              <>
                <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={EYEBROW}>App</span>
                  <span style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-muted)' }}>
                    Reading the current app…
                  </span>
                </div>
                <span aria-hidden="true" style={DIVIDER} />
                <SkeletonBlock label="Website" width={90} />
                <span aria-hidden="true" style={DIVIDER} />
              </>
            ) : /failed|denied|error/i.test(currentApp.app) ? (
              /* HALO_STATES.html:111. Clamped to 2 lines there; same clamp here so a long OS
                 error string can never grow the row past size.rowHeight. */
              <>
                <span
                  style={{
                    fontSize: 'var(--halo-t-value)',
                    color: 'var(--halo-text)',
                    maxWidth: 230,
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {currentApp.app}
                </span>
                <button
                  type="button"
                  onClick={() => void pullRef.current?.()}
                  aria-label="Retry reading the current app"
                  style={{
                    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--halo-hairline)', background: 'transparent',
                    color: 'var(--halo-muted)', cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                </button>
                <span aria-hidden="true" style={DIVIDER} />
              </>
            ) : currentApp.app === 'No app detected' ? (
              /* HALO_STATES.html `idle`: "No active app" AND "Not in a browser", both muted.
               * Distinct from `waiting` above — the reading arrived and said nothing is
               * running, which is a measurement. */
              <>
                <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={EYEBROW}>App</span>
                  <span style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-dim)' }}>
                    No active app
                  </span>
                </div>
                <span aria-hidden="true" style={DIVIDER} />
              </>
            ) : (
              <>
            <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
              <span style={EYEBROW}>App</span>
              <div className="flex items-baseline" style={{ gap: 8, minWidth: 0 }}>
                <span className="truncate" style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-text)' }}>
                  {currentApp.app}
                </span>
                {/* `null` here means we have no reading yet — which is not the same as zero minutes. */}
                {typeof currentApp.secondsInApp === 'number' && currentApp.secondsInApp > 0 && (
                  <span style={{ fontSize: 'var(--halo-t-label)', color: 'var(--halo-muted)' }}>
                    {Math.round(currentApp.secondsInApp / 60)} min
                  </span>
                )}
              </div>
            </div>
            <span aria-hidden="true" style={DIVIDER} />
                <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={EYEBROW}>Website</span>
                  {/* The three states of HALO_STATES.html line 113 (`web`). Previously this
                      rendered `inBrowser ? "Not in a browser" : "No site data"` — INVERTED, so it
                      told you that you were not in a browser precisely while you were in one, and
                      had no third state because main never published a domain. */}
                  {currentApp.isPrivate ? (
                    <span className="flex items-center" style={{ gap: 6 }}>
                      <Lock size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)' }} />
                      <span style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-dim)' }}>
                        Private window
                      </span>
                    </span>
                  ) : currentApp.domain ? (
                    <span className="flex items-center" style={{ gap: 6 }}>
                      <Globe size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)' }} />
                      <span className="truncate" style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-text)' }}>
                        {currentApp.domain}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center" style={{ gap: 6 }}>
                      <Globe size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)' }} />
                      <span style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-dim)' }}>
                        Not in a browser
                      </span>
                    </span>
                  )}
                </div>
                <span aria-hidden="true" style={DIVIDER} />
              </>
            )}
            <div className="flex flex-col" style={{ gap: 4, minWidth: 0 }}>
              <span style={EYEBROW}>AI usage</span>
{producers.ai ? (
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <span className="font-mono tabular-nums" style={{ fontSize: 'var(--halo-t-value)' }}>
                      {/* Board 2 prints the PERCENTAGE, not a token count: "AI USAGE  62%".
                          * `usageFraction` is 0..1 and is only set when the producer can report a
                          * real denominator. With no denominator the row shows the token count
                          * instead, and there is no invented percentage anywhere. */}
                      {typeof producers.ai.usageFraction === 'number'
                        ? `${Math.round(producers.ai.usageFraction * 100)}%`
                        : compactTokens(producers.ai.tokensToday)}
                    </span>
                    {/* board 2: a 4px track with a #6fb38f fill — the file's only accent. */}
                    {typeof producers.ai.usageFraction === 'number' && (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 72,
                          height: 4,
                          borderRadius: 2,
                          background: 'var(--halo-raised)',
                          display: 'block',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: `${Math.round(Math.max(0, Math.min(1, producers.ai.usageFraction)) * 100)}%`,
                            height: '100%',
                            borderRadius: 2,
                            background: 'var(--halo-accent)',
                          }}
                        />
                      </span>
                    )}
                  </div>
                ) : (
                /* honest: no ai_usage rows today is UNKNOWN, so no percentage is invented */
                <span style={{ fontSize: 'var(--halo-t-label)', color: 'var(--halo-muted)' }}>
                  No usage data yet
                </span>
              )}
            </div>
          </div>
        )}

        {expanded && tab === 'deadlines' && (
          <div className="flex items-center" style={{ gap: 'var(--halo-gap-loose)', height: size.rowHeight }}>
            {/*
              §12 DATA STATES. HALO_STATES.html:117-121 designs FOUR Deadlines states and the
              row had two. The distinction that matters is the one already called out in
              RESULT.md §2.7 and preserved in the old comment below:

                count > 0            -> populated
                count === 0          -> "0 deadlines"  (a MEASUREMENT, not an unknown)
                producer absent      -> loading skeletons (never the unknown sentence)
                producer failed      -> the file's error copy + a Retry that exists

              `0 deadlines` is deliberately NOT merged into the empty state. Zero open
              deadlines is a real, actionable fact; "we could not read the table" is not.
            */}
            {deadlinesError ? (
              <>
                <span
                  style={{
                    fontSize: 'var(--halo-t-value)',
                    color: 'var(--halo-text)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {deadlinesError}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => void pullRef.current?.()}
                  aria-label="Retry loading deadlines"
                  style={{
                    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--halo-hairline)', background: 'transparent',
                    color: 'var(--halo-muted)', cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </>
            ) : !producers.deadline ? (
              /* HALO_STATES.html:119 — three skeletons, widths copied from the file.
                 `aria-busy` marks the row as settling without claiming it has failed. */
              <div
                className="flex items-center"
                aria-busy="true"
                style={{ gap: 'var(--halo-gap-loose)', width: '100%' }}
              >
                <SkeletonBlock label="Next deadline" width={120} />
                <span aria-hidden="true" style={DIVIDER} />
                <SkeletonBlock label="Status" width={100} />
                <span aria-hidden="true" style={DIVIDER} />
                <SkeletonBlock label="Open" width={28} />
              </div>
            ) : producers.deadline.count > 0 ? (
              <>
                <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={EYEBROW}>Next deadline</span>
                  <span className="truncate" style={{ fontSize: 'var(--halo-t-value)' }}>
                    {producers.deadline.title ?? 'Untitled'}
                  </span>
                </div>
                <span aria-hidden="true" style={DIVIDER} />
                <div className="flex flex-col" style={{ gap: 2 }}>
                  <span style={EYEBROW}>Status</span>
                  <span style={{ fontSize: 'var(--halo-t-value)', color: overdueColor(producers.deadline.isOverdue) }}>
                    {overdueLabel(producers.deadline.deltaMs)}
                  </span>
                </div>
                <span aria-hidden="true" style={DIVIDER} />
                <div className="flex flex-col" style={{ gap: 2 }}>
                  <span style={EYEBROW}>Open</span>
                  <span className="font-mono tabular-nums" style={{ fontSize: 'var(--halo-t-value)' }}>
                    {producers.deadline.count}
                  </span>
                </div>
              </>
            ) : (
              /* HALO_STATES.html:118 — the empty state names the fix ("Add one in Schedule")
                 and ships the arrow button that performs it, so the row is actionable rather
                 than a dead end. The button navigates; it does not create (handoff §11). */
              <>
                <span style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-muted)', whiteSpace: 'nowrap' }}>
                  No open deadlines. Add one in Schedule.
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => bridge?.navigate?.('/life')}
                  aria-label="Open Schedule"
                  style={{
                    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--halo-hairline)', background: 'transparent',
                    color: 'var(--halo-muted)', cursor: 'pointer',
                  }}
                >
                  <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        )}

        {expanded && tab === 'tools' && (
          <div className="flex items-center" style={{ gap: 'var(--halo-gap-loose)', height: size.rowHeight }}>
            <DictationIsland expanded={expanded} />
            <span aria-hidden="true" style={DIVIDER} />
            <button
              type="button"
              onClick={() => bridge?.navigate?.('/penguin-console')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, minHeight: 44,
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              <span className="truncate" style={{ fontSize: 'var(--halo-t-value)' }}>Console</span>
              {producers.hud && typeof producers.hud.activeSessions === 'number' && (
                <span style={{ fontSize: 'var(--halo-t-label)', color: 'var(--halo-muted)' }}>
                  {producers.hud.activeSessions} session{producers.hud.activeSessions === 1 ? '' : 's'}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ══ THE FIGMA LAYOUT — bottom, raised, inset ═════════════════════════════ */}
        {expanded && prefs.uiVersion === 'figma' && (
          <div className="flex items-center" style={{ gap: 6 }}>
            <HaloTabRail
              active={tab}
              onSelect={setTab}
              iconOnly={size.iconOnlyTabs}
              inset={size.padding}
              order={visiblePageSeq}
              hidden={prefs.pages?.hidden}
            />
            {/* the pin, again — see the legacy rail note above */}
            {prefs.showPin && (
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={pinned ? 'Unpin' : 'Pin open'}
                onClick={togglePin}
                style={{
                  height: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', borderRadius: 8, cursor: 'pointer',
                  background: pinned ? 'var(--halo-bg-raised)' : 'transparent',
                  color: pinned ? 'var(--halo-text)' : 'var(--halo-muted)',
                  border: 'none',
                }}
              >
                <Pin size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        </div>
        </motion.div>
      </LayoutGroup>
    </div>
  );
}


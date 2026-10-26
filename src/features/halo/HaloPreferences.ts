/**
 * Halo Island preferences.
 *
 * WHY A TYPED MODULE INSTEAD OF AD-HOC KEYS
 * -----------------------------------------
 * `userPreferences` is an untyped bag read with `get-preference` / written with
 * `set-preference`, so a typo would silently persist a key nothing ever reads and
 * the island would keep using its default with no error anywhere. Declaring the
 * shape once, with a validator and defaults, means an unknown or corrupt stored
 * value degrades to the default instead of breaking the surface.
 *
 * WHY THE SIZE IS A SCALE FACTOR, NOT ABSOLUTE PIXELS
 * --------------------------------------------------
 * A raw pixel width cannot satisfy both of the real constraints at once: HALO §128
 * requires the expanded surface to fit inside `display.width - 24`, and a
 * user-saved 520px on a 320px-wide display would be clamped away on every resize
 * and then silently disagree with what the setting says. A single scale factor
 * multiplied by the token sizes keeps the user's intent meaningful at any display
 * size, and the clamp still applies as a safety net rather than as the primary
 * mechanism.
 */

/**
 * Per-widget visibility + order.
 *
 * `visible` is the SHOW/HIDE toggle; `order` is the user's layout sequence. Order is
 * stored as an array of kinds rather than as an index per kind, because a partial array
 * is easier to normalise (append the missing kinds in their default sequence) than a
 * sparse index map, and a stale entry naming a kind that no longer exists is simply
 * dropped instead of corrupting the sequence.
 */
/** The three tab pages the expanded island can show, in the handoff's §5 order.
 *
 *  `now` WAS HERE. It was a whole page for "App / Website / AI usage", and the same app and
 *  website were ALSO the two halves of the Focus row's `STOPWATCH · Figma` eyebrow — two
 *  screens printing one fact, which is how the Focus page ended up looking like a stopwatch
 *  widget while the actual Focus FEATURE ran somewhere else entirely.
 *
 *  The user's instruction: "move it to the Focus thing … the focus doesn't look like a focus
 *  because it's not even connected to the Focus feature." So `now` is gone: the tracked app and
 *  site live on Focus (where they already were), and Focus now also renders the real session.
 *
 *  `normalizeHaloPages` drops ids it does not recognise, so a persisted
 *  `["focus","now","deadlines","tools"]` degrades to `["focus","deadlines","tools"]` by itself —
 *  no migration, and no stale tab. */
export type HaloPageId = 'focus' | 'deadlines' | 'tools';

export interface HaloPagePrefs {
  /** User sequence. Normalised by de-dupe + appending anything missing, like `order`. */
  order: HaloPageId[];
  /** Pages the user turned off. Never allowed to hide ALL four — the island would be empty. */
  hidden: HaloPageId[];
  /** Which page shows on open. `'last'` resumes the one the user was last on. */
  open: 'last' | HaloPageId;
}

/** The items the collapsed pill can lead with. `stopwatch` is the handoff §6 hero. */
export type HaloPillResident = 'stopwatch' | 'now' | 'aiUsage' | 'nextDeadline' | 'hud';

export interface HaloPillPrefs {
  resident: HaloPillResident;
}

export interface HaloWidgetPrefs {
  /** false = the user turned this widget off. Absent = visible (default-on). */
  visible?: boolean;
  /**
   * Whether this widget may appear in the COLLAPSED pill.
   *
   * This is a second, independent axis from `visible`, and it is the one that answers
   * "the compact pill is only 232px — what is worth spending that space on?". A widget
   * with `compact: false` still appears when the island is expanded but never competes
   * for the pill's single pip slot or one of its three identity dots. Default-on, so an
   * absent key keeps today's behaviour.
   */
  compact?: boolean;
}

/**
 * HOW THE ISLAND OPENS — the hitbox and the trigger.
 *
 * WHY THIS IS A GROUP AND NOT FOUR LOOSE FIELDS
 * ---------------------------------------------
 * These four numbers only mean anything together: `padX`/`padY` define a region that is
 * invisible on screen, and `openDelayMs` is what decides whether a cursor crossing that
 * region was intentional. Tuning one without the others produces the two failure modes
 * the curation spec calls out — a hitbox so large the island opens constantly, or one so
 * tight it never opens. Grouping them documents that they are one decision.
 *
 * `leaveMarginPx` is deliberately separate from `padX/padY`: padding decides WHERE the
 * zone is, the leave margin decides how forgiving the EDGE of that zone is once you are
 * inside it, which is what stops a cursor drifting 2px toward the compact pill from
 * collapsing the island mid-read.
 */
export interface HaloTriggerPrefs {
  /**
   * 'hover'      — the cursor entering the hot zone opens it (today's behaviour).
   * 'click'      — the hot zone is inert; only a deliberate click on the pill opens it.
   * 'hotkey'     — never opens from the pointer at all; ⌘⇧H / the global shortcut is the
   *                 only way in. The safest choice on a shared or recorded screen.
   * 'hover-or-click' — either works. The tolerant default for a mouse user.
   */
  mode: 'hover' | 'click' | 'hotkey' | 'hover-or-click';
  /** Extra invisible hit area on each SIDE of the pill, px. */
  padX: number;
  /** Extra invisible hit area BEYOND the pill, px. */
  padY: number;
  /** How long the cursor must be inside before it opens. Guards against a brush past. */
  openDelayMs: number;
  /** Grace period after the cursor leaves before it closes. */
  closeDelayMs: number;
  /** Extra tolerance on the hot-zone edge once inside. */
  leaveMarginPx: number;
}

/**
 * HOW THE ISLAND MOVES.
 *
 * WHY DURATION IS A PREFERENCE AND NOT A CONSTANT
 * ----------------------------------------------
 * The CSS declared 250ms and the JS `motion` transition declared 280ms — two clocks for
 * one transition, which is the exact defect MEMORY.md records about the stopwatch. Worse,
 * both were hardcoded, so a user who finds the island sluggish had no way to fix it and
 * no way to discover that a knob was missing. One duration, read from prefs by BOTH
 * sides, is the fix.
 */
export interface HaloMotionPrefs {
  /** Expand/collapse duration, ms. Clamped 0-600; 0 means instant. */
  durationMs: number;
  /**
   * Curve family.
   * 'expo'    — cubic-bezier(0.16, 1, 0.3, 1). The default; reads as physical settling.
   * 'standard'— cubic-bezier(0.4, 0, 0.2, 1). The Material-ish symmetric curve.
   * 'snappy'  — cubic-bezier(0.2, 0, 0, 1). Fast out, hard stop. For small sizes.
   * 'linear'  — no easing. Only correct for a duration-driven progress read.
   */
  easing: 'expo' | 'standard' | 'snappy' | 'linear';
  /**
   * How much MOTION is permitted at all, independent of duration.
   * 'full'    — transitions run (the normal case).
   * 'reduced' — durations collapse to near-zero but the surface still cross-fades, so the
   *             phase change is still legible. Distinct from the OS-level
   *             `prefers-reduced-motion`, which is honoured on top of this and wins.
   * 'off'     — no transition at all; the island snaps between phases.
   */
  liveliness: 'full' | 'reduced' | 'off';
}

/** Which of the two shipped layouts the island renders. See `HaloPrefs.uiVersion`. */
export type HaloUiVersion = 'legacy' | 'figma';

export const HALO_UI_VERSIONS: HaloUiVersion[] = ['figma', 'legacy'];

/**
 * WHEN THE COMPACT PILL IS ON SCREEN. Distinct from `trigger.mode`, which answers a different
 * question ("what EXPANDS it"); this answers "is it there at all".
 *
 * `trigger.mode` had no value for "always visible" — its four options are hover, click, hotkey
 * and hover-or-click, all of which are ways to EXPAND. So the user could not express "leave the
 * pill up" at all, which is why the "always on" setting appeared to do nothing.
 *
 * - `always` — the pill is painted on the desktop at all times, whatever else is focused. This
 *   is the DEFAULT, and it is the answer to "it only works when I'm inside RHEO": the island is
 *   its own always-on-top window (spec §13/§37), so it is visible over any application.
 * - `hover`  — the pill appears only once the cursor reaches the hot zone.
 * - `off`    — no island at all. Equivalent to `enabled: false`, kept for the three-way UI.
 *
 * Note this does NOT change what expands it: `always` still expands on hover, and `pinned`
 * (the pin button) still holds it open.
 */
export type HaloResident = 'always' | 'hover' | 'off';

export const HALO_RESIDENT_MODES: HaloResident[] = ['always', 'hover', 'off'];

export interface HaloPrefs {
  enabled: boolean;
  /** When the compact pill itself is on screen. Defaults to `always`. */
  resident: HaloResident;
  /** 0.7 – 1.6. Applied to the compact and expanded token sizes alike. */
  scale: number;
  /**
   * Which screen edge the island attaches to.
   *
   * HALO §127 defines this union as exactly `"top" | "left" | "right"`, so the VALUE stays in
   * the model and keeps normalising for existing installs. The Specialist ruled the left/right
   * CHOICES out of the UI: the island is 560x134, so a side edge would need a vertical layout
   * that is not designed anywhere. Keep top; leave the others readable so old prefs still load.
   */
  edge: 'top' | 'left' | 'right';
  /**
   * Horizontal anchor ALONG the top edge. This is the "change the spot" control the Specialist
   * designed in `agent/docs/HALO_SETTINGS.html`: the island slides left / centre / right, which
   * is what a top-edge island can actually do without a new layout.
   *
   * Deliberately NOT freeform x/y — §127 forbids arbitrary freeform positioning, so the user
   * picks one of three anchors and an optional gap instead of a pixel coordinate.
   */
  anchor: 'left' | 'center' | 'right';
  /**
   * Gap below the top edge, in px (0-64, step 4). Windows and Linux only: §8 floats the island
   * 8px below the edge there, and §8 GNOME must clear a 32px top bar. macOS notch Macs stay
   * docked and centred, so this is ignored there.
   */
  offsetY: number;
  /**
   * Free drag offset from the centred position, px. Set by press-and-holding the pill and
   * moving it — the "adjust the pill from itself" gesture. It shifts the island horizontally
   * (`dragX`) and below the top edge (`dragY`), and persists so the position survives a
   * restart. 0 = centred. Clamped to ±600 so a drag cannot fling the island off-screen.
   *
   * §127 forbids freeform positioning in the CORE model; this is the user's explicit gesture
   * overriding that, and it is deliberately a small integer offset rather than an absolute
   * coordinate, so it stays meaningful on a display that changes size.
   */
  dragX: number;
  dragY: number;
  /**
   * Page selection for the expanded island. The Specialist's settings screen reorders and hides
   * PAGES, which is a different axis from `order`/`widgets` below (those are the ambient widget
   * roster, not the four tab pages).
   */
  pages: HaloPagePrefs;
  /**
   * Which display to attach to. `null` = follow the primary display.
   *
   * HALO §28 + §161. `geometry.ts` already had a fully-written `resolveTargetDisplay`
   * including its rule that a saved display which has since been unplugged must fall back
   * rather than leave the island logically attached to a monitor that no longer exists — and
   * nothing ever called it. `haloIsland.ts` hardcoded `screen.getPrimaryDisplay()`. This is
   * that dead code being connected, not new maths. Selecting a display is a legitimate
   * `display_targeting` concern and is unrelated to §127's prohibition, which is about
   * positioning WITHIN a display.
   */
  displayId: number | null;
  /** Show/hide per widget kind. Missing key = visible. */
  widgets: Record<string, HaloWidgetPrefs>;
  /**
   * The user's rotation sequence. The curation spec fixes a DEFAULT ambient order so the
   * island is learnable; this lets the user override it without losing that default.
   */
  order: string[];
  /**
   * How many widgets are on screen at once. This is the honest control for density: the
   * curation spec is emphatic that compact 232x40 cannot hold three legible text segments
   * ("232px cannot hold three legible units and pretending otherwise produces 6px type"),
   * so the ceiling is 3. Exceeding it does not shrink type — it drops to dots.
   */
  maxVisible: number;
  /**
   * Shell shape.
   *
   * 'capsule'   — fully rounded, floats (existing behaviour, the Dynamic Island read).
   * 'notch'     — top corners rounded only, so it visually attaches to the screen edge
   *               like a native notch rather than floating free of it.
   * 'square'    — 8px on every corner, the most recessive option.
   * 'custom'    — the user's own radius, applied to all four corners. Exists because the
   *               three presets cannot express "a 20px squircle", which is the shape most
   *               people actually want.
   *
   * All four are inside LAMINAR §4 (8px / 12px / 9999px pill) for the PRESETS.
   * `rounded-2xl`/`3xl` remain banned at every setting; `radius` is clamped to the same
   * 0-9999 band so a custom value can reach a pill but never a 32px app-chrome radius.
   */
  shape: 'capsule' | 'notch' | 'square' | 'custom';
  /** Corner radius in px, used only when `shape === 'custom'`. 0 – 9999. */
  radius: number;
  /** The hitbox + trigger group. See HaloTriggerPrefs. */
  trigger: HaloTriggerPrefs;
  /** Duration / easing / liveliness. See HaloMotionPrefs. */
  motion: HaloMotionPrefs;
  /**
   * Whether the pin control is drawn in the island's rail.
   *
   * This exists as a preference because the control was previously not a control at all:
   * clicking anywhere on the surface flipped a LOCAL React flag that the main process never
   * heard about, so the very next 40ms poll closed the island again. A flag is also the
   * honest fix for anyone who finds the rail cluttered. Default-on.
   */
  showPin: boolean;
  /**
   * How much of the window the OS lets the mouse reach while the island is EXPANDED.
   *
   * 'surface' (default) — the click region is shaped to the painted island alone, so the
   *   transparent canvas around it belongs to the application underneath again. This is
   *   what makes the island non-interfering: it is the difference between "usually does not
   *   swallow clicks" and "cannot".
   * 'canvas' — the whole window is interactive. Only useful for debugging, and the honest
   *   escape hatch for a platform where window shapes are unavailable (macOS), because the
   *   alternative is a stale or unusable shape.
   *
   * EITHER WAY the hit zone is never part of this: a hover region and a click region are
   * separate rectangles by construction, so widening `trigger.padX/padY` can never cost the
   * user a click.
   */
  clickShield: 'surface' | 'canvas';
  /**
   * HOW THE COMPACT 232x40 PILLOW DECIDES WHAT TO SHOW.
   *
   * WHY THIS SETTING HAD TO EXIST
   * ----------------------------
   * The small indicators in the pill were derived from whichever producers happened to be
   * emitting at that instant: `slotModel` set `pipPx` only when a `live` activity existed,
   * and built the trailing dots from `rail`, which is filtered on `hasData()`. Dictation
   * idle for a moment and the pip vanished; a widget with no fresh sample and its dot
   * vanished. Nothing about that was a rule the user could see, predict, or set — it read as
   * the island flickering, and "sometimes it shows, sometimes it doesn't" is the exact
   * complaint. An indicator whose presence depends on telemetry is not an indicator.
   *
   * 'auto'   — the current data-driven behaviour. The pill shows what has live data right
   *            now. Compact, but non-deterministic by nature.
   * 'always' — the pill shows the widgets YOU picked (the same `order` + `compact` flags
   *            used below), each rendered in an honest idle state when it has no fresh
   *            sample. Deterministic: the same widgets appear every time, which is what
   *            makes the pill usable as a glanceable status strip.
   * 'off'    — no pip and no dots. The pill is the hero numeral only.
   *
   * The expanded panel is UNAFFECTED by this: opening it always shows everything, because an
   * expanded surface has room and a user who opened it asked for detail.
   */
  compactStyle: 'auto' | 'always' | 'off';
  /**
   * AUTO-SHOW ACTIVE FEATURES.
   *
   * When on (default), any feature that is currently running/active (stopwatch,
   * focus group, dictation, ...) is shown in the island even if the user hid it
   * in the widget list. Active work should never be invisible just because the
   * user toggled the widget off. When off, the widget list is authoritative.
   */
  autoShowActive: boolean;
  /**
   * PRODUCTIVITY AMBIENCE on the pill's EDGE.
   *
   * 'off'  — no ambience. The pill is the surface token alone.
   * 'edge' — a 1px edge ring, tinted by the stopwatch's tier: green for productive,
   *          red for distracting, neutral for neutral. It answers "is this session
   *          going well" at a glance, without spending any of the pill's 32px of height.
   *
   * The user asked for exactly this ("ambience of like the red blue green depending on
   * the productivity") and chose the EDGE treatment over a background tint: a tint fills
   * the whole capsule and competes with the numeral, while a 1px ring + a faint bloom
   * reads as a state rather than as decoration.
   *
   * DEFAULT IS `edge`, and that is a USER DECISION, not a design flourish. The first cut
   * defaulted to `off` on the LAMINAR §7.2 "no decorative glow" reading — but §7.2 bans a
   * glow added for ornament, and the owner asked for this one by name: "ambient on the pill
   * showing red blue green depending on the productivity", then picked "Edge glow only"
   * over a background tint. Shipping a pref that defaults to the state the requester did
   * not ask for is how a feature lands invisible and gets reported as "you didn't do it".
   * The Settings control still turns it off; `off` remains a real, honoured value.
   */
  ambient: 'off' | 'edge';
  /**
   * Which item the COLLAPSED pill leads with, and how that choice interacts with interrupts.
   *
   * The handoff §6 says "The hero is the stopwatch. Which kind shows is decided by the existing
   * promotion logic, not by the user." The Specialist's ruling keeps the important part of that
   * and relaxes the rest: an OVERDUE alert still takes over the pill (`interrupt` below), so the
   * one rule that protects the user survives, while the user chooses the default item.
   */
  pill: HaloPillPrefs;

  /**
   * WHICH LAYOUT IS RENDERED. Dual-boot: both implementations ship, the user switches.
   *
   * 'legacy' = the previous top rail with the Tracked time / Dictation tabs and the pin.
   * 'figma'  = board `2 / Pages` — a bottom tab rail and four pages.
   *
   * WHY THIS EXISTS RATHER THAN A REPLACEMENT: the Figma design is new and unverified on this
   * machine, and deleting the working layout to ship it means a bad frame has no escape hatch.
   * The earlier pass deleted the old rail outright and that also orphaned the PIN — its
   * `halo:set-pinned` IPC and `togglePin` were still wired while the only button that called it
   * was gone. A flag keeps both halves whole and makes the revert a one-click operation instead
   * of a re-implementation.
   *
   * Defaults to 'figma' because that is the design being shipped, but 'legacy' is reachable at
   * any time and no stored value is invalidated by it.
   */
  uiVersion: HaloUiVersion;
}

/**
 * Kinds the user may reorder. The hero (`stopwatch`) and the interrupt kinds are NOT
 * listed: the spec's central law is that the resident is never evicted and `critical`
 * occludes it regardless of priority, so letting a user reorder the hero would silently
 * break the one invariant the whole surface rests on.
 */
export const HALO_ORDERABLE = ['now', 'aiUsage', 'hud', 'nextDeadline', 'tierBreakdown', 'afkGap'] as const;

/** The learnable default sequence (curation RESULT AMBIENT_ORDER, minus the pin slot). */
export const HALO_DEFAULT_ORDER: string[] = [...HALO_ORDERABLE];

export const HALO_PREFS_KEY = 'haloIsland';

/** The handoff §5 page order. */
export const HALO_DEFAULT_PAGE_ORDER: HaloPageId[] = ['focus', 'deadlines', 'tools'];

/** The items `HALO_SETTINGS.html` offers as the pill's main item. */
export const HALO_PILL_RESIDENTS: readonly HaloPillResident[] = [
  'stopwatch',
  'now',
  'aiUsage',
  'nextDeadline',
  'hud',
];

export const HALO_PAGE_IDS: readonly HaloPageId[] = ['focus', 'deadlines', 'tools'];
export const HALO_ANCHORS = ['left', 'center', 'right'] as const;
/** §8: Windows floats 8px below the edge; GNOME must clear a 32px top bar. */
export const HALO_OFFSET_Y_MIN = 0;
export const HALO_OFFSET_Y_MAX = 64;
/** Clamp on the drag offset. 600px is far enough to reach any edge of a 1080p panel and
 * small enough that a flung drag cannot push the island off-screen. */
export const HALO_DRAG_MAX = 600;

export const HALO_DEFAULTS: HaloPrefs = {
  enabled: true,
  resident: 'always',
  scale: 1,
  edge: 'top',
  anchor: 'center',
  offsetY: 8,
  dragX: 0,
  dragY: 0,
  displayId: null,
  widgets: {},
  order: [...HALO_DEFAULT_ORDER],
  maxVisible: 3,
  pages: { order: [...HALO_DEFAULT_PAGE_ORDER], hidden: [], open: 'last' },
  pill: { resident: 'stopwatch' },
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
  autoShowActive: true,
  uiVersion: 'figma',
  /* See the `ambient` doc above: ON by the owner's request. */
  ambient: 'edge',
};

/** HALO_SIZE ceiling for visible widgets — see the maxVisible doc comment. */
export const HALO_MAX_VISIBLE_MIN = 1;
export const HALO_MAX_VISIBLE_MAX = 3;

export const HALO_SCALE_MIN = 0.7;
export const HALO_SCALE_MAX = 1.6;

/**
 * Hitbox bounds.
 *
 * `padX`/`padY` are clamped generously rather than tightly: the worst outcome of a large
 * value is that the island opens when the user brushes the top of the screen, which is
 * annoying but reversible. The worst outcome of NO clamp is `padX: 1e9`, which makes
 * `pointInHotZone` true everywhere and pins the island open permanently — unrecoverable
 * without editing the database by hand. So the clamp is the safety property, not the limit.
 */
export const HALO_PAD_X_MAX = 240;
export const HALO_PAD_Y_MAX = 240;
export const HALO_OPEN_DELAY_MIN = 0;
export const HALO_OPEN_DELAY_MAX = 600;
export const HALO_CLOSE_DELAY_MIN = 0;
export const HALO_CLOSE_DELAY_MAX = 1200;
export const HALO_LEAVE_MARGIN_MIN = 0;
export const HALO_LEAVE_MARGIN_MAX = 120;

export const HALO_RADIUS_MIN = 0;
export const HALO_RADIUS_MAX = 9999;
export const HALO_DURATION_MIN = 0;
export const HALO_DURATION_MAX = 600;

export const HALO_TRIGGER_MODES = ['hover', 'click', 'hotkey', 'hover-or-click'] as const;
export const HALO_EDGES = ['top', 'left', 'right'] as const;
export const HALO_SHAPES = ['capsule', 'notch', 'square', 'custom'] as const;
export const HALO_EASINGS = ['expo', 'standard', 'snappy', 'linear'] as const;
export const HALO_LIVELINESS = ['full', 'reduced', 'off'] as const;
export const HALO_CLICK_SHIELDS = ['surface', 'canvas'] as const;
export const HALO_COMPACT_STYLES = ['auto', 'always', 'off'] as const;
export const HALO_AMBIENT_STYLES = ['off', 'edge'] as const;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function clampScale(value: unknown): number {
  return clampNumber(value, HALO_SCALE_MIN, HALO_SCALE_MAX, HALO_DEFAULTS.scale);
}

/**
 * Normalise the trigger group. Missing keys each fall back independently, so a stored bag
 * written by an OLDER build (which had no trigger group at all) yields the full defaults
 * rather than a partially-zeroed trigger that would make the island un-openable.
 */
export function normalizeHaloTrigger(raw: unknown): HaloTriggerPrefs {
  const d = HALO_DEFAULTS.trigger;
  if (!raw || typeof raw !== 'object') return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    mode: pickEnum(r.mode, HALO_TRIGGER_MODES, d.mode),
    padX: Math.round(clampNumber(r.padX, 0, HALO_PAD_X_MAX, d.padX)),
    padY: Math.round(clampNumber(r.padY, 0, HALO_PAD_Y_MAX, d.padY)),
    openDelayMs: Math.round(clampNumber(r.openDelayMs, HALO_OPEN_DELAY_MIN, HALO_OPEN_DELAY_MAX, d.openDelayMs)),
    closeDelayMs: Math.round(clampNumber(r.closeDelayMs, HALO_CLOSE_DELAY_MIN, HALO_CLOSE_DELAY_MAX, d.closeDelayMs)),
    leaveMarginPx: Math.round(clampNumber(r.leaveMarginPx, HALO_LEAVE_MARGIN_MIN, HALO_LEAVE_MARGIN_MAX, d.leaveMarginPx)),
  };
}

export function normalizeHaloMotion(raw: unknown): HaloMotionPrefs {
  const d = HALO_DEFAULTS.motion;
  if (!raw || typeof raw !== 'object') return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    durationMs: Math.round(clampNumber(r.durationMs, HALO_DURATION_MIN, HALO_DURATION_MAX, d.durationMs)),
    easing: pickEnum(r.easing, HALO_EASINGS, d.easing),
    liveliness: pickEnum(r.liveliness, HALO_LIVELINESS, d.liveliness),
  };
}

/**
 * The one place a user preference becomes a real CSS/JS duration, in ms.
 *
 * Both the stylesheet and the `motion` transition read this, which is the whole point: the
 * island previously had 250ms in CSS and 280ms in JS for the same transition. One
 * function means the two can never disagree again.
 *
 * `liveliness: 'reduced'` does NOT zero the duration. Zeroing a layout transition produces
 * a broken interpolation (HALO §171 and the reduced-motion block in halo.css both say so);
 * it collapses to a short cross-fade instead. `'off'` is the only true zero, and even then
 * the caller keeps the opacity transition so the phase change stays legible.
 */
export function motionDurationMs(motion: HaloMotionPrefs): number {
  if (motion.liveliness === 'off') return 0;
  if (motion.liveliness === 'reduced') return Math.min(motion.durationMs, 90);
  return motion.durationMs;
}

/**
 * The same curve as a Motion `ease` TUPLE, for the JS transition.
 *
 * WHY NOT THE STRING
 * Motion's `Transition['ease']` is a union of named easings and `[n,n,n,n]` tuples — a
 * `cubic-bezier(...)` string is not assignable, so passing `motionEasing()`'s output
 * straight into `<motion.div transition>` is a type error even though it is a perfectly good
 * CSS value. Keeping both forms derived from ONE switch is what stops the stylesheet and the
 * animation from disagreeing, which is the whole point of the preference; deriving the tuple
 * separately (rather than hand-writing a second curve table) is what stops THAT pair from
 * disagreeing.
 */
export function motionEaseTuple(motion: HaloMotionPrefs): [number, number, number, number] {
  switch (motion.easing) {
    case 'standard':
      return [0.4, 0, 0.2, 1];
    case 'snappy':
      return [0.2, 0, 0, 1];
    case 'linear':
      return [0, 0, 1, 1];
    case 'expo':
    default:
      return [0.16, 1, 0.3, 1];
  }
}

/** The matching CSS curve. LAMINAR §6 permits easing only, never spring/bounce. */
export function motionEasing(motion: HaloMotionPrefs): string {
  if (motion.liveliness === 'off') return 'linear';
  if (motion.liveliness === 'reduced') return 'linear';
  switch (motion.easing) {
    case 'standard':
      return 'cubic-bezier(0.4, 0, 0.2, 1)';
    case 'snappy':
      return 'cubic-bezier(0.2, 0, 0, 1)';
    case 'linear':
      return 'linear';
    case 'expo':
    default:
      return 'cubic-bezier(0.16, 1, 0.3, 1)';
  }
}

/**
 * Pages: de-dupe `order`, drop unknown ids, append anything missing, then clamp `hidden`.
 *
 * The one rule that is NOT negotiable here: the island can never end up with ZERO visible
 * pages. Hiding the last one would leave the expanded panel with no content row and a tab
 * rail with nothing in it, so the final hidden entry is dropped back to visible.
 */
function normalizeHaloPages(raw: unknown): HaloPagePrefs {
  const r = (raw ?? {}) as Record<string, unknown>;

  const seen = new Set<HaloPageId>();
  const order: HaloPageId[] = [];
  for (const k of Array.isArray(r.order) ? (r.order as unknown[]) : []) {
    if (typeof k !== 'string') continue;
    if (!HALO_PAGE_IDS.includes(k as HaloPageId)) continue;
    const id = k as HaloPageId;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of HALO_DEFAULT_PAGE_ORDER) if (!seen.has(id)) order.push(id);

  const hidden: HaloPageId[] = [];
  for (const k of Array.isArray(r.hidden) ? (r.hidden as unknown[]) : []) {
    if (typeof k !== 'string') continue;
    if (!HALO_PAGE_IDS.includes(k as HaloPageId)) continue;
    if (hidden.includes(k as HaloPageId)) continue;
    hidden.push(k as HaloPageId);
  }
  // Never hide every page.
  if (hidden.length >= order.length) {
    for (const id of order) {
      const i = hidden.indexOf(id);
      if (i >= 0) hidden.splice(i, 1);
      if (hidden.length < order.length) break;
    }
  }

  const open =
    r.open === 'last' || HALO_PAGE_IDS.includes(r.open as HaloPageId)
      ? (r.open as 'last' | HaloPageId)
      : HALO_DEFAULTS.pages.open;

  return { order, hidden, open };
}

/** Pill resident: one of the five designed items, default the stopwatch hero (handoff §6). */
function normalizeHaloPill(raw: unknown): HaloPillPrefs {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    resident: HALO_PILL_RESIDENTS.includes(r.resident as HaloPillResident)
      ? (r.resident as HaloPillResident)
      : HALO_DEFAULTS.pill.resident,
  };
}

/** Never throws: an unrecognised stored value degrades to the default. */
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
    resident: pickEnum(r.resident, HALO_RESIDENT_MODES, HALO_DEFAULTS.resident),
    scale: clampScale(r.scale),
    uiVersion: pickEnum(r.uiVersion, HALO_UI_VERSIONS, HALO_DEFAULTS.uiVersion),
    edge: pickEnum(r.edge, HALO_EDGES, HALO_DEFAULTS.edge),
    anchor: pickEnum(r.anchor, HALO_ANCHORS, HALO_DEFAULTS.anchor),
    offsetY: Math.round(clampNumber(r.offsetY, HALO_OFFSET_Y_MIN, HALO_OFFSET_Y_MAX, HALO_DEFAULTS.offsetY)),
    dragX: Math.round(clampNumber(r.dragX, -HALO_DRAG_MAX, HALO_DRAG_MAX, HALO_DEFAULTS.dragX)),
    dragY: Math.round(clampNumber(r.dragY, -HALO_DRAG_MAX, HALO_DRAG_MAX, HALO_DEFAULTS.dragY)),
    displayId,
    widgets,
    order,
    maxVisible: clampMaxVisible(r.maxVisible),
    pages: normalizeHaloPages(r.pages),
    pill: normalizeHaloPill(r.pill),
    shape: pickEnum(r.shape, HALO_SHAPES, HALO_DEFAULTS.shape),
    radius: Math.round(clampNumber(r.radius, HALO_RADIUS_MIN, HALO_RADIUS_MAX, HALO_DEFAULTS.radius)),
    trigger: normalizeHaloTrigger(r.trigger),
    motion: normalizeHaloMotion(r.motion),
    showPin: typeof r.showPin === 'boolean' ? r.showPin : HALO_DEFAULTS.showPin,
    clickShield: pickEnum(r.clickShield, HALO_CLICK_SHIELDS, HALO_DEFAULTS.clickShield),
    compactStyle: pickEnum(r.compactStyle, HALO_COMPACT_STYLES, HALO_DEFAULTS.compactStyle),
    autoShowActive: typeof r.autoShowActive === 'boolean' ? r.autoShowActive : HALO_DEFAULTS.autoShowActive,
    ambient: pickEnum(r.ambient, HALO_AMBIENT_STYLES, HALO_DEFAULTS.ambient),
  };
}

function clampMaxVisible(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return HALO_DEFAULTS.maxVisible;
  return Math.min(HALO_MAX_VISIBLE_MAX, Math.max(HALO_MAX_VISIBLE_MIN, Math.round(n)));
}

/** True unless the user explicitly hid it. Missing = visible. */
export function isWidgetVisible(prefs: HaloPrefs, kind: string): boolean {
  return prefs.widgets?.[kind]?.visible !== false;
}

/** The order the user set, filtered to widgets that are currently visible. */
export function visibleOrder(prefs: HaloPrefs): string[] {
  return (prefs.order ?? HALO_DEFAULT_ORDER).filter((k) => isWidgetVisible(prefs, k));
}

/** Base token sizes at scale 1. The renderer multiplies these by the scale. */
/**
 * THE SIZE MODEL IS RE-EXPORTED, NOT DEFINED HERE.
 *
 * The main process needs these numbers in `shared/halo/geometry.ts` and the renderer needs
 * them here. `shared/` cannot import from `features/`, so the model lives in
 * `shared/halo/sizes.ts` and is re-exported. One definition, both layers, no cycle.
 */
export {
  HALO_SIZE_PRESETS,
  HALO_CANVAS_WIDTH,
  HALO_CANVAS_HEIGHT,
  presetForScale,
  resolveHaloSize,
  type HaloSize,
  type HaloSizePreset,
} from '../../shared/halo/sizes';

/**
 * LEGACY TOKEN BAG — retained so nothing that imports it breaks.
 *
 * These are the MEDIUM values. `OverlayRoot` and `haloIsland` should call
 * `resolveHaloSize()` instead; this object remains only as a fallback for code that has not
 * been migrated yet.
 */
export const HALO_SIZE_TOKENS = {
  compactWidth: 232,
  compactHeight: 40,
  expandedWidth: 460,
  /* 192 was the height BEFORE the shell gained real padding (16px top + 12px bottom) and
   * a 30px tab rail. Content now measures taller than the box, so it clipped at the
   * bottom edge. 236 is the measured content height plus the insets, and it still fits the
   * 300px canvas with room for the toast strip variant. */
  expandedHeight: 236,
} as const;

export function scaled<T extends Record<string, number>>(
  tokens: T,
  scale: number,
): { [K in keyof T]: number } {
  const out = {} as { [K in keyof T]: number };
  for (const k of Object.keys(tokens) as (keyof T)[]) {
    out[k] = Math.round(tokens[k] * scale);
  }
  return out;
}

/**
 * Resolve a shape preference to concrete LAMINAR §4 radii.
 *
 * `notchBottom` is 0 — deliberately, and the only radius in this file that is not one of
 * §4's three values, because the shape itself requires it. The card radius inside the
 * shell stays 12px regardless.
 *
 * WHY THIS TAKES THE EDGE
 * ----------------------
 * 'notch' means "attached to the screen edge", which is only meaningful if it rounds the
 * corners that TOUCH that edge. Hardcoding it to the top corners meant the same preference
 * produced a downward-rounded lozenge when the island sat on the left edge — i.e. it looked
 * detached from exactly the edge it was attached to. Rotating the rounding with the edge is
 * what makes the shape mean the same thing in all four positions.
 *
 * COMPACT is 40px tall, so a 9999 radius IS a pill — that is the Dynamic Island read and
 * the reason the shape preference exists. EXPANDED is 192px tall, where 9999 would give a
 * 460x192 lozenge rather than a capsule, so the pill is capped at LAMINAR §4's 12 there.
 * A `custom` radius is the user's explicit instruction, so it is NOT capped by phase: if
 * someone asks for a 9999 custom radius they get a 9999 custom radius.
 */
export function shellRadii(
  shape: HaloPrefs['shape'],
  phase: 'compact' | 'expanded' = 'compact',
  edge: HaloPrefs['edge'] = 'top',
  customRadius: number = HALO_DEFAULTS.radius,
): {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
} {
  const custom = Math.min(
    HALO_RADIUS_MAX,
    Math.max(HALO_RADIUS_MIN, Math.round(Number(customRadius) || 0)),
  );
  if (shape === 'custom') {
    return { topLeft: custom, topRight: custom, bottomRight: custom, bottomLeft: custom };
  }
  if (shape === 'square') return { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 };
  if (shape === 'notch') {
    switch (edge) {
      case 'left':
        return { topLeft: 0, topRight: 12, bottomRight: 12, bottomLeft: 0 };
      case 'right':
        return { topLeft: 12, topRight: 0, bottomRight: 0, bottomLeft: 12 };
      case 'top':
      default:
        return { topLeft: 12, topRight: 12, bottomRight: 0, bottomLeft: 0 };
    }
  }
  const pill = phase === 'compact' ? 9999 : 12;
  return { topLeft: pill, topRight: pill, bottomRight: pill, bottomLeft: pill };
}

/**
 * Where the painted surface sits INSIDE its canvas, as fractions.
 *
 * RE-EXPORTED, not defined here: `shared/halo/geometry.ts` needs the same function to place
 * the window and wrap the hot zone, and `shared/` cannot import from `features/`. The
 * renderer imports it from here because that is already its import site for this module.
 */
export { surfaceAnchorFractions, surfaceTransformOrigin } from '../../shared/halo/geometry';

import type { IslandGeometry, NotchGeometry, OverlayEdge, Rect, Size } from './types';
import { fitToCanvas, HALO_CANVAS_HEIGHT, HALO_CANVAS_MAX_HEIGHT, HALO_CANVAS_MAX_WIDTH, HALO_CANVAS_MIN_HEIGHT, HALO_CANVAS_MIN_WIDTH, HALO_CANVAS_WIDTH, HALO_SIZE_PRESETS, type HaloSize } from './sizes';

/** HALO §9 fixed canvas. */
/**
 * Canvas budget. The HALO spec §9 suggests 760x460, but §181 says "prefer the
 * smallest canvas that safely contains the expanded island" — and the island's
 * expanded surface is 460x218. A 760x460 transparent window is a large
 * always-on-top surface for a small panel, which costs compositor resources and
 * enlarges the click-through region if the transparent-window guard ever fails.
 * Sized to the expanded state plus a small margin.
 */
/* HALO §9 FIXED CANVAS, verbatim:
 *
 *     canvas:
 *       max_width: 760
 *       max_height: 460
 *       recommended_min_width: 360
 *       recommended_min_height: 120
 *
 * These were 520x300 — which is the number from the *other* spec
 * (halo-widget-curation-05102026/RESULT.md §1.4). That document does not govern the native
 * window; §9 does, and it says 760x460 with the min values below.
 *
 * §9's example is `min(MAX, max(MIN, display.bounds.width - 24))`, so the canvas is CLAMPED TO
 * THE DISPLAY: on a 1280px screen it is 760 wide, on a 400px one it is 376 (never below the
 * 360 min). §9 also states the canvas may resize when display topology changes but MUST NOT
 * resize as part of the compact <-> expanded animation — which is what the fixed-canvas
 * constant in `sizes.ts` is for, and why `moveWindowToGeometry` only ever MOVES the window. */
/* §9's budget now lives in `sizes.ts` (see HALO_CANVAS_MAX_*). Re-exported here so the
 * main process can keep importing MAX_CANVAS_WIDTH from geometry without a cycle. */
export const MAX_CANVAS_WIDTH = HALO_CANVAS_MAX_WIDTH;
export const MAX_CANVAS_HEIGHT = HALO_CANVAS_MAX_HEIGHT;
export const MIN_CANVAS_WIDTH = HALO_CANVAS_MIN_WIDTH;
export const MIN_CANVAS_HEIGHT = HALO_CANVAS_MIN_HEIGHT;

/** HALO §73 expanded width classes. */
export const EXPANDED_WIDTH_SM = 360;
export const EXPANDED_WIDTH_MD = 460;
export const EXPANDED_WIDTH_LG = 520;

/** HALO §123 starting wing token. */
export const DEFAULT_NOTCH_WING_WIDTH = 38;

export const DEFAULT_CALIBRATION = {
  notchWidthDelta: 0,
  notchHeightDelta: 0,
  xOffset: 0,
  yOffset: 0,
  wingWidth: DEFAULT_NOTCH_WING_WIDTH,
  compactWidth: 0,
  compactHeight: 0,
  expandedWidth: EXPANDED_WIDTH_MD,
  expandedHeight: 0,
};

export type Calibration = typeof DEFAULT_CALIBRATION;

/** HALO §162: hardcoded resolutions are banned as identification. Nothing here
 * compares a display to a magic number — every value is measured or derived. */
const NOTCHLESS_COMPACT: Size = { width: 232, height: 40 };

export interface DisplayLike {
  id: number;
  bounds: Rect;
  workArea: Rect;
  scaleFactor: number;
  label?: string;
}

export interface GeometryInput {
  displayId: number;
  displayBounds: Rect;
  workArea: Rect;
  scaleFactor: number;
  edge?: OverlayEdge;
  notch?: NotchGeometry;
  calibration?: Partial<Calibration>;
  /** User's hitbox padding. Omitted = the pill exactly, no extra reach. */
  hotZone?: HotZoneOptions;
  /**
   * The resolved S/M/L preset. Omitted = Medium, so a caller that has not been migrated
   * still gets a valid, designed size rather than the old calibration default.
   *
   * THIS REPLACES `calibration.expandedWidth/expandedHeight` as the source of the expanded
   * surface. Those two fields defaulted to `460 / 0`, and `expandedHeight: 0` then hit
   * `|| MAX_CANVAS_HEIGHT`, which silently produced a 460x300 surface — a third taller than
   * any designed preset. That fallback is gone; the size model owns the number now.
   */
  size?: HaloSize;
}

function sizeInDisplay(bounds: Rect, desired: Size): Size {
  const safeW = Math.max(160, bounds.width - 24);
  const safeH = Math.max(120, bounds.height - 24);
  return {
    width: Math.min(desired.width, safeW),
    height: Math.min(desired.height, safeH),
  };
}

/**
 * HALO §123: on a real notch the compact surface is two wings fused to the
 * hardware gap, so its total width is 2W + N rather than a free-floating pill.
 */
export function compactWidthForNotch(notchWidth: number, wingWidth: number): number {
  return wingWidth * 2 + notchWidth;
}

export function computeCompactSize(
  notch: NotchGeometry | undefined,
  calibration: Calibration,
  preset?: HaloSize,
): Size {
  // MEASURED per-preset widths: 182 / 198 / 227 (Figma node tree). The old code used a fixed
  // 232 for every preset, which is why the trigger rect could be wider than the visible pill.
  const fallbackWidth = preset?.compactWidth ?? NOTCHLESS_COMPACT.width;
  const width =
    (calibration.compactWidth ||
      (notch?.hasNotch ? compactWidthForNotch(notch.width, calibration.wingWidth) : 0)) ||
      fallbackWidth;
  // `presetCompactHeight` comes from the active size preset (28/32/40). It is the SAME
  // number the renderer paints with, so the hover rect and the visible pill cannot drift.
  // A notch is still allowed to force a taller pill, and an explicit user calibration
  // still wins over everything.
  const presetHeight = preset?.compactHeight ?? NOTCHLESS_COMPACT.height;
  const height =
    calibration.compactHeight ||
    (notch?.hasNotch ? Math.max(presetHeight, notch.height + 8) : presetHeight);
  return { width, height };
}

/**
 * User-tunable hot-zone geometry.
 *
 * WHY THIS IS AN INPUT AND NOT A CONSTANT
 * ---------------------------------------
 * `stripBelow = 28` was the single hardest-coded number in the whole surface: it decided
 * where the island opens, and there was no way to change it, no way to see it, and no way
 * for a user whose pointer behaviour differed from the author's to make the island usable.
 * "Customizable hitbox" is exactly this number, plus the side padding, plus the anchor.
 */
export interface HotZoneOptions {
  /** Extra invisible hit area on each side of the pill, px. */
  padX: number;
  /** Extra invisible hit area beyond the pill, px. Applied on the side AWAY from the edge. */
  padY: number;
}

/**
 * Where the painted surface sits inside the canvas, as fractions.
 *
 * HALO §127, verbatim:
 * ```yaml
 * top:   transform_origin: top_center
 * left:  transform_origin: left_center
 * right: transform_origin: right_center
 * ```
 * so all three edges are CENTRED on their axis and flush with their edge. There is no
 * anchor argument and there must not be one: the same section ends "Do not introduce
 * arbitrary freeform positioning in the core model."
 *
 * WHY THE RENDERER NEEDS THIS AT ALL
 * --------------------------------
 * The main process moves the WINDOW, but the window is a transparent canvas and the surface
 * inside it was hardcoded to `top: 0; left: 50%` with `data-edge="top"`. So choosing the
 * left edge moved the window and changed nothing about where the island painted inside it —
 * the renderer had no idea which edge it was on. This is the shared contract that fixes it:
 * `computeGeometry` places the window flush with the requested edge, and the renderer places
 * the surface flush with the matching side of the canvas. Two halves of one decision.
 */
export function surfaceAnchorFractions(edge: OverlayEdge): { xFrac: number; yFrac: number } {
  switch (edge) {
    case 'left':
      return { xFrac: 0, yFrac: 0.5 };
    case 'right':
      return { xFrac: 1, yFrac: 0.5 };
    case 'top':
    default:
      return { xFrac: 0.5, yFrac: 0 };
  }
}

/** HALO §127's `transform_origin` for an edge. The renderer sets this on the surface. */
export function surfaceTransformOrigin(edge: OverlayEdge): string {
  switch (edge) {
    case 'left':
      return 'left center';
    case 'right':
      return 'right center';
    case 'top':
    default:
      return 'top center';
  }
}

/**
 * Where the painted surface sits inside the canvas, as an absolute Rect.
 *
 * THE ONE FUNCTION BOTH THE HITBOX AND THE CLICK REGION USE
 * --------------------------------------------------------
 * This is deliberately shared. The hover hit zone and the mouse-click region are two
 * different rectangles that must both be derived from the surface's real position — and if
 * they are computed independently they will drift, which is how you get an island that
 * opens when the cursor is nowhere near it, or that swallows clicks on a transparent part
 * of its canvas. One function, two callers.
 */
export function computeSurfaceRect(canvas: Rect, surface: Size, edge: OverlayEdge = 'top'): Rect {
  const { xFrac, yFrac } = surfaceAnchorFractions(edge);
  return {
    x: canvas.x + Math.round((canvas.width - surface.width) * xFrac),
    y: canvas.y + Math.round((canvas.height - surface.height) * yFrac),
    width: surface.width,
    height: surface.height,
  };
}

/**
 * HALO §49 — the hot zone is the visible compact pill plus the user's padding, NEVER the
 * transparent canvas.
 *
 * "The transparent 760×460 canvas must not itself be a giant hover trigger." §49 specifies
 * `hotZone = compact visible pill` for a notchless display, so the DEFAULT padding is 0 and
 * the pill is exactly the trigger. `padX`/`padY` let a user widen it for a pointer or a
 * different screen, which is the customization asked for; the clamp in HaloPreferences is
 * what stops that becoming the giant-trigger failure the section prohibits.
 *
 * WHY THIS MUST NEVER BECOME A CLICK REGION
 * -----------------------------------------
 * The hit zone is a HOVER region and nothing else. `haloIsland.ts` enforces that separation
 * at the OS level (`applyClickRegion`): the window is click-through while collapsed, and
 * when it expands its click region is shaped to the painted surface alone. So a user can
 * set `padY: 200` and the island will open when the cursor comes 200px down the screen
 * without that 200px ever intercepting a click. This matters because the island floats over
 * the user's real work — a hitbox that ate clicks near what someone is doing would be worse
 * than one that is too small.
 *
 * `padY` always grows AWAY from the attached edge: a top island grows downward. Growing
 * toward the edge would push the zone off-screen and do nothing.
 */
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

/**
 * The union of two rects — the smallest rect containing both.
 *
 * Used to build the EXPANDED trigger zone: the collapsed pill plus the expanded panel. The
 * pill is included because the island animates between the two, so during the transition both
 * shapes are momentarily painted and the cursor can legitimately be over either. Taking the
 * union means `inside` is monotonic across the open/close animation — there is no frame where
 * the surface the user is looking at is not also a trigger.
 *
 * Degenerate input (`width`/`height` of 0) collapses to the other rect rather than producing
 * a zero-area zone that can never contain the cursor, which would make the island
 * un-openable.
 */
export function unionRect(a: Rect, b: Rect): Rect {
  if (a.width <= 0 || a.height <= 0) return { ...b };
  if (b.width <= 0 || b.height <= 0) return { ...a };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * The single place display placement is computed. HALO §25 requires exactly one
 * reconciler; no other module may derive a position.
 */
export function computeGeometry(input: GeometryInput): IslandGeometry {
  const edge = input.edge ?? 'top';
  const calibration: Calibration = { ...DEFAULT_CALIBRATION, ...(input.calibration ?? {}) };
  const notch: NotchGeometry = input.notch ?? {
    hasNotch: false,
    width: 0,
    height: 0,
    source: 'none',
  };

  const bounds = input.displayBounds;
  /* §9's clamp, verbatim:
  /* THE WINDOW IS THE EXPANDED PANEL - verdict 2026-10-08, conflict 6.
   *
   * It was `min(MAX_CANVAS_WIDTH, safeW)` = a fixed 760x460 for every preset and every phase,
   * which left ~300px of DEAD TRANSPARENT SPACE below a 134px panel. That is exactly the cost
   * the long-form spec's section 181 names: "Large transparent surfaces waste compositor
   * resources and complicate hit testing."
   *
   * The verdict replaces it with:
   *
   *   "Window = the expanded size of the current setting: 480x118, 560x134 or 680x154. It
   *    resizes only when the user changes the size setting (collapse first, resize, then
   *    re-expand). Never during open or close."
   *
   * So the canvas IS `preset.expandedWidth x preset.expandedHeight` - no separate budget. The
   * reveal still has somewhere to scale from: the pill is top-centre inside this box and
   * scales up to it, which is the `scale(0.94) -> scale(1)` the verdict kept. Nothing is
   * clipped because nothing is larger than the window.
   *
   * THE DISPLAY CLAMP REMAINS and still wins - a canvas may never exceed the display, so on a
   * viewport narrower than the preset the window shrinks rather than going off-screen. */

  const hotZone: HotZoneOptions = {
    padX: input.hotZone?.padX ?? 0,
    padY: input.hotZone?.padY ?? 0,
  };

// The compact surface's size. Position WITHIN the canvas is `surfaceAnchorFractions`,
    // shared with the renderer so the window and the painted surface cannot disagree.
    //
    // ONE SOURCE OF TRUTH. `computeCompactSize` used to return a hardcoded `232x40`
    // (NOTCHLESS_COMPACT) while the renderer laid the pill out at the preset's
    // `compactHeight` — 28 / 32 / 40. Two different heights for the same visible rect is
    // what made the hover FSM close the island while the cursor sat on it: the expanded
    // `hotZoneExpanded` union was built from a 40px-tall rect the user could not see.
    // The preset's `compactHeight` is authoritative for BOTH sides; only an explicit
    // user calibration override still wins.
// Resolve the S/M/L preset FIRST — the compact height and the expanded surface both derive
    // from it, so it must exist before either is computed. (It used to be resolved further
    // down, which made this block a temporal-dead-zone ReferenceError.)
  /* DISPLAY CLAMP - a canvas may never exceed the display, on either axis.
   *
   * `bounds.width - 24` is section 9's margin, and the floor keeps a pathologically narrow
   * display from producing a zero-sized window. These are declared HERE because the canvas
   * lines below consume them, and `preset` is declared here too because THEY consume it:
   * three orderings in one block, because two of them are ReferenceErrors rather than wrong
   * numbers. An earlier version of this change put the canvas lines above `preset` and cost a
   * TDZ crash - which is why the ordering is documented instead of left to chance. */
  const safeW = Math.max(160, bounds.width - 24);
  const safeH = Math.max(120, bounds.height - 24);
    const preset = input.size ?? HALO_SIZE_PRESETS.medium;

  /* Canvas = the expanded panel. Declared HERE, after `preset`, not before: using
   * `preset` above its own `const` is a TDZ ReferenceError, which is a crash rather than
   * a wrong number, so the ordering is load-bearing and not stylistic. */
  const canvasWidth = Math.min(preset.expandedWidth, safeW);
  const canvasHeight = Math.min(preset.expandedHeight, safeH);
    const compactSize = sizeInDisplay(
      bounds,
      computeCompactSize(notch, calibration, preset),
    );
    // Resolve the S/M/L preset FIRST — both the compact and the expanded surface derive from
    const { xFrac, yFrac } = surfaceAnchorFractions(edge);

  let x = bounds.x + Math.round((bounds.width - canvasWidth) * xFrac);
  let y = bounds.y + Math.round((bounds.height - canvasHeight) * yFrac);

  if (edge === 'left') {
    x = bounds.x;
  } else if (edge === 'right') {
    x = bounds.x + bounds.width - canvasWidth;
  } else {
    y = bounds.y;
  }

  const canvas: Rect = {
    x: x + calibration.xOffset,
    y: y + calibration.yOffset,
    width: canvasWidth,
    height: canvasHeight,
  };

  /* THE EXPANDED SURFACE COMES FROM THE SIZE PRESET. AND ONLY FROM IT.
   *
   * It used to come from `calibration.expandedWidth / expandedHeight`, which defaulted to
   * `460 / 0`. Because `expandedHeight` was 0, the `|| MAX_CANVAS_HEIGHT` fallback silently
   * substituted the whole canvas for the CONTENT height — the exact class of bug that made
   * the click region swallow the desktop.
   *
   * An intermediate version kept calibration as an "explicit override wins" path. A numeric
   * probe killed it: `DEFAULT_CALIBRATION.expandedWidth` is 460, so the DEFAULT beat every
   * preset and all three sizes rendered 460 wide. You cannot tell "the user set this" from
* "this is the default" by testing for a non-zero number, so that path is gone rather than
     * patched. The preset is the single source; `xOffset`/`yOffset` remain genuine calibration.
     *
     * (`preset` itself is resolved near the top of this function, above the compact block,
     * because the compact height now derives from it too.)
     */
  /*
   * THE PRESET IS A DESIGN SIZE, NOT A CONSTANT. It is fitted to the canvas that actually
   * exists.
   *
   * Measured before `fitToCanvas` existed: zero references to aspect, orientation, landscape
   * or portrait in `src/shared/halo/` or `src/features/halo/`, and zero `aspect-ratio` /
   * `@container` rules in the stylesheet. On a 1920-wide display the Medium surface sat at 29%
   * of the width and never adapted, and on a display narrower than the preset the surface
   * simply clipped instead of adapting.
   *
   * So the surface is `fitToCanvas(canvas, preset)` — one uniform factor, aspect preserved by
   * construction, never exceeding either bound. `fit.tight` travels on the geometry so the
   * renderer can drop chrome when there genuinely is not enough room, and `fit.wide` so a row
   * can use surplus width rather than stretching a column.
   */
  const fit = fitToCanvas({ canvasWidth: canvas.width, canvasHeight: canvas.height, preset });
  const expandedSize = sizeInDisplay(bounds, { width: fit.width, height: fit.height });

  /* TWO trigger rects, one per phase.
   *
   * `hotZone` stays the COMPACT pill (+ padding) because that is what the user asked for:
   * while collapsed, the island opens when the cursor touches the visible small UI and
   * nothing else. Widening it is what makes an overlay feel like it is grabbing the desktop.
   *
   * `hotZoneExpanded` is the union of that pill and the expanded surface. Without it the FSM
   * tested the 232x40 pill against a 460x236 panel and closed the island as soon as the
   * cursor moved down onto its own content. The union is monotonic, so there is no frame of
   * the open/close animation where the visible surface is not also a trigger.
   *
   * Padding is applied to the union, not to the compact pill alone, so `padY` still widens
   * the EXPANDED trigger for a user who wants a more forgiving target — and still widens the
   * collapsed one identically. `leaveMarginPx` in `hoverMachine` adds further tolerance on
   * top of both at poll time. */
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
    /** the resolved preset, so the renderer and the log agree with the geometry. */
    size: preset,
    /** how the preset was fitted to the real canvas. The renderer uses `tight` to drop chrome. */
    fit,
    hotZone: compactZone,
    hotZoneExpanded: unionRect(compactZone, expandedZone),
  };
}

export type DisplayTarget =
  | { type: 'primary' }
  | { type: 'display'; displayId: number }
  | { type: 'cursor'; x: number; y: number };

/**
 * HALO §28 + §161. A saved display that has been unplugged must fall back rather
 * than leave the island logically attached to a display that no longer exists.
 */
export function resolveTargetDisplay(
  displays: DisplayLike[],
  primaryId: number,
  target: DisplayTarget,
  savedFallbackId?: number,
): DisplayLike | null {
  if (displays.length === 0) return null;

  if (target.type === 'display') {
    const exact = displays.find((d) => d.id === target.displayId);
    if (exact) return exact;
    const fallbackId = savedFallbackId ?? primaryId;
    return displays.find((d) => d.id === fallbackId) ?? displays[0];
  }

  if (target.type === 'cursor') {
    const hit = displays.find(
      (d) =>
        target.x >= d.bounds.x &&
        target.x < d.bounds.x + d.bounds.width &&
        target.y >= d.bounds.y &&
        target.y < d.bounds.y + d.bounds.height,
    );
    if (hit) return hit;
  }

  return displays.find((d) => d.id === primaryId) ?? displays[0];
}
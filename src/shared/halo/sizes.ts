/**
 * HALO SIZE MODEL — the three designed presets and the fixed window canvas.
 *
 * WHY THIS LIVES IN `shared/` AND NOT IN `features/halo/HaloPreferences.ts`
 * ------------------------------------------------------------------------
 * `HaloPreferences.ts` states the rule explicitly: "`shared/` cannot import from `features/`".
 * The main process computes window geometry in `shared/halo/geometry.ts` and the renderer
 * paints in `features/halo/OverlayRoot.tsx`, and BOTH need these numbers. So the model sits
 * here and `HaloPreferences` re-exports it, which keeps one source of truth without creating
 * a cycle or inverting the layering.
 *
 * SOURCE: measured off Figma board `1 / Sizes`. Board labels, verbatim:
 *   SMALL   480 wide, type 85%, icon-only tabs
 *   MEDIUM  560 wide (default)
 *   LARGE   680 wide, type 120%
 * and board `5 / How it works in Electron`:
 *   "one transparent, frameless, always-on-top window, fixed at the Large expanded size.
 *    The shape morphs inside the window with transform and opacity only. The window never
 *    resizes, so no flicker on any OS."
 */

export type HaloSizePreset = 'small' | 'medium' | 'large';

/**
 * HALO §9 — the canvas BUDGET, verbatim:
 *     canvas: { max_width: 760, max_height: 460,
 *               recommended_min_width: 360, recommended_min_height: 120 }
 *
 * This lives here rather than in `geometry.ts` because `geometry.ts` already imports this
 * module — importing back would create a cycle, which AGENTS.md §5d explicitly forbids. So
 * `sizes.ts` is the single source for the canvas budget and `geometry.ts` re-exports it.
 */
export const HALO_CANVAS_MAX_WIDTH = 760;
export const HALO_CANVAS_MAX_HEIGHT = 460;
export const HALO_CANVAS_MIN_WIDTH = 360;
export const HALO_CANVAS_MIN_HEIGHT = 120;

export interface HaloSize {
  /** the EXPANDED surface. This is what the window is shaped to. */
  expandedWidth: number;
  expandedHeight: number;
  /** the compact pill height. Its WIDTH stays content-driven. */
  compactHeight: number;
  /**
   * The compact pill WIDTH for this preset — MEASURED from the Figma node tree:
   * 182 (Small) / 198 (Medium) / 227 (Large). It scales with `typeScale` and shrinks further
   * at Small, where the label is dropped for icon-only tabs.
   *
   * This is the per-preset width the hot zone and click region must use. Leaving it
   * content-driven meant main and the renderer could disagree about how wide the pill is,
   * which is the same class of bug as the height mismatch: the trigger rect is tested against
   * a rect the user cannot see.
   */
  compactWidth: number;
padding: number;
     /** the content row inside the expanded panel. A page may never exceed it. */
     rowHeight: number;
     /**
      * Body font-size for this preset — HALO_STATES.html `--f-body`: 11 (S) / 12 (M) / 14 (L).
      *
      * It was missing entirely, which is why the compact pill had no way to size itself and
      * defaulted to a hardcoded 13px in the settings preview — a value that exists in no design.
      * The pill's DIVIDER is sized from this too (`.pill .vd { height: var(--f-body) }`), because
      * the expanded `--halo-vd` divider is 36-52px and would be taller than the entire pill.
      */
     fBody: number;
  /** multiplier for every type + rhythm token, floored at 11px in CSS. */
  typeScale: number;
  /** Small hides tab labels; Medium and Large show icon + label. */
  iconOnlyTabs: boolean;
  label: string;
}

export const HALO_SIZE_PRESETS: Record<HaloSizePreset, HaloSize> = {
  /* MEASURED FROM THE FIGMA FILE (node tree, not the exported PNG):
   *   "Halo compact / Dark" INSTANCE  182x28   under SMALL
   *   "Halo compact / Dark" INSTANCE  198x32   under MEDIUM
   *   "Halo compact / Dark" INSTANCE  227x40   under LARGE
   *
   * The compact pill is NOT a fixed width. It was 232 at every size — the number from
   * halo-widget-curation-05102026/RESULT.md §1.2 ("hard 232x40"), which governs a different
   * design. The Figma file scales it with the type scale, and at Small the label is dropped
   * (icon-only tabs) so the pill is only 182 wide.
   */
  small: {
    expandedWidth: 480,
    /* 118, DERIVED including the 1px border: border(1) + pad(8) + row(48) + gap(8)
     * + tabs(44) + pad(8) + border(1) = 118.
     *
     * An earlier pass had this at 116 by omitting the two borders. The Specialist caught
     * it and the arithmetic confirms it: Medium 1+12+56+8+44+12+1 = 134 and Large
     * 1+16+64+12+44+16+1 = 154, both matching the Figma instance frames. The handoff
     * §4 table says "about 116 / about 132 / about 152" — "about" is doing real work
     * there, and the rendered box is 118/134/154. */
    expandedHeight: 118,
    compactWidth: 182,
    compactHeight: 28,
    padding: 8,
    rowHeight: 48,

     fBody: 11,
     typeScale: 0.85,
    iconOnlyTabs: true,
    label: 'Small',
  },
  medium: {
    /* Board 2 "Medium": frame 560 wide; content 534x56; page/focus 526x51; tabs 534x44 r=8.
     * Height = 1 + 12 + 56 + 8 + 44 + 12 + 1 = 134 (see the Small preset for the derivation). */
    expandedWidth: 560,
    expandedHeight: 134,
    compactWidth: 198,
    compactHeight: 32,
    padding: 12,
    rowHeight: 56,

     fBody: 12,
     typeScale: 1,
    iconOnlyTabs: false,
    label: 'Medium',
  },
  large: {
    expandedWidth: 680,
    /* 1 + 16 + 64 + 12 + 44 + 16 + 1 = 154. The gap is 12 at Large, 8 at S/M. */
    expandedHeight: 154,
    compactWidth: 227,
    compactHeight: 40,
    padding: 16,
    rowHeight: 64,

     fBody: 14,
     typeScale: 1.2,
    iconOnlyTabs: false,
    label: 'Large',
  },
};

/**
 * HALO §9 FIXED CANVAS — max_width 760, max_height 460, clamped to the selected display.
 *
 * These were derived from the Large preset (680x152), which made the WINDOW the size of the
 * largest surface: the canvas had no room to hold anything but the panel itself. §9 separates
 * the CANVASTORAGE BUDGET (760x460, "start with") from the SURFACE sizes inside it, and
 * `geometry.ts` clamps it per-display as
 * `Math.min(MAX_CANVAS_WIDTH, Math.max(MIN_CANVAS_WIDTH, display.bounds.width - 24))`.
 *
 * The comment above previously claimed 520x300 while the code returned 680x152 — a third
 * value. The numbers now come from `geometry.ts`, which is where §9's MAX/MIN actually live,
 * so there is one source rather than three drifting copies.
 *
 * §181 ("no full-screen transparent canvas; prefer the smallest canvas that safely contains
 * the island") argues for tighter, but §9's own numbers are the explicit budget and §181 is
 * a preference, so §9 wins: the window is 760x460 and never changes during animation (§11).
 */
export const HALO_CANVAS_WIDTH = HALO_CANVAS_MAX_WIDTH;
export const HALO_CANVAS_HEIGHT = HALO_CANVAS_MAX_HEIGHT;

/**
 * Map the stored continuous `prefs.scale` onto one of the three presets.
 *
 * The bands are centred on the three designed scales (0.85 / 1.0 / 1.2) so a stored `1.0` —
 * which is what every existing install has — lands on Medium. That matters: without it the
 * default would silently change size for everyone who already had the island.
 */
export function presetForScale(scale: number): HaloSizePreset {
  if (!Number.isFinite(scale)) return 'medium';
  if (scale < 0.92) return 'small';
  if (scale > 1.1) return 'large';
  return 'medium';
}

/** The ONE function that turns a scale into geometry. */
export function resolveHaloSize(scale: number): HaloSize {
  return HALO_SIZE_PRESETS[presetForScale(scale)];
}
/**
 * RESPONSIVE FIT — make a preset fit the space actually available.
 *
 * WHY THIS IS SEPARATE FROM THE PRESETS
 * -------------------------------------
 * The presets are DESIGN sizes measured off Figma board `1`. They describe what the island
 * looks like when it has room. They say nothing about a 1024-wide laptop, a portrait window,
 * a 125% DPI display, or a user who has dragged a third monitor into the layout.
 *
 * Measured before this existed: **zero** references to aspect, orientation, landscape or
 * portrait anywhere in `src/shared/halo/` or `src/features/halo/`, and zero `aspect-ratio` or
 * `@container` rules in the stylesheet. On a 1920-wide display the Medium surface used 29% of
 * the width and never adapted; on anything narrower than 680 the canvas clipped instead of
 * adapting. So "the UI adjusts according to the size" was not implemented at all.
 *
 * THE RULES, AND WHY EACH ONE
 * ---------------------------
 * 1. NEVER scale type to fit. Type has a hard 11px floor (handoff §4) and shrinking it to make
 *    a box fit is how the small preset became unreadable. If the box is too small for the
 *    content, the LAYOUT adapts — padding, gaps, which rows show — not the font.
 * 2. Clamp to a MINIMUM surface, because below roughly this the 4 pages and a 44px tab rail
 *    physically do not fit. Below the floor we shrink rather than break.
 * 3. Preserve the preset's ASPECT when clamping, so the island never changes proportion and
 *    stop looking like the object it is a morph of.
 */
export interface FitInput {
  /** the canvas the surface must live inside, in DIP */
  canvasWidth: number;
  canvasHeight: number;
  /** the preset being fitted */
  preset: HaloSize;
}

export interface FittedSize {
  width: number;
  height: number;
  /** how much the preset was clamped, 1 = untouched. Lets the renderer drop chrome when tight. */
  squeeze: number;
  /** true when there is not enough room for the full preset — the layout must simplify. */
  tight: boolean;
  /** true when the available box is proportionally WIDER than the preset: extra width is real,
   *  so the row can breathe instead of stretching a column. */
  wide: boolean;
}

/** Below this the 4 pages plus a 44px rail stop fitting. Deliberately conservative. */
export const HALO_MIN_SURFACE_W = 320;
export const HALO_MIN_SURFACE_H = 88;

export function fitToCanvas({ canvasWidth, canvasHeight, preset }: FitInput): FittedSize {
  const availW = Math.max(1, canvasWidth);
  const availH = Math.max(1, canvasHeight);

  /*
   * ONE UNIFORM FACTOR, not two independent clamps.
   *
   * The first version clamped width and height SEPARATELY:
   *
   *     const w = Math.min(preset.expandedWidth,  availW);
   *     const h = Math.min(preset.expandedHeight, availH);
   *
   * and a probe showed that is wrong twice over. On a 360x152 canvas it returned 356x148 —
   * aspect 2.41 against the preset's 4.47, a distorted slab that is no longer the same object.
   * And subtracting a 2px safety pad meant a canvas sized EXACTLY to the preset (560x132)
   * returned 556x128, so a perfect fit reported itself as clamped.
   *
   * A single factor `k = min(availW/w, availH/h, 1)` cannot do either: it preserves the aspect
   * ratio by construction, it never exceeds either bound, and it returns the preset EXACTLY
   * when the canvas is big enough. `k <= 1` is what "the design fits" means.
   *
   * Note this scales the BOX, not the type. The 11px floor still holds because the renderer
   * derives type from the preset's own `typeScale`, not from this factor.
   */
  const k = Math.min(1, availW / preset.expandedWidth, availH / preset.expandedHeight);

  const width = Math.max(1, Math.round(preset.expandedWidth * k));
  const height = Math.max(1, Math.round(preset.expandedHeight * k));

  const presetAspect = preset.expandedWidth / preset.expandedHeight;
  const availAspect = availW / availH;

  return {
    width,
    height,
    squeeze: Number(k.toFixed(4)),
    tight: k < 0.999,
    /* "Wide" means the available box is proportionally WIDER than the design, so a row can
     * distribute space instead of stretching one column. 4% stops float noise. */
    wide: k >= 0.999 && availAspect > presetAspect * 1.04,
  };
}

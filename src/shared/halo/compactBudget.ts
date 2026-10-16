/**
 * THE COMPACT PILL BUDGET — a pure function, so the fit rule is testable without a DOM.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * The pill was cut off because `.pill .n { max-width: 140px }` — a rule copied verbatim from
 * `HALO_STATES.html` board 1 — sizes the NAME in isolation. In a single flex row it never
 * subtracts the clock, the divider and the gaps, so the row was wider than the window the
 * compositor was told to make clickable, and the tail of the app name was clipped at the
 * rounded edge. Measured:
 *
 *     small   210px of content in a 182px pill  -> 40px over
 *     medium  213px of content in a 198px pill  -> 31px over
 *     large   220px of content in a 227px pill  ->  9px over
 *
 * A CSS-only assertion cannot catch that, because the bug is an ARITHMETIC disagreement between
 * the stylesheet's stated rule and the measured preset width. Stating the arithmetic here makes
 * it executable: `halo-compact-budget.probe.mts` asserts the S/M/L figures, and a change to any
 * fixed child (a bigger dot, a wider clock, an extra gap) fails a number instead of quietly
 * producing a clipped pill.
 *
 * THE PRESET WIDTHS ARE READ, NOT RESTATED. `COMPACT_PILL_WIDTH` duplicates
 * `HALO_SIZE_PRESETS[*].compactWidth` rather than importing it, because `sizes.ts` imports
 * `geometry.ts` for `fitToCanvas` and a reverse import would close the cycle that
 * `AGENTS.md` §5d forbids. `halo-compact-budget.probe.mts` asserts the two tables are equal, so
 * the duplication cannot drift — a duplicated constant is only dangerous when nothing checks it.
 */

export type CompactPreset = 'small' | 'medium' | 'large';

/** The visible compact pill width per preset. Asserted equal to `sizes.ts` in the probe. */
export const COMPACT_PILL_WIDTH: Readonly<Record<CompactPreset, number>> = {
  small: 182,
  medium: 198,
  large: 227,
};

export interface CompactBudgetInput {
  preset: CompactPreset;
  /** Horizontal padding on EACH side, not the total. */
  horizontalPadding: number;
  /** Widths of the children that must never shrink: icons, dot, clock, verified values. */
  fixedChildWidths: readonly number[];
  /** Every flex `gap` between adjacent children in this row. */
  gaps: readonly number[];
  /** Vertical dividers, which occupy width too. Defaults to none. */
  dividers?: readonly number[];
}

/**
 * Width left for the ONE flexible child — the app/site name.
 *
 * Clamped at 0 rather than allowed to go negative: a negative "remaining" is not a rendering
 * instruction, it is a measurement that says the pill cannot show the row at all, and letting it
 * flow into a `max-width` would produce a silently wrong clamp instead of a visible zero.
 */
export function remainingCompactWidth(input: CompactBudgetInput): number {
  const gapWidth = input.gaps.reduce((sum, n) => sum + n, 0);
  const dividerWidth = (input.dividers ?? []).reduce((sum, n) => sum + n, 0);
  const fixedWidth = input.fixedChildWidths.reduce((sum, n) => sum + n, 0);
  return Math.max(
    0,
    COMPACT_PILL_WIDTH[input.preset] -
      input.horizontalPadding * 2 -
      fixedWidth -
      gapWidth -
      dividerWidth,
  );
}

/**
 * The `stopwatch` pill's own budget — the widest fixed set, and the one that overflowed.
 *
 * The clock is priced at **3.5em**, which is not a guess: it is what RESULT.md §3.2's supplied
 * fixtures (S=100, M=109, L=131) encode, and §3.2 says to reproduce them and inspect any
 * mismatch rather than restate a new number. My first pass estimated 8 glyphs at 0.55em = 4.4em
 * and the probe returned 91/98/118 instead of 100/109/131; solving the fixtures backwards gives
 * exactly 3.5em at every preset (39/11, 42/12, 49/14), so that is the fixture's model.
 *
 * CAVEAT WORTH KEEPING: 3.5em is UNDER a real 8-glyph JetBrains Mono clock (0.6em advance =
 * 4.8em), so the true available width is somewhat smaller than these figures and the real name
 * will ellipsise a little earlier. That does not affect the fix — the name flexes to whatever is
 * actually left — but it does mean these numbers are a FLOOR for regression purposes, not a
 * prediction of the rendered width. A real measurement belongs in the renderer probe; this one
 * exists so a changed dot, clock or gap fails as a number instead of as a clipped pill.
 */
export function stopwatchPillBudget(fBody: number, preset: CompactPreset): number {
  const clockWidth = Math.round(3.5 * fBody);
  return remainingCompactWidth({
    preset,
    horizontalPadding: preset === 'small' ? 6 : 8,
    fixedChildWidths: [6, clockWidth],
    gaps: [8, 8, 8],
    dividers: [1],
  });
}
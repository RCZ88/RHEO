/* halo-row-fit.probe.mjs — printed-numbers fit check for the HALO expanded island rows.
 *
 * Claim under test: after the FocusPageRow compaction, every row variant's min-content
 * width fits the expanded surface's inner box (460 − 2×16 shell padding = 428px).
 * Fits-by-construction must be a printed number, not a claim (AGENTS.md §0-0).
 *
 * Char widths are CONSERVATIVE UPPER BOUNDS (wider than real rendering), so a PASS here
 * is stronger than a real-browser measurement:
 *   - 11px UI text (EYEBROW/LABEL): 6.5 px/char   (real Inter 11px ≈ 5.8)
 *   - 13px mono/value text:          8.0 px/char   (real JetBrains Mono 13px ≈ 7.8)
 *   - 26px hero mono clock:         15.6 px/char   (JetBrains Mono 0.6em exactly)
 * Truncated spans (className="truncate" + minWidth:0) count their minimum as ~24px
 * (one glyph + ellipsis) — they can shrink; nowrap-unshrinkable spans count full text.
 *
 * Run: node agent/probes/halo-row-fit.probe.mjs
 */

const BUDGET = 460 - 2 * 16; // EXPANDED_WIDTH_MD − 2×--halo-gap-block(16 at scale 1)

const ui = (s) => s.length * 6.5;            // 11px label text
const val = (s) => s.length * 8.0;           // 13px mono text
const hero = (s) => s.length * 15.6;         // 26px mono clock

const HOLD = (label) => val(label) + 24 /*padding*/ + 2 /*border*/;
const CHIP = (label, icon = 11) => icon + 6 + val(label) + 20 /*padding*/ + 2;
const ICONBTN = 44;
const DIV = 1;
const SPACER = 0;
const truncMin = 24; // one glyph + '…' for a truncate span

/* row = array of [name, width]; gaps between children. */
const fit = (name, children, gap) => {
  const content = children.reduce((a, [, w]) => a + w, 0);
  const gaps = gap * Math.max(0, children.length - 1);
  const total = content + gaps;
  const slack = BUDGET - total;
  const verdict = slack >= 0 ? 'FITS' : 'OVER by ' + (-slack).toFixed(0) + 'px';
  console.log(
    `${name.padEnd(14)} children=${children.length}  content=${content.toFixed(0)}px  gaps=${gaps}px  TOTAL=${total.toFixed(0)}px  budget=${BUDGET}  slack=${slack.toFixed(0)}px  ${verdict}`
  );
  return slack >= 0;
};

/* ── BEFORE (the measured offenders) ──────────────────────────────────────────── */
console.log('=== BEFORE compaction (for reference) ===');
fit('start-editor OLD', [
  ['back', ICONBTN], ['label', ui('Start focus')], ['div', DIV],
  ['hold 25 minutes', HOLD('25 minutes')], ['hold 50 minutes', HOLD('50 minutes')],
  ['hold Open', HOLD('Open')], ['div', DIV], ['chip Break', CHIP('Break')],
  ['spacer', SPACER], ['close', ICONBTN],
], 12);
fit('break-set OLD', [
  ['back', ICONBTN], ['label', ui('Break until')], ['div', DIV],
  ['hold 10 minutes', HOLD('10 minutes')], ['hold 15 minutes', HOLD('15 minutes')],
  ['hold 30 minutes', HOLD('30 minutes')], ['spacer', SPACER], ['close', ICONBTN],
], 12);
fit('away OLD', [
  ['clock grp', Math.max(hero('0:00:00'), 6 + 6 + ui('Stopwatch'))],
  ['div', DIV],
  ['away col', Math.max(ui('Away'), 12 + 6 + val('3h 45m'))], // nowrap, no truncate
], 12);

/* ── AFTER (the shipped compaction) ──────────────────────────────────────────── */
console.log('=== AFTER compaction (current FocusPageRow) ===');
let allFit = true;

// Start editor: back, label, div, 25m, 50m, Open, Break chip, spacer — gap 8, Close dropped
allFit &&= fit('start-editor', [
  ['back', ICONBTN], ['label', ui('Start focus')], ['div', DIV],
  ['hold 25m', HOLD('25m')], ['hold 50m', HOLD('50m')], ['hold Open', HOLD('Open')],
  ['chip Break', CHIP('Break')], ['spacer', SPACER],
], 8);

// Break-set: back, label, div, 10m, 15m, 30m, spacer — gap 8
allFit &&= fit('break-set', [
  ['back', ICONBTN], ['label', ui('Break until')], ['div', DIV],
  ['hold 10m', HOLD('10m')], ['hold 15m', HOLD('15m')], ['hold 30m', HOLD('30m')],
  ['spacer', SPACER],
], 8);

// Normal row, away case: clock group, div, away col (value now truncates)
allFit &&= fit('away', [
  ['clock grp', Math.max(hero('0:00:00'), 6 + 6 + ui('Stopwatch'))],
  ['div', DIV],
  ['away col', Math.max(ui('Away'), 12 + 6 + truncMin)],
], 12);

// Normal row, session case: clock, div, Now col (truncates), Ends col
allFit &&= fit('session', [
  ['clock grp', Math.max(hero('0:00:00'), 6 + 6 + ui('Focus') + 4 + 11 + ui('Locked'))],
  ['div', DIV],
  ['now col', Math.max(ui('Now'), 12 + 6 + truncMin)],
  ['ends col', Math.max(ui('Ends'), val('14:05'))],
], 12);

// Break-live row: clock, div, break col + countdown (VALUE 13px mono)
allFit &&= fit('break-live', [
  ['clock grp', Math.max(hero('0:00:00'), 6 + 6 + ui('Break'))],
  ['div', DIV],
  ['break col', Math.max(ui('Until'), val('14:35') + 12 + 6)],
], 12);

console.log(allFit ? '\nRESULT: ALL ROWS FIT the 428px inner box (conservative bounds)' : '\nRESULT: FAIL — a row exceeds the budget');
process.exit(allFit ? 0 : 1);

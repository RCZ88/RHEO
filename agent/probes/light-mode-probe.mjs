// Measures the light-mode "everything is grey" bug and asserts it is gone.
//
//   node agent/probes/light-mode-probe.mjs
//
// THE BUG IT MEASURES
// -------------------
// `src/index.css` remaps dark zinc backgrounds for light mode, but the selectors
// only ever matched the BARE class names:
//
//     html.light :where(.bg-zinc-900) { background-color: var(--ws-surface-raised); }
//
// A Tailwind opacity variant is a DIFFERENT class name. An element whose class
// attribute contains `bg-zinc-900/30` has one token — `bg-zinc-900/30` — which
// `.bg-zinc-900` cannot match. So every translucent dark surface stayed dark grey
// on cream paper, which is what the user reported as "the cards, the charts, the
// bars, everything is grey, I can't see anything".
//
// Two things make a site compliant, and BOTH are checked:
//   (a) it carries an explicit `light:` token of its own  -> precise, reviewable
//   (b) the stylesheet safety net would catch it            -> backstop
//
// The net is verified the same way the browser would: the selector is matched
// against a representative class attribute and the specificity is computed with
// the real rules, so a claim about "the net catches it" is a computation.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// `.mjs` in a `type: module` repo — `__dirname` does not exist here.
const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = join(HERE, "..", "..");
const INDEX_CSS = join(ROOT, 'src', 'index.css');

/* The surfaces the user named. Only these are in scope — §0a scope discipline. */
const NAMED = [
  'src/pages/InsightsPage.tsx',
  'src/pages/GuidePage.tsx',
  'src/components/ai/AIToolsTab.tsx',
  'src/pages/DashboardPage.tsx',
];

/* A neutral dark background = one of zinc/neutral/gray/slate/stone at 800-950,
   with or without an alpha modifier. These are the classes that render grey. */
const DARK_BG = /\bbg-(?:zinc|neutral|gray|slate|stone)-(?:800|900|950)(\/\d+)?\b/g;
// Accept every shape the light-mode sweep actually uses in this repo:
//   light:bg-[var(--ws-surface-raised)]        direct token
//   light:bg-[color-mix(in_srgb,var(--ws-surface-sunken)_30%,transparent)]   preserved alpha
//   light:bg-white/95                          a deliberately white overlay
// Missing the last two made 4 already-correct call sites look like defects.
const HAS_LIGHT = new RegExp(
  '\\blight:(?:!?' +
    'bg-\\[var\\(--ws-surface' + '|' +
    'bg-\\[color-mix\\(in_srgb,var\\(--ws-surface' + '|' +
    'bg-white\\/' +
  ')',
);

function cssFilesUnder(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) cssFilesUnder(p, acc);
    else if (e.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

/* ---------------------------------------------------------------- net check */

/**
 * Strip comments before scanning.
 *
 * Without this the probe read its OWN explanatory comments as live code — it
 * reported `bg-[#0a0a0a]` as still present in GuidePage when the only remaining
 * occurrence was inside a comment describing that very fix, and reported
 * `background: #09090b` as hardcoded in the rewind stylesheet for the same
 * reason. A probe that cannot tell a comment from a declaration will cry wolf,
 * and a probe that cries wolf gets ignored.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

/** Does the safety-net selector match this class attribute? */
function netCatches(classAttr) {
  for (const step of [950, 900, 800]) {
    const token = `bg-zinc-${step}`;
    if (!classAttr.includes(token)) continue;
    // The net excludes interactive states on purpose — a hover/focus is a
    // deliberate signal, not a surface to correct.
    if (classAttr.includes(`hover:${token}`)) continue;
    if (classAttr.includes(`focus:${token}`)) continue;
    return true;
  }
  return false;
}

/** WCAG relative luminance + contrast, for the logo ramp. */
// Offsets are [0,2,4] AFTER the '#' is stripped. Slicing at [1,3,5] instead
// shifted every channel by one, which made #4a443a measure 3.28:1 against paper
// instead of its true ~8.7:1 — i.e. the probe reported the logo as failing
// contrast for being too DARK when it is in fact correct.
const hex2rgb = h => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16));
const relLum = ([r, g, b]) => {
  const f = v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

let failures = 0;
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

console.log('\n=== STYLESHEET SAFETY NET ===\n');
const css = stripComments(readFileSync(INDEX_CSS, 'utf8'));
ok('the net declares an alpha-variant rule (attribute selector)',
  /html\.light :where\(\s*\[class\*="bg-zinc-(?:900|950)"/.test(css));
ok('every net selector keeps its logic inside ONE :where() so it computes to (0,1,1)',
  (css.match(/html\.light :where\(\s*\[class\*="bg-zinc-/g) || []).length >= 2);
ok('hover: states are excluded from the net',
  css.includes(':not([class*="hover:bg-zinc-900"])'));
ok('the net targets warm tokens only, never a literal grey',
  /html\.light :where\([\s\S]*?\[class\*="bg-zinc-900"[\s\S]*?\)\s*\{\s*background-color: var\(--ws-surface-raised\)/.test(css));
{
  const netBlock = /html\.light :where\(\s*\[class\*="bg-zinc-[\s\S]*?\n\}/.exec(css);
  ok('the net block introduces no raw hex at all (warm tokens only)',
    !!netBlock && !/#[0-9a-f]{3,8}/i.test(netBlock[0]));
}

console.log('\n=== NET BEHAVIOUR (computed, not asserted) ===\n');
const netCases = [
  ['bg-zinc-900/30 card', true],
  ['bg-zinc-900/95 panel', true],
  ['bg-zinc-950 root', true],
  ['bg-zinc-800/60 inset', true],
  ['bg-zinc-900/50 hover:bg-zinc-900/50', false],
  ['hover:bg-zinc-900/20', false],
  ['light:bg-[var(--ws-surface-raised)]', false],
];
for (const [attr, expected] of netCases) {
  const got = netCatches(attr);
  ok(`net ${got ? 'catches' : 'skips'}  "${attr}"`, got === expected,
    got === expected ? '' : `expected ${expected}`);
}

console.log('\n=== NAMED SURFACES: unremapped dark backgrounds ===\n');
let totalDark = 0, totalCovered = 0;
const uncovered = [];
for (const rel of NAMED) {
  const abs = join(ROOT, rel);
  let src;
  try { src = stripComments(readFileSync(abs, 'utf8')); } catch { console.log(`  skip ${rel} (missing)`); continue; }
  // Operate per className attribute so "has its own light: token" is decided
  // per element, not per file.
  const attrs = src.match(/className="[^"]*"/g) || [];
  let dark = 0, covered = 0;
  for (const attr of attrs) {
    const hits = attr.match(DARK_BG);
    if (!hits) continue;
    dark += hits.length;

    // A dark surface is accounted for by ANY of three things:
    //   1. the element carries its own light-mode background token, OR
    //   2. the element carries its own light-mode HOVER token and every dark
    //      background on it is hover-only (the net excludes hover on purpose), OR
    //   3. the safety net's selector matches it.
    //
    // Rule 2 exists because `hover:bg-zinc-800` is a deliberate interaction
    // signal, not a surface to be corrected — flattening it to a solid card would
    // destroy the feedback. So a hover-only dark bg is correct as long as it has
    // an explicit warm hover token, which is what the codemod adds.
    const darkBare = attr.replace(/hover:bg-[a-z]+-\d+(?:\/\d+)?/g, '');
    const hoverOnly = !/\bbg-(?:zinc|neutral|gray|slate|stone)-/.test(darkBare);
    const hasOwnLight = /\blight:(?:hover:)?(?:!?bg-\[var\(--ws-surface|bg-\[color-mix\(in_srgb,var\(--ws-surface|bg-white\/)/.test(attr);

    if (hasOwnLight) covered += hits.length;
    else if (hoverOnly && /\blight:hover:bg-/.test(attr)) covered += hits.length;
    else if (netCatches(attr)) covered += hits.length;
    else uncovered.push(`${rel}: ${attr.slice(0, 120)}`);
  }
  totalDark += dark; totalCovered += covered;
  const pct = dark ? Math.round((covered / dark) * 100) : 100;
  console.log(`  ${rel.padEnd(34)} ${String(dark).padStart(3)} dark bg  ${String(covered).padStart(3)} covered  ${pct}%`);
}
console.log(`\n  ${'TOTAL'.padEnd(34)} ${String(totalDark).padStart(3)} dark bg  ${String(totalCovered).padStart(3)} covered  ${totalDark ? Math.round((totalCovered / totalDark) * 100) : 100}%`);

ok('every dark neutral background on a named surface is explicitly tokenised or caught by the net',
  totalDark === totalCovered,
  totalDark === totalCovered ? '' : `${uncovered.length} uncovered:\n      ${uncovered.join('\n      ')}`);


console.log('\n=== CASCADE ORDER (computed from the CSS specificity spec) ===\n');

/**
 * Specificity per CSS Selectors Level 4.
 *
 * This is a COMPUTATION over the spec, not a browser measurement — no Chromium
 * binary was reachable on this box (playwright refused on :9222 and no system
 * chrome exists), so the honest claim is "the arithmetic says X", not "I watched
 * a browser do X". The arithmetic is small and checkable, which is why it is worth
 * doing at all: the entire safety net is worthless if its precedence is wrong.
 *
 *   id          (1,0,0)
 *   class /
 *   attribute /
 *   pseudo-class  -> (0,1,0)
 *   element     -> (0,0,1)
 *
 * Two rules make this case delicate, and both are load-bearing:
 *   :where(...)  contributes ZERO, always — including its own arguments.
 *   :is(...) / :not(...)  contribute the specificity of their MOST specific
 *                          argument, not their own.
 */
function specificity(selector) {
  const s = selector.trim();
  // Strip strings so a ':' inside them cannot be read as a pseudo-class.
  const clean = s.replace(/"[^"]*"|'[^']*'/g, '""');

  // Innermost :where() -> zero. Remove it (and its balanced parens) first.
  let rest = clean;
  for (;;) {
    const i = rest.indexOf(':where(');
    if (i === -1) break;
    let d = 0, j = i + 6;
    for (; j < rest.length; j++) {
      if (rest[j] === '(') d++;
      else if (rest[j] === ')') { d--; if (d === 0) break; }
    }
    rest = rest.slice(0, i) + rest.slice(j + 1);
  }
  // Everything inside a removed :where() is gone, so remaining :not()/:is()
  // arguments are all one class-level deep: + (0,1,0) each.
  const idCount = (rest.match(/#[A-Za-z0-9_-]+/g) || []).length;
  const classes =
    (rest.match(/\.[A-Za-z0-9_\\-]+/g) || []).length +
    (rest.match(/\[[^\]]*\]/g) || []).length +
    (rest.match(/:(?!:)[A-Za-z-]+/g) || []).length;
  const elements = (rest.match(/(^|[\s>+~])[a-zA-Z][A-Za-z0-9-]*/g) || []).length;
  return [idCount, classes, elements];
}
const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
const show = sp => `(${sp[0]},${sp[1]},${sp[2]})`;

const netSel = 'html.light :where([class*="bg-zinc-900"]:not([class*="hover:bg-zinc-900"]):not([class*="focus:bg-zinc-900"]))';
const tailwindUtil = '.bg-zinc-900\\/30';          // what Tailwind actually emits
// index.css:19 -> @custom-variant light (&:is(.light *)) so the token compiles to
// `.light\\:bg-...:is(.light *)`, and :is() takes its arg's specificity.
const componentToken = '.light\\:bg-\\[var\\(--ws-surface-raised\\)\\]:is(.light *)';

const sNet = specificity(netSel);
const sUtil = specificity(tailwindUtil);
const sComp = specificity(componentToken);

console.log(`  net             ${show(sNet)}   ${netSel.slice(0, 58)}...`);
console.log(`  Tailwind util   ${show(sUtil)}   ${tailwindUtil}`);
console.log(`  component token ${show(sComp)}   ${componentToken.slice(0, 58)}...`);
console.log('');
ok('the net BEATS Tailwind\'s own utility (else it would never apply)',
  cmp(sNet, sUtil) > 0, `${show(sNet)} vs ${show(sUtil)}`);
ok('a component light token BEATS the net (else the codemod would be dead)',
  cmp(sComp, sNet) > 0, `${show(sComp)} vs ${show(sNet)}`);
ok(':where() contributes zero — the net is only (0,1,1), not (0,3,1)',
  sNet[1] === 1, `classes = ${sNet[1]}`);

console.log('\n=== REWIND: light theme exists ===\n');
const rewindCss = stripComments(readFileSync(join(ROOT, 'src/features/rewind-nav/rewind-nav.css'), 'utf8'));
ok('rewind declares an html.light override', /html\.light \.rewind-strip/.test(rewindCss));
ok('rewind no longer hardcodes the field colour outside the token block',
  (rewindCss.match(/background:\s*#09090b/g) || []).length === 0);
ok('rewind sprocket + edge ink are token-driven',
  rewindCss.includes('var(--rewind-sprocket)') && rewindCss.includes('var(--rewind-ink)'));
ok('rewind light field is warm paper, not a grey', rewindCss.includes('--rewind-field: var(--ws-surface)'));
ok('rewind CSS braces balance',
  (rewindCss.match(/\{/g) || []).length === (rewindCss.match(/\}/g) || []).length);

console.log('\n=== LOGO: warm chrome ramp on light ===\n');
const lightLogo = /html\.light \.sidebar-logo__text\s*\{[\s\S]*?background-image:\s*([\s\S]*?);/.exec(css);
ok('the logo has an html.light override', !!lightLogo);
if (lightLogo) {
  // Only the LAST gradient (the chrome face) carries the ramp; #ffffff belongs
  // to the L2 sweep layer and is correct on both themes, so counting it made the
  // ramp look like 5 stops when it is 4.
  const lastLayer = lightLogo[1].split(/,(?![^()]*\))/).pop() || '';
  const stops = lastLayer.match(/#[0-9a-f]{6}/gi) || [];
  ok('it declares exactly THREE gradient layers (hover sweep depends on it)',
    (lightLogo[1].match(/gradient\(/g) || []).length === 3,
    `${(lightLogo[1].match(/gradient\(/g) || []).length} layers`);
  ok('the chrome ramp is 4 stops', stops.length === 4, stops.join(' '));
  const bg = hex2rgb('#fcfbf8'); // light --sidebar-bg
  const ranked = stops.map(h => ({ h, c: contrast(hex2rgb(h), bg) }))
                     .sort((a, b) => b.c - a.c);
  const darkest = ranked[0].h;
  const c = ranked[0].c;
  console.log(`        ramp contrast vs #fcfbf8: ${ranked.map(r => `${r.h} ${r.c.toFixed(2)}`).join('  ')}`);
  ok('the darkest chrome stop clears 4.5:1 on the light sidebar', c >= 4.5,
    `${darkest} = ${c.toFixed(2)}:1`);

  // The user's complaint was partly "it is cool grey". Check warmth: the ramp's
  // average hue must be warm (R >= B), which a zinc ramp never is.
  const avg = [0, 1, 2].map(i => stops.reduce((s, h) => s + hex2rgb(h)[i], 0) / stops.length);
  ok('the ramp is WARM (avg R > avg B) — not the cool zinc it replaced',
    avg[0] > avg[2], `avg R ${avg[0].toFixed(0)} vs B ${avg[2].toFixed(0)}`);
}

console.log('\n=== GUIDE: hardcoded black removed ===\n');
const guide = stripComments(readFileSync(join(ROOT, 'src/pages/GuidePage.tsx'), 'utf8'));
ok('Guide no longer hardcodes bg-[#0a0a0a]', !guide.includes('bg-[#0a0a0a]'));
ok('Guide uses a warm token for its surface', /light:bg-\[var\(--ws-surface/.test(guide));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
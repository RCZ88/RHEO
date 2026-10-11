import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
// `.mjs` in a `type: module` repo: neither `__dirname` nor `require` exist.
const HERE = dirname(fileURLToPath(import.meta.url));
// APP-WIDE CONTRAST AUDIT.
//
//   node agent/probes/contrast-audit.mjs            # full report
//   node agent/probes/contrast-audit.mjs --fix     # only count, list by severity
//
// THE BUG CLASS
// -------------
// `src/index.css` flips dark-theme TEXT to dark ink for light mode, but only via
// BARE class names:
//
//     html.light :where(.text-white)          { color: var(--text-primary); }
//     html.light :where(.text-zinc-50, ...)   { color: ...; }
//
// A Tailwind ALPHA variant is a different class name. `text-white/80` has the
// single token `text-white/80`, which `.text-white` cannot match. So on Warm
// Paper every `text-white/80`, `text-zinc-300/70`, `text-amber-200/90` keeps its
// dark-theme light value — pale text on a pale button. That is the report:
// "buttons still have their text on the dark mode".
//
// This audit is STATIC: it resolves Tailwind classes to real colours, composites
// alpha over the resolved background, and prints measured contrast. It cannot see
// runtime `light:` variants applied by JS, so anything already carrying an
// explicit `light:text-` is excluded rather than double-reported.

const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

// ── Tailwind v4 default ramps (the subset this repo uses) ────────────────────
const ZINC = { 50:'#fafafa',100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',
               500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b',950:'#09090b' };
const SLATE= { 100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',
               600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617' };
const STONE= { 100:'#f5f5f4',200:'#e7e5e4',300:'#d6d3d1',400:'#a8a29e',500:'#78716c',
               600:'#57534e',700:'#44403c',800:'#292524',900:'#1c1917' };
const AMBER= { 100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',
               600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f' };
const EMERALD={100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',
               600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b' };
const SKY   = {100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',
               600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e' };
const ROSE  = {100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',
               600:'#e11d48',700:'#be123c',800:'#9f1239',900:'#881337' };
const VIOLET= {100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',
               600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95' };
const PINK  = {100:'#fce7f3',200:'#fbcfe8',300:'#f9a8d4',400:'#f472b6',500:'#ec4899',
               600:'#db2777',700:'#be185d',800:'#9d174d',900:'#831843' };
const RED   = {300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',
               800:'#991b1b',900:'#7f1d1d' };
const BLUE  = {300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',
               800:'#1e40af',900:'#1e3a8a' };
const CYAN  = {300:'#67e8f9',400:'#22d3ee',500:'#06b6d4',600:'#0891b2',700:'#0e7490',
               800:'#155e75',900:'#164e63' };
const GREEN = {300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',
               800:'#166534',900:'#14532d' };
const ORANGE= {300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',
               800:'#9a3412',900:'#7c2d12' };
const INDIGO= {300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',
               800:'#3730a3',900:'#312e81' };
const LIME  = {300:'#bef264',400:'#a3e635',500:'#84cc16',600:'#65a30d',700:'#4d7c0f',
               800:'#3f6212',900:'#365314' };
const TEAL  = {300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',
               800:'#115e59',900:'#134e4a' };
const FUCHSIA={300:'#f0abfc',400:'#e879f9',500:'#d946ef',600:'#c026d3',700:'#a21caf',
               800:'#86198f',900:'#701a75' };
const PURPLE= {300:'#d8b4fe',400:'#c084fc',500:'#a855f7',600:'#9333ea',700:'#7e22ce',
               800:'#6b21a8',900:'#581c87' };

const RAMPS = { zinc:ZINC, slate:SLATE, stone:STONE, amber:AMBER, emerald:EMERALD,
  sky:SKY, rose:ROSE, violet:VIOLET, pink:PINK, red:RED, blue:BLUE, cyan:CYAN,
  green:GREEN, orange:ORANGE, indigo:INDIGO, lime:LIME, teal:TEAL, fuchsia:FUCHSIA,
  purple:PURPLE, gray:ZINC, neutral:ZINC };

// ── The app's own semantic tokens, per theme (index.css) ─────────────────────
const LIGHT_BG = '#f5f2ec';           // --ws-surface  S0 paper
const DARK_BG  = '#09090b';           // --ws-surface  dark

// ── colour maths ────────────────────────────────────────────────────────────
const hex2rgb = h => { const s = h.replace('#',''); return [0,2,4].map(i => parseInt(s.slice(i,i+2),16)); };
const rgb2hex = c => '#' + c.map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const over = (fg, bg, a) => fg.map((c,i) => c*a + bg[i]*(1-a));
const lum = ([r,g,b]) => { const f = v => { const s=v/255; return s<=0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4; };
  return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
const contrast = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };

/** Resolve `text-<ramp>-<n>[/<a>]` or `text-white[/<a>]` to {hex, alpha} or null. */
function resolveText(cls) {
  const m = /^text-(white|black|([a-z]+)-(\d{2,3}))(?:\/(\d{1,3}))?$/.exec(cls);
  if (!m) return null;
  const alpha = m[4] !== undefined ? Number(m[4]) / 100 : 1;
  if (m[1] === 'white') return { hex: '#ffffff', alpha, name: cls };
  if (m[1] === 'black') return { hex: '#000000', alpha, name: cls };
  const ramp = RAMPS[m[2]];
  if (!ramp || !ramp[m[3]]) return null;
  return { hex: ramp[m[3]], alpha, name: cls };
}
function resolveBg(cls) {
  const m = /^bg-(white|black|([a-z]+)-(\d{2,3}))(?:\/(\d{1,3}))?$/.exec(cls);
  if (!m) return null;
  const alpha = m[4] !== undefined ? Number(m[4]) / 100 : 1;
  if (m[1] === 'white') return { hex: '#ffffff', alpha, name: cls };
  if (m[1] === 'black') return { hex: '#000000', alpha, name: cls };
  const ramp = RAMPS[m[2]];
  if (!ramp || !ramp[m[3]]) return null;
  return { hex: ramp[m[3]], alpha, name: cls };
}

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name.endsWith('.bak')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.tsx$/.test(e.name)) yield p;
  }
}

const ROOT = join(HERE, '..', '..');

/* ── ALREADY-HANDLED CLASSES ───────────────────────────────────────────────────
 * index.css ships blanket light-mode remaps for BARE class names
 * (`.text-white`, `.text-zinc-100`, `.bg-zinc-900`, …). Those are NOT bugs, and
 * counting them produced 3,248 findings that were mostly noise — the single most
 * expensive kind of probe error, because a number that big stops being actionable.
 *
 * The genuine gap is the ALPHA variants: `text-white/80`, `text-zinc-300/70`,
 * `text-amber-200/90`. A variant is a different class name, so the blanket cannot
 * match it. This parses the blankets out of index.css and subtracts them, which
 * is the difference between an actionable number and noise.
 */
const BLANKET = (() => {
  const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
  const handled = new Set();
  for (const m of css.matchAll(/html\.light\s*:where\(([^)]*)\)\s*\{/g)) {
    for (const c of m[1].matchAll(/\.((?:[a-z]+:)?[A-Za-z0-9_/-]+)/g)) handled.add(c[1]);
  }
  return handled;
})();
// The semantic-text net (added this cycle) routes hue-300/400 text utilities to
// the theme-aware --warning/--success/--error/--info tokens. Those are handled too.
const SEMANTIC_NET = new Set([
  'text-amber-400','text-amber-300','text-amber-200',
  'text-emerald-400','text-emerald-300','text-green-400','text-green-300',
  'text-red-400','text-red-300','text-rose-400','text-rose-300',
  'text-cyan-400','text-cyan-300','text-sky-400','text-sky-300',
  'text-blue-400','text-blue-300',
]);

/* The alpha-variant net added this cycle: <prop>-<light-neutral>/<n> routes to a
 * theme token at the SAME opacity. Without teaching the audit this, it kept
 * reporting 329 sites the net already fixes — a stale number is as useless as an
 * inflated one. */
const LIGHT_TRIPLES = ['black','white','zinc-50','zinc-100','zinc-200','zinc-300',
                       'stone-100','stone-200','stone-300','gray-100','gray-200','gray-300'];
/* The 100/200/300 + 500-alpha tail nets, same subtraction as above. */
const TAIL_BARE = ['text-gray-300','text-stone-200','text-stone-300','text-amber-100',
  'text-rose-200','text-pink-300','text-violet-300','text-purple-300',
  'text-stone-100','text-orange-300','text-sky-200'];
const TAIL_ALPHA = ['text-amber-500','text-emerald-500','text-green-500','text-violet-300',
  'text-violet-400','text-pink-300','text-rose-200','text-amber-100','text-gray-300',
  'text-stone-200','text-stone-300','text-purple-300','text-violet-200','text-violet-500',
  'text-pink-500','text-indigo-400','text-indigo-300','text-orange-300'];
const ACCENT_WIDE = ['violet','purple','indigo','fuchsia','pink','teal','lime'];
const coveredByTailNet = (cls) => {
  if (TAIL_BARE.includes(cls)) return true;
  const m = /^text-(.+)\/\d{1,3}$/.exec(cls);
  return !!m && TAIL_ALPHA.includes(m[0].split('/')[0]);
};

const coveredByAlphaNet = (cls) => {
  const m = /^(?:bg|text|border)-(.+)\/\d{1,3}$/.exec(cls);
  return !!m && LIGHT_TRIPLES.includes(m[1]);
};

const isHandled = (cls) => {
  if (coveredByAlphaNet(cls)) return true;
  if (coveredByTailNet(cls)) return true;
  if (SEMANTIC_NET.has(cls)) return true;
  // The net's alpha-variant arm: any slash variant of the above.
  const base = cls.split('/')[0];
  if (SEMANTIC_NET.has(base)) return true;
  const bare = cls.replace(/^!/, '');
  if (BLANKET.has(bare)) return true;
  for (const h of BLANKET) if (h.endsWith(':' + bare)) return true;
  return false;
};
const findings = [];
let scanned = 0, attrs = 0;

for (const file of walk(join(ROOT, 'src'))) {
  scanned++;
  const src = readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (const attr of src.match(/className="([^"]*)"/g) || []) {
    attrs++;
    const cls = attr.slice(10, -1).split(/\s+/).filter(Boolean);
    // Already handled? An explicit light: text token means someone fixed it.
    const hasLightText = cls.some(c => /^light:(?:!?text-|text-)/.test(c));
    const hasDarkPrefix = cls.some(c => /^(dark|md|lg|xl|sm|group-hover|hover|focus):/.test(c));
    if (hasLightText) continue;

    const t = cls.map(resolveText).find(Boolean);
    if (!t) continue;
    if (isHandled(t.name)) continue;   // index.css already remaps it
    const b = cls.map(resolveBg).find(Boolean);
    if (!t) continue;

    // No bg on the element: it inherits the page field. That is the worst case,
    // because a light text on the paper field is the report verbatim.
    const base = hex2rgb(LIGHT_BG);
    const bg = b ? over(hex2rgb(b.hex), base, b.alpha) : base;
    const fg = over(hex2rgb(t.hex), bg, t.alpha);

    // Buttons are the priority: an interactive control whose label is unreadable.
    const isButton = /\b(button|btn)\b/i.test(cls.join(' '));
    const isExplicit = cls.some(c => /(^|[^:])(bg-)/.test(c));
    const ratio = contrast(fg, bg);

    // Only flag what is genuinely broken: light-theme text on a light field.
    // Dark text on a dark field is the same bug mirrored, so check both.
    const textIsLight = lum(fg) > 0.5;
    const bgIsLight = lum(bg) > 0.35;
    const broken = textIsLight && bgIsLight && ratio < 4.5;
    const mirrored = !textIsLight && !bgIsLight && ratio < 4.5;

    if (broken || mirrored) {
      findings.push({
        file: file.replace(ROOT + '/', ''),
        mode: broken ? 'light-on-light' : 'dark-on-dark',
        text: t.name, bg: b ? b.name : '(page field)',
        ratio: Number(ratio.toFixed(2)),
        needs: 4.5,
        button: isButton,
        cls: cls.join(' ').slice(0, 96),
      });
    }
  }
}

const light = findings.filter(f => f.mode === 'light-on-light');
const dark = findings.filter(f => f.mode === 'dark-on-dark');
const byFile = {};
for (const f of findings) byFile[f.file] = (byFile[f.file] || 0) + 1;
const worst = findings.slice().sort((a, b) => a.ratio - b.ratio);

console.log(`\nscanned ${scanned} .tsx files, ${attrs} className attributes\n`);
console.log(`LOW-CONTRAST TEXT: ${findings.length}   (light-on-light ${light.length}, dark-on-dark ${dark.length})\n`);
console.log('=== WORST 40 ===\n');
console.log('ratio  mode            text class        background');
for (const f of worst.slice(0, 40)) {
  console.log(`${String(f.ratio).padStart(5)}  ${f.mode.padEnd(15)} ${f.text.padEnd(18)} ${f.bg}`);
}
console.log('\n=== BY FILE (top 30) ===\n');
for (const [file, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`  ${String(n).padStart(4)}  ${file}`);
}
const btns = findings.filter((f) => f.button);
console.log('\n=== BUTTONS / INTERACTIVE: ' + btns.length + ' of ' + findings.length + ' ===\n');
for (const f of btns.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 20)) {
  console.log(String(f.ratio).padStart(5) + '  ' + f.text.padEnd(18) + ' on ' + String(f.bg).padEnd(18) + ' ' + f.file);
}
console.log('\n=== BY CLASS (top 25) — the highest-leverage fix ===\n');
const byCls = {};
for (const f of findings) { const k = `${f.text} on ${f.bg}`; byCls[k] = (byCls[k] || 0) + 1; }
for (const [k, n] of Object.entries(byCls).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}
process.exit(findings.length ? 1 : 0);

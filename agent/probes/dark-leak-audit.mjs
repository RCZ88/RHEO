// DARK-LEAKAGE AUDIT — finds every way an element can stay dark in light mode.
//
//   node agent/probes/dark-leak-audit.mjs
//
// WHY THIS EXISTS
// ---------------
// The light-mode contract lives in src/index.css as blanket rules. There are five
// distinct ways a value escapes them, and only the first was ever handled:
//
//   1. BARE class            `.text-zinc-100`     -> index.css remaps it. SAFE
//   2. ALPHA VARIANT         `text-zinc-100/80`   -> a DIFFERENT class name.
//                                                    the blanket cannot match. LEAK
//   3. HUE utility           `text-amber-400`    -> hues need no remap on dark,
//                                                    so no blanket was ever written
//                                                    for them. LEAK
//   4. RAW HEX / arbitrary   `bg-[#0a0a0a]`      -> invisible to every utility
//                                                    rule. LEAK
//   5. INLINE STYLE          `style={{background:` -> a style attribute beats any
//                                                    class rule. LEAK
//
// Plus a sixth that is not a class at all: a runtime-injected stylesheet, which is
// how the Dashboard's own theme shipped #060608 with no light branch.
//
// Categories 2 and 3 are fixable with one net each, and each net covers hundreds of
// call sites. Categories 4 and 5 must be fixed at the call site, so they are
// reported individually — that is the point of this file.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

/* Anything at or below this luminance is "dark" for this audit. */
const DARK_MAX_L = 0.18;
const hex2rgb = h => { const s = h.replace('#',''); return [0,2,4].map(i => parseInt(s.slice(i,i+2),16)); };
const lum = ([r,g,b]) => { const f=v=>{const s=v/255; return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;};
  return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const isDark = hex => { try { return lum(hex2rgb(hex)) <= DARK_MAX_L; } catch { return false; } };

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name.endsWith('.bak')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) yield p;
  }
}

const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
const HANDLED = new Set();
for (const m of css.matchAll(/html\.light\s*:where\(([^)]*)\)\s*\{/g)) {
  for (const c of m[1].matchAll(/\.((?:[a-z]+:)?[A-Za-z0-9_/-]+)/g)) HANDLED.add(c[1]);
}
const netCovered = (cls) => {
  const bare = cls.replace(/^!/, '');
  if (HANDLED.has(bare)) return true;
  for (const h of HANDLED) if (h.endsWith(':' + bare)) return true;
  return false;
};

/* The four nets added this cycle, declared as patterns the audit subtracts.
 * Without this the audit reported 867 forever, because it could not see CSS it
 * had not been taught about — which is the same "audit cries wolf" failure as the
 * 3,248 figure, just in the other direction. A number that never moves is as
 * useless as one that is always huge. */
const LIGHT_TRIPLES = ['black','white','zinc-50','zinc-100','zinc-200','zinc-300',
                       'stone-100','stone-200','stone-300','gray-100','gray-200','gray-300'];
const SEMANTIC_HUES = { amber:['400','300','200'], emerald:['400','300'], green:['400','300'],
  red:['400','300'], rose:['400','300'], cyan:['400','300'], sky:['400','300'], blue:['400','300'] };
const ACCENT_HUES  = ['violet','purple','indigo','fuchsia','pink','teal','lime'];

const coveredByNewNets = (cls) => {
  // alpha-variant net: <prop>-<light-neutral>/<n>
  let m = /^(bg|text|border)-(.+)\/(\d{1,3})$/.exec(cls);
  if (m && LIGHT_TRIPLES.includes(m[2])) return true;
  // semantic-text net
  m = /^text-([a-z]+)-(\d{2,3})$/.exec(cls);
  if (m && SEMANTIC_HUES[m[1]]?.includes(m[2])) return true;
  // accent-family net
  if (m && ACCENT_HUES.includes(m[1]) && ['200','300','400'].includes(m[2])) return true;
  return false;
};

const SEMANTIC_NET = new Set([
  'text-amber-400','text-amber-300','text-amber-200','text-emerald-400','text-emerald-300',
  'text-green-400','text-green-300','text-red-400','text-red-300','text-rose-400','text-rose-300',
  'text-cyan-400','text-cyan-300','text-sky-400','text-sky-300','text-blue-400','text-blue-300',
]);

const cats = { alphaVariant: [], hue: [], rawHex: [], inlineStyle: [], injectedCss: [] };

for (const file of walk(join(ROOT, 'src'))) {
  const rel = file.replace(ROOT + '/', '');
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const lines = src.split('\n');
  const at = (i) => rel + ':' + (i + 1);

  for (const m of src.matchAll(/className="([^"]*)"/g)) {
    const attr = m[1];
    const line = src.slice(0, m.index).split('\n').length - 1;
    // Any explicit light: token on the same element means a human fixed it.
    if (/[\s"]light:/.test(attr)) continue;
    for (const c of attr.split(/\s+/)) {
      if (netCovered(c) || coveredByNewNets(c)) continue;
      // 2. alpha variant of a light neutral / white
      if (/^(?:bg|text|border)-(?:white|zinc-(?:50|100|200|300)|stone-(?:100|200|300)|gray-(?:100|200|300))\/(\d{1,3})$/.test(c)) {
        cats.alphaVariant.push([at(line), c, 'alpha variant — bare blanket cannot match']);
      }
      // 3. hue utility not in the semantic net
      else if (/^text-(?:violet|purple|indigo|fuchsia|pink|teal|lime|sky)-(?:200|300|400)$/.test(c)) {
        cats.hue.push([at(line), c, 'hue with no light remap']);
      }
    }
  }

  // 4. raw dark hex used as a surface
  for (const m of src.matchAll(/(?:bg-\[|background(?:Color)?\s*[:=]\s*['"`]?)(#[0-9a-fA-F]{6})/g)) {
    if (isDark(m[2])) cats.rawHex.push([at(src.slice(0, m.index).split('\n').length - 1), m[2], 'hardcoded dark surface']);
  }

  // 5. inline style carrying a dark surface
  for (const m of src.matchAll(/style=\{\{[^}]*?(?:background|backgroundColor)\s*:\s*['"`](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"`][^}]*\}\}/g)) {
    const v = m[1];
    const hex = /^#/.test(v) ? v.slice(0, 7) : null;
    if (hex && isDark(hex)) cats.inlineStyle.push([at(src.slice(0, m.index).split('\n').length - 1), v.slice(0, 24), 'inline dark background']);
  }
}

// 6. runtime-injected stylesheets: any <style> textContent built in TS
for (const file of walk(join(ROOT, 'src'))) {
  const rel = file.replace(ROOT + '/', '');
  const src = readFileSync(file, 'utf8');
  if (!/createElement\(['"]style['"]\)/.test(src)) continue;
  const dark = (src.match(/#[0-9a-fA-F]{6}/g) || []).filter(isDark);
  const hasLight = /html\.light|:where\(\.light|\.light\s/.test(src);
  if (dark.length && !hasLight) {
    cats.injectedCss.push([rel, dark.length + ' dark values', 'injected stylesheet with NO light branch']);
  }
}

let total = 0;
for (const [name, rows] of Object.entries(cats)) {
  console.log(`\n=== ${name.toUpperCase()} — ${rows.length} ===`);
  if (!rows.length) { console.log('  (none)'); continue; }
  const byFile = {};
  for (const [loc, val, why] of rows) {
    const f = loc.includes(':') ? loc.split(':').slice(0, -1).join(':') : loc;
    (byFile[f] ||= []).push(`${loc.includes(':') ? loc.split(':').pop() : ''} ${val}`);
  }
  const top = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length).slice(0, 18);
  for (const [f, items] of top) {
    console.log(`  ${String(items.length).padStart(4)}  ${f}`);
    for (const i of items.slice(0, 4)) console.log(`          ${i}`);
  }
  total += rows.length;
}
console.log(`\nTOTAL DARK-LEAK SITES: ${total}\n`);

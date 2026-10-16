// STATIC light-mode contrast audit.
//
// WHY THIS EXISTS: the runtime probe cannot run — App throws on boot
// (`now2.getHours is not a function`), so nothing renders and there is nothing
// to measure. This resolves each className string through the SAME nets and
// tokens the browser would apply, and reports pairs that collide.
//
// The nets below are transcribed from src/index.css, not guessed:
//   - text nets  ~line 1450 (text-zinc-300/400/500, text-zinc-800/900/950)
//   - bg nets     ~line 1315 (bg-zinc-600..950, bg-white, bg-black)
// The zinc ramp itself is NOT remapped in light mode — index.css:365 says so
// deliberately — which is exactly why the nets have to carry the whole load.
import { readFileSync } from 'fs';

const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = h => { const m = h.match(/[0-9a-f]{2}/gi).map(x => parseInt(x, 16)); return 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]); };
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const zinc = { 100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b',950:'#09090b' };

const LIGHT = {
  '--ws-surface':'#f5f2ec', '--ws-surface-raised':'#fcfbf8', '--ws-surface-sunken':'#edeae2',
  '--ws-surface-overlay':'#ffffff', '--ws-surface-hover':'#efeadd',
  '--text-primary':'#1c1917', '--text-secondary':'#44403c', '--text-muted':'#57534e', '--text-faint':'#6f665e',
};

// ordered: first match wins (mirrors source order, later nets win in CSS)
const TEXT_NETS = [
  [/text-zinc-800|text-zinc-900|text-zinc-950/,        '#1c1917'],
  [/text-zinc-300|text-white\/30|text-white\/25|text-white\/20/, '#44403c'],
  [/text-zinc-400|text-zinc-500/,                     '#57534e'],
  [/text-zinc-100|text-zinc-200/,                     '#1c1917'],
];
const BG_NETS = [
  [/bg-zinc-950/, '#f5f2ec'], [/bg-zinc-900/, '#fcfbf8'],
  [/bg-zinc-800/, '#edeae2'], [/bg-zinc-700/, '#edeae2'], [/bg-zinc-600/, '#edeae2'],
  [/bg-white/,    '#ffffff'], [/bg-black/,   '#f5f2ec'],
];

// A Tailwind *colour* fill (bg-indigo-600, bg-emerald-600, …) is saturated and
// dark in BOTH themes — `light:` variants never lighten it. White on it is
// correct, so these must not be judged against paper.
const colourFill = /\bbg-(?:indigo|violet|purple|emerald|green|teal|cyan|sky|blue|rose|red|orange|amber|yellow|lime|fuchsia|pink)-(?:[4-9]00|50[0-9])\b/;

const bare = s => s.replace(/(hover|focus|focus-visible|active|group-hover|disabled):/g, '');

function resolveText(cls) {
  const c = bare(cls);
  for (const [re, hex] of TEXT_NETS) if (re.test(c)) return { hex, via: 'net' };
  let m = c.match(/text-\[var\((--[a-z-]+)\)\]/);
  if (m && LIGHT[m[1]]) return { hex: LIGHT[m[1]], via: 'token' };
  m = c.match(/\btext-zinc-(\d{3})\b/);
  if (m && zinc[m[1]]) return { hex: zinc[m[1]], via: 'RAW-zinc' };
  if (/\btext-white\b/.test(c)) return { hex: '#ffffff', via: 'literal' };
  return null;
}
const COLOURISH = /text-\[(var\(--|#|rgb|color|okl)/;   // `text-[15px]` is a SIZE, not a colour
function resolveBg(cls) {
  const c = bare(cls);
  for (const [re, hex] of BG_NETS) if (re.test(c)) return { hex, via: 'net' };
  let m = c.match(/bg-\[var\((--[a-z-]+)\)\]/);
  if (m && LIGHT[m[1]]) return { hex: LIGHT[m[1]], via: 'token' };
  m = c.match(/\bbg-zinc-(\d{3})\b/);
  if (m && zinc[m[1]]) return { hex: zinc[m[1]], via: 'RAW-zinc' };
  // No background utility: the element inherits. Most of these sit on the page
  // field, so paper is the correct assumption and the most conservative one.
  return { hex: LIGHT['--ws-surface'], via: 'inherited' };
}

const files = process.argv.slice(2);
let fails = 0, checked = 0;
for (const f of files) {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { continue; }
  // capture className="..." and className={`...`} and bare cn('...', '...')
  const re = /className=(?:"([^"]*)"|\{`([^`]*)`\})|\bcn\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g;
  for (const m of src.matchAll(re)) {
    const cls = m[1] || m[2] || m[3] || m[4] || m[5] || '';
    if (!cls || /\b(light|dark):/.test(cls)) continue;
    const t = resolveText(cls);
    if (!t) continue;
    // white label on a saturated colour fill is correct in both themes
    if (t.via === 'literal' && colourFill.test(bare(cls))) continue;
    const b = resolveBg(cls);
    checked++;
    const r = ratio(t.hex, b.hex);
    if (r < 4.5) {
      fails++;
      const line = src.slice(0, m.index).split('\n').length;
      const tc = (cls.match(COLOURISH ? /text-\[(?:var\(--[a-z-]+\)|#[0-9a-f]+|rgb[^]]*)[^\]]*\]|text-zinc-\d{3}|text-white/ : /^$/)[0]);
      const bc = (cls.match(/bg-[a-z0-9[\]#_./-]+/) || [''])[0];
      console.log(`  ${(f.split('/').pop()).padEnd(26)}:${String(line).padEnd(5)} ${r.toFixed(2).padStart(6)}:1  ${tc.padEnd(24)}(${t.via.padEnd(9)}) on ${bc.padEnd(24)}(${b.via})`);
    }
  }
}
console.log(`\n  pairs checked: ${checked}   FAILING (<4.5:1): ${fails}`);
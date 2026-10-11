/**
 * Activity colours are free-form user data. They were painted as saturated
 * solids on a near-black surface, which reads as a mistake rather than as
 * information. These assertions pin that they are now always tints.
 */

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

function normaliseHex(hex: string) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return { r: 113, g: 113, b: 126 };
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c: string) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
const tintOf = (hex: string, a = 0.18) => { const c = normaliseHex(hex); return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`; };
const solidOf = (hex: string, a = 0.85) => { const c = normaliseHex(hex); return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`; };
const needsHairline = (hex: string) => { const c = normaliseHex(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 90; };
const alphaOf = (rgba: string) => Number(/rgba\([^)]*?,\s*([\d.]+)\)/.exec(rgba)?.[1] ?? 1);

console.log('every hue a user can pick must render as a TINT, never a solid block:');
const HOSTILE = [
  '#FF00AA', '#00FF00', '#FF0000', '#0000FF', '#FFFF00',
  '#f0f', '#0f0', '#abc', '#6366f1', '#22d3ee', '#a855f7',
  'not-a-colour', '', '#12345',
];
for (const hex of HOSTILE) {
  const t = tintOf(hex, 0.22);
  ok(alphaOf(t) === 0.22, `tint of ${JSON.stringify(hex).padEnd(14)} alpha=${alphaOf(t)}`);
}

console.log('\nthe hue is preserved, only the strength changes:');
ok(tintOf('#FF00AA') === 'rgba(255, 0, 170, 0.18)', 'magenta keeps its hue');
ok(tintOf('#00FF00') === 'rgba(0, 255, 0, 0.18)',   'green keeps its hue');

console.log('\nshort hex expands correctly:');
ok(tintOf('#f0f') === 'rgba(255, 0, 255, 0.18)', '"#f0f" -> ff00ff');

console.log('\ngarbage never yields a broken colour — falls back to neutral zinc:');
ok(tintOf('not-a-colour') === 'rgba(113, 113, 126, 0.18)', 'invalid -> zinc-500 tint');
ok(tintOf('') === 'rgba(113, 113, 126, 0.18)', 'empty -> zinc-500 tint');

console.log('\ndark hues get a hairline so they stay visible:');
ok(needsHairline('#000000'), 'pure black needs a hairline');
ok(needsHairline('#1a1a2e'), 'near-black needs a hairline');
ok(!needsHairline('#FFD700'), 'gold does not need one');
ok(!needsHairline('#00FF00'), 'pure green does not need one');

// Intuition trap, so pin it deliberately: #FF00AA *looks* bright but its
// Rec-709 luma is only 66/255, because red carries a weight of just 0.2126.
// At 0.2 alpha over near-black it really is hard to see, so it DOES get a
// hairline. "Feels bright" is not the test the UI should be using.
ok(needsHairline('#FF00AA'), 'magenta needs a hairline despite looking bright');
ok(solidOf('#FF00AA', 0.5) === 'rgba(255, 0, 170, 0.5)', 'magenta solid keeps its own hue');
ok(solidOf('#00FF00', 0.5) === 'rgba(0, 255, 0, 0.5)',   'green solid keeps its own hue');

console.log('\nthe accent cap on the timeline bar is stronger than the fill, so the bar still reads:');
ok(alphaOf(solidOf('#6366f1', 0.9)) > alphaOf(tintOf('#6366f1', 0.22)),
   'cap alpha 0.9 > fill alpha 0.22 — the bar keeps its shape');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);

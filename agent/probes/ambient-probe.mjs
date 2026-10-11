// Prints NUMBERS, not claims. Run: node agent/probes/ambient-probe.mjs
//
// Two things this measures that reading the CSS cannot:
//
//   1. Is the ambient wash actually visible? A gradient at "8% alpha" sounds
//      faint and is inaudible — the only question is how large the composited
//      change on the real surface token actually is, in both themes.
//   2. Is the Settings switch legible in its ON state? The track used to be
//      filled with `--page-accent`, which on [data-page="settings"] resolves to
//      `var(--text-primary)`. This prints the resolved pair and the WCAG
//      contrast of the knob against the track, per theme.
//
// Every constant it reads is duplicated from src/index.css + src/lib/ambient.ts
// on purpose: this runs without a DOM, and a probe that imported the app would
// need a build.

const T = {
  // index.css:22-30 — dark scope
  darkSurface: '#09090b',
  darkAccent: '#06b6d4',
  darkTextPrimary: '#fafafa',
  // index.css:112-146 — html.light scope
  lightSurface: '#f5f2ec',
  lightAccent: '#0e7490',
  lightTextPrimary: '#1c1917',
};

// src/lib/ambient.ts PEAK_ALPHA
const PEAK_ALPHA = { dark: 0.19, light: 0.13 };
const OLD_PEAK = 0.08; // the single ceiling this replaced

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Source-over composite: `fg` at `alpha` over opaque `bg`. */
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

const relLum = ([r, g, b]) => {
  const f = v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** WCAG 2.x contrast ratio between two opaque colours. */
const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const row = (...cells) => cells.map(c => String(c).padEnd(22)).join('');

console.log('\n=== AMBIENT WASH — is it visible? ===\n');
console.log(row('theme', 'peak', 'composited', 'dRGB', 'ratio(old->new)'));
console.log('-'.repeat(78));

for (const theme of ['dark', 'light']) {
  const base = hex2rgb(theme === 'dark' ? T.darkSurface : T.lightSurface);
  const accent = hex2rgb(theme === 'dark' ? T.darkAccent : T.lightAccent);

  for (const [label, peak] of [
    ['old 0.08', OLD_PEAK],
    ['NEW', PEAK_ALPHA[theme]],
  ]) {
    const out = over(accent, base, peak);
    const dRGB = Math.max(...out.map((v, i) => Math.abs(v - base[i])));
    const ratio = contrast(out, base);
    console.log(
      row(theme, label, rgb2hex(out), `d${dRGB.toFixed(1)}`, ratio.toFixed(3)),
    );
  }
}

console.log(
  '\nRead: a dRGB under ~6 is not perceivable at a glance behind text.',
);
console.log(
  '     The NEW rows must beat the old rows by a wide margin in BOTH themes.',
);

console.log('\n\n=== SETTINGS SWITCH — ON state, knob vs track ===\n');
console.log('index.css:743  [data-page="settings"] { --page-accent: var(--text-primary) }\n');
console.log(row('theme', 'track (WAS)', 'knob', 'contrast', 'WCAG UI 3:1'));
console.log('-'.repeat(78));

for (const theme of ['dark', 'light']) {
  const track = hex2rgb(theme === 'dark' ? T.darkTextPrimary : T.lightTextPrimary);
  const knob = hex2rgb('#ffffff'); // SettingsPage knob: bg-white / bg-zinc-100
  const c = contrast(track, knob);
  console.log(
    row(theme, rgb2hex(track), rgb2hex(knob), c.toFixed(2), c >= 3 ? 'legible' : '*** INVISIBLE ***'),
  );
}

console.log('\n\n=== SWITCH KNOB TREATMENTS on an accent track ===\n');
console.log('surface.css:643 already inverts the knob to the SURFACE colour.');
console.log(row('theme', 'track', 'knob', 'contrast', 'WCAG UI 3:1'));
console.log('-'.repeat(78));

for (const theme of ['dark', 'light']) {
  const track = hex2rgb(theme === 'dark' ? T.darkAccent : T.lightAccent);
  const surface = hex2rgb(theme === 'dark' ? T.darkSurface : T.lightSurface);
  for (const [label, knobHex] of [
    ['white knob', '#ffffff'],
    ['surface knob', rgb2hex(surface)],
  ]) {
    const c = contrast(track, hex2rgb(knobHex));
    console.log(
      row(theme, rgb2hex(track), knobHex, c.toFixed(2), c >= 3 ? 'PASS' : '*** FAIL ***'),
    );
  }
}

// --- assertions, so a regression is a non-zero exit -------------------------
let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

console.log('\n=== ASSERTIONS ===\n');

for (const theme of ['dark', 'light']) {
  const base = hex2rgb(theme === 'dark' ? T.darkSurface : T.lightSurface);
  const accent = hex2rgb(theme === 'dark' ? T.darkAccent : T.lightAccent);
  const newDelta = Math.max(...over(accent, base, PEAK_ALPHA[theme]).map((v, i) => Math.abs(v - base[i])));
  const oldDelta = Math.max(...over(accent, base, OLD_PEAK).map((v, i) => Math.abs(v - base[i])));
  check(
    `ambient visible on ${theme} (dRGB >= 6)`,
    newDelta >= 6,
    `old ${oldDelta.toFixed(1)} -> new ${newDelta.toFixed(1)}`,
  );
}

// The reported bug: on DARK, --page-accent IS --text-primary (#fafafa) and the
// knob is white, so ON is white-on-white. On LIGHT the same token is #1c1917, a
// near-black track with a white knob, which IS legible — the defect is dark-only,
// and asserting it on light too would be an assertion that contradicts the
// measurements two lines above it.
{
  const darkTrack = hex2rgb(T.darkTextPrimary);
  check(
    'dark: --page-accent track vs white knob is the reported white-on-white bug',
    contrast(darkTrack, hex2rgb('#ffffff')) < 1.5,
    `${contrast(darkTrack, hex2rgb('#ffffff')).toFixed(2)}:1`,
  );
}

// A white knob on the dark accent does NOT clear 3:1 — this is why the fix is not
// merely "swap the token". The knob has to invert to the surface colour.
for (const theme of ['dark', 'light']) {
  const track = hex2rgb(theme === 'dark' ? T.darkAccent : T.lightAccent);
  const surface = hex2rgb(theme === 'dark' ? T.darkSurface : T.lightSurface);
  const white = contrast(track, hex2rgb('#ffffff'));
  const inverted = contrast(track, surface);
  check(
    `${theme}: surface-coloured knob clears 3:1 on the accent track`,
    inverted >= 3,
    `surface knob ${inverted.toFixed(2)}:1 (white knob would be ${white.toFixed(2)}:1)`,
  );
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
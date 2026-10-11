// Fixture-driven test of the opencode line adapter.
//
// The lines in opencode-toolcall-lines.json were extracted from the shipped
// opencode binary, NOT written from an assumption. That distinction is the
// whole point of this file: the previous suite round-tripped its own guessed
// format through its own parser and passed 105/105 while the feature would
// have rendered an empty office.
//
// Usage: node verify-opencode-lines.cjs <bundleDir>
//   bundleDir default: /tmp/opencode/wf-out
//   build with:
//     npx esbuild src/shared/workforceActivity.ts src/main/workforceAdapters.ts \
//       --bundle --outdir=/tmp/opencode/wf-out --format=cjs --platform=node
const fs = require('fs');
const path = require('path');

const B = process.argv[2] || '/tmp/opencode/wf-out';
const AD = require(path.join(B, 'main/workforceAdapters.js'));
const FIX = path.join(__dirname, 'opencode-toolcall-lines.json');

if (!fs.existsSync(FIX)) {
  console.error('fixture missing: ' + FIX);
  process.exit(1);
}
// The fixture keeps its provenance as `#` comments (JSON has no comment
// syntax, but the provenance is the most valuable part of the file).
const lines = JSON.parse(
  fs.readFileSync(FIX, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(#|\/\/)/.test(l))
    .join('\n'),
);

let fails = 0;
let checked = 0;

function ev(line) {
  const out = AD.eventsFromLine(line, 'sess', 'opencode', 1);
  return out.length ? out[0] : null;
}

console.log('opencode tool-call lines: ' + lines.length + ' fixture rows\n');
for (const [raw, wantKind, wantValue] of lines) {
  const e = ev(raw);
  const gotKind = e ? e.kind : null;
  const gotValue = e ? (e.command || e.target || null) : null;

  const kindOk = gotKind === wantKind;
  // For a null expectation we only require that nothing was produced.
  const valOk = wantValue === null ? true : gotValue === wantValue;
  checked++;

  if (kindOk && valOk) {
    console.log(
      'ok    ' + JSON.stringify(raw).padEnd(44) + ' -> ' + String(gotKind) +
        (gotValue ? '  ' + JSON.stringify(gotValue) : ''),
    );
  } else {
    fails++;
    console.log(
      'FAIL  ' + JSON.stringify(raw) +
        '\n        kind   got=' + JSON.stringify(gotKind) + ' want=' + JSON.stringify(wantKind) +
        '\n        value  got=' + JSON.stringify(gotValue) + ' want=' + JSON.stringify(wantValue),
    );
  }
}

// ── the regression that motivated this file, asserted directly ──────────
// The old adapter used a `Name(argument)` regex. Prove it CANNOT see the real
// format, so nobody "simplifies" the opencode path back to it.
console.log('\n--- regression guard: the old Name(arg) shape sees almost nothing ---');
const real = lines.filter(([raw]) => raw.trim() && !/^(\s*)$/.test(raw));
let oldWouldSee = 0;
for (const [raw] of real) {
  if (/^[^\w]{0,3}([A-Za-z][A-Za-z0-9_]{1,30})\(([^)]*)\)\s*$/.test(raw.trim())) oldWouldSee++;
}
console.log('  Name(arg) regex matches ' + oldWouldSee + ' of ' + real.length + ' real rendered lines');
if (oldWouldSee > real.length * 0.25) {
  fails++;
  console.log('  FAIL  the old shape now matches too much — check the extractor is still real');
} else {
  console.log('  ok    confirms the old shape was the bug');
}

// ── status glyphs must not swallow the line ─────────────────────────────
console.log('\n--- status glyphs carry result, never suppress the action ---');
for (const [hex, want] of [['2713', 'ok'], ['2022', 'running'], ['2717', 'fail']]) {
  const g = String.fromCodePoint(parseInt(hex, 16));
  const e = ev(g + ' Read src/main.ts');
  const ok = e && e.kind === 'read' && e.result === want;
  checked++;
  if (!ok) { fails++; console.log('  FAIL  U+' + hex + ' -> ' + JSON.stringify(e)); }
  else console.log('  ok    U+' + hex + ' Read src/main.ts -> read/' + want);
}

// ── a full session through the real ingest pipeline ─────────────────────
console.log('\n--- end-to-end through the ingest buffer ---');
const ing = AD.createWorkforceIngest({ strip: (s) => s });
const session = lines.map(([raw]) => raw).filter((l) => l.trim());
let all = [];
for (const l of session) all.push(...ing.push('s', 'opencode', l + '\n'));
const kinds = all.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {});
console.log('  ' + all.length + ' events from ' + session.length + ' lines');
console.log('  ' + JSON.stringify(kinds));
checked++;
if (all.length < session.length * 0.7) {
  fails++;
  console.log('  FAIL  fewer than 70% of real lines produced an event');
} else {
  console.log('  ok    the majority of real lines classify');
}

console.log('');
console.log('checked ' + checked + ' assertions — ' + (fails === 0 ? 'ALL PASS' : fails + ' FAILURES'));
process.exit(fails === 0 ? 0 : 1);
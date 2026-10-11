/**
 * External activities must FILL gaps, including the ones that start the night before.
 *
 * Sleep normally runs 23:20 -> 07:02. Filtering coverage by `started_at >= periodStart`
 * dropped that row from "today", so the app reported midnight -> 07:02 — seven hours of
 * the user's sleep — as untracked, and then offered to fill it. Coverage is an OVERLAP
 * test, never a start-time test.
 */
let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

const PS = Date.parse('2026-10-09T00:00:00+07:00');   // local midnight
const NOW = Date.parse('2026-10-09T09:24:00+07:00');
const S = (ms: number) => new Date(ms).toISOString();

/** Which coverage rows pass a given predicate, then the resulting gaps. */
function detect(rows: { s: number; e: number }[], mode: 'start' | 'overlap') {
  const kept = rows.filter((r) => (mode === 'start' ? r.s >= PS : r.e > PS) && r.e > r.s);
  const sorted = [...kept].sort((a, b) => a.s - b.s);
  const m: { s: number; e: number }[] = [];
  for (const iv of sorted) {
    if (m.length && iv.s <= m[m.length - 1].e) m[m.length - 1].e = Math.max(m[m.length - 1].e, iv.e);
    else m.push({ s: iv.s, e: iv.e });
  }
  const gaps: [number, number][] = [];
  if (!m.length) gaps.push([PS, NOW]);
  else {
    if (m[0].s > PS) gaps.push([PS, m[0].s]);
    for (let i = 0; i < m.length - 1; i++) gaps.push([m[i].e, m[i + 1].s]);
    if (NOW > m[m.length - 1].e) gaps.push([m[m.length - 1].e, NOW]);
  }
  return gaps.filter(([a, b]) => b - a >= 300);
}

const sleep = { s: Date.parse('2026-10-08T23:20:00+07:00'), e: Date.parse('2026-10-09T07:02:00+07:00') };
const morning = { s: Date.parse('2026-10-09T09:24:00+07:00'), e: Date.parse('2026-10-09T09:34:00+07:00') };
const hrs = (ms: number) => Math.round(ms / 360000) / 10;
const total = (g: [number, number][]) => g.reduce((s, [a, b]) => s + (b - a), 0);

console.log('THE BUG: a sleep that began last night is dropped from "today":');
const before = detect([sleep, morning], 'start');
// midnight -> 09:24 = 9h24m, i.e. the whole morning INCLUDING the sleep is called untracked
ok(hrs(total(before)) === 9.4, `9h24m reported untracked (${hrs(total(before))}h) — it swallowed the sleep`);

console.log('\nTHE FIX: coverage is an OVERLAP test:');
const after = detect([sleep, morning], 'overlap');
// 07:02 -> 09:24 = 2h22m: sleep ran to 07:02, next session began 09:24
ok(hrs(total(after)) === 2.4, `2h22m untracked (${hrs(total(after))}h) — only 07:02->09:24`);
ok(hrs(total(after)) < hrs(total(before)), 'the fix strictly reduces phantom untracked time');
ok(after.length === 1, 'exactly one gap remains');
ok(new Date(after[0][0]).getHours() === 7, 'the surviving gap starts when sleep ends, not at midnight');

console.log('\nthe sleep row is genuinely inside the window, not clipped away:');
ok(sleep.e > PS && sleep.s < NOW, 'sleep 23:20 -> 07:02 straddles local midnight');

console.log('\na row entirely outside the window stays excluded either way:');
const old = { s: Date.parse('2026-10-07T09:00:00+07:00'), e: Date.parse('2026-10-07T10:00:00+07:00') };
ok(detect([old, morning], 'overlap').length === detect([old, morning], 'start').length,
   'a session from 2 days ago changes nothing');

console.log('\na zero-length or inverted row cannot create a phantom gap:');
ok(detect([{ s: PS, e: PS }, morning], 'overlap').length === 1, 'degenerate row ignored');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);

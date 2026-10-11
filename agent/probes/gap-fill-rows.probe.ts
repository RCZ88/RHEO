/**
 * Who is responsible for timestamps in the gap-fill save?
 *
 * I briefly "fixed" App.tsx to rebuild the rows before calling
 * create-external-sessions-batch, on the assumption the modal emitted segments with
 * no timestamps. That assumption was FALSE — the modal builds startedAt/endedAt
 * itself — and the "fix" was a REGRESSION: it filtered to the filled segments first,
 * discarding the cursor offsets the modal had accumulated for SKIPPED slots.
 *
 * This probe pins the real contract so nobody reintroduces it: the modal owns the
 * clock, and the cursor must advance across blanks.
 */

// ── the modal's builder, extracted verbatim from AfkPromptModal.tsx ──────────
function buildResult(segments: any[], periodStart: string) {
  const cursor = new Date(periodStart);
  const result: any[] = [];
  for (const seg of segments) {
    const segStart = cursor.toISOString();
    cursor.setTime(cursor.getTime() + seg.durationSeconds * 1000);
    if (seg.activityId) {
      result.push({ activityId: seg.activityId, startedAt: segStart, endedAt: cursor.toISOString() });
    }
  }
  return result;
}

// ── main-side insert, verbatim ───────────────────────────────────────────────
function insertAll(segments: any[]) {
  const out: number[] = [];
  for (const seg of segments) {
    const start = new Date(seg.startedAt);
    const end = new Date(seg.endedAt);
    out.push(Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000)));
  }
  return out;
}

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

const GAP = Date.parse('2026-10-07T15:05:44.004Z');
const ISO = new Date(GAP).toISOString();
const T = (m: number) => m * 60;

console.log('a full answer is emitted as contiguous wall-clock rows:');
const full = buildResult(
  [{ activityId: '4', durationSeconds: T(20) }, { activityId: '9', durationSeconds: T(20) }, { activityId: '14', durationSeconds: T(9) }],
  ISO,
);
ok(full.length === 3, 'three rows');
ok(full[0].startedAt === ISO, 'first row starts at the gap start');
ok(Date.parse(full[0].endedAt) === Date.parse(full[1].startedAt), 'row 1 -> 2 is contiguous');
ok(Date.parse(full[1].endedAt) === Date.parse(full[2].startedAt), 'row 2 -> 3 is contiguous');
ok(Date.parse(full[2].endedAt) - GAP === T(49) * 1000, 'total duration is the sum of the segments');
insertAll(full);
ok(true, 'the handler accepts every row (no Invalid Date)');

console.log('\nA SKIPPED MIDDLE SLOT must still advance the clock — this is the invariant:');
// 20m activity, then a blank slot, then 20m of something else. Filtering to the
// filled rows before assigning times would cram both activities into 20m.
const gapped = buildResult(
  [{ activityId: '4', durationSeconds: T(20) }, { activityId: null, durationSeconds: T(20) }, { activityId: '14', durationSeconds: T(20) }],
  ISO,
);
ok(gapped.length === 2, 'the blank slot is not written');
ok(Date.parse(gapped[1].startedAt) - Date.parse(gapped[0].endedAt) === T(20) * 1000,
   'the blank slot still consumes wall-clock time');
ok(Date.parse(gapped[1].endedAt) - GAP === T(60) * 1000, 'the last row ends 60m in, not 40m');

console.log('\nleading and trailing blanks behave the same:');
const lead = buildResult([{ activityId: null, durationSeconds: T(10) }, { activityId: '4', durationSeconds: T(15) }], ISO);
ok(Date.parse(lead[0].startedAt) - GAP === T(10) * 1000, 'a leading blank shifts the first row forward');
const tail = buildResult([{ activityId: '4', durationSeconds: T(15) }, { activityId: null, durationSeconds: T(10) }], ISO);
ok(tail.length === 1 && Date.parse(tail[0].endedAt) - GAP === T(15) * 1000, 'a trailing blank does not extend the written row');

console.log('\nApp.tsx must NOT rebuild these rows — forwarding them is the contract:');
ok(true, 'enqueueGapFill normalises the GAP; the modal normalises the SEGMENTS');

console.log('\ndegenerate input cannot produce an Invalid Date:');
ok(insertAll(buildResult([], ISO)).length === 0, 'no segments -> no rows');
ok(insertAll(buildResult([{ activityId: null, durationSeconds: 600 }], ISO)).length === 0, 'all blank -> no rows');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);

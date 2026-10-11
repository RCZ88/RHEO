/** The duration field: `1:30` must beat ninety clicks of `+`. */
const formatDurationField = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? String(m) : `${m}:${String(s).padStart(2, '0')}`;
};
const parseDurationField = (raw: string): number | null => {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const clock = t.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (clock) {
    const mins = Number(clock[1]);
    const secs = Number(clock[2]);
    if (secs > 59) return null;          // 1:99 is not a time
    const total = mins * 60 + secs;
    return total >= 60 ? total : null;
  }
  const unit = t.match(/^(\d+(?:\.\d+)?)\s*(h|m|s)$/);
  if (unit) {
    const n = Number(unit[1]);
    const secs = Math.round(unit[2] === 'h' ? n * 3600 : unit[2] === 'm' ? n * 60 : n);
    return secs >= 60 ? secs : null;
  }
  const plain = Number(t);
  if (Number.isFinite(plain) && plain >= 1) return Math.round(plain * 60);
  return null;
};

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const eq = (a: unknown, b: unknown, m: string) => ok(a === b, `${m}  (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('display:');
eq(formatDurationField(2700), '45', '45 min shows as "45"');
eq(formatDurationField(300),  '5',  '5 min shows as "5"');
eq(formatDurationField(90),   '1:30', '90s shows as "1:30"');
eq(formatDurationField(3600), '60', '60 min shows as "60"');

console.log('\nparse:');
eq(parseDurationField('45'),    2700, '"45"     -> 45 min');
eq(parseDurationField('1:30'),  90,   '"1:30"   -> 90s');
eq(parseDurationField('2:00'),  120,  '"2:00"   -> 120s');
eq(parseDurationField('90s'),   90,   '"90s"    -> 90s');
eq(parseDurationField('2m'),    120,  '"2m"     -> 120s');
eq(parseDurationField('1h'),    3600, '"1h"     -> 3600s');
eq(parseDurationField(' 30 '), 1800, '" 30 "   -> 30 min (whitespace tolerated)');

console.log('\nrefuse rather than corrupt — a half-typed value must not snap the slot:');
eq(parseDurationField(''),      null, '""       -> ignored');
eq(parseDurationField('a'),     null, '"a"      -> ignored');
eq(parseDurationField('0'),     null, '"0"      -> ignored');
eq(parseDurationField('0:30'),  null, '"0:30"   -> ignored (under the 1m floor)');
eq(parseDurationField('::'),    null, '"::"     -> ignored');
eq(parseDurationField('1:99'),  null, '"1:99"   -> rejected, 99s is not a time');

console.log('\nround trip:');
for (const s of [60, 300, 2700, 3600, 5430]) {
  eq(parseDurationField(formatDurationField(s)), s, `${formatDurationField(s)} round-trips`);
}

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);

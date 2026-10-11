/**
 * Proves the stopwatch store's CONTRACT with numbers.
 *
 * THE BUG THIS EXISTS TO CATCH
 * ----------------------------
 * `persist()` writes {productive, distracting, paused, activeTier} — and NO dayKey.
 * `hydrate()` gates the whole restore on `saved.dayKey === localDayKey()`, returning
 * `fresh()` (all zeros) otherwise. So the persisted payload can never satisfy its own
 * guard: every load starts at 0:00:00, and `reloadFromStorage()` — the cross-window sync
 * the island depends on — copies zeros. Silent, total, and it looks like "the stopwatch
 * doesn't work".
 *
 * Both halves are asserted here: the payload that is actually written, and the hydrate
 * guard read straight out of the source. No module re-instantiation needed.
 */
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

import { readFileSync } from 'node:fs';
import { stopwatch, startStopwatchDriver } from '../../src/lib/stopwatchStore.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => {
  c ? (pass++, console.log(`  ok   ${n}${d ? '  ' + d : ''}`)) : (fail++, console.log(`  FAIL ${n}  ${d}`));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// The real app runs the 1s driver, which is what recomputes the snapshot. Without it
// `getSnapshot()` returns a value frozen at the last emit() and "did it advance" is
// unanswerable — that failure would be the probe's fault, not the store's.
const stopDriver = startStopwatchDriver();

console.log('  ── 1. THE PAYLOAD vs THE GUARD ──');
{
  stopwatch.setHasRealApp(true);
  stopwatch.setTier('productive');
  stopwatch.setPaused(false);
  await sleep(1300); // persist() is debounced 1000ms

  const raw = mem.get('rheo-stopwatch-v1');
  console.log('    persisted payload:', raw);
  const p = raw ? JSON.parse(raw) : {};
  const keys = Object.keys(p);
  console.log('    keys present:', keys.join(', '));

  ok('persist() wrote a payload', !!raw);
  ok('payload HAS dayKey (required by hydrate)', typeof p.dayKey === 'string', `keys=${keys.join(',')}`);

  // Read hydrate's guard out of the source so the proof does not rest on my memory.
  const src = readFileSync('src/lib/stopwatchStore.ts', 'utf8');
  const guard = src.match(/typeof saved\?\.dayKey === 'string'/);
  ok('hydrate really does gate on dayKey', !!guard, guard ? guard[0] : 'GUARD NOT FOUND');
  if (typeof p.dayKey !== 'string' && guard) {
    console.log('    ==> hydrate CANNOT restore this payload: it returns fresh() (all zeros).');
    console.log('        Every reload starts at 0:00:00 and reloadFromStorage() copies zeros.');
  }
}

console.log('');
console.log('  ── 2. setPaused is a REAL pause (this is what the Halo should call) ──');
{
  stopwatch.setHasRealApp(true);
  stopwatch.setTier('productive');
  stopwatch.setPaused(true);
  const p1 = stopwatch.getSnapshot();
  console.log('    paused -> paused=%s displaySource=%s displayMs=%d', p1.paused, p1.displaySource, p1.displayMs);
  ok('paused flag flips true', p1.paused === true);
  ok('displaySource becomes idle when paused', p1.displaySource === 'idle', `got ${p1.displaySource}`);
  await sleep(1200);
  const p2 = stopwatch.getSnapshot();
  console.log('    after 1.2s paused -> displayMs=%d', p2.displayMs);
  ok('displayMs FROZEN while paused', p2.displayMs === p1.displayMs, `${p1.displayMs} -> ${p2.displayMs}`);

  stopwatch.setPaused(false);
  const p3 = stopwatch.getSnapshot();
  ok('resume clears paused', p3.paused === false);
  await sleep(1200);
  const p4 = stopwatch.getSnapshot();
  console.log('    after 1.2s resumed -> displayMs=%d', p4.displayMs);
  ok('displayMs ADVANCES again after resume', p4.displayMs > p3.displayMs, `${p3.displayMs} -> ${p4.displayMs}`);
}

console.log('');
console.log('  ── 3. setTier attributes, never zeroes ──');
{
  stopwatch.setTier('productive');
  await sleep(600);
  const a = stopwatch.getSnapshot();
  stopwatch.setTier('distracting');
  const b = stopwatch.getSnapshot();
  console.log('    productive total=%d  distracting total=%d  tier=%s', b.productiveMs, b.distractingMs, b.activeTier);
  ok('tier actually flips', b.activeTier === 'distracting');
  ok('productive total NOT zeroed by the flip', b.productiveMs === a.productiveMs || b.productiveMs > 0, `${a.productiveMs} -> ${b.productiveMs}`);
  stopwatch.setTier('productive');
  const c = stopwatch.getSnapshot();
  ok('tier cycles back to productive', c.activeTier === 'productive');
}

console.log('');
console.log('  ── 4. the field the Halo was reading ──');
{
  const s: any = stopwatch.getSnapshot();
  console.log('    snapshot keys:', Object.keys(s).join(', '));
  ok('snapshot has NO .tier field (so reading it yields undefined)', !('tier' in s));
  ok('snapshot HAS .activeTier', typeof s.activeTier === 'string', `value=${s.activeTier}`);
}

console.log(`\n=== ${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed ===`);
stopDriver();
process.exit(fail === 0 ? 0 : 1);

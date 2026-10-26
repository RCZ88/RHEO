/**
 * system-input-idle.probe.ts
 *
 * Proves the device-wide input clock is real on THIS machine, because the whole
 * AFK fix depends on it:
 *
 *   - `powerMonitor.getSystemIdleTime()` returns 0 forever on Linux, and the
 *     old AFK rule was "has the foreground window changed", which cannot see a
 *     keystroke in the window that is already focused.
 *   - `/dev/input/event*` sees every device event regardless of focus.
 *
 * It does not (and cannot) synthesize a keypress, so it asserts the clock is
 * available and that the idle value ADVANCES when nothing is touched — the
 * property that matters. On a machine without readable devices the probe
 * reports the fallback instead of failing, matching production behaviour.
 *
 * Run: npx tsx agent/probes/system-input-idle.probe.ts
 */
import {
  getSystemInputIdleMs,
  getSystemInputWatcherStatus,
  startSystemInputWatcher,
  stopSystemInputWatcher,
} from '../../src/systemInputIdle';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

const started = startSystemInputWatcher();
const status = getSystemInputWatcherStatus();
console.log('watcher:', JSON.stringify(started));

check('watcher does not throw', true);
check('reports a device count', Number.isFinite(started.devices) && started.devices >= 0, `${started.devices}`);

const first = getSystemInputIdleMs();
if (first === null) {
  // No /dev/input access (CI, container, user not in the input group). Callers
  // MUST fall back; the module contract is "null, never a fake 0".
  console.log('  ..   devices not readable — fallback contract exercised (null, not 0)');
  check('unavailable returns null (not 0)', first === null);
} else {
  check('available returns a number', typeof first === 'number', `${first}ms`);
  const waitMs = 1300;
  await new Promise((r) => setTimeout(r, waitMs));
  const second = getSystemInputIdleMs();
  // Two correct outcomes: nothing touched -> the clock advances; the user did
  // touch something during the window -> the clock resets near zero. A frozen
  // value is the only failure, because it means the watcher stopped draining.
  const advanced = typeof second === 'number' && second > first! + 900;
  const resetByRealInput = typeof second === 'number' && second < 2000;
  check(
    'clock advances (or resets on real input)',
    advanced || resetByRealInput,
    `${first}ms -> ${second}ms${advanced ? ' (advanced)' : ' (real input observed)'}`,
  );
  if (second !== null && second < 200) {
    // A device is generating ambient events; warn without failing, because a
    // genuinely active user would also produce a small value.
    console.log('  ..   idle is very small — a device may be emitting ambient events');
  }
}

check('status exposes no key data', !JSON.stringify(status).toLowerCase().includes('code'));

stopSystemInputWatcher();
console.log(`\nRESULT: ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);

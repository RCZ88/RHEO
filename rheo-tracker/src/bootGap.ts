import * as fs from 'node:fs';
import { STATE_PATH } from './config';
import { persistSleepDetection } from './sleepDetection';

/**
 * The kernel boot instant — the moment the LAPTOP was turned on. `/proc/stat`
 * carries `btime <unix-seconds>` which is exactly that, independent of when
 * anything decided to start watching.
 */
function readBootTime(): number | null {
  try {
    const m = /btime (\d+)/.exec(fs.readFileSync('/proc/stat', 'utf8'));
    return m ? Number(m[1]) * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * COLD-BOOT WAKE CAPTURE — the case where the laptop is actually powered off
 * overnight and turned on in the morning.
 *
 * The live-wake path (daemon frozen across suspend, first tick after resume)
 * records device-off/device-on already. But on a true cold boot the gap is
 * invisible: `lastPollAttemptMs` starts at 0, `wallGap` computes as 0, and
 * nothing ever says "the device turned on at HH:MM". The sleep popup then
 * prefills Device On with app-open time instead of the real power-on moment.
 *
 * This restores the missing pair from evidence that survives the power cut:
 *   device off ≈ last successful poll recorded by the PREVIOUS daemon run
 *                (tracker-daemon.json `lastSuccessfulPollAt`)
 *   device on  = the kernel boot time — same instant, even if the daemon or
 *                the app is opened much later
 *
 * Only claims a gap when the previous run ended BEFORE this boot (`last <
 * bootMs`): a daemon restart while the machine was already awake is not
 * sleep, and must never manufacture one.
 */
export function captureColdBootWake(userData: string): boolean {
  try {
    const bootMs = readBootTime();
    if (!bootMs) return false;

    const hb = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as { lastSuccessfulPollAt?: string | null };
    const last = new Date(hb?.lastSuccessfulPollAt ?? '').getTime();
    if (!Number.isFinite(last) || last <= 0 || last >= bootMs) return false;

    if (persistSleepDetection(userData, last, bootMs)) {
      const ms = Math.round((bootMs - last) / 60000);
      console.log(
        `[rheo-tracker] cold-boot wake captured: device off ${new Date(last).toISOString()} → device on ${new Date(bootMs).toISOString()} (${ms} min)`,
      );
      return true;
    }
    return false;
  } catch {
    /* no heartbeat yet, unreadable, or corrupt — there is nothing to capture */
    return false;
  }
}

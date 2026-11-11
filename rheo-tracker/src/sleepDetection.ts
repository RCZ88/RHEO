import * as fs from 'node:fs';
import * as path from 'node:path';
import { classifyGap } from '../../src/shared/sleepWindow';

const MIN_SLEEP_GAP_MS = 15 * 60_000;
const MAX_SLEEP_GAP_MS = 24 * 60 * 60_000;
const PENDING_TTL_MS = 2 * 60 * 60_000;

interface SleepPreferences {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

function hour(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 23
    ? Math.round(numeric)
    : fallback;
}

function readSleepPreferences(userData: string): SleepPreferences {
  try {
    const prefs = JSON.parse(fs.readFileSync(path.join(userData, 'deskflow-prefs.json'), 'utf8')) as Record<string, unknown>;
    return {
      enabled: prefs.sleepWindowEnabled !== false,
      startHour: hour(prefs.sleepWindowStartHour, 22),
      endHour: hour(prefs.sleepWindowEndHour, 7),
    };
  } catch {
    // The tracker must still work on first run, before the app has written prefs.
    return { enabled: true, startHour: 22, endHour: 7 };
  }
}

/**
 * Persist a sleep candidate at the instant the always-on tracker observes wake.
 * The renderer may open much later, but it must never substitute that open time
 * for the device-on time recorded here.
 */
export function persistSleepDetection(userData: string, gapStart: number, gapEnd: number): boolean {
  const durationMs = gapEnd - gapStart;
  if (durationMs < MIN_SLEEP_GAP_MS || durationMs > MAX_SLEEP_GAP_MS) return false;

  const prefs = readSleepPreferences(userData);
  if (!prefs.enabled || classifyGap(prefs.startHour, prefs.endHour, gapStart, gapEnd).verdict !== 'sleep') {
    return false;
  }

  const detectionPath = path.join(userData, 'deskflow-sleep-detection.json');
  try {
    if (fs.existsSync(detectionPath)) {
      const existing = JSON.parse(fs.readFileSync(detectionPath, 'utf8')) as Record<string, unknown>;
      const ageMs = gapEnd - Number(existing.detectedAt || existing.gapEnd || 0);
      // Never overwrite a recent unanswered popup with another wake event.
      if (existing.detected === true && existing.checked !== true && ageMs >= 0 && ageMs < PENDING_TTL_MS) {
        return false;
      }
    }

    const payload = {
      detected: true,
      // This is deliberately the wake observation, not Date.now() in the app.
      detectedAt: gapEnd,
      gapStart,
      gapEnd,
      gapMinutes: Math.round(durationMs / 60_000),
      checked: false,
      source: 'rheo-tracker',
    };
    const tempPath = path.join(userData, `.deskflow-sleep-detection.${process.pid}.tmp`);
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tempPath, detectionPath);
    return true;
  } catch {
    return false;
  }
}

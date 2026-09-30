// ============================================================
// TOAST / NOTIFICATION DURATION
// ============================================================
//
// Every toast in this app hardcoded its own timeout: 4000ms in
// useToasts, 3600ms in content-engine/ui.tsx, 3000ms in SkillsTab,
// 3000ms in RoutingToast. The user asked to be able to change how
// long a notification stays on screen, so this is the one place
// that decides.
//
// Stored in localStorage rather than userPreferences so it applies
// instantly on the next render without a main-process round trip.
// ============================================================

const STORAGE_KEY = 'deskflow-toast-duration-ms';

/** Bounds chosen so a mis-typed value can never lock a toast on screen. */
export const MIN_DURATION_MS = 1000;
export const MAX_DURATION_MS = 60_000;
export const DEFAULT_DURATION_MS = 4000;

/** Offered in Settings → General as preset buttons. */
export const DURATION_PRESETS = [
  { label: '1.5s', value: 1500 },
  { label: '3s', value: 3000 },
  { label: '4s', value: 4000 },
  { label: '6s', value: 6000 },
  { label: '10s', value: 10_000 },
  { label: '20s', value: 20_000 },
  { label: 'Stick', value: MAX_DURATION_MS },
] as const;

function clamp(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_DURATION_MS;
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(ms)));
}

export function getToastDurationMs(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DURATION_MS;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? clamp(n) : DEFAULT_DURATION_MS;
  } catch {
    return DEFAULT_DURATION_MS;
  }
}

export function setToastDurationMs(ms: number): number {
  const v = clamp(ms);
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* private mode */ }
  try {
    window.dispatchEvent(new CustomEvent('toast-duration-changed', { detail: v }));
  } catch { /* non-fatal */ }
  return v;
}

/** "Stick" means the toast has to be dismissed by hand. */
export function isSticky(ms: number = getToastDurationMs()): boolean {
  return clamp(ms) >= MAX_DURATION_MS;
}

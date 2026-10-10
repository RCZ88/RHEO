// Display-timezone handling for AI history screens.
//
// WHY THIS EXISTS
// Two separate, opposite bugs used to make every AI timestamp wrong:
//
// 1. SQLite `DATETIME` text is always UTC ("2026-10-01 16:20:00"). Passing that
//    straight to `new Date()` does NOT give the UTC instant — the space-separated
//    form is parsed in LOCAL time, so a UTC row renders 7h (Jakarta) or 12h off.
//    That is the "the data is behind" symptom.
// 2. A bare "2026-10-01" from an `ai_usage.date` column is a CALENDAR day the user
//    lived through, not an instant. `new Date("2026-10-01")` is UTC midnight,
//    which renders as the PREVIOUS day in every negative-offset timezone.
//
// Neither is fixed by writing different data — the stored values are correct.
// This module only decides how an instant is rendered, and exposes a
// user-adjustable offset so someone whose data still lands in the wrong hour can
// nudge it without a re-import.

const MIN_OFFSET_MINUTES = -16 * 60
const MAX_OFFSET_MINUTES = 16 * 60

let displayOffsetMinutes = 0

export function setAiDisplayOffsetMinutes(minutes: number): void {
  if (!Number.isFinite(minutes)) {
    displayOffsetMinutes = 0
    return
  }
  displayOffsetMinutes = Math.min(MAX_OFFSET_MINUTES, Math.max(MIN_OFFSET_MINUTES, Math.round(minutes)))
}

export function getAiDisplayOffsetMinutes(): number {
  return displayOffsetMinutes
}

export function resetAiDisplayOffset(): void {
  displayOffsetMinutes = 0
}

/** "UTC+7", "UTC-12", "UTC+5:30" — for the control label. */
export function formatOffsetLabel(minutes: number = displayOffsetMinutes): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`
}

/**
 * Parse a timestamp that is known to be UTC (SQLite DATETIME text, or an ISO
 * string ending in Z) into a real instant.
 */
export function parseUtcInstant(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    // Heuristic: values below ~1e11 are seconds, above are milliseconds.
    const ms = Math.abs(value) < 1e11 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw) return null

  // Bare calendar day: it is a day, not an instant. Anchor it at local midnight
  // so it never slips to the previous day west of UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, mo, d] = raw.split('-').map(Number)
    const local = new Date(y, mo - 1, d, 0, 0, 0, 0)
    return Number.isNaN(local.getTime()) ? null : local
  }

  // SQLite's "YYYY-MM-DD HH:MM:SS" — pin the zone to UTC explicitly.
  const sqlite = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(raw)
  if (sqlite) {
    const [, y, mo, d, hh, mm, ss, frac] = sqlite
    const ms = Date.UTC(
      Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss || 0),
      frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0
    )
    const parsed = new Date(ms)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const fallback = new Date(raw)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

/** Parse, then shift by the user's display offset. */
export function toDisplayInstant(value: unknown): Date | null {
  const d = parseUtcInstant(value)
  if (!d) return null
  return new Date(d.getTime() + displayOffsetMinutes * 60_000)
}

/**
 * SQLite stores a calendar day as a bare "YYYY-MM-DD". `new Date()` would read it
 * as UTC midnight, which is the previous day for anyone west of UTC — so the day
 * is resolved against local midnight instead. This is deliberately NOT offset-
 * adjustable: shifting a day label by an hour would re-bucket data that is
 * already correct.
 */
export function parseLocalDay(value: unknown): Date | null {
  return parseUtcInstant(value)
}

export function formatRelativeTime(value: unknown, now: Date = new Date()): string {
  const d = toDisplayInstant(value)
  if (!d) return typeof value === 'string' && value ? value : '—'
  const diffMs = now.getTime() - d.getTime()
  const future = diffMs < 0
  const abs = Math.abs(diffMs)
  const mins = Math.floor(abs / 60_000)
  if (mins < 1) return future ? 'in a moment' : 'just now'
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return future ? `in ${days}d` : `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatFullDateTime(value: unknown): string {
  const d = toDisplayInstant(value)
  if (!d) return typeof value === 'string' && value ? value : '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDayLabel(value: unknown): string {
  const d = parseLocalDay(value)
  if (!d) return typeof value === 'string' && value ? value : '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

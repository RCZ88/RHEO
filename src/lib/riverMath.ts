/* riverMath.ts — pure helpers for the Life Phases Timeline ("River of Years").
   No React, no DOM — everything here is unit-testable math + labels. */

export interface LifePhaseMilestone {
  id: string
  date: string              // ISO date, day precision
  label: string
  note?: string | null
  photoMemoryId?: string | null
}

export interface LifePhasePerson {
  id: string
  name: string
  role: string               // free text: "mentor", "co-founder", "mom"
  note?: string | null
}

export type PhaseMoodTag =
  | 'hopeful' | 'exhausted' | 'proud' | 'lost' | 'grateful' | 'anxious'
  | 'free' | 'lonely' | 'inspired' | 'stuck' | 'peaceful' | 'restless'

export interface LifePhaseConnection {
  targetPhaseId: string
  note?: string | null
}

export interface LifePhase {
  // ── existing, unchanged ──────────────────────────────
  id: string
  title: string
  description: string
  category: string
  startMonth: number
  startYear: number
  startDate?: string | null         // optional ISO date YYYY-MM-DD
  endMonth?: number | null
  endYear?: number | null
  endDate?: string | null           // optional ISO date YYYY-MM-DD
  magnitude: number          // 1–10
  color: string
  reflection: string
  eraTrends: string
  impactNotes: string
  milestones: LifePhaseMilestone[]
  connections: LifePhaseConnection[]

  // ── new, additive, all nullable ──────────────────────
  people?: LifePhasePerson[] | null
  moodStart?: number | null         // -3 (struggling) … +3 (thriving)
  moodEnd?: number | null
  moodTags?: PhaseMoodTag[] | null
  feelingsNote?: string | null
  lessonsLearned?: string | null
  headerImageMemoryId?: string | null
  colorSource?: 'category' | 'custom' | null
  reflectionSource?: 'manual' | 'ai' | 'ai-edited' | null
  reflectionGeneratedAt?: string | null
  status?: 'draft' | 'complete'
  /** How much of the form this chapter earned. Shapes required steps only. */
  scale?: PhaseScaleId | null
  updatedAt?: string
}

export const PHASE_MOOD_TAGS: PhaseMoodTag[] = [
  'hopeful', 'exhausted', 'proud', 'lost', 'grateful', 'anxious',
  'free', 'lonely', 'inspired', 'stuck', 'peaceful', 'restless',
]

export const MAGNITUDE_LABELS: Record<string, string> = {
  '1-2': 'Quiet',
  '3-4': 'Notable',
  '5-6': 'Significant',
  '7-8': 'Defining',
  '9-10': 'Everything changed',
}

/* ── Phase detail level (how deep the FORM goes) ──────────────
   WHY THIS EXISTS: every chapter — a three-week trip and a four-year
   company — used to walk through the SAME nine-step wizard, so a small
   life event cost as much to record as a defining era. This picks how
   many questions we ask, so a trip can be recorded in seconds.

   ⚠ IT IS NOT `magnitude`. These two live in the same dialog and MUST NOT
   read alike, or the user cannot tell which is which:
     • magnitude (0–100) — how MUCH this chapter changed you. A rating.
     • scale    (this)   — how MUCH WORK you want to do writing it. Effort.
   The blurbs below are therefore phrased as EXAMPLES the user might pick,
   never as judgements about their life, so it never sounds like a score.

   It is a FORM-SHAPE control, not a value judgement: lowering the
   level never deletes anything already written. Optional steps stay
   reachable forever via `deeper`, so this can always be widened. */

export const PHASE_SCALES = [
  {
    id: 'light',
    label: 'Quick',
    blurb: 'Just the basics — name it, date it, move on.',
    example: 'Six weeks in Lisbon',
    /** Required to save. Keep this SHORT — that is the entire point. */
    required: ['basics'] as const,
  },
  {
    id: 'standard',
    label: 'Standard',
    blurb: 'Add the story and what it taught you.',
    example: 'Four years at a startup',
    required: ['basics', 'story', 'lessons'] as const,
  },
  {
    id: 'deep',
    label: 'Full',
    blurb: 'Everything we can ask, including people and mood.',
    example: 'Starting a company',
    required: ['basics', 'story', 'moments', 'people', 'feelings', 'lessons'] as const,
  },
] as const

export type PhaseScaleId = (typeof PHASE_SCALES)[number]['id']
export const DEFAULT_PHASE_SCALE: PhaseScaleId = 'standard'

export function scaleOf(id?: string | null) {
  return PHASE_SCALES.find(s => s.id === id) ?? PHASE_SCALES.find(s => s.id === DEFAULT_PHASE_SCALE)!
}

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export const PHASE_CATEGORIES = [
  { id: 'growth', label: 'Growth', color: '#6fb38f' },
  { id: 'career', label: 'Career', color: '#38bdf8' },
  { id: 'love', label: 'Love', color: '#f472b6' },
  { id: 'challenge', label: 'Challenge', color: '#a1a1aa' },
  { id: 'joy', label: 'Joy', color: '#fbbf24' },
  { id: 'rest', label: 'Rest', color: '#a78bfa' },
  { id: 'adventure', label: 'Adventure', color: '#2dd4bf' },
  { id: 'creation', label: 'Creation', color: '#e8866b' },
] as const

export type PhaseCategory = (typeof PHASE_CATEGORIES)[number]['id']

export function categoryOf(id: string): { id: string; label: string; color: string } {
  return (
    PHASE_CATEGORIES.find(c => c.id === id) ?? {
      id,
      label: id,
      color: '#fbbf24',
    }
  )
}

/** Map a (year, month) to a 0..1 position along a timeline spanning minYear..maxYear. */
export function timeToX(year: number, month: number, minYear: number, maxYear: number): number {
  const span = Math.max(1, maxYear - minYear)
  const t = year + (month - 1) / 12
  return Math.min(1, Math.max(0, (t - minYear) / span))
}

export function phaseStartX(p: LifePhase, minYear: number, maxYear: number): number {
  return timeToX(p.startYear, p.startMonth || 1, minYear, maxYear)
}

export function phaseEndX(p: LifePhase, minYear: number, maxYear: number): number {
  if (p.endYear != null && p.endYear > 0) {
    return timeToX(p.endYear, p.endMonth || 12, minYear, maxYear)
  }
  return 1
}

/** The river is drawn as a set of rounded "reaches"; taller = bigger magnitude. */
export function reachHeight(magnitude: number): number {
  const m = Math.min(100, Math.max(0, magnitude))
  return 0.32 + (m / 100) * 0.48
}

/** Soft (sigmoid-ish) fill ramp between two normalized x positions. */
export function rampFill(from: number, to: number, x: number): number {
  if (to <= from) return 1
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** Readable text color on top of a solid hex fill: dark on bright, white on dark. */
export function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#f4f4f5'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#18181b' : '#f4f4f5'
}

/** Named zoom stops for the map controls — mapped onto the canvas' 0..4 zoom levels. */
export const ZOOM_STOPS = [
  { label: 'Life', zoom: 0 },
  { label: 'Decade', zoom: 2 },
  { label: 'Year', zoom: 4 },
] as const

export interface ZoomView {
  zoom: number
  minYear: number
  maxYear: number
  yearSpan: number
}

/** Current zoom level → the year window the canvas displays. */
export function zoomStops(zoom: number, dataMinYear: number, dataMaxYear: number): ZoomView {
  const levels: Array<{ z: number; span: number }> = [
    { z: 0, span: 100 },
    { z: 1, span: 60 },
    { z: 2, span: 40 },
    { z: 3, span: 25 },
    { z: 4, span: 15 },
  ]
  const idx = Math.min(levels.length - 1, Math.max(0, Math.round(zoom)))
  const span = levels[idx].span
  const dataSpan = dataMaxYear - dataMinYear
  const today = new Date().getFullYear()
  const center = Math.max(dataMinYear, Math.min(today, Math.round((dataMinYear + dataMaxYear) / 2)))
  const half = Math.max(span, dataSpan) / 2
  return {
    zoom: idx,
    minYear: Math.floor(center - half),
    maxYear: Math.ceil(center + half),
    yearSpan: Math.ceil(center + half) - Math.floor(center - half),
  }
}

export function magnitudeWords(v: number): string {
  const m = Math.min(100, Math.max(0, Math.round(v)))
  if (m < 10) return 'barely a ripple'
  if (m < 20) return 'a quiet current'
  if (m < 30) return 'a gentle stream'
  if (m < 40) return 'a steady flow'
  if (m < 50) return 'a widening river'
  if (m < 60) return 'a strong current'
  if (m < 70) return 'a powerful stretch'
  if (m < 80) return 'a roaring torrent'
  if (m < 90) return 'a cataract'
  return 'the full flood'
}

export function magnitudeGradient(v: number): string {
  const m = Math.min(100, Math.max(0, Math.round(v)))
  return `linear-gradient(to right, #fbbf24 ${m}%, rgba(255,255,255,0.08) ${m}%)`
}

/** "Mar 2018 – Jun 2021" | "Mar 2018 – present" */
export function phaseSpanLabel(p: LifePhase): string {
  const start = `${MONTHS[(p.startMonth || 1) - 1]} ${p.startYear}`
  const end =
    p.endYear != null && p.endYear > 0
      ? `${MONTHS[(p.endMonth || 12) - 1]} ${p.endYear}`
      : 'present'
  return `${start} – ${end}`
}

export function phaseAgeLabel(p: LifePhase): string {
  const now = new Date()
  const endY = p.endYear != null && p.endYear > 0 ? p.endYear : now.getFullYear()
  const endM = p.endMonth != null && p.endMonth > 0 ? p.endMonth : now.getMonth() + 1
  const years = endY - p.startYear + (endM - (p.startMonth || 1)) / 12
  if (years < 1) return 'a season'
  if (years < 2) return 'a year'
  return `${Math.round(years)} years`
}

/** Lighten (or darken, with a negative percent) a #rrggbb hex color via HSL. */
export function lighten(hex: string, percent: number): string {
  const clean = (hex || '').trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex || '#fbbf24'
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  const nl = Math.min(1, Math.max(0, l + percent / 100))
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let q2 = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s
  let p2 = 2 * nl - q2
  const nr = hue2rgb(p2, q2, h + 1 / 3)
  const ng = hue2rgb(p2, q2, h)
  const nb = hue2rgb(p2, q2, h - 1 / 3)
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`
}

/** Minimal structural ref to a loaded memory — keeps riverMath free of React/IndexedDB imports. */
export interface MemoryRef {
  meta: { id: string; date?: string | null }
  url: string
}

/**
 * Resolve a memory id to its renderable blob URL.
 * Memories live in IndexedDB blobs surfaced by `useMemories()` — object URLs only exist
 * for the current session, so the loaded list must be passed in.
 */
export function memoryUrl(memories: MemoryRef[], memoryId: string | null | undefined): string | null {
  if (!memoryId) return null
  return memories.find(m => m.meta.id === memoryId)?.url ?? null
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function sortPhases(phases: LifePhase[]): LifePhase[] {
  return [...phases].sort((a, b) => {
    const aStart = a.startYear + (a.startMonth || 1) / 12
    const bStart = b.startYear + (b.startMonth || 1) / 12
    return aStart - bStart
  })
}

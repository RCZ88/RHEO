export const R10_SEQ = {
  // Full sequence timings (ms) — spec ceiling: ≤1600ms total
  full: {
    fieldVisible: 0,
    ticksStart: 0,
    ticksEnd: 500,        // 24 ruler ticks cascade in, stagger 12ms
    numsStart: 350,
    numsEnd: 700,         // mono numerals 00/06/12/18/24 rise+fade
    nowStart: 700,
    nowEnd: 900,          // now-tick ignites (CategoryColors accent + ≤8% bloom)
    sweepStart: 850,
    sweepEnd: 1250,       // hairline sweep → logomark/wordmark reveal
    holdEnd: 1450,        // hold ≥150ms at rest
    dismiss: 1500,        // dismiss after hold
    totalMs: 1500,        // full sequence ≤1600ms
  },
  // Warm-start: ticks + wordmark only, ≤600ms
  warmStart: {
    ticksStart: 0,
    ticksEnd: 400,
    sweepStart: 350,
    sweepEnd: 550,
    logoRevealEnd: 600,
    totalMs: 600,
  },
  // Reduced motion: static rest frame, 140ms fade
  reducedMotion: {
    fadeMs: 140,
  },
  // Constants
  staggerMs: 12,          // tick cascade stagger
  tickCount: 24,
  nowTickBloomPct: 8,     // ≤8% bloom on now-tick ignition
} as const;

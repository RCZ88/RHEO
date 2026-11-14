/** Single source of truth for boot choreography — C · DEPARTURES (2026-11-14).
 *
 *  Identity across all three boot surfaces (splash window → #df-startup → this
 *  overlay): near-black field, ONE signal hue read from `--ws-accent`, JetBrains
 *  Mono only, split-flap RHEO wordmark, canvas lamp lattice, 2px sunken track.
 *  Motion is a 3-event state machine: entrance / one wave per stage advance /
 *  rest at ready. The only infinite loop is the clock (functional).
 *
 *  The variant id stays 'meridian' — it is hard-typed in prefService.ts,
 *  bootAnimation.ts and the `boot-animation-config` handler in main.ts, and
 *  renaming it would cascade into files this task never named. DEPARTURES is
 *  what 'meridian' renders.
 *
 *  Mechanic constants (FLIP/STAGGER/WAVE_MS) are lifted verbatim from the
 *  registry component sources (kokonutui split-flap-text, reactbits
 *  LatticeLoader) — they are why the flaps feel machined. Do not "round" them. */
export const BOOT_TIMINGS = {
  MIN_DISPLAY_MS: 3200,
  WATCHDOG_CAP_MS: 9000,
  FADE_OUT_MS: 600,
  WARM_START_MS: 800,
  CARD_IN: 500,      // board entrance (BootOverlay motion transition)

  // split-flap drums (kokonutui split-flap-text mechanics)
  FLIP: 56,          // ms per flap fall
  FLIP_HALF: 28,     // one half-rotation = FLIP / 2
  STAGGER: 40,       // ms between tiles
  FLAPS_AT: 80,      // drums start, ms after board-in

  // lattice lamp field (reactbits LatticeLoader mechanics)
  WAVE_MS: 864,      // one wave sweep across the field

  // stage ladder — the overlay's four rows advance on these; the last row
  // ("ready — your day is being recorded") completes on `rheo:boot-ready`,
  // never on a timer, so the board cannot claim readiness the app hasn't
  // reported.
  ROWS_AT: 240,      // first row slides in
  ROW_STAGGER: 70,   // rows appear staggered
  STAGE_AT: [1200, 2100] as const,   // rows 1..2 activate (row 0 at ROWS_AT)
  STAGE_PCT: [22, 50] as const,      // track % as each timed stage completes;
                                     // the ready row completes on boot-ready at 100%
} as const;

export type BootAnimationConfig = {
  enabled: boolean;
  variant: 'meridian';
  warmStart: boolean;
};

export interface SplashBridge {
  getBootAnimationConfig: () => Promise<BootAnimationConfig>;
  onReplay: (cb: () => void) => void;
  sendComplete: () => Promise<void>;
}

export function getSplashApi(): SplashBridge | undefined {
  return (window as unknown as { splashAPI?: SplashBridge }).splashAPI;
}

/** Single source of truth for boot animation choreography. */
export const BOOT_TIMINGS = {
  MIN_DISPLAY_MS: 3200,
  WATCHDOG_CAP_MS: 9000,
  FADE_OUT_MS: 600,
  WARM_START_MS: 800,
  CARD_IN: 500,
  TICKS_AT: 150,
  TICK_STAGGER: 12,
  TICK_DUR: 260,
  NUMERALS_AT: 450,
  NUMERAL_STAGGER: 40,
  NUMERAL_DUR: 250,
  NOW_TICK_AT: 900,
  SWEEP_AT: 1050,
  SWEEP_DUR: 900,
  STATUS_ROTATE_MS: 900,
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

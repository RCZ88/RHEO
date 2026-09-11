// R-10 · Boot animation config — reads from userPreferences directly
// (main process can't use preload's deskflowAPI — contextBridge doesn't exist there)

export interface BootAnimationConfig {
  enabled: boolean;
  variant: 'meridian';
  warmStart: boolean;
}

export const DEFAULT_BOOT_ANIMATION: BootAnimationConfig = {
  enabled: true,
  variant: 'meridian',
  warmStart: false,
};

const STORAGE_KEY = 'boot_animation';

function parseConfig(raw: unknown): BootAnimationConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_BOOT_ANIMATION;
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_BOOT_ANIMATION.enabled,
    variant: 'meridian' as const,
    warmStart: typeof r.warmStart === 'boolean' ? r.warmStart : DEFAULT_BOOT_ANIMATION.warmStart,
  };
}

// userPreferences is set by main.ts before createWindow() is called
let _prefs: Record<string, unknown> = {};

export function initPrefService(prefs: Record<string, unknown>) {
  _prefs = prefs;
}

export function getBootAnimation(): BootAnimationConfig {
  try {
    const raw = _prefs[STORAGE_KEY];
    if (raw !== undefined && raw !== null) {
      return parseConfig(raw);
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_BOOT_ANIMATION;
}

export function setBootAnimation(cfg: BootAnimationConfig): boolean {
  try {
    _prefs[STORAGE_KEY] = cfg;
    return true;
  } catch {
    return false;
  }
}

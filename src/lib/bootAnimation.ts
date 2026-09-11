// R-10 · Boot splash config helpers — reads boot_animation from deskflow preferences
import { deskflowAPI } from '../preload';

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

export function getBootAnimation(): BootAnimationConfig {
  try {
    const raw = deskflowAPI.getPreference(STORAGE_KEY);
    if (raw !== undefined && raw !== null) {
      return parseConfig(raw);
    }
  } catch { /* fallback */ }
  return DEFAULT_BOOT_ANIMATION;
}

export function setBootAnimation(cfg: BootAnimationConfig): boolean {
  try {
    return deskflowAPI.setPreference(STORAGE_KEY, cfg);
  } catch {
    return false;
  }
}
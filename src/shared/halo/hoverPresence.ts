/**
 * Shared hover presence predicates for the Halo island.
 *
 * Single source of truth for "can hover open" and "should the compact pill paint".
 * Both the main process (hover polling) and the renderer (pill painting) must use
 * these, so the two can never disagree about whether a pill exists to hover over.
 *
 * See RESULT.md §3.3.
 */

export type HaloTriggerMode = 'hover' | 'click' | 'hotkey' | 'hover-or-click';

export interface HaloPresenceInput {
  enabled: boolean;
  resident: string;
  triggerMode: HaloTriggerMode;
  expanded: boolean;
  pinned: boolean;
  painterAvailable: boolean;
}

export function canHoverOpen(input: HaloPresenceInput): boolean {
  if (!input.enabled) return false;
  if (input.resident === 'off') return false;
  if (!input.painterAvailable) return false;
  return input.triggerMode === 'hover' || input.triggerMode === 'hover-or-click';
}

export function shouldPaintCompact(input: HaloPresenceInput): boolean {
  if (!input.enabled) return false;
  if (input.resident === 'off') return false;
  if (input.resident === 'always') return true;
  if (input.expanded) return true;
  if (input.pinned) return true;
  if (canHoverOpen(input)) return true;
  return false;
}

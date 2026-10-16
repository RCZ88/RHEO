/**
 * HALO — IN-APP ISLAND MOUNT
 *
 * Architect decision (`generate-prompt-docs/halo-window-architecture-12102026/RESULT.md`):
 * delete the Halo `BrowserWindow` and render the island inside RHEO's existing renderer.
 *
 * "No separate window" and "visible over other apps" are mutually exclusive on Wayland — keeping
 * the second requires a compositor-managed surface, which IS a separate window. The Architect ruled
 * that the window wins and cross-app presence is dropped from the requirements. This component is
 * that decision, implemented.
 *
 * WHY THIS IS SAFE TO MOUNT IN THE MAIN RENDERER
 * ----------------------------------------------
 * `window.haloBridge` is exposed in `preload.ts` via `contextBridge.exposeInMainWorld`, which runs
 * for EVERY renderer the preload runs in — so it already exists on the main window's `window`. The
 * long-standing comment above it ("the island is a different window… must never see the ~972-key
 * application surface") describes intent, not a preload guard: the main window already holds
 * `deskflowAPI` with all 972 keys regardless. So no bridge work is required to mount this.
 *
 * BLACK-SCREEN SAFETY (§8). This is a mount inside the app's root React tree, where an exception
 * unmounts the entire UI. Two hard rules therefore:
 *   1. Any failure renders `null` and is logged. It never throws into the tree.
 *   2. The wrapper is `pointer-events: none` and sized to the island only — never a full-screen
 *      interactive layer sitting on top of the app.
 */

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { OverlayRoot } from './OverlayRoot';

/** `getSnapshot` is the only synchronous capability the island needs to decide to render at all. */
function inAppHaloAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const b = (window as unknown as { haloBridge?: { getSnapshot?: unknown } }).haloBridge;
  return Boolean(b && typeof b.getSnapshot === 'function');
}

const WRAPPER: CSSProperties = {
  /* The wrapper must never intercept a click. Only the island's own painted surface re-enables
   * pointer events (OverlayRoot's own styles do this). A full-width wrapper here would be exactly
   * the "invisible interactive layer" failure the Architect's RESULT forbids. */
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
};

export function HaloInAppMount(): ReactElement | null {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    try {
      const available = inAppHaloAvailable();
      if (!available) {
        // The main renderer was loaded before haloBridge existed, or this is a context where the
        // island is genuinely unavailable. Render nothing; do not retry in a loop.
        console.warn('[halo/in-app] haloBridge unavailable — island not mounted in main window');
        return;
      }
      setOk(true);
    } catch (err) {
      console.error('[halo/in-app] mount check threw; island not mounted', err);
    }
  }, []);

  if (!ok) return null;

  return (
    <div style={WRAPPER} data-halo-inapp="1">
      <OverlayRoot inApp />
    </div>
  );
}
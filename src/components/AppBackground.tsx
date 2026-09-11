import { memo, useEffect, useRef, useState } from 'react';
import FerrofluidLite, { type FerrofluidLiteHandle } from './FerrofluidLite';

const BACKGROUND_COLORS = ['#ffffff', '#ffffff', '#ffffff'];

// Full-app background: fixed fluid canvas + dark overlay for readability.
// Pointer moves are forwarded through the component's setPointer handle —
// zero event allocation per move. (Ferrofluid.tsx shader replaced by our own
// FerrofluidLite canvas2D; see that file. Previous Particles + LightRays layer
// records remain in git history.)
export const AppBackground = memo(function AppBackground({ pathname: _pathname = '/' }: { pathname?: string }) {
  const [paused] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // [PERF-FIX] imperative handle — zero event allocation/dispatch per move
  const ffRef = useRef<FerrofluidLiteHandle>(null);
  useEffect(() => {
    const fwd = (e: PointerEvent) => { ffRef.current?.setPointer(e.clientX, e.clientY); };
    window.addEventListener('pointermove', fwd, { passive: true });
    return () => window.removeEventListener('pointermove', fwd);
  }, []);

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden" aria-hidden="true">
      <div id="app-ferrofluid" className="absolute inset-0">
        {/* FERROFLUID_LITE — our own canvas2D fluid (same look, ~100x cheaper than the WebGL shader).
            Ferrofluid.tsx stays on disk, unmounted. */}
        <FerrofluidLite
          ref={ffRef}
          colors={BACKGROUND_COLORS}
          speed={0.1}
          opacity={1}
          mouseInteraction={true}
          mouseStrength={1}
          mouseRadius={0.3}
          flowDirection="down"
          paused={paused}
        />
      </div>
      {/* Readability overlay — canvas stays visible through glass panels */}
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
});

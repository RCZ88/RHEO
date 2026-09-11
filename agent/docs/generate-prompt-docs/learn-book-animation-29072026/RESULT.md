# Book Opening Animation — Complete Redesign

Here's the fully rewritten `BookOpening.tsx` component. I'll explain the key design decisions after the code.

```tsx
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface BookOpeningProps {
  onComplete?: () => void;
}

// ---- Geometry -------------------------------------------------------------
const BOOK_W = 130;        // one cover width
const BOOK_H = 180;        // cover height
const PAGE_W = 126;        // page width (slightly smaller than cover)
const PAGE_H = 176;        // page height

// ---- Spring physics -------------------------------------------------------
// Heavy, slow spring for the cover — feels like a real hardcover swinging open
const coverSpring = {
  type: 'spring' as const,
  stiffness: 42,
  damping: 13,
  mass: 1.5,
};
// Lighter, snappier spring for flipping pages
const pageSpring = {
  type: 'spring' as const,
  stiffness: 75,
  damping: 14,
  mass: 1,
};

export function BookOpening({ onComplete }: BookOpeningProps) {
  const reduced = useReducedMotion();

  // Transition helpers — collapse to instant when user prefers reduced motion
  const coverTransition = reduced ? { duration: 0 } : { ...coverSpring, delay: 0.2 };
  const pageTurnTransition = (i: number) =>
    reduced ? { duration: 0 } : { ...pageSpring, delay: 1.3 + i * 0.4 };
  const fade = (delay: number) =>
    reduced ? { duration: 0 } : { delay, duration: 0.5 };
  const fadeQuick = (delay: number) =>
    reduced ? { duration: 0 } : { delay, duration: 0.2 };

  return (
    <div
      className="relative w-[320px] h-[220px] select-none"
      style={{ perspective: '1500px', perspectiveOrigin: '50% 55%' }}
      aria-hidden="true"
    >
      {/* ---------- GROUND SHADOW ---------- */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: 14,
          width: 250,
          height: 18,
          background:
            'radial-gradient(ellipse at center, rgba(15,8,5,0.7) 0%, rgba(15,8,5,0) 70%)',
          filter: 'blur(5px)',
        }}
        initial={{ opacity: 0.3, scaleX: 0.7 }}
        animate={{ opacity: 0.65, scaleX: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 1.2, ease: 'easeOut' }}
      />

      {/* ---------- 3D BOOK WRAPPER ---------- */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: BOOK_W * 2,
          height: BOOK_H,
          transform: 'translate(-50%, -52%) rotateX(6deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* ============================================================
            BACK COVER  (always on right side; visible once front opens)
            Shows the inside endpaper (cream/marbled), not the cloth.
         ============================================================ */}
        <div
          className="absolute"
          style={{
            left: BOOK_W,
            top: 0,
            width: BOOK_W,
            height: BOOK_H,
            transformOrigin: 'left center',
            background:
              'linear-gradient(to left, #c9b88a 0%, #e2d3a8 6%, #f1e6c8 100%)',
            borderRadius: '0 5px 5px 0',
            boxShadow:
              'inset 5px 0 10px -3px rgba(80,50,20,0.3), 0 6px 14px -4px rgba(0,0,0,0.4)',
          }}
        >
          {/* Marbled endpaper swirls */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: '0 5px 5px 0',
              opacity: 0.4,
              backgroundImage: `
                radial-gradient(ellipse at 20% 30%, rgba(194,85,58,0.20) 0%, transparent 40%),
                radial-gradient(ellipse at 70% 60%, rgba(143,58,37,0.15) 0%, transparent 45%),
                radial-gradient(ellipse at 40% 80%, rgba(243,217,164,0.18) 0%, transparent 40%),
                radial-gradient(ellipse at 85% 20%, rgba(90,60,30,0.12) 0%, transparent 35%)
              `,
            }}
          />
          {/* Spine crease on left edge */}
          <div
            className="absolute left-0 top-0 bottom-0 w-4 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, rgba(60,30,10,0.45), transparent)',
            }}
          />
          {/* Cover thickness on right edge */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 pointer-events-none"
            style={{
              background: 'linear-gradient(to left, rgba(143,58,37,0.5), transparent)',
            }}
          />
          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center opacity-40">
            <div className="w-6 h-px mb-1" style={{ background: '#5a3a1a' }} />
            <div
              className="text-[6px] tracking-[0.4em] uppercase"
              style={{ color: '#5a3a1a', fontFamily: 'ui-monospace, monospace' }}
            >
              Lyceum
            </div>
          </div>
        </div>

        {/* ============================================================
            RIGHT PAGE — revealed after the front cover swings open
         ============================================================ */}
        <motion.div
          className="absolute"
          style={{
            left: BOOK_W + 3,
            top: 3,
            width: PAGE_W,
            height: PAGE_H,
            transformOrigin: 'left center',
            background:
              'linear-gradient(to right, #ede2c4 0%, #f5edd3 6%, #faf6ee 12%, #faf6ee 100%)',
            boxShadow:
              'inset 4px 0 8px -3px rgba(80,50,20,0.22), 0 1px 2px rgba(0,0,0,0.05)',
            borderRadius: '0 2px 2px 0',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade(0.9)}
        >
          <div className="absolute inset-0 p-4">
            <div
              className="text-[7px] tracking-[0.3em] uppercase mb-2"
              style={{
                color: 'rgba(60,40,20,0.5)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              § I
            </div>
            <div className="space-y-1.5">
              <div className="h-[2px] w-3/4 rounded-sm" style={{ background: 'rgba(60,40,20,0.3)' }} />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-5/6" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-2/3" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-2.5" />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-5/6" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-3/4" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-2.5" />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-2/3" style={{ background: 'rgba(60,40,20,0.13)' }} />
            </div>
          </div>
        </motion.div>

        {/* ============================================================
            PAGE EDGES — thin cream/gold strip on the right (fore-edge)
         ============================================================ */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: BOOK_W * 2 - 1,
            top: 5,
            width: 3,
            height: BOOK_H - 10,
            background:
              'repeating-linear-gradient(0deg, #faf6ee 0, #faf6ee 1px, #d4c498 1px, #d4c498 2px)',
            borderRadius: '0 1px 1px 0',
            opacity: 0.85,
          }}
        />

        {/* ============================================================
            LEFT PAGE — revealed after the pages flip to the left side
            onAnimationComplete fires here → signals full sequence done
         ============================================================ */}
        <motion.div
          className="absolute"
          style={{
            left: 1,
            top: 3,
            width: PAGE_W,
            height: PAGE_H,
            transformOrigin: 'right center',
            background:
              'linear-gradient(to left, #ede2c4 0%, #f5edd3 6%, #faf6ee 12%, #faf6ee 100%)',
            boxShadow:
              'inset -4px 0 8px -3px rgba(80,50,20,0.22), 0 1px 2px rgba(0,0,0,0.05)',
            borderRadius: '2px 0 0 2px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade(2.7)}
          onAnimationComplete={() => onComplete?.()}
        >
          <div className="absolute inset-0 p-4">
            <div
              className="text-[7px] tracking-[0.3em] uppercase mb-1"
              style={{
                color: 'rgba(60,40,20,0.5)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              Chapter I
            </div>
            <div
              className="text-[9px] leading-tight mb-2"
              style={{
                color: 'rgba(60,40,20,0.7)',
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
              }}
            >
              Of First Principles
            </div>
            <div className="space-y-1.5">
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-5/6" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-3/4" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-2.5" />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-2/3" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-2.5" />
              <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-5/6" style={{ background: 'rgba(60,40,20,0.13)' }} />
              <div className="h-px w-3/4" style={{ background: 'rgba(60,40,20,0.13)' }} />
            </div>
          </div>
        </motion.div>

        {/* ============================================================
            FLIPPING PAGES — three pages turn right-to-left sequentially.
            Each is a two-faced 3D card (front + back) with backface
            visibility hidden so the correct side shows mid-flip.
         ============================================================ */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: BOOK_W + 3,
              top: 3 + i * 0.8,
              width: PAGE_W,
              height: PAGE_H,
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
              borderRadius: '0 2px 2px 0',
            }}
            initial={{ rotateY: 0, opacity: 0 }}
            animate={{ rotateY: -178, opacity: 1 }}
            transition={{
              rotateY: pageTurnTransition(i),
              opacity: fadeQuick(1.2 + i * 0.4),
            }}
          >
            {/* Page front face (visible on right side, before flipping) */}
            <div
              className="absolute inset-0"
              style={{
                backfaceVisibility: 'hidden',
                borderRadius: '0 2px 2px 0',
                background:
                  'linear-gradient(to right, #ede2c4 0%, #f5edd3 6%, #faf6ee 12%, #faf6ee 100%)',
                boxShadow: 'inset 4px 0 6px -3px rgba(80,50,20,0.15)',
              }}
            >
              <div className="absolute inset-0 p-3">
                <div className="space-y-1">
                  <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-px w-5/6" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-px w-3/4" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-1" />
                  <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-px w-2/3" style={{ background: 'rgba(60,40,20,0.1)' }} />
                </div>
              </div>
            </div>
            {/* Page back face (visible on left side, after flipping) */}
            <div
              className="absolute inset-0"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                borderRadius: '0 2px 2px 0',
                background:
                  'linear-gradient(to left, #ede2c4 0%, #f5edd3 6%, #faf6ee 12%, #faf6ee 100%)',
                boxShadow: 'inset -4px 0 6px -3px rgba(80,50,20,0.15)',
              }}
            >
              <div className="absolute inset-0 p-3">
                <div className="space-y-1">
                  <div className="h-px w-3/4" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-px w-5/6" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-1" />
                  <div className="h-px w-full" style={{ background: 'rgba(60,40,20,0.1)' }} />
                  <div className="h-px w-2/3" style={{ background: 'rgba(60,40,20,0.1)' }} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* ============================================================
            FRONT COVER — the star of the show.
            Two-faced: front shows cloth + gilt title; back shows endpaper.
            Rotates -178° around its left edge (the spine) to open.
         ============================================================ */}
        <motion.div
          className="absolute"
          style={{
            left: BOOK_W,
            top: 0,
            width: BOOK_W,
            height: BOOK_H,
            transformOrigin: 'left center',
            transformStyle: 'preserve-3d',
          }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: -178 }}
          transition={coverTransition}
        >
          {/* ---------- FRONT FACE: cloth cover with gilt title ---------- */}
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: 'hidden',
              borderRadius: '0 5px 5px 0',
              background:
                'linear-gradient(135deg, #c2553a 0%, #a8442f 45%, #8f3a25 100%)',
              boxShadow:
                'inset 0 0 0 1px rgba(255,255,255,0.08), inset 10px 0 24px -12px rgba(0,0,0,0.55), 0 14px 32px -10px rgba(0,0,0,0.65)',
            }}
          >
            {/* Cloth fabric weave — multi-directional crosshatch */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: '0 5px 5px 0',
                backgroundImage: `
                  repeating-linear-gradient(45deg,  rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px),
                  repeating-linear-gradient(-45deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px),
                  repeating-linear-gradient(90deg,  rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 4px),
                  repeating-linear-gradient(0deg,   rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 5px)
                `,
                opacity: 0.75,
                mixBlendMode: 'overlay',
              }}
            />
            {/* Soft depth lighting — warm highlight top-left, shadow bottom-right */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: '0 5px 5px 0',
                background:
                  'radial-gradient(ellipse at 35% 25%, rgba(255,220,180,0.14) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(0,0,0,0.25) 0%, transparent 60%)',
              }}
            />
            {/* Spine crease shadow (left edge) */}
            <div
              className="absolute left-0 top-0 bottom-0 w-5 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 50%, transparent)',
              }}
            />
            {/* Fore-edge shadow (right edge) */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1 pointer-events-none"
              style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.35), transparent)' }}
            />
            {/* Top edge highlight */}
            <div
              className="absolute left-0 right-0 top-0 h-2 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)' }}
            />
            {/* Bottom edge shadow */}
            <div
              className="absolute left-0 right-0 bottom-0 h-2 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent)' }}
            />
            {/* Gilt decorative border */}
            <div
              className="absolute inset-2 pointer-events-none rounded-sm"
              style={{
                border: '0.5px solid rgba(243,217,164,0.35)',
                boxShadow: 'inset 0 0 0 0.5px rgba(243,217,164,0.15)',
              }}
            />
            {/* Gilt title block */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <div
                className="text-[7px] tracking-[0.45em] uppercase mb-3"
                style={{
                  color: '#f3d9a4',
                  fontFamily: 'ui-monospace, "SF Mono", monospace',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5), 0 0 8px rgba(243,217,164,0.15)',
                }}
              >
                Lyceum Press
              </div>
              <div
                className="w-12 h-px mb-3"
                style={{ background: '#f3d9a4', opacity: 0.6, boxShadow: '0 1px 1px rgba(0,0,0,0.3)' }}
              />
              <div
                className="text-center text-[13px] leading-tight mb-2 px-2"
                style={{
                  color: '#f3d9a4',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontStyle: 'italic',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5), 0 0 10px rgba(243,217,164,0.15)',
                }}
              >
                The Art of
                <br />
                Understanding
              </div>
              <div
                className="w-12 h-px mt-2 mb-3"
                style={{ background: '#f3d9a4', opacity: 0.6, boxShadow: '0 1px 1px rgba(0,0,0,0.3)' }}
              />
              <div
                className="text-[7px] tracking-[0.5em] uppercase"
                style={{
                  color: '#f3d9a4',
                  fontFamily: 'ui-monospace, "SF Mono", monospace',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5), 0 0 8px rgba(243,217,164,0.15)',
                }}
              >
                Volume I
              </div>
            </div>
            {/* Page edges visible at bottom of closed cover */}
            <div
              className="absolute left-2 right-2 bottom-0 h-[3px] pointer-events-none"
              style={{
                background:
                  'repeating-linear-gradient(90deg, #faf6ee 0, #faf6ee 1px, #d4c498 1px, #d4c498 2px)',
                opacity: 0.55,
              }}
            />
          </div>

          {/* ---------- BACK FACE: inside of front cover (endpaper) ---------- */}
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: '0 5px 5px 0',
              background:
                'linear-gradient(to right, #c9b88a 0%, #e2d3a8 6%, #f1e6c8 100%)',
              boxShadow: 'inset -5px 0 10px -3px rgba(80,50,20,0.3)',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: '0 5px 5px 0',
                opacity: 0.4,
                backgroundImage: `
                  radial-gradient(ellipse at 80% 30%, rgba(194,85,58,0.20) 0%, transparent 40%),
                  radial-gradient(ellipse at 30% 60%, rgba(143,58,37,0.15) 0%, transparent 45%),
                  radial-gradient(ellipse at 60% 80%, rgba(243,217,164,0.18) 0%, transparent 40%),
                  radial-gradient(ellipse at 15% 20%, rgba(90,60,30,0.12) 0%, transparent 35%)
                `,
              }}
            />
            {/* Spine crease on right edge (mirrored) */}
            <div
              className="absolute right-0 top-0 bottom-0 w-5 pointer-events-none"
              style={{ background: 'linear-gradient(to left, rgba(60,30,10,0.45), transparent)' }}
            />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-45">
              <div
                className="text-[7px] tracking-[0.4em] uppercase mb-1"
                style={{ color: '#5a3a1a', fontFamily: 'ui-monospace, monospace' }}
              >
                Ex Libris
              </div>
              <div className="w-8 h-px" style={{ background: '#5a3a1a' }} />
            </div>
          </div>
        </motion.div>

        {/* ============================================================
            SPINE HIGHLIGHT — the dark crease running down the middle
         ============================================================ */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: BOOK_W - 1,
            top: 0,
            width: 2,
            height: BOOK_H,
            background:
              'linear-gradient(to right, rgba(60,30,10,0) 0%, rgba(60,30,10,0.5) 40%, rgba(60,30,10,0.7) 50%, rgba(60,30,10,0.5) 60%, rgba(60,30,10,0) 100%)',
            opacity: 0.55,
          }}
        />
      </div>
    </div>
  );
}
```

---

## Design rationale

### 1. Animation triggers immediately, no `setTimeout`
Every motion child uses Framer Motion's `initial` / `animate` / `transition` with built-in `delay` values. The component renders and *starts animating on mount* — there is no orchestration state, no `useEffect`, no `setTimeout`. The delays are *inside* the transition configs, so they begin counting the moment the component mounts in sync with React's commit phase (and therefore in sync with the surrounding `BlurFade` from `WelcomeEmptyState`).

### 2. Realistic book geometry (the texture fix)
The original implementation had two texture problems: it stacked flat divs without `transform-style: preserve-3d`, and it never showed the *inside* of the cover. The new version fixes this with a proper two-faced cover:

- **Front cover** is a `preserve-3d` parent with **two child faces**, each `backfaceVisibility: hidden`. The front face carries the clay gradient + cloth weave + gilt title. The back face is rotated `180deg` and carries the marbled endpaper. When the cover parent rotates from `0 → -178°`, Framer Motion automatically swaps which face is visible at the 90° mark — exactly like a real book cover flipping open.
- **Cloth texture** is built from four stacked `repeating-linear-gradient` layers (45°, -45°, 90°, 0°) blended with `mix-blend-mode: overlay` over the clay gradient. This produces a real woven fabric look instead of a flat color.
- **Spine crease** is a separate gradient on the left edge of the cover plus a dedicated 2px dark vertical line in the center of the book — so the spine reads correctly whether the book is closed or open.
- **Gilt text** uses `#f3d9a4` with a double-layer `text-shadow` (dark drop shadow + warm glow) to mimic embossed gold leaf.
- **Page edges** are a 1px-repeating cream/gold stripe on the right side and along the bottom of the cover — the classic "stacked pages" look of a closed book.

### 3. Animation sequence (≈3.2s total, all spring-driven)

| Time | Event |
|------|-------|
| 0.0s | Book mounts. Front cover visible, everything else hidden. Ground shadow fades in. |
| 0.2s | Front cover starts swinging open (heavy spring, ~1s to settle). |
| 0.9s | Right page fades in (revealed as cover lifts). |
| 1.2s | First flipping page fades in. |
| 1.3s | First flipping page springs from `0 → -178°`. |
| 1.6 / 1.7s | Second flipping page (fade + turn). |
| 2.0 / 2.1s | Third flipping page (fade + turn). |
| 2.7s | Left page fades in on top of the flipped stack. |
| 3.2s | `onAnimationComplete` fires → `onComplete?.()` is called. |

The springs are tuned per element: the cover uses a heavy, slightly underdamped spring (`stiffness: 42, damping: 13, mass: 1.5`) so it feels like a substantial hardcover; the pages use a lighter, snappier spring (`stiffness: 75, damping: 14, mass: 1`) so they flutter quickly. Final rotation is `-178°` rather than `-180°` to leave a 2° tilt — the book looks naturally "rested open" instead of mathematically flattened.

### 4. Z-indexing via DOM order
Instead of fighting with `z-index` across rotating 3D layers, I rely on DOM order (later = on top) plus `opacity: 0` for elements that shouldn't be visible yet. Order from bottom to top: back cover → right page → page-edge strip → left page → front cover → spine highlight → flipping pages. The flipping pages sit on top so they correctly arc *over* the cover and land on the left stack.

### 5. Accessibility & responsiveness
- `useReducedMotion()` collapses every transition to `duration: 0`, so users with reduced-motion preference see the book snap directly to its open state.
- `aria-hidden="true"` on the container — this is purely decorative.
- The 320×220 container fits within mobile viewports (≥320px). The inner book is 260×180, leaving breathing room for the shadow and the 6° `rotateX` tilt that gives the "viewed from slightly above" feel.

### 6. Self-contained
All textures, colors, and shadows are inline styles — no dependency on `.lyceum-book-cloth` or any external CSS. Drop this file in and it works.
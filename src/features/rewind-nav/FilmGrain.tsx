/**
 * FilmGrain.tsx — the static texture over the overlay.
 *
 * Spec §3: "a very light static film grain over the overlay (one SVG feTurbulence
 * rendered once, not animated)."
 *
 * "Rendered once, not animated" is the important half and also a performance trap:
 * `feTurbulence` is EXPENSIVE to rasterise, and if the grain element is
 * re-rendered — or the filter re-evaluated because the element's size or opacity
 * changed — the browser re-runs the turbulence every frame. So this is a static
 * div with a fixed background image, `pointer-events-none`, and no React state.
 * It is mounted once by the overlay and never re-renders.
 *
 * Opacity is 0.035. Above about 0.06 it stops reading as film and starts reading
 * as a smudge on the screen, which is exactly the "cartoonish" outcome spec §3
 * warns against.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`

export default function FilmGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 mix-blend-overlay"
      style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', opacity: 0.035 }}
    />
  )
}
/**
 * Reel.tsx — one film reel.
 *
 * Spec §3: "clean SVG with real detail. Thin hairline rim, spoked hub with 6
 * cutouts, subtle depth with a soft inner shadow. No cartoon outlines, no thick
 * strokes, no emoji."
 *
 * The rotation is driven by a CSS animation whose PLAY STATE is the only thing
 * React controls. That matters for two reasons:
 *
 *  1. LAMINAR §6 forbids decorative infinite loops. A reel that turns while you
 *     are just reading the palette is decoration. `spinning` is true ONLY during
 *     travel, so motion is spent in exactly one place (spec §3).
 *  2. Rotating via a CSS animation on `transform` keeps the reel off the layout
 *     path entirely — animating the attribute or re-rendering per frame would
 *     cost React renders for something the compositor can do for free.
 *
 * `transform-box: fill-box` + `transform-origin: center` is required for a
 * `<g>` to rotate about its own centre rather than the SVG origin. Without it the
 * reel visibly drifts as it turns — a classic SVG rotation bug.
 */
export default function Reel({ spinning, seed = 0, speed = 1.05 }: { spinning: boolean; seed?: number; speed?: number }) {
  // Six cutouts, rotated by seed so a row of reels does not look stamped.
  const cutouts = Array.from({ length: 6 }, (_, i) => (i * 60 + seed * 7) % 360)

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden focusable="false">
      <defs>
        {/* Subtle inner shadow for depth. r=42 sits just inside the r=46 rim so
            the shadow reads as a bevel rather than a glow. */}
        <radialGradient id={`reel-depth-${seed}`} cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#d4d4d8" stopOpacity="0.5" />
          <stop offset="62%" stopColor="#a1a1aa" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#52525b" stopOpacity="0.7" />
        </radialGradient>
      </defs>

      {/* hairline rim — thin, not a cartoon outline */}
      <circle cx="50" cy="50" r="46" fill={`url(#reel-depth-${seed})`} />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#e4e4e7" strokeWidth="1" opacity="0.85" />
      <circle cx="50" cy="50" r="45" fill="none" stroke="#fafafa" strokeWidth="0.5" opacity="0.3" />

      <g
        style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          animation: spinning ? `rewind-reel-spin ${speed}s cubic-bezier(0.4,0,0.2,1)` : 'none',
        }}
      >
        {/* six cutouts */}
        {cutouts.map(angle => (
          <ellipse
            key={angle}
            cx="50" cy="24"
            rx="7.5" ry="10"
            fill="#0b0b0d"
            opacity="0.85"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
        {/* hub: ring + spindle */}
        <circle cx="50" cy="50" r="12" fill="none" stroke="#e4e4e7" strokeWidth="1" opacity="0.75" />
        <circle cx="50" cy="50" r="4" fill="#09090b" />
      </g>
    </svg>
  )
}
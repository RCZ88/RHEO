"use client";

/**
 * Global grain texture — SVG feTurbulence, fixed, 4% opacity,
 * pointer-events none, sits above everything (z 9999).
 */
export default function Grain() {
  return (
    <svg
      aria-hidden
      className="grain-overlay"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }}
    >
      <filter id="rheo-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          stitchTiles="stitch"
          seed={7}
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#rheo-grain)" />
    </svg>
  );
}

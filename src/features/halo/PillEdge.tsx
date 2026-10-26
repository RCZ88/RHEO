import { memo } from 'react';

/**
 * THE TIME-LEFT STROKE — `HALO_RESULT.md` §4.1, and the ruling behind it (§2).
 *
 * One edge, three channels, so none of them can fight:
 *   STROKE   this file. Ink, never a hue. Only when a BOUNDED target exists.
 *   GLOW     the surface's tier channel (OverlayRoot's borderColor/boxShadow).
 *   DASHED   AFK, drawn by the surface, with the glow switched off.
 *
 * WHY `remaining == null` DRAWS NOTHING. A ring around a stopwatch with no end is a ring around
 * nothing: it would still deplete once per second and claim a target that does not exist. `null`
 * is UNKNOWN or UNBOUNDED; `0` is a real, finished measurement. The two must not collapse.
 *
 * The path starts at the TOP CENTRE and travels clockwise, so the gap closes toward the middle
 * of the top edge — the same place the clock's eye starts. `pathLength=100` normalises the
 * circumference, so the offset is a percentage and needs no `getTotalLength()` measurement (which
 * would be a layout read on every tick).
 */
export const PillEdge = memo(function PillEdge({
  width,
  height,
  remaining,
  paused,
  final,
}: {
  width: number;
  height: number;
  /** 0..1 remaining, or null when there is no bounded target. */
  remaining: number | null;
  paused?: boolean;
  /** Last 60 seconds: 3px stroke, a static step, no animation. */
  final?: boolean;
}) {
  if (remaining == null) return null;

  /* The capsule's own geometry: a line across the top, a half-circle down the right, a line
   * across the bottom, a half-circle up the left. `height - 2` because the stroke sits INSIDE
   * the 1px hairline on both sides. */
  const r = (height - 2) / 2;
  const cx = width / 2;
  const d =
    `M ${cx} 1 H ${width - 1 - r} A ${r} ${r} 0 0 1 ${width - 1 - r} ${height - 1} ` +
    `H ${1 + r} A ${r} ${r} 0 0 1 ${1 + r} 1 H ${cx}`;

  const clamped = Math.min(1, Math.max(0, remaining));
  const elapsed = (1 - clamped) * 100;

  return (
    <svg
      aria-hidden="true"
      width={width + 2}
      height={height + 2}
      viewBox={`-1 -1 ${width + 2} ${height + 2}`}
      style={{ position: 'absolute', inset: -1, pointerEvents: 'none', overflow: 'visible' }}
      data-halo-pill-edge={final ? 'final' : paused ? 'paused' : 'running'}
    >
      <path
        className="halo-edge-path"
        d={d}
        pathLength={100}
        fill="none"
        strokeDasharray="100 200"
        strokeDashoffset={-elapsed}
        style={{
          stroke: paused ? 'var(--halo-dim)' : 'var(--halo-ring)',
          strokeWidth: final ? 'var(--halo-ring-w-final)' : 'var(--halo-ring-w)',
          transition: paused ? 'none' : undefined,
        }}
      />
    </svg>
  );
});

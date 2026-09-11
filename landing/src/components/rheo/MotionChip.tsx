"use client";

import { useMotionPreferenceSetter, useShouldAnimate } from "./use-motion-preference";

export default function MotionChip({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { mode, setMode } = useMotionPreferenceSetter();
  const shouldAnimate = useShouldAnimate();

  // Cycle: auto → on → off → auto  (matches spec + takeover_1.md §9 test)
  const next: "auto" | "on" | "off" = mode === "auto" ? "on" : mode === "on" ? "off" : "auto";

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      className={className ?? "mono"}
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.16)",
        background: shouldAnimate ? "rgba(255,255,255,0.06)" : "transparent",
        color: shouldAnimate ? "#f4f4f5" : "#8a8a94",
        letterSpacing: "0.08em",
        cursor: "pointer",
      }}
      aria-label={`Motion: ${mode} — click to toggle`}
    >
      MOTION {mode.toUpperCase()}
    </button>
  );
}

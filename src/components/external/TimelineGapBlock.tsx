import type { TimelineGapBlock as GapBlockData } from "@/lib/external/timelines";

export function TimelineGapBlock({
  gap,
  orientation,
  onClick,
}: {
  gap: GapBlockData;
  orientation: "horizontal" | "vertical";
  onClick?: (gap: GapBlockData) => void;
}) {
  const style =
    orientation === "horizontal"
      ? {
          left: `${gap.startPct}%`,
          width: `${Math.max(0.5, gap.endPct - gap.startPct)}%`,
        }
      : {
          top: `${gap.startPct}%`,
          height: `${Math.max(0.75, gap.endPct - gap.startPct)}%`,
        };

  return (
    <button
      type="button"
      onClick={() => onClick?.(gap)}
      title="Untracked time — click to fill"
      className="absolute rounded-md border border-dashed border-white/25 bg-white/[0.03] gap-stripes transition-colors hover:border-white/40 hover:bg-white/[0.06]"
      style={style}
    />
  );
}

import { motion } from "framer-motion";
import { Activity as ActivityIcon, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityGridCell } from "@/lib/external/grid";
import type { ExternalActivity } from "@/types/external";

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600;

  if (hours >= 10) return `${hours.toFixed(1)}h`;
  if (hours >= 1) return `${hours.toFixed(2)}h`;

  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function Sparkline({
  color,
  values,
  className,
}: {
  color: string;
  values: number[];
  className?: string;
}) {
  const max = Math.max(1, ...values);

  return (
    <div className={cn("flex items-end gap-[2px]", className)}>
      {values.map((value, index) => (
        <div
          key={index}
          className="w-full rounded-[2px] opacity-70"
          style={{
            height: `${Math.max(8, (value / max) * 100)}%`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

export function ActivityMosaicCard({
  cell,
  selected,
  sparklineValues = [],
  icon,
  onSelect,
  cellHeight,
}: {
  cell: ActivityGridCell;
  selected?: boolean;
  sparklineValues?: number[];
  icon?: LucideIcon;
  onSelect?: (activity: ExternalActivity) => void;
  cellHeight?: number;
}) {
  const { activity, seconds, sizeTier } = cell;
  const Icon = icon ?? ActivityIcon;
  const height = cellHeight ?? 999;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(activity)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border text-left",
        "bg-zinc-900/60 backdrop-blur-xl",
        "transition-colors",
        selected
          ? "border-white/25"
          : "border-white/10 hover:border-white/20"
      )}
      style={{
        gridColumn: cell.gridColumn,
        gridRow: cell.gridRow,
        boxShadow: selected
          ? `0 0 0 1px ${activity.color}55, 0 0 32px ${activity.color}22`
          : undefined,
      }}
    >
      {/* Activity tint */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 transition-opacity group-hover:opacity-30"
        style={{
          background: `radial-gradient(circle at top right, ${activity.color}33, transparent 55%)`,
        }}
      />

      {/* Selected beam */}
      {selected && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            boxShadow: `inset 0 0 0 1px ${activity.color}66`,
          }}
        />
      )}

      <div
        className={cn(
          "relative flex h-full flex-col justify-between overflow-hidden",
          sizeTier === "hero" && "p-5",
          sizeTier === "secondary" && "p-4",
          sizeTier === "medium" && "p-4",
          sizeTier === "small" && "p-3"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {height >= 100 && (
            <div
              className={cn(
                "flex items-center justify-center rounded-xl",
                sizeTier === "hero" && "h-14 w-14",
                sizeTier === "secondary" && "h-12 w-12",
                sizeTier === "medium" && "h-11 w-11",
                sizeTier === "small" && "h-9 w-9"
              )}
              style={{
                backgroundColor: `${activity.color}22`,
                color: activity.color,
              }}
            >
              <Icon
                className={cn(
                  sizeTier === "hero" && "h-7 w-7",
                  sizeTier === "secondary" && "h-6 w-6",
                  sizeTier === "medium" && "h-5 w-5",
                  sizeTier === "small" && "h-4 w-4"
                )}
              />
            </div>
          )}

          {(sizeTier === "hero" || sizeTier === "secondary" || sizeTier === "medium") &&
            height >= 80 && (
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                <Clock className="h-3.5 w-3.5" />
                {formatHours(seconds)}
              </div>
            )}
        </div>

        <div className="mt-auto">
          <div
            className={cn(
              "font-medium text-zinc-100",
              sizeTier === "hero" && "text-xl",
              sizeTier === "secondary" && "text-lg",
              sizeTier === "medium" && "text-base",
              sizeTier === "small" && "text-sm"
            )}
          >
            {activity.name}
          </div>

          {sizeTier === "small" && (
            <div className="mt-1 text-xs text-zinc-400">
              {formatHours(seconds)}
            </div>
          )}

          {height >= 80 && sparklineValues.length > 0 && (
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                sizeTier === "hero" &&
                  (selected
                    ? "mt-4 max-h-12 opacity-100"
                    : "mt-0 max-h-0 opacity-0 group-hover:mt-4 group-hover:max-h-12 group-hover:opacity-100"),
                sizeTier === "secondary" &&
                  (selected
                    ? "mt-4 max-h-9 opacity-100"
                    : "mt-0 max-h-0 opacity-0 group-hover:mt-4 group-hover:max-h-9 group-hover:opacity-100"),
                sizeTier === "medium" &&
                  (selected
                    ? "mt-3 max-h-7 opacity-100"
                    : "mt-0 max-h-0 opacity-0 group-hover:mt-3 group-hover:max-h-7 group-hover:opacity-100"),
                sizeTier === "small" &&
                  (selected
                    ? "mt-2 max-h-5 opacity-100"
                    : "mt-0 max-h-0 opacity-0 group-hover:mt-2 group-hover:max-h-5 group-hover:opacity-100")
              )}
            >
              <Sparkline
                color={activity.color}
                values={sparklineValues}
                className={cn(
                  "h-12",
                  sizeTier === "secondary" && "h-9",
                  sizeTier === "medium" && "h-7",
                  sizeTier === "small" && "h-5"
                )}
              />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

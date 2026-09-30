import { clsx } from "clsx";

export type WidgetCategory =
  | "productivity"
  | "analytics"
  | "schedule"
  | "insight"
  | "activity"
  | "health"
  | "ai"
  | "dev"
  | "finance"
  | "learning"
  | "browsing"
  | "social";

export const CATEGORY_ACCENT: Record<WidgetCategory, string> = {
  productivity: "#ec4899", // pink-500
  analytics: "#22d3ee",    // cyan-400
  schedule: "#a78bfa",     // violet-400
  insight: "#34d399",      // emerald-400
  activity: "#fbbf24",     // amber-400
  health: "#38bdf8",       // sky-400
  ai: "#fb7185",           // rose-400
  dev: "#a1a1aa",          // zinc-400
  finance: "#10b981",      // emerald-500
  learning: "#fb923c",     // orange-400
  browsing: "#60a5fa",     // blue-400
  social: "#e879f9",       // fuchsia-400
};

export const CATEGORY_CLASS: Record<WidgetCategory, string> = {
  productivity: "text-pink-500",
  analytics: "text-cyan-400",
  schedule: "text-violet-400",
  insight: "text-emerald-400",
  activity: "text-amber-400",
  health: "text-sky-400",
  ai: "text-rose-400",
  dev: "text-zinc-400",
  finance: "text-emerald-500",
  learning: "text-orange-400",
  browsing: "text-blue-400",
  social: "text-fuchsia-400",
};

export function categoryBarStyle(cat: WidgetCategory): React.CSSProperties {
  const hex = CATEGORY_ACCENT[cat];
  return {
    background: `linear-gradient(90deg, ${hex} 0%, ${hex}20 100%)`,
  };
}

export function WidgetCard({
  children,
  category,
  className,
  hoverable = true,
}: {
  children: React.ReactNode;
  category: WidgetCategory;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900 p-5",
        hoverable && "hover:border-zinc-700 transition-colors duration-200",
        className
      )}
    >
      {/* Category top-edge bar */}
      <div
        style={categoryBarStyle(category)}
        className="absolute inset-x-0 top-0 h-[2px]"
      />
      {/* Inner content with padding-top to clear the bar */}
      <div className="relative pt-0">{children}</div>
    </div>
  );
}

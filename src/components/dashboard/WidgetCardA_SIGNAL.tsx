// ============================================================
// RHEO Dashboard — WidgetCard PROTOTYPE A: "SIGNAL"
// Solid signal panels with category top-edge bars (2px).
// L1 composed. No glass, no glow, no tricks.
// Spec-compliant rewrite. Drop-in replacement for existing A_SIGNAL.
// ============================================================

import { type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { BlurFade } from "../ui/blur-fade";
import { mix } from "./protoColor";

// ── Category → accent mapping ──────────────────────────
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
  productivity: "#ec4899",
  analytics: "#22d3ee",
  schedule: "#a78bfa",
  insight: "#34d399",
  activity: "#fbbf24",
  health: "#38bdf8",
  ai: "#fb7185",
  dev: "#a1a1aa",
  finance: "#10b981",
  learning: "#fb923c",
  browsing: "#60a5fa",
  social: "#e879f9",
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

// ── Signal bar: dim wire always on, lit lamp always on,
//    bright wire fades in on group-hover (spec 3.1) ──────
export function SignalBar({ category }: { category: WidgetCategory }) {
  const hex = CATEGORY_ACCENT[category];
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 h-[2px] pointer-events-none">
      <div className="absolute inset-0" style={{ background: mix(hex, 20) }} />
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 motion-reduce:transition-none"
        style={{ background: mix(hex, 45) }}
      />
      <div className="absolute left-0 top-0 h-full w-8" style={{ background: hex }} />
    </div>
  );
}

// ── Widget Card Props (spec-compliant flat API) ────────
export interface WidgetCardProps {
  category: WidgetCategory;
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

/** Spec-compliant: solid raised slab, sheen only, no lift, no glow. */
export function WidgetCardA({
  category,
  children,
  className = "",
  hoverable = true,
}: WidgetCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-[var(--dk-border-subtle)]",
        "bg-[var(--ws-surface-raised)] p-5 shadow-[var(--dk-sheen)]",
        hoverable &&
          "hover:border-[var(--dk-border-strong)] transition-colors duration-150 motion-reduce:transition-none",
        className
      )}
    >
      <SignalBar category={category} />

      <div className="relative">{children}</div>
    </div>
  );
}

// ── Entrance animation wrapper (BlurFade, L1) ─────────
export function CardEntrance({
  children,
  index,
}: {
  children: ReactNode;
  index: number;
}) {
  const reduce = useReducedMotion();
  // Spec 3.13 / bug 12: BlurFade caps duration at 0.2s, so 0.25 was silently 0.2.
  return (
    <BlurFade
      delay={reduce ? 0 : 0.04 * index}
      duration={reduce ? 0 : 0.2}
    >
      {children}
    </BlurFade>
  );
}

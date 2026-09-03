"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Definition tooltip — hover/focus reveals a popover explaining a key term.
 * Keyboard accessible: focusable, Esc to dismiss, click toggles on touch.
 *
 * Usage: <Def term="phase">phase</Def>
 */
export default function Def({
  term,
  label,
  children,
}: {
  term: string;
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    // close on outside click
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const entry = GLOSSARY[term.toLowerCase()];
  if (!entry) {
    // no definition found — render as plain text
    return <>{children}</>;
  }

  return (
    <span
      ref={ref}
      className="def-term"
      data-open={open}
      tabIndex={0}
      role="button"
      aria-label={`Definition: ${term}`}
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((o) => !o);
        }
      }}
    >
      {children}
      <span className="def-popover" role="tooltip">
        <span className="def-popover-label">{label || entry.label}</span>
        <span className="def-popover-body">{entry.body}</span>
      </span>
    </span>
  );
}

const GLOSSARY: Record<string, { label: string; body: string }> = {
  phase: {
    label: "PHASE",
    body: "A named block of time with a single intent — deep work, meetings, rest. RHEO tags sessions against the phases you define, so you see shape, not just length.",
  },
  "deep work": {
    label: "DEEP WORK",
    body: "Uninterrupted, high-attention focus on a single cognitively demanding task. RHEO measures its depth, not just its duration.",
  },
  baseline: {
    label: "BASELINE",
    body: "A rolling 7-day (or configurable) average of a metric, used to spot when a day deviates from your own norm — not a generic benchmark.",
  },
  lesson: {
    label: "LESSON",
    body: "A distillation the AI draws from your record — a pattern, a cost, a recommendation. Lessons redraw themselves as your record grows.",
  },
  "local-first": {
    label: "LOCAL-FIRST",
    body: "The record, the AI queries, and the lessons all run on your machine. Zero bytes leave unless you choose to export. The cloud is never a dependency.",
  },
  depth: {
    label: "DEPTH",
    body: "A per-session measure of sustained attention, distinct from duration. Two hours of deep work and two hours of fragmented work are not equal.",
  },
  receipt: {
    label: "RECEIPT",
    body: "Every AI answer cites the exact sessions it used. You can trace any claim back to the raw record — no guessing.",
  },
  ridgeline: {
    label: "RIDGELINE",
    body: "A stacked-wave visualization showing how a metric varies across a span of time. RHEO uses them to render a day's rhythm at a glance.",
  },
};

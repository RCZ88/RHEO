"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useShouldAnimate } from "./use-motion-preference";
import DecryptedText from "./DecryptedText";

type Scenario = {
  id: string;
  /** short label for the segmented control; `q` is the full question it asks */
  short: string;
  q: string;
  traces: string[];
  answer: string;
  bars: number[]; // 7 values 0..1
};

const SCENARIOS: Scenario[] = [
  {
    id: "deep-work",
    short: "Deep work",
    q: "> why was tuesday's deep work down 22%?",
    traces: [
      "querying timeline…",
      "cross-referencing calendar…",
      "comparing 7-day baseline…",
    ],
    answer:
      "Two unplanned meetings split your 09–12 block; recovery started 40 min later than baseline.",
    bars: [0.9, 0.82, 0.42, 0.78, 0.86, 0.7, 0.9],
  },
  {
    id: "learning",
    short: "Learning",
    q: "> what did I learn this week?",
    traces: ["collecting lyceum sessions…", "grouping by topic…"],
    answer:
      "9 focused sessions across 3 topics — most on context systems. Longest streak: Thursday.",
    bars: [0.4, 0.55, 0.6, 0.9, 0.7, 0.5, 0.45],
  },
  {
    id: "sharpest",
    short: "Sharpest",
    q: "> when am I sharpest?",
    traces: ["scoring 30-day focus…", "clustering by hour…"],
    answer:
      "Your focus peaks 09:00–11:30. Mornings run 31% deeper than afternoons.",
    bars: [0.3, 0.95, 0.8, 0.5, 0.45, 0.35, 0.3],
  },
];

export default function ActUnderstand() {
  return (
    <section id="understand" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-12 sm:mb-16 max-w-[680px]">
          <p className="mono-label" style={{ fontSize: 11 }}>
            <DecryptedText text="SECTION 03 / UNDERSTAND" speed={28} maxIterations={6} />
          </p>
          <h2 className="display-h2 mt-3">AN AI THAT WAS THERE.</h2>
          <p
            className="mt-5"
            style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          >
            It doesn&apos;t guess about your time. It queries the record — and
            answers with receipts. Keep asking, and the record teaches back — your
            process, redrawn as your habits change.
          </p>
        </div>

        {/* REMOVED 2026-10-07 — app-ai.png is rendered by #gallery as one of the
            17 screens. RESULT.md §1.2 gives the gallery exclusive ownership of
            every still, precisely so a capture is never shown twice. */}
        {/* R6 composition ruling — the static EXAMPLE card and NodeGraph are BOTH
            deleted. The card was the placeholder for exactly this content and the
            Console is the stronger artifact; keeping both said the same claim twice
            ("DEEP WORK PEAKS 09:12–11:40" vs "focus peaks 09:00–11:30"). NodeGraph was
            a fourth, weakest rendering of "queries, not guesses" — aria-hidden
            decoration restating the body copy, and it carried its own reduce bug (the
            0.9s path draw ran under reduce). Source kept at
            .bak-20261008-actunderstand/. One thing, said once, demonstrated once. */}
        <Console />
      </div>
    </section>
  );
}

/* ---------- Console ---------- */
function Console() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px" });
  const reduced = !useShouldAnimate();

  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "traces" | "answer" | "hold">(
    "typing"
  );
  const [traceShown, setTraceShown] = useState(0);
  const [input, setInput] = useState("");

  const scenario = SCENARIOS[idx];

  // reset when index changes
  useEffect(() => {
    setTyped("");
    setPhase("typing");
    setTraceShown(0);
  }, [idx]);

  useEffect(() => {
    if (!inView || reduced) {
      if (reduced) {
        setTyped(scenario.q);
        setPhase("answer");
        setTraceShown(scenario.traces.length);
      }
      return;
    }
    if (phase !== "typing") return;
    let i = 0;
    const target = scenario.q;
    const id = setInterval(() => {
      i++;
      setTyped(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(id);
        setTimeout(() => setPhase("traces"), 400);
      }
    }, 28);
    return () => clearInterval(id);
  }, [inView, phase, scenario.q, reduced]);

  // stagger traces
  useEffect(() => {
    if (!inView || reduced) return;
    if (phase !== "traces") return;
    if (traceShown >= scenario.traces.length) {
      const t = setTimeout(() => setPhase("answer"), 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTraceShown((n) => n + 1), 150);
    return () => clearTimeout(t);
  }, [phase, traceShown, inView, scenario.traces.length, reduced]);

  // R6 blocker 1 — the 4.2s auto-advance is DELETED. It was WCAG 2.2.2 (Pause,
  // Stop, Hide): content that moves by itself with no control. It also meant a
  // visitor could never stay on a scenario they were reading. Scenarios now
  // advance ONLY on user action, via the segmented button row below.
  //
  // R6 blocker 2 — the free-text input is DELETED too. `onSubmit` ignored what
  // was typed and advanced a canned script, so the box promised a capability it
  // did not have: the single worst thing a trust-first page can do, and this
  // section IS the trust argument. Three real controls that really select is
  // strictly better than one fake input.

  return (
    <div
      ref={ref}
      id="console-panel"
      role="tabpanel"
      aria-labelledby={`console-tab-${SCENARIOS[idx].id}`}
      tabIndex={0}
      className="surface-card sheen-top"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 18,
        background: "#050506",
        minHeight: 380,
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffffff" }} />
          <span className="mono" style={{ fontSize: 11, color: "#a1a1aa", letterSpacing: "0.08em" }}>
            rheo · understand
          </span>
        </div>
        <span className="mono-label" style={{ fontSize: 10 }}>
          scenario {idx + 1}/{SCENARIOS.length} · EXAMPLE
        </span>
      </div>

      {/* user query */}
      <div
        className="mono"
        style={{ fontSize: 13, color: "#f4f4f5", marginBottom: 12, minHeight: 20 }}
      >
        {typed}
        {phase === "typing" && (
          <span className="blink-cursor" style={{ color: "#ffffff" }}>
            ▋
          </span>
        )}
      </div>

      {/* traces */}
      <div style={{ minHeight: 60, marginBottom: 12 }}>
        {phase !== "typing" &&
          scenario.traces.slice(0, traceShown).map((t, i) => (
            <motion.div
              key={`${idx}-${i}`}
              className="mono"
              initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ fontSize: 12, color: "#8a8a94", marginBottom: 4 }}
            >
              → {t}
            </motion.div>
          ))}
      </div>

      {/* answer */}
      <div style={{ minHeight: 120 }}>
        {phase === "answer" && (
          <motion.div
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#f4f4f5" }}>
              {scenario.answer}
            </p>
            <BarChart values={scenario.bars} />
          </motion.div>
        )}
      </div>

      {/* R6 blocker 2 — real controls. Each button selects the scenario it names. */}
      <div
        role="tablist"
        aria-label="Example questions"
        style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}
      >
        {SCENARIOS.map((sc, i) => {
          const active = i === idx;
          return (
            <button
              key={sc.id}
              role="tab"
              type="button"
              id={`console-tab-${sc.id}`}
              aria-selected={active}
              aria-controls="console-panel"
              // Roving tabindex: exactly one tab is in the tab order, so Tab moves
              // OUT of the widget and arrows move WITHIN it. Without this, Tab walks
              // through all three and the role promises a keyboard contract the
              // markup does not provide.
              tabIndex={active ? 0 : -1}
              data-scenario={sc.id}
              onClick={() => { setIdx(i); setPhase("query"); setTraceShown(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next = e.key === "ArrowRight"
                    ? Math.min(SCENARIOS.length - 1, i + 1)
                    : Math.max(0, i - 1);
                  setIdx(next);
                  setPhase("query");
                  setTraceShown(0);
                  document.getElementById(`console-tab-${SCENARIOS[next].id}`)?.focus();
                }
              }}
              className="mono"
              style={{
                fontSize: 11,
                padding: "6px 10px",
                borderRadius: 6,
                cursor: "pointer",
                background: active ? "#ffffff" : "transparent",
                color: active ? "#050506" : "#a1a1aa",
                border: `1px solid ${active ? "#ffffff" : "rgba(255,255,255,0.12)"}`,
                transition: "background 0.3s cubic-bezier(0.16,1,0.3,1), color 0.3s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {sc.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BarChart({ values }: { values: number[] }) {
  // Own hook instance: BarChart is a separate component, so the Console's `reduced`
  // is not in scope here. Getting this wrong threw "reduced is not defined" and
  // took the entire reduced-motion render down with it.
  const reduced = !useShouldAnimate();
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        marginTop: 14,
        height: 54,
        padding: "6px 8px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
        background: "#0a0a0c",
      }}
    >
      {values.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {/* R6 blocker 3 — the WRAPPER holds the final height; the bar is a
              full-height child animated with scaleY from the bottom. Animating
              `height` is a layout-property animation: it reflows every frame and
              fights the scroll-snap rail it lives inside. */}
          <div style={{ width: "100%", height: 40, display: "flex", alignItems: "flex-end" }}>
            <motion.div
              initial={{ scaleY: reduced ? 1 : 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                duration: reduced ? 0 : 0.6,
                delay: reduced ? 0 : i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                width: "100%",
                height: "100%",
                transformOrigin: "bottom",
                background: i === 2 ? "#ffffff" : "rgba(255,255,255,0.4)",
              }}
            />
          </div>
          <span className="mono" style={{ fontSize: 8, color: "#8a8a94" }}>
            {days[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

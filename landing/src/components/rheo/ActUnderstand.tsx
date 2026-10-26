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
  answer: string;
};

/**
 * THE THREE EXAMPLES, AND WHY THEY LOOK LIKE THIS.
 *
 * The previous set promised things the product cannot do. A grep of
 * `src/services/aiContextBundle.ts` — the file that builds the system prompt —
 * found exactly three period literals in the whole thing, and all three are
 * `"today"` (lines 211, 217, 265). There is no date-range tool, no function
 * calling over the tracking tables, and no way to ask about last Tuesday. So the
 * old questions (a past day, a focus score, "this
 * week") were demonstrating a feature that does not exist, and the old 31%-deeper phrase used
 * a word — depth — that a sibling sweep found 335 times in src/, none of them
 * being this product.
 *
 * Each scenario below uses ONLY a call that is actually in the prompt, named in
 * its comment. Each answer carries no number, because a written example cannot
 * be checked and an invented percentage is the fabricated-readout rule one
 * layer down.
 */
const SCENARIOS: Scenario[] = [
  {
    id: "today",
    short: "Today",
    q: "> where did today go?",
    // fed by getDashboardAggregates({ period: "today" }) — aiContextBundle.ts:265
    answer:
      "Most of today went to your editor and your terminal. The browser came second.",
  },
  {
    id: "sleep",
    short: "Sleep",
    q: "> how did last night line up with today?",
    // fed by getSleepForDate(todayIso()) + getGoals(todayIso())
    // — aiContextBundle.ts:207, 206
    answer:
      "Sleep was on the short side last night, and today's goals are still open. Starting with the smallest one would be a gentle way in.",
  },
  {
    id: "outside",
    short: "Outside",
    q: "> what did I log away from the computer today?",
    // fed by getExternalSessions('today') — aiContextBundle.ts:217. "Exercise"
    // and "Reading" are two of the eight seeded defaults at src/main.ts:4726-4733,
    // so those two names are the app's, not mine.
    answer:
      "You logged Exercise and Reading. Neither shows up in your app time, so they are listed separately.",
  },
];

export default function ActUnderstand() {
  return (
    <section id="understand" className="relative surface-page pt-24 sm:pt-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-12 sm:mb-16 max-w-[680px]">
          <p className="mono-label" style={{ fontSize: 11 }}>
            <DecryptedText text="SECTION 03 / UNDERSTAND · EXAMPLE ANSWERS" speed={28} maxIterations={6} />
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

        {/* The honesty line. Every clause is a call that is actually in the prompt
            builder, src/services/aiContextBundle.ts: getDashboardAggregates (265),
            getSleepForDate (216), getGoals (207), getExternalSessions (217), and
            connectors.items (333) when the user has connected something. If one of
            those stops being called, this sentence is wrong in the same way the
            trace lines were. */}
        <p
          className="mono"
          style={{
            marginTop: 18,
            fontSize: 12,
            lineHeight: 1.6,
            color: "#8a8a94",
            maxWidth: 640,
          }}
        >
          Written examples, not recordings. A real answer uses today&rsquo;s
          activity, last night&rsquo;s sleep, your goals, activity you logged away
          from the computer, and anything you connect.
        </p>
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
  const [phase, setPhase] = useState<"typing" | "thinking" | "answer" | "hold">(
    "typing"
  );

  const scenario = SCENARIOS[idx];

  // reset when index changes
  useEffect(() => {
    setTyped("");
    setPhase("typing");
  }, [idx]);

  useEffect(() => {
    if (!inView || reduced) {
      if (reduced) {
        setTyped(scenario.q);
        setPhase("answer");
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
        // "traces" was renamed "thinking": the old phase name described three
        // staggered lines the real app does not draw. What it actually shows is
        // src/components/ai/canvas/CanvasInput.tsx:173-181 — three dots and the
        // word "Thinking...". This section now shows that, and nothing else.
        setTimeout(() => setPhase("thinking"), 400);
      }
    }, 28);
    return () => clearInterval(id);
  }, [inView, phase, scenario.q, reduced]);

  // thinking -> answer, after a beat a human would take to read
  useEffect(() => {
    if (!inView || reduced) return;
    if (phase !== "thinking") return;
    const t = setTimeout(() => setPhase("answer"), 1100);
    return () => clearTimeout(t);
  }, [phase, inView, reduced]);

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

      {/* THINKING — the only status the real panel draws. The three trace lines
          this replaced ("querying timeline…", "cross-referencing calendar…",
          a one-week baseline") were staggered by a setTimeout and named
          steps the assistant never performs. A grep of src/components/ai/** for a
          renderer of step lines returned an `agentSteps` prop that nothing
          populates; the real panel shows this: src/components/ai/canvas/
          CanvasInput.tsx:173-181. Anything richer here would be advertising a
          capability the app does not have. */}
      <div
        style={{ minHeight: 60, marginBottom: 12 }}
        aria-live="polite"
        aria-atomic="true"
      >
        {phase === "thinking" && (
          <span
            className="mono"
            style={{
              fontSize: 12,
              color: "#8a8a94",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Thinking
            <span aria-hidden style={{ display: "inline-flex", gap: 3 }}>
              <span className="dk-thinking-dot" />
              <span className="dk-thinking-dot" style={{ animationDelay: "0.2s" }} />
              <span className="dk-thinking-dot" style={{ animationDelay: "0.4s" }} />
            </span>
          </span>
        )}
      </div>

      {/* answer — no BarChart. The seven-value `bars` array was seven invented
          numbers laid out as a week, and a chart shape is a promise that the
          screen behind it has that shape. */}
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
              onClick={() => setIdx(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next = e.key === "ArrowRight"
                    ? Math.min(SCENARIOS.length - 1, i + 1)
                    : Math.max(0, i - 1);
                  setIdx(next);
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


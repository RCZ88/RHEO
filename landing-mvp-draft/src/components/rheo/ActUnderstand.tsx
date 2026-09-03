"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type Scenario = {
  q: string;
  traces: string[];
  answer: string;
  bars: number[]; // 7 values 0..1
};

const SCENARIOS: Scenario[] = [
  {
    q: "> why was tuesday's deep work down 22%?",
    traces: [
      "→ querying timeline…",
      "→ cross-referencing calendar…",
      "→ comparing 7-day baseline…",
    ],
    answer:
      "Tuesday's deep work dropped to 2h 20m. Three meetings (09:30, 11:00, 14:15) split the block; your 7-day baseline is 3h. Guard 09–12 to recover.",
    bars: [0.9, 0.82, 0.42, 0.78, 0.86, 0.7, 0.9],
  },
  {
    q: "> what's draining my afternoons?",
    traces: [
      "→ grouping 14:00–18:00 blocks…",
      "→ tagging by app focus…",
      "→ ranking by context switches…",
    ],
    answer:
      "Afternoon context switches are up 34%. Slack and email cluster at 15:00–16:00. One uninterrupted deep block there recovers ~40 min/day.",
    bars: [0.4, 0.5, 0.6, 0.9, 0.95, 0.7, 0.5],
  },
  {
    q: "> when do I learn best?",
    traces: [
      "→ scanning learning sessions…",
      "→ aligning with energy logs…",
      "→ ranking by retention…",
    ],
    answer:
      "Retention peaks 19:00–21:00 — 2.1× the morning rate. Schedule hard topics there; mornings suit review and consolidation.",
    bars: [0.3, 0.35, 0.4, 0.5, 0.7, 0.95, 0.8],
  },
];

export default function ActUnderstand() {
  return (
    <section id="understand" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-12 sm:mb-16 max-w-[680px]">
          <p className="mono-label" style={{ fontSize: 11 }}>
            SECTION 03 / UNDERSTAND
          </p>
          <h2 className="display-h2 mt-3">AN AI THAT WAS THERE.</h2>
          <p
            className="mt-5"
            style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          >
            It doesn&apos;t guess about your time. It queries the record — and
            answers with receipts.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
          <Console />
          <NodeGraph />
        </div>
      </div>
    </section>
  );
}

/* ---------- Console ---------- */
function Console() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px" });
  const reduced = usePrefersReducedMotion();

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

  // hold then advance
  useEffect(() => {
    if (!inView || reduced) return;
    if (phase !== "answer") return;
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % SCENARIOS.length);
    }, 4200);
    return () => clearTimeout(t);
  }, [phase, inView, reduced]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIdx((i) => (i + 1) % SCENARIOS.length);
    setInput("");
  };

  return (
    <div
      ref={ref}
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
          scenario {idx + 1}/{SCENARIOS.length}
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
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ fontSize: 12, color: "#63636b", marginBottom: 4 }}
            >
              {t}
            </motion.div>
          ))}
      </div>

      {/* answer */}
      <div style={{ minHeight: 120 }}>
        {phase === "answer" && (
          <motion.div
            initial={{ opacity: 0 }}
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

      {/* input box */}
      <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            background: "#0a0a0c",
          }}
        >
          <span className="mono" style={{ fontSize: 12, color: "#63636b" }}>
            ›
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ask about your time — press enter"
            className="mono"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 12,
              color: "#f4f4f5",
              fontFamily: "var(--font-mono), monospace",
            }}
          />
        </div>
      </form>
    </div>
  );
}

function BarChart({ values }: { values: number[] }) {
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
          <div style={{ width: "100%", height: 40, display: "flex", alignItems: "flex-end" }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${v * 100}%` }}
              transition={{
                duration: 0.6,
                delay: i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                width: "100%",
                background: i === 2 ? "#ffffff" : "rgba(255,255,255,0.4)",
                minHeight: 2,
              }}
            />
          </div>
          <span className="mono" style={{ fontSize: 8, color: "#63636b" }}>
            {days[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Node graph (central node + 3 tools, lines draw on inView) ---------- */
function NodeGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });
  const reduced = usePrefersReducedMotion();
  const draw = reduced || inView ? 1 : 0;

  const center = { x: 60, y: 120 };
  const tools = [
    { x: 180, y: 40, label: "timeline" },
    { x: 200, y: 120, label: "calendar" },
    { x: 180, y: 200, label: "baseline" },
  ];
  return (
    <div ref={ref} style={{ width: 260 }}>
      <svg viewBox="0 0 230 240" width="100%" height="260" aria-hidden>
        {tools.map((t, i) => (
          <motion.path
            key={i}
            d={`M ${center.x} ${center.y} C ${(center.x + t.x) / 2} ${center.y}, ${(center.x + t.x) / 2} ${t.y}, ${t.x} ${t.y}`}
            fill="none"
            stroke="rgba(255,255,255,0.32)"
            strokeWidth={1}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: draw }}
            transition={{
              duration: 0.9,
              delay: 0.2 + i * 0.15,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
        {/* central node */}
        <circle cx={center.x} cy={center.y} r={18} fill="#0a0a0c" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
        <circle cx={center.x} cy={center.y} r={4} fill="#ffffff" />
        <text
          x={center.x}
          y={center.y + 34}
          textAnchor="middle"
          fill="#a1a1aa"
          style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.1em" }}
        >
          RHEO
        </text>
        {/* tool nodes */}
        {tools.map((t, i) => (
          <g key={i}>
            <circle cx={t.x} cy={t.y} r={10} fill="#0a0a0c" stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
            <text
              x={t.x + 16}
              y={t.y + 3}
              fill="#63636b"
              style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.08em" }}
            >
              {t.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mono-label" style={{ fontSize: 10, textAlign: "center", marginTop: 6 }}>
        queries · not guesses
      </p>
    </div>
  );
}

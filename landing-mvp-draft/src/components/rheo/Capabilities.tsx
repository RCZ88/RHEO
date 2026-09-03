"use client";

import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const CARDS = [
  { kicker: "01 / TIMELINE", title: "A day, rendered as a strip." },
  { kicker: "02 / AI-NATIVE", title: "Query your time in plain language." },
  { kicker: "03 / LEARNING ENGINE", title: "Weights that adjust themselves." },
  { kicker: "04 / WORKSPACE", title: "A TUI that gets out of your way." },
  { kicker: "05 / PHASES", title: "Your day, as ridgelines." },
];

export default function Capabilities() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section ref={ref} id="capabilities" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-12 sm:mb-16">
          <p className="mono-label" style={{ fontSize: 11 }}>
            CAPABILITIES
          </p>
          <h2 className="display-h2 mt-3" style={{ maxWidth: 760 }}>
            Five instruments, one record.
          </h2>
        </div>

        {/* grid: 3 + 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card index={0} {...CARDS[0]}>
            <TimelineDemo />
          </Card>
          <Card index={1} {...CARDS[1]}>
            <TerminalDemo />
          </Card>
          <Card index={2} {...CARDS[2]}>
            <NodeGraphDemo />
          </Card>
          <Card index={3} {...CARDS[3]}>
            <TuiDemo />
          </Card>
          <Card index={4} {...CARDS[4]}>
            <PhasesDemo />
          </Card>
        </div>
      </div>
    </section>
  );
}

function Card({
  index,
  kicker,
  title,
  children,
}: {
  index: number;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-12% 0px" });
  return (
    <motion.div
      ref={ref}
      className="surface-panel sheen-top card-lift"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 20,
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{
        duration: 0.6,
        delay: (index % 3) * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <p className="mono-label" style={{ fontSize: 11 }}>
        {kicker}
      </p>
      <h3
        className="mt-2"
        style={{
          fontSize: 19,
          lineHeight: 1.3,
          color: "#f4f4f5",
          fontWeight: 500,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>
      <div className="mt-5">{children}</div>
    </motion.div>
  );
}

/* ---- 1. TIMELINE mini phase bar (fills with card's own scroll progress) ---- */
function TimelineDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 90%", "end 10%"],
  });
  const fill = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const segments = [
    { h0: 0, h1: 6 },
    { h0: 9, h1: 12 },
    { h0: 12, h1: 14 },
    { h0: 19, h1: 21 },
    { h0: 23, h1: 24 },
  ];
  return (
    <div ref={ref} style={{ height: 80, position: "relative" }}>
      <div
        style={{
          position: "relative",
          height: 28,
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          background: "#050506",
          overflow: "hidden",
        }}
      >
        {segments.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(s.h0 / 24) * 100}%`,
              width: `${((s.h1 - s.h0) / 24) * 100}%`,
              top: 0,
              bottom: 0,
              borderRight: "1px solid rgba(255,255,255,0.16)",
            }}
          />
        ))}
        <motion.div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: fill,
            background: "rgba(255,255,255,0.16)",
          }}
        />
        <div className="flex justify-between absolute inset-0 px-2 items-center pointer-events-none">
          {["00", "06", "12", "18", "24"].map((t) => (
            <span
              key={t}
              className="mono"
              style={{ fontSize: 8, color: "#63636b", letterSpacing: "0.06em" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <p
        className="mono"
        style={{ fontSize: 10, color: "#63636b", marginTop: 12, letterSpacing: "0.06em" }}
      >
        scroll-linked · reversible
      </p>
    </div>
  );
}

/* ---- 2. AI-NATIVE tiny terminal, ~2s loop ---- */
function TerminalDemo() {
  const lines = [
    { t: "> rheo query \"deep work this week\"", prompt: true },
    { t: "→ scanning 7 days of record…" },
    { t: "→ 12h 40m found across 9 sessions" },
  ];
  const [shown, setShown] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px" });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!inView) {
      setShown([]);
      return;
    }
    let i = 0;
    let charIdx = 0;
    let full: string[] = [];
    let timer: ReturnType<typeof setTimeout>;
    if (reduced) {
      setShown(lines.map((l) => l.t));
      return;
    }

    const typeNext = () => {
      if (i >= lines.length) {
        // restart loop
        timer = setTimeout(() => {
          i = 0;
          charIdx = 0;
          full = [];
          setShown([]);
          typeNext();
        }, 1600);
        return;
      }
      const target = lines[i].t;
      if (charIdx < target.length) {
        charIdx++;
        full = [...full];
        if (full[i] === undefined) full[i] = "";
        full[i] = target.slice(0, charIdx);
        setShown([...full]);
        timer = setTimeout(typeNext, 18);
      } else {
        i++;
        charIdx = 0;
        timer = setTimeout(typeNext, 320);
      }
    };
    typeNext();
    return () => clearTimeout(timer);
  }, [inView, reduced]);

  return (
    <div
      ref={ref}
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: "#050506",
        padding: 12,
        minHeight: 120,
      }}
    >
      <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
        <span style={dotStyle(0.16)} />
        <span style={dotStyle(0.1)} />
        <span style={dotStyle(0.08)} />
        <span
          className="mono"
          style={{ fontSize: 9, color: "#63636b", marginLeft: 6, letterSpacing: "0.1em" }}
        >
          rheo · query
        </span>
      </div>
      <div className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>
        {shown.map((l, i) => (
          <div
            key={i}
            style={{
              color: i === 0 ? "#f4f4f5" : "#a1a1aa",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {l}
            {i === shown.length - 1 && shown[shown.length - 1] !== undefined && (
              <span className="blink-cursor" style={{ color: "#ffffff" }}>
                ▋
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function dotStyle(opacity: number): React.CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: `rgba(255,255,255,${opacity})`,
    display: "inline-block",
  };
}

/* ---- 3. LEARNING ENGINE node graph, edges draw on inView + equation ---- */
function NodeGraphDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });
  const reduced = usePrefersReducedMotion();
  const draw = reduced || inView ? 1 : 0;

  // graph: center node + 3 inputs + weights
  const nodes = [
    { x: 20, y: 20, label: "t₁" },
    { x: 20, y: 60, label: "t₂" },
    { x: 20, y: 100, label: "t₃" },
    { x: 140, y: 60, label: "Σ" },
  ];
  const edges = [
    [0, 3, 0.8],
    [1, 3, 0.5],
    [2, 3, 0.3],
  ];
  return (
    <div ref={ref}>
      <svg viewBox="0 0 160 120" width="100%" height="120" aria-hidden>
        {edges.map(([a, b], i) => {
          const na = nodes[a];
          const nb = nodes[b];
          return (
            <motion.line
              key={i}
              x1={na.x + 8}
              y1={na.y}
              x2={nb.x - 8}
              y2={nb.y}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={1}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: draw }}
              transition={{
                duration: 0.8,
                delay: 0.15 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          );
        })}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r={8}
              fill="#0a0a0c"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={1}
            />
            <text
              x={n.x}
              y={n.y + 3}
              textAnchor="middle"
              fill="#a1a1aa"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 8,
              }}
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <p
        className="mono eq-glow"
        style={{
          fontSize: 12,
          color: "#f4f4f5",
          textAlign: "center",
          marginTop: 8,
          letterSpacing: "0.04em",
        }}
      >
        T = Σ wᵢ·tᵢ
      </p>
    </div>
  );
}

/* ---- 4. WORKSPACE TUI mock: three hairline panes, blinking cursor ---- */
function TuiDemo() {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: "#050506",
        padding: 8,
      }}
    >
      <div className="flex" style={{ gap: 4, height: 100 }}>
        <Pane title="timeline" flex={1}>
          <TuiLine text="09:00 deep work" active />
          <TuiLine text="12:00 meetings" />
          <TuiLine text="14:00 break" />
          <TuiLine text="19:00 learning" />
        </Pane>
        <Pane title="focus" flex={1}>
          <TuiLine text="streak 12d" />
          <TuiLine text="today 4.2h" />
          <TuiLine text="w/k  18.1h" />
        </Pane>
        <Pane title="ai" flex={1.1}>
          <TuiLine text="› query…" />
          <TuiLine text="  ready" />
          <span className="blink-cursor" style={{ color: "#ffffff", fontSize: 11 }}>
            ▋
          </span>
        </Pane>
      </div>
    </div>
  );
}
function Pane({
  title,
  flex,
  children,
}: {
  title: string;
  flex: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
        padding: 6,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 8, color: "#63636b", letterSpacing: "0.1em", marginBottom: 2 }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}
function TuiLine({ text, active }: { text: string; active?: boolean }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 9,
        color: active ? "#ffffff" : "#63636b",
        letterSpacing: "0.04em",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

/* ---- 5. PHASES ridgelines: 4 stacked; bottom 3 @ 20%, top animating ---- */
function PhasesDemo() {
  const paths = [
    "M0 28 C 20 20, 35 32, 55 24 C 75 16, 95 30, 120 22 C 140 14, 160 28, 180 20",
    "M0 38 C 20 30, 35 42, 55 34 C 75 26, 95 40, 120 32 C 140 24, 160 38, 180 30",
    "M0 48 C 20 40, 35 52, 55 44 C 75 36, 95 50, 120 42 C 140 34, 160 48, 180 40",
    "M0 14 C 20 6, 35 18, 55 10 C 75 2, 95 16, 120 8 C 140 0, 160 14, 180 6",
  ];
  return (
    <svg viewBox="0 0 180 60" width="100%" height="110" aria-hidden>
      {paths.map((d, i) => (
        <g
          key={i}
          className={i === 0 ? "ridge-anim" : undefined}
          style={{ transformOrigin: "center" }}
        >
          <path
            d={d}
            fill="none"
            stroke="#ffffff"
            strokeWidth={1}
            opacity={i === 0 ? 0.55 : 0.2}
          />
        </g>
      ))}
    </svg>
  );
}

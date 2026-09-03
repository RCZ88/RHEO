"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Def from "./Def";
import DecryptedText from "./DecryptedText";

const LESSON_LINES: React.ReactNode[] = [
  "A phase is a container for intent.",
  <>
    Duration measures length; <Def term="depth">depth</Def> measures attention.
  </>,
  "Switching cost compounds across a day.",
  "The record is the teacher — you are the student.",
];

export default function LearnVignette() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const figureDraw = useTransform(scrollYProgress, [0.1, 0.6], [0, 1]);
  const equationScale = useTransform(scrollYProgress, [0.45, 0.75], [0.98, 1]);

  return (
    <section ref={ref} id="learn" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-start" style={{ minWidth: 0 }}>
          {/* left sticky */}
          <div className="lg:sticky" style={{ top: 96 }}>
            <p className="mono-label" style={{ fontSize: 11 }}>
              <DecryptedText text="SECTION 04 / LEARN" speed={28} maxIterations={6} />
            </p>
            <h2 className="display-h2 mt-3">YOUR PROCESS, TEACHING YOU.</h2>
            <p
              className="mt-5"
              style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa", maxWidth: 420 }}
            >
              Sessions become notes. Notes become lessons. Lessons redraw
              themselves as you grow.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {["MERMAID", "LATEX", "ANIMATED MATH"].map((c) => (
                <span
                  key={c}
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "#a1a1aa",
                    letterSpacing: "0.12em",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    padding: "4px 8px",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* right: article card drawing with scroll */}
          <div>
            <div
              className="surface-panel sheen-top"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 24,
                overflow: "hidden",
              }}
            >
              <p className="mono-label" style={{ fontSize: 11 }}>
                LESSON · 014
              </p>
              <h3
                className="mt-2"
                style={{
                  fontSize: 24,
                  lineHeight: 1.25,
                  color: "#f4f4f5",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                On the geometry of a focused day
              </h3>

              {/* SVG figure that draws with scroll */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  background: "#050506",
                  padding: 16,
                  margin: "18px 0",
                }}
              >
                <svg viewBox="0 0 360 180" width="100%" height="180" aria-hidden>
                  {/* axes */}
                  <line x1={20} y1={160} x2={340} y2={160} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
                  <line x1={20} y1={20} x2={20} y2={160} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
                  <text x={20} y={14} fill="#63636b" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.1em" }}>
                    DEPTH
                  </text>
                  <text x={320} y={174} fill="#63636b" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.1em" }}>
                    HOURS
                  </text>
                  {/* focus curve */}
                  <motion.path
                    d="M 20 150 C 60 140, 90 60, 130 50 C 170 40, 200 90, 240 110 C 280 130, 310 150, 340 140"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    style={{ pathLength: figureDraw }}
                  />
                  {/* annotations */}
                  <motion.g style={{ opacity: figureDraw }}>
                    <line x1={130} y1={50} x2={130} y2={160} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
                    <circle cx={130} cy={50} r={3} fill="#ffffff" />
                    <text x={136} y={46} fill="#a1a1aa" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9 }}>
                      peak · 10:42
                    </text>
                  </motion.g>
                </svg>
              </div>

              {/* lesson text lines fade sequentially */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {LESSON_LINES.map((line, i) => {
                  const start = 0.15 + i * 0.1;
                  const end = start + 0.1;
                  return (
                    <LessonLine
                      key={i}
                      text={line}
                      progress={scrollYProgress}
                      start={start}
                      end={end}
                    />
                  );
                })}
              </div>

              {/* highlighted equation line scales 0.98 → 1 */}
              <motion.div
                style={{
                  marginTop: 18,
                  padding: "12px 14px",
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 10,
                  background: "#050506",
                  scale: equationScale,
                }}
              >
                <p
                  className="mono eq-glow"
                  style={{ fontSize: 13, color: "#f4f4f5", letterSpacing: "0.04em", overflowWrap: "break-word" }}
                >
                  depth = ∫ attention dt / duration
                </p>
              </motion.div>
            </div>

            <p
              className="mono-label"
              style={{ fontSize: 10, marginTop: 12, textAlign: "right" }}
            >
              Lessons redraw themselves as your record grows.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LessonLine({
  text,
  progress,
  start,
  end,
}: {
  text: React.ReactNode;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.15, 1]);
  const x = useTransform(progress, [start, end], [6, 0]);
  return (
    <motion.p
      style={{ opacity, x, fontSize: 15, lineHeight: 1.6, color: "#f4f4f5" }}
    >
      {text}
    </motion.p>
  );
}

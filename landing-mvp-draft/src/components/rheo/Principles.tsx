"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Def from "./Def";

const PILLARS = [
  {
    num: "01",
    kicker: "PRINCIPLE",
    title: "The record is the source of truth.",
    body: (
      <>
        No estimates. No self-reported approximations. RHEO watches your actual focus and tags it against the <Def term="phase">phases</Def> you define. The timeline is the <Def term="receipt">receipt</Def>.
      </>
    ),
    demo: "truth",
  },
  {
    num: "02",
    kicker: "PRINCIPLE",
    title: "Understanding compounds.",
    body: (
      <>
        Each session writes a note. Notes fold into <Def term="lesson">lessons</Def>. Lessons redraw themselves as your record grows — so the second month is sharper than the first.
      </>
    ),
    demo: "compound",
  },
  {
    num: "03",
    kicker: "PRINCIPLE",
    title: "Time is private by default.",
    body: (
      <>
        Everything is <Def term="local-first">local first</Def>. The record, the AI, the lessons — all run on your machine. Nothing leaves unless you choose to share a redacted export.
      </>
    ),
    demo: "private",
  },
];

export default function Principles() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });

  return (
    <section id="principles" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-12 sm:mb-16 max-w-[680px]">
          <p className="mono-label" style={{ fontSize: 11 }}>
            SECTION 05 / WHY RHEO
          </p>
          <h2 className="display-h2 mt-3">Three commitments, kept by code.</h2>
          <p
            className="mt-5"
            style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          >
            Not promises. Mechanics. Each principle below is enforced by the way
            RHEO is built — not by goodwill.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PILLARS.map((p, i) => (
            <motion.article
              key={p.num}
              className="surface-panel sheen-top card-lift"
              ref={i === 0 ? ref : undefined}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className="mono"
                  style={{ fontSize: 22, color: "#ffffff", letterSpacing: "-0.01em" }}
                >
                  {p.num}
                </span>
                <span className="mono-label" style={{ fontSize: 10 }}>
                  {p.kicker}
                </span>
              </div>
              <h3
                style={{
                  fontSize: 20,
                  lineHeight: 1.25,
                  color: "#f4f4f5",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#a1a1aa",
                }}
              >
                {p.body}
              </p>
              <div style={{ marginTop: "auto" }}>
                {p.demo === "truth" && <TruthDemo />}
                {p.demo === "compound" && <CompoundDemo />}
                {p.demo === "private" && <PrivateDemo />}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- Demo 1: TRUTH — a focus session log with verified stamps --- */
function TruthDemo() {
  const rows = [
    { t: "09:02", label: "deep work", tag: "VERIFIED", dur: "1h 48m" },
    { t: "12:15", label: "meetings", tag: "VERIFIED", dur: "0h 42m" },
    { t: "19:03", label: "learning", tag: "VERIFIED", dur: "1h 12m" },
  ];
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: "#050506",
        padding: 12,
      }}
    >
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center justify-between"
          style={{
            padding: "7px 0",
            borderBottom:
              i < rows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          <span className="mono tabular-nums" style={{ fontSize: 11, color: "#f4f4f5" }}>
            {r.t}
          </span>
          <span className="mono" style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.06em" }}>
            {r.label}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 8,
              color: "#63636b",
              letterSpacing: "0.12em",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            {r.tag}
          </span>
          <span className="mono tabular-nums" style={{ fontSize: 10, color: "#63636b" }}>
            {r.dur}
          </span>
        </div>
      ))}
    </div>
  );
}

/* --- Demo 2: COMPOUND — a growing bar chart, month over month --- */
function CompoundDemo() {
  const months = ["M1", "M2", "M3", "M4", "M5"];
  const values = [0.3, 0.42, 0.55, 0.68, 0.84];
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: "#050506",
        padding: "12px 12px 8px",
      }}
    >
      <div className="flex items-end" style={{ gap: 8, height: 64 }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", height: 50, display: "flex", alignItems: "flex-end" }}>
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: `${v * 100}%` }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  delay: i * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  width: "100%",
                  background: i === values.length - 1 ? "#ffffff" : "rgba(255,255,255,0.32)",
                }}
              />
            </div>
            <span className="mono" style={{ fontSize: 8, color: "#63636b", letterSpacing: "0.06em" }}>
              {months[i]}
            </span>
          </div>
        ))}
      </div>
      <p
        className="mono"
        style={{ fontSize: 9, color: "#63636b", marginTop: 8, letterSpacing: "0.06em", textAlign: "center" }}
      >
        clarity ↑ 180% over 5 months
      </p>
    </div>
  );
}

/* --- Demo 3: PRIVATE — local-first lock indicator --- */
function PrivateDemo() {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: "#050506",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="mono" style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.08em" }}>
          storage
        </span>
        <span
          className="mono"
          style={{
            fontSize: 9,
            color: "#f4f4f5",
            letterSpacing: "0.1em",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 4,
            padding: "2px 6px",
          }}
        >
          LOCAL
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <motion.div
          style={{ height: "100%", background: "#ffffff", width: "100%" }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="mono" style={{ fontSize: 9, color: "#63636b" }}>
          telemetry
        </span>
        <span className="mono" style={{ fontSize: 9, color: "#63636b", letterSpacing: "0.1em" }}>
          OFF
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="mono" style={{ fontSize: 9, color: "#63636b" }}>
          cloud sync
        </span>
        <span className="mono" style={{ fontSize: 9, color: "#63636b", letterSpacing: "0.1em" }}>
          NEVER
        </span>
      </div>
    </div>
  );
}

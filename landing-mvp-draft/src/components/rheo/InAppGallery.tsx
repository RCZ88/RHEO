"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useRef, useState } from "react";

const TABS = [
  { id: "timeline", label: "TIMELINE" },
  { id: "dashboard", label: "DASHBOARD" },
  { id: "ai", label: "AI · UNDERSTAND" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function InAppGallery() {
  const [tab, setTab] = useState<TabId>("timeline");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });

  return (
    <section ref={ref} id="gallery" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-10 sm:mb-14 max-w-[680px]">
          <p className="mono-label" style={{ fontSize: 11 }}>
            IN-APP · GALLERY
          </p>
          <h2 className="display-h2 mt-3">What the desktop looks like.</h2>
          <p
            className="mt-5"
            style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          >
            Three surfaces, one record. Every pixel below is drawn from divs and
            SVG — no screenshots — so you see exactly what RHEO is made of.
          </p>
        </div>

        {/* tab bar */}
        <div
          className="flex flex-wrap gap-2 mb-6"
          role="tablist"
          aria-label="RHEO interface views"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-active={tab === t.id}
              className="gallery-tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* mockup frame */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="win-frame scan-lines"
          style={{ borderRadius: 16 }}
        >
          {/* window chrome */}
          <div
            className="flex items-center gap-2 px-4"
            style={{
              height: 36,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "#050506",
            }}
          >
            <span style={dot(0.16)} />
            <span style={dot(0.1)} />
            <span style={dot(0.08)} />
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: "#63636b",
                marginLeft: 10,
                letterSpacing: "0.12em",
              }}
            >
              RHEO — {tab.toUpperCase()}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: "#63636b",
                marginLeft: "auto",
                letterSpacing: "0.12em",
              }}
            >
              100% LOCAL
            </span>
          </div>

          {/* tab body */}
          <div style={{ background: "#0a0a0c", minHeight: 420 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {tab === "timeline" && <TimelineView />}
                {tab === "dashboard" && <DashboardView />}
                {tab === "ai" && <AIView />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        <p
          className="mono-label"
          style={{ fontSize: 10, marginTop: 14, textAlign: "right" }}
        >
          mocks · no images · drawn from divs + svg
        </p>
      </div>
    </section>
  );
}

function dot(opacity: number): React.CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: `rgba(255,255,255,${opacity})`,
    display: "inline-block",
  };
}

/* ============== TIMELINE VIEW ============== */
function TimelineView() {
  const phases = [
    { h0: 0, h1: 6, label: "REST" },
    { h0: 6, h1: 9, label: "" },
    { h0: 9, h1: 12, label: "DEEP WORK" },
    { h0: 12, h1: 14, label: "MEETINGS" },
    { h0: 14, h1: 19, label: "" },
    { h0: 19, h1: 21, label: "LEARNING" },
    { h0: 21, h1: 23, label: "" },
    { h0: 23, h1: 24, label: "REST" },
  ];
  const sessions = [
    { t: "09:02", dur: "1h 48m", label: "deep work", app: "Xcode", depth: 0.9 },
    { t: "12:15", dur: "0h 42m", label: "meetings", app: "Zoom", depth: 0.4 },
    { t: "14:30", dur: "0h 15m", label: "break", app: "—", depth: 0.1 },
    { t: "19:03", dur: "1h 12m", label: "learning", app: "Books", depth: 0.75 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr]">
      {/* left rail */}
      <div
        className="hidden lg:block"
        style={{
          borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: 16,
        }}
      >
        <p className="mono-label" style={{ fontSize: 9 }}>
          NAVIGATE
        </p>
        {["Today", "Week", "Month", "Phases", "Lessons", "AI"].map((n, i) => (
          <div
            key={n}
            className="mono"
            style={{
              fontSize: 12,
              color: i === 0 ? "#f4f4f5" : "#63636b",
              padding: "8px 0",
              letterSpacing: "0.04em",
              borderLeft: i === 0 ? "1px solid #ffffff" : "1px solid transparent",
              paddingLeft: 8,
              marginLeft: -8,
            }}
          >
            {n}
          </div>
        ))}
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p className="mono-label" style={{ fontSize: 9 }}>
            FOCUS STREAK
          </p>
          <p
            className="mono tabular-nums"
            style={{ fontSize: 22, color: "#ffffff", marginTop: 4 }}
          >
            12<span style={{ color: "#63636b" }}>d</span>
          </p>
        </div>
      </div>

      {/* main: 24h timeline strip + session list */}
      <div style={{ padding: 20 }}>
        <div className="flex items-baseline justify-between" style={{ marginBottom: 16 }}>
          <h3
            style={{
              fontSize: 17,
              color: "#f4f4f5",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Today · Tuesday
          </h3>
          <span className="mono tabular-nums" style={{ fontSize: 11, color: "#a1a1aa" }}>
            4h 57m recorded
          </span>
        </div>

        {/* 24h bar */}
        <div
          style={{
            position: "relative",
            height: 34,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            background: "#050506",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          {phases.map((p, i) => {
            if (p.label === "") return null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${(p.h0 / 24) * 100}%`,
                  width: `${((p.h1 - p.h0) / 24) * 100}%`,
                  top: 0,
                  bottom: 0,
                  background:
                    p.label === "DEEP WORK"
                      ? "rgba(255,255,255,0.18)"
                      : "rgba(255,255,255,0.07)",
                  borderRight: "1px solid rgba(255,255,255,0.16)",
                }}
              />
            );
          })}
          {/* hour ticks */}
          {[0, 6, 12, 18, 24].map((t) => (
            <span
              key={t}
              className="mono"
              style={{
                position: "absolute",
                left: `${(t / 24) * 100}%`,
                top: "100%",
                transform: "translateX(-50%)",
                marginTop: 4,
                fontSize: 8,
                color: "#63636b",
                letterSpacing: "0.06em",
              }}
            >
              {String(t).padStart(2, "0")}
            </span>
          ))}
          {/* now playhead */}
          <div
            style={{
              position: "absolute",
              left: "62%",
              top: -2,
              bottom: -2,
              width: 1,
              background: "#ffffff",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -4,
                left: "50%",
                transform: "translateX(-50%)",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#ffffff",
              }}
            />
          </div>
        </div>

        {/* session list */}
        <div style={{ marginTop: 22 }}>
          {sessions.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{
                padding: "10px 0",
                borderBottom:
                  i < sessions.length - 1
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "none",
              }}
            >
              <span className="mono tabular-nums" style={{ fontSize: 11, color: "#a1a1aa", width: 44 }}>
                {s.t}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "#f4f4f5",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {s.label}
                </div>
                <div className="mono" style={{ fontSize: 9, color: "#63636b", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 1 }}>
                  {s.app}
                </div>
              </div>
              {/* depth bar */}
              <div
                style={{
                  width: 80,
                  height: 4,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${s.depth * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: "100%", background: "#ffffff" }}
                />
              </div>
              <span className="mono tabular-nums" style={{ fontSize: 11, color: "#a1a1aa", width: 56, textAlign: "right" }}>
                {s.dur}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============== DASHBOARD VIEW ============== */
function DashboardView() {
  return (
    <div style={{ padding: 20 }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontSize: 17,
            color: "#f4f4f5",
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          This week · focus by day
        </h3>
        <span className="mono" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
          Δ +12% vs last
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* big chart */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            background: "#050506",
            padding: 16,
          }}
        >
          <p className="mono-label" style={{ fontSize: 9, marginBottom: 12 }}>
            DEEP WORK · MINUTES
          </p>
          <svg viewBox="0 0 320 140" width="100%" height="150" aria-hidden>
            {/* gridlines */}
            {[35, 70, 105].map((y) => (
              <line key={y} x1={0} x2={320} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            ))}
            <line x1={0} x2={320} y1={125} y2={125} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
            {/* bars */}
            {[60, 95, 70, 110, 88, 30, 0].map((h, i) => (
              <g key={i}>
                <motion.rect
                  x={20 + i * 42}
                  width={26}
                  initial={{ height: 0, y: 125 }}
                  whileInView={{ height: h, y: 125 - h }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  fill={i === 3 ? "#ffffff" : "rgba(255,255,255,0.32)"}
                />
                <text
                  x={20 + i * 42 + 13}
                  y={135}
                  textAnchor="middle"
                  fill="#63636b"
                  style={{ fontFamily: "var(--font-mono), monospace", fontSize: 8 }}
                >
                  {["M", "T", "W", "T", "F", "S", "S"][i]}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* right column: phase donut + stats */}
        <div className="flex flex-col gap-4">
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              background: "#050506",
              padding: 16,
            }}
          >
            <p className="mono-label" style={{ fontSize: 9, marginBottom: 10 }}>
              PHASE SPLIT
            </p>
            <svg viewBox="0 0 100 100" width="100%" height="110" style={{ display: "block" }} aria-hidden>
              {/* donut segments via stroke-dasharray */}
              {[
                { seg: 0.38, off: 0, op: 1 },
                { seg: 0.22, off: 0.38, op: 0.55 },
                { seg: 0.16, off: 0.6, op: 0.4 },
                { seg: 0.24, off: 0.76, op: 0.7 },
              ].map((s, i) => (
                <motion.circle
                  key={i}
                  cx={50}
                  cy={50}
                  r={36}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={10}
                  strokeDasharray={`${s.seg * 226} 226`}
                  strokeDashoffset={-s.off * 226}
                  style={{ opacity: s.op }}
                  transform="rotate(-90 50 50)"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: s.op }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                />
              ))}
              <text
                x={50}
                y={48}
                textAnchor="middle"
                fill="#f4f4f5"
                style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11 }}
              >
                31h
              </text>
              <text
                x={50}
                y={60}
                textAnchor="middle"
                fill="#63636b"
                style={{ fontFamily: "var(--font-mono), monospace", fontSize: 6, letterSpacing: 1 }}
              >
                TOTAL
              </text>
            </svg>
          </div>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              background: "#050506",
              padding: 16,
            }}
          >
            <p className="mono-label" style={{ fontSize: 9, marginBottom: 10 }}>
              TOP APPS
            </p>
            {[
              { app: "Xcode", m: "8h 12m", w: 0.82 },
              { app: "Zoom", m: "4h 02m", w: 0.4 },
              { app: "Books", m: "3h 10m", w: 0.31 },
              { app: "Mail", m: "1h 48m", w: 0.18 },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-2" style={{ padding: "5px 0" }}>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: "#a1a1aa", width: 50, letterSpacing: "0.04em" }}
                >
                  {a.app}
                </span>
                <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${a.w * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: "100%", background: "#ffffff" }}
                  />
                </div>
                <span className="mono tabular-nums" style={{ fontSize: 10, color: "#63636b", width: 48, textAlign: "right" }}>
                  {a.m}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== AI VIEW ============== */
function AIView() {
  return (
    <div style={{ padding: 20 }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontSize: 17,
            color: "#f4f4f5",
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          Ask RHEO
        </h3>
        <span className="mono" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
          queries your record · 0 bytes leave
        </span>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          background: "#050506",
          padding: 16,
          minHeight: 280,
        }}
      >
        {/* conversation */}
        <div className="mono" style={{ fontSize: 12, color: "#f4f4f5", marginBottom: 14 }}>
          {"> why was tuesday's deep work down 22%?"}
        </div>
        <div className="flex flex-col gap-2" style={{ marginBottom: 14 }}>
          {[
            "→ querying timeline for 7-day window…",
            "→ cross-referencing calendar (3 events)…",
            "→ comparing baseline (μ=3h 02m, σ=0.21)…",
          ].map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mono"
              style={{ fontSize: 11, color: "#63636b" }}
            >
              {t}
            </motion.div>
          ))}
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          style={{ fontSize: 14, lineHeight: 1.6, color: "#f4f4f5" }}
        >
          Tuesday dropped to 2h 20m. Three meetings (09:30, 11:00, 14:15) split
          the block. Baseline is 3h. Guard 09–12 to recover — that&apos;s the
          single highest-leverage change this week.
        </motion.p>

        {/* cited sessions */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="mono-label" style={{ fontSize: 9, marginBottom: 8 }}>
            CITED FROM RECORD · 4 SESSIONS
          </p>
          <div className="flex flex-wrap gap-2">
            {["Mon 09:04 · 2h 58m", "Tue 09:30 · 0h 22m", "Tue 11:00 · 0h 38m", "Wed 09:00 · 3h 12m"].map((c, i) => (
              <span
                key={i}
                className="mono"
                style={{
                  fontSize: 9,
                  color: "#a1a1aa",
                  letterSpacing: "0.06em",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 4,
                  padding: "3px 7px",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* input */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          background: "#0a0a0c",
        }}
      >
        <span className="mono" style={{ fontSize: 12, color: "#63636b" }}>›</span>
        <span className="mono blink-cursor" style={{ fontSize: 12, color: "#ffffff" }}>▋</span>
        <span className="mono" style={{ fontSize: 11, color: "#63636b", marginLeft: "auto", letterSpacing: "0.08em" }}>
          ENTER TO ASK · ⌘K FOR HISTORY
        </span>
      </div>
    </div>
  );
}

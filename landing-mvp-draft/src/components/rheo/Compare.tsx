"use client";

import { motion, useInView } from "framer-motion";
import { Check, Minus, X, ArrowLeftRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Cell = "yes" | "no" | "partial" | string;

const ROWS: { label: string; rheo: Cell; others: Cell[]; rationale: string }[] = [
  { label: "Local-first record (no cloud by default)", rheo: "yes", others: ["no", "no", "partial"], rationale: "Your hours live on your disk. Other trackers sync by default; RHEO syncs never." },
  { label: "AI that queries your own data", rheo: "yes", others: ["no", "partial", "no"], rationale: "The AI reads your local record — not a generic model trained on aggregate data." },
  { label: "Phase-based timeline (not just apps)", rheo: "yes", others: ["partial", "no", "no"], rationale: "Apps are noise; phases are signal. RHEO tags time by intent, not by window title." },
  { label: "Answers cite source sessions", rheo: "yes", others: ["no", "no", "no"], rationale: "Every claim links back to the exact sessions it came from. Receipts, not guesses." },
  { label: "Lessons that redraw as you grow", rheo: "yes", others: ["no", "no", "no"], rationale: "Insights are a living document — they update when your record changes." },
  { label: "One-time license (no subscription)", rheo: "yes", others: ["no", "no", "partial"], rationale: "You buy it once. No recurring billing for the thing that records your life." },
  { label: "Zero telemetry, verifiable", rheo: "yes", others: ["no", "partial", "no"], rationale: "No analytics, no phoning home. Inspectable network traffic, by design." },
  { label: "Open export format (redacted)", rheo: "yes", others: ["partial", "no", "partial"], rationale: "Export your record in an open format, with personal data redacted by default." },
  { label: "TUI / keyboard-driven workspace", rheo: "yes", others: ["no", "no", "no"], rationale: "The whole app is navigable from the keyboard. A TUI for people who type." },
  { label: "Cross-platform (mac/win/linux, one purchase)", rheo: "yes", others: ["partial", "partial", "yes"], rationale: "One license, every platform. No per-OS upsell." },
];

const OTHERS = ["TOGGL", "RESCUE TIME", "CLOCKIFY"];

export default function Compare() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });
  const [flipped, setFlipped] = useState(false);

  // 'F' keyboard shortcut to flip, active when the section is on screen
  const sectionInView = useInView(ref, { margin: "-40% 0px -40% 0px" });
  useEffect(() => {
    if (!sectionInView) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
        return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sectionInView]);

  // column order: default = [CAPABILITY, RHEO, ...OTHERS]; flipped = [CAPABILITY, ...OTHERS, RHEO]
  const colHeaders = flipped ? [...OTHERS, "RHEO"] : ["RHEO", ...OTHERS];

  return (
    <section ref={ref} id="compare" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-10 sm:mb-14 max-w-[680px]">
          <p className="mono-label kicker-rise" style={{ fontSize: 11 }}>
            COMPARE
          </p>
          <h2 className="display-h2 mt-3 kicker-rise">How RHEO lines up.</h2>
          <p
            className="mt-5"
            style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          >
            Not a feature checklist — a values checklist. The other trackers are
            good at counting. RHEO is built to understand.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="surface-panel scan-lines"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ maxHeight: 560, overflowY: "auto" }} className="no-scrollbar">
            <table className="compare-table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>CAPABILITY</th>
                  {colHeaders.map((c) => (
                    <th
                      key={c}
                      className={c === "RHEO" ? "rheo-col" : ""}
                      style={{ textAlign: "center", width: c === "RHEO" ? "18%" : "14%" }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => {
                  const cells = flipped
                    ? [...r.others, r.rheo]
                    : [r.rheo, ...r.others];
                  return (
                    <tr key={i}>
                      <th scope="row">
                        <span
                          className="compare-row-label"
                          data-pos={i < 2 ? "below" : "above"}
                          tabIndex={0}
                          role="button"
                          aria-label={`Explanation: ${r.label}`}
                          onClick={(e) => {
                            const el = e.currentTarget;
                            el.setAttribute(
                              "data-open",
                              el.getAttribute("data-open") === "true"
                                ? "false"
                                : "true"
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              const el = e.currentTarget;
                              el.setAttribute(
                                "data-open",
                                el.getAttribute("data-open") === "true"
                                  ? "false"
                                  : "true"
                              );
                            }
                          }}
                        >
                          {r.label}
                          <span className="compare-row-tip" role="tooltip">
                            {r.rationale}
                          </span>
                        </span>
                      </th>
                      {cells.map((cell, j) => (
                        <td
                          key={j}
                          className={
                            (flipped ? j === cells.length - 1 : j === 0)
                              ? "rheo-col"
                              : ""
                          }
                          style={{ textAlign: "center" }}
                        >
                          <CellIcon
                            value={cell}
                            strong={
                              flipped ? j === cells.length - 1 : j === 0
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2" style={{ marginTop: 16 }}>
          <LegendItem icon="yes" label="Full support" />
          <LegendItem icon="partial" label="Partial / add-on" />
          <LegendItem icon="no" label="Not available" />
          <button
            type="button"
            className="compare-toggle"
            data-flipped={flipped}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "Move RHEO column to left" : "Move RHEO column to right"}
            style={{ marginLeft: "auto" }}
          >
            <span className="compare-toggle-icon">
              <ArrowLeftRight size={11} strokeWidth={1.75} />
            </span>
            {flipped ? "RHEO RIGHT" : "RHEO LEFT"}
            <span className="kbd" style={{ height: 16, fontSize: 8, marginLeft: 4 }}>F</span>
          </button>
        </div>
        <div className="flex justify-end" style={{ marginTop: 6 }}>
          <span className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.08em" }}>
            surveyed 2026-08 · values, not feature counts
          </span>
        </div>
      </div>
    </section>
  );
}

function CellIcon({ value, strong }: { value: Cell; strong?: boolean }) {
  const base = strong ? 16 : 14;
  if (value === "yes")
    return (
      <Check
        size={base}
        strokeWidth={2}
        style={{ color: strong ? "#ffffff" : "#a1a1aa", display: "inline-block" }}
      />
    );
  if (value === "partial")
    return (
      <Minus
        size={base}
        strokeWidth={2}
        style={{ color: "#63636b", display: "inline-block" }}
      />
    );
  if (value === "no")
    return (
      <X
        size={base}
        strokeWidth={2}
        style={{ color: "#63636b", display: "inline-block" }}
      />
    );
  return (
    <span className="mono" style={{ fontSize: 10, color: "#a1a1aa" }}>
      {value}
    </span>
  );
}

function LegendItem({ icon, label }: { icon: Cell; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <CellIcon value={icon} />
      <span className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}

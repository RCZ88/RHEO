"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

type Entry = {
  version: string;
  date: string;
  kind: "FIX" | "NEW" | "CHG";
  notes: string[];
};

const ENTRIES: Entry[] = [
  {
    version: "v0.1.0",
    date: "2026-08-31",
    kind: "NEW",
    notes: [
      "First public preview build. Timeline, phases, AI-understand, lessons engine.",
      "Local-first by default. Zero telemetry. macOS / Windows / Linux.",
      "Reduced-motion mode renders scrub sections as static panels.",
    ],
  },
  {
    version: "v0.0.9",
    date: "2026-08-24",
    kind: "CHG",
    notes: [
      "Refined phase-detection heuristics — fewer false 'meeting' tags during solo calls.",
      "Dashboard donut now reflects weighted depth, not raw duration.",
    ],
  },
  {
    version: "v0.0.8",
    date: "2026-08-17",
    kind: "FIX",
    notes: [
      "Fixed a rare crash when a session spanned midnight across timezones.",
      "Stopped the AI panel re-querying on every keystroke; Enter is now explicit.",
    ],
  },
  {
    version: "v0.0.7",
    date: "2026-08-10",
    kind: "NEW",
    notes: [
      "Added cited-session chips under every AI answer — receipts, not guesses.",
      "Lessons now redraw when a referenced session is deleted or re-tagged.",
    ],
  },
];

const KIND_STYLE: Record<Entry["kind"], { color: string; bg: string; label: string }> = {
  NEW: { color: "#f4f4f5", bg: "rgba(255,255,255,0.16)", label: "NEW" },
  FIX: { color: "#a1a1aa", bg: "rgba(255,255,255,0.08)", label: "FIX" },
  CHG: { color: "#a1a1aa", bg: "rgba(255,255,255,0.08)", label: "CHG" },
};

export default function Changelog() {
  const [open, setOpen] = useState(false);

  // listen for a custom event from the Download "Read the changelog →" link
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("rheo:open-changelog", handler);
    return () => window.removeEventListener("rheo:open-changelog", handler);
  }, []);

  // lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="RHEO changelog"
        >
          <motion.div
            initial={{ scale: 0.97, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 12 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="surface-panel sheen-top"
            style={{
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 16,
              width: "min(640px, 94vw)",
              maxHeight: "86vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* header */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <p className="mono-label" style={{ fontSize: 10 }}>
                  CHANGELOG
                </p>
                <h3
                  style={{
                    fontSize: 22,
                    color: "#f4f4f5",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    marginTop: 4,
                  }}
                >
                  What changed in RHEO
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close changelog"
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "#a1a1aa",
                  cursor: "pointer",
                  transition: "color 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s cubic-bezier(0.16,1,0.3,1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#a1a1aa";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {/* entries */}
            <div style={{ overflowY: "auto", padding: "8px 24px 24px" }}>
              {ENTRIES.map((e, i) => {
                const ks = KIND_STYLE[e.kind];
                return (
                  <div
                    key={i}
                    style={{
                      paddingTop: i === 0 ? 16 : 24,
                      paddingBottom: i < ENTRIES.length - 1 ? 24 : 0,
                      borderBottom:
                        i < ENTRIES.length - 1
                          ? "1px solid rgba(255,255,255,0.06)"
                          : "none",
                    }}
                  >
                    <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                      <span className="mono" style={{ fontSize: 14, color: "#ffffff", letterSpacing: "-0.01em", fontWeight: 500 }}>
                        {e.version}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          color: ks.color,
                          letterSpacing: "0.12em",
                          background: ks.bg,
                          borderRadius: 4,
                          padding: "2px 6px",
                        }}
                      >
                        {ks.label}
                      </span>
                      <span className="mono tabular-nums" style={{ fontSize: 10, color: "#63636b", marginLeft: "auto" }}>
                        {e.date}
                      </span>
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {e.notes.map((n, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2"
                          style={{ fontSize: 13, lineHeight: 1.6, color: "#a1a1aa" }}
                        >
                          <span style={{ color: "#63636b", flexShrink: 0, marginTop: 7, width: 4, height: 1, background: "#63636b" }} />
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

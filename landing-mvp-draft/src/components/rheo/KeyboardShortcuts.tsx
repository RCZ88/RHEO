"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const SHORTCUTS = [
  { keys: ["?"], desc: "Toggle this overlay" },
  { keys: ["⌘", "K"], desc: "Command palette" },
  { keys: ["J"], desc: "Next section" },
  { keys: ["K"], desc: "Previous section" },
  { keys: ["F"], desc: "Flip the compare table" },
  { keys: ["G", "D"], desc: "Jump to download" },
  { keys: ["G", "H"], desc: "Back to top" },
  { keys: ["Esc"], desc: "Close overlay / menu" },
];

const SECTION_IDS = [
  "hero",
  "manifesto",
  "act-record",
  "capabilities",
  "gallery",
  "understand",
  "learn",
  "design",
  "principles",
  "compare",
  "testimonials",
  "flow",
  "pricing",
  "faq",
  "download",
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const goToSection = (dir: 1 | -1) => {
      const y = window.scrollY + window.innerHeight * 0.35;
      let idx = SECTION_IDS.findIndex((id) => {
        const el = document.getElementById(id);
        return el && el.offsetTop + el.offsetHeight > y;
      });
      if (idx === -1) idx = SECTION_IDS.length - 1;
      const next = Math.max(0, Math.min(SECTION_IDS.length - 1, idx + dir));
      const el = document.getElementById(SECTION_IDS[next]);
      el?.scrollIntoView({ behavior: "smooth" });
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Esc always closes
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (typing) return;

      // ? toggles overlay (Shift+/ on most layouts)
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // J / K section nav
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        goToSection(1);
        return;
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        goToSection(-1);
        return;
      }
      // G D → download, G H → top (two-key)
      if (e.key === "g" || e.key === "G") {
        const handler = (e2: KeyboardEvent) => {
          if (e2.key === "d" || e2.key === "D") {
            e2.preventDefault();
            document.getElementById("download")?.scrollIntoView({ behavior: "smooth" });
          } else if (e2.key === "h" || e2.key === "H") {
            e2.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          window.removeEventListener("keydown", handler);
        };
        window.addEventListener("keydown", handler, { once: true });
        setTimeout(() => window.removeEventListener("keydown", handler), 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="kbd-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="surface-panel sheen-top"
              style={{
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 16,
                padding: 28,
                width: "min(440px, 92vw)",
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                <p className="mono-label" style={{ fontSize: 11 }}>
                  KEYBOARD
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close shortcuts"
                  className="mono"
                  style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em", cursor: "pointer", background: "transparent", border: "none" }}
                >
                  ESC ✕
                </button>
              </div>
              <h3
                style={{
                  fontSize: 22,
                  color: "#f4f4f5",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  marginBottom: 18,
                }}
              >
                Move through the page without a mouse.
              </h3>
              <div className="flex flex-col" style={{ gap: 12 }}>
                {SHORTCUTS.map((s) => (
                  <div
                    key={s.desc}
                    className="flex items-center justify-between"
                    style={{ gap: 16 }}
                  >
                    <span style={{ fontSize: 14, color: "#a1a1aa" }}>{s.desc}</span>
                    <div className="flex items-center gap-1.5">
                      {s.keys.map((k, i) => (
                        <span key={i} className="kbd">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p
                className="mono-label"
                style={{ fontSize: 9, marginTop: 18, textAlign: "center" }}
              >
                Press ? anywhere to reopen · Esc to dismiss
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* discoverable hint button (bottom-left, always visible) */}
      <button
        type="button"
        aria-label="Keyboard shortcuts"
        className="kbd-hint"
        onClick={() => setOpen(true)}
      >
        <span className="mono" style={{ fontSize: 13 }}>?</span>
      </button>
    </>
  );
}

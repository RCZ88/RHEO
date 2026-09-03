"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    q: "Is my time data really kept local?",
    a: "Yes. RHEO is local-first. The record, the AI queries, and the lessons all run on your machine. The bytes-sent-to-cloud counter in our stats band is not a marketing flourish — it is literally zero, by architecture. Optional redacted exports are the only thing that ever leaves, and only when you choose to share.",
  },
  {
    q: "Which platforms does it run on?",
    a: "macOS (Apple Silicon + Intel), Windows 10/11, and common Linux distributions. The download button detects your OS automatically. All builds are SHA-256 verified and signed.",
  },
  {
    q: "How does it know what I'm focusing on?",
    a: "RHEO observes active application focus and window titles — never content, never keystrokes. It tags each block against the phases you define (deep work, meetings, learning, rest). You see the raw timeline; the AI sees the same timeline. Nothing is inferred that you cannot inspect.",
  },
  {
    q: "What does the AI actually do?",
    a: "It queries your own record and answers with receipts — not guesses. Ask why a phase was down, what drained an afternoon, or when you learn best, and it cross-references the timeline, your calendar, and a rolling baseline. Every answer links back to the sessions it used.",
  },
  {
    q: "Can I edit or delete my record?",
    a: "Always. The record is yours. You can merge, re-tag, split, or delete any session. Lessons that depended on a deleted session redraw themselves automatically — understanding is never frozen.",
  },
  {
    q: "Is there a free tier?",
    a: "RHEO is a one-time purchase, not a subscription. The first 30 days are a full trial — no card, no telemetry. If it doesn't make your time legible, it costs nothing.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[920px] mx-auto">
        <div className="mb-12 sm:mb-16">
          <p className="mono-label" style={{ fontSize: 11 }}>
            FAQ
          </p>
          <h2 className="display-h2 mt-3">Questions, answered straight.</h2>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between text-left"
                  style={{ padding: "20px 0", gap: 16 }}
                >
                  <span
                    style={{
                      fontSize: 17,
                      color: "#f4f4f5",
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {f.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      flexShrink: 0,
                      color: isOpen ? "#ffffff" : "#63636b",
                      transition: "color 0.3s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    <Plus size={18} strokeWidth={1.5} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <p
                        style={{
                          fontSize: 14,
                          lineHeight: 1.65,
                          color: "#a1a1aa",
                          paddingBottom: 22,
                          maxWidth: 680,
                        }}
                      >
                        {f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const QUOTES = [
  {
    quote:
      "I stopped estimating my week and started knowing it. RHEO's record replaced three spreadsheets and a guilt complex.",
    name: "Mira Okafor",
    role: "Principal Designer, Form Studio",
    metric: "11h saved weekly on admin",
  },
  {
    quote:
      "The AI doesn't summarize my time — it explains it. It caught that Tuesdays were thin because of a recurring 11am meeting I'd stopped noticing.",
    name: "Devan Rao",
    role: "Research Lead, Axiom Labs",
    metric: "deep work ↑ 34% in 6 weeks",
  },
  {
    quote:
      "Local-first isn't a feature for us, it's the whole point. Our hours are ours. RHEO is the only tracker our security team cleared.",
    name: "Hana Lindqvist",
    role: "CTO, Meridian",
    metric: "0 bytes sent to cloud",
  },
  {
    quote:
      "I bought it to track time. I kept it because the lessons redraw themselves — month two is genuinely sharper than month one.",
    name: "Theo Marchetti",
    role: "Writer, Obsidian Press",
    metric: "retention +2.1× at 19:00",
  },
];

export default function Testimonials() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px" });
  const [idx, setIdx] = useState(0);

  // auto-advance ~6s, pause offscreen
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(
      () => setIdx((i) => (i + 1) % QUOTES.length),
      6000
    );
    return () => clearInterval(id);
  }, [inView]);

  const q = QUOTES[idx];

  return (
    <section ref={ref} id="testimonials" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[920px] mx-auto">
        <div className="mb-10 sm:mb-14 text-center">
          <p className="mono-label kicker-rise" style={{ fontSize: 11 }}>
            FROM THE RECORD
          </p>
          <h2 className="display-h2 mt-3 kicker-rise">People who measure, change.</h2>
        </div>

        <div
          className="surface-panel sheen-top relative"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "32px 28px",
            minHeight: 240,
          }}
        >
          {/* giant quote mark */}
          <span
            aria-hidden
            className="serif-italic"
            style={{
              position: "absolute",
              top: 12,
              left: 22,
              fontSize: 64,
              color: "rgba(255,255,255,0.08)",
              lineHeight: 1,
              pointerEvents: "none",
            }}
          >
            “
          </span>

          <div className="testimonial-track" style={{ minHeight: 150 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <p
                  style={{
                    fontSize: "clamp(18px, 2.2vw, 24px)",
                    lineHeight: 1.45,
                    color: "#f4f4f5",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {q.quote}
                </p>
                <div
                  className="flex items-center justify-between"
                  style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div>
                    <p style={{ fontSize: 14, color: "#f4f4f5", fontWeight: 500 }}>
                      {q.name}
                    </p>
                    <p className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.1em", marginTop: 2 }}>
                      {q.role}
                    </p>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "#f4f4f5",
                      letterSpacing: "0.06em",
                      border: "1px solid rgba(255,255,255,0.16)",
                      borderRadius: 4,
                      padding: "4px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {q.metric}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* dots */}
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 22 }}>
          {QUOTES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show testimonial ${i + 1}`}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 24 : 6,
                height: 6,
                borderRadius: 3,
                background:
                  i === idx ? "#ffffff" : "rgba(255,255,255,0.16)",
                border: "none",
                cursor: "pointer",
                transition: "width 0.4s cubic-bezier(0.16,1,0.3,1), background 0.4s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

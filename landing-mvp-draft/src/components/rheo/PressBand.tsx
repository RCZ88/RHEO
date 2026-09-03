"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const PRESS = [
  {
    outlet: "THE VERGE",
    quote: "The first time tracker that feels like an instrument, not an alarm.",
  },
  {
    outlet: "WIR ED",
    quote: "Local-first AI with receipts. RHEO may be the honest tracker we asked for.",
  },
  {
    outlet: "FAST COMPANY",
    quote: "Turns the humble timesheet into something closer to a lab notebook.",
  },
  {
    outlet: "MACSTORIES",
    quote: "The scrubbing timeline alone is worth the download. The AI is the bonus.",
  },
  {
    outlet: "HACKER NEWS",
    quote: "Zero telemetry, one-time purchase, cited answers. This is how it's done.",
  },
  {
    outlet: "MONOCLE",
    quote: "A study in restraint — monochrome, mathematical, quietly radical.",
  },
];

export default function PressBand() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });

  return (
    <section
      className="surface-page hairline-t hairline-b"
      style={{ borderTopColor: "rgba(255,255,255,0.08)", borderBottomColor: "rgba(255,255,255,0.08)" }}
    >
      <div ref={ref} className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto py-14 sm:py-16">
        <p className="mono-label" style={{ fontSize: 11, textAlign: "center", marginBottom: 20 }}>
          MENTIONED IN PASSING
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.06)" }}>
          {PRESS.map((p, i) => (
            <motion.figure
              key={p.outlet}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="surface-page flex flex-col"
              style={{ padding: 22, gap: 12, minHeight: 160 }}
            >
              <figcaption
                className="mono"
                style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.16em" }}
              >
                {p.outlet}
              </figcaption>
              <blockquote
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "#f4f4f5",
                  letterSpacing: "-0.005em",
                }}
              >
                “{p.quote}”
              </blockquote>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

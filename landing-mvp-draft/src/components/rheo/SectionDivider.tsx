"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

/**
 * A thin centered hairline divider with a mono numeral — used between
 * major sections to add visual rhythm and reinforce the "acts" structure.
 * Lines + numeral fade/scale in on first inView (one-time reveal).
 */
export default function SectionDivider({ num }: { num: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px", once: true });

  return (
    <div ref={ref} className="section-divider" aria-hidden>
      <motion.div
        className="section-divider-line"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={inView ? { opacity: 1, scaleX: 1 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ originX: 1 }}
      />
      <motion.span
        className="section-divider-num"
        initial={{ opacity: 0, y: 6 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        {num}
      </motion.span>
      <motion.div
        className="section-divider-line"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={inView ? { opacity: 1, scaleX: 1 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ originX: 0 }}
      />
    </div>
  );
}

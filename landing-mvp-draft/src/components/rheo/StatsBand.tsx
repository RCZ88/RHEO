"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const STATS = [
  { value: 1204032, suffix: " s", label: "OBSERVED BY USERS", fmt: "comma" },
  { value: 99.4, suffix: "%", label: "FOCUS CAPTURED LOCALLY", fmt: "decimal1" },
  { value: 47, suffix: "ms", label: "MEDIAN QUERY TIME", fmt: "int" },
  { value: 0, suffix: "", label: "BYTES SENT TO CLOUD", fmt: "int" },
];

function fmt(n: number, kind: string): string {
  if (kind === "comma") return n.toLocaleString("en-US");
  if (kind === "decimal1") return n.toFixed(1);
  return Math.round(n).toString();
}

export default function StatsBand() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });

  return (
    <section className="surface-panel hairline-t hairline-b" style={{ borderTopColor: "rgba(255,255,255,0.08)", borderBottomColor: "rgba(255,255,255,0.08)" }}>
      <div ref={ref} className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto py-10 sm:py-14">
        <p className="mono-label mb-8" style={{ fontSize: 11 }}>
          THE RECORD, IN NUMBERS
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={{
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                paddingLeft: 14,
              }}
            >
              <Counter value={s.value} fmt={s.fmt} suffix={s.suffix} run={inView} />
              <p
                className="mono-label"
                style={{ fontSize: 10, marginTop: 8 }}
              >
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Counter({
  value,
  fmt: fmtKind,
  suffix,
  run,
}: {
  value: number;
  fmt: string;
  suffix: string;
  run: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!run) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      return;
    }
    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, value]);

  return (
    <span
      className="mono tabular-nums"
      style={{
        fontSize: "clamp(26px, 3.4vw, 42px)",
        color: "#ffffff",
        letterSpacing: "-0.02em",
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      {fmt(display, fmtKind)}
      <span style={{ color: "#63636b" }}>{suffix}</span>
    </span>
  );
}

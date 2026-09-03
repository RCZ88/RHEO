"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const WAVES = [
  { y: 80, calm: calmPath(80, 0), chaotic: chaosPath(80, 0), opacity: 0.2 },
  { y: 140, calm: calmPath(140, 1), chaotic: chaosPath(140, 1), opacity: 0.16 },
  { y: 200, calm: calmPath(200, 2), chaotic: chaosPath(200, 2), opacity: 0.14 },
  { y: 260, calm: calmPath(260, 3), chaotic: chaosPath(260, 3), opacity: 0.12 },
  { y: 320, calm: calmPath(320, 4), chaotic: chaosPath(320, 4), opacity: 0.1 },
];

function calmPath(y: number, seed: number): string {
  const s = seed * 13;
  return `M 0 ${y} C ${120 + s} ${y - 18}, ${240 - s} ${y + 16}, ${360 + s} ${y - 8} C ${480 - s} ${y + 20}, ${600 + s} ${y - 14}, ${720} ${y} C ${840 - s} ${y + 12}, ${960 + s} ${y - 18}, ${1080} ${y}`;
}
function chaosPath(y: number, seed: number): string {
  const s = seed * 7;
  return `M 0 ${y} C ${60 + s} ${y - 40}, ${120 - s} ${y + 50}, ${200 + s} ${y - 30} C ${280 - s} ${y + 44}, ${360 + s} ${y - 48}, ${440 - s} ${y + 30} C ${520 + s} ${y - 50}, ${600 - s} ${y + 40}, ${680 + s} ${y - 26} C ${760 - s} ${y + 48}, ${840 + s} ${y - 40}, ${920 - s} ${y + 30} C ${1000 + s} ${y - 22}, ${1040} ${y}, ${1080} ${y}`;
}

export default function ActFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // chaotic → calm crossfade across the section
  const chaoticOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const calmOpacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  // subtle parallax — each wave set drifts vertically with scroll (transform-only)
  // disabled under reduced-motion
  const calmY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const chaoticY = useTransform(scrollYProgress, [0, 1], [0, 30]);

  return (
    <section ref={ref} id="flow" className="relative surface-page" style={{ height: reduced ? "auto" : "150vh" }}>
      <div className={reduced ? "relative overflow-hidden" : "sticky top-0 overflow-hidden"} style={{ height: reduced ? 480 : "100dvh" }}>
        {/* ridgeline waves — under reduced-motion show only calm, fully visible */}
        <div className="absolute inset-0">
          <svg
            viewBox="0 0 1080 400"
            preserveAspectRatio="none"
            width="100%"
            height="100%"
            aria-hidden
            style={{ position: "absolute", inset: 0 }}
          >
            {/* calm set */}
            <motion.g style={{ opacity: reduced ? 1 : calmOpacity, y: reduced ? 0 : calmY }}>
              {WAVES.map((w, i) => (
                <path
                  key={`c${i}`}
                  d={w.calm}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  opacity={w.opacity}
                />
              ))}
            </motion.g>
            {/* chaotic set */}
            {!reduced && (
              <motion.g style={{ opacity: chaoticOpacity, y: chaoticY }}>
                {WAVES.map((w, i) => (
                  <path
                    key={`x${i}`}
                    d={w.chaotic}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={1.2}
                    opacity={w.opacity}
                  />
                ))}
              </motion.g>
            )}
          </svg>
        </div>

        {/* centered giant RHEO — under reduced-motion all letters full opacity */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
          <div
            className="flex items-center justify-center"
            style={{ gap: "0.04em" }}
          >
            {"RHEO".split("").map((ch, i) => {
              const start = 0.15 + i * 0.12;
              const end = start + 0.18;
              return (
                <Letter
                  key={i}
                  ch={ch}
                  progress={scrollYProgress}
                  start={start}
                  end={end}
                  forceVisible={reduced}
                />
              );
            })}
          </div>

          <motion.p
            className="serif-italic"
            style={{
              fontSize: "clamp(16px, 2.2vw, 24px)",
              color: "#a1a1aa",
              marginTop: 8,
            }}
            initial={{ opacity: 0 }}
          >
            <FadeOnProgress progress={scrollYProgress} start={0.6} end={0.85} forceVisible={reduced}>
              ῥέω — to flow
            </FadeOnProgress>
          </motion.p>

          <motion.p
            className="mt-6"
            style={{ fontSize: 15, color: "#63636b", letterSpacing: "0.02em" }}
          >
            <FadeOnProgress progress={scrollYProgress} start={0.7} end={0.95} forceVisible={reduced}>
              Time doesn&apos;t come back. Understanding compounds.
            </FadeOnProgress>
          </motion.p>
        </div>
      </div>
    </section>
  );
}

function Letter({
  ch,
  progress,
  start,
  end,
  forceVisible,
}: {
  ch: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
  forceVisible?: boolean;
}) {
  const opacity = useTransform(progress, [start, end], [forceVisible ? 1 : 0.08, 1]);
  const y = useTransform(progress, [start, end], [forceVisible ? 0 : 12, 0]);
  return (
    <motion.span
      className="display-h1"
      style={{ opacity, y, display: "inline-block" }}
    >
      {ch}
    </motion.span>
  );
}

function FadeOnProgress({
  children,
  progress,
  start,
  end,
  forceVisible,
}: {
  children: React.ReactNode;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
  forceVisible?: boolean;
}) {
  const opacity = useTransform(progress, [start, end], [forceVisible ? 1 : 0, 1]);
  const y = useTransform(progress, [start, end], [forceVisible ? 0 : 6, 0]);
  return (
    <motion.span style={{ opacity, y, display: "inline-block" }}>
      {children}
    </motion.span>
  );
}

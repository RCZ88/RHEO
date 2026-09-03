"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";
import VariableProximity from "./VariableProximity";

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

  // letters reveal across the section
  const lettersOpacity = useTransform(
    scrollYProgress,
    [0.15 + 0.5 * (0 / WAVES.length), 0.15 + 0.5 * (WAVES.length / WAVES.length)],
    [0, 1]
  );

  // both text lines fade in [0.65, 0.80], hold through p=1
  const textOpacity = useTransform(scrollYProgress, [0.65, 0.80], [0, 1]);

  // chaotic → calm crossfade across the section
  const chaoticOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const calmOpacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  // subtle parallax — each wave set drifts vertically with scroll (transform-only)
  const calmY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const chaoticY = useTransform(scrollYProgress, [0, 1], [0, 30]);

  // giant RHEO opacity reveals across the section
  const rheoOpacity = useTransform(scrollYProgress, [0.15, 0.55], [0.08, 1]);

  // resting ghost of RHEO at 10% opacity, always present
  const ghostOpacity = useTransform(scrollYProgress, [0, 1], [0.1, 0.1]);

  return (
    <section ref={ref} id="flow" className="relative surface-page" style={{ height: "180vh" }}>
      <div className="sticky top-0 overflow-hidden" style={{ height: "100dvh" }}>
        {/* ridgeline waves */}
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
            <motion.g style={{ opacity: calmOpacity, y: calmY }}>
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
          </svg>
        </div>

        {/* resting ghost of RHEO */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
          <motion.div
            className="display-h1"
            style={{ opacity: ghostOpacity }}
            aria-hidden
          >
            <VariableProximity text="RHEO" className="display-h1" baseWeight={500} peakWeight={700} radius={200} />
          </motion.div>
        </div>

        {/* centered giant RHEO — variable proximity weight */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
          <motion.div
            className="display-h1"
            style={{ opacity: rheoOpacity }}
          >
            <VariableProximity text="RHEO" className="display-h1" baseWeight={500} peakWeight={700} radius={200} />
          </motion.div>

          <motion.p
            className="serif-italic"
            style={{
              fontSize: "clamp(16px, 2.2vw, 24px)",
              color: "#a1a1aa",
              marginTop: 8,
            }}
          >
            <FadeOnProgress progress={scrollYProgress} start={0.6} end={0.85}>
              ῥέω — to flow
            </FadeOnProgress>
          </motion.p>

          <motion.p
            className="mt-6"
            style={{ fontSize: 15, color: "#63636b", letterSpacing: "0.02em" }}
          >
            <FadeOnProgress progress={scrollYProgress} start={0.7} end={0.95}>
              Time doesn&apos;t come back. Understanding compounds.
            </FadeOnProgress>
          </motion.p>

          <motion.p
            className="mt-3"
            style={{ fontSize: 13, color: "#63636b", letterSpacing: "0.02em", maxWidth: 520, textAlign: "center" }}
          >
            <FadeOnProgress progress={scrollYProgress} start={0.82} end={0.99}>
              And it grows — every instrument in the Atlas can be built from inside RHEO. By anyone.
            </FadeOnProgress>
          </motion.p>
        </div>
      </div>
    </section>
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

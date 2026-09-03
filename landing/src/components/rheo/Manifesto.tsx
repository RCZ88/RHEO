"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import DecryptedText from "./DecryptedText";

const MANIFESTO =
  "Your hours are the only currency you can never earn back. RHEO records how they flow — so every phase of your life can be seen, questioned, and improved.";

export default function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const words = MANIFESTO.split(" ");
  const HOLD = 0.95;

  // the time-flow line draws left→right as you scroll through
  const lineDraw = useTransform(scrollYProgress, [0.1, 0.8], ["0%", "100%"]);

  return (
    <section
      ref={ref}
      id="manifesto"
      className="relative surface-page"
      style={{ height: "100dvh" }}
    >
      <div
        className="sticky top-0 flex items-center justify-center"
        style={{ height: "100dvh" }}
      >
        <div className="px-5 sm:px-10 max-w-[860px] mx-auto text-center">
          <p className="mono-label mb-10" style={{ fontSize: 11 }}>
            <DecryptedText text="SECTION 01 / OBSERVE" speed={28} maxIterations={6} />
          </p>

          <h2
            className="display-manifesto"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.22em",
            }}
          >
            {words.map((w, i) => {
              const start = 0.05 + 0.7 * (i / words.length);
              const end = 0.05 + 0.7 * ((i + 1) / words.length);
              return (
                <WordReveal
                  key={i}
                  word={w}
                  progress={scrollYProgress}
                  start={start}
                  end={end}
                  hold={HOLD}
                />
              );
            })}
          </h2>

          {/* time-flow line — draws as you scroll, reinforcing "time flows" */}
          <div
            style={{
              marginTop: 40,
              height: 1,
              background: "rgba(255,255,255,0.06)",
              position: "relative",
              maxWidth: 400,
              marginLeft: "auto",
              marginRight: "auto",
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: lineDraw,
                background: "#ffffff",
                opacity: 0.4,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function WordReveal({
  word,
  progress,
  start,
  end,
  hold,
}: {
  word: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
  hold: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.15, 1]);
  void hold;
  return (
    <motion.span style={{ opacity, display: "inline-block" }}>{word}</motion.span>
  );
}

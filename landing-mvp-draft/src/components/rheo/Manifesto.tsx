"use client";

import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const MANIFESTO =
  "Your hours are the only currency you can never earn back. RHEO records how they flow — so every phase of your life can be seen, questioned, and improved.";

const MARQUEE = "TRACK · REFLECT · LEARN · FLOW · ";

export default function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // reveal word-by-word as progress passes its index
  const words = MANIFESTO.split(" ");

  // marquee pause when offscreen
  const trackRef = useRef<HTMLDivElement>(null);
  const inView = useInView(trackRef, { margin: "-10% 0px -10% 0px" });

  return (
    <section
      ref={ref}
      id="manifesto"
      className="relative surface-page"
      style={{ height: "120vh" }}
    >
      {/* sticky centered text */}
      <div
        className="sticky top-0 flex items-center justify-center"
        style={{ height: "100dvh" }}
      >
        <div className="px-5 sm:px-10 max-w-[1000px] mx-auto text-center">
          <p className="mono-label mb-8" style={{ fontSize: 11 }}>
            SECTION 01 / OBSERVE
          </p>
          <h2
            className="display-manifesto"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.28em",
            }}
          >
            {words.map((w, i) => {
              const start = i / words.length;
              const end = (i + 1) / words.length;
              return (
                <WordReveal
                  key={i}
                  word={w}
                  progress={scrollYProgress}
                  start={start}
                  end={end}
                />
              );
            })}
          </h2>
        </div>
      </div>

      {/* marquee band */}
      <div
        ref={trackRef}
        className="absolute bottom-0 left-0 right-0 hairline-t hairline-b surface-panel"
        style={{
          borderTopColor: "rgba(255,255,255,0.08)",
          borderBottomColor: "rgba(255,255,255,0.08)",
        }}
      >
        {/* row A — scroll left */}
        <div className="overflow-hidden" style={{ padding: "10px 0" }}>
          <div
            className={`whitespace-nowrap mono ${
              inView ? "marquee-track-left" : "marquee-track-left marquee-paused"
            }`}
            style={{
              fontSize: 12,
              color: "#63636b",
              letterSpacing: "0.16em",
              display: "inline-block",
            }}
          >
            <span>
              {MARQUEE.repeat(8)}
              {MARQUEE.repeat(8)}
            </span>
          </div>
        </div>
        {/* row B — scroll right */}
        <div className="overflow-hidden" style={{ padding: "10px 0" }}>
          <div
            className={`whitespace-nowrap mono ${
              inView ? "marquee-track-right" : "marquee-track-right marquee-paused"
            }`}
            style={{
              fontSize: 12,
              color: "#63636b",
              letterSpacing: "0.16em",
              display: "inline-block",
            }}
          >
            <span>
              {MARQUEE.repeat(8)}
              {MARQUEE.repeat(8)}
            </span>
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
}: {
  word: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.15, 1]);
  return (
    <motion.span style={{ opacity, display: "inline-block" }}>{word}</motion.span>
  );
}

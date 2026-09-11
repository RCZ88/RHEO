"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Fixed right-edge "day ruler". Hidden below 1024px.
 * Vertical hairline, 24 ticks, mono labels 00/06/12/18/24 at 10px.
 * 2px white playhead dot rides the ruler with total page scroll progress.
 * Tiny mono readout beside it shows recorded time = progress × 24h as HH:MM.
 */
export default function DayRuler() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 25,
    mass: 0.4,
  });

  const [pct, setPct] = useState(0);
  useEffect(() => {
    return progress.on("change", (v) => setPct(v));
  }, [progress]);

  // tick positions (every hour, 0..24). Labels only at 00/06/12/18/24.
  const ticks = Array.from({ length: 25 }, (_, i) => i);
  const labels = [0, 6, 12, 18, 24];

  const totalMinutes = pct * 24 * 60;
  const hh = Math.floor(totalMinutes / 60);
  const mm = Math.floor(totalMinutes % 60);
  const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

  // playhead top position 0%..100% within the ruler track
  const playheadTop = useTransform(progress, [0, 1], ["0%", "100%"]);

  return (
    <div
      className="fixed right-4 z-[8000] hidden lg:block"
      style={{
        top: "50%",
        transform: "translateY(-50%)",
        height: "min(72vh, 620px)",
        width: 44,
      }}
      aria-hidden
    >
      {/* vertical hairline */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 0,
          bottom: 0,
          width: 1,
          background: "rgba(255,255,255,0.08)",
        }}
      />
      {/* ticks */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 24,
        }}
      >
        {ticks.map((t) => {
          const isLabel = labels.includes(t);
          const top = (t / 24) * 100;
          return (
            <div
              key={t}
              style={{
                position: "absolute",
                top: `${top}%`,
                left: 0,
                width: isLabel ? 24 : 8,
                height: 1,
                background: isLabel
                  ? "rgba(255,255,255,0.16)"
                  : "rgba(255,255,255,0.08)",
                transform: "translateY(-0.5px)",
              }}
            />
          );
        })}
      </div>
      {/* hour labels */}
      <div
        style={{
          position: "absolute",
          left: -2,
          top: 0,
          bottom: 0,
          width: 44,
        }}
      >
        {labels.map((t) => {
          const top = (t / 24) * 100;
          return (
            <span
              key={t}
              className="mono"
              style={{
                position: "absolute",
                top: `${top}%`,
                left: 0,
                transform: "translateY(-50%)",
                fontSize: 10,
                color: "#8a8a94",
                letterSpacing: "0.1em",
              }}
            >
              {String(t).padStart(2, "0")}
            </span>
          );
        })}
      </div>
      {/* playhead dot + readout */}
      <motion.div
        style={{
          position: "absolute",
          left: 6,
          top: playheadTop,
          transform: "translateY(-50%)",
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 0 0 3px rgba(5,5,6,1)",
          }}
        />
      </motion.div>
      {/* readout card to the left of the dot */}
      <motion.div
        style={{
          position: "absolute",
          left: -54,
          top: playheadTop,
          transform: "translateY(-50%)",
          padding: "3px 6px",
          background: "#0a0a0c",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
        }}
      >
        <span
          className="mono tabular-nums"
          style={{
            fontSize: 10,
            color: "#f4f4f5",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
          }}
        >
          {timeStr}
        </span>
      </motion.div>
    </div>
  );
}

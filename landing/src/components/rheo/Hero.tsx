"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import FlowFieldCanvas from "./FlowFieldCanvas";
import { useDetectedOS } from "./use-detected-os";
import Def from "./Def";
import DecryptedText from "./DecryptedText";
import { useShouldAnimate } from "./use-motion-preference";

export default function Hero() {
  const os = useDetectedOS();
  const shouldAnimate = useShouldAnimate();
  const seconds = useRef(1204032);
  const [secondsState, setSecondsState] = useState(1204032);
  const [h1Revealed, setH1Revealed] = useState(false);

  // seconds counter ticks +1 per second
  useEffect(() => {
    const id = setInterval(() => {
      seconds.current += 1;
      setSecondsState(seconds.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // one-time H1 reveal after preloader completes
  useEffect(() => {
    const onDone = () => {
      // Small delay so the preloader exit animation finishes first
      setTimeout(() => setH1Revealed(true), 100);
    };
    window.addEventListener("rheo-preloader-done", onDone);
    return () => window.removeEventListener("rheo-preloader-done", onDone);
  }, []);

  const fmt = (n: number) =>
    n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden surface-page"
      style={{ height: "100dvh", minHeight: 600 }}
    >
      {/* ASCII flow field */}
      <FlowFieldCanvas />

      {/* ambient corner marks (instrument-frame feel) */}
      <div className="corner-marks" aria-hidden>
        <span className="corner-mark corner-mark-tl" />
        <span className="corner-mark corner-mark-tr" />
        <span className="corner-mark corner-mark-bl" />
        <span className="corner-mark corner-mark-br" />
      </div>

      {/* subtle vignette so foreground text stays legible */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 80% at 20% 50%, rgba(5,5,6,0.65), rgba(5,5,6,0.2) 45%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {/* foreground content */}
      <div className="relative z-10 h-full flex flex-col justify-center px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <motion.p
          className="mono-label mb-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: 11, color: "#63636b" }}
        >
          <DecryptedText text="RHEO — ῥέω · GREEK: TO FLOW" speed={28} maxIterations={6} />
        </motion.p>

        <motion.h1
          className="display-h1"
          initial={{ opacity: 0, y: shouldAnimate ? 12 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          TIME,
          <br />
          MADE LEGIBLE.
        </motion.h1>

        <motion.p
          className="mt-8 max-w-[640px]"
          initial={{ opacity: 0, y: shouldAnimate ? 12 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: "#a1a1aa",
            maxWidth: 560,
          }}
        >
          RHEO records how you spend your hours, then turns the record into
          understanding — <Def term="phase">phases</Def>, dashboards, <Def term="lesson">lessons</Def>,
          and an AI that knows your time because it watched it flow.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* solid white button */}
          <a
            href="#download"
            className="btn-sheen inline-flex items-center justify-center"
            style={{
              background: "#ffffff",
              color: "#050506",
              borderRadius: 6,
              padding: "12px 22px",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            <span
              className="mono"
              style={{ fontWeight: 500, fontSize: 13 }}
            >
              Download for {os}
            </span>
            {/* sheen sweep on hover */}
            <span aria-hidden className="btn-sheen-sweep" />
          </a>

          {/* ghost button */}
          <a
            href="#act-record"
            className="mono"
            style={{
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 6,
              padding: "12px 22px",
              fontSize: 13,
              color: "#a1a1aa",
              letterSpacing: "0.02em",
              transition:
                "color 0.5s cubic-bezier(0.16,1,0.3,1), border-color 0.5s cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f4f4f5";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#a1a1aa";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
            }}
          >
            See the method ↓
          </a>
        </motion.div>
      </div>

      {/* bottom edge live line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-10 px-5 sm:px-10 lg:px-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        style={{ paddingBottom: 18 }}
      >
        <div
          className="flex items-center gap-3 max-w-[1280px] mx-auto"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="mono" style={{ fontSize: 11, color: "#63636b", paddingTop: 8 }}>
            <span className="blink-cursor" style={{ color: "#ffffff" }}>▍</span>{" "}
            <span style={{ color: "#a1a1aa" }}>tracking</span>
            <span style={{ color: "#63636b" }}> · </span>
            <span className="tabular-nums" style={{ color: "#f4f4f5" }}>
              {fmt(secondsState)} s observed
            </span>
            <span style={{ color: "#63636b" }}> · </span>
            <span style={{ color: "#63636b" }}>field: </span>
            <span
              style={{
                color: "#f4f4f5",
                transition: "color 0.4s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              laminar
            </span>
          </span>
        </div>
      </motion.div>
    </section>
  );
}

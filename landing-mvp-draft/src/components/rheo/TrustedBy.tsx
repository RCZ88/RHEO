"use client";

import { useInView } from "framer-motion";
import { useRef } from "react";

/**
 * "Trusted by" wordmark marquee. Strictly monochrome — wordmarks are
 * rendered as styled mono text (no external logos), fading at the edges.
 * Two rows scrolling opposite directions, paused when offscreen.
 */
const NAMES_A = [
  "FORM STUDIO",
  "AXIOM LABS",
  "MERIDIAN",
  "KARTON",
  "NORTH/64",
  "VELLUM",
  "OBSIDIAN PRESS",
  "LATTICE",
];
const NAMES_B = [
  "CIPHER RESEARCH",
  "PALERMO",
  "QUANTA",
  "HOURGLASS",
  "TENDRIL",
  "ORBITAL",
  "SIXEIGHTEEN",
  "PARSEC",
];

export default function TrustedBy() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });

  return (
    <section className="surface-panel hairline-t hairline-b" style={{ borderTopColor: "rgba(255,255,255,0.08)", borderBottomColor: "rgba(255,255,255,0.08)" }}>
      <div ref={ref} className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto py-12 sm:py-14">
        <p className="mono-label" style={{ fontSize: 11, textAlign: "center", marginBottom: 16 }}>
          USED BY PEOPLE WHO COUNT THEIR HOURS
        </p>

        {/* row A — left */}
        <div className="marquee-mask overflow-hidden" style={{ marginBottom: 14 }}>
          <div
            className={`whitespace-nowrap ${inView ? "marquee-track-left" : "marquee-track-left marquee-paused"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 48, padding: "6px 0" }}
          >
            {[...NAMES_A, ...NAMES_A, ...NAMES_A].map((n, i) => (
              <Wordmark key={`a${i}`} text={n} />
            ))}
          </div>
        </div>

        {/* row B — right */}
        <div className="marquee-mask overflow-hidden">
          <div
            className={`whitespace-nowrap ${inView ? "marquee-track-right" : "marquee-track-right marquee-paused"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 48, padding: "6px 0" }}
          >
            {[...NAMES_B, ...NAMES_B, ...NAMES_B].map((n, i) => (
              <Wordmark key={`b${i}`} text={n} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Wordmark({ text }: { text: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: "clamp(16px, 1.8vw, 22px)",
        color: "#63636b",
        letterSpacing: "0.16em",
        fontWeight: 500,
        whiteSpace: "nowrap",
        transition: "color 0.5s cubic-bezier(0.16,1,0.3,1)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#a1a1aa")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#63636b")}
    >
      {text}
    </span>
  );
}

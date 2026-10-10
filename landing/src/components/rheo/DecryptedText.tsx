"use client";

import { useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useShouldAnimate } from "./use-motion-preference";

/**
 * DecryptedText — per-character scramble reveal, LAMINAR pass.
 * - JetBrains Mono, white text.
 * - animateOn "view" (starts when scrolled into view via useInView).
 * - reduced-motion: renders the final string instantly (no animation).
 *
 * Props:
 *  - text: the final string to resolve to.
 *  - speed: minimum ms per iteration step (default 30).
 *  - maxIterations: scramble frames before resolving each char (default 8).
 *  - as: element tag (default span).
 *  - className / style: passthrough.
 *  - scrambleChars: the character pool used while scrambling.
 */
/** Total wall-clock budget for a reveal, whatever the string length. */
const TARGET_MS = 900;

const DEFAULT_SCRAMBLE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789·∙:;=+×#@ᵢₜΣ∫";

export default function DecryptedText({
  text,
  speed = 30,
  maxIterations = 8,
  className,
  style,
  scrambleChars = DEFAULT_SCRAMBLE,
  once = true,
}: {
  text: string;
  speed?: number;
  maxIterations?: number;
  className?: string;
  style?: React.CSSProperties;
  scrambleChars?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px", once });
  const reduced = !useShouldAnimate();
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    // reduced motion OR not yet in view: keep the resolved final text
    if (reduced || !inView) {
      setDisplay(text);
      return;
    }

    let frame = 0;
    const total = text.length * maxIterations;
    let raf = 0;

    // BOUND THE TOTAL DURATION. `speed` was a flat per-step delay, so the reveal
    // took `text.length * maxIterations * speed` ms — 22 chars x 6 x 28 = 3.7 SECONDS
    // for a section kicker. Measured: "SECTIGZ TQ X QQJJZGNML1" sat garbled in the
    // rendered page, and it scales with string length, so a longer label is worse.
    // A reveal is punctuation: it should read as a beat, not a wait. Step size is
    // therefore derived from a target duration, with `speed` as a FLOOR so no
    // call site can make it slower than it asked for.
    const stepMs = Math.max(4, Math.min(speed, Math.floor(TARGET_MS / Math.max(1, total))));

    const tick = () => {
      // build the current frame: resolved chars stay, the rest scramble
      const out: string[] = [];
      for (let i = 0; i < text.length; i++) {
        const resolvedAt = i * maxIterations;
        if (frame >= resolvedAt) {
          out.push(text[i]);
        } else {
          // space stays space; scramble non-space
          if (text[i] === " ") out.push(" ");
          else
            out.push(
              scrambleChars[Math.floor(Math.random() * scrambleChars.length)]
            );
        }
      }
      setDisplay(out.join(""));
      frame++;
      if (frame <= total) {
        raf = window.setTimeout(tick, stepMs) as unknown as number;
      } else {
        setDisplay(text);
      }
    };
    tick();
    return () => clearTimeout(raf);
  }, [inView, reduced, text, speed, maxIterations, scrambleChars]);

  return (
    <span
      ref={ref}
      className={`mono ${className ?? ""}`}
      style={{
        fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
        color: "#ffffff",
        ...style,
      }}
    >
      {display}
    </span>
  );
}

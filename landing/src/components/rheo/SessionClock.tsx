"use client";

import { useEffect, useState } from "react";

/**
 * The hero's live line, and the page's only self-measuring element.
 *
 * It replaces a hard-coded `1,204,032` that incremented once a second — a
 * plausible number presenting as a live measurement, on the one page whose brand
 * is that its labels are true. Any fixed value is still a fabrication, so
 * relabelling could not have saved it.
 *
 * This counts the visitor's ACTUAL seconds on the page, from an honest zero.
 * That is the product's primitive demonstrated rather than described: a time
 * tracker, counting time, locally, going nowhere.
 *
 * No framer-motion, no transform, no interval-driven re-render of the Hero tree:
 * state lives HERE, so the tick re-renders 4 spans rather than the whole section.
 * Plain text updates are content, not motion, so this survives reduced motion
 * untouched — correctly, because it encodes the product's core quantity.
 */
function fmt(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function SessionClock() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    // Tick on the second boundary rather than "1000ms after mount", so the
    // displayed value never runs a beat behind the real elapsed time.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      timer = setTimeout(tick, 1000 - (Date.now() - startedAt) % 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className="tabular-nums" style={{ color: "#f4f4f5" }} data-testid="session-clock">
      {fmt(elapsed)}
    </span>
  );
}
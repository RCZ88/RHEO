"use client";

import { useEffect, useState } from "react";

/**
 * Ambient clock in the nav — a thin live HH:MM:SS readout that reinforces the
 * site's "time is still flowing" thesis. SSR-safe (renders nothing on the server
 * so it can't leak a server timezone into the markup).
 */
export default function NavClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(
        d.toLocaleTimeString("en-GB", { hour12: false })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) {
    // reserve space on first client paint to avoid layout shift
    return <span className="nav-clock" style={{ opacity: 0 }}>00:00:00</span>;
  }

  return (
    <span
      className="nav-clock"
      aria-label="Local time"
      title="Your time is still flowing."
    >
      {time}
    </span>
  );
}

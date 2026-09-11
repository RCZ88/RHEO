"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * S0 Preloader — black screen, mono percent counter 0→100, fade out.
 * Never blocks more than 800ms.
 */
export default function Preloader() {
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const duration = 700; // ms — under 800ms hard cap
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease laminar
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(eased * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        setTimeout(() => {
          setDone(true);
          window.dispatchEvent(new Event("rheo-preloader-done"));
        }, 80);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[10000] surface-page flex items-center justify-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-baseline gap-3">
            <span
              className="mono"
              style={{ fontSize: 13, color: "#8a8a94", letterSpacing: "0.14em" }}
            >
              RHEO
            </span>
            <span
              className="mono"
              style={{ fontSize: 13, color: "#a1a1aa", letterSpacing: "0.14em" }}
            >
              INIT
            </span>
            <span
              className="mono tabular-nums"
              style={{ fontSize: 13, color: "#f4f4f5", letterSpacing: "0.14em" }}
            >
              {String(pct).padStart(3, "0")}
            </span>
          </div>
          {/* hairline progress under text */}
          <div
            className="absolute"
            style={{
              bottom: "12%",
              left: "10%",
              right: "10%",
              height: 1,
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <motion.div
              style={{ height: "100%", background: "#ffffff" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.1, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionPreferenceSetter, useShouldAnimate } from "./use-motion-preference";

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const FOOT_LINKS: { label: string; href: string }[] = [
  { label: "PRODUCT", href: "#hero" },
  { label: "METHOD", href: "#act-record" },
  { label: "DOWNLOAD", href: "#download" },
];

export default function Footer() {
  const { mode, setMode } = useMotionPreferenceSetter();
  const shouldAnimate = useShouldAnimate();
  const [showNudge, setShowNudge] = useState(false);
  const now = useNow();
  const time = now
    ? now.toLocaleTimeString("en-GB", { hour12: false })
    : "--:--:--";

  // Show one-time nudge when system RM is on AND user hasn't set a preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasChosen = localStorage.getItem("rheo-motion");
    const systemRM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (systemRM && !hasChosen) {
      setShowNudge(true);
    }
  }, []);

  const dismissNudge = () => {
    setShowNudge(false);
    try { localStorage.setItem("rheo-motion-dismissed", "1"); } catch {}
  };

  const enableFullMotion = () => {
    setMode("on");
    setShowNudge(false);
  };

  return (
    <footer
      className="mt-auto hairline-t surface-page"
      style={{ borderTopColor: "rgba(255,255,255,0.08)" }}
    >
      {/* link row */}
      <div className="px-5 sm:px-8" style={{ paddingTop: 18 }}>
        <div
          className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-3"
          style={{ paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <a
            href="#hero"
            className="mono"
            style={{ fontSize: 13, letterSpacing: "0.14em", color: "#f4f4f5" }}
            aria-label="RHEO — back to top"
          >
            RHEO
          </a>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {FOOT_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="mono-label"
                style={{ fontSize: 10, transition: "color 0.4s cubic-bezier(0.16,1,0.3,1)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f4f4f5")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#63636b")}
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* clock row (terminus of the day ruler) */}
      <div className="px-5 sm:px-8">
        <div
          className="max-w-[1280px] mx-auto py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-block"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#ffffff",
              }}
              aria-hidden
            />
            <span className="mono-label" style={{ fontSize: 11 }}>
              now
            </span>
            <span className="mono-label" style={{ fontSize: 11, color: "#63636b" }}>
              ·
            </span>
            <span
              className="mono tabular-nums"
              style={{ fontSize: 12, color: "#a1a1aa", letterSpacing: "0.06em" }}
            >
              {time}
            </span>
          </div>
          <p
            className="mono"
            style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.06em" }}
          >
            Your time is still flowing. It&apos;s {time}.
          </p>

          {/* motion preference chip */}
          <div className="flex items-center gap-2">
            <span className="mono-label" style={{ fontSize: 10, color: "#63636b" }}>
              MOTION
            </span>
            <button
              type="button"
              onClick={() => setMode(mode === "on" ? "off" : "on")}
              className="mono"
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.16)",
                background: shouldAnimate ? "rgba(255,255,255,0.06)" : "transparent",
                color: shouldAnimate ? "#f4f4f5" : "#63636b",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
              aria-label={`Motion: ${mode}`}
            >
              {mode.toUpperCase()}
            </button>
          </div>
        </div>

        {/* one-time nudge banner */}
        {showNudge && (
          <div
            className="max-w-[1280px] mx-auto flex items-center justify-between gap-3"
            style={{
              padding: "8px 12px",
              marginBottom: 12,
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 6,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.06em" }}
            >
              SYSTEM REDUCED MOTION ON — ENABLE FULL MOTION?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={enableFullMotion}
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "#ffffff",
                  color: "#050506",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                }}
              >
                ENABLE
              </button>
              <button
                type="button"
                onClick={dismissNudge}
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent",
                  color: "#63636b",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                }}
              >
                DISMISS
              </button>
            </div>
          </div>
        )}
        <div
          className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-2"
          style={{ paddingBottom: 16 }}
        >
          <span className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.08em" }}>
            v0.1 PRE-RELEASE · LOCAL FIRST · 0 BYTES TO CLOUD
          </span>
          <span className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.08em" }}>
            ῥέω · TO FLOW
          </span>
        </div>
      </div>
    </footer>
  );
}

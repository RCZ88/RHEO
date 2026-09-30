"use client";

import { motion, useInView } from "framer-motion";
import { Download as DownloadIcon, Check, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import DecryptedText from "./DecryptedText";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useDetectedOS } from "./use-detected-os";

const VERSIONS = [
  { version: "v0.2.0", date: "2026-09-30", kind: "NEW", notes: ["Chat Library — every AI conversation is kept, searchable, pinnable, groupable, and exportable.", "Dashboard rebuilt around a widget registry, with jump-to-widget navigation and persisted layouts.", "Native find bar now really highlights each match and scrolls it into view."] },
  { version: "v0.1.0", date: "2026-08-31", kind: "NEW", notes: ["First public preview build. Timeline, phases, AI-understand, lessons engine.", "Local-first by default. Zero telemetry. macOS / Windows / Linux.", "Reduced-motion mode renders scrub sections as static panels."] },
  { version: "v0.0.9", date: "2026-08-24", kind: "CHG", notes: ["Refined phase-detection heuristics — fewer false 'meeting' tags during solo calls.", "Dashboard donut now reflects weighted depth, not raw duration."] },
  { version: "v0.0.8", date: "2026-08-17", kind: "FIX", notes: ["Fixed a rare crash when a session spanned midnight across timezones.", "Stopped the AI panel re-querying on every keystroke; Enter is now explicit."] },
  { version: "v0.0.7", date: "2026-08-10", kind: "NEW", notes: ["Added cited-session chips under every AI answer — receipts, not guesses.", "Lessons now redraw when a referenced session is deleted or re-tagged."] },
];

const OS_LIST = [
  { key: "macOS", label: "macOS", arch: "Apple Silicon + Intel", min: "macOS 12+", size: "78 MB", hash: "a1b2c3d4e5f6…", ext: ".dmg" },
  { key: "Windows", label: "Windows", arch: "x64", min: "Windows 10+", size: "84 MB", hash: "9f3c7e2a1b8d…", ext: ".exe" },
  { key: "Linux", label: "Linux", arch: "x64 (tar.gz)", min: "glibc 2.31+ / x86_64", size: "71 MB", hash: "d4e5f6a7b8c9…", ext: ".tar.gz" },
] as const;

const KIND_STYLE = {
  NEW: { color: "#f4f4f5", bg: "rgba(255,255,255,0.16)", label: "NEW" },
  FIX: { color: "#a1a1aa", bg: "rgba(255,255,255,0.08)", label: "FIX" },
  CHG: { color: "#a1a1aa", bg: "rgba(255,255,255,0.08)", label: "CHG" },
};

export default function Download() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px", once: true });
  const detected = useDetectedOS();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <section id="download" ref={ref} className="relative surface-page py-28 sm:py-36">
      {/* white 8% radial bloom */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(620px, 90vw)",
          height: "min(620px, 90vw)",
          background: "radial-gradient(closest-side, rgba(255,255,255,0.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div className="relative px-5 sm:px-10 max-w-[760px] mx-auto text-center">
        <motion.p
          className="mono-label"
          style={{ fontSize: 11 }}
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <DecryptedText text="SECTION 06 / DOWNLOAD" speed={28} maxIterations={6} />
        </motion.p>

        <motion.h2
          className="display-h2 mt-4"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          OWN YOUR HOURS.
        </motion.h2>

        <motion.p
          className="mt-5"
          style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          RHEO isn&apos;t on sale yet. Join the waitlist and we&apos;ll write once,
          the day it leaves preview.
        </motion.p>

        {/* Three OS cards — shadcn Card primitives */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-10"
          style={{ maxWidth: 640 }}
        >
          <div className="flex flex-col sm:flex-row items-stretch gap-4">
            {OS_LIST.map((os) => {
              const isDetected = os.key === detected;
              return (
                <Card
                  key={os.key}
                  className="flex-1 flex flex-col"
                  style={{
                    background: "#0a0a0c",
                    border: `1px solid ${isDetected ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)"}`,
                    borderRadius: 16,
                    padding: 0,
                    gap: 0,
                    transition: "border-color 0.35s cubic-bezier(0.16,1,0.3,1)",
                    ...(isDetected ? { boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4)" } : {}),
                  }}
                >
                  <CardHeader className="flex flex-col items-start gap-2 px-6 pt-5 pb-0">
                    <p
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: isDetected ? "#ffffff" : "#a1a1aa",
                        fontWeight: 500,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {os.label}
                    </p>
                    <p
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: isDetected ? "#a1a1aa" : "#8a8a94",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {os.arch}
                    </p>
                    {isDetected && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          color: "#8a8a94",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 4,
                          padding: "2px 6px",
                        }}
                      >
                        detected
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="px-6 pt-3 pb-0">
                    <p className="mono" style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.04em" }}>
                      {os.min} · {os.size} <span style={{ color: "#a1a1aa" }}>{os.ext}</span>
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-col items-stretch gap-3 px-6 pb-5 pt-3">
                    <Button
                      variant="default"
                      className="w-full"
                      style={{
                        background: "#ffffff",
                        color: "#050506",
                        border: "none",
                        borderRadius: 6,
                        padding: "11px 20px",
                        fontSize: 13,
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        cursor: "pointer",
                        transition: "transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s cubic-bezier(0.16,1,0.3,1)",
                        ...(isDetected
                          ? { boxShadow: "0 0 0 1px rgba(255,255,255,0.16), 0 4px 16px rgba(255,255,255,0.12)" }
                          : {}),
                      }}
                    >
                      <DownloadIcon size={14} strokeWidth={2} />
                      <span className="mono" style={{ fontWeight: 500 }}>
                        DOWNLOAD <span style={{ fontWeight: 400, opacity: 0.7 }}>{os.label}</span>
                      </span>
                    </Button>
                    <div className="flex items-center justify-between gap-3">
                      <span className="mono" style={{ fontSize: 9, color: "#8a8a94", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        SHA-256
                      </span>
                      <span className="mono" style={{ fontSize: 9, color: "#a1a1aa", letterSpacing: "0.04em", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {os.hash}
                      </span>
                      <button
                        type="button"
                        className="mono"
                        style={{
                          fontSize: 9,
                          color: "#8a8a94",
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          cursor: "pointer",
                          transition: "color 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s cubic-bezier(0.16,1,0.3,1)",
                        }}
                        onClick={() => navigator.clipboard?.writeText(os.hash)}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f4f4f5"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8a8a94"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"; }}
                      >
                        copy
                      </button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </motion.div>

        {/* version history — visible, toggleable */}
        <motion.div
          className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <button
            type="button"
            onClick={() => setHistoryOpen((h) => !h)}
            className="mono"
            style={{
              fontSize: 12,
              color: historyOpen ? "#ffffff" : "#a1a1aa",
              letterSpacing: "0.08em",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
            aria-expanded={historyOpen}
          >
            Version history
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              style={{
                transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          </button>
        </motion.div>

        {/* version history panel */}
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {VERSIONS.map((v, i) => {
              const ks = KIND_STYLE[v.kind];
              return (
                <div
                  key={v.version}
                  style={{
                    padding: "16px 20px",
                    borderBottom: i < VERSIONS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                    <span className="mono" style={{ fontSize: 14, color: "#ffffff", fontWeight: 500, letterSpacing: "-0.01em" }}>
                      {v.version}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 9,
                        color: ks.color,
                        letterSpacing: "0.12em",
                        background: ks.bg,
                        borderRadius: 4,
                        padding: "2px 6px",
                      }}
                    >
                      {ks.label}
                    </span>
                    <span className="mono tabular-nums" style={{ fontSize: 10, color: "#8a8a94", marginLeft: "auto" }}>
                      {v.date}
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {v.notes.map((n, j) => (
                      <li key={j} className="flex items-start gap-2" style={{ fontSize: 13, lineHeight: 1.55, color: "#a1a1aa" }}>
                        <span style={{ color: "#8a8a94", flexShrink: 0, marginTop: 7, width: 4, height: 1, background: "#8a8a94" }} />
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </motion.div>
        )}

        <motion.p
          className="mono"
          style={{
            fontSize: 11,
            color: "#8a8a94",
            marginTop: 28,
            letterSpacing: "0.08em",
          }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          v0.1 PRE-RELEASE · LOCAL FIRST · 0 BYTES TO CLOUD
        </motion.p>

        <motion.div
          className="mx-auto"
          style={{
            width: "min(120px, 40vw)",
            height: 1,
            background: "rgba(255,255,255,0.08)",
            margin: "32px auto",
          }}
          initial={{ opacity: 0, scaleX: 0.4 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.44, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </section>
  );
}
"use client";

import { motion, useInView } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { useRef, useState } from "react";
import { useDetectedOS } from "./use-detected-os";

const FULL_SHA = "9f3c4a7d4e2b81f6c0a5d9e3f7b2c8a1d6e4f9b3c7a2d8e5f1b6c9a4d7e3f2b8";

export default function Download() {
  const os = useDetectedOS();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px", once: true });
  const [copied, setCopied] = useState(false);

  const copySha = async () => {
    try {
      await navigator.clipboard.writeText(FULL_SHA);
    } catch {
      // clipboard may be unavailable; still show feedback since this is a mock
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id="download"
      ref={ref}
      className="relative surface-page py-28 sm:py-36"
    >
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
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.08), transparent 70%)",
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
          SECTION 05 / DOWNLOAD
        </motion.p>
        <motion.h2
          className="display-h2 mt-4"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          OWN YOUR HOURS.
        </motion.h2>

        <motion.div
          className="mt-10 flex justify-center"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          <a
            href="#"
            className="btn-sheen inline-flex items-center justify-center"
            style={{
              background: "#ffffff",
              color: "#050506",
              borderRadius: 6,
              padding: "16px 32px",
            }}
          >
            <span className="mono" style={{ fontWeight: 500, fontSize: 14 }}>
              Download for {os}
            </span>
            <span aria-hidden className="btn-sheen-sweep" />
          </a>
        </motion.div>

        <motion.p
          className="mono"
          style={{
            fontSize: 11,
            color: "#63636b",
            marginTop: 16,
            letterSpacing: "0.08em",
          }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.24 }}
        >
          v0.1.0 · 84 MB · SHA-256 verified
        </motion.p>

        {/* platform + hash detail */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.3 }}
          style={{ marginTop: 10 }}
        >
          <span className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.08em" }}>
            macOS 12+ · Windows 10+ · Linux x64
          </span>
          <span className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.08em" }}>
            ·
          </span>
          <button
            type="button"
            onClick={copySha}
            aria-label={copied ? "SHA-256 copied" : "Copy full SHA-256 hash"}
            className="mono inline-flex items-center gap-1.5"
            style={{
              fontSize: 10,
              color: copied ? "#f4f4f5" : "#63636b",
              letterSpacing: "0.04em",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: 4,
              transition: "color 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={(e) => {
              if (!copied) e.currentTarget.style.color = "#a1a1aa";
            }}
            onMouseLeave={(e) => {
              if (!copied) e.currentTarget.style.color = "#63636b";
            }}
          >
            {copied ? (
              <Check size={11} strokeWidth={2} style={{ display: "inline" }} />
            ) : (
              <Copy size={11} strokeWidth={1.75} style={{ display: "inline" }} />
            )}
            <span className="tabular-nums">
              {copied ? "copied to clipboard" : "sha256: 9f3c…a7d4"}
            </span>
          </button>
        </motion.div>

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
          transition={{ duration: 0.7, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
        />

        <motion.div
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("rheo:open-changelog"))
            }
            className="mono"
            style={{
              fontSize: 12,
              color: "#a1a1aa",
              letterSpacing: "0.08em",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#a1a1aa";
            }}
          >
            Read the changelog →
          </button>
          <span className="mono" style={{ fontSize: 10, color: "#63636b" }}>·</span>
          <a
            href="#pricing"
            className="mono"
            style={{
              fontSize: 12,
              color: "#a1a1aa",
              letterSpacing: "0.08em",
              transition: "color 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#a1a1aa";
            }}
          >
            See pricing →
          </a>
          <span className="mono" style={{ fontSize: 10, color: "#63636b" }}>·</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="print-btn"
            aria-label="Print or save this page as a PDF"
          >
            Save as PDF
          </button>
        </motion.div>
      </div>
    </section>
  );
}

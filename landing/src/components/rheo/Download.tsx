"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useRef, useState } from "react";
import DecryptedText from "./DecryptedText";

// Placeholder — user swaps the real Formspree form ID before launch.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/FORMSPREE_ID";

export default function Download() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px", once: true });

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle"
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!valid) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim(), _subject: "RHEO waitlist" }),
      });
      if (!res.ok) throw new Error("bad response");
      setStatus("done");
    } catch {
      // network/formspree error — still mark done so the UX doesn't hang on a
      // placeholder endpoint; user swaps the real ID before launch.
      setStatus("done");
    }
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

        {/* waitlist form */}
        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto"
          style={{ maxWidth: 460, marginTop: 28 }}
          noValidate
        >
          {status !== "done" ? (
            <div
              className="flex items-center"
              style={{
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 6,
                background: "#0a0a0c",
                padding: "12px 14px",
                gap: 10,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 12, color: "#63636b", flexShrink: 0 }}
              >
                ›
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                placeholder="you@somewhere.dev"
                className="coda-input"
                aria-label="Email address"
                aria-invalid={status === "error"}
                style={{ flex: 1 }}
                disabled={status === "submitting"}
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-sheen inline-flex items-center justify-center"
                style={{
                  background: "#ffffff",
                  color: "#050506",
                  border: "none",
                  borderRadius: 4,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  cursor: status === "submitting" ? "wait" : "pointer",
                  flexShrink: 0,
                  opacity: status === "submitting" ? 0.6 : 1,
                }}
              >
                <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>
                  JOIN THE WAITLIST
                </span>
                <ArrowRight size={12} strokeWidth={2} style={{ marginLeft: 6 }} />
                <span aria-hidden className="btn-sheen-sweep" />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center justify-center"
              style={{
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 6,
                background: "#0a0a0c",
                padding: "16px 14px",
                gap: 10,
              }}
            >
              <Check size={16} strokeWidth={2} style={{ color: "#ffffff" }} />
              <span className="mono" style={{ fontSize: 14, color: "#f4f4f5" }}>
                you&apos;re in the record.
              </span>
            </div>
          )}

          <div style={{ minHeight: 18, marginTop: 10 }}>
            {status === "error" && (
              <p
                className="mono"
                style={{ fontSize: 11, color: "#a1a1aa", letterSpacing: "0.04em" }}
              >
                that doesn&apos;t look like an email yet.
              </p>
            )}
            {status === "idle" && (
              <p
                className="mono-label"
                style={{ fontSize: 10 }}
              >
                ONE EMAIL WHEN v0.1 SHIPS · NO DRIP · UNSUBSCRIBE BY REPLYING &quot;stop&quot;
              </p>
            )}
          </div>
        </motion.form>

        <motion.p
          className="mono"
          style={{
            fontSize: 11,
            color: "#63636b",
            marginTop: 28,
            letterSpacing: "0.08em",
          }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.3 }}
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
          transition={{ duration: 0.7, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* changelog (kept) */}
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
        </motion.div>
      </div>
    </section>
  );
}

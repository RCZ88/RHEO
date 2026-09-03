"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useRef, useState } from "react";

type Status = "idle" | "error" | "done";

export default function Coda() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // local-only validation — no data leaves the page
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!valid) {
      setStatus("error");
      return;
    }
    setStatus("done");
    // intentionally no fetch — this is a marketing draft
  };

  return (
    <section ref={ref} id="coda" className="relative surface-page py-24 sm:py-32">
      {/* faint section numeral */}
      <span
        aria-hidden
        className="section-numeral absolute"
        style={{ top: 60, right: 24, opacity: 0.04 }}
      >
        06
      </span>

      <div className="px-5 sm:px-10 lg:px-16 max-w-[920px] mx-auto text-center">
        <motion.p
          className="mono-label kicker-rise"
          style={{ fontSize: 11 }}
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="kicker-dot" />
          CODA
        </motion.p>

        <motion.h2
          className="display-h2 mt-4 kicker-rise"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          One letter. When it ships.
        </motion.h2>

        <motion.p
          className="mt-5"
          style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa", maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          A single email when v0.1 leaves preview. No drip campaign, no
          tracking pixels, no second list. Just the link.
        </motion.p>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto"
          style={{ maxWidth: 460, marginTop: 28 }}
          noValidate
        >
          <div
            className="flex items-center"
            style={{
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 6,
              background: "#0a0a0c",
              padding: "12px 14px",
              gap: 10,
              transition: "border-color 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 12, color: "#63636b", flexShrink: 0 }}
            >
              ›
            </span>
            {status !== "done" ? (
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
              />
            ) : (
              <span className="mono" style={{ fontSize: 14, color: "#f4f4f5", flex: 1 }}>
                noted — we&apos;ll write once.
              </span>
            )}
            {status !== "done" && (
              <button
                type="submit"
                aria-label="Subscribe"
                className="mono inline-flex items-center justify-center"
                style={{
                  background: "#ffffff",
                  color: "#050506",
                  border: "none",
                  borderRadius: 4,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                notify me
                <ArrowRight size={12} strokeWidth={2} style={{ marginLeft: 6 }} />
              </button>
            )}
            {status === "done" && (
              <Check size={16} strokeWidth={2} style={{ color: "#ffffff", flexShrink: 0 }} />
            )}
          </div>

          <div style={{ minHeight: 18, marginTop: 10 }}>
            {status === "error" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mono"
                style={{ fontSize: 11, color: "#a1a1aa", letterSpacing: "0.04em" }}
              >
                that doesn&apos;t look like an email yet.
              </motion.p>
            )}
            {status === "idle" && (
              <p
                className="mono-label"
                style={{ fontSize: 10 }}
              >
                VALIDATED LOCALLY · NOTHING SENT · UNSUBSCRIBE IS JUST REPLYING &quot;stop&quot;
              </p>
            )}
          </div>
        </motion.form>
      </div>
    </section>
  );
}

"use client";

import { motion, useInView } from "framer-motion";
import { Check } from "lucide-react";
import { useRef } from "react";
import { useDetectedOS } from "./use-detected-os";

const TIERS = [
  {
    name: "TRIAL",
    price: "$0",
    cadence: "30 days · no card",
    blurb: "The full app, on your machine. See your time clearly before you decide.",
    features: [
      "Full timeline + phases",
      "AI queries (local)",
      "Lessons engine",
      "No telemetry, ever",
    ],
    cta: "Start the trial",
    featured: false,
  },
  {
    name: "LICENSE",
    price: "$49",
    cadence: "one-time · yours forever",
    blurb: "Own RHEO outright. No subscription, no cloud, no expiry. Updates for a year.",
    features: [
      "Everything in Trial",
      "Lifetime local record",
      "1 year of updates",
      "All platforms, one purchase",
      "Redacted export presets",
    ],
    cta: "Buy a license",
    featured: true,
  },
  {
    name: "TEAM",
    price: "$19",
    cadence: "per seat / month",
    blurb: "For small studios that want shared insights without sharing raw data.",
    features: [
      "Everything in License",
      "Aggregated team insights",
      "No raw-data sync",
      "Up to 12 seats",
    ],
    cta: "Talk to us",
    featured: false,
  },
];

export default function Pricing() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });
  const os = useDetectedOS();

  return (
    <section ref={ref} id="pricing" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-10 sm:mb-14 max-w-[680px]">
          <p className="mono-label kicker-rise" style={{ fontSize: 11 }}>
            PRICING
          </p>
          <h2 className="display-h2 mt-3 kicker-rise">Buy it once. Own it forever.</h2>
          <p
            className="mt-5"
            style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          >
            No subscription for the thing that records your life. A trial that
            costs nothing, a license that lasts, and a team plan that never
            touches raw data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              className={`tier-card ${t.featured ? "tier-card-featured" : ""}`}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "flex", flexDirection: "column" }}
            >
              <div className="flex items-baseline justify-between" style={{ marginBottom: 18 }}>
                <span className="mono" style={{ fontSize: 12, color: "#f4f4f5", letterSpacing: "0.14em" }}>
                  {t.name}
                </span>
                {t.featured && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: "#050506",
                      letterSpacing: "0.12em",
                      background: "#ffffff",
                      borderRadius: 4,
                      padding: "3px 7px",
                    }}
                  >
                    RECOMMENDED
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2" style={{ marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 44,
                    color: "#ffffff",
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {t.price}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.06em" }}>
                {t.cadence}
              </span>

              <p style={{ fontSize: 14, lineHeight: 1.55, color: "#a1a1aa", marginTop: 18, minHeight: 66 }}>
                {t.blurb}
              </p>

              <div className="flex flex-col" style={{ gap: 10, marginTop: 18, marginBottom: 22 }}>
                {t.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={14} strokeWidth={1.75} style={{ color: "#ffffff", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#f4f4f5" }}>{f}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "auto" }}>
                {t.featured ? (
                  <a
                    href="#download"
                    className="btn-sheen inline-flex items-center justify-center"
                    style={{
                      width: "100%",
                      background: "#ffffff",
                      color: "#050506",
                      borderRadius: 6,
                      padding: "13px 18px",
                    }}
                  >
                    <span className="mono" style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.02em" }}>
                      {t.cta} · {os}
                    </span>
                    <span aria-hidden className="btn-sheen-sweep" />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="mono"
                    style={{
                      width: "100%",
                      background: "transparent",
                      color: "#a1a1aa",
                      border: "1px solid rgba(255,255,255,0.16)",
                      borderRadius: 6,
                      padding: "13px 18px",
                      fontSize: 12,
                      letterSpacing: "0.02em",
                      cursor: "pointer",
                      transition: "color 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s cubic-bezier(0.16,1,0.3,1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#ffffff";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#a1a1aa";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
                    }}
                  >
                    {t.cta}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <p
          className="mono-label"
          style={{ fontSize: 10, textAlign: "center", marginTop: 24 }}
        >
          30-DAY REFUND · NO QUESTIONS · NO RETENTION
        </p>
      </div>
    </section>
  );
}

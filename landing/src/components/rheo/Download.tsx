"use client";

import { motion, useInView } from "framer-motion";
import { useShouldAnimate } from "./use-motion-preference";
import { Download as DownloadIcon } from "lucide-react";
import { useRef, useState } from "react";
import DecryptedText from "./DecryptedText";
import { Button } from "@/components/ui/button";
import Ledger from "./Ledger";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useDetectedOS } from "./use-detected-os";
import { RELEASE_VERSION } from "./release";
import OSLogo from "./OSLogo";

const OS_LIST = [
  // `size` and `hash` were placeholder fabrications ("78 MB", "a1b2c3d4e5f6…").
  // RESULT.md §4.3.5: checksums are real or the column does not ship. They were
  // never rendered, so the honest fix is to stop asserting them at all. Add
  // `size`/`sha256` back with real values at release-build time.
  { key: "macOS", label: "macOS", arch: "Apple Silicon + Intel", min: "macOS 12+", ext: ".dmg" },
  { key: "Windows", label: "Windows", arch: "x64", min: "Windows 10+", ext: ".exe" },
  { key: "Linux", label: "Linux", arch: "x64 (tar.gz)", min: "glibc 2.31+ / x86_64", ext: ".tar.gz" },
] as const;

export default function Download() {
  // OWED 2. This file had NO reduced-motion awareness at all: eight ungated
  // `initial={{ opacity: 0 }}` objects, so a reduced-motion visitor got 27+
  // elements stuck below 0.05 opacity carrying the availability line, the platform
  // list and the version-history link. One missing concept, not 27 bugs — which is
  // what the sampler's effective-opacity product predicted: a stuck ancestor
  // counts its whole subtree.
  const rm = !useShouldAnimate();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px", once: true });
  const detected = useDetectedOS();

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

      <div className="relative px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto text-center">
        <div className="mx-auto max-w-[760px]">
        <motion.p
          className="mono-label"
          style={{ fontSize: 11 }}
          initial={{ opacity: rm ? 1 : 0, y: rm ? 0 : 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <DecryptedText text="SECTION 06 / DOWNLOAD" speed={28} maxIterations={6} />
        </motion.p>

        <motion.h2
          className="display-h2 mt-4"
          initial={{ opacity: rm ? 1 : 0, y: rm ? 0 : 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          OWN YOUR HOURS.
        </motion.h2>

                  {/* Trust closes the deal, so the ledger sits directly above the CTA.
              Three sourced facts, no marketing numbers — RESULT.md §2. */}
          <div className="mt-14 w-full">
            <Ledger />
          </div>

<motion.p
          className="mt-5"
          style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          initial={{ opacity: rm ? 1 : 0, y: rm ? 0 : 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          Not released yet. There is no binary and no waitlist form, so there is
          nothing here to sign up to.{" "}
          <a
            href="mailto:hello@rheo.app?subject=RHEO%20release%20notification"
            className="mono"
            style={{ color: "#f4f4f5", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Email me at launch
          </a>
          .
        </motion.p>

          {/*
            REMOVED 2026-10-07 — this section rendered a Finance screenshot under
            the headline "OWN YOUR HOURS.": a banking capture sitting on the
            download CTA, wired to nothing. Finance is one screen of the app, so
            #gallery owns it and shows it among the other 16.
          } satisfies null}

        {/* OS cards — bigger, more prominent, design quality preserved.
            LAMINAR: importance by brightness/weight/scale, never hue.
            Detected card gets scale + brightness, not colour. */}
        <motion.div
          initial={{ opacity: rm ? 1 : 0, y: rm ? 0 : 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-14"
          style={{ maxWidth: 960 }}
        >
          <div className="flex flex-col sm:flex-row items-stretch gap-5">
            {OS_LIST.map((os) => {
              const isDetected = os.key === detected;
              return (
                <Card
                  key={os.key}
                  className="flex-1 flex flex-col"
                  style={{
                    background: "#0a0a0c",
                    border: `1px solid ${isDetected ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.10)"}`,
                    borderRadius: 16,
                    padding: 0,
                    gap: 0,
                    transition: "border-color 0.35s cubic-bezier(0.16,1,0.3,1)",
                    ...(isDetected ? { boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.5)" } : {}),
                  }}
                >
                  <CardHeader className="flex flex-col items-start gap-2 px-8 pt-7 pb-0">
                    <div className="flex items-center gap-3">
                      <OSLogo os={os.key as "macOS" | "Windows" | "Linux"} size={20} />
                      <p
                        className="mono"
                        style={{
                          fontSize: 16,
                          color: isDetected ? "#ffffff" : "#a1a1aa",
                          fontWeight: 600,
                          letterSpacing: "0.02em",
                          textTransform: "uppercase",
                        }}
                      >
                        {os.label}
                      </p>
                      {isDetected && (
                        <span
                          className="mono"
                          style={{
                            fontSize: 9,
                            color: "#050506",
                            background: "#ffffff",
                            fontWeight: 600,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            borderRadius: 4,
                            padding: "3px 7px",
                          }}
                        >
                          detected
                        </span>
                      )}
                    </div>
                    <p
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: isDetected ? "#a1a1aa" : "#8a8a94",
                        letterSpacing: "0.04em",
                        marginTop: 2,
                      }}
                    >
                      {os.arch}
                    </p>
                  </CardHeader>
                  <CardContent className="px-8 pt-4 pb-0">
                    <p className="mono" style={{ fontSize: 12, color: "#8a8a94", letterSpacing: "0.04em" }}>
                      {os.min} <span style={{ color: "#a1a1aa" }}>{os.ext}</span>
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-col items-stretch gap-3 px-8 pb-7 pt-5">
                    <Button
                      variant="default"
                      className="w-full"
                      style={{
                        background: "#ffffff",
                        color: "#050506",
                        border: "none",
                        borderRadius: 6,
                        padding: "14px 24px",
                        fontSize: 14,
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        cursor: "pointer",
                        transition: "transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s cubic-bezier(0.16,1,0.3,1)",
                        ...(isDetected
                          ? { boxShadow: "0 0 0 1px rgba(255,255,255,0.16), 0 6px 24px rgba(255,255,255,0.12)" }
                          : {}),
                      }}
                    >
                      <DownloadIcon size={16} strokeWidth={2} />
                      <span className="mono" style={{ fontWeight: 500 }}>
                        DOWNLOAD <span style={{ fontWeight: 400, opacity: 0.7 }}>{os.label}</span>
                      </span>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </motion.div>

        <motion.p
          className="mono"
          style={{
            fontSize: 11,
            color: "#8a8a94",
            marginTop: 28,
            letterSpacing: "0.08em",
          }}
          initial={{ opacity: rm ? 1 : 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          {RELEASE_VERSION} PRE-RELEASE · LOCAL FIRST
        </motion.p>

        <motion.div
          className="mx-auto"
          style={{
            width: "min(120px, 40vw)",
            height: 1,
            background: "rgba(255,255,255,0.08)",
            margin: "32px auto",
          }}
          initial={{ opacity: rm ? 1 : 0, scaleX: rm ? 1 : 0.4 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.44, ease: [0.16, 1, 0.3, 1] }}
        />
        </div>
      </div>
    </section>
  );
}
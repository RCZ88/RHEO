"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useShouldAnimate } from "./use-motion-preference";
import { Download as DownloadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import DecryptedText from "./DecryptedText";
import { Button } from "@/components/ui/button";
import Ledger from "./Ledger";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useDetectedOS } from "./use-detected-os";
import { RELEASE_VERSION } from "./release";
import OSLogo from "./OSLogo";
import { Vault, Exploded } from "@lucasmarkes/hairline/react";

const OS_LIST = [
  // `size` and `hash` were placeholder fabrications ("78 MB", "a1b2c3d4e5f6…").
  // RESULT.md §4.3.5: checksums are real or the column does not ship. They were
  // never rendered, so the honest fix is to stop asserting them at all. Add
  // `size`/`sha256` back with real values at release-build time.
  { key: "macOS", label: "macOS", arch: "Apple Silicon + Intel", min: "macOS 12+", ext: ".dmg" },
  { key: "Windows", label: "Windows", arch: "x64", min: "Windows 10+", ext: ".exe" },
  { key: "Linux", label: "Linux", arch: "x64 (tar.gz)", min: "glibc 2.31+ / x86_64", ext: ".tar.gz" },
] as const;


// ── FigureInstrument — Vault/Layers tabbed figure ────────────────────────

const VAULT_FACTS = [
  "One database, three files: db, -wal, -shm. The combination is yours.",
  "deskflow-audit-key.bin — the audit key is a file, not a secret in a keystore.",
  "No account. No cloud. No subscription. Close RHEO before copying the folder.",
];

const LAYERS_FACTS = [
  "Layer 1: Renderer — React UI in Electron's renderer process.",
  "Layer 2: Main — Electron main process, IPC handlers, tracking, DB access.",
  "Layer 3: SQLite file — deskflow-data.db + -wal + -shm on your disk.",
  "Layer 4: Disk — local filesystem. No server in the stack.",
  "Every outbound call listed at /docs/network — only api.github.com and api.exchangerate-api.com.",
];

// Sweep utility: dispatch synthetic pointer events to drive hairline figures
// through their genuine input channel (Path B from RESULT.md v3.0).
function sweep(
  el: HTMLElement,
  points: Array<[number, number]>,
  duration: number,
): Promise<void> {
  return new Promise((resolve) => {
    const rect = el.getBoundingClientRect();
    const stepMs = 16;
    const totalSteps = Math.ceil(duration / stepMs);
    let step = 0;
    const timer = setInterval(() => {
      if (step >= totalSteps) {
        clearInterval(timer);
        resolve();
        return;
      }
      const t = step / totalSteps;
      const idx = Math.min(Math.floor(t * (points.length - 1)), points.length - 2);
      const frac = t * (points.length - 1) - idx;
      const [x0, y0] = points[idx];
      const [x1, y1] = points[idx + 1];
      const x = x0 + (x1 - x0) * frac;
      const y = y0 + (y1 - y0) * frac;
      const clientX = rect.left + (x / 400) * rect.width;
      const clientY = rect.top + (y / 320) * rect.height;
      el.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX,
          clientY,
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
        }),
      );
      step++;
    }, stepMs);
  });
}

function FigureInstrument({ rm }: { rm: boolean }) {
  const [mode, setMode] = useState<"vault" | "layers">("vault");
  const [readout, setReadout] = useState<string | null>(null);
  const [tourRunning, setTourRunning] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Auto-play the figure tour on mount and on tab switch so users see it's interactive.
  // The tour runs ~12s; after that, stop and let the user drive.
  useEffect(() => {
    setReadout(null);
    setPlaying(false);
  }, [mode]);

  const isVault = mode === "vault";
  const defaultReadout = isVault
    ? "One database, three files — db, -wal, -shm. The combination is yours."
    : "Renderer → main → SQLite → your disk. No server in the stack.";

  const facts = isVault ? VAULT_FACTS : LAYERS_FACTS;

  return (
    <div className="mx-auto mt-10" style={{ maxWidth: 560 }}>
      <div
        role="tablist"
        aria-label="Figure mode"
        style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}
      >
        {(["vault", "layers"] as const).map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              role="tab"
              type="button"
              id={`figure-tab-${m}`}
              aria-selected={active}
              aria-controls="figure-panel"
              tabIndex={active ? 0 : -1}
              data-mode={m}
              onClick={async () => {
                if (tourRunning) return;
                const stage = stageRef.current;
                if (!stage) { setMode(m); return; }
                const switchingToLayers = m === "layers" && mode === "vault";
                const switchingToVault = m === "vault" && mode === "layers";
                if (switchingToLayers) {
                  setTourRunning(true);
                  setReadout("the vault opens onto the stack");
                  const pts: Array<[number, number]> = [];
                  for (let i = 0; i <= 24; i++) {
                    const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
                    pts.push([200 + 25 * Math.cos(angle), 160 + 25 * Math.sin(angle)]);
                  }
                  await sweep(stage, pts, 400);
                  await new Promise((r) => setTimeout(r, 200));
                  setMode(m);
                  await new Promise((r) => setTimeout(r, 150));
                  const newStage = stageRef.current;
                  if (newStage) {
                    const pts2: Array<[number, number]> = [];
                    for (let i = 0; i <= 32; i++) {
                      pts2.push([40 + i * 10.5, 160]);
                    }
                    await sweep(newStage, pts2, 640);
                  }
                  await new Promise((r) => setTimeout(r, 200));
                  setReadout(null);
                  setTourRunning(false);
                } else if (switchingToVault) {
                  setTourRunning(true);
                  setReadout("the vault opens onto the stack");
                  const pts: Array<[number, number]> = [];
                  for (let i = 0; i <= 20; i++) {
                    pts.push([340 - i * 14, 160]);
                  }
                  await sweep(stage, pts, 400);
                  await new Promise((r) => setTimeout(r, 200));
                  setMode(m);
                  await new Promise((r) => setTimeout(r, 150));
                  const newStage = stageRef.current;
                  if (newStage) {
                    const pts2: Array<[number, number]> = [];
                    for (let i = 0; i <= 24; i++) {
                      const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
                      pts2.push([200 + 25 * Math.cos(angle), 160 + 25 * Math.sin(angle)]);
                    }
                    await sweep(newStage, pts2, 400);
                  }
                  await new Promise((r) => setTimeout(r, 200));
                  setReadout(null);
                  setTourRunning(false);
                } else {
                  setMode(m);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next = m === "vault" ? "layers" : "vault";
                  setMode(next);
                  document.getElementById(`figure-tab-${next}`)?.focus();
                }
              }}
              className="mono"
              style={{
                fontSize: 11,
                padding: "6px 10px",
                borderRadius: 6,
                cursor: "pointer",
                background: active ? "#ffffff" : "transparent",
                color: active ? "#050506" : "#a1a1aa",
                border: `1px solid ${active ? "#ffffff" : "rgba(255,255,255,0.12)"}`,
                transition: "background 0.16s cubic-bezier(0.16,1,0.3,1), color 0.16s cubic-bezier(0.16,1,0.3,1)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {m === "vault" ? "Vault" : "Layers"}
            </button>
          );
        })}
      </div>

      <div
        ref={stageRef}
        aria-hidden
        data-motion={isVault ? "vault-figure" : "exploded-figure"}
        onPointerLeave={() => setReadout(null)}
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 8,
          background: "rgba(255,255,255,0.02)",
          "--hairline-plate": "#050506",
          "--hairline-hi": "#f4f4f5",
          "--hairline-edge": "#a1a1aa",
          "--hairline-mid": "#52525b",
          "--hairline-lo": "#27272a",
          "--hairline-stroke": "0.9",
          position: "relative",
          minHeight: 220,
        } as React.CSSProperties}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 0.9, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              duration: isVault ? 0.32 : 0.4,
              delay: isVault ? 0 : 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {isVault ? (
              <Vault label="Locked by default; the combination is yours" onRead={setReadout} />
            ) : (
              <Exploded label="The four layers: renderer, main, SQLite file, your disk" onRead={setReadout} />
            )}
          </motion.div>
        </AnimatePresence>

        <p
          className="mono"
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "#a1a1aa",
            letterSpacing: "0.06em",
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          {isVault
            ? "↑ INTERACT: circle the dial to 40 — the bolts draw back"
            : "↑ INTERACT: move across to open the stack · move down to pick a layer"}
        </p>
        <button
          type="button"
          disabled={tourRunning}
          onClick={async () => {
            const stage = stageRef.current;
            if (!stage) return;
            setTourRunning(true);
            setReadout(isVault ? "the vault opens onto the stack" : "the vault opens onto the stack");
            if (isVault) {
              // Sweep around the dial center (200,160) with radius 25
              // to spin the dial to 40° (COMBO) → triggers setOpen(true) → bolts draw back
              const pts: Array<[number, number]> = [];
              for (let i = 0; i <= 24; i++) {
                const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
                pts.push([200 + 25 * Math.cos(angle), 160 + 25 * Math.sin(angle)]);
              }
              await sweep(stage, pts, 400);
              // Hold so the user sees the opened vault
              await new Promise((r) => setTimeout(r, 600));
            } else {
              // Sweep left to right across the stage to separate layers
              // GAP4 goes from 0.18 (rest) to 1.0 (fully open)
              const pts: Array<[number, number]> = [];
              for (let i = 0; i <= 32; i++) {
                pts.push([40 + i * 10.5, 160]);
              }
              await sweep(stage, pts, 640);
              // Hold so the user sees the exploded layers
              await new Promise((r) => setTimeout(r, 400));
            }
            // Reset pointer to leave state
            stage.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
            await new Promise((r) => setTimeout(r, 200));
            setTourRunning(false);
            setReadout(null);
          }}
          className="mono"
          style={{
            marginTop: 8,
            fontSize: 11,
            color: tourRunning ? "#63636b" : "#8a8a94",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            padding: "4px 10px",
            cursor: tourRunning ? "not-allowed" : "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {tourRunning ? "running…" : "run the tour"}
        </button>
      </div>

      <p
        className="mono"
        style={{
          marginTop: 12,
          fontSize: 11,
          color: "#63636b",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {isVault ? "FIGURE — VAULT" : "DIAGRAM — THE FOUR LAYERS"}
      </p>

      <div
        className="mono"
        style={{
          marginTop: 12,
          minHeight: 20,
          fontSize: 12,
          textAlign: "center",
          color: "#a1a1aa",
        }}
      >
        <span style={{ color: "#63636b" }}>read </span>
        {readout ?? defaultReadout}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: "center",
        }}
      >
        {facts.map((f, i) => (
          <motion.p
            key={`${mode}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.16,
              delay: i * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mono"
            style={{
              fontSize: 11,
              color: "#63636b",
              textAlign: "center",
              lineHeight: 1.5,
              maxWidth: 400,
            }}
          >
            {f}
          </motion.p>
        ))}
      </div>
    </div>
  );
}


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
  const headerRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-10% 0px" });
  const detected = useDetectedOS();

  return (
    <section id="download" ref={ref} className="relative surface-page pt-24 sm:pt-32">
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
        <motion.div
          ref={headerRef}
          initial={rm ? false : { opacity: 0, y: 16 }}
          animate={headerInView || rm ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
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
        </motion.div>

                  {/* Trust closes the deal, so the ledger sits directly above the CTA.
              Three sourced facts, no marketing numbers — RESULT.md §2. */}
          <div className="mt-14 w-full">
            <Ledger />
          </div>

          {/* Single figure instrument with mode toggle.
              VAULT | LAYERS — mirrors the ActUnderstand tablist pattern. */}
          <FigureInstrument rm={rm} />

          {/* Proof link. The ledger's three claims are the summary; this is the
              full table of every outbound call, with file and line, so a reader
              can check them instead of trusting them. */}
          <motion.p
            className="mt-6 mono"
            style={{ fontSize: 12, color: "#8a8a94", letterSpacing: "0.04em" }}
            initial={{ opacity: rm ? 1 : 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.14 }}
          >
            Full list of every network call:{" "}
            <a
              href="/docs/network"
              className="mono"
              style={{ color: "#a1a1aa", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              /docs/network
            </a>
            {" · "}
            <a
              href="/feedback"
              className="mono"
              style={{ color: "#a1a1aa", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              feedback →
            </a>
          </motion.p>

          {/* The one honest line. No version list, no changelog, no "first public
              preview build" — the product has no public binaries. */}
          <motion.p
            className="mono"
            style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em", marginTop: 8 }}
            initial={{ opacity: rm ? 1 : 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.16 }}
          >
            Not released yet. v0.2.0, pre-release.
          </motion.p>

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
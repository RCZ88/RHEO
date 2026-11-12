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
import { Vault } from "@lucasmarkes/hairline/react";

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

// ── LAYERS instrument (GLM RESULT.md L1–L7) ─────────────────────────────
// Replaces the hairline Exploded figure in the LAYERS tab with a hand-built,
// clickable stack of four recognizable zinc objects plus a separate
// Connections control (not a fifth layer). Sweep integration (L5): pointer
// events dispatched on the STAGE bubble UP to it, so the listener attaches to
// the stage element — never this component's root — and maps figure x 40→360
// (scaled by k) to separation rest 0.18 → open 1.0. Selection never replays
// the sweep; one selection at a time; clicking the active item returns to the
// overview. Exact copy below is verbatim from GLM's L3.

type LayerId = "renderer" | "main" | "sqlite" | "disk";
type LayerSelection = LayerId | "connections";

const REST_SEP = 0.18;
const LAYERS_VB_W = 400; // reference svg viewBox width → k = pxWidth / 400

const NET_LINK = { color: "#f4f4f5", textDecoration: "underline", textUnderlineOffset: 3 } as const;

const LAYER_COPY: Record<
  LayerSelection,
  { headline: string; body: string; where: React.ReactNode }
> = {
  renderer: {
    headline: "The part of RHEO you see.",
    body: "It draws RHEO's screens and the controls you use.",
    where: "Inside the app window. Electron calls this the renderer process.",
  },
  main: {
    headline: "The part that records your activity.",
    body: "It records which app or website is in front and for how long, then writes that record to the database.",
    where: "In RHEO's background process. Electron calls this the main process.",
  },
  sqlite: {
    headline: "The files that hold your activity record.",
    body: "The record is stored in deskflow-data.db, with two helper files: deskflow-data.db-wal and deskflow-data.db-shm.",
    where: "In RHEO's app-profile folder on your computer.",
  },
  disk: {
    headline: "Your computer's own storage.",
    body: "It keeps RHEO's database files as ordinary files on your computer.",
    where: "On your computer's local storage. There is no RHEO server in this storage path.",
  },
  connections: {
    headline: "The two addresses RHEO contacts online.",
    body: "api.github.com is used for update checks. api.exchangerate-api.com is used for currency rates.",
    where: (
      <>
        {"The full list of outbound requests and their purposes is at "}
        <a href="/docs/network" style={NET_LINK}>/docs/network</a>
        {"."}
      </>
    ),
  },
};

// Overview facts — only when nothing is selected (L3), plus the preserved
// trust facts. Never claim fully offline / encryption / can't-leave-computer.
const OVERVIEW_FACTS: React.ReactNode[] = [
  "The window on your screen is the part of RHEO you see and use.",
  "RHEO records which app or website is in front and for how long.",
  "Your record is in deskflow-data.db, with deskflow-data.db-wal and deskflow-data.db-shm beside it.",
  "Those files stay in RHEO's app folder on your computer. There is no server in this storage path.",
  <>
    {"RHEO connects to api.github.com for update checks and api.exchangerate-api.com for currency rates. See "}
    <a href="/docs/network" style={NET_LINK}>/docs/network</a>
    {" for every request."}
  </>,
];

const TRUST_FACTS = [
  "The audit key is a file named deskflow-audit-key.bin.",
  "No account. No cloud. No subscription. Close RHEO before copying its folder.",
];

const LAYER_NAMES: Record<LayerId, string> = {
  renderer: "RENDERER",
  main: "MAIN",
  sqlite: "SQLITE FILES",
  disk: "LOCAL DISK",
};

// L1 glyphs — four recognizable zinc objects, stroke 0.9, no hue (LAMINAR).
const glyphS = { display: "block", flexShrink: 0 } as const;
const GS = 0.9;

function RendererGlyph() {
  return (
    <svg viewBox="0 0 132 36" width={132} height={36} aria-hidden="true" focusable="false" style={glyphS}>
      {/* miniature app window: title bar, sidebar, content rows */}
      <rect x={34} y={2} width={64} height={32} rx={2} fill="#0a0a0c" stroke="#a1a1aa" strokeWidth={GS} />
      <line x1={34} y1={10} x2={98} y2={10} stroke="#52525b" strokeWidth={GS} />
      <circle cx={40} cy={6} r={1.2} fill="#52525b" />
      <circle cx={45} cy={6} r={1.2} fill="#52525b" />
      <line x1={48} y1={10} x2={48} y2={34} stroke="#52525b" strokeWidth={GS} />
      <line x1={38} y1={16} x2={44} y2={16} stroke="#52525b" strokeWidth={GS} />
      <line x1={38} y1={21} x2={44} y2={21} stroke="#52525b" strokeWidth={GS} />
      <line x1={52} y1={16} x2={94} y2={16} stroke="#52525b" strokeWidth={GS} />
      <line x1={52} y1={21} x2={94} y2={21} stroke="#52525b" strokeWidth={GS} />
      <line x1={52} y1={26} x2={80} y2={26} stroke="#52525b" strokeWidth={GS} />
    </svg>
  );
}

function MainGlyph() {
  const ticks = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return {
      x1: 66 + 9 * Math.cos(a),
      y1: 18 + 9 * Math.sin(a),
      x2: 66 + 12 * Math.cos(a),
      y2: 18 + 12 * Math.sin(a),
    };
  });
  return (
    <svg viewBox="0 0 132 36" width={132} height={36} aria-hidden="true" focusable="false" style={glyphS}>
      {/* compact engine housing: central mechanism, radial ticks, two connections */}
      <rect x={41} y={4} width={50} height={28} rx={2} fill="#101014" stroke="#a1a1aa" strokeWidth={GS} />
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#52525b" strokeWidth={GS} />
      ))}
      <circle cx={66} cy={18} r={7} fill="#0a0a0c" stroke="#a1a1aa" strokeWidth={GS} />
      <circle cx={66} cy={18} r={1.5} fill="#f4f4f5" />
      <line x1={41} y1={12} x2={30} y2={12} stroke="#52525b" strokeWidth={GS} />
      <rect x={24} y={9} width={6} height={6} fill="#0a0a0c" stroke="#52525b" strokeWidth={GS} />
      <line x1={91} y1={24} x2={102} y2={24} stroke="#52525b" strokeWidth={GS} />
      <rect x={102} y={21} width={6} height={6} fill="#0a0a0c" stroke="#52525b" strokeWidth={GS} />
    </svg>
  );
}

function SqliteGlyph() {
  // three separate folded documents labelled DB / WAL / SHM
  const pages = [
    { x: 30, y: 3, label: "DB" },
    { x: 55, y: 1, label: "WAL" },
    { x: 80, y: 6, label: "SHM" },
  ];
  return (
    <svg viewBox="0 0 132 36" width={132} height={36} aria-hidden="true" focusable="false" style={glyphS}>
      {pages.map((p) => (
        <g key={p.label}>
          <path d={`M ${p.x},${p.y} h16 l6,6 v12 h-22 z`} fill="#0a0a0c" stroke="#a1a1aa" strokeWidth={GS} />
          <path d={`M ${p.x + 16},${p.y} v6 h6 z`} fill="#101014" stroke="#52525b" strokeWidth={GS} />
          <text x={p.x + 11} y={p.y + 24} textAnchor="middle" fontSize={6.5} fill="#8a8a94" fontFamily="'JetBrains Mono', monospace">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DiskGlyph() {
  return (
    <svg viewBox="0 0 132 36" width={132} height={36} aria-hidden="true" focusable="false" style={glyphS}>
      {/* physical drive: housing, platter, spindle, folder mark */}
      <rect x={36} y={6} width={60} height={24} rx={2} fill="#101014" stroke="#a1a1aa" strokeWidth={GS} />
      <circle cx={54} cy={18} r={8} fill="#0a0a0c" stroke="#a1a1aa" strokeWidth={GS} />
      <circle cx={54} cy={18} r={1.5} fill="#f4f4f5" />
      <line x1={55.4} y1={16.6} x2={59.7} y2={12.4} stroke="#52525b" strokeWidth={GS} />
      <path d="M 78,13 h5 l2,2 h9 v9 h-16 z" fill="#0a0a0c" stroke="#52525b" strokeWidth={GS} />
    </svg>
  );
}

const GLYPHS: Record<LayerId, React.FC> = {
  renderer: RendererGlyph,
  main: MainGlyph,
  sqlite: SqliteGlyph,
  disk: DiskGlyph,
};

function LayersStack({
  rm,
  stageRef,
  selected,
  onSelect,
}: {
  rm: boolean;
  stageRef: React.RefObject<HTMLDivElement | null>;
  selected: LayerSelection | null;
  onSelect: (s: LayerSelection | null) => void;
}) {
  // k calibration target: during a narrative sweep, scaleK(stage) reads the
  // first svg inside the stage — which is THIS reference in layers mode — so
  // figure x 40→360 maps to its 10%→90% width. Computing xFig the same way
  // here makes the sweep dispatch and a real pointer hover the exact same
  // roundtrip (L5).
  const refRef = useRef<SVGSVGElement>(null);
  const [sep, setSep] = useState(REST_SEP);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onMove = (e: PointerEvent) => {
      const w = refRef.current?.getBoundingClientRect().width || stage.clientWidth;
      const k = w / LAYERS_VB_W;
      const xFig = (e.clientX - stage.getBoundingClientRect().left) / k;
      const t = Math.min(1, Math.max(0, (xFig - 40) / 320));
      setSep(REST_SEP + (1 - REST_SEP) * t);
    };
    const onLeave = () => setSep(REST_SEP);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, [stageRef]);

  const someSelected = selected !== null;
  const extra = 2 + 12 * sep; // gap per pair: rest 4.16px → open 14px
  const EASE = "cubic-bezier(0.16,1,0.3,1)";
  const tSel = rm ? undefined : `transform 200ms ${EASE}`;
  const tOp = rm ? undefined : `opacity 200ms ${EASE}`;

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={refRef}
        viewBox={`0 0 ${LAYERS_VB_W} 220`}
        width="100%"
        height={220}
        aria-hidden="true"
        focusable="false"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      {/* the four layers — native buttons in a group, NOT a nested tablist (L2) */}
      <div
        role="group"
        aria-label="The four layers"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          height: 284, // sized for the open state: 4×56 + 3 gaps + full fan
          justifyContent: "center",
        }}
      >
        {(["renderer", "main", "sqlite", "disk"] as const).map((id, i) => {
          const isSel = selected === id;
          const Glyph = GLYPHS[id];
          return (
            <div
              key={id}
              style={{
                transform: `translateY(${(i - 1.5) * extra}px)`,
                transition: tSel,
              }}
            >
              <button
                type="button"
                aria-pressed={isSel}
                aria-controls="layer-detail-panel"
                onClick={() => onSelect(isSel ? null : id)}
                className="instrument"
                style={{
                  width: "100%",
                  minHeight: 44,
                  height: 56,
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  background: isSel ? "#101014" : "#0a0a0c",
                  border: `1px solid ${isSel ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 8,
                  transform: isSel
                    ? "translateX(4px) scale(1.015)"
                    : someSelected
                      ? "translateX(-2px) scale(0.985)"
                      : "none",
                  transition: tSel,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 10, color: "#f4f4f5", letterSpacing: "0.08em", minWidth: 0 }}
                >
                  {`0${i + 1}`} · {LAYER_NAMES[id]}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    display: "block",
                    // labels stay readable; only the illustration recedes (L2)
                    opacity: isSel || !someSelected ? 1 : 0.55,
                    transition: tOp,
                  }}
                >
                  <Glyph />
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {/* separate CONNECTIONS / 2 DESTINATIONS control — NOT a fifth layer (L1) */}
      <button
        type="button"
        aria-pressed={selected === "connections"}
        aria-controls="layer-detail-panel"
        onClick={() => onSelect(selected === "connections" ? null : "connections")}
        className="instrument"
        style={{
          width: "100%",
          minHeight: 44,
          marginTop: 10,
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          background: "transparent",
          border: `1px solid ${selected === "connections" ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 8,
          opacity: someSelected && selected !== "connections" ? 0.55 : 1,
          transition: tOp,
        }}
      >
        <span className="mono" style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.1em" }}>
          CONNECTIONS / 2 DESTINATIONS
        </span>
      </button>
    </div>
  );
}

// L3 detail panel — aria-live polite, one selected layer's three lines, or the
// overview facts when nothing is selected. Grid stacking keeps both crossfade
// layers in one cell: no fixed height, no collapse gap, no layout animation.
function LayerDetail({ selected, rm }: { selected: LayerSelection | null; rm: boolean }) {
  const copy = selected ? LAYER_COPY[selected] : null;
  return (
    <div
      id="layer-detail-panel"
      aria-live="polite"
      aria-atomic="true"
      style={{ display: "grid", marginTop: 16 }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={selected ?? "overview"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: rm ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] } }}
          transition={{ duration: rm ? 0 : 0.16, delay: rm ? 0 : 0.04, ease: [0.16, 1, 0.3, 1] }}
          style={{
            gridArea: "1 / 1",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 8px",
          }}
        >
          {copy ? (
            <>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: "#f4f4f5",
                  margin: 0,
                  fontFamily: "var(--font-display), 'Space Grotesk', sans-serif",
                }}
              >
                {copy.headline}
              </p>
              <p className="mono" style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 440 }}>
                {copy.body}
              </p>
              <p className="mono" style={{ fontSize: 11, color: "#63636b", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 440 }}>
                {copy.where}
              </p>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              {OVERVIEW_FACTS.map((f, i) => (
                <p key={i} className="mono" style={{ fontSize: 11, color: "#63636b", lineHeight: 1.6, margin: 0, maxWidth: 440 }}>
                  {f}
                </p>
              ))}
              {TRUST_FACTS.map((f, i) => (
                <p key={`t${i}`} className="mono" style={{ fontSize: 11, color: "#63636b", lineHeight: 1.6, margin: 0, maxWidth: 440 }}>
                  {f}
                </p>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Synthetic pointer primitives (Path B; GLM round 03 V4/V5).
// Per-event rect re-read; buttons =1 while pressed (0 on up); down at pts[0],
// move at pts[1..], up at pts[last]. Points are px offsets from the stage
// element's top-left, already scaled by k.
type Pt = [number, number];

function dispatchPointer(
  el: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
) {
  const rect = el.getBoundingClientRect();
  el.dispatchEvent(
    new PointerEvent(type, {
      clientX: rect.left + x,
      clientY: rect.top + y,
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: "mouse",
      buttons: type === "pointerup" ? 0 : 1,
    }),
  );
}

// Synchronous pass — reduced-motion: every step dispatched in one frame
// (state still changes; all 32 steps kept for angle-delta integrators).
function sweep(el: HTMLElement, points: Pt[]): Promise<void> {
  for (let i = 0; i < points.length; i++) {
    const type =
      i === 0 ? "pointerdown" : i === points.length - 1 ? "pointerup" : "pointermove";
    dispatchPointer(el, type, points[i][0], points[i][1]);
  }
  return Promise.resolve();
}

// Timed pass — 40ms-grid steps (GLM V5).
function sweepTimed(el: HTMLElement, points: Pt[], stepMs: number): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const timer = setInterval(() => {
      if (i >= points.length) {
        clearInterval(timer);
        resolve();
        return;
      }
      const type =
        i === 0 ? "pointerdown" : i === points.length - 1 ? "pointerup" : "pointermove";
      dispatchPointer(el, type, points[i][0], points[i][1]);
      i++;
    }, stepMs);
  });
}

// Figure-space constants (GLM V4). Center = LAP bbox: x (128+272)/2,
// y (118+206)/2. Orbit R1=25 sits between RD=17 and the LAP orbit 44–73;
// pointerdown at R0=12 (< RD, on the dial). Full CW lap guarantees crossing
// the 40° COMBO reference whether it is an absolute dial angle or cumulative.
const DIAL_CENTER: Pt = [200, 162];
const R0 = 12;
const R1 = 25;
const STEPS = 32;
const STEP_MS = 20;

// k scales figure space → stage px, read from the LIVE SVG (never assume 1).
function scaleK(stage: HTMLElement): number {
  const svg = stage.querySelector("svg");
  const vbW = svg?.viewBox.baseVal.width || 400;
  const px = svg?.getBoundingClientRect().width || stage.clientWidth;
  return px / vbW;
}

function dialLap(k: number): Pt[] {
  const [cx, cy] = DIAL_CENTER;
  const pts: Pt[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const th = ((180 + 360 * t) * Math.PI) / 180; // increasing θ = CW in y-down space
    const r = R0 + (R1 - R0) * Math.min(1, (t * STEPS) / 3); // radial ramp over first 3 steps
    pts.push([(cx + r * Math.cos(th)) * k, (cy + r * Math.sin(th)) * k]);
  }
  return pts;
}

// GAP4 sweep across the stage at dial-center height: x 40→360 open, 360→40 close.
function layersSweep(k: number, reverse = false): Pt[] {
  const y = DIAL_CENTER[1] * k;
  const n = reverse ? 24 : STEPS;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = reverse ? 360 - (320 * i) / n : 40 + (320 * i) / n;
    pts.push([x * k, y]);
  }
  return pts;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function FigureInstrument({ rm }: { rm: boolean }) {
  const [mode, setMode] = useState<"vault" | "layers">("vault");
  const [readout, setReadout] = useState<string | null>(null);
  const [tourRunning, setTourRunning] = useState(false);
  // LAYERS selection: renderer|main|sqlite|disk|connections, null = overview.
  // Cleared when a mode transition begins (L5); the LayersStack remount in a
  // crossfade also resets it.
  const [selected, setSelected] = useState<LayerSelection | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Auto-play the figure tour on mount and on tab switch so users see it's interactive.
  // The tour runs ~12s; after that, stop and let the user drive.
  useEffect(() => {
    setReadout(null);
  }, [mode]);

  // L2/onRead: the "read" line carries the selected layer's plain headline.
  useEffect(() => {
    if (mode === "vault") return;
    setReadout(selected ? LAYER_COPY[selected].headline : null);
  }, [selected, mode]);

  // V5 narrative timing. VAULT→LAYERS 2,360ms: dial lap 640 → open settle 320
  // → crossfade window 520 (out 320 / in 400 @ delay 120) → layers sweep 640
  // → settle 240. LAYERS→VAULT 2,000ms: collapse sweep 480 → hold 240
  // → crossfade 520 → re-open dial lap 640 → settle 120. Under reduced motion
  // every duration is 0 (synchronous dispatch; holds skipped). We drive
  // pointer only — hairline owns the figure's internal springs.
  const runNarrative = async (target: "layers" | "vault") => {
    const stage = stageRef.current;
    if (!stage) {
      setMode(target);
      return;
    }
    setTourRunning(true);
    setSelected(null); // L5: clear selection when a mode transition begins
    setReadout("the vault opens onto the stack");
    const k = scaleK(stage);
    if (target === "layers") {
      await (rm ? sweep(stage, dialLap(k)) : sweepTimed(stage, dialLap(k), STEP_MS));
      if (!rm) await wait(320);
      setMode("layers");
      if (!rm) await wait(520); // crossfade window; incoming handlers attach on mount
      const s2 = stageRef.current ?? stage;
      const k2 = scaleK(s2);
      await (rm ? sweep(s2, layersSweep(k2)) : sweepTimed(s2, layersSweep(k2), STEP_MS));
      if (!rm) await wait(240);
    } else {
      await (rm ? sweep(stage, layersSweep(k, true)) : sweepTimed(stage, layersSweep(k, true), STEP_MS));
      if (!rm) await wait(240);
      setMode("vault");
      if (!rm) await wait(520);
      const s2 = stageRef.current ?? stage;
      const k2 = scaleK(s2);
      await (rm ? sweep(s2, dialLap(k2)) : sweepTimed(s2, dialLap(k2), STEP_MS));
      if (!rm) await wait(120);
    }
    stage.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: true, pointerId: 1, pointerType: "mouse" }),
    );
    setReadout(null);
    setTourRunning(false);
  };

  const isVault = mode === "vault";
  const defaultReadout = isVault
    ? "One database, three files — db, -wal, -shm. The combination is yours."
    : "Renderer → main → SQLite → your disk. No server in the stack.";

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
              aria-disabled={tourRunning}
              onClick={() => {
                if (tourRunning || m === mode) return;
                void runNarrative(m);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next = m === "vault" ? "layers" : "vault";
                  if (tourRunning) return;
                  document.getElementById(`figure-tab-${next}`)?.focus();
                  void runNarrative(next);
                }
              }}
              className="mono"
              style={{
                fontSize: 11,
                padding: "6px 10px",
                borderRadius: 6,
                cursor: tourRunning ? "default" : "pointer",
                opacity: tourRunning ? 0.45 : 1,
                pointerEvents: tourRunning ? "none" : "auto",
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
        id="figure-panel"
        data-motion={isVault ? "vault-figure" : "layers-stack"}
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
            exit={{ opacity: 0, y: -8, transition: { duration: rm ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] } }}
            transition={{
              duration: rm ? 0 : 0.4,
              delay: rm ? 0 : 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {isVault ? (
              <Vault label="Locked by default; the combination is yours" onRead={setReadout} />
            ) : (
              <LayersStack rm={rm} stageRef={stageRef} selected={selected} onSelect={setSelected} />
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
            : "↑ INTERACT: move across to open the stack · click a layer to inspect it"}
        </p>
        <button
          type="button"
          disabled={tourRunning}
          aria-disabled={tourRunning}
          onClick={async () => {
            const stage = stageRef.current;
            if (!stage) return;
            setTourRunning(true);
            setReadout(isVault ? "the vault opens onto the stack" : "the stack closes onto the vault");
            const k = scaleK(stage);
            if (isVault) {
              // dial lap to 40° (COMBO) → bolts draw back; settle 320 (V4/V5)
              await (rm ? sweep(stage, dialLap(k)) : sweepTimed(stage, dialLap(k), STEP_MS));
              if (!rm) await wait(320);
            } else {
              // GAP4 0.18 → 1.0 across the stage; settle 240
              await (rm ? sweep(stage, layersSweep(k)) : sweepTimed(stage, layersSweep(k), STEP_MS));
              if (!rm) await wait(240);
            }
            stage.dispatchEvent(
              new PointerEvent("pointerleave", { bubbles: true, pointerId: 1, pointerType: "mouse" }),
            );
            setTourRunning(false);
            setReadout(null);
          }}
          className="mono"
          style={{
            marginTop: 8,
            fontSize: 11,
            color: tourRunning ? "#63636b" : "#8a8a94",
            opacity: tourRunning ? 0.45 : 1,
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

      {isVault ? (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "center",
          }}
        >
          {VAULT_FACTS.map((f, i) => (
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
      ) : (
        <LayerDetail selected={selected} rm={rm} />
      )}
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
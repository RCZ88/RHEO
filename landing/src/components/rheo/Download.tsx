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
// Connections control (not a fifth layer). Sweep integration (L5): real
// pointer moves bubble up to the stage element and the synthetic sweep is
// dispatched on it directly, so the listener attaches to the stage — it maps
// figure x 40→360 (k = stage width / 400) to separation rest 0.18 → open 1.0.
// Selection never replays the sweep; one selection at a time; clicking the
// active item returns to the overview. Exact copy below is verbatim from GLM's L3.

type LayerId = "renderer" | "main" | "sqlite" | "disk";
type LayerSelection = LayerId | "connections";

const REST_SEP = 0.18;
const LAYERS_VB_W = 400; // the stage is 400 figure units wide (GAP4, shared with dispatchPointer)

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
  // GAP4 mapping shared with dispatchPointer: the stage is 400 figure units
  // wide (k = rect.width / 400), so the synthetic sweep and a real pointer
  // hover are the exact same roundtrip — x 40 → separation rest 0.18, x 360 →
  // open 1.0 (L5).
  const [sep, setSep] = useState(REST_SEP);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const xFig = (e.clientX - r.left) / (r.width / LAYERS_VB_W);
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

// Synthetic pointer primitives (Path B; rev-2 per GLM round 05, live-measured).
// Every dispatch happens ON the figure's own stage element — hairline's
// pointer() listeners sit on the descendant [data-hairline] stage, and
// parent-targeted events never enter a child's propagation path (the old
// panel-container dispatch reached the figure zero times on the live site).
// Coordinates are FIGURE space (svg viewBox units, 400 wide); each event
// re-reads the rect and scales by k = rect.width / 400, so the synthetic
// sweep and a real pointer hover share one mapping at every window size.
//
// Why the vault lap is adaptive (all measured on the deployed figure,
// hairline@0.5.1):
//  · open needs |wrap(a−40)| < 0.8 AND |w| < 6 — a fast crossing never fires;
//    the dial must SETTLE on detent 40.
//  · the true dial center is (178.79, 180.56); the old orbit (200,162) R25
//    did not enclose it (distance 28.2 > 25, winding 0) — the dial wobbled
//    and coasted to detent 00. It never opened.
//  · WMAX2 = 150 dial-units/s caps travel at ~96 units per 640ms; a full-turn
//    catch (+110 from rest 30) needs ≥1.1s → N = round(Δ/1.93) × 20ms.
//  · velocity profile accel .12 / hold .46 / decel .26 / creep .16 keeps the
//    creep tail under the |w| < 6 open gate; the settle spring snaps the
//    catch ~+212..244ms after the final pointerup.
type Pt = [number, number];

function dispatchPointer(
  el: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointerleave",
  x: number,
  y: number,
) {
  const rect = el.getBoundingClientRect(); // per event, like the reference
  const k = rect.width / 400;
  el.dispatchEvent(
    new PointerEvent(type, {
      clientX: rect.left + x * k,
      clientY: rect.top + y * k,
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: "mouse",
      buttons: type === "pointerup" || type === "pointerleave" ? 0 : 1,
    }),
  );
}

/** The vault figure's own stage: hairline sets data-hairline="vault" on it. */
function figureStage(stage: HTMLElement): HTMLElement | null {
  return stage.querySelector<HTMLElement>('[data-hairline="vault"]');
}

// Synchronous pass — reduced motion: every step dispatched in one frame
// (state still changes; integrators see every position).
function sweep(el: HTMLElement, points: Pt[]): Promise<void> {
  for (let i = 0; i < points.length; i++) {
    const type =
      i === 0 ? "pointerdown" : i === points.length - 1 ? "pointerup" : "pointermove";
    dispatchPointer(el, type, points[i][0], points[i][1]);
  }
  return Promise.resolve();
}

// Timed pass — 20ms-grid steps.
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

/* ── Dial lap: measured constants (hairline@0.5.1, vault mount) ── */

const DIAL_CENTER: Pt = [178.79, 180.56]; // tick-ring centroid, stage units
const R_MIN = 12; // grab radius (< RD 17, on the dial)
const R_MAX = 30; // orbit radius — encloses the dial center
const DEG_PER_UNIT = 4.68; // pointer degrees per dial unit (measured, R30 orbit)
const UNITS_PER_STEP = 1.93; // dial travel per 20ms step (clamp-limited, measured)
const OPEN_DETENT = 40;
const STEP_MS = 20;

// velocity shape as a fraction of mean: accel .12 / hold .46 / decel .26 / creep .16
function vShape(t: number): number {
  if (t < 0.12) {
    const u = t / 0.12;
    return 0.5 * (1 - Math.cos(Math.PI * u));
  }
  if (t < 0.58) return 1;
  if (t < 0.84) {
    const u = (t - 0.58) / 0.26;
    return 1 + (0.03 - 1) * 0.5 * (1 - Math.cos(Math.PI * u));
  }
  return 0.03; // creep: ~3% of mean → dial w converges under the open gate
}

// normalized position p(t) in [0,1] (trapezoid integral, numerically normalized)
function posAt(t: number): number {
  const M = 200;
  const f = (x: number) => {
    let s = 0;
    for (let j = 0; j < M; j++)
      s += 0.5 * (vShape((x * j) / M) + vShape((x * (j + 1)) / M)) / M;
    return s * x;
  };
  return f(t) / f(1);
}

const orbit = (deg: number, rad: number): Pt => {
  const th = (deg * Math.PI) / 180;
  return [DIAL_CENTER[0] + rad * Math.cos(th), DIAL_CENTER[1] + rad * Math.sin(th)];
};

/**
 * Probe the dial's resting position: hover at the grab point (last2 === null
 * after a leave, so this moves nothing), wait two rAF (the read updates on
 * hairline's board tick), parse "dial NN" from the onRead stream.
 */
async function probeDial(
  stage: HTMLElement,
  readRef: { current: string },
): Promise<number> {
  dispatchPointer(stage, "pointermove", ...orbit(180, R_MIN));
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const m = /dial (\d+)/.exec(readRef.current);
  return m ? parseInt(m[1], 10) : 30; // fresh mounts rest at REST16 = 30
}

/**
 * The dial lap. Adaptive full turn that creeps into detent 40 and lets the
 * settle spring snap the catch: setOpen fires ~+212..244ms after the last
 * pointer event (measured), bolts complete ≤800ms (stagger |i−from|·50 +
 * 700ms tween). Reduced motion: synchronous dispatch — the move handler
 * snaps per move, so the dial lands in the catch basin in one frame.
 */
async function dialLap(
  stage: HTMLElement,
  readRef: { current: string },
  rm: boolean,
): Promise<void> {
  // normalize: if the user left the dial coasting, let it rest first
  dispatchPointer(stage, "pointerleave", ...orbit(180, R_MIN));
  const restDeadline = performance.now() + 2500;
  while (/dial/.test(readRef.current) && performance.now() < restDeadline) {
    await new Promise<void>((r) => setTimeout(r, 60));
  }
  const a0 = await probeDial(stage, readRef);

  let delta = (OPEN_DETENT - a0 + 100) % 100; // dial units to travel
  if (delta < 60) delta += 100; // guarantee a full-turn gesture
  const N = Math.max(31, Math.round(delta / UNITS_PER_STEP));
  const T = N * 20; // ms
  const theta = DEG_PER_UNIT * delta; // pointer degrees, CW from 180°
  const point = (i: number, t: number): Pt => {
    const rad = R_MIN + (R_MAX - R_MIN) * Math.min(1, i / 3); // grab, then orbit
    return orbit(180 + theta * posAt(t), rad);
  };

  if (rm) {
    for (let i = 0; i <= N; i++) {
      const [x, y] = point(i, i / N);
      dispatchPointer(
        stage,
        i === 0 ? "pointerdown" : i === N ? "pointerup" : "pointermove",
        x,
        y,
      );
    }
    dispatchPointer(stage, "pointerleave", ...point(N, 1));
    return;
  }

  const t0 = performance.now();
  let i = 0;
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (i > N) {
        clearInterval(iv);
        resolve();
        return;
      }
      // wall-clock t: interval jitter self-corrects
      const t = Math.min(1, (performance.now() - t0) / T);
      const [x, y] = point(i, t);
      dispatchPointer(
        stage,
        i === 0 ? "pointerdown" : i === N ? "pointerup" : "pointermove",
        x,
        y,
      );
      i++;
    }, 20);
  });
  dispatchPointer(stage, "pointerleave", ...point(N, 1));
}

/**
 * Q4 dev assert — the ONLY open signature: setOpen(true) → light() toggles
 * class "hi" on the three moving-bolt silhouettes.
 *   open           → stage.querySelectorAll("path.sil.hi").length === 3
 *   closed + hover → 1 (dial silhouette)
 *   closed + idle  → 0 sil + 1 path.nf.hi (the 40 tick)
 * The onRead string ("dial 40 · open") is NOT stable at rest ("rest") — never
 * assert on it.
 */
function assertVaultOpens(stage: HTMLElement, msAfterLapEnd = 600): void {
  if (process.env.NODE_ENV === "production") return;
  setTimeout(() => {
    const n = stage.querySelectorAll("path.sil.hi").length;
    if (n !== 3) {
      console.error(
        `[hairline] vault did not open within ${msAfterLapEnd}ms of lap end (path.sil.hi = ${n}, expected 3)`,
      );
    }
  }, msAfterLapEnd);
}

// GAP4 sweep across the stage at mid height: x 40→360 opens the stack,
// 360→40 collapses it (figure space; dispatchPointer scales per event).
function layersSweep(reverse = false): Pt[] {
  const n = reverse ? 24 : 32;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = reverse ? 360 - (320 * i) / n : 40 + (320 * i) / n;
    pts.push([x, 162]);
  }
  return pts;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function FigureInstrument({ rm }: { rm: boolean }) {
  const [mode, setMode] = useState<"vault" | "layers">("vault");
  const [readout, setReadout] = useState<string | null>(null);
  // Narrative caption, separate from the live read stream: the figure's
  // onRead("dial NN") fires ~16ms into a lap and would clobber the caption if
  // they shared one setter (GLM round 05).
  const [narr, setNarr] = useState<string | null>(null);
  const [tourRunning, setTourRunning] = useState(false);
  // LAYERS selection: renderer|main|sqlite|disk|connections, null = overview.
  // Cleared when a mode transition begins (L5); the LayersStack remount in a
  // crossfade also resets it.
  const [selected, setSelected] = useState<LayerSelection | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Synchronous mirror of the figure's read stream — the lap's rest-poll and
  // probe read this directly (state updates are async).
  const readRef = useRef("");

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

  // Rev-2 narrative timing (GLM round 05, live-measured). VAULT→LAYERS ≈2,975ms:
  // adaptive dial lap (~1.14s from rest 30; clamp-limited travel needs ≥1.1s
  // for a full-turn catch) → open settle 400 (bolts ~87% at 300ms) → crossfade
  // 520 (sync overlap) → layers sweep 640 → settle 240. LAYERS→VAULT ≈2,935ms:
  // collapse sweep 480 → hold 240 → crossfade 520 → lap → open settle 400 →
  // settle 120. Reduced motion: synchronous dispatch, holds skipped — but two
  // rAFs still bridge each setMode so the incoming figure's listeners exist
  // before its lap/sweep dispatches. We drive pointer only — hairline owns the
  // figure's internal springs.
  const runNarrative = async (target: "layers" | "vault") => {
    const stage = stageRef.current;
    if (!stage) {
      setMode(target);
      return;
    }
    setTourRunning(true);
    setSelected(null); // L5: clear selection when a mode transition begins
    setNarr(target === "layers" ? "the vault opens onto the stack" : "the stack closes onto the vault");
    const settleCrossfade = () =>
      rm
        ? new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
        : wait(520);
    if (target === "layers") {
      // dial lap on the vault's OWN stage, then the crossfade onto the stack
      const vStage = figureStage(stage);
      if (vStage) {
        await dialLap(vStage, readRef, rm);
        assertVaultOpens(vStage);
      }
      if (!rm) await wait(400); // open settle
      setMode("layers");
      await settleCrossfade();
      const s2 = stageRef.current ?? stage;
      await (rm ? sweep(s2, layersSweep(false)) : sweepTimed(s2, layersSweep(false), STEP_MS));
      if (!rm) await wait(240);
    } else {
      await (rm ? sweep(stage, layersSweep(true)) : sweepTimed(stage, layersSweep(true), STEP_MS));
      if (!rm) await wait(240);
      setMode("vault");
      await settleCrossfade();
      // re-open lap on the freshly mounted vault (rests at 30)
      const s2 = stageRef.current ?? stage;
      const vStage = figureStage(s2);
      if (vStage) {
        await dialLap(vStage, readRef, rm);
        assertVaultOpens(vStage);
      }
      if (!rm) {
        await wait(400); // open settle
        await wait(120);
      }
    }
    stage.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: true, pointerId: 1, pointerType: "mouse" }),
    );
    setNarr(null);
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
        {/* sync crossfade (GLM round 05): out 320 / in 400 @ delay 120 overlap
            in one grid cell — 520ms window, the incoming figure mounts at once */}
        <div style={{ display: "grid" }}>
          <AnimatePresence>
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
              style={{ gridArea: "1 / 1" }}
            >
              {isVault ? (
                <Vault
                  label="Locked by default; the combination is yours"
                  onRead={(v) => {
                    readRef.current = v;
                    setReadout(v);
                  }}
                />
              ) : (
                <LayersStack rm={rm} stageRef={stageRef} selected={selected} onSelect={setSelected} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

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
            setNarr(isVault ? "the vault opens onto the stack" : "the stack closes onto the vault");
            if (isVault) {
              // adaptive dial lap on the vault's own stage → bolts draw back;
              // 500ms wait covers the open (+~250) and bolts (~87% at 300ms)
              const vStage = figureStage(stage);
              if (vStage) {
                await dialLap(vStage, readRef, rm);
                assertVaultOpens(vStage);
              }
              if (!rm) await wait(500);
            } else {
              // GAP4 0.18 → 1.0 across the stage; settle 240
              await (rm ? sweep(stage, layersSweep(false)) : sweepTimed(stage, layersSweep(false), STEP_MS));
              if (!rm) await wait(240);
            }
            stage.dispatchEvent(
              new PointerEvent("pointerleave", { bubbles: true, pointerId: 1, pointerType: "mouse" }),
            );
            setNarr(null);
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
        {narr ?? readout ?? defaultReadout}
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
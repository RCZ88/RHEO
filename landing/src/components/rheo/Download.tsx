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

// explosion debris: ten hairline shards radiating from the stack center
const DEBRIS = Array.from({ length: 10 }, (_, i) => ({
  a: i * 36, // radial angle
  delay: (i % 2) * 0.05, // alternating stagger
  len: i % 2 ? 16 : 24, // alternating shard length
}));

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

function RendererGlyph({ rm }: { rm: boolean }) {
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
      {/* idle life: the content rows breathe — activity is flowing (rm-gated) */}
      <motion.g
        animate={rm ? undefined : { opacity: [1, 0.35, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <line x1={52} y1={16} x2={94} y2={16} stroke="#52525b" strokeWidth={GS} />
        <line x1={52} y1={21} x2={94} y2={21} stroke="#52525b" strokeWidth={GS} />
        <line x1={52} y1={26} x2={80} y2={26} stroke="#52525b" strokeWidth={GS} />
      </motion.g>
    </svg>
  );
}

function MainGlyph({ rm }: { rm: boolean }) {
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
      {/* idle life: the tick ring turns — the main process is always recording (rm-gated) */}
      <motion.g
        animate={rm ? undefined : { rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "66px 18px" }}
      >
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#52525b" strokeWidth={GS} />
        ))}
      </motion.g>
      <circle cx={66} cy={18} r={7} fill="#0a0a0c" stroke="#a1a1aa" strokeWidth={GS} />
      <circle cx={66} cy={18} r={1.5} fill="#f4f4f5" />
      <line x1={41} y1={12} x2={30} y2={12} stroke="#52525b" strokeWidth={GS} />
      <rect x={24} y={9} width={6} height={6} fill="#0a0a0c" stroke="#52525b" strokeWidth={GS} />
      <line x1={91} y1={24} x2={102} y2={24} stroke="#52525b" strokeWidth={GS} />
      <rect x={102} y={21} width={6} height={6} fill="#0a0a0c" stroke="#52525b" strokeWidth={GS} />
    </svg>
  );
}

function SqliteGlyph({ rm }: { rm: boolean }) {
  // three separate folded documents labelled DB / WAL / SHM
  const pages = [
    { x: 30, y: 3, label: "DB" },
    { x: 55, y: 1, label: "WAL" },
    { x: 80, y: 6, label: "SHM" },
  ];
  return (
    <svg viewBox="0 0 132 36" width={132} height={36} aria-hidden="true" focusable="false" style={glyphS}>
      {pages.map((p) => {
        const page = (
          <>
            <path d={`M ${p.x},${p.y} h16 l6,6 v12 h-22 z`} fill="#0a0a0c" stroke="#a1a1aa" strokeWidth={GS} />
            <path d={`M ${p.x + 16},${p.y} v6 h6 z`} fill="#101014" stroke="#52525b" strokeWidth={GS} />
            <text x={p.x + 11} y={p.y + 24} textAnchor="middle" fontSize={6.5} fill="#8a8a94" fontFamily="'JetBrains Mono', monospace">
              {p.label}
            </text>
          </>
        );
        // idle life: the WAL page flutters — writes are landing (rm-gated)
        return p.label === "WAL" ? (
          <motion.g
            key={p.label}
            animate={rm ? undefined : { opacity: [1, 0.55, 1], y: [0, -1.5, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {page}
          </motion.g>
        ) : (
          <g key={p.label}>{page}</g>
        );
      })}
    </svg>
  );
}

function DiskGlyph({ rm }: { rm: boolean }) {
  return (
    <svg viewBox="0 0 132 36" width={132} height={36} aria-hidden="true" focusable="false" style={glyphS}>
      {/* physical drive: housing, platter, spindle, folder mark */}
      <rect x={36} y={6} width={60} height={24} rx={2} fill="#101014" stroke="#a1a1aa" strokeWidth={GS} />
      <circle cx={54} cy={18} r={8} fill="#0a0a0c" stroke="#a1a1aa" strokeWidth={GS} />
      <circle cx={54} cy={18} r={1.5} fill="#f4f4f5" />
      {/* idle life: the platter turns — its radius mark shows the spin (rm-gated) */}
      <motion.line
        animate={rm ? undefined : { rotate: 360 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "54px 18px" }}
        x1={55.4} y1={16.6} x2={59.7} y2={12.4} stroke="#52525b" strokeWidth={GS}
      />
      <path d="M 78,13 h5 l2,2 h9 v9 h-16 z" fill="#0a0a0c" stroke="#52525b" strokeWidth={GS} />
    </svg>
  );
}

const GLYPHS: Record<LayerId, React.FC<{ rm: boolean }>> = {
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
  const PLATE_PITCH = 62; // rest-slot pitch: 56px plate + 6px gap (burst spacing)
  const EASE = "cubic-bezier(0.16,1,0.3,1)";
  const tSel = rm ? undefined : `transform 200ms ${EASE}`;
  const tOp = rm ? undefined : `opacity 200ms ${EASE}`;

  return (
    <div style={{ position: "relative" }}>
      {/* the shockwave — ONE hairline ring expanding from the stack center.
          LAMINAR: a shockwave is a line, not light — no glow, no gradient.
          Runs once per LayersStack mount (the vault→layers burst), rm-gated. */}
      {!rm && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0.8, scale: 0.25 }}
          animate={{ opacity: 0, scale: 2.6 }}
          transition={{ duration: 0.85, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "absolute",
            top: 142, // center of the fan group (284px tall, centered)
            left: "50%",
            width: 220,
            height: 220,
            marginLeft: -110,
            marginTop: -110,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.85)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* second shockwave — faster and tighter, right behind the first */}
      {!rm && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0.5, scale: 0.25 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "absolute",
            top: 142,
            left: "50%",
            width: 220,
            height: 220,
            marginLeft: -110,
            marginTop: -110,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.6)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* debris — ten hairline shards radiating from the stack center.
          Each wrapper holds a radial ANGLE; the inner shard travels outward
          along that angle (translateY in the rotated frame). Lines, not
          light: LAMINAR debris is a hairline, never a glow. */}
      {!rm &&
        DEBRIS.map((d, i) => (
          <div
            key={`debris-${i}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 142,
              left: "50%",
              width: 0,
              height: 0,
              transform: `rotate(${d.a}deg)`,
              pointerEvents: "none",
            }}
          >
            <motion.div
              initial={{ opacity: 0.9, y: -34 }}
              animate={{ opacity: 0, y: -168 }}
              transition={{ duration: 0.78, delay: 0.1 + d.delay, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                width: 2,
                height: d.len,
                marginLeft: -1,
                background: "rgba(244,244,245,0.7)",
              }}
            />
          </div>
        ))}
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
            <motion.div
              key={id}
              // the burst: each plate TUMBLES out of the stack center — it
              // starts at the mirrored slot (±93/±31px travel), tilted ±12°
              // and scaled .3, then flies outward to its rest slot. The inner
              // fan transform is untouched; this wrapper only carries the
              // entrance. Staggered top→bottom; rm static.
              initial={rm ? false : { opacity: 0, scale: 0.3, rotate: i % 2 ? 12 : -12, y: -(i - 1.5) * PLATE_PITCH }}
              animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
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
                    // labels stay readable; only the illustration recedes (L2).
                    // Selection = brightness (LAMINAR: importance is whiteness,
                    // never hue) — not another opacity step.
                    opacity: isSel || !someSelected ? 1 : 0.55,
                    filter: isSel ? "brightness(1.15)" : undefined,
                    transition: rm ? undefined : `opacity 200ms ${EASE}, filter 200ms ${EASE}`,
                  }}
                >
                  <Glyph rm={rm} />
                </span>
              </button>
              </div>
            </motion.div>
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

// Synthetic pointer primitives (Path B; live-measured). Every dispatch happens
// ON the listener's own element — the GAP4 fan listens on #figure-panel
// (stageRef), hairline's pointer() listeners sit on the descendant
// [data-hairline] stage, and parent-targeted events never enter a child's
// propagation path (the old panel-container dispatch reached the figure zero
// times on the live site). Coordinates are FIGURE space (svg viewBox units);
// each event re-reads the rect, so a synthetic sweep and a real pointer hover
// share one mapping at every window size.
//
// The VAULT lap is rev-3 (GLM round 07; live-validated on the deployed site) —
// see the "Vault lap rev-3" block below. Why rev-2 was replaced (all measured
// against hairline@0.5.1 + the deployed figure):
//  · DEG_PER_UNIT is 3.6 — the dial converts pointer arc at
//    da = -(Δang)/3.6 · clamp(r/22, 0, 1) FACE units; the old constant
//    overshot ~29% (Δ=110 delivered ~143 units + coast → detent 70/90,
//    never 40).
//  · a stage-space circle maps to a face ELLIPSE (r 19.6–37.8, gear 0.89–1.0);
//    a face-space circle at rf=25 roundtrips exactly (measured 25.000).
//  · the dial is velocity-driven and COASTS after pointerup (exp decay,
//    τ up to ~1.5s) — a fast sweep overshoots tens of units. The sweep now
//    arrives at raw detent 41 with w≈0 (cubic ease-out, 50×25ms) and the
//    settle spring snaps ONto 40 → open gate |a−40|<0.8 && |w|<6.
//  · hairline's board tick is IntersectionObserver-gated: off-screen,
//    dispatches integrate NOTHING and a deferred coast flings the dial to a
//    random detent (measured 30→77→90). Readiness therefore scrolls the stage
//    into view and waits for a fresh "dial NN" read before any dispatch (V3).
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

/* ── Vault lap rev-3 (GLM round 07; live-validated on the deployed site) ──
   Constants are hairline@0.5.1 dist values, not fits: the dial converts
   pointer arc at da = -(Δang)/3.6 · clamp(r/22, 0, 1) FACE units, and the
   orbit must be built in face space via the replicated projection — a
   stage-space circle maps to a face ellipse and the gear varies 0.89–1.0. */

const STEP_MS = 20; // GAP4 panel sweep grid (33 points × 20ms = 640ms)

const DEG_PER_UNIT = 3.6; // pointer degrees per dial unit (hairline dist)
const OPEN_DETENT = 40;
const RF = 25; // face orbit radius rf=25 — gear saturates: clamp(25/22,0,1)=1
const VAULT_PHI0 = 180; // start angle (face space); dial rises as phi decreases
const LAP_SAMPLES = 50; // sweep grid: 50 intervals × 25ms = 1,250ms (V4)
const LAP_STEP_MS = 25;
const READINESS_MS = 1200; // fresh-read wait ceiling (V3)
const REST_CEILING_MS = 2500; // coast/rest normalization ceiling (V3)

type FaceMap = { toStage: (u: number, v: number) => Pt };

/** Replicate hairline mount33's projection EXACTLY: Cam(45, 0.5, 1.5) + fit
 *  (200×166) + the onFace affine basis (p0 = P(0,DP,0), DP=14, ZC3=64) — the
 *  face origin IS the dial center. Roundtrip at rf=25 measured exact. */
function makeFaceMap(): FaceMap {
  const C = { az: (45 * Math.PI) / 180, k: 0.5, S: 1.5, ox: 0, oy: 0 };
  const proj = (x: number, y: number, z: number): Pt => {
    const c = Math.cos(C.az);
    const s = Math.sin(C.az);
    const zf = Math.sqrt(1 - C.k * C.k);
    const X = x * c - y * s;
    const Y = x * s + y * c;
    return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * zf)];
  };
  // fit(C, [...], 200, 166) — verbatim fit points (WX0=-70, WX1=70, WZ1=130, WT2=14, KD=10)
  const pts: Array<[number, number, number]> = [
    [-70, -14, 0],
    [70, -14, 0],
    [-70, -14, 130],
    [70, -14, 130],
    [-70, 10, 0],
    [70, 0, 0],
    [-70, 0, 130],
    [70, 0, 130],
  ];
  let a = 1e9;
  let b = -1e9;
  let c = 1e9;
  let d = -1e9;
  for (const p of pts) {
    const q = proj(p[0], p[1], p[2]);
    a = Math.min(a, q[0]);
    b = Math.max(b, q[0]);
    c = Math.min(c, q[1]);
    d = Math.max(d, q[1]);
  }
  C.ox = 200 - (a + b) / 2;
  C.oy = 166 - (c + d) / 2;
  const p0 = proj(0, 14, 0);
  const px = proj(1, 14, 0);
  const pz = proj(0, 14, 1);
  const A: Pt = [px[0] - p0[0], px[1] - p0[1]];
  const B: Pt = [pz[0] - p0[0], pz[1] - p0[1]];
  // face (u, v) → stage (svg viewBox units, 400×320)
  return {
    toStage: (u: number, v: number): Pt => [
      p0[0] + u * A[0] + (v + 64) * B[0],
      p0[1] + u * A[1] + (v + 64) * B[1],
    ],
  };
}

/* The vault lap dispatches on the vault's OWN stage with the LIVE stage rect:
   x scales by rect.width/400, y by rect.height/320 (the validated reference's
   KX/KY). The panel's dispatchPointer keeps the single width/400 scale the
   GAP4 sweep was verified with — the two listeners sit on different elements. */
function vaultDispatch(
  el: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointerleave",
  x: number,
  y: number,
) {
  const rect = el.getBoundingClientRect(); // re-read per event (V1)
  const kx = rect.width / 400;
  const ky = rect.height / 320;
  el.dispatchEvent(
    new PointerEvent(type, {
      clientX: rect.left + x * kx,
      clientY: rect.top + y * ky,
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: "mouse",
      buttons: type === "pointerup" || type === "pointerleave" ? 0 : 1,
    }),
  );
}

// V2: cubic ease-out — the sweep arrives at raw 41 with w≈0 and the settle
// spring snaps ONto 40. Never creep through 40.
// ── Lap profile (PROBLEMS #154 fix, CZ-approved 2026-11-14) ─────────────
// The rev-3 cubic ease-out peaked ~261 u/s — over hairline's ±150 u/s
// spin.w clamp — so the arc under-integrated ~20 units and the dial stalled
// on the detent BELOW 40 (settles 20/10, vault never opens). New profile:
// constant-rate bulk for LAP_BULK of the lap, then a linear decel to zero.
// Integral is exactly 1 by construction of C; peak dial velocity
// S·C/T ≈ 101 u/s (S=111, T=1.25s) stays under the clamp, so the full arc
// integrates and the tail arrives at the detent with w≈0 — the settle spring
// snaps ONto 40. Animated laps add LAP_OVERSHOOT_UNITS to compensate the
// lerp-startup lag (~3–4 units, measured); rm keeps the exact rev-3 arc.
const LAP_BULK = 0.75;
const LAP_OVERSHOOT_UNITS = 3;
const LAP_RATE_C = 1 / (0.5 + 0.5 * LAP_BULK);
function lapProgress(t: number): number {
  if (t <= LAP_BULK) return LAP_RATE_C * t;
  const d = (t - LAP_BULK) / (1 - LAP_BULK); // 0..1 across the decel
  return LAP_RATE_C * LAP_BULK + LAP_RATE_C * (1 - LAP_BULK) * (d - (d * d) / 2);
}

/**
 * Probe the dial's resting value: ONE hover move (a single move after a leave
 * computes no arc, so this rotates nothing), then wait for the FIRST fresh
 * "dial NN" read (max 1,200ms; V3). V5: fail loudly on timeout — no silent
 * fallback; the read only flows while the board ticks (IO-gated, on-screen).
 */
async function probeDial(
  stage: HTMLElement,
  readRef: { current: string },
  at: Pt,
): Promise<number | null> {
  readRef.current = ""; // a stale value cannot pass (V3)
  vaultDispatch(stage, "pointermove", at[0], at[1]);
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const by = performance.now() + READINESS_MS;
  while (performance.now() < by) {
    const m = /dial (\d+)/.exec(readRef.current);
    if (m) return parseInt(m[1], 10);
    await wait(50);
  }
  return null; // caller aborts the narrative loudly (V5)
}

type LapResult = { ok: boolean; a0: number | null };

/**
 * The dial lap, rev-3. Readiness (V3: scrollIntoView + visibility poll, no
 * blind delay) → coast/rest normalization (existing, 2,500ms ceiling) → hover
 * probe (V5: fail loudly, no silent fallback) → face-space sweep at rf=25,
 * 50 intervals × 25ms, cubic ease-out ending at raw 41 → pointerup + leave →
 * the settle spring snaps ONto detent 40 and the open gate
 * |wrap(a−40)|<0.8 && |w|<6 fires. Reduced motion dispatches the same points
 * synchronously, no timed interval (V4).
 * Returns ok:false on any readiness/probe failure — callers must abort the
 * narrative (no crossfade, no GAP4 sweep, no figure switch; V5).
 */
async function dialLap(
  stage: HTMLElement,
  readRef: { current: string },
  rm: boolean,
): Promise<LapResult> {
  const map = makeFaceMap();
  const facePoint = (deg: number): Pt => {
    const th = (deg * Math.PI) / 180;
    return map.toStage(RF * Math.cos(th), RF * Math.sin(th));
  };

  // V3 readiness — no blind 400ms delay: scroll into view, then poll
  // visibility. The board's tick is IO-gated, so visibility gates everything.
  readRef.current = "";
  const r0 = stage.getBoundingClientRect();
  if (r0.bottom < 0 || r0.top > window.innerHeight || r0.height === 0) {
    stage.scrollIntoView({ block: "center" });
  }
  const readyBy = performance.now() + READINESS_MS;
  let visible = false;
  while (performance.now() < readyBy) {
    const b = stage.getBoundingClientRect();
    if (b.bottom > 0 && b.top < window.innerHeight && b.width > 0) {
      visible = true;
      break;
    }
    await wait(50);
  }
  if (!visible) {
    console.error("[hairline] vault stage never became visible — lap aborted (V5)");
    return { ok: false, a0: null };
  }

  // coast/rest normalization: end any user drag, let the dial stop (existing)
  const start = facePoint(VAULT_PHI0);
  vaultDispatch(stage, "pointerleave", start[0], start[1]);
  const restBy = performance.now() + REST_CEILING_MS;
  while (/dial/.test(readRef.current) && performance.now() < restBy) {
    await wait(60);
  }

  const a0 = await probeDial(stage, readRef, start);
  if (a0 === null) {
    vaultDispatch(stage, "pointerleave", start[0], start[1]); // drop the hover
    console.error("[hairline] vault dial unreadable within 1,200ms — lap aborted (V5)");
    return { ok: false, a0: null };
  }

  // Δ to travel; +100 when short so the gesture is always a full turn (V1)
  let delta = (OPEN_DETENT - a0 + 100) % 100;
  if (delta < 60) delta += 100;
  // Lap profile (PROBLEMS #154): the rev-3 ease-out peaked ~261 u/s — over
  // hairline's ±150 u/s spin clamp — so the arc under-integrated ~20 units and
  // the dial stalled short of detent 40. Animated laps bulk-travel
  // +LAP_OVERSHOOT_UNITS beyond target (compensating the measured lerp-startup
  // lag, ~3–4u at ~100 u/s) under the new constant-rate profile, whose worst
  // peak S·C/T ≈ 149 u/s stays under the clamp; rm keeps the exact rev-3 arc
  // (synchronous dispatch has no startup deficit).
  const sweepUnits = delta + 1 + (rm ? 0 : LAP_OVERSHOOT_UNITS);
  const sweepDeg = sweepUnits * DEG_PER_UNIT; // +1 unit: settle snaps ONto 40 (V2)
  const phiEnd = VAULT_PHI0 - sweepDeg; // dial increases as pointer angle decreases

  const dispatchSample = (i: number, t: number) => {
    const phi = VAULT_PHI0 - sweepDeg * lapProgress(t);
    const [sx, sy] = facePoint(phi);
    vaultDispatch(
      stage,
      i === 0 ? "pointerdown" : i === LAP_SAMPLES ? "pointerup" : "pointermove",
      sx,
      sy,
    );
  };

  if (rm) {
    // Reduced motion: synchronous dispatch of the same points and target (V4)
    for (let i = 0; i <= LAP_SAMPLES; i++) dispatchSample(i, i / LAP_SAMPLES);
    vaultDispatch(stage, "pointerleave", ...facePoint(phiEnd));
    return { ok: true, a0 };
  }

  const t0 = performance.now();
  let i = 0;
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (i > LAP_SAMPLES) {
        clearInterval(iv);
        resolve();
        return;
      }
      // wall-clock progress self-corrects timer jitter (V4); the FINAL sample
      // is pointerup at the EXACT target
      const t =
        i === LAP_SAMPLES
          ? 1
          : Math.min(1, (performance.now() - t0) / (LAP_SAMPLES * LAP_STEP_MS));
      dispatchSample(i, t);
      i++;
    }, LAP_STEP_MS);
  });
  vaultDispatch(stage, "pointerleave", ...facePoint(phiEnd));
  return { ok: true, a0 };
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

// §7b runtime stamp — proves the v10.0 bundle is actually served (module scope:
// logs once per load, not per render).
console.log("%c[FigureInstrument] v10.0 loaded", "color: #fbbf24; font-weight: bold");

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

  // Rev-3 narrative timing (GLM round 07). VAULT→LAYERS: readiness (visibility
  // poll ≤1.2s) + coast/rest normalization (≤2.5s, usually instant) + hover
  // probe (≤1.2s) → lap 1,250ms → open settle 400 → crossfade 520 → GAP4
  // sweep 640 → settle 240. LAYERS→VAULT: collapse 480 → hold 240 → crossfade
  // 520 → readiness + normalization + probe → lap 1,250 → open settle 400 →
  // settle 120. The readiness/probe/lap are UNBOUNDED by design (V3) — no
  // obsolete fixed totals. Reduced motion: synchronous dispatch, holds
  // skipped — but two rAFs still bridge each setMode so the incoming figure's
  // listeners exist before its lap/sweep dispatches (V6.2). We drive pointer
  // only — hairline owns the figure's internal springs. A readiness/probe
  // failure aborts the narrative loudly (V5): caption cleared, re-entry lock
  // released, no crossfade, no GAP4, no figure switch.
  const runNarrative = async (target: "layers" | "vault") => {
    const stage = stageRef.current;
    if (!stage) {
      setMode(target);
      return;
    }
    setTourRunning(true);
    setSelected(null); // L5: clear selection when a mode transition begins
    setNarr(target === "layers" ? "the vault opens onto the stack" : "the stack closes onto the vault");
    const abort = () => {
      // V5: skip the lap, clear the caption, release the re-entry lock
      setNarr(null);
      setTourRunning(false);
    };
    const settleCrossfade = () =>
      rm
        ? new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
        : wait(520);
    if (target === "layers") {
      // dial lap on the vault's OWN stage, then the crossfade onto the stack
      const vStage = figureStage(stage);
      if (!vStage) {
        console.error("[hairline] vault stage not mounted — narrative aborted (V5)");
        abort();
        return;
      }
      const lap = await dialLap(vStage, readRef, rm);
      if (!lap.ok) {
        abort();
        return;
      }
      assertVaultOpens(vStage);
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
      // re-open lap on the freshly mounted vault — PROBED, never assumed (V5)
      const s2 = stageRef.current ?? stage;
      const vStage = figureStage(s2);
      if (!vStage) {
        console.error("[hairline] vault stage not mounted — narrative aborted (V5)");
        abort();
        return;
      }
      const lap = await dialLap(vStage, readRef, rm);
      if (!lap.ok) {
        abort();
        return;
      }
      assertVaultOpens(vStage);
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
    : // V6.7: the layers read-line default, rewritten per GLM round 07
      "Your activity record is stored in files on this computer. RHEO has no server in this storage path.";

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
            in one grid cell — 520ms window, the incoming figure mounts at once.
            V6.1: pinned to the measured taller stack height (444px) so the
            vault remount cannot shift the layout 434→444 during unmount. */}
        <div style={{ display: "grid", minHeight: 444 }}>
          <AnimatePresence>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 0.9, y: 0 }}
              exit={
                // the vault leaves the way it should physically: it RECOILS
                // (releases pressure, scale 1.06) then IMPLODES away (scale
                // .6, sinks 12px) while the plates burst out of it on the
                // incoming side. Enter/exit share one path (apple-design §7).
                // Keyframes: [rest, recoil, gone]. The stack's own exit stays
                // the old fade.
                isVault
                  ? {
                      opacity: [0.9, 0.9, 0],
                      scale: [1, 1.06, 0.6],
                      y: [0, -3, -12],
                      transition: { duration: rm ? 0 : 0.42, times: [0, 0.3, 1], ease: [0.16, 1, 0.3, 1] },
                    }
                  : { opacity: 0, y: -8, transition: { duration: rm ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] } }
              }
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
            : "MOVE ACROSS TO OPEN THE STACK · SELECT A PART TO INSPECT"}
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
            const abort = () => {
              // V5: skip the lap, clear the caption, release the re-entry lock
              setNarr(null);
              setTourRunning(false);
            };
            if (isVault) {
              // dial lap on the vault's own stage → bolts draw back; 500ms hold
              // after the lap covers the open (+~150ms) and the bolt tween
              const vStage = figureStage(stage);
              if (!vStage) {
                console.error("[hairline] vault stage not mounted — tour aborted (V5)");
                abort();
                return;
              }
              const lap = await dialLap(vStage, readRef, rm);
              if (!lap.ok) {
                abort();
                return;
              }
              assertVaultOpens(vStage);
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
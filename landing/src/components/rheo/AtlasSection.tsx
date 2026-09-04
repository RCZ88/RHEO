"use client";

/**
 * S9 — "THE ATLAS"
 * Full 14-instrument catalogue of RHEO. Sticky horizontal card rail driven by
 * vertical scroll progress (pure function of progress — rewinds on scroll-up).
 * Mobile <768px OR prefers-reduced-motion: native overflow-x-auto snap row,
 * no transforms, final states.
 *
 * STYLE: strict LAMINAR monochrome. No hue, no images, no box-shadow depth.
 *
 * IMPORT (in src/app/page.tsx):
 *   import AtlasSection from "@/components/rheo/AtlasSection";
 * PLACE inside <main> (e.g. after the Compare section):
 *   <AtlasSection />
 */
import {
  AnimatePresence,
  motion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ATLAS,
  type AtlasGlyph,
  type AtlasInstrument,
  type AtlasStatus,
} from "./atlas-data";
import DecryptedText from "./DecryptedText";
import LaminarSpotlight, { useCardCursor } from "./LaminarSpotlight";

const EASE = [0.16, 1, 0.3, 1] as const;
const CARD_W = 320;
const CARD_GAP = 20;
const RAIL_PAD = 80;

type StatusStyle = { border: string; color: string; dashed?: boolean };
const STATUS_STYLE: Record<AtlasStatus, StatusStyle> = {
  SHIPPED: { border: "#ffffff", color: "#ffffff" },
  BETA: { border: "rgba(255,255,255,0.16)", color: "#f4f4f5" },
  SOON: { border: "rgba(255,255,255,0.16)", color: "#a1a1aa", dashed: true },
  VISION: {
    border: "rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.6)",
    dashed: true,
  },
};

/* ---------- inline CSS (single <style>, self-contained, no globals edit) ---------- */
const ATLAS_CSS = `
.atlas-card{
  transition: transform .15s cubic-bezier(.16,1,.3,1),
              opacity .15s cubic-bezier(.16,1,.3,1),
              border-color .15s cubic-bezier(.16,1,.3,1);
}
.atlas-card:hover{ --hover-y:-2px; border-color:rgba(255,255,255,0.16); }
/* spotlight reveal is driven by the shared .spotlight-on class (LaminarSpotlight) */
.atlas-card > *:not(.laminar-spotlight){ position: relative; z-index: 1; }
@media (hover:none){ .atlas-card:hover{ --hover-y:0px; } }
@media (prefers-reduced-motion:reduce){
  .atlas-card{ transition:none !important; transform:none !important; }
}
`;

/* ----------------------- glyph micro-SVGs (40px, stroke 1.5, no fill) ----------------------- */
function Glyph({ kind, size = 40 }: { kind: AtlasGlyph; size?: number }) {
  const s = {
    width: size,
    height: size,
    viewBox: "0 0 40 40",
    fill: "none",
    stroke: "#ffffff",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "external-tracking":
      // circle + orbit tick
      return (
        <svg {...s}>
          <circle cx="20" cy="20" r="11" />
          <line x1="20" y1="5" x2="20" y2="9" />
        </svg>
      );
    case "mobile":
      // rounded rect + notch line
      return (
        <svg {...s}>
          <rect x="12" y="6" width="16" height="28" rx="3" />
          <line x1="17" y1="30" x2="23" y2="30" />
        </svg>
      );
    case "content-engine":
      // doc lines
      return (
        <svg {...s}>
          <line x1="9" y1="12" x2="31" y2="12" />
          <line x1="9" y1="20" x2="28" y2="20" />
          <line x1="9" y1="28" x2="24" y2="28" />
        </svg>
      );
    case "lyceum":
      // 3-node graph
      return (
        <svg {...s}>
          <circle cx="11" cy="11" r="2.4" />
          <circle cx="11" cy="29" r="2.4" />
          <circle cx="29" cy="20" r="2.4" />
          <line x1="13.2" y1="12.3" x2="26.8" y2="18.7" />
          <line x1="13.2" y1="27.7" x2="26.8" y2="21.3" />
        </svg>
      );
    case "ide":
      // terminal chevron
      return (
        <svg {...s}>
          <polyline points="13,15 18,20 13,25" />
          <line x1="22" y1="25" x2="29" y2="25" />
        </svg>
      );
    case "session-search":
      // magnifier
      return (
        <svg {...s}>
          <circle cx="18" cy="18" r="9" />
          <line x1="24.5" y1="24.5" x2="31" y2="31" />
        </svg>
      );
    case "gap-fill":
      // dashed circle with plus — gap being closed
      return (
        <svg {...s}>
          <circle
            cx="20"
            cy="20"
            r="9"
            strokeDasharray="4 3"
            fill="none"
          />
          <line x1="20" y1="14" x2="20" y2="26" />
          <line x1="14" y1="20" x2="26" y2="20" />
        </svg>
      );
    case "conductor":
      // one node fanning to three
      return (
        <svg {...s}>
          <circle cx="8" cy="20" r="2.4" />
          <circle cx="31" cy="9" r="2.4" />
          <circle cx="31" cy="20" r="2.4" />
          <circle cx="31" cy="31" r="2.4" />
          <path d="M10.3 18.7 L28.7 10" />
          <path d="M10.3 20 L28.7 20" />
          <path d="M10.3 21.3 L28.7 29.3" />
        </svg>
      );
    case "trace":
      // step polyline
      return (
        <svg {...s}>
          <polyline points="8,30 15,22 22,26 29,12 32,14" />
        </svg>
      );
    case "context-brain":
      // radial node cluster
      return (
        <svg {...s}>
          <circle cx="20" cy="20" r="3" />
          <circle cx="9" cy="11" r="1.8" />
          <circle cx="31" cy="11" r="1.8" />
          <circle cx="9" cy="29" r="1.8" />
          <circle cx="31" cy="29" r="1.8" />
          <line x1="17.4" y1="18.2" x2="10.6" y2="12.4" />
          <line x1="22.6" y1="18.2" x2="29.4" y2="12.4" />
          <line x1="17.4" y1="21.8" x2="10.6" y2="27.6" />
          <line x1="22.6" y1="21.8" x2="29.4" y2="27.6" />
        </svg>
      );
    case "research-digest":
      // converging funnel lines
      return (
        <svg {...s}>
          <line x1="8" y1="10" x2="20" y2="20" />
          <line x1="8" y1="20" x2="20" y2="20" />
          <line x1="8" y1="30" x2="20" y2="20" />
          <line x1="32" y1="10" x2="20" y2="20" />
          <line x1="32" y1="20" x2="20" y2="20" />
          <line x1="32" y1="30" x2="20" y2="20" />
          <line x1="20" y1="20" x2="20" y2="32" />
        </svg>
      );
    case "resume":
      // page outline + lines
      return (
        <svg {...s}>
          <rect x="11" y="7" width="18" height="26" rx="2" />
          <line x1="15" y1="14" x2="25" y2="14" />
          <line x1="15" y1="20" x2="25" y2="20" />
          <line x1="15" y1="26" x2="21" y2="26" />
        </svg>
      );
    case "finance":
      // wave line
      return (
        <svg {...s}>
          <path d="M6 28 C 12 28, 14 14, 20 14 C 26 14, 28 24, 34 24" />
        </svg>
      );
    case "life-phases":
      // stacked ridge lines
      return (
        <svg {...s}>
          <path d="M6 13 C 12 10, 18 15, 24 12 C 30 9, 34 13, 34 13" />
          <path d="M6 21 C 12 18, 18 23, 24 20 C 30 17, 34 21, 34 21" opacity="0.6" />
          <path d="M6 29 C 12 26, 18 31, 24 28 C 30 25, 34 29, 34 29" opacity="0.35" />
        </svg>
      );
    case "marketplace":
      // 2x2 grid
      return (
        <svg {...s}>
          <rect x="8" y="8" width="10" height="10" rx="1.5" />
          <rect x="22" y="8" width="10" height="10" rx="1.5" />
          <rect x="8" y="22" width="10" height="10" rx="1.5" />
          <rect x="22" y="22" width="10" height="10" rx="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

/* ----------------------- status chip ----------------------- */
function StatusChip({ status }: { status: AtlasStatus }) {
  const st = STATUS_STYLE[status];
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 6,
        border: `1px ${st.dashed ? "dashed" : "solid"} ${st.border}`,
        color: st.color,
        lineHeight: 1,
      }}
    >
      {status}
    </span>
  );
}

/* ----------------------- card ----------------------- */
function AtlasCard({
  inst,
  index,
  isActive,
  onOpen,
}: {
  inst: AtlasInstrument;
  index: number;
  isActive: number;
  onOpen: () => void;
}) {
  // distance-based scale/opacity, interpolated by distance, clamped at dist 1.
  // active (dist 0) = full; dist >= 1 = scale 0.92, opacity 0.5.
  const dist = Math.abs(index - isActive);
  const t = Math.min(dist, 1);
  const scale = 1 - 0.08 * t; // 1 -> 0.92
  const opacity = 1 - 0.5 * t; // 1 -> 0.5

  // transform uses CSS vars so :hover can add translateY without JS state
  const { onMouseMove, onMouseLeave } = useCardCursor();
  const cardStyle = {
    width: CARD_W,
    flex: `0 0 ${CARD_W}px`,
    background: "#0a0a0c",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    textAlign: "left" as const,
    cursor: "pointer",
    opacity,
    position: "relative",
    overflow: "hidden",
    "--scale": String(scale),
    "--hover-y": "0px",
    transform: "translateY(var(--hover-y,0px)) scale(var(--scale,1))",
  } as React.CSSProperties;

  return (
    <button
      type="button"
      className="atlas-card"
      onClick={onOpen}
      aria-label={`${inst.name} — ${inst.status}. ${inst.oneLiner} Open details.`}
      style={cardStyle}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* shared cursor radial highlight (≤8%, ~200px) — single implementation */}
      <LaminarSpotlight />

      {/* kicker + status */}
      <div className="flex items-center justify-between">
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "#63636b",
            textTransform: "uppercase",
          }}
        >
          INSTRUMENT {String(inst.index).padStart(2, "0")}
        </span>
        <StatusChip status={inst.status} />
      </div>

      {/* glyph */}
      <Glyph kind={inst.glyph} />

      {/* name + one-liner */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3
          style={{
            fontFamily: "var(--font-display), 'Space Grotesk', sans-serif",
            fontSize: 20,
            color: "#f4f4f5",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {inst.name}
        </h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "#a1a1aa" }}>
          {inst.oneLiner}
        </p>
      </div>
    </button>
  );
}

/* ----------------------- modal ----------------------- */
function AtlasModal({
  inst,
  onClose,
}: {
  inst: AtlasInstrument;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // focus trap + Esc
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const bullets = useMemo(() => deriveBullets(inst), [inst]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${inst.name} details`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.6)",
      }}
    >
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.35, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className="no-scrollbar"
        style={{
          width: "min(480px, 94vw)",
          maxHeight: "86vh",
          overflowY: "auto",
          background: "#0a0a0c",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: 16,
          padding: 28,
          position: "relative",
        }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close details"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            color: "#a1a1aa",
            cursor: "pointer",
            transition:
              "color 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ffffff";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#a1a1aa";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        {/* name + status + one-liner */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 20,
            paddingRight: 40,
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "#63636b",
                textTransform: "uppercase",
              }}
            >
              INSTRUMENT {String(inst.index).padStart(2, "0")}
            </span>
            <StatusChip status={inst.status} />
          </div>
          <h3
            style={{
              fontFamily: "var(--font-display), 'Space Grotesk', sans-serif",
              fontSize: 26,
              color: "#f4f4f5",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {inst.name}
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#a1a1aa" }}>
            {inst.oneLiner}
          </p>
        </div>

        {/* enlarged glyph */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px 0",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 20,
          }}
        >
          <Glyph kind={inst.glyph} size={72} />
        </div>

        {/* exactly 3 bullets, derived only from one-liner + status */}
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {bullets.map((b, i) => (
            <li
              key={i}
              style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  marginTop: 7,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#ffffff",
                }}
              />
              <span style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
                {b}
              </span>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

/* ----------------------- bullet derivation (one-liner + status only) ----------------------- */
function deriveBullets(inst: AtlasInstrument): string[] {
  const { oneLiner, status } = inst;
  const base = oneLiner.replace(/\s*In active build\.?\s*$/i, "").trim();
  switch (status) {
    case "SHIPPED":
      return [
        `${base}`,
        `Shipped — available in the desktop app today.`,
        `Records into your single, local-first timeline.`,
      ];
    case "BETA":
      return [
        `${base}`,
        `In active build — shipping as it matures.`,
        `Records into your single, local-first timeline.`,
      ];
    case "SOON":
      return [
        `Scoped to do: ${lowerFirst(base)}.`,
        `On the roadmap; not yet in the app.`,
        `Will join the single, local-first record.`,
      ];
    case "VISION":
      return [
        `Designed to ${lowerFirst(base)}.`,
        `A direction, not a commitment.`,
        `Would extend the single, local-first record.`,
      ];
  }
}
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/* ----------------------- SSR-safe reduced-motion hook ----------------------- */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

/* ----------------------- section ----------------------- */
export default function AtlasSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const reduced = usePrefersReducedMotion();
  const { scrollYProgress: rawProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(rawProgress, {
    stiffness: 120,
    damping: 25,
    restDelta: 0.001,
  });

  // breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // desktop rail translate — pure function of progress (reversible)
  const railWidth = ATLAS.length * CARD_W + (ATLAS.length - 1) * CARD_GAP;
  const travel = Math.max(0, railWidth + RAIL_PAD * 2 - 1);
  const translateX = useTransform(progress, (p) => -(p * travel));

  // active card index from progress (desktop sticky only)
  useEffect(() => {
    if (isMobile || reduced) return;
    const unsub = progress.on("change", (p) => {
      const idx = Math.round(p * (ATLAS.length - 1));
      setActiveIndex(Math.max(0, Math.min(ATLAS.length - 1, idx)));
    });
    return () => unsub();
  }, [progress, isMobile, reduced]);

  // mobile: track active via scroll-snap position
  useEffect(() => {
    if (!isMobile || reduced || !railRef.current) return;
    const el = railRef.current;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / (CARD_W + CARD_GAP));
      setActiveIndex(Math.max(0, Math.min(ATLAS.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isMobile, reduced]);

  // reduced-motion OR mobile => native overflow row (no transforms, final states)
  const staticLayout = isMobile || reduced;

  const openInst = openId
    ? (ATLAS.find((a) => a.id === openId) ?? null)
    : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ATLAS_CSS }} />

      <section
        ref={sectionRef}
        id="atlas"
        className="relative surface-page"
        style={{ height: staticLayout ? "auto" : "250vh" }}
        aria-label="The Atlas — every instrument, one record"
      >
        {/* header (normal flow, above sticky area) */}
        <div
          className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto"
          style={{ paddingTop: 96, paddingBottom: 40 }}
        >
          <p
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "#63636b",
              textTransform: "uppercase",
            }}
          >
            <DecryptedText text="SECTION 05 / ATLAS" speed={28} maxIterations={6} />
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display), 'Space Grotesk', sans-serif",
              fontSize: "clamp(32px, 5vw, 64px)",
              color: "#f4f4f5",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              marginTop: 12,
            }}
          >
            EVERY INSTRUMENT, ONE RECORD.
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: "#a1a1aa",
              marginTop: 16,
              maxWidth: 560,
            }}
          >
            The catalogue. Each instrument honest about what it is today.
          </p>
        </div>

        {staticLayout ? (
          /* native overflow-x-auto snap row (mobile + reduced-motion) */
          <div style={{ paddingBottom: 80 }}>
            <div
              ref={railRef}
              data-rail="mobile"
              className="no-scrollbar"
              style={{
                display: "flex",
                gap: CARD_GAP,
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                padding: `24px ${RAIL_PAD}px`,
              }}
            >
              {ATLAS.map((inst, i) => (
                <div key={inst.id} style={{ scrollSnapAlign: "center" }}>
                  {/* pass isActive={i} so every card renders at full final state */}
                  <AtlasCard
                    inst={inst}
                    index={i}
                    isActive={i}
                    onOpen={() => setOpenId(inst.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* desktop sticky rail — translateX is a pure function of progress */
          <div
            className="sticky top-0 overflow-hidden"
            style={{ height: "100dvh" }}
          >
            <motion.div
              ref={railRef}
              data-rail="desktop"
              style={{
                display: "flex",
                gap: CARD_GAP,
                padding: `0 ${RAIL_PAD}px`,
                alignItems: "center",
                height: "100%",
                transform: translateX,
                willChange: "transform",
              }}
            >
              {ATLAS.map((inst, i) => (
                <AtlasCard
                  key={inst.id}
                  inst={inst}
                  index={i}
                  isActive={activeIndex}
                  onOpen={() => setOpenId(inst.id)}
                />
              ))}
            </motion.div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {openInst && (
          <AtlasModal inst={openInst} onClose={() => setOpenId(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

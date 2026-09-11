import {
  AnimatePresence,
  motion,
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

const GRID_PAD_X = 80;
const GRID_PAD_Y = 24;
const GRID_PAD_BOTTOM = 80;
const GRID_GAP = 20;
const EASE = [0.16, 1, 0.3, 1] as const;

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
.atlas-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(320px,1fr));
  gap:20px;
  padding:24px 80px 80px;
}
@media (min-width:768px){
  .atlas-grid{ grid-template-columns:repeat(2,1fr); }
}
@media (min-width:1280px){
  .atlas-grid{ grid-template-columns:repeat(3,1fr); }
}
`;

/* ----------------------- glyph micro-SVGs (40px, stroke 1.5) ----------------------- */
function Glyph({ kind, size = 40 }: { kind: AtlasGlyph; size?: number }) {
  const stroke: React.SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 40 40",
    fill: "none",
    stroke: "#ffffff",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const fill: React.SVGProps<SVGSVGElement> = { ...stroke, fill: "#ffffff", stroke: "none" };
  switch (kind) {
    case "external-tracking":
      // circle + orbit tick
      return (
        <svg {...stroke}>
          <circle cx="20" cy="20" r="11" />
          <line x1="20" y1="5" x2="20" y2="9" />
        </svg>
      );
    case "mobile":
      // rounded rect + notch line
      return (
        <svg {...stroke}>
          <rect x="12" y="6" width="16" height="28" rx="3" />
          <line x1="17" y1="30" x2="23" y2="30" />
        </svg>
      );
    case "content-engine":
      // doc lines
      return (
        <svg {...stroke}>
          <line x1="9" y1="12" x2="31" y2="12" />
          <line x1="9" y1="20" x2="28" y2="20" />
          <line x1="9" y1="28" x2="24" y2="28" />
        </svg>
      );
    case "lyceum":
      // 3-node graph
      return (
        <svg {...stroke}>
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
        <svg {...stroke}>
          <polyline points="13,15 18,20 13,25" />
          <line x1="22" y1="25" x2="29" y2="25" />
        </svg>
      );
    case "gap-fill":
      // dashed circle with plus — gap being closed
      return (
        <svg {...stroke}>
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
        <svg {...stroke}>
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
        <svg {...stroke}>
          <polyline points="8,30 15,22 22,26 29,12 32,14" />
        </svg>
      );
    case "context-brain":
      // radial node cluster
      return (
        <svg {...stroke}>
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
        <svg {...stroke}>
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
        <svg {...stroke}>
          <rect x="11" y="7" width="18" height="26" rx="2" />
          <line x1="15" y1="14" x2="25" y2="14" />
          <line x1="15" y1="20" x2="25" y2="20" />
          <line x1="15" y1="26" x2="21" y2="26" />
        </svg>
      );
    case "finance":
      // wave line
      return (
        <svg {...stroke}>
          <path d="M6 28 C 12 28, 14 14, 20 14 C 26 14, 28 24, 34 24" />
        </svg>
      );
    case "life-phases":
      // stacked ridge lines
      return (
        <svg {...stroke}>
          <path d="M6 13 C 12 10, 18 15, 24 12 C 30 9, 34 13, 34 13" />
          <path d="M6 21 C 12 18, 18 23, 24 20 C 30 17, 34 21, 34 21" opacity="0.6" />
          <path d="M6 29 C 12 26, 18 31, 24 28 C 30 25, 34 29, 34 29" opacity="0.35" />
        </svg>
      );
    case "marketplace":
      // 2x2 grid
      return (
        <svg {...stroke}>
          <rect x="8" y="8" width="10" height="10" rx="1.5" />
          <rect x="22" y="8" width="10" height="10" rx="1.5" />
          <rect x="8" y="22" width="10" height="10" rx="1.5" />
          <rect x="22" y="22" width="10" height="10" rx="1.5" />
        </svg>
      );
    case "recordings":
      // record button: stroked rounded square + filled inner dot (R-8a)
      return (
        <svg {...stroke}>
          <rect x="11" y="11" width="18" height="18" rx="4" fill="none" strokeWidth={1.5} />
          <circle cx="20" cy="20" r="3.25" fill="#ffffff" stroke="none" />
        </svg>
      );
    case "screenshots":
      // camera aperture outline: circle + 6 blade chords (R-8, G-2)
      return (
        <svg {...stroke}>
          <circle cx="20" cy="20" r="9" fill="none" strokeWidth={1.5} />
          {apertureBlades(20, 20, 9, 6, 1.5).map((d, i) => (
            <path key={i} d={d} strokeWidth={1.5} />
          ))}
        </svg>
      );
    default:
      return null;
  }
}

/* chord endpoints for a blade that meets the circle at ±half-blade-count radians
   and crosses near 55% radius — derived with trig, not hand-tuned */
function apertureBlades(
  cx: number,
  cy: number,
  r: number,
  count: number,
  _width: number
): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / count) * Math.PI * 2 - Math.PI / 2;
    const ax = cx + Math.cos(a0) * r;
    const ay = cy + Math.sin(a0) * r;
    const bx = cx + Math.cos(a1) * r;
    const by = cy + Math.sin(a1) * r;
    out.push(`M ${ax} ${ay} L ${bx} ${by}`);
  }
  return out;
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
  isHovered,
  isFocused,
  isRevealed,
  onOpen,
}: {
  inst: AtlasInstrument;
  isHovered: boolean;
  isFocused: boolean;
  isRevealed: boolean;
  onOpen: () => void;
}) {
  const { onMouseMove, onMouseLeave } = useCardCursor();
  const cardStyle = {
    width: "100%",
    background: "#0a0a0c",
    border: isHovered || isFocused
      ? "1px solid rgba(255,255,255,0.16)"
      : "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    textAlign: "left" as const,
    cursor: "pointer",
    opacity: isRevealed ? 1 : 0,
    transform: isRevealed ? "translateY(0)" : "translateY(12px)",
    transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.15s cubic-bezier(0.16,1,0.3,1)",
    position: "relative",
    overflow: "hidden",
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
            color: "#8a8a94",
            textTransform: "uppercase",
          }}
        >
          INSTRUMENT {String(ATLAS.indexOf(inst) + 1).padStart(2, "0")}
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
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                color: "#8a8a94",
                textTransform: "uppercase",
              }}
            >
              INSTRUMENT {ORDINAL[inst.id]?.toString().padStart(2, "0") ?? "01"}
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

const ORDINAL = (() => {
  const m: Record<string, number> = {};
  ATLAS.forEach((a, i) => { m[a.id] = i + 1; });
  return m;
})();

/* ----------------------- section ----------------------- */
export default function AtlasSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  // reduced-motion gate — entrance skip, cards stay visible
  const reduced = usePrefersReducedMotion();

  // IntersectionObserver one-shot reveal (R-5): threshold 0.15, once:true
  const gridRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!gridRef.current) return;
    if (reduced) {
      // RM: all rows visible, no entrance
      setRevealed(new Set(ATLAS.map((_, i) => i)));
      return;
    }
    const cards = Array.from(gridRef.current.querySelectorAll<HTMLElement>("[data-atlas-card]"));
    if (cards.length === 0) return;
    let cancelled = false;
    const obs = new IntersectionObserver(
      (rows) => {
        for (const row of rows) {
          if (row.isIntersecting) {
            const idx = Number((row.target as HTMLElement).getAttribute("data-atlas-index"));
            if (!Number.isNaN(idx)) setRevealed((prev) => {
              const next = new Set(prev);
              next.add(idx);
              return next;
            });
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px" }
    );
    for (const el of cards) obs.observe(el);
    return () => { cancelled = true; obs.disconnect(); };
  }, [reduced]);

  const openInst = openId
    ? (ATLAS.find((a) => a.id === openId) ?? null)
    : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ATLAS_CSS }} />

      {/* free-flow: normal document flow, content height (R-5) */}
      <section
        id="atlas"
        className="relative surface-page"
        aria-label="The Atlas — every instrument, one record"
      >
        {/* header (normal flow, above the grid) */}
        <div
          className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto"
          style={{ paddingTop: 96, paddingBottom: 40 }}
        >
          <p
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "#8a8a94",
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

        {/* responsive grid — 1 col <768 / 2 cols 768–1279 / 3 cols ≥1280 (R-5) */}
        <div
          ref={gridRef}
          className="atlas-grid"
          style={{ padding: `${GRID_PAD_Y}px ${GRID_PAD_X}px ${GRID_PAD_BOTTOM}px`, gap: `${GRID_GAP}px` }}
        >
          {ATLAS.map((inst, i) => (
            <div
              key={inst.id}
              data-atlas-card
              data-atlas-index={i}
            >
              <AtlasCard
                inst={inst}
                isHovered={false}
                isFocused={false}
                isRevealed={revealed.has(i)}
                onOpen={() => setOpenId(inst.id)}
              />
            </div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {openInst && (
          <AtlasModal inst={openInst} onClose={() => setOpenId(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

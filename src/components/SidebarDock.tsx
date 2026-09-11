import { memo, useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion';
import { cn } from '../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────
export interface DockNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  group: string;
  active: boolean;
}

export interface DockGroup {
  name: string;
  items: DockNavItem[];
}

interface SidebarDockProps {
  groups: DockGroup[];
  onNavigate: (path: string) => void;
}

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
// Falloff stops: [px from row center] → [icon presence]. This is the
// vertical-dock equivalent of Apple's magnification curve: the focused item
// becomes a full navigation island, while two neighbors briefly emerge as
// smaller context cues instead of remaining anonymous dots.
const DIST_STOPS = [-120, -68, -34, 0, 34, 68, 120];
const PRESENCE_STOPS = [0, 0.16, 0.58, 1, 0.58, 0.16, 0];

// ── Single rail row ───────────────────────────────────────────────────
const DockIconButton = memo(function DockIconButton({
  item,
  flatIndex,
  smoothY,
  registry,
  onNavigate,
}: {
  item: DockNavItem;
  flatIndex: number;
  smoothY: MotionValue<number>;
  registry: React.MutableRefObject<Array<{ el: HTMLButtonElement | null; setCenter: (v: number) => void }>>;
  onNavigate: (path: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;
  const btnRef = useRef<HTMLButtonElement>(null);
  const centerMV = useMotionValue(Infinity);
  // Direct-hover fallback: guarantees reveal even if the proximity
  // measurement pipeline is stale (same signal that drives the tooltip).
  const hoveredMV = useMotionValue(0);

  // Register element + center setter with the parent (measured on
  // enter/scroll/resize — never during mousemove).
  useEffect(() => {
    registry.current[flatIndex] = {
      el: btnRef.current,
      setCenter: (v: number) => centerMV.set(v),
    };
  }, [registry, flatIndex, centerMV]);

  // Distance of (smoothed) cursor from this row's center → icon presence.
  // Pure MotionValue arithmetic: zero layout reads during mousemove.
  const dist = useTransform([smoothY, centerMV], ([y, c]) => {
    const yy = y as number;
    const cc = c as number;
    if (!Number.isFinite(yy) || !Number.isFinite(cc)) return Infinity;
    return yy - cc;
  });
  const presence = useTransform(dist, DIST_STOPS, PRESENCE_STOPS);
  // Effective presence: proximity magnification OR direct row hover.
  const presenceEff = useTransform([presence, hoveredMV], ([p, h]) => {
    const pv = p as number;
    const hv = h as number;
    const base = Number.isFinite(pv) ? pv : 0;
    return hv >= 1 ? 1 : base;
  });
  const iconScale = useTransform(presenceEff, (v) => 0.35 + 0.65 * v);
  const iconOpacity = presenceEff;
  const dotOpacity = useTransform(presenceEff, (v) => 1 - v);
  const dotScale = useTransform(presenceEff, (v) => 1 - v * 0.35);
  const iconRotate = useTransform(presenceEff, (v) => (1 - v) * 12);
  const iconRadius = useTransform(presenceEff, (v) => 999 - 985 * v);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigate(item.path);
    }
  };

  return (
    <motion.button
      type="button"
      ref={btnRef}
      onClick={() => onNavigate(item.path)}
      onKeyDown={handleKeyDown}
      onHoverStart={() => { setHovered(true); hoveredMV.set(1); }}
      onHoverEnd={() => { setHovered(false); hoveredMV.set(0); }}
      onFocus={() => { setHovered(true); hoveredMV.set(1); }}
      onBlur={() => { setHovered(false); hoveredMV.set(0); }}
      aria-label={`${item.label} (${item.group})`}
      aria-current={item.active ? 'page' : undefined}
      title={item.label}
      className={cn(
        'group relative flex h-8 w-11 items-center justify-center rounded-xl outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c]',
      )}
      whileTap={{ scale: 0.95 }}
    >
      {/* Rest state: dot on the node line (always visible) */}
      {reduceMotion ? (
        (item.active ? (
          <span className="relative flex items-center justify-center">
            <span className="absolute h-4 w-4 rounded-full bg-white/[0.08] blur-[6px]" />
            <span className="relative h-2 w-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.25)]" />
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full border border-white/[0.35] transition-colors duration-150 group-hover:border-white/[0.6]" />
        ))
      ) : (
        <motion.span
          className="relative flex items-center justify-center"
          style={{ opacity: dotOpacity, scale: dotScale }}
        >
          {item.active ? (
            <>
              <span className="absolute h-4 w-4 rounded-full bg-white/[0.08] blur-[6px]" />
              <span className="relative h-2 w-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.25)]" />
            </>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full border border-white/[0.35]" />
          )}
        </motion.span>
      )}

      {/* Icon chip: grows from nothing to full on hover, always visible for active */}
      {reduceMotion ? (
      (hovered || item.active) && (
      <span
        className={cn(
          'absolute flex h-[42px] w-[42px] items-center justify-center rounded-xl border-2 shadow-lg',
          item.active
            ? 'border-white/30 bg-white/[0.15] shadow-[0_0_24px_rgba(255,255,255,0.3)]'
            : 'border-white/20 bg-white/[0.08] hover:border-white/30 hover:bg-white/[0.12]',
        )}
      >
        <Icon
          className={cn(
            'h-[22px] w-[22px] drop-shadow-md',
            item.active ? 'text-white' : 'text-zinc-100',
          )}
        />
      </span>
      )
      ) : (
        <motion.span
          className={cn(
            'absolute flex h-[42px] w-[42px] items-center justify-center border-2 shadow-lg',
            item.active
            ? 'border-white/30 bg-white/[0.15] shadow-[0_0_24px_rgba(255,255,255,0.3)]'
            : hovered
              ? 'border-white/25 bg-white/[0.11] shadow-[0_0_18px_rgba(255,255,255,0.12)]'
              : 'border-white/[0.08] bg-white/[0.04]',
          )}
          style={{
            scale: iconScale,
            opacity: iconOpacity,
            rotate: item.active ? 0 : iconRotate,
            borderRadius: iconRadius,
            pointerEvents: 'none',
          }}
        >
          <Icon
            className={cn(
              'h-[22px] w-[22px] drop-shadow-md',
              item.active ? 'text-white' : 'text-zinc-100',
            )}
          />
        </motion.span>
      )}

      {/* Tooltip — label + group, right side, only on direct hover/focus */}
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            role="tooltip"
            className="pointer-events-none absolute left-full z-20 ml-3 flex w-max max-w-[200px] items-center gap-2 whitespace-nowrap rounded-lg border border-zinc-700/60 bg-[var(--color-card)] px-2.5 py-1.5 shadow-xl"
          >
            <span className="text-[13px] font-medium text-[var(--text-primary)]">
              {item.label}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {item.group}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

// ── Collapsed rail ────────────────────────────────────────────────────
export const SidebarDock = memo(function SidebarDock({
  groups,
  onNavigate,
}: SidebarDockProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const registry = useRef<Array<{ el: HTMLButtonElement | null; setCenter: (v: number) => void }>>([]);
  const containerTopRef = useRef(0);

  // Raw cursor Y (toolbar-relative) + one shared smoothing spring for all rows.
  // Finite "nowhere" sentinel: +Infinity poisons spring physics to NaN.
  const NOWHERE = -10000;
  const mouseY = useMotionValue(NOWHERE);
  const smoothY = useSpring(mouseY, { stiffness: 500, damping: 40, mass: 0.5 });

  const measureAll = () => {
    const root = rootRef.current;
    if (!root) return;
    const top = root.getBoundingClientRect().top;
    containerTopRef.current = top;
    registry.current.forEach((entry) => {
      if (!entry?.el) return;
      const r = entry.el.getBoundingClientRect();
      entry.setCenter(r.top + r.height / 2 - top);
    });
  };

  // Re-measure when the rail scrolls or the window resizes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = root.closest('.overflow-y-auto');
    const onScroll = () => measureAll();
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scroller?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial measure + re-measure when items change (stale centers = dead hover).
  useEffect(() => {
    const raf = requestAnimationFrame(() => measureAll());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  let flatIndex = -1;

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label="Application navigation"
      onMouseMove={(e) => mouseY.set(e.clientY - containerTopRef.current)}
      onMouseEnter={() => measureAll()}
      onMouseLeave={() => {
        mouseY.set(NOWHERE);
      }}
      className="relative flex flex-col items-center gap-0.5 px-1 py-1"
    >
      {groups.map((group) => (
      <div key={group.name} className="flex w-full flex-col items-center">
      {group.name !== groups[0]?.name && (
        <div
          aria-hidden
          className="my-2 flex w-full items-center justify-center gap-[5px]"
        >
          <span className="block h-px w-[10px] bg-white/[0.15]" />
          <span className="block h-px w-[10px] bg-white/[0.15]" />
        </div>
      )}
      {group.items.map((item) => {
            flatIndex += 1;
            const idx = flatIndex;
            return (
              <DockIconButton
                key={item.path}
                item={item}
                flatIndex={idx}
                smoothY={smoothY}
                registry={registry}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});

export default SidebarDock;

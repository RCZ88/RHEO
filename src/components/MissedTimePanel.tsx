import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { CalendarX2, Hourglass, Zap, CheckCircle2, ChevronDown } from 'lucide-react';

interface Gap {
  start: string;
  end: string;
  durationSeconds: number;
}

interface MissedTimePanelProps {
  onFillNow?: () => void;
}

const STRIPE = 'repeating-linear-gradient(45deg, rgba(251,191,36,0.10) 0px 6px, transparent 6px 12px)';

// One shared keyframe for the drift, declared once instead of a per-element
// framer animation. transform-only, so it never triggers layout or paint.
const STRIPE_KEYFRAMES = `
@keyframes df-stripe-drift { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
`;
if (typeof document !== 'undefined' && !document.getElementById('df-stripe-keyframes')) {
  const el = document.createElement('style');
  el.id = 'df-stripe-keyframes';
  el.textContent = STRIPE_KEYFRAMES;
  document.head.appendChild(el);
}

function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtClock(d: Date): string {
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${d.getMinutes().toString().padStart(2, '0')} ${ampm}`;
}

export default function MissedTimePanel({ onFillNow }: MissedTimePanelProps) {
  console.log('%c[MissedTimePanel] v1.0 loaded', 'color: #fbbf24; font-weight: bold');

  const reduced = useReducedMotion();
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [stripW, setStripW] = useState(0);

  // A segment's label can only be drawn if it fits the segment's ACTUAL pixel
  // width. The previous test was `w >= 6` — a PERCENTAGE. On a narrow strip 6%
  // is ~30px while "8h 34m" at 10px mono needs ~45px, so the label rendered
  // anyway and `truncate` ate it. The threshold has to be in pixels, and pixels
  // require measuring the strip, which is responsive.
  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setStripW(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [gaps, collapsed]);

  const loadGaps = useCallback(async () => {
    try {
      const res = await (window as any).deskflowAPI?.detectUsageGaps?.({ period: 'today', minGapMinutes: 5 });
      setGaps(Array.isArray(res) ? (res as Gap[]) : []);
    } catch (err) {
      console.error('[MissedTimePanel] detect-usage-gaps failed:', err);
      setGaps([]);
    }
  }, []);

  useEffect(() => {
    loadGaps();
    const refresh = () => loadGaps();
    window.addEventListener('external-data-changed', refresh);
    const iv = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('external-data-changed', refresh);
      window.clearInterval(iv);
    };
  }, [loadGaps]);

  const dayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const elapsedSec = Math.max(1, (Date.now() - dayStart) / 1000);
  const missingSec = gaps?.reduce((s, g) => s + g.durationSeconds, 0) ?? 0;
  const trackedPct = gaps == null ? 0 : Math.min(100, Math.max(0, 100 * (1 - missingSec / elapsedSec)));
  const inaccuracyPct = gaps == null ? 0 : Math.min(100, Math.max(0, 100 - trackedPct));

  const spring = useSpring(0, { stiffness: 90, damping: 22 });
  const displayPct = useTransform(spring, (v) => v.toFixed(1));
  useEffect(() => {
    if (!reduced) spring.set(trackedPct);
  }, [trackedPct, reduced, spring]);

  if (gaps === null) {
    return (
      <div className="mb-3 pt-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-20 rounded-full bg-zinc-800 animate-pulse" />
        </div>
        <div className="h-9 rounded-lg bg-zinc-800/60 animate-pulse" />
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="mb-3 pt-3">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 text-amber-300/90 text-[11px] transition-colors"
        >
          <Hourglass className="w-3 h-3" />
          <span>{gaps.length} gap{gaps.length === 1 ? '' : 's'} missed today · Show</span>
        </button>
      </div>
    );
  }

  if (gaps.length === 0) {
    return (
      <div className="mb-3 pt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>
          <span className="font-semibold">Nothing missed today</span> — your day is fully tracked.
        </span>
      </div>
    );
  }

  return (
    <div className="mb-3 pt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Missed time today</h4>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Collapse missed time panel"
        >
          <ChevronDown className="w-3.5 h-3.5 rotate-180" />
        </button>
      </div>

      {/* ── Day strip: tracked light vs eroding voids ── */}
      <div className="relative">
        <div ref={stripRef} className="h-9 rounded-lg overflow-hidden border border-zinc-700/30 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-emerald-500/5 to-indigo-500/10" />
          {gaps.map((g, i) => {
            const s = Math.max(0, (new Date(g.start).getTime() - dayStart) / 1000);
            const left = Math.min(99.5, (s / elapsedSec) * 100);
            const w = Math.max(0.8, Math.min(100 - left, (g.durationSeconds / elapsedSec) * 100));
            const text = fmtDur(g.durationSeconds);
            // 10px monospace is ~6.05px/advance; px-1 adds 4px each side.
            const neededPx = text.length * 6.05 + 8;
            const segPx = (w / 100) * stripW;
            const labelFits = stripW > 0 && segPx >= neededPx;
            // Below ~28px the 45deg stripe reads as flat grey anyway, so animating
            // it is pure cost.
            const canStripe = !reduced && segPx >= 28;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{ left: `${left}%`, width: `${w}%`, minWidth: 6 }}
                title={`${fmtClock(new Date(g.start))} – ${fmtClock(new Date(g.end))} · ${text} untracked`}
              >
                <div className="absolute inset-0 bg-[var(--ws-surface-scrim)] border-x border-amber-500/30" />
                {/* The drifting stripe was a per-gap INFINITE framer animation on a
                    width:200% repeating gradient, plus an inset blur shadow on every
                    gap. With several gaps that is several always-running animation
                    layers and a blur pass each, on a component that renders INSIDE
                    the AFK prompt — i.e. the prompt was animating forever even when
                    the user did nothing. Now a CSS transform animation, which the
                    compositor handles off the main thread, and only for gaps wide
                    enough for the pattern to read at all. */}
                {canStripe ? (
                  <div className="absolute inset-0 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 w-[200%] motion-safe:[animation:df-stripe-drift_9s_linear_infinite]"
                      style={{ backgroundImage: STRIPE, opacity: 0.9 }}
                    />
                  </div>
                ) : null}
                {labelFits ? (
                  <div className="absolute inset-0 flex items-center justify-center px-1">
                    <span className="text-[10px] font-semibold font-mono text-amber-200/90 drop-shadow">
                      {text}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="relative h-4 mt-1 text-[9px] font-mono text-zinc-600">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const t = new Date(dayStart + p * elapsedSec * 1000);
            const label = p === 1 ? 'now' : fmtClock(t);
            const xShift = p === 0 ? '0' : p === 1 ? '-100%' : '-50%';
            return (
              <span key={i} className="absolute" style={{ left: `${p * 100}%`, transform: `translateX(${xShift})` }}>
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Focal stat row ── */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25 text-amber-300 text-[11px] font-medium">
            <CalendarX2 className="w-3 h-3" />
            {gaps.length} gap{gaps.length === 1 ? '' : 's'} missed
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800/80 ring-1 ring-zinc-700/40 text-zinc-300 text-[11px] font-mono">
            <Hourglass className="w-3 h-3 text-amber-400/80" />
            {fmtDur(missingSec)}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[26px] leading-none font-bold tabular-nums bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent">
              {reduced ? trackedPct.toFixed(1) : <motion.span>{displayPct}</motion.span>}
            </span>
            <span className="text-[11px] text-zinc-500">% tracked</span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {inaccuracyPct > 0 ? `${inaccuracyPct.toFixed(1)}% of your day is unaccounted for` : 'of your day is accounted for'}
          </p>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="mt-3 flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onFillNow}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Fill gaps now
        </motion.button>
        <button
          onClick={() => setCollapsed(true)}
          className="px-3 py-2 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}
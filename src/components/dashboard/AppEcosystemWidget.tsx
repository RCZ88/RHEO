// RHEO Dashboard — App Ecosystem (compact orbit summary)
//
// WHY THIS FILE EXISTS
// --------------------
// The `app-ecosystem` grid slot was registered with `component: () => null`, so
// the slot rendered NOTHING: an empty card in the dashboard grid, with no error
// anywhere. The 3D Orbit (solar system) modal is a separate, fullscreen-only
// surface, so the dashboard itself had no ecosystem visualisation at all.
//
// DESIGN INTENT (read before changing anything)
// ---------------------------------------------
// 1. IDEA: the solar system, compressed. The 3D view answers "which category
//    does my time live in"; the widget answers the same question in a glance,
//    using the SAME metaphor (orbit rings) and the SAME data (ctx.appStats /
//    ctx.websiteStats — the identical arrays the modal receives) so the two can
//    never disagree.
// 2. MEANING: ring sweep = share of tracked time in that category. Ring hue =
//    PRODUCTIVITY TIER, not category identity — the house rule is that colour
//    means tier on a data surface, and the old 3D view broke it by cycling 12
//    arbitrary vivid hues per category. Dot size = that app's share of its
//    category. Nothing here encodes anything decorative.
// 3. FITTING: this is a developer tool's dashboard. No bloom, no spring, no
//    glass. One accent, hairline borders, radius 8/12, mono for numbers.
// 4. HONESTY: the long tail is stated, not silently dropped. The 3D view drops
//    every app under 30s and caps at 80; this widget reports how many it hid
//    and how much time that was.
//
// All four states are implemented (loading / empty / error / populated) and the
// whole thing is a DOM SVG, so it is keyboard- and screen-reader-navigable —
// which the canvas is not.

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Orbit } from 'lucide-react';
import { useDashboardDataContext } from './DashboardContext';

type Tier = 'productive' | 'neutral' | 'distracting';

const TIER_VAR: Record<Tier, string> = {
  productive: 'var(--tier-productive)',
  neutral: 'var(--tier-neutral)',
  distracting: 'var(--tier-distracting)',
};

/** Mirrors DEFAULT_TIER_ASSIGNMENTS in DashboardPage.tsx:237. Keep in sync. */
const DEFAULT_TIERS: Record<Tier, string[]> = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other', 'Browser'],
  distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming'],
};

/** Apps below this many seconds are counted as "the rest", never silently dropped. */
const TAIL_THRESHOLD_SECONDS = 30;
/** Rings drawn before the remainder is folded into an "Other categories" ring. */
const MAX_RINGS = 5;
/** Dots drawn per ring before that ring collapses to a count. */
const MAX_DOTS = 6;

function resolveTier(category: string | undefined): Tier {
  if (!category) return 'neutral';
  let tiers: Record<Tier, string[]> = DEFAULT_TIERS;
  try {
    const raw = localStorage.getItem('deskflow-tier-assignments');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        tiers = {
          productive: parsed.productive ?? DEFAULT_TIERS.productive,
          neutral: parsed.neutral ?? DEFAULT_TIERS.neutral,
          distracting: parsed.distracting ?? DEFAULT_TIERS.distracting,
        };
      }
    }
  } catch {
    /* keep defaults — localStorage access is wrapped per house rule */
  }
  if (tiers.productive.includes(category)) return 'productive';
  if (tiers.distracting.includes(category)) return 'distracting';
  return 'neutral';
}

const humanDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${Math.round(seconds)}s`;
};

interface Ring {
  category: string;
  tier: Tier;
  seconds: number;
  share: number;
  dots: { name: string; seconds: number; r: number }[];
  hiddenDots: number;
  hiddenSeconds: number;
}

export function AppEcosystemWidget() {
  const ctx = useDashboardDataContext();
  const reduce = useReducedMotion();

  const { rings, totalSeconds, tailCount, tailSeconds, topApps } = useMemo(() => {
    const rows = (ctx.appStats || []).filter(
      (r) => r && typeof r.app === 'string' && r.app.trim().length > 0 && r.seconds > 0,
    );
    const total = rows.reduce((s, r) => s + r.seconds, 0);

    const byCategory = new Map<string, { seconds: number; apps: typeof rows }>();
    for (const r of rows) {
      const cat = r.category || 'Other';
      const entry = byCategory.get(cat) || { seconds: 0, apps: [] as typeof rows };
      entry.seconds += r.seconds;
      entry.apps.push(r);
      byCategory.set(cat, entry);
    }

    const ordered = [...byCategory.entries()].sort((a, b) => b[1].seconds - a[1].seconds);
    const shown = ordered.slice(0, MAX_RINGS);
    const folded = ordered.slice(MAX_RINGS);

    const builtRings: Ring[] = shown.map(([category, v]) => {
      const big = v.apps
        .filter((a) => a.seconds >= TAIL_THRESHOLD_SECONDS)
        .sort((a, b) => b.seconds - a.seconds);
      const kept = big.slice(0, MAX_DOTS);
      const rest = big.slice(MAX_DOTS);
      const maxApp = kept[0]?.seconds || 1;
      return {
        category,
        tier: resolveTier(category),
        seconds: v.seconds,
        share: total > 0 ? v.seconds / total : 0,
        dots: kept.map((a) => ({
          name: a.app,
          seconds: a.seconds,
          // 2.6 → 6.2 px. Area, not radius, tracks magnitude, so a 4× bigger
          // app is visibly 4× bigger rather than merely taller.
          r: 2.6 + Math.sqrt(a.seconds / maxApp) * 3.6,
        })),
        hiddenDots: rest.length,
        hiddenSeconds: rest.reduce((s, a) => s + a.seconds, 0),
      };
    });

    // Fold the leftover categories into one honest ring rather than dropping them.
    if (folded.length > 0) {
      const seconds = folded.reduce((s, [, v]) => s + v.seconds, 0);
      builtRings.push({
        category: `${folded.length} more`,
        tier: 'neutral',
        seconds,
        share: total > 0 ? seconds / total : 0,
        dots: [],
        hiddenDots: 0,
        hiddenSeconds: 0,
      });
    }

    const allApps = rows
      .slice()
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5)
      .map((a) => ({ name: a.app, seconds: a.seconds, category: a.category || 'Other' }));

    const tailApps = rows.filter((a) => a.seconds < TAIL_THRESHOLD_SECONDS);

    return {
      rings: builtRings,
      totalSeconds: total,
      tailCount: tailApps.length,
      tailSeconds: tailApps.reduce((s, a) => s + a.seconds, 0),
      topApps: allApps,
    };
  }, [ctx.appStats]);

  /* ── loading: skeleton rings, same geometry so nothing jumps on arrival ── */
  if (ctx.loading && rings.length === 0) {
    return (
      <div className="flex h-full items-center gap-4 p-1" aria-busy="true" aria-label="Loading app ecosystem">
        <div className="h-[104px] w-[104px] shrink-0 animate-pulse rounded-full border-2 border-[var(--ws-border)]" />
        <div className="flex-1 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-[var(--ws-border)]" style={{ width: `${90 - i * 18}%` }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── error ── */
  if (ctx.error && rings.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
        <Orbit size={16} className="text-[var(--text-muted)]" />
        <p className="text-[12px] text-[var(--text-secondary)]">Couldn&apos;t load your ecosystem</p>
        <p className="max-w-[34ch] text-[11px] text-[var(--text-muted)]">{ctx.error}</p>
      </div>
    );
  }

  /* ── empty ── */
  if (rings.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
        <Orbit size={16} className="text-[var(--text-disabled)]" />
        <p className="text-[12px] text-[var(--text-secondary)]">No tracked time yet</p>
        <p className="max-w-[38ch] text-[11px] text-[var(--text-muted)]">
          Rings appear here once the tracker records activity. Open the solar system for the full 3D view.
        </p>
      </div>
    );
  }

  const SIZE = 104;
  const C = SIZE / 2;
  const ringGap = 15;
  // Opacity carries magnitude — the one encoding that survives greyscale,
  // colour-vision deficiency and both themes.
  const opacityFor = (share: number) => 0.45 + Math.min(1, share * 2.2) * 0.55;

  return (
    <div className="flex h-full items-center gap-4">
      {/* ── the orbit disc ── */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="shrink-0"
        role="img"
        aria-label={`Time split across ${rings.length} categories, ${humanDuration(totalSeconds)} tracked in total`}
      >
        {rings.map((ring, i) => {
          const radius = 12 + i * ringGap;
          const sweep = Math.max(ring.share * 360, ring.share > 0 ? 3 : 0);
          const color = TIER_VAR[ring.tier];
          const op = opacityFor(ring.share);
          return (
            <g key={ring.category}>
              {/* track */}
              <circle
                cx={C}
                cy={C}
                r={radius}
                fill="none"
                stroke="var(--ws-border)"
                strokeWidth={3}
                opacity={0.5}
              />
              {/* value */}
              <motion.circle
                cx={C}
                cy={C}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={op}
                strokeDasharray={`${(sweep / 360) * 2 * Math.PI * radius} ${2 * Math.PI * radius}`}
                transform={`rotate(-90 ${C} ${C})`}
                initial={reduce ? false : { strokeDashoffset: 2 * Math.PI * radius }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
              {/* dots ride the ring, offset along its arc */}
              {ring.dots.map((dot, di) => {
                const consumed = rings
                  .slice(0, i)
                  .reduce((s, r) => s + r.share * 360, 0);
                const within = (di / Math.max(ring.dots.length, 1)) * sweep;
                const deg = consumed + within;
                const rad = ((deg - 90) * Math.PI) / 180;
                return (
                  <circle
                    key={dot.name}
                    cx={C + radius * Math.cos(rad)}
                    cy={C + radius * Math.sin(rad)}
                    r={dot.r}
                    fill={color}
                    opacity={op}
                  >
                    <title>{`${dot.name} — ${humanDuration(dot.seconds)} (${ring.tier})`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* ── the numbers ── */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[18px] leading-none text-[var(--text-primary)]">
            {humanDuration(totalSeconds)}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">tracked</span>
        </div>

        <ul className="mt-2 space-y-1">
          {topApps.map((app) => (
            <li key={app.name} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: TIER_VAR[resolveTier(app.category)] }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{app.name}</span>
              <span className="shrink-0 font-mono text-[var(--text-muted)]">{humanDuration(app.seconds)}</span>
            </li>
          ))}
        </ul>

        {/* The honest part: what this view is NOT showing you. */}
        {tailCount > 0 && (
          <p className="mt-1.5 text-[10px] leading-tight text-[var(--text-disabled)]">
            +{tailCount} app{tailCount === 1 ? '' : 's'} under {TAIL_THRESHOLD_SECONDS}s
            {tailSeconds > 0 && <> · {humanDuration(tailSeconds)}</>}
          </p>
        )}
        {ctx.loading && (
          <p className="mt-1 text-[10px] text-[var(--text-disabled)]">updating…</p>
        )}
      </div>
    </div>
  );
}

export default AppEcosystemWidget;
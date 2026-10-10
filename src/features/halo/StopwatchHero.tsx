import { memo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Pause, Play, TriangleAlert } from 'lucide-react';
import { formatStopwatch } from '../../lib/stopwatchStore';
import type { NowPayload, StopwatchPayload } from '../../shared/halo/types';

/**
 * StopwatchHero — the island's default surface and its hero activity.
 *
 * WHY THE NUMBER IS THE INTERFACE
 * -------------------------------
 * A stopwatch is read in under 200ms while attention is elsewhere — mid-sentence,
 * mid-keystroke, in another application entirely. So the numeral is the layout,
 * not an element inside a layout: it is the largest thing on the surface and
 * nothing competes with it. An earlier version drew the productive/distracting bar
 * at full saturation across the full width, which made it the loudest element on
 * screen — louder than the number it exists to support. The bar is now a quiet
 * 3px annotation UNDER the numeral, using the tier hues at low alpha so it reads
 * as data rather than as chrome.
 *
 * WHY AMBER, NOT BRAND PINK
 * -------------------------
 * LAMINAR §2 reserves amber for time-domain surfaces and pink/clay for Focus and
 * brand. The stopwatch is a clock, so it is amber. The tier hues below are DATA
 * marks, never chrome — §7.2 bans two signal hues on one surface, so chrome stays
 * amber + neutral zinc and the data carries the tier.
 *
 * THE MOTION
 * ----------
 * `layoutId` on the numeral is the whole trick (HALO §59): the SAME DOM node is
 * shared by the compact and expanded layouts, so Motion interpolates its position
 * and size between them. That is why the pill appears to *become* the panel rather
 * than one being destroyed and another built. Staggered entrance follows HALO §68
 * (primary content first, supporting rows after) and is interruptible by
 * construction because Motion retargets rather than replaying.
 *
 * Easing is duration-based, not spring: LAMINAR §7.4 makes spring/bounce a
 * hard-gate FAIL for app chrome and `design/design.md` outranks the HALO spec,
 * which otherwise asks for springs at §64.
 */

export interface StopwatchHeroProps {
  /** null until the main process delivers the first authoritative snapshot. */
  snapshot: StopwatchPayload | null;
  currentApp: NowPayload | null;
  /**
   * Epoch ms of when the OS idle threshold was crossed, or null. The stopwatch
   * freezes on AFK WITHOUT flipping `paused`, so a frozen readout is
   * indistinguishable from a crashed one unless the caller states it explicitly.
   */
  awaySince?: number | null;
  onTogglePause?: () => void;
  onCycleTier?: (tier: 'productive' | 'distracting') => void;
}

const TIER_TOKEN: Record<StopwatchPayload['tier'], string> = {
  productive: 'var(--tier-productive)',
  neutral: 'var(--tier-neutral)',
  distracting: 'var(--tier-distracting)',
};

/** HALO §68 choreography targets, in seconds. */
const EASE = [0.16, 1, 0.3, 1] as const;

function formatAway(awaySince: number | null, now: number): string {
  if (!awaySince) return '';
  const mins = Math.max(0, Math.round((now - awaySince) / 60000));
  if (mins < 1) return 'Away just now';
  if (mins < 60) return `Away ${mins}m`;
  return `Away ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Productive-share ring, ported from the dashboard's own hero
 * (`src/pages/dashboard/StatusBand.tsx:338-372`) so the island and the dashboard
 * read as one product: same `r=42` geometry, same 4px stroke, same
 * `--border-subtle` track, same 0.4s `cubic-bezier(.16,1,.3,1)` ease, same rotated
 * start, and the same percentage set inside in the project mono face.
 *
 * It is a real progress INDICATOR, not decoration: the arc is the productive share
 * of the tracked day, and the number inside is that share.
 */
function ShareRing({ percent, tier, paused }: { percent: number; tier: string; paused: boolean }) {
  const reduce = useReducedMotion();
  const circumference = 2 * Math.PI * 42;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <svg width="52" height="52" viewBox="0 0 100 100" className="flex-shrink-0" role="img" aria-label={`${clamped}% of tracked time on task`}>
      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
      <motion.circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke={tier}
        strokeWidth="5"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
        transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE }}
        transform="rotate(-90 50 50)"
        strokeLinecap="round"
        opacity={paused ? 0.4 : 1}
      />
      <text
        x="50"
        y="47"
        textAnchor="middle"
        fill={tier}
        fontSize="13"
        fontFamily="var(--font-mono)"
        fontWeight="700"
      >
        {Math.round(clamped)}
      </text>
      <text x="50" y="61" textAnchor="middle" fill="var(--halo-muted)" fontSize="9" fontFamily="var(--font-sans)">
        % on task
      </text>
    </svg>
  );
}

/** 9px tier chip, matching the dashboard's category chips. */
function TierChip({ tier, label }: { tier: string; label: string }) {
  return (
    <span
      className="flex-shrink-0 rounded px-1.5 py-0.5 halo-t-eyebrow"
      style={{ color: tier, backgroundColor: `color-mix(in srgb, ${tier} 12%, transparent)` }}
    >
      {label}
    </span>
  );
}

/** Compact human duration for the split bar captions ("3h 47m", "49m"). */
function shortDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function TierDot({ tier }: { tier: StopwatchPayload['tier'] }) {
  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
      style={{ backgroundColor: TIER_TOKEN[tier] }}
    />
  );
}

/**
 * The numeral. `layoutId` is what makes the compact pill and the expanded panel
 * share one identity, so Motion morphs it instead of cross-fading two elements.
 * `tabular-nums` is load-bearing: proportional digits reflow the pill every
 * second, which reads as instability rather than as time passing.
 */
const Numeral = memo(function Numeral({
  ms,
  dim,
  size,
}: {
  ms: number;
  dim: boolean;
  size: 'compact' | 'hero';
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      layoutId="halo-stopwatch-numeral"
      className={`${size === 'hero' ? 'halo-t-display' : 'halo-t-value'} tabular-nums`}
      style={{ color: dim ? 'var(--halo-dim)' : 'var(--halo-text)' }}
      transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
    >
      {formatStopwatch(ms)}
    </motion.span>
  );
});

/**
 * Productive vs distracting as one quiet track. Both fills use
 * `transform: scaleX()` rather than width so the bar never relayouts (HALO
 * §94/§139), and the tier hues sit at reduced alpha so this reads as an
 * annotation under the numeral instead of competing with it.
 */
function TierSplitBar({ snapshot }: { snapshot: StopwatchPayload }) {
  const total = snapshot.productiveMs + snapshot.distractingMs;
  const productiveShare = total > 0 ? snapshot.productiveMs / total : 0;
  const distractingShare = total > 0 ? snapshot.distractingMs / total : 0;
  const pct = Math.round(productiveShare * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative h-[3px] w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--halo-track)' }}
        role="img"
        aria-label={`${pct}% productive, ${100 - pct}% distracting`}
      >
        <div
          className="absolute inset-y-0 left-0 w-full rounded-full"
          style={{
            backgroundColor: 'var(--tier-productive)',
            opacity: 0.55,
            transform: `scaleX(${productiveShare})`,
            transformOrigin: 'left center',
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-full rounded-full"
          style={{
            backgroundColor: 'var(--tier-distracting)',
            opacity: 0.55,
            transform: `scaleX(${distractingShare})`,
            transformOrigin: 'right center',
          }}
        />
      </div>
      {/* Captions state each bucket's DURATION, not a wall-clock total labelled
          "off-track" — an absolute HH:MM:SS next to the word "off-track" reads
          like a timestamp rather than a quantity. */}
      <div className="halo-split-stat">
        <span className="halo-t-label" style={{ color: 'var(--halo-muted)' }}>
          {shortDuration(snapshot.productiveMs)} on task
        </span>
        <span className="halo-t-label" style={{ color: 'var(--halo-muted)' }}>
          {shortDuration(snapshot.distractingMs)} off task
        </span>
      </div>
    </div>
  );
}

function Row({
  children,
  delay,
  reduce,
}: {
  children: React.ReactNode;
  delay: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.17, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Compact state — the chronometer.
 *
 * THE DESIGN IDEA: this is a clock, not a notification. An earlier version put a
 * coloured status DOT beside the numeral, which made the pill read as a
 * notification light and put the dot in competition with the number for the first
 * 200ms of attention. So the dot is gone. Hierarchy is now carried by POSITION:
 *
 *   1. the numeral is alone on the centreline — nothing competes with it
 *   2. the seconds are de-emphasised, which is how a real chronometer reads and
 *      lets the eye find the minutes first
 *   3. the tier is a 2px gauge along the BOTTOM EDGE of the pill, not a mark
 *      beside the number
 *
 * The gauge is the productive share of the day, so at a glance the pill answers
 * two questions in one glance — how long, and was it good time — without ever
 * putting two objects at the same visual rank.
 */
function StopwatchHeroCompact({
  snapshot,
  awaySince,
  now,
}: {
  snapshot: StopwatchPayload;
  awaySince: number | null;
  now: number;
}) {
  const away = formatAway(awaySince, now);
  const total = snapshot.productiveMs + snapshot.distractingMs;
  const productiveShare = total > 0 ? snapshot.productiveMs / total : 0;
  const distractingShare = total > 0 ? snapshot.distractingMs / total : 0;
  const formatted = formatStopwatch(snapshot.displayMs);
  const secSplit = formatted.lastIndexOf(':');

  return (
    <div
      className="relative flex h-full items-center justify-center gap-2 px-3"
      data-halo-stopwatch-compact="true"
    >
      {away ? (
        <>
          <TriangleAlert size={13} style={{ color: 'var(--halo-signal)' }} aria-hidden="true" />
          <span className="halo-t-value tabular-nums" style={{ color: 'var(--halo-muted)' }}>
            {away}
          </span>
        </>
      ) : (
        <>
          <span
            className="font-mono halo-t-value leading-none tabular-nums"
            style={{ color: snapshot.paused ? 'var(--halo-dim)' : 'var(--halo-text)' }}
          >
            {secSplit > 0 ? (
              <>
                <span style={{ color: snapshot.paused ? 'var(--halo-dim)' : 'var(--halo-muted)' }}>
                  {formatted.slice(0, secSplit + 1)}
                </span>
                <span>{formatted.slice(secSplit + 1)}</span>
              </>
            ) : (
              formatted
            )}
          </span>
          {snapshot.paused && (
            <Pause size={11} style={{ color: 'var(--halo-dim)' }} aria-hidden="true" />
          )}
          {snapshot.externalLabel && (
            <span className="max-w-[110px] truncate halo-t-label" style={{ color: 'var(--halo-muted)' }}>
              {snapshot.externalLabel}
            </span>
          )}
        </>
      )}

      {/* Bottom-edge gauge: the tier, at a lower visual rank than the numeral. */}
      {!away && total > 0 && (
        <div className="absolute inset-x-3 bottom-1 flex h-[2px] gap-[2px] overflow-hidden" aria-hidden="true">
          <span
            className="h-full flex-1 rounded-full"
            style={{
              backgroundColor: 'var(--tier-productive)',
              opacity: 0.75,
              transform: `scaleX(${productiveShare})`,
              transformOrigin: 'left center',
            }}
          />
          <span
            className="h-full flex-1 rounded-full"
            style={{
              backgroundColor: 'var(--tier-distracting)',
              opacity: 0.75,
              transform: `scaleX(${distractingShare})`,
              transformOrigin: 'right center',
            }}
          />
        </div>
      )}

      <span className="sr-only">
        {away
          ? away
          : `${formatStopwatch(snapshot.displayMs)} tracked, ${Math.round(productiveShare * 100)} percent ${snapshot.tier}`}
      </span>
    </div>
  );
}

function StopwatchHeroSkeleton() {
  return (
    <div className="flex h-full items-center gap-2 px-3" aria-busy="true" aria-label="Loading stopwatch">
      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--ws-border-strong)' }} />
      <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--halo-track)' }} />
    </div>
  );
}

function StopwatchHeroExpanded({
  snapshot,
  currentApp,
  awaySince,
  now,
  onTogglePause,
  onCycleTier,
}: {
  snapshot: StopwatchPayload;
  currentApp: NowPayload | null;
  awaySince: number | null;
  now: number;
  onTogglePause?: () => void;
  onCycleTier?: (tier: 'productive' | 'distracting') => void;
}) {
  const reduce = useReducedMotion();
  const away = formatAway(awaySince, now);
  const nextTier: 'productive' | 'distracting' =
    snapshot.tier === 'distracting' ? 'productive' : 'distracting';
  const tierTotal = snapshot.productiveMs + snapshot.distractingMs;
  const productivePercent =
    tierTotal > 0 ? (snapshot.productiveMs / tierTotal) * 100 : 0;

  return (
    <div
      className="flex flex-col gap-3 p-4"
      data-halo-stopwatch-expanded="true"
      role="group"
      aria-label="Tracked time"
    >
      <Row delay={0} reduce={!!reduce}>
        <div className="flex items-center justify-between">
          <span
            className="halo-t-eyebrow"
            style={{ color: 'var(--halo-signal)' }}
          >
            Tracked
          </span>
          {onTogglePause && (
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={snapshot.paused ? 'Resume tracking' : 'Pause tracking'}
              className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
              style={{ color: 'var(--halo-muted)' }}
            >
              {snapshot.paused ? <Play size={13} /> : <Pause size={13} />}
            </button>
          )}
        </div>
      </Row>

      <Row delay={reduce ? 0 : 0.04} reduce={!!reduce}>
        <div className="halo-hero-grid">
          {!away && (
            <ShareRing
              percent={productivePercent}
              tier={TIER_TOKEN[snapshot.tier]}
              paused={snapshot.paused}
            />
          )}
          <div className="halo-hero-side">
            <div className="flex items-baseline gap-2">
              <Numeral ms={snapshot.displayMs} dim={!!away} size="hero" />
            </div>
            <div className="halo-chip-row">
              <TierChip tier={TIER_TOKEN[snapshot.tier]} label={snapshot.tier} />
              {snapshot.paused && !away && (
                <span className="halo-t-label" style={{ color: 'var(--halo-dim)' }}>
                  paused
                </span>
              )}
              {away && (
                <span className="halo-t-label" style={{ color: 'var(--halo-signal)' }}>
                  {away}
                </span>
              )}
            </div>
          </div>
        </div>
      </Row>

      {away ? (
        <Row delay={reduce ? 0 : 0.08} reduce={!!reduce}>
          <p className="halo-t-label" style={{ color: 'var(--halo-signal)' }}>
            {away} — the clock is frozen, not lost.
          </p>
        </Row>
      ) : (
        <Row delay={reduce ? 0 : 0.08} reduce={!!reduce}>
          <TierSplitBar snapshot={snapshot} />
        </Row>
      )}

      <Row delay={reduce ? 0 : 0.12} reduce={!!reduce}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 flex-shrink-0 rounded-[3px]"
              style={{ backgroundColor: TIER_TOKEN[currentApp?.tier ?? snapshot.tier], opacity: 0.8 }}
            />
            <span className="truncate halo-t-label font-medium" style={{ color: 'var(--halo-text)' }}>
              {currentApp?.app ?? 'No app detected'}
            </span>
            {currentApp && (
              <span
                className="flex-shrink-0 rounded px-1.5 py-0.5 halo-t-micro"
                style={{
                  color: 'var(--halo-muted)',
                  backgroundColor: 'var(--halo-track)',
                }}
              >
                {currentApp.category}
              </span>
            )}
          </div>
          {onCycleTier && (
            <button
              type="button"
              onClick={() => onCycleTier(nextTier)}
              aria-label={`Switch to ${nextTier}`}
              className="flex-shrink-0 rounded-lg px-2 py-1 halo-t-eyebrow transition-colors"
              style={{ color: TIER_TOKEN[nextTier], border: `1px solid ${TIER_TOKEN[nextTier]}` }}
            >
              {nextTier === 'productive' ? 'On task' : 'Off task'}
            </button>
          )}
        </div>
      </Row>
    </div>
  );
}

export const StopwatchHero = memo(function StopwatchHero({
  snapshot,
  currentApp,
  expanded,
  awaySince = null,
  now,
  onTogglePause,
  onCycleTier,
}: StopwatchHeroProps & { expanded: boolean; now: number }) {
  const reduce = useReducedMotion();

  if (!snapshot) return <StopwatchHeroSkeleton />;

  if (!expanded) {
    return <StopwatchHeroCompact snapshot={snapshot} awaySince={awaySince} now={now} />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key="expanded"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.12, ease: EASE }}
      >
        <StopwatchHeroExpanded
          snapshot={snapshot}
          currentApp={currentApp}
          awaySince={awaySince}
          now={now}
          onTogglePause={onTogglePause}
          onCycleTier={onCycleTier}
        />
      </motion.div>
    </AnimatePresence>
  );
});

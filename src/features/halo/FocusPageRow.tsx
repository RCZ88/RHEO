/**
 * THE FOCUS ROW — `HALO_RESULT.md` §4.4, §6, §7.8.
 *
 * THE ROW HAS TWO JOBS AND IT MUST NOT CONFUSE THEM:
 *
 *   1. THE STOPWATCH — one clock, one subject. The app or site it is measuring sits WITH the
 *      clock (a `Tracking` block), not as a second unrelated figure. Controls exist only here,
 *      because they drive this clock.
 *   2. THE FOCUS SESSION — the app is now ENFORCING, not measuring. The row changes job: it
 *      shows the lock (what is blocked), the `Now` block (what is tracked, with an allowed
 *      check), the wall-clock the lock lifts, and a chevron into the allow-list. The stopwatch
 *      controls stand down: a pause button beside a countdown you cannot pause is a lie.
 *
 * ONE CLOCK. The previous "two stopwatch" defect was two mono `hh:mm:ss` figures on one row.
 * The session countdown REPLACES the stopwatch numeral; the stopwatch value is never printed
 * alongside it. The subject block carries words, not a second time.
 *
 * THE PRIVACY RULE IS UNCHANGED: a private window shows a lock and the words "Private window",
 * never a hostname. `tracked.kind === 'priv'` carries no hostname at all.
 */
import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AppWindow, Check, ChevronLeft, ChevronRight, Coffee, Globe, Lock, Pause, Play, RotateCcw, Target, X } from 'lucide-react';
import { formatStopwatch, type StopwatchSnapshot } from '../../lib/stopwatchStore';

/** The shape `halo:get-focus` returns (`FocusManager.getPublicState()`). */
export interface HaloFocusState {
  ok: boolean;
  active?: boolean;
  paused?: boolean;
  /** `null` = open-ended. That is NOT "finished": the clock counts UP and there is no stroke. */
  endsAt?: number | null;
  remainingSec?: number | null;
  startedAt?: number | null;
  strictness?: 'distracting' | 'non_allowed';
  allowedApps?: string[];
  allowedDomains?: string[];
  allowedTiers?: string[];
  error?: string;
}

export interface FocusPageRowProps {
  snapshot: StopwatchSnapshot;
  onReset: () => void;
  onTogglePause: () => void;
  /** What the stopwatch measures: app, site, or the private shape (no hostname by design). */
  tracked?: { kind: 'win' | 'web' | 'priv'; label: string };
  /** The live tier of the tracked app, used only by the "is this allowed?" check. */
  trackedTier?: string | null;
  focus?: HaloFocusState | null;
  now?: number;
  /** ms since the user left, when AFK is active. `null`/absent = present. */
  awayMs?: number | null;
  /** The deadline the stopwatch is bound to (§7.8). Replaces the Tracking block with `For`. */
  deadlineTitle?: string | null;
  /** Show the 6-second "Complete" state, owned by OverlayRoot so the pill agrees with the row. */
  completeMs?: number | null;
  onDismissComplete?: () => void;
  /** Editing the allow-list is a hand-off (no write API), so this navigates to the Focus tab. */
  onEditFocus?: () => void;
  /** N1 — start a focus session. `0` = open-ended (the manager's stopwatch mode). */
  onStartFocus?: (durationSec: number) => void;
  /** N2 — start the break promise; the island owns the countdown, main stores the window. */
  onStartBreak?: (untilMs: number) => void;
  /** N2 — end the break early (the one 44px play button). */
  onEndBreak?: () => void;
  /** epoch ms the running break ends; `null`/absent = no break. */
  breakUntil?: number | null;
}

const MONO = 'var(--font-mono, ui-monospace, monospace)';

const EYEBROW: CSSProperties = {
  fontFamily: MONO,
  fontSize: 'var(--halo-t-eyebrow, 11px)',
  fontWeight: 400,
  color: 'var(--halo-dim)',
  lineHeight: 1.2,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const LABEL: CSSProperties = {
  fontFamily: MONO,
  fontSize: 'var(--halo-t-label, 11px)',
  color: 'var(--halo-dim)',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const VALUE: CSSProperties = {
  fontFamily: MONO,
  fontSize: 'var(--halo-t-value, 13px)',
  color: 'var(--halo-muted)',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const HERO: CSSProperties = {
  fontFamily: MONO,
  fontSize: 'var(--halo-t-hero, 26px)',
  fontWeight: 500,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
};

const DIVIDER: CSSProperties = {
  width: 1,
  height: 'calc(var(--halo-row, 56px) - 8px)',
  background: 'var(--halo-border)',
  flexShrink: 0,
};

function IconBtn({
  label,
  onClick,
  fill,
  children,
}: {
  label: string;
  onClick: () => void;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: fill ? 'var(--halo-accent)' : 'transparent',
        border: fill ? '1px solid transparent' : '1px solid var(--halo-border)',
        color: fill ? 'var(--halo-on-accent)' : 'var(--halo-muted)',
        cursor: 'pointer',
        transition: 'background 150ms var(--halo-ease)',
      }}
    >
      {children}
    </button>
  );
}

/** Split `HH:MM:SS` so the hours recede and `MM:SS` carries the eye. One span cannot do this. */
function splitClock(ms: number): { dim: string; bright: string } {
  const full = formatStopwatch(ms);
  const idx = full.indexOf(':');
  return { dim: full.slice(0, idx + 1), bright: full.slice(idx + 1) };
}

function Clock({ ms, frozen }: { ms: number; frozen?: boolean }) {
  const { dim, bright } = splitClock(ms);
  return (
    <div
      className="tabular-nums"
      style={{ ...HERO, color: frozen ? 'var(--halo-dim)' : undefined, transition: 'color 150ms var(--halo-ease)' }}
    >
      <span style={{ color: 'var(--halo-dim)' }}>{dim}</span>
      <span style={{ color: frozen ? 'var(--halo-dim)' : 'var(--halo-text)' }}>{bright}</span>
    </div>
  );
}

function TrackIcon({ kind, color }: { kind: 'win' | 'web' | 'priv'; color?: string }) {
  const style = { color: color ?? 'var(--halo-muted)', flexShrink: 0 } as CSSProperties;
  if (kind === 'priv') return <Lock size={12} strokeWidth={2} aria-hidden="true" style={style} />;
  if (kind === 'web') return <Globe size={12} strokeWidth={2} aria-hidden="true" style={style} />;
  return <AppWindow size={12} strokeWidth={2} aria-hidden="true" style={style} />;
}

function formatAway(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatWallClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Is the tracked target tolerated by this session? `null` = unknown, and an unknown never
 *  gets a check: a glyph is a claim that the app checked. */
function allowedNow(
  focus: HaloFocusState,
  tracked: FocusPageRowProps['tracked'],
  tier?: string | null,
): boolean | null {
  if (!tracked) return null;
  if (focus.strictness === 'distracting') {
    if (!tier) return null;
    return tier !== 'distracting';
  }
  const apps = focus.allowedApps ?? [];
  const domains = focus.allowedDomains ?? [];
  const tiers = focus.allowedTiers ?? [];
  if (tracked.kind === 'priv') return null;
  if (tracked.kind === 'web') {
    const label = tracked.label.toLowerCase();
    return domains.some((d) => {
      const host = d.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      return host.length > 0 && (label === host || label.endsWith(`.${host}`));
    });
  }
  if (apps.includes(tracked.label)) return true;
  if (tier && tiers.includes(tier)) return true;
  return apps.length + domains.length + tiers.length > 0 ? false : null;
}

export const FocusPageRow = memo(function FocusPageRow({
  snapshot,
  onReset,
  onTogglePause,
  tracked,
  trackedTier,
  focus,
  now,
  awayMs,
  deadlineTitle,
  completeMs,
  onDismissComplete,
  onEditFocus,
}: FocusPageRowProps) {
  const [view, setView] = useState<'row' | 'allowed' | 'start' | 'break-set'>('row');

  /* A session is only trusted when the producer ANSWERED. A failed read must never swap a
   * live countdown for a stopwatch while a lock is actually engaged. */
  const session = focus && focus.ok && focus.active ? focus : null;
  const sessionActive = !!session;

  /* Back to the row when the session ends. The dep is the BOOLEAN, not the object: the producer
   * replaces `focus` on every poll, so an object dep would close the allow-list view under the
   * user's finger every five seconds. */
  useEffect(() => {
    if (!sessionActive) setView('row');
  }, [sessionActive]);

  const tickNow = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  /* The break promise (N2). Derived from `tickNow` (the parent's 1 Hz tick) so it re-evaluates
   * every second; it still runs before the early returns. */
  const breakLive =
    !session && typeof breakUntil === 'number' && breakUntil > tickNow;
  const breakMs = breakLive && breakUntil != null ? Math.max(0, breakUntil - tickNow) : 0;

  const endsAt = typeof session?.endsAt === 'number' ? session.endsAt : null;
  const startedAt = typeof session?.startedAt === 'number' ? session.startedAt : null;
  const sessionMs =
    endsAt != null
      ? Math.max(0, endsAt - tickNow)
      : startedAt != null
        ? Math.max(0, tickNow - startedAt)
        : 0;

  const paused = !!session?.paused;
  const away = !session && typeof awayMs === 'number' && awayMs > 0;
  /* The dot is the live indicator. A running session is live; a paused one is not; an away
   * stopwatch is not counting, so it is not live either. */
  const live = session ? !paused : !snapshot.paused && !away;

  /* ── 1. SESSION COMPLETE — six seconds, then the stopwatch row returns (§7.1). ───────── */
  if (!session && typeof completeMs === 'number' && completeMs > 0) {
    const minutes = Math.max(1, Math.round(completeMs / 60_000));
    return (
      <div
        className="halo-row-swap"
        data-halo-focus-row="complete"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--halo-gap-loose, 12px)', width: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--halo-dim)' }} />
            <span style={EYEBROW}>Focus</span>
            <span style={{ ...EYEBROW, color: 'var(--halo-text)', textTransform: 'uppercase' }}>Complete</span>
          </div>
          <Clock ms={completeMs} />
        </div>
        <span aria-hidden="true" style={DIVIDER} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={LABEL}>Focused</span>
          <span style={{ ...VALUE, color: 'var(--halo-text)' }}>{minutes} min</span>
        </div>
        <span aria-hidden="true" style={{ flex: 1 }} />
        <IconBtn label="Dismiss" onClick={() => onDismissComplete?.()}>
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </IconBtn>
      </div>
    );
  }

  /* ── 1b. THE BREAK ROW (N2) — an honest promise, not a stopwatch state. ────────────────
   * BREAK eyebrow, a ticking mono countdown, the BACK AT wall clock, and ONE 44px play
   * button that ends it. The countdown lives in the island (main only stores the window),
   * so this is display of island state, exactly like the design says: "the break countdown
   * lives in the island only". */
  if (breakLive && breakUntil != null) {
    const backAt = formatWallClock(breakUntil);
    return (
      <div
        className="halo-row-swap"
        data-halo-focus-row="break"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--halo-gap-loose, 12px)', width: '100%', minWidth: 0 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Coffee size={11} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-accent)' }} />
            <span style={{ ...EYEBROW, color: 'var(--halo-text)' }}>Break</span>
          </div>
          <Clock ms={breakMs} />
        </div>
        <span aria-hidden="true" style={DIVIDER} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={LABEL}>Back at</span>
          <span style={{ ...VALUE, color: 'var(--halo-text)' }}>{backAt}</span>
        </div>
        <span aria-hidden="true" style={{ flex: 1 }} />
        <IconBtn label="End break" onClick={() => onEndBreak?.()}>
          <Play size={13} strokeWidth={2} aria-hidden="true" />
        </IconBtn>
      </div>
    );
  }

  /* ── 1c. THE START EDITOR (N1) — an in-place view; the row height NEVER changes. ────────
   * Opened by the Target control on the normal row. Focus lengths are committed with a
   * HOLD (the picked direction's "hardware moment": the button charges under the finger
   * and drains back on early release), because starting a session is deliberate. Break
   * opens the second stage, where the length picks the promise. */
  if (view === 'start' || view === 'break-set') {
    const isBreakStage = view === 'break-set';
    return (
      <div
        className="halo-row-swap"
        data-halo-focus-row={isBreakStage ? 'break-set' : 'start'}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Escape') setView('row');
        }}
      >
        <IconBtn
          label={isBreakStage ? 'Back to focus lengths' : 'Close'}
          onClick={() => setView(isBreakStage ? 'start' : 'row')}
        >
          <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
        </IconBtn>
        <span style={LABEL}>{isBreakStage ? 'Break until' : 'Start focus'}</span>
        <span aria-hidden="true" style={{ width: 1, height: 22, background: 'var(--halo-border)', flexShrink: 0 }} />
        {isBreakStage ? (
          <>
            <HoldBtn label="10m" title="Hold to start a 10 minute break" onCommit={() => { setView('row'); onStartBreak?.(Date.now() + 10 * 60_000); }} />
            <HoldBtn label="15m" title="Hold to start a 15 minute break" onCommit={() => { setView('row'); onStartBreak?.(Date.now() + 15 * 60_000); }} />
            <HoldBtn label="30m" title="Hold to start a 30 minute break" onCommit={() => { setView('row'); onStartBreak?.(Date.now() + 30 * 60_000); }} />
          </>
        ) : (
          <>
            <HoldBtn label="25m" title="Hold to start a 25 minute focus" onCommit={() => { setView('row'); onStartFocus?.(25 * 60); }} />
            <HoldBtn label="50m" title="Hold to start a 50 minute focus" onCommit={() => { setView('row'); onStartFocus?.(50 * 60); }} />
            <HoldBtn label="Open" title="Hold to start an open-ended focus" onCommit={() => { setView('row'); onStartFocus?.(0); }} />
            <button
              type="button"
              onClick={() => setView('break-set')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 28,
                padding: '0 10px', border: '1px solid var(--halo-border)', borderRadius: 999,
                background: 'transparent', color: 'var(--halo-text)', cursor: 'pointer',
                fontSize: 'var(--halo-t-value, 13px)',
              }}
              title="Start a break instead"
            >
              <Coffee size={11} strokeWidth={2} aria-hidden="true" />
              Break
            </button>
          </>
        )}
        <span aria-hidden="true" style={{ flex: 1 }} />
      </div>
    );
  }

  /* ── 2. THE ALLOW-LIST VIEW — reuses the same row, so the panel height never changes. ─── */
  if (session && view === 'allowed') {
    const apps = session.allowedApps ?? [];
    const domains = session.allowedDomains ?? [];
    const tiers = session.allowedTiers ?? [];
    const none = apps.length + domains.length + tiers.length === 0;
    const chips: Array<{ key: string; icon: ReactNode; text: string }> = [
      ...apps.map((a) => ({ key: `a:${a}`, icon: <AppWindow size={11} strokeWidth={2} aria-hidden="true" />, text: a })),
      ...domains.map((d) => ({ key: `d:${d}`, icon: <Globe size={11} strokeWidth={2} aria-hidden="true" />, text: d })),
      ...tiers.map((t) => ({ key: `t:${t}`, icon: null, text: t })),
    ];

    return (
      <div
        className="halo-row-swap"
        data-halo-focus-row="allowed"
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minWidth: 0 }}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Escape') setView('row');
        }}
      >
        <IconBtn label="Back" onClick={() => setView('row')}>
          <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
        </IconBtn>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={LABEL}>Allowed in this session</span>
          {session.strictness === 'distracting' ? (
            <span style={{ ...VALUE, color: 'var(--halo-text)' }}>Distracting apps and sites are blocked.</span>
          ) : none ? (
            <span style={{ ...VALUE, color: 'var(--halo-text)' }}>No apps or sites allowed. Everything is blocked.</span>
          ) : (
            <div
              role="list"
              aria-label="Allowed apps and sites"
              tabIndex={0}
              onWheel={(e) => e.stopPropagation()}
              className="halo-chips"
              style={{ display: 'flex', gap: 6, overflowX: 'auto', minWidth: 0, padding: '2px 0' }}
            >
              {chips.map((c) => (
                <span
                  key={c.key}
                  role="listitem"
                  title={c.text}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    border: '1px solid var(--halo-border)',
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--halo-t-value, 13px)',
                    color: 'var(--halo-text)',
                    whiteSpace: 'nowrap',
                    flex: 'none',
                  }}
                >
                  {c.icon}
                  {c.text}
                </span>
              ))}
            </div>
          )}
        </div>
        {onEditFocus && (
          <IconBtn label="Edit in Focus" onClick={onEditFocus}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </IconBtn>
        )}
      </div>
    );
  }

  /* ── 3. THE NORMAL ROW — stopwatch or session. ────────────────────────────────────────── */
  const lockLabel = session?.strictness === 'non_allowed' ? 'Allow-list' : 'Locked';
  const lockRule =
    session?.strictness === 'non_allowed'
      ? 'Only the apps and sites allowed in this session are open'
      : 'Distracting apps and sites are blocked';
  const endsAtLabel = endsAt != null ? formatWallClock(endsAt) : null;
  const allowed = session ? allowedNow(session, tracked, trackedTier) : null;

  return (
    <div
      className="halo-row-swap"
      data-halo-focus-row={session ? 'session' : 'stopwatch'}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--halo-gap-loose, 12px)', width: '100%', minWidth: 0 }}
    >
      {/* ── THE CLOCK GROUP. One clock, one label, and — while measuring — one subject. */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minWidth: 0, flex: '0 1 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              flexShrink: 0,
              background: live ? 'var(--halo-accent)' : 'var(--halo-dim)',
              transition: 'background 150ms var(--halo-ease)',
            }}
          />
          <span style={{ ...EYEBROW, flexShrink: 0 }}>{session ? 'Focus' : 'Stopwatch'}</span>

          {/* Away is a LABEL, not a colour-only signal. */}
          {away && <span style={{ ...EYEBROW, color: 'var(--halo-away)', textTransform: 'uppercase' }}>Away</span>}

          {/* The lock: what the FocusManager is enforcing, in one word. Paused lifts the lock,
           * so the word changes to Paused and the glyph goes away. */}
          {session && !paused && (
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
              title={lockRule}
              aria-label={lockRule}
            >
              <Lock size={11} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-accent)' }} />
              <span style={{ ...EYEBROW, color: 'var(--halo-text)' }}>{lockLabel}</span>
            </span>
          )}
          {session && paused && <span style={{ ...EYEBROW, color: 'var(--halo-text)' }}>Paused</span>}

          {/* While BOUND to a deadline the app/site stays in the eyebrow row (§7.8). */}
          {!session && deadlineTitle && tracked && (
            <>
              <span aria-hidden="true" style={{ width: 1, height: 8, background: 'var(--halo-border)', flexShrink: 0 }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <TrackIcon kind={tracked.kind} />
                <span className="truncate" style={{ fontSize: 'var(--halo-t-value, 13px)', fontWeight: 500, color: live ? 'var(--halo-text)' : 'var(--halo-dim)', minWidth: 0 }}>
                  {tracked.label}
                </span>
              </span>
            </>
          )}
        </div>
        <Clock ms={session ? sessionMs : snapshot.displayMs} frozen={session ? paused : away} />
      </div>

      {/* ── TRACKING (stopwatch) / FOR (bound deadline) / AWAY ─────────────────────────── */}
      {!session && tracked && !deadlineTitle && (
        <>
          <span aria-hidden="true" style={DIVIDER} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={LABEL}>Tracking</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <TrackIcon kind={tracked.kind} />
              <span
                className="truncate"
                style={{ fontSize: 'var(--halo-t-value, 13px)', fontWeight: 500, color: live ? 'var(--halo-text)' : 'var(--halo-dim)', minWidth: 0 }}
              >
                {tracked.label}
              </span>
            </span>
          </div>
        </>
      )}

      {!session && deadlineTitle && (
        <>
          <span aria-hidden="true" style={DIVIDER} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={LABEL}>For</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <CalendarGlyph />
              <span className="truncate" style={{ fontSize: 'var(--halo-t-value, 13px)', fontWeight: 500, color: 'var(--halo-text)', minWidth: 0 }}>
                {deadlineTitle}
              </span>
            </span>
          </div>
        </>
      )}

      {!session && away && (
        <>
          <span aria-hidden="true" style={DIVIDER} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={LABEL}>Away</span>
            <span style={{ ...VALUE, color: 'var(--halo-away)', display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Coffee size={12} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span className="truncate">{formatAway(awayMs ?? 0)}</span>
            </span>
          </div>
        </>
      )}

      {/* ── SESSION: Now + Ends, and no controls that pretend to drive it. ─────────────── */}
      {session && (
        <>
          <span aria-hidden="true" style={DIVIDER} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={LABEL}>Now</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {tracked ? <TrackIcon kind={tracked.kind} /> : null}
              <span className="truncate" style={{ fontSize: 'var(--halo-t-value, 13px)', fontWeight: 500, color: 'var(--halo-text)', minWidth: 0 }}>
                {tracked?.label ?? 'No app yet'}
              </span>
              {allowed === true && (
                <Check size={11} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-accent)', flexShrink: 0 }} />
              )}
            </span>
          </div>
        </>
      )}

      <span aria-hidden="true" style={{ flex: 1 }} />

      {session && (
        <>
          <span aria-hidden="true" style={DIVIDER} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
            <span style={LABEL}>Ends</span>
            {/* An open-ended session has no wall-clock to print. "no limit" is the truth. */}
            <span style={{ ...VALUE, color: 'var(--halo-muted)' }}>{endsAtLabel ?? 'no limit'}</span>
          </div>
          <IconBtn label="Show what is allowed in this session" onClick={() => setView('allowed')}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </IconBtn>
        </>
      )}

      {/* THE CONTROLS BELONG TO THE STOPWATCH. During a session they do not exist. */}
      {!session && !breakLive && (
        <>
          <IconBtn label="Reset timer" onClick={onReset}>
            <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
          </IconBtn>
          <IconBtn
            label={snapshot.paused ? 'Resume timer' : 'Pause timer'}
            fill={!snapshot.paused}
            onClick={onTogglePause}
          >
            {snapshot.paused ? <Play size={13} strokeWidth={2} aria-hidden="true" /> : <Pause size={13} strokeWidth={2} aria-hidden="true" />}
          </IconBtn>
          {/* N1 — the third control. Hold-to-commit lives INSIDE the editor, not here; this
           * only opens it, so a plain click is honest. */}
          {onStartFocus && (
            <IconBtn label="Start focus or break" onClick={() => setView('start')}>
              <Target size={13} strokeWidth={2} aria-hidden="true" />
            </IconBtn>
          )}
        </>
      )}
    </div>
  );
});

/* HOLD-BTN — the scout-picked `@kokonutui/hold-button` pattern, re-skinned to the island's
 * tokens. The fill tracks the hold (rAF, transform-only: scaleX on a hairline layer), drains
 * back on early release, and commits at HOLD_MS. Under prefers-reduced-motion a plain click
 * commits — a hold gate that cannot animate must not become a trap. Keyboard commits on
 * Enter/Space (no hold required), which is also the accessible path. */
const HOLD_MS = 600;
const HOLD_REDUCE =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function HoldBtn({ label, title, onCommit }: { label: string; title?: string; onCommit: () => void }) {
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef(0);
  const doneRef = useRef(false);

  const setFill = (frac: number): void => {
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${frac})`;
  };
  const stopRaf = (): void => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const tick = (): void => {
    const frac = Math.min(1, (Date.now() - t0Ref.current) / HOLD_MS);
    setFill(frac);
    if (frac >= 1) {
      doneRef.current = true;
      stopRaf();
      onCommit();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (doneRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    t0Ref.current = Date.now();
    tick();
  };
  const onUp = (): void => {
    if (doneRef.current) { doneRef.current = false; return; }
    /* Early release: drain the fill back instead of freezing it mid-charge. */
    stopRaf();
    if (fillRef.current) {
      fillRef.current.style.transition = 'transform 150ms ease-out';
      setFill(0);
      window.setTimeout(() => {
        if (fillRef.current) fillRef.current.style.transition = '';
      }, 160);
    }
  };
  const commitNow = (): void => {
    doneRef.current = true;
    setFill(1);
    onCommit();
  };

  return (
    <button
      type="button"
      title={title ?? `Hold to start ${label.toLowerCase()}`}
      onPointerDown={(e) => { if (HOLD_REDUCE) commitNow(); else onDown(e); }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commitNow(); }
      }}
      style={{
        position: 'relative',
        height: 28,
        padding: '0 12px',
        border: '1px solid var(--halo-border)',
        borderRadius: 999,
        background: 'transparent',
        color: 'var(--halo-text)',
        cursor: 'pointer',
        fontSize: 'var(--halo-t-value, 13px)',
        overflow: 'hidden',
      }}
    >
      <span
        ref={fillRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--halo-accent-dim)',
          transform: 'scaleX(0)',
          transformOrigin: 'left center',
          pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative' }}>{label}</span>
    </button>
  );
}

/** Small calendar glyph for the `For` block — drawn locally so this file does not import a whole
 *  icon set for one 12px shape, and so it matches the 2px stroke of its neighbours. */function CalendarGlyph() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: 'var(--halo-muted)', flexShrink: 0 }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

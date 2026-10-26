import type { CSSProperties, ReactNode } from 'react';
import { CalendarClock, Check, Coffee, Lock } from 'lucide-react';
import { formatStopwatch, type StopwatchSnapshot } from '../../lib/stopwatchStore';
import type { HaloFocusState } from './FocusPageRow';

/**
 * THE PILL BODY WHEN THE ISLAND HAS SOMETHING TO SAY — `HALO_RESULT.md` §4.3, §7.3, §7.8.
 *
 * The default pill is `CompactPill` (the ten board-1 kinds). This file handles the four states
 * that were NOT in board 1 and that the owner asked for by name:
 *
 *   AWAY      coffee + frozen clock + "Away 12m"          (R14: "turn the thing off/red")
 *   RETURN    check + "Back after 12m" + consequence      (6 seconds)
 *   SESSION   lock + countdown + app name (or "Paused")   (R8)
 *   BOUND     clock + deadline title                       (R17)
 *   COMPLETE  check + "Focus done 25m"                     (6 seconds)
 *
 * ONE CLOCK. Every branch prints exactly one numeral. The name is a name; the clock is the clock.
 */

const MONO = 'var(--font-mono, ui-monospace, monospace)';

function SplitClock({ ms, frozen, short }: { ms: number; frozen?: boolean; short?: boolean }) {
  const full = formatStopwatch(ms);
  const idx = full.indexOf(':');
  const dim = full.slice(0, idx + 1);
  const bright = full.slice(idx + 1);
  return (
    <span
      className="tabular-nums"
      style={{
        fontFamily: MONO,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        transition: 'color 150ms var(--halo-ease)',
        color: frozen ? 'var(--halo-dim)' : undefined,
      }}
    >
      {!short && <span style={{ color: 'var(--halo-dim)' }}>{dim}</span>}
      <span style={{ color: frozen ? 'var(--halo-dim)' : 'var(--halo-text)' }}>{bright}</span>
    </span>
  );
}

function Sep() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: '1em', background: 'var(--halo-border)', flexShrink: 0 }}
    />
  );
}

function Name({ icon, text, muted }: { icon?: ReactNode; text: string; muted?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 }}>
      {icon}
      <span
        className="truncate"
        style={{ minWidth: 0, fontWeight: 500, color: muted ? 'var(--halo-dim)' : 'var(--halo-text)' }}
      >
        {text}
      </span>
    </span>
  );
}

function formatAway(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export interface PillSubjectProps {
  snapshot: StopwatchSnapshot;
  focus?: HaloFocusState | null;
  now: number;
  tracked?: { kind: 'win' | 'web' | 'priv'; label: string };
  /** ms since the user left. `null` = present. */
  awayMs: number | null;
  /** ms the last absence lasted, while the 6-second acknowledgement is on screen. */
  returnedAfterMs: number | null;
  returnConsequence: string;
  /** Session duration in ms while the 6-second "complete" state is on screen. */
  completeMs: number | null;
  /** The deadline the stopwatch is bound to (§7.8): its title takes the name slot. */
  deadlineTitle?: string | null;
  fBody: number;
  /** The default body when none of the states above applies. */
  fallback: ReactNode;
}

export function PillSubject({
  snapshot,
  focus,
  now,
  tracked,
  awayMs,
  returnedAfterMs,
  returnConsequence,
  completeMs,
  deadlineTitle,
  fBody,
  fallback,
}: PillSubjectProps) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
    fontSize: `max(11px, ${fBody}px)`,
    whiteSpace: 'nowrap',
  };

  /* ── RETURN — six seconds, then the normal pill (§7.3). ─────────────────────────────── */
  if (returnedAfterMs != null) {
    return (
      <span style={style} data-halo-pill-state="return">
        <Check size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-accent)', flexShrink: 0 }} />
        <Name text={`Back after ${formatAway(returnedAfterMs)}`} />
        <Sep />
        <span style={{ color: 'var(--halo-dim)', flexShrink: 0 }}>{returnConsequence}</span>
      </span>
    );
  }

  /* ── AWAY — the pill STAYS, the clock freezes, the edge goes dashed red (§4.3, §7.3). ── */
  if (awayMs != null) {
    return (
      <span style={style} data-halo-pill-state="away">
        <Coffee size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-away)', flexShrink: 0 }} />
        <span style={{ color: 'var(--halo-dim)' }}>
          <SplitClock ms={snapshot.displayMs} frozen />
        </span>
        <Sep />
        <span style={{ color: 'var(--halo-away)', fontWeight: 500, flexShrink: 0 }}>Away {formatAway(awayMs)}</span>
      </span>
    );
  }

  /* ── COMPLETE — six seconds, then the stopwatch returns (§7.1). ──────────────────────── */
  if (completeMs != null && completeMs > 0) {
    const minutes = Math.max(1, Math.round(completeMs / 60_000));
    return (
      <span style={style} data-halo-pill-state="complete">
        <Check size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-accent)', flexShrink: 0 }} />
        <Name text={`Focus done ${minutes}m`} />
      </span>
    );
  }

  /* ── SESSION — lock + countdown (+ name, or Paused). ─────────────────────────────────── */
  if (focus && focus.ok && focus.active) {
    const endsAt = typeof focus.endsAt === 'number' ? focus.endsAt : null;
    const startedAt = typeof focus.startedAt === 'number' ? focus.startedAt : null;
    const ms =
      endsAt != null
        ? Math.max(0, endsAt - now)
        : startedAt != null
          ? Math.max(0, now - startedAt)
          : 0;
    const paused = !!focus.paused;
    const final = endsAt != null && endsAt - now <= 60_000;
    return (
      <span style={style} data-halo-pill-state={paused ? 'session-paused' : 'session'}>
        <Lock size={13} strokeWidth={2} aria-hidden="true" style={{ color: paused ? 'var(--halo-dim)' : 'var(--halo-accent)', flexShrink: 0 }} />
        <SplitClock ms={ms} frozen={paused} short={final} />
        <Sep />
        {paused ? (
          <span style={{ color: 'var(--halo-dim)', flexShrink: 0 }}>Paused</span>
        ) : tracked ? (
          <Name text={tracked.label} muted />
        ) : (
          <span style={{ color: 'var(--halo-dim)' }}>Focus</span>
        )}
      </span>
    );
  }

  /* ── BOUND TO A DEADLINE — the title takes the name slot (ruling 2, §7.8). ───────────── */
  if (deadlineTitle) {
    return (
      <span style={style} data-halo-pill-state="bound">
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: 999, background: snapshot.paused ? 'var(--halo-dim)' : 'var(--halo-accent)', flexShrink: 0 }}
        />
        <SplitClock ms={snapshot.displayMs} frozen={snapshot.paused} />
        <Sep />
        <Name
          icon={<CalendarClock size={13} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)', flexShrink: 0 }} />}
          text={deadlineTitle}
          muted={snapshot.paused}
        />
      </span>
    );
  }

  return <>{fallback}</>;
}

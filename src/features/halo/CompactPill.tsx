import { AppWindow, Bot, CalendarDays, Globe, Lock, Mic, SquareTerminal, TriangleAlert } from 'lucide-react';
import type { CSSProperties, ReactElement } from 'react';
import type { NowPayload, StopwatchPayload } from '../../shared/halo/types';

/**
 * CompactPill — the body of the COLLAPSED island.
 *
 * WHY THIS IS A SEPARATE COMPONENT AND NOT A SCALED PAGE BODY
 * ---------------------------------------------------------
 * HALO spec §72, verbatim: "Do not shrink the entire expanded dashboard into compact mode."
 *
 * That is precisely what the island was doing. All four page blocks were guarded only by
 * `tab === '<page>'`, never by `expanded`, so collapsing the island left the Focus/Now/
 * Deadlines/Tools rows mounted inside a 28-40px pill. The user saw this as the panel and a
 * mini-panel appearing together, and as "the contents only show one thing" — a page body
 * squashed into a capsule can only show its first row.
 *
 * §72 then specifies what compact IS, per kind, and `HALO_STATES.html` board 1 draws each one.
 * This renders exactly those, so the pill is glanceable (the §72 requirement) instead of a
 * miniature dashboard (the thing §72 forbids).
 *
 * BOARD 1 LITERALS — the pill is `dot · <i>00:</i>42:18 · divider · name`:
 *   `.pill .time i { color: var(--muted) }`      the hour prefix is dimmed, not the whole clock
 *   `.pill .vd { height: var(--f-body) }`        the divider is BODY-sized, not --vd
 *   `.pill .n { max-width: 140px }`              the name truncates with an ellipsis
 * The divider inherits the pill's own font-size for its height, which is why it is sized here
 * from `fBody` rather than reusing the expanded `--halo-vd` divider (36-52px — taller than the
 * entire pill).
 */

export interface CompactPillProps {
  /** Which board-1 pill to draw. All ten kinds the spec declares. */
  kind?: CompactKind;
  stopwatch: Pick<StopwatchPayload, 'displayMs' | 'displaySource'>;
  now: NowPayload;
  /** Body font-size for this preset; the divider is sized from it. */
  fBody: number;
  /** `dictation` only — true while the mic is actually capturing. */
  listening?: boolean;
  /** `aiUsage` only — 0..1. */
  usageFraction?: number;
  /** `hud` only — the route name. */
  hudLabel?: string;
  /** `hud` only — the count in the mono suffix. */
  hudCount?: number;
  /** `nextDeadline` / `critical` only. */
  deadlineTitle?: string;
  /** `nextDeadline` / `critical` only — e.g. "34d overdue". */
  deadlineDue?: string;
}

/** The ten kinds `HALO_STATES.html` board 1 declares, in the file's own order. */
export type CompactKind =
  | 'stopwatch'
  | 'stopwatchSite'
  | 'now'
  | 'website'
  | 'private'
  | 'dictation'
  | 'aiUsage'
  | 'hud'
  | 'nextDeadline'
  | 'critical';

const DIVIDER = (h: number): CSSProperties => ({
  width: 1,
  height: h,
  background: 'var(--halo-border)',
  flexShrink: 0,
  alignSelf: 'center',
});

export function CompactPill(props: CompactPillProps): ReactElement {
  const {
    kind = 'stopwatch',
    stopwatch,
    now,
    fBody,
    listening = false,
    usageFraction,
    hudLabel = 'penguin-console',
    hudCount,
    deadlineTitle = 'IT DIV Test',
    deadlineDue = '34d overdue',
  } = props;

  /* `width: 100%` + a bounded parent is what makes the name's flex-shrink meaningful: the row
   * can only shrink the name if the row itself has a definite width to shrink WITHIN. Without
   * it the row grows to its content and overflows the pill again. */
  const row: CSSProperties = {
    /* `inline-flex` is board 1's literal `.pill { display:inline-flex }` and it is what a
     * content-sized capsule wants. An earlier pass used `display:flex`, which changed nothing
     * about shrinking — a flex child shrinks against its container's width either way — and broke
     * the board-coverage assertion that pins this literal. The real fix for the overflow is the
     * `minWidth: 0` / `flexShrink` pair below, not the display mode. */
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  };
  const icon = (Ico: typeof Globe, colour = 'var(--halo-muted)'): ReactElement => (
    <span style={{ color: colour, display: 'inline-flex', flexShrink: 0 }}>
      <Ico size={fBody} strokeWidth={2} aria-hidden="true" />
    </span>
  );
  const label = (s: string, colour = 'var(--halo-muted)'): ReactElement => (
    <span style={{ color: colour, fontSize: fBody, whiteSpace: 'nowrap', flexShrink: 0 }}>{s}</span>
  );
  const name = (s: string, colour = 'var(--halo-text)'): ReactElement => (
    <span style={{ ...nameStyle, color: colour }}>{s}</span>
  );
  /* board 1 `.mut` — the dim trailing suffix ("18 min", "6 min", "3"). */
  const mut = (s: string, mono = false): ReactElement => (
    <span
      style={{
        color: 'var(--halo-dim)',
        fontSize: fBody,
        whiteSpace: 'nowrap',
        fontFamily: mono ? 'var(--font-mono, ui-monospace, monospace)' : undefined,
        flexShrink: 0,
      }}
    >
      {s}
    </span>
  );

  /* The clock is the one thing in the pill that must NEVER truncate or wrap — a clipped
   * "00:42:" is worse than no clock. `flexShrink: 0` guarantees the name yields instead. */
  const timeStyle: CSSProperties = {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontWeight: 500,
    fontSize: fBody,
    lineHeight: 1.1,
    color: 'var(--halo-text)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  /* THE NAME FLEXES. IT IS NOT A FIXED 140px.
   *
   * `max-width: 140px` is copied from HALO_STATES board 1's `.pill .n`, where it is a rule
   * about the NAME in isolation — the stylesheet that sizes the pill is a different one, so the
   * two never met. Transcribed literally into one component, a fixed 140px name plus the clock,
   * the divider and the 8px gaps overflowed the measured pill width at EVERY preset:
   *
   *     small   dot6 + 8 + clock39 + 8 + 1 + 8 + 140 = 210px  vs  182px   overflow 40px
   *     medium  dot6 + 8 + clock42 + 8 + 1 + 8 + 140 = 213px  vs  198px   overflow 31px
   *     large   dot6 + 8 + clock49 + 8 + 1 + 8 + 140 = 220px  vs  227px    overflow  9px
   *
   * That is the "the pill is cut off" report: the row was wider than the window shaped to the
   * pill, so the tail of the app name was clipped at the rounded edge.
   *
   * THE FIX IS TO LET THE NAME TAKE WHAT IS LEFT. `min-width: 0` on a flex child is what makes
   * `text-overflow: ellipsis` work at all; without it the child refuses to shrink below its
   * content and simply overflows. 140px stays as the UPPER bound so a long name cannot push the
   * clock off the left, but the name now truncates at the pill's real width instead of at a
   * number that was never measured against it. */
  const nameStyle: CSSProperties = {
    maxWidth: 140,
    minWidth: 0,
    flex: '0 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 500,
    fontSize: fBody,
    color: 'var(--halo-muted)',
  };

  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: 'var(--halo-accent)',
    flexShrink: 0,
  };

  const clock = (): ReactElement => (
    <span style={timeStyle}>
      <i style={{ fontStyle: 'normal', color: 'var(--halo-dim)' }}>
        {Math.floor(stopwatch.displayMs / 3_600_000)}:
      </i>
      {formatMmSs(stopwatch.displayMs)}
    </span>
  );

  /* BOARD 1 — `private`: lock icon + the words "Private window", no time. A private window is
   * deliberately not counted (main suppresses the domain), so showing a clock here would
   * imply time is being attributed to something we cannot see. */
  if (kind === 'private') {
    return (
      <span style={row}>
        {icon(Lock)}
        {name('Private window')}
      </span>
    );
  }

  /* BOARD 1 — `dictation`: ACCENT-coloured mic, the live waveform, then "Listening".
   * The mic wears the accent because this is the only pill where something is actively
   * capturing — HALO_STATES puts the accent on the icon here and nowhere else. */
  if (kind === 'dictation') {
    return (
      <span style={row}>
        {icon(Mic, 'var(--halo-accent)')}
        <PillWave fBody={fBody} live={listening} />
        {label('Listening')}
      </span>
    );
  }

  /* BOARD 1 — `aiUsage`: bot icon, the usage bar at the preset's `--cbar` width, then the
   * percentage. The percentage is `var(--halo-text)` (`.val`), not muted. */
  if (kind === 'aiUsage') {
    const pct = Math.round((usageFraction ?? 0) * 100);
    return (
      <span style={row}>
        {icon(Bot)}
        <span
          aria-hidden="true"
          style={{ height: 4, borderRadius: 999, background: 'var(--halo-tab)', overflow: 'hidden', width: 40 }}
        >
          <span style={{ display: 'block', height: '100%', background: 'var(--halo-accent)', width: `${pct}%` }} />
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontWeight: 500,
            fontSize: fBody,
            color: 'var(--halo-text)',
          }}
        >
          {pct}%
        </span>
      </span>
    );
  }

  /* BOARD 1 — `hud`: terminal icon, the route name, then the count in MONO. */
  if (kind === 'hud') {
    return (
      <span style={row}>
        {icon(SquareTerminal)}
        {name(hudLabel, 'var(--halo-muted)')}
        {hudCount !== undefined && mut(String(hudCount), true)}
      </span>
    );
  }

  /* BOARD 1 — `nextDeadline` / `critical`: identical layout, and the ONLY difference is the
   * icon and its colour — `cal` in muted, `alert` in accent — plus the `crit` pill border the
   * surface draws from `data-kind`. A critical deadline is signalled by the accent, never by
   * restyling the text. */
  if (kind === 'nextDeadline' || kind === 'critical') {
    return (
      <span style={row}>
        {kind === 'critical' ? icon(TriangleAlert, 'var(--halo-accent)') : icon(CalendarDays)}
        {label(deadlineTitle)}
        {name(deadlineDue)}
      </span>
    );
  }

  /* BOARD 1 — `now`: win icon, the app name, then the dim elapsed time. This is the pill that
   * answers "what am I looking at", so it has no clock — the clock belongs to the stopwatch
   * kinds above. */
  if (kind === 'now') {
    return (
      <span style={row}>
        {icon(AppWindow)}
        {name(now.app, 'var(--halo-muted)')}
        {mut(`${Math.floor(now.secondsInApp ?? 0)} min`)}
      </span>
    );
  }

  /* BOARD 1 — `website` / `stopwatchSite`: globe + the domain. `stopwatchSite` adds the running
   * timer, because that kind means "the stopwatch is tracking a website" rather than "a
   * website is in the foreground". */
  if (kind === 'website' || kind === 'stopwatchSite') {
    const domain = now.domain ?? now.app;
    if (kind === 'website') {
      return (
        <span style={row}>
          {icon(Globe)}
          {name(domain, 'var(--halo-muted)')}
          {mut(`${Math.floor(now.secondsInApp ?? 0)} min`)}
        </span>
      );
    }
    return (
      <span style={row}>
        <span style={dotStyle} aria-hidden="true" />
        {clock()}
        <span style={DIVIDER(fBody)} aria-hidden="true" />
        {icon(Globe)}
        {name(domain, 'var(--halo-muted)')}
      </span>
    );
  }

  /* BOARD 1 — `stopwatch`: the default. dot · dimmed hour · mm:ss · divider · app name. */
  return (
    <span style={row}>
      <span
        style={stopwatch.displaySource === 'idle' ? { ...dotStyle, background: 'var(--halo-dim)' } : dotStyle}
        aria-hidden="true"
      />
      {clock()}
      <span style={DIVIDER(fBody)} aria-hidden="true" />
      {name(now.app)}
    </span>
  );
}

/** Board 1's inline waveform: 24 bars, flat at 3px when idle. Same constants as the expanded
 * meter in `DictationActivity`, so the two cannot disagree. */
function PillWave({ fBody, live }: { fBody: number; live: boolean }): ReactElement {
  const N = 24;
  const area = 20;
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: area }}
    >
      {Array.from({ length: N }, (_, i) => {
        const w = 0.5 + 0.5 * Math.sin((i / N) * Math.PI);
        const h = live ? 3 + Math.round(14 * w) : 3;
        return (
          <span
            key={i}
            style={{
              display: 'block',
              width: 2,
              height: h,
              borderRadius: 1,
              background: live ? 'var(--halo-accent)' : 'var(--halo-dim)',
            }}
          />
        );
      })}
    </span>
  );
}

/** `mm:ss`, or `hh:mm:ss` past an hour. Board 1 renders `42:18` with a dimmed `00:` prefix. */
function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `:${String(m).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}
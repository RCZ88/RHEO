/**
 * AmbientCard — the rail + pip renderer for every curated Halo widget.
 *
 * ONE DESIGN IDEA: an activity's COLOUR is its identity, so you know what happened
 * without reading it — and its TYPE SIZE tells you how much it matters. The rail is the
 * expanded form (238x120, title + value + one secondary line); the pip is the compact
 * form (a single icon + a short mono value inside 232x40).
 *
 * THE HONESTY RULE IS THE WHOLE POINT. Every value here is rendered through `value()`,
 * which takes an explicit unknown-sentinel. `undefined` NEVER renders as `0` — it renders
 * the kind's `unknown` sentence from EMPTY_COPY. A plausible-looking number reading as a
 * live measurement is the canonical defect of this surface, so absence is always visible.
 *
 * BACKEND STATUS (RESULT.md §6.2 — traced, not assumed):
 *   real producer      → stopwatch (relay pending), now (tracking-heartbeat), dictation (local)
 *   channels UNWIRED   → aiUsage, hud, focus, nextDeadline, critical, tierBreakdown
 * An unwired channel renders this card's honest empty state. It does NOT invent numbers,
 * and it does NOT hide itself — you can see the feature exists and is waiting.
 */

import { AlertTriangle, CalendarClock, Coffee, Layers, Pin, Sparkles, Target, Terminal } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  EMPTY_COPY,
  surfaceFor,
  ROTATION_FADE_MS,
  type CuratedSurface,
} from '../../shared/halo/slotModel';
import type {
  ActivityKind,
  AfkGapPayload,
  AiUsagePayload,
  CriticalPayload,
  DictationPayload,
  FocusPayload,
  HudPayload,
  IslandActivity,
  NowPayload,
  TierBreakdownPayload,
} from '../../shared/halo/types';

/* ── STATUS COLOUR, NOT IDENTITY ─────────────────────────────────────────────────────
 * RESULT.md §3.3: delete the identity-hue mapping. A kind is IDENTITY; a tier is DATA. The
 * project's own rule is "on a data surface colour means TIER, never identity" — and mapping
 * `aiUsage` to sky and `now` to sage made hue communicate the activity's category instead of
 * anything about its value.
 *
 * This is a REDUCTION, not a new palette. Exactly three outcomes remain, all already declared in
 * halo.css:
 *   accent — something is live / capturing / running right now
 *   signal — something needs attention: overdue, error, warning
 *   muted  — everything else, including a dot for an activity with no compact content
 *
 * The kind is still fully legible: it carries a Lucide icon, a title, and its structure. That is
 * how identity is communicated now, rather than with a fourth hue. */
const STATUS_OF: Partial<Record<ActivityKind, 'accent' | 'signal'>> = {
  dictation: 'accent',
  critical: 'signal',
  nextDeadline: 'signal',
};
const STATUS_COLOUR = {
  accent: 'var(--halo-accent)',
  signal: 'var(--halo-signal)',
  muted: 'var(--halo-dim)',
} as const;

/** The status colour for a kind. Defaults to `muted` — never to a colour chosen by identity. */
function statusColour(kind: ActivityKind): string {
  return STATUS_COLOUR[STATUS_OF[kind] ?? 'muted'];
}

const ICONS: Partial<Record<ActivityKind, LucideIcon>> = {
  stopwatch: undefined,
  now: Target,
  dictation: undefined,
  focus: Target,
  afkGap: Coffee,
  aiUsage: Sparkles,
  hud: Terminal,
  nextDeadline: CalendarClock,
  tierBreakdown: Layers,
  critical: AlertTriangle,
  pinnedActivity: Pin,
};

export const RAIL_TITLE: Partial<Record<ActivityKind, string>> = {
  aiUsage: 'AI TODAY',
  hud: 'CONSOLE',
  nextDeadline: 'NEXT DUE',
  tierBreakdown: 'TIER MIX',
  focus: 'FOCUS',
  afkGap: 'AWAY',
  critical: 'ALERT',
  now: 'NOW',
  pinnedActivity: 'PINNED',
};

/* ── The honesty primitive ──────────────────────────────────────────────────── */

/** Sentinel meaning "the producer said nothing". Distinct from a real 0. */
const UNSET = Symbol('unset');
type Maybe<T> = T | typeof UNSET;

function isSet<T>(v: Maybe<T>): v is T {
  return v !== UNSET && v !== undefined && v !== null;
}

/**
 * Render a value or the honest unknown sentence.
 *
 * @param raw     the producer's value; UNSET/undefined/null means UNKNOWN
 * @param unknown  the literal sentence for this kind, from EMPTY_COPY
 * @param format   formats a KNOWN value only
 */
function value(
  raw: Maybe<unknown>,
  unknown: string,
  format: (v: never) => string,
): { text: string; honest: boolean } {
  if (!isSet(raw)) return { text: unknown, honest: true };
  return { text: format(raw as never), honest: false };
}

function mono(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function compactMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `${h}h` : `${h}h${String(m % 60).padStart(2, '0')}`;
}

function count(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const tierLabel = (t?: string) =>
  t === 'productive' ? 'Productive' : t === 'distracting' ? 'Distracting' : 'Neutral';

/* ── Per-kind value extraction. Each returns UNSET when the producer is silent. ── */

interface Reading {
  /** The primary figure, mono. */
  primary: { text: string; honest: boolean };
  /** One short secondary line, or null when unknown. */
  secondary: string | null;
  /** Compact-pip value; short by necessity. */
  pip: string;
}

function readKind(activity: IslandActivity, unknown: string): Reading {
  const p = activity.payload as never;
  const honestPrimary = { text: unknown, honest: true };
  const pipUnknown = unknown;

  switch (activity.kind) {
    case 'aiUsage': {
      const d = (p ?? {}) as AiUsagePayload;
      const primary = value(d?.tokensToday, unknown, count);
      return {
        primary,
        secondary: isSet(d?.sessionCount) ? `${d.sessionCount} session${d.sessionCount === 1 ? '' : 's'}` : null,
        pip: primary.honest ? pipUnknown : `${primary.text}`,
      };
    }
    case 'hud': {
      const d = (p ?? {}) as HudPayload;
      const primary = value(d?.activeSessions, unknown, count);
      return {
        primary,
        secondary: isSet(d?.commandsToday) ? `${d.commandsToday} commands today` : null,
        pip: primary.honest ? pipUnknown : `${primary.text} live`,
      };
    }
    case 'nextDeadline': {
      const d = (p ?? {}) as { title?: string; dueAt?: string };
      const has = isSet(d?.dueAt);
      const primary = value(d?.dueAt, unknown, (v: string) => {
        const diff = new Date(v).getTime() - Date.now();
        return diff < 0 ? 'overdue' : `in ${compactMs(diff)}`;
      });
      return {
        primary,
        secondary: isSet(d?.title) ? String(d.title) : null,
        pip: primary.honest ? pipUnknown : primary.text.replace('in ', ''),
      };
    }
    case 'focus': {
      const d = (p ?? {}) as FocusPayload;
      const primary = value(d?.remainingMs ?? d?.endsAtMs, unknown, (v: number) =>
        typeof v === 'number' && v < 10_000_000_000 ? mono(v) : mono(Math.max(0, v - Date.now())),
      );
      return {
        primary,
        secondary: isSet(d?.intent) ? String(d.intent) : null,
        pip: primary.honest ? pipUnknown : primary.text,
      };
    }
    case 'afkGap': {
      const d = (p ?? {}) as AfkGapPayload;
      const primary = value(d?.awayMs, unknown, compactMs);
      return {
        primary,
        secondary: isSet(d?.since) ? `since ${new Date(String(d.since)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : null,
        pip: primary.honest ? pipUnknown : primary.text,
      };
    }
    case 'tierBreakdown': {
      const d = (p ?? {}) as TierBreakdownPayload;
      const any = isSet(d?.productiveSeconds) || isSet(d?.neutralSeconds) || isSet(d?.distractingSeconds);
      if (!any) return { primary: honestPrimary, secondary: null, pip: pipUnknown };
      const total = (d.productiveSeconds ?? 0) + (d.neutralSeconds ?? 0) + (d.distractingSeconds ?? 0);
      const pct = total > 0 ? Math.round(((d.productiveSeconds ?? 0) / total) * 100) : 0;
      return {
        primary: { text: `${pct}%`, honest: false },
        secondary: `${compactMs((d.productiveSeconds ?? 0) * 1000)} productive`,
        pip: `${pct}%`,
      };
    }
    case 'critical': {
      const d = (p ?? {}) as CriticalPayload;
      const msg = isSet(d?.message) ? String(d.message) : unknown;
      return {
        primary: { text: msg, honest: !isSet(d?.message) },
        secondary: isSet(d?.source) ? String(d.source) : null,
        pip: 'alert',
      };
    }
    case 'now': {
      const d = (p ?? {}) as NowPayload;
      const has = isSet(d?.app) && d.app !== 'No app detected';
      /* SHOW THE SITE, NOT THE BROWSER. When the user is on a browser, the whole point of
       * the "Now" widget is "what am I looking at right now", which is the SITE, not the
       * browser's process name. `domain` is `null` (not `undefined`) when a browser is
       * focused but the site is unknown (private window, stale extension), and that
       * distinction is load-bearing: null keeps "a browser is focused, site unknown" while
       * undefined means "not a browser at all". Both fall through to the app name here. */
      const shown = has
        ? (isSet(d?.domain) ? String(d.domain) : String(d.app))
        : unknown;
      return {
        primary: { text: shown, honest: !has },
        secondary: has && isSet(d?.category) ? tierLabel(String(d.category)) : null,
        pip: has ? tierLabel(String(d.tier)).slice(0, 4) : pipUnknown,
      };
    }
    case 'dictation': {
      const d = (p ?? {}) as DictationPayload;
      const dur = (d as { durationMs?: number })?.durationMs;
      const primary = value(dur, unknown, mono);
      return { primary, secondary: null, pip: primary.honest ? pipUnknown : primary.text };
    }
    default:
      return { primary: honestPrimary, secondary: null, pip: pipUnknown };
  }
}

/* ── Rail card — the EXPANDED form, 238x120 ───────────────────────────────────── */

export function AmbientCard({
  activity,
  compact = false,
  state = 'populated',
  onDismiss,
  onNavigate,
  onRetry,
}: {
  activity: IslandActivity;
  compact?: boolean;
  /** §7.16/§7.17: loading | error | populated. Default assumes the producer answered. */
  state?: 'loading' | 'error' | 'populated';
  onDismiss?: () => void;
  onNavigate?: (route: string) => void;
  /** Only pass when a VERIFIED data path exists — §7.17 forbids a fake retry handler. */
  onRetry?: () => void;
}) {
  const reduce = useReducedMotion();
  const copy = EMPTY_COPY[activity.kind];
  const unknown = copy?.unknown ?? 'No data';
  const r = readKind(activity, unknown);
  const hue = statusColour(activity.kind);
  const Icon = ICONS[activity.kind];
  const surface: CuratedSurface | null = surfaceFor(activity.kind);
  const title = RAIL_TITLE[activity.kind] ?? (surface ? surface.kind.toUpperCase() : 'ACTIVITY');

  /* §7.17 — the error state is message + Retry, and the Retry may only call an EXISTING
   * verified data path. A widget whose producer is unwired must NOT render a Retry that
   * does nothing, so `onRetry` is passed only when the caller has a real source; without
   * it the card shows the message alone rather than a control that lies. */
  if (state === 'error') {
    return (
      <div
        className="halo-card"
        style={{ width: compact ? undefined : 238, height: compact ? undefined : 120 }}
        data-halo-card={activity.kind}
        data-halo-state="error"
      >
        <div className="flex items-center" style={{ gap: 'var(--halo-gap-tight)', height: 16 }}>
          {Icon ? <Icon size={14} style={{ color: hue }} /> : null}
          <span className="halo-t-eyebrow" style={{ color: 'var(--halo-muted)' }}>{title}</span>
        </div>
        <div className="halo-t-unknown" style={{ color: 'var(--halo-muted)', marginTop: 'var(--halo-gap-tight)' }}>
          {copy?.error ?? 'Data unavailable'}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="self-start focus-visible:outline-none"
            style={{
              marginTop: 'var(--halo-gap-tight)',
              fontSize: 'var(--halo-t-label)',
              color: 'var(--halo-muted)',
              borderBottom: '1px solid var(--halo-hairline)',
            }}
          >
            {copy?.retry ?? 'Retry'}
          </button>
        )}
      </div>
    );
  }

  /* §7.16 — a STATIC skeleton matching the final geometry. No shimmer (the spec is
   * explicit: `animation: none`) and no placeholder NUMBERS, because a fake digit is the
   * one thing that must never appear on this surface. */
  if (state === 'loading') {
    return (
      <div
        className="halo-card"
        style={{ width: compact ? undefined : 238, height: compact ? undefined : 120 }}
        data-halo-card={activity.kind}
        data-halo-state="loading"
      >
        <div className="flex items-center" style={{ gap: 'var(--halo-gap-tight)', height: 16 }}>
          <span style={{ width: 14, height: 14, background: 'var(--halo-track)', borderRadius: 8, display: 'inline-block' }} />
          <span className="halo-t-eyebrow" style={{ color: 'var(--halo-dim)' }}>{title}</span>
        </div>
        <div style={{ width: '58%', height: 13, background: 'var(--halo-track)', borderRadius: 8, marginTop: 'var(--halo-gap-loose)' }} />
        <div style={{ width: '34%', height: 9, background: 'var(--halo-track)', borderRadius: 8, marginTop: 'var(--halo-gap)' }} />
      </div>
    );
  }

  return (
    <motion.div
      layout="position"
      transition={reduce ? { duration: 0 } : { duration: ROTATION_FADE_MS / 1000, ease: 'easeOut' }}
      data-halo-card={activity.kind}
      data-halo-honest={r.primary.honest ? 'true' : 'false'}
      className="flex flex-col justify-between"
      style={{
        width: compact ? undefined : 238,
        height: compact ? undefined : 120,
        padding: 12,
        borderRadius: 12,
        background: 'var(--halo-surface)',
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
      }}
    >
      {/* header: icon + eyebrow title + pin/dismiss */}
      <div className="flex items-center" style={{ height: 16, gap: 'var(--halo-gap-tight)' }}>
        {Icon ? <Icon size={14} style={{ color: hue }} /> : <span style={{ width: 14, height: 14, background: hue, borderRadius: 8, display: 'inline-block' }} />}
        <span className="halo-t-eyebrow" style={{ color: 'var(--halo-muted)' }}>
          {title}
        </span>
        <span className="ml-auto flex items-center" style={{ gap: 'var(--halo-gap-tight)' }}>
          {activity.pinned && <Pin size={12} style={{ color: 'var(--halo-dim)' }} />}
          {onDismiss && (
            <button
              type="button"
              aria-label={`Dismiss ${title.toLowerCase()}`}
              onClick={onDismiss}
              className="focus-visible:outline-none"
              style={{ color: 'var(--halo-dim)', fontSize: 'var(--halo-t-label)', lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </span>
      </div>

      {/* PRIMARY VALUE — the card's reason to exist, so it is the only place a
          `halo-t-value` appears. When the producer is silent the role changes to
          `halo-t-unknown`, which is a DIFFERENT TYPE (sans, 11px, non-tabular) rather
          than the same numerals in a dimmer colour: an unknown must be distinguishable
          from a zero at a glance, and colour alone may not carry that meaning. */}
      <div
        className={r.primary.honest ? 'halo-t-unknown truncate' : 'halo-t-value truncate'}
        style={{ color: r.primary.honest ? 'var(--halo-dim)' : 'var(--halo-text)', marginTop: 'var(--halo-gap-tight)' }}
      >
        {r.primary.text}
      </div>

      {/* secondary — never fabricated */}
      {r.secondary && (
        <div className="halo-t-label truncate" style={{ color: 'var(--halo-muted)', marginTop: 'var(--halo-gap-hair)' }}>
          {r.secondary}
        </div>
      )}

      {/* navigate — only when a producer verified a real route */}
      {surface?.route && onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate(surface.route as string)}
          className="self-start focus-visible:outline-none"
          style={{
            marginTop: 'var(--halo-gap-tight)',
            fontSize: 'var(--halo-t-eyebrow)',
            letterSpacing: 'var(--halo-track-eyebrow)',
            color: 'var(--halo-muted)',
            borderBottom: '1px solid var(--halo-hairline)',
          }}
        >
          Open {surface.route}
        </button>
      )}
    </motion.div>
  );
}

/* ── Pip — the COMPACT form, inside 232x40 ───────────────────────────────────── */

export function AmbientPip({
  activity,
  width,
}: {
  activity: IslandActivity;
  width: number;
}) {
  const copy = EMPTY_COPY[activity.kind];
  const r = readKind(activity, copy?.unknown ?? 'No data');
  const hue = statusColour(activity.kind);
  const Icon = ICONS[activity.kind];

  return (
    <div
      className="flex items-center"
      data-halo-pip={activity.kind}
      data-halo-pip-honest={r.primary.honest ? 'true' : 'false'}
      style={{ width, height: 32, gap: 'var(--halo-gap-tight)', overflow: 'hidden' }}
    >
      {Icon ? <Icon size={13} style={{ color: hue, flexShrink: 0 }} /> : null}
      <span
        className={r.primary.honest ? 'halo-t-unknown truncate' : 'halo-t-value truncate'}
        style={{ color: r.primary.honest ? 'var(--halo-dim)' : 'var(--halo-muted)' }}
      >
        {r.pip}
      </span>
    </div>
  );
}

/** A 4px identity dot for activities with no compact content of their own. */
export function AmbientDot({ kind }: { kind: ActivityKind }) {
  const hue = statusColour(kind);
  return (
    <span
      data-halo-dot={kind}
      style={{ width: 4, height: 4, borderRadius: 9999, background: hue, display: 'inline-block' }}
    />
  );
}
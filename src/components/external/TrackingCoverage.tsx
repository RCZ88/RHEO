import { useCallback, useEffect, useMemo, useState } from 'react';
import { TriangleAlert } from 'lucide-react';

interface Gap { start: string; end: string; durationSeconds: number }
interface Props {
  period?: 'today' | 'week' | 'month';
  minGapMinutes?: number;
  /** Days back from today. 0 = today, 1 = yesterday, ... Must match the
   * timeline the user is actually looking at, or this describes the wrong day. */
  dateOffset?: number;
  onFillNow?: () => void;
}

function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return m === 1 ? '1m' : `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const PERIOD_LABEL: Record<string, string> = { today: 'Today', week: '7 days', month: '30 days' };

/**
 * PAINT · P2 signature-design · L1 Composed · tokens only · ZERO radius, ZERO chrome.
 *
 * THE IDEA — "a gap is a thickening in a hairline."
 *
 * Every previous version of this (progress bar, hero percentage, legend with two
 * swatches) was the same object wearing different clothes: a big calm card that
 * interrupts the top of a dense analytics page to tell you a ratio you could read
 * off a bar. The object itself was the problem, not the styling.
 *
 * So there is no card and no number. The whole period is ONE hairline. Tracked
 * time is the line at 1px; untracked time is where it swells to 4px in the page
 * accent. Coverage is read peripherally, the way you notice a flat spot in a road,
 * and when there is nothing missing the line stays flat and the sentence is the
 * only thing left. It occupies ~30px and cannot interrupt anything.
 *
 * Meaning of the choices:
 *  · Thickness encodes STATE, never identity — one series, two states. Colour
 *    follows, so it is redundant rather than load-bearing (never colour alone).
 *  · No radius and no border: an instrument should not look like a card. LAMINAR
 *    allows 8/12/pill; this deliberately uses none.
 *  · The percentage is demoted to the sentence, trailing the label, because it is
 *    a summary of what the line already showed you.
 *  · "Fill gaps" is a quiet text action, not a filled button — it is offered, not
 *    pushed, because a prompt that interrupts should not also shout.
 *
 * Motion: L1, and in practice NONE. A hairline that fades in adds nothing to a
 * row whose only job is to be peripheral, and the first draft referenced a
 * `fadeIn` keyframe that does not exist in this project — a motion that never ran,
 * disguised by a `motion-safe:` prefix that made it look considered.
 */
export default function TrackingCoverage({ period = 'today', minGapMinutes = 5, onFillNow, dateOffset = 0 }: Props) {
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await (window as any).deskflowAPI?.detectUsageGaps?.({ period, minGapMinutes, dateOffset });
      if (!Array.isArray(res)) throw new Error('malformed');
      setGaps(res); setFailed(false);
    } catch { setFailed(true); }
  }, [period, minGapMinutes, dateOffset]);

  useEffect(() => {
    void load();
    const h = window.setInterval(load, 60_000);
    const onData = () => void load();
    window.addEventListener('external-data-changed', onData);
    return () => { window.clearInterval(h); window.removeEventListener('external-data-changed', onData); };
  }, [load]);

  const m = useMemo(() => {
    if (gaps == null) return null;
    // Same anchor as the main process, or the hairline and the % would
    // describe different days — which is worse than not showing it at all.
    const shiftDays = Number.isFinite(dateOffset) ? Math.trunc(dateOffset) : 0;
    const now = Date.now() - shiftDays * 24 * 60 * 60 * 1000;
    const start = period === 'today'
      ? new Date().setHours(0, 0, 0, 0)
      : now - (period === 'week' ? 7 : 30) * 86_400_000;
    const win = Math.max(1, now - start);

    const rel = gaps
      .map((g) => ({ s: new Date(g.start).getTime(), e: new Date(g.end).getTime() }))
      .filter((x) => Number.isFinite(x.s) && Number.isFinite(x.e) && x.e > start && x.e > x.s);
    // Merge before summing AND before positioning: overlapping rows must not
    // render as overlapping thickenings or inflate the untracked total.
    const merged: { s: number; e: number }[] = [];
    for (const x of rel.sort((a, b) => a.s - b.s)) {
      const last = merged[merged.length - 1];
      if (last && x.s <= last.e) last.e = Math.max(last.e, x.e);
      else merged.push({ s: x.s, e: x.e });
    }
    const missing = merged.reduce((sum, x) => sum + (x.e - x.s), 0);
    const pct = Math.min(100, Math.max(0, (missing / win) * 100));
    return {
      start, win, missingSec: missing / 1000, trackedPct: 100 - pct, count: merged.length,
      blocks: merged.map((x) => ({
        left: ((x.s - start) / win) * 100,
        width: ((x.e - x.s) / win) * 100,
        from: x.s, to: x.e, seconds: (x.e - x.s) / 1000,
      })),
    };
  }, [gaps, period]);

  // ── error: one sentence, one quiet recovery. Nothing else renders. ──────────
  if (failed) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]" role="status">
        <TriangleAlert className="h-3 w-3 shrink-0 text-[var(--color-destructive)]" aria-hidden />
        <span>Coverage unavailable — the tracker did not respond.</span>
        <button onClick={() => void load()}
          className="rounded-sm text-[var(--page-accent)] underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]">
          Retry
        </button>
      </div>
    );
  }

  // ── loading: a flat hairline is the correct skeleton — it is the final shape ──
  if (!m) {
    return (
      <div className="flex items-center gap-3" aria-busy="true" aria-live="polite">
        <span className="h-px flex-1 animate-pulse bg-[var(--color-border-strong)]" />
        <span className="text-[11px] text-[var(--text-faint)]">reading…</span>
      </div>
    );
  }

  const clean = m.count === 0;

  return (
    /* No entry animation. The first draft used `motion-safe:animate-[fadeIn_...]`
       and `fadeIn` is not defined anywhere in the project — a motion that never
       runs. L1 Composed does not want one either: the row appears when its data
       does. The `motion-safe` prefix would have made it look intentional. */
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
        {PERIOD_LABEL[period] ?? 'Coverage'}
      </span>

      {/* THE HAIRLINE. Gaps are thickenings in it. */}
      <div className="relative h-4 min-w-0 flex-1" role="img"
           aria-label={clean
             ? `${PERIOD_LABEL[period] ?? 'This period'} is fully accounted for`
             : `${Math.round(m.trackedPct)} percent accounted for. ${fmtDur(m.missingSec)} untracked across ${m.count} gap${m.count === 1 ? '' : 's'}`}>
        <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[var(--color-border-strong)]" />
        {m.blocks.map((b, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-1 -translate-y-1/2 bg-[var(--page-accent)]"
            style={{ left: `${b.left}%`, width: `${Math.max(b.width, 0.35)}%` }}
            title={`${clock(b.from)} – ${clock(b.to)} · ${fmtDur(b.seconds)} not tracked`}
          />
        ))}
      </div>

      <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-faint)]">
        {clean
          ? 'fully accounted for'
          : <>
              <span className="text-[var(--text-secondary)]">{Math.round(m.trackedPct)}%</span>
              {' · '}
              {fmtDur(m.missingSec)} across {m.count} gap{m.count === 1 ? '' : 's'}
            </>}
      </span>

      {onFillNow && !clean && (
        <button onClick={onFillNow}
          className="shrink-0 rounded-sm text-[11px] font-medium text-[var(--page-accent)]
                     underline decoration-[var(--page-accent)]/40 underline-offset-2
                     hover:decoration-[var(--page-accent)] transition-colors active:scale-[0.98]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]">
          Fill gaps
        </button>
      )}
    </div>
  );
}

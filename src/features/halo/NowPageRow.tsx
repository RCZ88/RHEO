import { memo, type CSSProperties } from 'react';
import { AppWindow, Globe, Lock } from 'lucide-react';
import type { AiUsagePayload, NowPayload } from '../../shared/halo/types';

/**
 * THE NOW PAGE — `agent/docs/halo/HALO_STATES.html` §3, "Now page states".
 *
 * The governing design draws THREE blocks separated by vertical hairlines:
 *   APP  |  WEBSITE  |  AI USAGE
 *
 * `now` was merged into Focus in an earlier cycle and restored on 2026-11-12 when the user
 * asked "why is it that there's only 3 pages on the thing?" and the spec defines FOUR pages
 * with a full state table for Now. The states that table names, mapped to what the real
 * producer (main's foreground heartbeat, `NowPayload`) can honestly report:
 *
 *   ok    → app name + time, website domain            (inBrowser && domain)
 *   nob   → app name + time, "Not in a browser"        (category !== 'Browser')
 *   priv  → app name, "Private window"                 (isPrivate — never a domain)
 *   idle  → "No active app", "Not in a browser"        (heartbeat absent / fixture)
 *   browser with a NULL domain, not private → "Site not identified". The payload docs
 *   call this state out ("unknown !== absent") and the spec has no art for it, so it renders
 *   muted rather than inventing a name.
 *
 * The AI block renders only when the producer delivered a payload — the same honesty rule
 * DictationIsland applies ("an absent producer renders NOTHING rather than a fake ready
 * state"). A zero percentage would be a fabricated measurement.
 *
 * Like every page row, this never exceeds `size.rowHeight`: it is one fixed 56px row, so
 * adding the third block cannot push the tab rail out of the panel.
 */

const EYEBROW: CSSProperties = {
  fontSize: 'var(--halo-t-micro)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--halo-muted)',
  lineHeight: 1,
};

const DIVIDER: CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background: 'var(--halo-hairline)',
  flexShrink: 0,
};

const MUTED = 'var(--halo-muted)';
const TEXT = 'var(--halo-text)';

function fmtDuration(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const min = Math.floor(seconds / 60);
  return `${min} min`;
}

function NameRow({
  icon: Icon,
  name,
  time,
  muted,
}: {
  icon: typeof Globe;
  name: string;
  time: string | null;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center" style={{ gap: 6, minWidth: 0 }}>
      <Icon
        size={13}
        aria-hidden="true"
        style={{ color: muted ? MUTED : 'var(--halo-dim)', flexShrink: 0 }}
      />
      <span
        className="truncate"
        style={{
          fontSize: 'var(--halo-t-label)',
          fontWeight: 500,
          color: muted ? MUTED : TEXT,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </span>
      {time && (
        <span style={{ fontSize: 'var(--halo-t-micro)', color: MUTED, flexShrink: 0 }}>{time}</span>
      )}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 3, minWidth: 0 }}>
      <span style={EYEBROW}>{label}</span>
      {children}
    </div>
  );
}

export interface NowPageRowProps {
  currentApp: NowPayload | null;
  ai: AiUsagePayload | null | undefined;
}

export const NowPageRow = memo(function NowPageRow({ currentApp, ai }: NowPageRowProps) {
  const app = currentApp;
  const appAbsent =
    !app || app.app === 'No app detected' || !app.app || app.app === '—';
  const appTime = appAbsent ? null : fmtDuration(app?.secondsInApp);
  const inBrowser = app?.category === 'Browser';

  /* The Website row, one honest shape per §3's table. Order matters: privacy is tested
   * BEFORE the domain because main withholds the domain for a private window. */
  const website =
    appAbsent || !inBrowser ? (
      <NameRow icon={Globe} name="Not in a browser" time={null} muted />
    ) : app.isPrivate ? (
      <NameRow icon={Lock} name="Private window" time={null} muted />
    ) : app.domain ? (
      <NameRow icon={Globe} name={app.domain} time={null} />
    ) : (
      <NameRow icon={Globe} name="Site not identified" time={null} muted />
    );

  /* `usageFraction` is a REAL 0..1 or undefined (types.ts). Tokens alone show the count
   * without a bar; no payload at all means NO third block, not a zeroed one. */
  const pct =
    ai?.usageFraction !== undefined && Number.isFinite(ai.usageFraction)
      ? Math.round(Math.max(0, Math.min(1, ai.usageFraction)) * 100)
      : null;

  return (
    <div
      data-halo-page="now"
      role="group"
      aria-label="Now"
      className="flex items-center"
      style={{ gap: 'var(--halo-gap-loose)', height: '100%', minWidth: 0 }}
    >
      <Block label="App">
        {appAbsent ? (
          <NameRow icon={AppWindow} name="No active app" time={null} muted />
        ) : (
          <NameRow icon={AppWindow} name={app?.app ?? ''} time={appTime} />
        )}
      </Block>

      <span aria-hidden="true" style={DIVIDER} />

      <Block label="Website">{website}</Block>

      {ai && (
        <>
          <span aria-hidden="true" style={DIVIDER} />
          <Block label="AI usage">
            <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
              <span
                className="font-mono tabular-nums"
                style={{ fontSize: 'var(--halo-t-value)', color: pct === null ? MUTED : TEXT }}
              >
                {pct === null
                  ? ai.tokensToday !== undefined
                    ? `${ai.tokensToday.toLocaleString()} tok`
                    : '—'
                  : `${pct}%`}
              </span>
              {pct !== null && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 64,
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--halo-hairline)',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: 999,
                      background: 'var(--halo-accent-dim)',
                    }}
                  />
                </span>
              )}
            </div>
          </Block>
        </>
      )}
    </div>
  );
});

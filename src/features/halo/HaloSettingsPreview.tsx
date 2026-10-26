/**
 * Halo Settings — the live Preview strip.
 *
 * `HALO_SETTINGS.html` specifies this as "the real island at your size. It updates as you
 * change things. Sample data." It sits between the General and Pages sections and has exactly
 * two modes, `Open` (the expanded panel) and `Pill` (the collapsed 232px capsule), toggled by a
 * `role="group"` labelled "Preview mode".
 *
 * WHY SAMPLE DATA, DELIBERATELY
 * The island is a SEPARATE BrowserWindow; this is the settings page. Rendering the real
 * `OverlayRoot` here would need the island's live IPC snapshot and would fight the running
 * window for the same hover/cursor state. So this renders the island's own PRESENTATION
 * primitives at the user's chosen size with fixed sample values, and says so in the caption.
 * What it shows for real: size, shape, radius, edge, anchor, scale, theme, and the page order.
 * What it does not: live tracking numbers.
 *
 * The values are the ones the spec's own mock uses (`Figma`, `github.com`, `62%`,
 * `IT DIV Test`, `00:42:18`) so the strip matches what Claude drew rather than inventing a
 * second look for the same feature.
 */

import { useMemo, useState } from 'react';
import { Globe, AppWindow, Lock } from 'lucide-react';
import { resolveHaloSize, type HaloPrefs } from './HaloPreferences';
import type { HaloPageId } from './HaloPreferences';
import { CompactPill } from './CompactPill';
import './halo.css';

type PreviewMode = 'open' | 'pill';

/** The spec's own mock data (HALO_SETTINGS.html `pageBody`). */
const SAMPLE = {
  app: 'Figma',
  appMins: 18,
  site: 'github.com',
  siteMins: 6,
  aiPct: 62,
  deadline: 'IT DIV Test',
  clock: '00:42:18',
  productive: '3:12:40',
  /** The values CompactPill reads. 42m18s expressed in ms, matching the printed clock. */
  displayMs: 42 * 60 * 1000 + 18 * 1000,
  now: { app: 'Figma', category: 'design', tier: 'productive' } as const,
} as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--halo-dim)',
        lineHeight: 1,
        whiteSpace: 'pre',
      }}
    >
      {children}
    </span>
  );
}

/** One `nameRow` — icon + name + optional trailing value, per the spec's `nr()`. */
function NameRow({
  icon,
  name,
  trailing,
}: {
  icon: 'win' | 'globe' | 'lock';
  name: string;
  trailing?: string;
}) {
  const Ico = icon === 'globe' ? Globe : icon === 'lock' ? Lock : AppWindow;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <Ico size={13} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--halo-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name}
      </span>
      {trailing ? (
        <span style={{ fontSize: 11, color: 'var(--halo-muted)', marginLeft: 4 }}>{trailing}</span>
      ) : null}
    </span>
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 44, flexShrink: 0, background: 'var(--halo-border)' }}
    />
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  );
}

const Value: React.CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--halo-text)',
};

/** The four page bodies, matching the spec's `pageBody(p)`. */
function PageBody({ page }: { page: HaloPageId }) {
  if (page === 'focus') {
    return (
      <>
        <Block label="Stopwatch">
          <span style={Value}>{SAMPLE.clock}</span>
        </Block>
        <Divider />
        <Block label="Tracking">
          <NameRow icon="win" name={SAMPLE.app} />
        </Block>
        <Divider />
        <Block label="Productive">
          <span style={Value}>{SAMPLE.productive}</span>
        </Block>
      </>
    );
  }
  if (page === 'deadlines') {
    return (
      <>
        <Block label="Next class">
          <span style={Value}>{SAMPLE.deadline}</span>
        </Block>
        <Divider />
        <Block label="Open deadlines">
          <NameRow icon="win" name="Design review" />
        </Block>
      </>
    );
  }
  return (
    <>
      <Block label="Dictation">
        <NameRow icon="win" name="Ready to dictate" />
      </Block>
      <Divider />
      <Block label="Console">
        <span style={Value}>penguin-console, 3 sessions</span>
      </Block>
    </>
  );
}

export function HaloSettingsPreview({
  prefs,
  pages,
}: {
  prefs: HaloPrefs;
  /** The user's page order, so the preview shows the page they actually chose first. */
  pages: HaloPageId[];
}) {
  const [mode, setMode] = useState<PreviewMode>('open');
  const size = useMemo(() => resolveHaloSize(prefs.scale), [prefs.scale]);
  const page: HaloPageId = pages[0] ?? 'focus';

  return (
    <div className="py-2" style={{ opacity: prefs.enabled ? 1 : 0.5 }}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[12px] text-zinc-300">Preview</span>
        <div
          role="group"
          aria-label="Preview mode"
          className="flex gap-1"
          style={{ padding: 2, borderRadius: 8, border: '1px solid var(--halo-border)' }}
        >
          {(['open', 'pill'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                border: 'none',
                background: mode === m ? 'var(--halo-accent)' : 'transparent',
                color: mode === m ? 'var(--halo-on-accent)' : 'var(--halo-muted)',
              }}
            >
              {m === 'open' ? 'Open' : 'Pill'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 mb-2">
        The real island at your size. Updates as you change things. Sample data.
      </p>

      {/* Centered so the island is not stuck to the left edge of a full-width settings row. */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
        <div
          data-halo-preview={mode}
          className="halo-root"
          data-phase={mode === 'open' ? 'expanded' : 'compact'}
          style={{
            position: 'relative',
            pointerEvents: 'auto',
            background: 'var(--halo-surface)',
            border: '1px solid var(--halo-border)',
            boxShadow: 'var(--halo-shadow)',
            /* THE SAME VARIABLE THE LIVE ISLAND WRITES.
             *
             * The island writes `--halo-scale: resolveHaloSize(prefs.scale).typeScale`
             * (OverlayRoot.tsx) — the preset's DESIGNED type scale, 0.85 / 1.0 / 1.2. The preview
             * wrote the raw slider value instead, `String(prefs.scale ?? 1)`. Those coincide only
             * at scale 1: at any other slider position the preview's type is a size that exists in
             * no design, which is a direct cause of "the preview proportions don't match the real
             * thing". One expression, both call sites. */
            ['--halo-scale' as string]: String(size.typeScale),
            width: mode === 'open' ? size.expandedWidth : size.compactWidth,
            height: mode === 'open' ? size.expandedHeight : size.compactHeight,
            maxWidth: '100%',
            borderRadius:
              prefs.shape === 'capsule' ? 9999 : (prefs.radius ?? 12),
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            fontFamily: 'var(--font-sans)',
          } as React.CSSProperties}
        >
          {mode === 'pill' ? (
            /* THE REAL COMPACT PILL, not hand-built markup.
             *
             * This preview used to draw its own approximation — a 6px dot, a hardcoded
             * `fontSize: 13` clock and a `NameRow` — so it showed an approximation of the pill
             * rather than the pill. That is why the preview "didn't match the actual size": a
             * second implementation cannot track the first, and it had already drifted (13px is
             * a value in no design; the spec's `--f-body` is 11/12/14).
             *
             * Rendering the same component the island renders is the only way for this to stay
             * honest: a change to CompactPill changes both at once, by construction. */
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                height: '100%',
                padding: `0 ${size.padding}px`,
                overflow: 'hidden',
              }}
            >
              <CompactPill
                stopwatch={{ displayMs: SAMPLE.displayMs, displaySource: 'productive' }}
                now={SAMPLE.now}
                fBody={size.fBody}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--halo-gap-loose)',
                padding: `0 ${size.padding}px`,
                width: '100%',
                overflow: 'hidden',
              }}
            >
              <PageBody page={page} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
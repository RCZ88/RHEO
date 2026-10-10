/**
 * THE FIGMA `page/focus` ROW — board 2, transcribed node by node.
 *
 * WHY THIS IS A SEPARATE COMPONENT
 * --------------------------------
 * The Focus page previously rendered `StopwatchHeroExpanded` when expanded, which is a large
 * composition: a `ShareRing` donut, a productive/distracting tier bar, a "Tracked" eyebrow and
 * an app-name block. That layout is NOT what the Figma file specifies, and it is the reason
 * the expanded island reads as heavy in a 134px surface: the file's `page/focus` is a single
 * 51px ROW with a 34px time block and two 44px round controls.
 *
 * So this implements the file's row and is used ONLY by the Figma layout. `StopwatchHeroExpanded`
 * is untouched and still serves the legacy layout, so nothing that was working regresses and
 * the two designs can never silently bleed into each other.
 *
 * THE NODE TREE, verbatim (`node-id=9:304`):
 *
 *   page/focus [FRAME] 526x51
 *     Frame 199x51
 *       Frame 199x15
 *         Ellipse 6x6 fill=#6fb38f                              <- live status dot
 *         TEXT 187x15 #71717a JetBrains Mono 400/11 "STOPWATCH   HALO REDESIGN"
 *       time [FRAME] 125x34
 *         TEXT 47x34 #71717a JetBrains Mono 500/26 "00:"         <- hours DIMMED
 *         TEXT 78x34 #fafafa JetBrains Mono 500/26 "42:18"       <- m:ss BRIGHT
 *     Rectangle 1x44 fill=#2e2e33                                <- divider
 *     Frame 68x38
 *       TEXT 37x15 #8b8b94 JetBrains Mono 400/11 "PRODUCTIVE"  <- renamed, see below
 *       TEXT 68x21 #a1a1aa JetBrains Mono 500/16 "3:12:40"
 *     spacer [FRAME] 98x1
 *     Frame 96x44
 *       button/reset 44x44 r=999 stroke=#2e2e33 w=1
 *         icon/reset 16x16  Vector 12x12 stroke=#a1a1aa w=2
 *       button/pause 44x44 r=999 fill=#6fb38f
 *         icon/pause 16x16  Vector 3x11 stroke=#09090b w=2  (x2)
 *
 * TWO DETAILS THAT ARE EASY TO GET WRONG AND WERE:
 *   1. The time is SPLIT and the hours are DIMMED (#71717a), not one uniform bright string.
 *      A single `<span>` of the whole clock loses the file's only use of dimmed type in the
 *      numeral, which is what makes `00:` recede and `42:18` carry the eye.
 *   2. The pause icon is #09090b — DARK ON THE ACCENT. It is the one place in the whole file
 *      where the foreground inverts, because the pause button is the only solid fill.
 */
import { memo } from 'react';
import { AppWindow, Globe, Lock, Pause, Play, RotateCcw } from 'lucide-react';
import { formatStopwatch, type StopwatchSnapshot } from '../../lib/stopwatchStore';

/** The file's literal. The 3-space gap is a designed separator, not a typo — do not collapse it. */
const EYEBROW = 'STOPWATCH   HALO REDESIGN';

export interface FocusPageRowProps {
  snapshot: StopwatchSnapshot;
  /** The tracked time, in ms. `formatStopwatch` is the single clock both surfaces read. */
  productiveMs: number;
  onReset: () => void;
  onTogglePause: () => void;
  /**
   * What the stopwatch is tracking — HALO_STATES.html line 143 specifies THREE shapes:
   *   win  a desktop app    -> "Figma"
   *   web  a browser site   -> "github.com"
   *   priv a private window -> "Private window", with NO name shown
   * The `priv` case is a privacy guarantee, not a label, so this carries no hostname field.
   * Omitted = no reading yet, which renders the honest waiting state.
   */
  tracked?: { kind: 'win' | 'web' | 'priv'; label: string };
}

/** Split `HH:MM:SS` so the hours can be dimmed and `MM:SS` left bright, per board 2. */
function splitClock(ms: number): { dim: string; bright: string } {
  const full = formatStopwatch(ms); // always HH:MM:SS
  const idx = full.indexOf(':');
  return { dim: full.slice(0, idx + 1), bright: full.slice(idx + 1) };
}

const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: 'max(11px, calc(11px * var(--halo-scale, 1)))',
  fontWeight: 400,
  color: 'var(--halo-dim)',
  lineHeight: 1,
  whiteSpace: 'pre',
};

/*
 * PRODUCTIVE, not TODAY. THE LABEL IS A CLAIM AND IT WAS LYING.
 *
 * The number below is `stopwatch.productiveMs` — productive time ONLY. It excludes
 * neutral and distracting time, so labelling it "TODAY" claimed it was a whole-day total
 * when it was a subtotal. Claude's Round 3 ruling: "don't change the behavior. The number
 * is productive time only, so rename the label to PRODUCTIVE."
 *
 * So behaviour is untouched and the label now matches what the number is. Summing all
 * three tiers would make TODAY honest, but that is a behaviour change and was explicitly
 * not authorised. `HALO_STATES.html` line 106 uses `blk('Productive', ...)` and its own
 ** note repeats this.
 */

export const FocusPageRow = memo(function FocusPageRow({
  snapshot,
  productiveMs,
  onReset,
  onTogglePause,
  tracked,
}: FocusPageRowProps) {
  const { dim, bright } = splitClock(productiveMs);
  const paused = snapshot.paused;
  /* The dot is the file's live/recording indicator and it wears the ONLY accent. It tracks
   * the real paused state — a dot that is green while paused would be a lie about data, and
   * RESULT.md §5 forbids exactly that. */
  const live = !paused;

  return (
    <div
      className="flex items-center"
      style={{ gap: 'var(--halo-gap-loose)', width: '100%' }}
      data-halo-focus-row="true"
    >
      {/* ── LEFT GROUP: status dot + eyebrow, then the split clock ────────────── */}
      <div className="flex flex-col justify-center" style={{ minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              flexShrink: 0,
              /* `live` -> the only accent. `paused` -> the dim token, NOT opacity: the file
               * never dims text with alpha and neither do we (handoff §9). */
              background: live ? 'var(--halo-accent)' : 'var(--halo-dim)',
            }}
          />
          <span style={EYEBROW_STYLE}>{EYEBROW}</span>
        </div>
        <div
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 'max(20px, calc(26px * var(--halo-scale, 1)))',
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
          }}
        >
          {/* THE SPLIT. Dimmed hours, bright minutes+seconds. One span cannot do this. */}
          <span style={{ color: 'var(--halo-dim)' }}>{dim}</span>
          <span style={{ color: 'var(--halo-text)' }}>{bright}</span>
        </div>
      </div>

      {/* ── divider: 1x44, #2e2e33 ────────────────────────────────────────────── */}
      <span
        aria-hidden="true"
        style={{ width: 1, height: 44, flexShrink: 0, background: 'var(--halo-border)' }}
      />

      {/* ── TRACKED (HALO_STATES.html line 143) ─────────────────────────────────
          * Three shapes: win + "Figma" / globe + "github.com" / lock + "Private window".
          * A SEPARATE block from Stopwatch and Productive, separated by the same 1x44 divider,
          * because the tracked target is a different question from "how long".
          *
          * STOPPED -> the name turns MUTED, per the same line: "stopped (dot and tracked name
          * turn muted, play button)". The dot already follows `live`; if the name did not, a
          * stopped timer would still advertise a bright active target next to a dim dot. */}
      {tracked && (
        <>
          <span
            aria-hidden="true"
            style={{ width: 1, height: 44, flexShrink: 0, background: 'var(--halo-border)' }}
          />
          <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
            <span style={EYEBROW_STYLE}>TRACKING</span>
            <span className="flex items-center" style={{ gap: 6, minWidth: 0 }}>
              {tracked.kind === 'priv' ? (
                <Lock size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)', flexShrink: 0 }} />
              ) : tracked.kind === 'web' ? (
                <Globe size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)', flexShrink: 0 }} />
              ) : (
                <AppWindow size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)', flexShrink: 0 }} />
              )}
              <span
                className="truncate"
                style={{
                  fontSize: 'max(13px, calc(16px * var(--halo-scale, 1)))',
                  color: live ? 'var(--halo-text)' : 'var(--halo-dim)',
                }}
              >
                {tracked.label}
              </span>
            </span>
          </div>
        </>
      )}

      {/* PRODUCTIVE, not TODAY. The number is productive time ONLY — see the block note above. */}
      <div className="flex flex-col" style={{ gap: 2 }}>
        <span style={EYEBROW_STYLE}>PRODUCTIVE</span>
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            /* file: JetBrains Mono 500/16 for the value; HTML uses --t2 (#a1a1aa) here */
            fontSize: 'max(13px, calc(16px * var(--halo-scale, 1)))',
            fontWeight: 500,
            color: 'var(--halo-muted)',
            lineHeight: 1.15,
          }}
        >
          {formatStopwatch(productiveMs)}
        </span>
      </div>

      {/* spacer — the file's own 98px gap between the readout and the controls */}
      <span aria-hidden="true" className="flex-1" />

      {/* ── button/reset: 44x44 r=999, OUTLINE #2e2e33, icon #a1a1aa ─────────── */}
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        title="Reset timer"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: 'transparent',
          border: '1px solid var(--halo-border)',
          color: 'var(--halo-muted)',
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
      </button>

      {/* ── button/pause: 44x44 r=999, SOLID accent, icon #09090b (dark on accent) ─ */}
      <button
        type="button"
        onClick={onTogglePause}
        aria-label={paused ? 'Resume timer' : 'Pause timer'}
        title={paused ? 'Resume' : 'Pause'}
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          /* the file's only solid fill, and only while live: paused it takes the outline
           * treatment so the state is legible without reading the label. */
          background: paused ? 'transparent' : 'var(--halo-accent)',
          border: paused ? '1px solid var(--halo-border)' : '1px solid transparent',
          /* `--halo-on-accent`, not a hardcoded ink. The glyph sits on the accent FILL, and
           * the fill changes per theme while the glyph did not: dark ink was 8.07:1 on the
           * dark sage accent but only 3.71:1 on the light teal one — a real AA body-text
           * failure that was invisible in the theme the island was designed in. The token is
           * white-on-accent in light and near-black-on-accent in dark. */
          color: paused ? 'var(--halo-muted)' : 'var(--halo-on-accent)',
          cursor: 'pointer',
        }}
      >
        {paused ? (
          <Play size={13} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Pause size={13} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
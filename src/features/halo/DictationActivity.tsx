import { memo, useEffect, useRef } from 'react';
import { AlertCircle, Copy, Mic, MicOff, Save, Square } from 'lucide-react';
import type { DictationPayload } from '../../shared/halo/types';

/**
 * DictationActivity — the island's dictation surface.
 *
 * IT REUSES THE EXISTING DICTATION UI, IT DOES NOT REDESIGN IT
 * ----------------------------------------------------------
 * The visual language is lifted from `src/features/stt/SttPanel.tsx`, which is
 * the dictation surface CZ already approved and already uses: the same 24-bar
 * terracotta waveform, the same 3px bars on a 2px gap, the same 22px-tall block,
 * the same clay-400 centre bars over clay-500 outer bars, the same level hairline
 * beneath, and the same control set (stop-or-mic, save, copy). The colours are
 * read from the `--color-clay-*` tokens that `SttPanel` hardcodes, so both
 * surfaces resolve to the same hue instead of drifting.
 *
 * It is a SEPARATE component rather than a `<SttPanel />` embed for two reasons,
 * both structural rather than stylistic:
 *   1. `SttPanel` is a window ROOT — it renders a full-viewport flex container,
 *      sets its own drag region, and owns its own close/mic buttons. Nesting it
 *      inside the island surface would nest a viewport inside a viewport.
 *   2. `useSttFloat` opens the microphone. Two windows calling it means two
 *      MediaRecorders contending for one device. Exactly one window may own the
 *      mic, so this component is PROP-DRIVEN and opens nothing. That is also why
 *      it takes a level REF instead of a level prop.
 *
 * WHY THE METER IS NOT A PROP
 * ---------------------------
 * HALO §101 forbids React state as the frame clock for a voice meter, and §102
 * prescribes a MotionValue/CSS animation. `level` here arrives on a ref and is
 * written straight to a CSS custom property, so 24 meter samples a second
 * produce ZERO React commits — the owner mutates the ref and this component's
 * effect copies it onto the DOM.
 */

const BAR_COUNT = 24;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_AREA_HEIGHT = 22;
/**
 * The idle bar HEIGHT — HALO_STATES.html line 61/93, verbatim:
 *
 *   `.wave s { display:block; width:2px; ... }` and the generator
 *   `var a = q ? 3 : 3 + Math.round(14 * ...)`  — where `q` means IDLE.
 *
 * So idle is a flat 3px and a live bar is 3 + up to 14 = 17px. The previous implementation
 * expressed idle as `scaleY(max(0.12, level))` against a 22px area, which is 2.64px and, more
 * importantly, is not 3: it is a *proportion* of a variable area, so the idle silhouette
 * changed whenever the area did. A named pixel constant is what the file specifies and it is
 * the only version that cannot drift.
 */
const BAR_IDLE_PX = 3;
/** The live peak: `3 + round(14 * ...)` = 17px at full level. */
const BAR_PEAK_PX = 17;
const CENTRE_FROM = 8;
const CENTRE_TO = 15;

export interface DictationActivityProps {
  payload: DictationPayload | null;
  expanded: boolean;
  /** Mutated by the mic owner. Read on an interval, never through React state. */
  levelRef: React.RefObject<number>;
  onStart: () => void;
  onStop: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onDismissError?: () => void;
}

/** One status line, chosen once. Mirrors SttPanel's precedence exactly. */
function statusLine(payload: DictationPayload): { text: string; tone: 'muted' | 'error' | 'signal' | 'primary'; micBlocked?: boolean } {
  if (payload.state === 'error') {
    // HALO_STATES.html Tools/denied: "Mic blocked. Allow access." — named so the user
    // knows the fix is a permission, not a retry. Any OTHER error stays "Dictation
    // failed", which is the honest generic.
    if (/microphone unavailable|permission|notallowed/i.test(payload.error ?? '')) {
      return { text: 'Mic blocked. Allow access.', tone: 'error', micBlocked: true };
    }
    return { text: 'Dictation failed', tone: 'error' };
  }
  if (payload.state === 'requesting') return { text: 'Opening microphone…', tone: 'muted' };
  if (payload.state === 'processing') return { text: 'Transcribing on-device…', tone: 'muted' };
  if (payload.engineMissing) return { text: 'No on-device engine', tone: 'signal' };
  if (payload.state === 'recording') {
    // `interim` is empty on the faster-whisper path because transcription is
    // batch-on-stop, so the waveform — not the text — carries the recording.
    return { text: payload.interim || 'Listening…', tone: 'primary' };
  }
  if (payload.transcript) return { text: payload.transcript, tone: 'primary' };
  return { text: 'Ready to dictate', tone: 'muted' };
}

const TONE_TOKEN = {
  muted: 'var(--halo-muted)',
  error: 'var(--tier-distracting)',
  signal: 'var(--halo-signal)',
  primary: 'var(--halo-text)',
} as const;

function elapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The waveform. Bars are rendered ONCE and thereafter driven only by the
 * `--halo-level` custom property, so the meter never reconciles.
 */
function Waveform({ levelRef }: { levelRef: React.RefObject<number> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const el = wrapRef.current;
      if (el) el.style.setProperty('--halo-level', String(levelRef.current ?? 0));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      // HALO §143: a meter loop must never outlive its component.
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [levelRef]);

  return (
    <div
      ref={wrapRef}
      className="flex flex-shrink-0 items-end"
      style={{ height: BAR_AREA_HEIGHT, gap: BAR_GAP, '--halo-level': 0 } as React.CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const centre = i >= CENTRE_FROM && i <= CENTRE_TO;
        // scaleY is compositor-only (HALO §139); a height transition on 24 bars
        // would relayout the whole pill on every sample.
        /* The spec's generator, HALO_STATES.html line 93:
         *     var a = q ? 3 : 3 + Math.round(14 * Math.abs(Math.sin(i*.7) * Math.cos(i*.3)));
         * so each bar's LIVE height has its own envelope — it is not 17px for all 24. `weight`
         * reproduces that envelope (a raised cosine over the bar index), and it multiplies the
         * level only. Idle ignores it entirely, which is what makes idle a flat line. */
        const weight = 0.5 + 0.5 * Math.sin((i / BAR_COUNT) * Math.PI);
        return (
          <span
            key={i}
            className="halo-meter-bar"
            style={
              {
width: BAR_WIDTH,
                  height: BAR_AREA_HEIGHT,
                  borderRadius: 9999,
                  backgroundColor: centre ? 'var(--halo-accent)' : 'var(--halo-dim)',
                  opacity: centre ? 0.9 : 0.7,
                  /* Idle is a flat 3px, exactly (HALO_STATES.html line 93). Live bars grow
                   * from that 3px up to 17px — `3 + round(14 * ...)` in the file.
                   *
                   * `--halo-level` is a CSS custom property written by the meter loop, so the
                   * level is NOT readable in JS during render; the mapping has to stay in CSS.
                   * `calc()` maps [0,1] -> [3px,17px] in px and then divides by the 22px area to
                   * get the scale factor. That keeps `scaleY` compositor-only per §139 — no
                   * layout on any of the 24 bars — while making level 0 EXACTLY 3px instead of
                   * the old `max(0.12, ...)`, which was 2.64px and scaled with the area. */
                  transform: `scaleY(calc((${BAR_IDLE_PX}px + ${BAR_PEAK_PX - BAR_IDLE_PX}px * var(--halo-level, 0) * ${weight.toFixed(3)}) / ${BAR_AREA_HEIGHT}px))`,
                  transformOrigin: 'bottom center',
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function LevelHairline({ levelRef }: { levelRef: React.RefObject<number> }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let last = -1;
    const id = setInterval(() => {
      if (cancelled) return;
      const v = levelRef.current ?? 0;
      if (Math.abs(v - last) < 0.01) return;
      last = v;
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, v)})`;
    }, 60);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [levelRef]);

  return (
    <div
      className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full"
      style={{ backgroundColor: 'var(--halo-track)' }}
      aria-hidden="true"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left rounded-full"
        style={{
          backgroundColor: 'var(--halo-accent)',
          opacity: 0.6,
          transform: 'scaleX(0)',
          transition: 'transform 100ms linear',
        }}
      />
    </div>
  );
}

export const DictationActivity = memo(function DictationActivity({
  payload,
  expanded,
  levelRef,
  onStart,
  onStop,
  onSave,
  onCopy,
}: DictationActivityProps) {
  if (!payload) {
    return (
      <div className="flex items-center gap-2 px-3" aria-busy="true" aria-label="Loading dictation">
        <div className="h-3 w-24 rounded" style={{ backgroundColor: 'var(--halo-track)' }} />
      </div>
    );
  }

  const recording = payload.state === 'recording';
  const busy = payload.state === 'requesting' || payload.state === 'processing';
  const status = statusLine(payload);
  const canStart = !busy && !recording && !payload.engineMissing;

  return (
    <div
      className={expanded ? 'flex flex-col gap-2 p-4' : 'flex flex-col px-3 py-2'}
      data-halo-dictation={expanded ? 'expanded' : 'compact'}
      role="group"
      aria-label="Dictation"
    >
      <div className="flex items-center gap-2">
        <Waveform levelRef={levelRef} />

        <div className="h-4 w-px flex-shrink-0" style={{ backgroundColor: 'var(--halo-hairline)' }} />

        {status.tone === 'error' ? (
          <span className="flex min-w-0 flex-1 items-center gap-1 halo-t-label" style={{ color: TONE_TOKEN.error }}>
            <AlertCircle size={12} className="flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{status.text}</span>
          </span>
        ) : (
          <span
            className="min-w-0 flex-1 truncate halo-t-label"
            style={{ color: TONE_TOKEN[status.tone] }}
          >
            {status.text}
          </span>
        )}

        <span
          className="flex-shrink-0 font-mono halo-t-value tabular-nums"
          style={{ color: 'var(--halo-dim)' }}
          aria-hidden="true"
        >
          {recording ? elapsed(payload.elapsedMs) : '0:00'}
        </span>

        <div className="flex flex-shrink-0 items-center gap-1">
          {onCopy && payload.transcript && (
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy transcript"
              className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
              style={{ color: 'var(--halo-muted)' }}
            >
              <Copy size={12} />
            </button>
          )}
          {onSave && payload.transcript && (
            <button
              type="button"
              onClick={onSave}
              aria-label="Save transcript to library"
              className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
              style={{ color: 'var(--halo-muted)' }}
            >
              <Save size={12} />
            </button>
          )}
          {recording ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop dictation"
              className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
              style={{
                color: 'var(--tier-distracting)',
                border: '1px solid var(--tier-distracting)',
              }}
            >
              <Square size={9} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              disabled={!canStart}
              aria-label={status.micBlocked ? 'Retry microphone' : 'Start dictation'}
              className="grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:cursor-not-allowed"
              style={{
                color: canStart ? 'var(--halo-accent)' : 'var(--halo-dim)',
                border: `1px solid ${canStart ? 'var(--halo-dim)' : 'var(--ws-border)'}`,
              }}
            >
              {payload.engineMissing ? <MicOff size={12} /> : <Mic size={12} />}
            </button>
          )}
        </div>
      </div>

      <LevelHairline levelRef={levelRef} />
    </div>
  );
});

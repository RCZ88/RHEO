import { memo } from 'react';
import { AlertCircle, Copy, Mic, MicOff, Save, Square } from 'lucide-react';
import type { DictationPayload } from '../../shared/halo/types';

/**
 * DictationActivity — the island's dictation surface.
 *
 * Rendered in the island's OWN row language (re-skinned 2026-11-12 per
 * `agent/docs/halo/HALO_STATES.html` §5): a 44px hairline round button + name
 * block + hairline divider + mono readout, on halo tokens only. It used to paint
 * its own glass card (`backdrop-blur-xl shadow-xl`, terracotta rgba hexes, a
 * second volume meter) — which is exactly why it read as a bolted-on
 * mini-window floating inside the island rather than island content.
 * No halo-independent styling: one meter (the wave), one accent
 * (`--halo-accent` — its own comment reads "live, recording, active").
 */

const BAR_COUNT = 16;

export interface DictationActivityProps {
  payload: DictationPayload | null;
  expanded: boolean;
  levelRef: React.RefObject<number>;
  onStart: () => void;
  onStop: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onDismissError?: () => void;
}

function statusLine(payload: DictationPayload): { text: string; tone: 'muted' | 'error' | 'primary' } {
  if (payload.state === 'error') {
    if (/microphone unavailable|permission|notallowed/i.test(payload.error ?? '')) {
      return { text: 'Mic blocked. Allow access.', tone: 'error' };
    }
    return { text: payload.error || 'Dictation failed', tone: 'error' };
  }
  if (payload.state === 'requesting') return { text: 'Opening microphone…', tone: 'muted' };
  if (payload.state === 'processing') return { text: 'Transcribing on-device…', tone: 'muted' };
  if (payload.engineMissing) return { text: 'No engine — pip install faster-whisper', tone: 'error' };
  if (payload.state === 'recording') return { text: payload.interim || 'Listening…', tone: 'primary' };
  if (payload.transcript) return { text: payload.transcript, tone: 'primary' };
  return { text: 'Click the mic to dictate', tone: 'muted' };
}

function elapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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
  /* THE ISLAND OWNS THE FRAME — re-skinned 2026-11-12.
   *
   * This widget used to paint its own glass card (`backdrop-blur-xl shadow-xl border`) with a
   * raw coral hex palette and a SECOND volume meter under the wave. That is why it read as a
   * bolted-on floating mini-window instead of island content: LAMINAR bans glassmorphism on
   * chrome, Gate C bans raw hex in a component, and one surface carries ONE meter. It now
   * renders in the island's own row language from `agent/docs/halo/HALO_STATES.html` §5:
   * a 44px hairline round button + a name block + a hairline divider + mono readout, all
   * tokened (`--halo-accent` is the ONE accent — its comment reads "live, recording, active").
   * The compact pill is the board-1 `dictation` kind exactly as designed: icon + wave + label. */
  if (!payload) {
    return (
      <div className="flex items-center gap-2 px-3" aria-busy="true" aria-label="Loading dictation">
        <div className="h-3 w-24 rounded bg-zinc-800" />
      </div>
    );
  }

  const recording = payload.state === 'recording';
  const busy = payload.state === 'requesting' || payload.state === 'processing';
  const status = statusLine(payload);
  const canStart = !busy && !recording && !payload.engineMissing;

  /* The wave IS the meter. One meter per surface — the separate volume bar is gone. */
  const Wave = ({ height }: { height: number }) => (
    <div className="flex items-end gap-[2px] flex-shrink-0" style={{ height }} aria-hidden="true">
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const value = recording ? (levelRef.current ?? 0) * (0.5 + 0.5 * Math.sin((i / BAR_COUNT) * Math.PI)) : 0;
        const h = Math.max(2, Math.round(value * height));
        const opacity = recording ? 0.45 + value * 0.55 : 1;
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-75"
            style={{
              width: 3,
              height: recording ? h : 2,
              backgroundColor: recording ? 'var(--halo-accent)' : 'var(--halo-hairline)',
              opacity,
            }}
          />
        );
      })}
    </div>
  );

  /* COMPACT — board-1 `dictation` pill kind: mic + wave + label, nothing else. */
  if (!expanded) {
    return (
      <div
        className="flex items-center gap-2 px-3"
        data-halo-dictation="compact"
        role="group"
        aria-label="Dictation"
      >
        {payload.engineMissing ? (
          <MicOff style={{ width: 14, height: 14, color: 'var(--halo-muted)', flexShrink: 0 }} />
        ) : recording ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop dictation"
            className="grid place-items-center rounded-full"
            style={{ width: 20, height: 20, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--halo-accent)' }}
            title="Stop"
          >
            <Square className="fill-current" style={{ width: 9, height: 9 }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={canStart ? onStart : undefined}
            disabled={!canStart}
            aria-label="Start dictation"
            className="grid place-items-center rounded-full"
            style={{
              width: 20, height: 20, flexShrink: 0, background: 'none', border: 'none',
              cursor: canStart ? 'pointer' : 'default', color: 'var(--halo-dim)', opacity: canStart ? 1 : 0.45,
            }}
            title="Start dictation"
          >
            <Mic style={{ width: 14, height: 14 }} />
          </button>
        )}
        <Wave height={12} />
        <span
          className="truncate"
          style={{
            fontSize: 12,
            color: status.tone === 'error' ? 'var(--halo-text, var(--halo-muted))' : 'var(--halo-muted)',
          }}
        >
          {status.text}
        </span>
      </div>
    );
  }

  /* EXPANDED — a Tools page row in the island's own language: 44px hairline button,
   * name block, hairline divider, mono readout, ghost actions. No card of its own. */
  return (
    <div
      className="flex items-center gap-3"
      data-halo-dictation="expanded"
      role="group"
      aria-label="Dictation"
    >
      {recording ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop dictation"
          className="grid place-items-center rounded-full transition-colors"
          style={{
            width: 44, height: 44, flexShrink: 0, cursor: 'pointer',
            border: '1px solid var(--halo-accent-dim)',
            color: 'var(--halo-accent)', background: 'none',
          }}
          title="Stop"
        >
          <Square className="fill-current" style={{ width: 12, height: 12 }} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          aria-label={canStart ? 'Start dictation' : 'Dictation unavailable'}
          className="grid place-items-center rounded-full transition-colors"
          style={{
            width: 44, height: 44, flexShrink: 0,
            border: '1px solid var(--halo-hairline)',
            color: payload.state === 'error' ? 'var(--halo-text, var(--halo-muted))' : 'var(--halo-dim)',
            background: 'none',
            cursor: canStart ? 'pointer' : 'not-allowed',
            opacity: canStart ? 1 : 0.45,
          }}
          title={payload.engineMissing ? 'No speech engine available' : 'Start dictation'}
        >
          {payload.engineMissing ? <MicOff style={{ width: 16, height: 16 }} /> : <Mic style={{ width: 16, height: 16 }} />}
        </button>
      )}

      {/* Name block — the same `.blk` language every other island row uses. */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span
          className="uppercase tracking-wide"
          style={{ fontSize: 10, fontWeight: 500, color: 'var(--halo-muted)' }}
        >
          Dictation
        </span>
        <div className="flex items-center gap-2 min-w-0">
          {status.tone === 'error' ? (
            <span className="flex items-center gap-1 min-w-0" style={{ fontSize: 12, color: 'var(--halo-text, var(--halo-muted))' }}>
              <AlertCircle className="flex-shrink-0" style={{ width: 12, height: 12 }} />
              <span className="truncate">{status.text}</span>
            </span>
          ) : (
            <span
              className="truncate"
              style={{
                fontSize: 12, fontStyle: status.tone === 'muted' ? 'italic' : 'normal',
                color: status.tone === 'primary' ? 'var(--halo-text, var(--halo-muted))' : 'var(--halo-muted)',
              }}
            >
              {status.text}
            </span>
          )}
          <Wave height={14} />
        </div>
      </div>

      {/* Hairline divider — board 2 uses these BETWEEN groups, never horizontal. */}
      <div style={{ width: 1, height: 24, background: 'var(--halo-hairline)', flexShrink: 0 }} />

      <span className="font-mono tabular-nums flex-shrink-0" style={{ fontSize: 11, color: 'var(--halo-muted)' }} aria-hidden="true">
        {recording ? elapsed(payload.elapsedMs) : '0:00'}
      </span>

      <div className="flex items-center gap-1 flex-shrink-0">
        {onCopy && payload.transcript && (
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy transcript"
            className="grid place-items-center rounded-full transition-colors"
            style={{ width: 28, height: 28, background: 'none', border: 'none', color: 'var(--halo-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--halo-text, var(--halo-muted))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--halo-muted)'; }}
            title="Copy"
          >
            <Copy style={{ width: 13, height: 13 }} />
          </button>
        )}
        {onSave && payload.transcript && (
          <button
            type="button"
            onClick={onSave}
            aria-label="Save transcript to library"
            className="grid place-items-center rounded-full transition-colors"
            style={{ width: 28, height: 28, background: 'none', border: 'none', color: 'var(--halo-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--halo-text, var(--halo-muted))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--halo-muted)'; }}
            title="Save"
          >
            <Save style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>
    </div>
  );
});

import { memo } from 'react';
import { AlertCircle, Copy, Mic, MicOff, Save, Square } from 'lucide-react';
import type { DictationPayload } from '../../shared/halo/types';

/**
 * DictationActivity — the island's dictation surface.
 *
 * Uses the EXACT same card design as the per-field STT panel in
 * `src/components/VoiceInputWrapper.tsx` — same rounded-xl zinc card, same
 * terracotta waveform bars (rgba(232,134,107) centre, rgba(217,104,70) outer),
 * same w-px divider, same italic interim text, same mic button, same volume bar.
 * No halo tokens, no "reconnecting" logic, no cloud API — it runs on-device
 * via faster-whisper and the UI matches the rest of the app's STT.
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

  return (
    <div
      className={expanded ? 'flex flex-col gap-2 p-4' : 'flex flex-col px-3 py-2'}
      data-halo-dictation={expanded ? 'expanded' : 'compact'}
      role="group"
      aria-label="Dictation"
    >
      <div className="rounded-xl bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-700/50 shadow-xl shadow-black/20 overflow-hidden" style={{ padding: 10 }}>
        <div className="flex items-center gap-2">
          {/* Sound Wave — same as VoiceInputWrapper */}
          <div className="flex-shrink-0 flex items-end gap-[2px]" style={{ height: 22 }} aria-hidden="true">
            {Array.from({ length: BAR_COUNT }, (_, i) => {
              const value = recording ? (levelRef.current ?? 0) * (0.5 + 0.5 * Math.sin((i / BAR_COUNT) * Math.PI)) : 0;
              const h = Math.max(3, Math.round(value * 22));
              const opacity = 0.4 + value * 0.6;
              const isCenter = i >= 4 && i <= 11;
              return (
                <div
                  key={i}
                  className="rounded-full transition-all duration-75"
                  style={{
                    width: 3, height: recording ? h : 3,
                    backgroundColor: isCenter ? `rgba(232,134,107,${opacity})` : `rgba(217,104,70,${opacity * 0.8})`,
                  }}
                />
              );
            })}
          </div>

          <div className="w-px bg-zinc-700/50 flex-shrink-0" style={{ height: 16 }} />

          {/* Interim text — same as VoiceInputWrapper */}
          <div className="flex-1 min-w-0 text-[12px]">
            {status.tone === 'error' ? (
              <div className="flex items-center gap-1 text-red-400" style={{ fontSize: 12 }}>
                <AlertCircle className="flex-shrink-0" style={{ width: 13, height: 13 }} />
                <span className="truncate">{status.text}</span>
              </div>
            ) : (
              <p className={`truncate ${status.tone === 'primary' ? 'text-zinc-300 italic' : 'text-zinc-500 italic'}`} style={{ fontSize: 12 }}>
                {status.text}
              </p>
            )}
          </div>

          {/* Elapsed — stopwatch readout */}
          <span
            className="font-mono text-[11px] tabular-nums flex-shrink-0 text-zinc-500"
            aria-hidden="true"
          >
            {recording ? elapsed(payload.elapsedMs) : '0:00'}
          </span>

          {/* Controls — same as VoiceInputWrapper */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {onCopy && payload.transcript && (
              <button
                type="button"
                onClick={onCopy}
                aria-label="Copy transcript"
                className="grid place-items-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                style={{ width: 22, height: 22 }}
                title="Copy"
              >
                <Copy style={{ width: 12, height: 12 }} />
              </button>
            )}
            {onSave && payload.transcript && (
              <button
                type="button"
                onClick={onSave}
                aria-label="Save transcript to library"
                className="grid place-items-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                style={{ width: 22, height: 22 }}
                title="Save"
              >
                <Save style={{ width: 12, height: 12 }} />
              </button>
            )}
            {recording ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop dictation"
                className="grid place-items-center rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                style={{ width: 24, height: 24 }}
                title="Stop"
              >
                <Square className="fill-current" style={{ width: 9, height: 9 }} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                disabled={!canStart}
                aria-label='Start dictation'
                className={
                  payload.state === 'error'
                    ? 'grid place-items-center rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/40 transition-all duration-150'
                    : 'grid place-items-center rounded-full text-zinc-400 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 hover:text-[#e8866b] hover:ring-[#d96846]/30 transition-all duration-150'
                }
                style={{ width: 24, height: 24 }}
                title="Start dictation"
              >
                {payload.engineMissing ? <MicOff style={{ width: 13, height: 13 }} /> : <Mic style={{ width: 13, height: 13 }} />}
              </button>
            )}
          </div>
        </div>

        {/* Volume bar — same as VoiceInputWrapper */}
        <div className="mt-1.5 rounded-full bg-zinc-800 overflow-hidden" style={{ height: 3 }}>
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${(levelRef.current ?? 0) * 100}%`,
              backgroundColor: '#e8866b',
              opacity: 0.6,
            }}
          />
        </div>
      </div>
    </div>
  );
});

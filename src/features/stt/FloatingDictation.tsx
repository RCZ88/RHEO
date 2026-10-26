import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Check,
  Copy,
  Mic,
  MicOff,
  Save,
  Square,
  X,
} from 'lucide-react';
import { useSttFloat } from '../../hooks/useSttFloat';
import { hideDictation, subscribeDictation } from './dictationStore';
import { getStore } from '../../lib/sttStore';

/**
 * FloatingDictation — a floating speech-to-text widget that lives INSIDE the app.
 *
 * Uses the EXACT same card design as the per-field STT panel in
 * `src/components/VoiceInputWrapper.tsx` — same rounded-xl zinc card, same
 * terracotta waveform bars, same w-px divider, same italic interim text, same
 * mic button with pulse ring, same volume bar.
 *
 * Runs on-device via faster-whisper (no API key, no network, no "reconnecting"
 * logic) and auto-saves + copies on finish.
 */
const CARD_WIDTH = 360;

type Flash =
  | { kind: 'none' }
  | { kind: 'saved+copied' }
  | { kind: 'saved' }
  | { kind: 'copied' }
  | { kind: 'failed'; reason: string };

const POS_KEY = 'df-floating-dictation-pos';

type Pos = { x: number; y: number };

function readPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
    }
  } catch {
    /* ignore */
  }
  return { x: -1, y: -1 };
}

function writePos(p: Pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function elapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function FloatingDictation() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const unsub = subscribeDictation(setVisible);
    return unsub;
  }, []);
  const reduceMotion = useReducedMotion();
  const [flash, setFlash] = useState<Flash>({ kind: 'none' });
  const [pos, setPos] = useState<Pos>(() => readPos());
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinish = useCallback(async (text: string, durationMs: number) => {
    let saved = false;
    let copied = false;
    let reason = '';

    try {
      const store = await getStore();
      const entry = await store.save({
        text,
        createdAt: new Date().toISOString(),
        durationMs,
        category: 'note',
        tags: [],
        isFavorite: false,
        source: 'Floating dictation',
      });
      saved = !!entry?.id;
    } catch (err) {
      reason = err instanceof Error ? err.message : 'Could not save the transcript.';
    }

    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      if (!reason) reason = 'Clipboard is blocked — use the Copy button.';
    }

    setFlash(
      saved && copied
        ? { kind: 'saved+copied' }
        : saved
          ? { kind: 'saved' }
          : copied
            ? { kind: 'copied' }
            : { kind: 'failed', reason: reason || 'Could not save or copy.' },
    );

    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash({ kind: 'none' }), 3200);
  }, []);

  const stt = useSttFloat({ onFinish: handleFinish });

  const recording = stt.state === 'recording';
  const busy = stt.state === 'requesting' || stt.state === 'processing';
  const copyAgain = useCallback(async () => {
    if (!stt.transcript) return;
    try {
      await navigator.clipboard.writeText(stt.transcript);
      setFlash({ kind: 'copied' });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash({ kind: 'none' }), 2000);
    } catch {
      setFlash({ kind: 'failed', reason: 'Clipboard is blocked by the OS.' });
    }
  }, [stt.transcript]);

  const saveAgain = useCallback(async () => {
    if (!stt.transcript) return;
    try {
      const store = await getStore();
      const entry = await store.save({
        text: stt.transcript,
        createdAt: new Date().toISOString(),
        durationMs: stt.elapsed,
        category: 'note',
        tags: [],
        isFavorite: false,
        source: 'Floating dictation',
      });
      setFlash(entry?.id ? { kind: 'saved' } : { kind: 'failed', reason: 'The transcript was not written.' });
    } catch (err) {
      setFlash({ kind: 'failed', reason: err instanceof Error ? err.message : 'Could not save.' });
    }
  }, [stt.elapsed, stt.transcript]);

  const level = recording ? stt.level : 0;
  const engineMissing =
    !stt.engine.detecting &&
    !stt.engine.localAvailable &&
    !stt.engine.apiConfigured &&
    !stt.engine.nativeAvailable;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { active: true, moved: false, sx: e.clientX, sy: e.clientY, ox: pos.x >= 0 ? pos.x : 20, oy: pos.y >= 0 ? pos.y : 20 };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pos.x, pos.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || d.moved) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    d.moved = true;
    const next = {
      x: Math.max(8, Math.min(window.innerWidth - CARD_WIDTH - 8, d.ox + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 120, d.oy + dy)),
    };
    setPos(next);
    writePos(next);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    d.active = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (d.moved) return;
    if (busy) return;
    if (recording) void stt.stop();
    else {
      setFlash({ kind: 'none' });
      void stt.start();
    }
  }, [busy, recording, stt]);

  let text: React.ReactNode;
  if (stt.engine.detecting) {
    text = <span className="text-zinc-500 italic" style={{ fontSize: 12 }}>Looking for on-device engine…</span>;
  } else if (stt.state === 'error' && stt.error) {
    text = (
      <div className="flex items-center gap-1 text-red-400" style={{ fontSize: 12 }}>
        <AlertCircle className="flex-shrink-0" style={{ width: 14, height: 14 }} />
        <span className="truncate">{stt.error}</span>
      </div>
    );
  } else if (flash.kind === 'failed') {
    text = (
      <div className="flex items-center gap-1 text-red-400" style={{ fontSize: 12 }}>
        <AlertCircle className="flex-shrink-0" style={{ width: 14, height: 14 }} />
        <span className="truncate">{flash.reason}</span>
      </div>
    );
  } else if (stt.state === 'requesting') {
    text = <p className="text-zinc-400 italic truncate" style={{ fontSize: 12 }}>Opening microphone…</p>;
  } else if (stt.state === 'processing') {
    text = <p className="text-zinc-400 italic truncate" style={{ fontSize: 12 }}>Transcribing on-device…</p>;
  } else if (engineMissing) {
    text = <p className="text-amber-400/80 italic truncate" style={{ fontSize: 12 }}>No engine — pip install faster-whisper</p>;
  } else if (recording) {
    text = <p className="text-zinc-300 italic truncate" style={{ fontSize: 12 }}>{stt.interim || 'Listening…'}</p>;
  } else if (flash.kind === 'saved+copied' || flash.kind === 'copied') {
    text = <p className="text-emerald-400 truncate" style={{ fontSize: 12 }}>{stt.transcript}</p>;
  } else if (flash.kind === 'saved') {
    text = <p className="text-amber-400/80 truncate" style={{ fontSize: 12 }}>Saved · clipboard blocked</p>;
  } else if (stt.transcript) {
    text = <p className="text-zinc-200 truncate" style={{ fontSize: 12 }}>{stt.transcript}</p>;
  } else {
    text = <p className="text-zinc-500 italic" style={{ fontSize: 12 }}>Click the mic to dictate · drag to move</p>;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    width: CARD_WIDTH,
    cursor: busy ? 'progress' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    ...(pos.x >= 0 ? { left: pos.x, top: pos.y } : { right: 20, bottom: 20 }),
  };

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          key="df-dictation"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          style={style}
          role="region"
          aria-label="Floating speech to text"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div
            className="rounded-xl bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-700/50 shadow-xl shadow-black/20 overflow-hidden"
            style={{ padding: 10 }}
          >
            <div className="flex items-center gap-2">
              {/* Sound Wave — same as VoiceInputWrapper */}
              <div className="flex-shrink-0 flex items-end gap-[2px]" style={{ height: 22 }} aria-hidden="true">
                {Array.from({ length: 16 }, (_, i) => {
                  const value = recording ? level * (0.5 + 0.5 * Math.sin((i / 16) * Math.PI)) : 0;
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

              <div className="flex-1 min-w-0">{text}</div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {stt.transcript && (flash.kind === 'saved+copied' || flash.kind === 'copied') && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void copyAgain(); }}
                    className="grid place-items-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                    style={{ width: 22, height: 22 }}
                    aria-label="Copy transcript again"
                    title="Copy again"
                  >
                    <Copy style={{ width: 12, height: 12 }} />
                  </button>
                )}
                {stt.transcript && flash.kind !== 'copied' && flash.kind !== 'saved+copied' && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void saveAgain(); }}
                    className="grid place-items-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                    style={{ width: 22, height: 22 }}
                    aria-label="Save transcript"
                    title="Save to library"
                  >
                    <Save style={{ width: 12, height: 12 }} />
                  </button>
                )}
                {recording ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void stt.stop(); }}
                    className="grid place-items-center rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                    style={{ width: 24, height: 24 }}
                    aria-label="Stop dictation"
                    title="Stop"
                  >
                    <Square className="fill-current" style={{ width: 9, height: 9 }} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggle(); }}
                    className={
                      stt.state === 'error'
                        ? 'grid place-items-center rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/40 transition-all duration-150'
                        : 'grid place-items-center rounded-full text-zinc-400 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 hover:text-[#e8866b] hover:ring-[#d96846]/30 transition-all duration-150'
                    }
                    style={{ width: 24, height: 24 }}
                    aria-label="Start dictation"
                    title="Start dictation"
                  >
                    {engineMissing ? <MicOff style={{ width: 13, height: 13 }} /> : <Mic style={{ width: 13, height: 13 }} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); hideDictation(); }}
                  className="grid place-items-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                  style={{ width: 22, height: 22 }}
                  aria-label="Hide dictation"
                  title="Hide"
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>

            {/* Volume bar — same as VoiceInputWrapper */}
            <div className="mt-1.5 rounded-full bg-zinc-800 overflow-hidden" style={{ height: 3 }}>
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${(recording ? level : stt.transcript ? 0.12 : 0) * 100}%`,
                  backgroundColor: '#e8866b',
                  opacity: 0.6,
                }}
              />
            </div>

            {/* Confirmations */}
            {flash.kind === 'saved+copied' && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                <Check style={{ width: 10, height: 10 }} />
                <span>Saved to library and copied</span>
              </div>
            )}
            {flash.kind === 'saved' && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400/80">
                <span>Saved · clipboard blocked</span>
              </div>
            )}
            {flash.kind === 'copied' && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                <Check style={{ width: 10, height: 10 }} />
                <span>Copied</span>
              </div>
            )}
            {flash.kind === 'failed' && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400">
                <AlertCircle style={{ width: 10, height: 10 }} />
                <span>{flash.reason}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

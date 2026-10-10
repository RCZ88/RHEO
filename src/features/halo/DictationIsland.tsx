import { useCallback, useEffect, useRef } from 'react';
import { useSttFloat } from '../../hooks/useSttFloat';
import { getStore } from '../../lib/sttStore';
import { DictationActivity } from './DictationActivity';
import type { DictationPayload } from '../../shared/halo/types';

/**
 * DictationIsland — the mic owner for the island.
 *
 * This is the container that makes the island's dictation REAL. It exists as a
 * separate file from `DictationActivity` on purpose:
 *
 *   DictationActivity = PURE. Takes a payload, renders it, opens nothing. That is
 *                       what makes it verifiable in a plain browser with no
 *                       microphone and no Electron.
 *   DictationIsland    = IMPURE. Owns `useSttFloat`, which calls getUserMedia.
 *
 * Keeping them apart means the UI stays testable while the recording stays in one
 * place.
 *
 * WHY EXACTLY ONE OWNER
 * ---------------------
 * `getUserMedia` + `MediaRecorder` on one device from two windows means two
 * MediaRecorders contending for the same mic — the second is muted or throws.
 * `useSttFloat` feeds ONE stream to both the AnalyserNode and the MediaRecorder
 * (useSttFloat.ts:269-272), so it must be instantiated in exactly one window.
 * Historically that window was the standalone dictation panel. If that panel is
 * removed, THIS becomes the sole owner.
 */

export interface DictationIslandProps {
  expanded: boolean;
  /**
   * Lets the shell register a record start/stop toggle. Required because the
   * global Ctrl/Cmd+Shift+R shortcut is handled in the MAIN process (it has to
   * work while another app has focus) and is forwarded to the island, which then
   * has to reach the hook that owns the microphone.
   */
  registerToggle?: (fn: (() => void) | null) => void;
}

export function DictationIsland({ expanded, registerToggle }: DictationIslandProps) {
  const levelRef = useRef(0);

  // Same save path the standalone panel used, so behaviour does not change when
  // ownership moves: persist to the library AND copy to clipboard.
  const handleFinish = useCallback(async (text: string, durationMs: number) => {
    try {
      const store = await getStore();
      await store.save({
        text,
        createdAt: new Date().toISOString(),
        durationMs,
        category: 'note',
        tags: [],
        isFavorite: false,
        source: 'Halo Island',
      });
    } catch {
      /* the copy below still gives the user their words */
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — the transcript is still on screen and saved */
    }
  }, []);

  const stt = useSttFloat({ onFinish: handleFinish });

  // Publish the toggle so the shell can wire the global shortcut to it. Refs are
  // used rather than a callback dep array so the recorder is not torn down and
  // re-created (which would drop an in-flight recording) on every re-render.
  const sttRef = useRef(stt);
  sttRef.current = stt;
  useEffect(() => {
    if (!registerToggle) return;
    registerToggle(() => {
      const cur = sttRef.current;
      if (cur.state === 'requesting' || cur.state === 'processing') return;
      if (cur.state === 'recording') void cur.stop();
      else void cur.start();
    });
    return () => registerToggle(null);
  }, [registerToggle]);

  // The meter is fed by REF, not state: useSttFloat publishes `level` at
  // METER_FPS (24/s) and routing that through React state would be 24 commits a
  // second for a decorative bar (HALO §101/§102).
  const level = stt.state === 'recording' ? stt.level : 0;
  if (levelRef.current !== level) levelRef.current = level;

  const engineMissing =
    !stt.engine.detecting &&
    !stt.engine.localAvailable &&
    !stt.engine.apiConfigured &&
    !stt.engine.nativeAvailable;

  const payload: DictationPayload = {
    state: stt.state,
    level,
    elapsedMs: stt.elapsed,
    interim: stt.interim,
    transcript: stt.transcript,
    engineLabel: stt.engine.label,
    engineMissing,
    error: stt.error,
  };

  return (
    <DictationActivity
      payload={payload}
      expanded={expanded}
      levelRef={levelRef}
      onStart={() => {
        void stt.start();
      }}
      onStop={() => {
        void stt.stop();
      }}
    />
  );
}
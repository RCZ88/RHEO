/**
 * VoiceFloatingPanel — Floating voice input panel
 * Anchored below the active input. Glass morphism, sound wave, controls.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Square, Delete, AlertCircle } from 'lucide-react';
import { SoundWaveVisualizer } from './SoundWaveVisualizer';
import { formatTimer } from '../lib/voice-utils';
import type { VoiceState, VoiceError } from '../hooks/useVoiceInput';

interface VoiceFloatingPanelProps {
  state: VoiceState;
  interim: string;
  bars: number[];
  volume: number;
  audioActive: boolean;
  countdownMs: number;
  error?: VoiceError;
  sentencesCount: number;
  onStop: () => void;
  onBackspace: () => void;
  position?: 'below' | 'above';
}

const errorMessages: Record<VoiceError, string> = {
  'no-permission': 'Microphone access denied',
  'no-speech': 'No speech detected',
  'aborted': 'Voice input stopped',
  'unknown': 'Voice recognition error',
};

export function VoiceFloatingPanel({
  state,
  interim,
  bars,
  volume,
  audioActive,
  countdownMs,
  error,
  sentencesCount,
  onStop,
  onBackspace,
  position = 'below',
}: VoiceFloatingPanelProps) {
  const isListening = state === 'listening';
  const isError = state === 'error';
  const isNearEnd = countdownMs < 1500; // < 30% of 5s

  return (
    <AnimatePresence>
      {(isListening || isError) && (
        <motion.div
          initial={{ opacity: 0, y: position === 'below' ? 8 : -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: position === 'below' ? 8 : -8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className={`
            absolute ${position === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'} left-0 right-0 z-50
            min-w-[320px] max-w-[600px] mx-auto
          `}
          role="dialog"
          aria-label="Voice input panel"
        >
          <div
            className={`
              rounded-xl p-3
              bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl
              border border-zinc-700/50
              shadow-xl shadow-black/20
              ${isError ? 'border-red-500/30' : ''}
            `}
          >
            {/* Main row: wave + text + controls */}
            <div className="flex items-center gap-3">
              {/* Sound wave */}
              <div className="flex-shrink-0">
                <SoundWaveVisualizer
                  bars={bars}
                  volume={volume}
                  active={audioActive}
                />
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-zinc-700/50 flex-shrink-0" />

              {/* Interim text or placeholder */}
              <div className="flex-1 min-w-0">
                {isError ? (
                  <div className="flex items-center gap-1.5 text-red-400 text-sm">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{error ? errorMessages[error] : 'Error'}</span>
                  </div>
                ) : interim ? (
                  <motion.p
                    key={interim}
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-zinc-300 italic truncate"
                    role="status"
                    aria-live="polite"
                  >
                    {interim}
                  </motion.p>
                ) : (
                  <p className="text-sm text-zinc-500 italic">Listening…</p>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Backspace */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onBackspace}
                  disabled={sentencesCount === 0}
                  className={`
                    grid place-items-center rounded-md w-7 h-7
                    transition-colors
                    ${sentencesCount === 0
                      ? 'text-zinc-600 cursor-not-allowed'
                      : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-700/60'
                    }
                  `}
                  aria-label="Remove last sentence"
                  title="Remove last sentence"
                >
                  <Delete className="h-3.5 w-3.5" />
                </motion.button>

                {/* Stop button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onStop}
                  className="grid place-items-center rounded-full w-7 h-7 bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                  aria-label="Stop voice input"
                  title="Stop voice input"
                >
                  <Square className="h-3 w-3 fill-current" />
                </motion.button>
              </div>

              {/* Timer */}
              <div className={`
                font-mono text-xs flex-shrink-0 tabular-nums
                ${isNearEnd ? 'text-amber-400' : 'text-zinc-500'}
              `}>
                {formatTimer(countdownMs)}
              </div>
            </div>

            {/* Volume meter bar */}
            <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[#e8866b]/60"
                animate={{ width: `${volume * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

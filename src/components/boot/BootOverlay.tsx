import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BOOT_TIMINGS as T, getSplashApi, type BootAnimationConfig } from './bootTimings';
import '../../styles/boot.css';

const TICK_COUNT = 24;
const NUMERALS = ['00', '06', '12', '18', '24'] as const;
const STATUS_LINES = [
  'opening ledger',
  'aligning meridian',
  'restoring sessions',
  'waking surfaces',
] as const;

const EASE_EXPO = [0.19, 1, 0.22, 1] as const;

export interface BootOverlayProps {
  config: BootAnimationConfig;
  onDone: () => void;
}

export function BootOverlay({ config, onDone }: BootOverlayProps) {
  const reduced = useReducedMotion();
  const warm = config.warmStart;

  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const readyRef = useRef(document.documentElement.dataset.bootReady === 'true');
  const exitingRef = useRef(false);

  useEffect(() => {
    const onReady = () => { readyRef.current = true; };
    window.addEventListener('rheo:boot-ready', onReady);
    return () => window.removeEventListener('rheo:boot-ready', onReady);
  }, []);

  useEffect(() => {
    const api = getSplashApi();
    api?.onReplay(() => {
      readyRef.current = false;
      exitingRef.current = false;
      setProgress(0);
      setStatusIdx(0);
      setPhase('enter');
      setRunId(r => r + 1);
    });
  }, []);

  useEffect(() => {
    if (warm) return;
    const id = window.setInterval(
      () => setStatusIdx(i => Math.min(i + 1, STATUS_LINES.length - 1)),
      T.STATUS_ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [warm]);

  useEffect(() => {
    const id = window.setTimeout(
      () => setProgress(72),
      warm ? 200 : T.SWEEP_AT + T.SWEEP_DUR,
    );
    return () => window.clearTimeout(id);
  }, [warm, runId]);

  useEffect(() => {
    let raf = 0;
    let exitTimer = 0;
    const tick = () => {
      if (!exitingRef.current && (readyRef.current || document.documentElement.dataset.bootReady === 'true')) {
        exitingRef.current = true;
        setProgress(100);
        void getSplashApi()?.sendComplete().catch(() => {});
        setPhase('exit');
        exitTimer = window.setTimeout(onDone, reduced ? 0 : 150);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(exitTimer); };
  }, [onDone, reduced, runId]);

  return (
    <motion.div
      className="boot-overlay"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: reduced ? 0 : 0.15, ease: 'easeOut' }}
      data-warm={warm || undefined}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <motion.section
        key={runId}
        className="boot-glass"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: T.CARD_IN / 1000, ease: EASE_EXPO }}
      >
        <header className="boot-head">
          <motion.span
            className="boot-wordmark"
            initial={{ opacity: 0, letterSpacing: '0.42em' }}
            animate={{ opacity: 1, letterSpacing: '0.30em' }}
            transition={{
              delay: warm ? 0 : T.SWEEP_AT / 1000 + 0.15,
              duration: 0.55,
              ease: EASE_EXPO,
            }}
          >
            RHEO
          </motion.span>
          <AnimatePresence mode="wait">
            <motion.span
              key={warm ? 'warm' : statusIdx}
              className="boot-status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {warm ? 'resuming session…' : `${STATUS_LINES[statusIdx]}…`}
            </motion.span>
          </AnimatePresence>
        </header>

        {!warm && (
          <div className="boot-ruler" aria-hidden="true">
            <div className="boot-ticks">
              {Array.from({ length: TICK_COUNT }, (_, i) => (
                <motion.span
                  key={i}
                  className={`boot-tick${i === 12 ? ' boot-tick--now' : ''}`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{
                    delay: (T.TICKS_AT + i * T.TICK_STAGGER) / 1000,
                    duration: T.TICK_DUR / 1000,
                    ease: EASE_EXPO,
                  }}
                />
              ))}
            </div>
            {!reduced && (
              <motion.span
                className="boot-sweep"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ delay: T.SWEEP_AT / 1000, duration: T.SWEEP_DUR / 1000, ease: EASE_EXPO }}
              />
            )}
            <div className="boot-numerals">
              {NUMERALS.map((n) => (
                <motion.span
                  key={n}
                  className="boot-numeral"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{
                    delay: (T.NUMERALS_AT + NUMERALS.indexOf(n) * T.NUMERAL_STAGGER) / 1000,
                    duration: T.NUMERAL_DUR / 1000,
                    ease: EASE_EXPO,
                  }}
                >
                  {n}
                </motion.span>
              ))}
            </div>
          </div>
        )}

        <div className="boot-progress" aria-hidden="true">
          <motion.span
            className="boot-progress-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: progress === 100 ? 0.45 : 1.2, ease: EASE_EXPO }}
          />
        </div>
      </motion.section>
    </motion.div>
  );
}

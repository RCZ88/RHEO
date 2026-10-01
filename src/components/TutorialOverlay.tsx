import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Check, ChevronDown } from 'lucide-react';
import type { TutorialStep } from '../data/tutorial-steps';
import { useTutorialContext } from '../contexts/TutorialContext';

const SPOTLIGHT_PAD = 16;
const SPOTLIGHT_MIN = 80;

// How long we keep hunting for a step's DOM target before admitting it is gone.
// Kept short on purpose: a target that existed when the step was authored but has
// been deleted by a refactor will NEVER appear, and sitting on a fake "found" state
// (progress bar + pulsing ring) for 4.5s before flipping is worse than telling the
// truth quickly. 1.2s is still plenty for a lazily-mounted target to arrive.
const TARGET_RETRY_INTERVAL = 150;
const TARGET_MAX_RETRIES = 8;

function getCardStyle(rect: DOMRect | null, position: string): React.CSSProperties {
  if (!rect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
  const gap = 16;
  const cardWidth = 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  switch (position) {
    case 'top':
      return { bottom: vh - rect.top + gap, left: Math.max(16, Math.min(rect.left + rect.width / 2 - cardWidth / 2, vw - cardWidth - 16)) };
    case 'bottom':
      return { top: rect.bottom + gap, left: Math.max(16, Math.min(rect.left + rect.width / 2 - cardWidth / 2, vw - cardWidth - 16)) };
    case 'left':
      return { top: Math.max(16, Math.min(rect.top + rect.height / 2 - 80, vh - 176)), right: vw - rect.left + gap };
    case 'right':
      return { top: Math.max(16, Math.min(rect.top + rect.height / 2 - 80, vh - 176)), left: rect.right + gap };
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

function getSpotlightRect(step: TutorialStep | null): DOMRect | null {
  if (!step) return null;
  try {
    const el = document.querySelector(step.target);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height, SPOTLIGHT_MIN) + SPOTLIGHT_PAD * 2;
    return new DOMRect(
      rect.left + rect.width / 2 - size / 2,
      rect.top + rect.height / 2 - size / 2,
      size,
      size
    );
  } catch {
    return null;
  }
}

export default function TutorialOverlay() {
  const {
    isVisible, currentStep: step, stepIndex, totalSteps,
    activeFeatureName, nextStep, prevStep, closeTutorial,
    steps, activeFeatureId,
  } = useTutorialContext();

  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [targetFound, setTargetFound] = useState(true);
  const hoveredRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotSize = spotlightRect ? spotlightRect.width : 300;

  const updatePosition = useCallback(() => {
    const rect = getSpotlightRect(step);
    setSpotlightRect(rect);
    setTargetFound(!!rect);
  }, [step]);

  useEffect(() => {
    if (!isVisible || !step) return;
    // Optimistic reset: assume the target is missing until proven otherwise, so a
    // step that can never resolve never renders a lie for even one frame.
    setSpotlightRect(null);
    setTargetFound(false);
    updatePosition();
    const handleScroll = () => requestAnimationFrame(updatePosition);
    const handleResize = () => requestAnimationFrame(updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let retryCount = 0;

    const tryObserve = () => {
      if (step.target) {
        const el = document.querySelector(step.target);
        if (el) {
          observer = new ResizeObserver(handleScroll);
          observer.observe(el);
          return true;
        }
      }
      return false;
    };

    if (!tryObserve()) {
      retryTimer = setInterval(() => {
        retryCount++;
        const rect = getSpotlightRect(step);
        if (rect) {
          setSpotlightRect(rect);
          setTargetFound(true);
          tryObserve();
          if (retryTimer) clearInterval(retryTimer);
        } else if (retryCount >= TARGET_MAX_RETRIES) {
          if (retryTimer) clearInterval(retryTimer);
          setSpotlightRect(null);
          setTargetFound(false);
        }
      }, TARGET_RETRY_INTERVAL);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [isVisible, step, updatePosition]);

  const isAction = step?.type === 'action';

  useEffect(() => {
    if (!isVisible || !isAction || !step || !targetFound) return;
    const handler = (e: MouseEvent) => {
      const target = e.target;
      // e.target is not always an Element (it can be the document, or a text node),
      // and Element.closest() does not exist on those — calling it blindly throws.
      if (!(target instanceof Element)) return;
      if (target.closest(step.target)) {
        nextStep();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isVisible, isAction, step, nextStep, targetFound]);

  useEffect(() => {
    console.log('[TutorialOverlay] Spotlight effect:', {
      isVisible,
      step: step?.title,
      target: step?.target,
      spotlightRect: spotlightRect ? {
        left: spotlightRect.left,
        top: spotlightRect.top,
        width: spotlightRect.width,
        height: spotlightRect.height,
      } : null,
      spotSize,
      isAction,
    });
  }, [isVisible, step, spotlightRect, spotSize, isAction]);

  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeTutorial();
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        nextStep();
      }
      if (e.key === 'ArrowLeft') {
        prevStep();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isVisible, closeTutorial, nextStep, prevStep]);

  useEffect(() => {
    // Auto-advance when this step can carry itself. An `action` step normally waits for
    // a real click on its target — but if the target does not exist there is nothing to
    // click, so it would otherwise sit on screen forever. Fall back to timed advance.
    const canAutoAdvance = !isAction || !targetFound;
    if (!isVisible || !step || !canAutoAdvance) return;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => {
      if (!hoveredRef.current) nextStep();
    }, 5000);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [isVisible, step, isAction, nextStep, targetFound]);

  const isLastStep = stepIndex === totalSteps - 1;
  const cardStyle = getCardStyle(spotlightRect, step?.position || 'center');

  return (
    <AnimatePresence>
      {isVisible && step && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100]"
        >
          {spotlightRect ? (
            <>
              <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
                style={{
                  maskImage: `radial-gradient(circle ${spotSize / 2}px at ${spotlightRect.left + spotSize / 2}px ${spotlightRect.top + spotSize / 2}px, transparent 0px, black ${spotSize / 2 + 4}px)`,
                  WebkitMaskImage: `radial-gradient(circle ${spotSize / 2}px at ${spotlightRect.left + spotSize / 2}px ${spotlightRect.top + spotSize / 2}px, transparent 0px, black ${spotSize / 2 + 4}px)`,
                  maskComposite: 'exclude',
                  WebkitMaskComposite: 'exclude',
                }}
              />
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="fixed rounded-full border-2 border-amber-400/80 bg-amber-400/[0.12]"
                style={{
                  width: spotSize,
                  height: spotSize,
                  left: spotlightRect.left,
                  top: spotlightRect.top,
                  boxShadow: `0 0 0 1px rgba(251,191,36,0.2), 0 0 40px 12px rgba(251,191,36,0.25)`,
                  pointerEvents: 'none',
                }}
              >
                {isAction && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-amber-400/60"
                    animate={{ scale: [1, 1.08, 1], opacity: [0.8, 0.3, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </motion.div>
            </>
          ) : (
            // No target: dim rather than black out. A full black/70 + blur scrim makes
            // the app look crashed, and hides the very page the user is meant to be
            // looking at while reading the instruction. With nothing to spotlight we
            // just want the page legible and the card readable.
            <div className="fixed inset-0 bg-black/45 pointer-events-none" />
          )}

          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed w-[320px] z-[101]"
            style={cardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-zinc-800/95 backdrop-blur-xl rounded-xl border border-zinc-700/80 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="min-w-0">
                  <div className="text-[9px] text-amber-400 uppercase tracking-[0.12em] font-semibold">
                    {activeFeatureName}
                  </div>
                  <h3 className="text-sm font-semibold text-white mt-0.5 truncate pr-2">{step.title}</h3>
                </div>
                <button onClick={closeTutorial}
                  className="shrink-0 p-1 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 pb-2">
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">
                  {step.instruction}
                  {isAction && targetFound && !step.instruction.includes('• Click') && !step.instruction.includes('• Tap') && (
                    <span className="block mt-1.5 text-amber-400/80 font-medium">Click the highlighted element to continue</span>
                  )}
                  {isAction && !targetFound && (
                    <span className="block mt-1.5 text-zinc-500 font-medium">
                      This step's highlight is missing from the page — read the note, then continue
                    </span>
                  )}
                </p>
              </div>

{(!isAction || !targetFound) && (
                  <div className="px-4 pb-1.5">
                    <div className="h-0.5 bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 5, ease: 'linear' }}
                        className="h-full bg-amber-400/60 rounded-full"
                      />
                    </div>
                  </div>
                )}

              <div className="px-4 pb-2.5 flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === stepIndex ? 'w-4 bg-amber-400'
                        : i < stepIndex ? 'w-1.5 bg-emerald-500' : 'w-1.5 bg-zinc-700'
                    }`} />
                ))}
                <span className="text-[9px] text-zinc-600 ml-1.5 font-medium">{stepIndex + 1}/{totalSteps}</span>
              </div>

              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 border-t border-zinc-700/50">
                <button onClick={prevStep} disabled={stepIndex === 0}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40 transition-colors disabled:opacity-30 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>
                {isLastStep ? (
                  <button onClick={nextStep}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-medium text-white transition-colors flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Done
                  </button>
                ) : (
                  <button onClick={nextStep}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-[11px] font-medium text-white transition-colors flex items-center gap-1">
                    {isAction ? 'Skip' : 'Next'}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

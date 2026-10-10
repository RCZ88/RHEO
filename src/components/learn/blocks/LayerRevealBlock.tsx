import React, { useState, useCallback } from 'react';

interface RevealStep {
  id: string;
  label: string;
  content: string;
  hint?: string;
  mastery_unlock?: string;
}

interface Props {
  meta: {
    title: string;
    steps: RevealStep[];
    reveal_mode: 'sequential' | 'free' | 'mastery_gated';
    default_unlocked?: number;
    allow_backtrack?: boolean;
  };
  currentMastery?: string;
}

export function LayerRevealBlock({ meta, currentMastery = 'L0' }: Props) {
  const { title, steps, reveal_mode, default_unlocked = 1, allow_backtrack = true } = meta;
  const [unlockedSteps, setUnlockedSteps] = useState<number>(default_unlocked);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const isStepUnlocked = useCallback((index: number) => {
    if (reveal_mode === 'free') return true;
    if (reveal_mode === 'mastery_gated') {
      const stepMastery = steps[index]?.mastery_unlock || 'L0';
      const levels = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
      return levels.indexOf(currentMastery) >= levels.indexOf(stepMastery);
    }
    return index < unlockedSteps;
  }, [reveal_mode, unlockedSteps, currentMastery, steps]);

  const handleStepClick = useCallback((index: number) => {
    if (!isStepUnlocked(index)) return;
    setActiveStep(index);
    setCompletedSteps(prev => new Set(prev).add(index));
  }, [isStepUnlocked]);

  const handleNext = useCallback(() => {
    if (activeStep < steps.length - 1) {
      const next = activeStep + 1;
      setActiveStep(next);
      setUnlockedSteps(prev => Math.max(prev, next + 1));
      setCompletedSteps(prev => new Set(prev).add(next));
    }
  }, [activeStep, steps.length]);

  const handlePrev = useCallback(() => {
    if (allow_backtrack && activeStep > 0) setActiveStep(activeStep - 1);
  }, [allow_backtrack, activeStep]);

  const handleRevealAll = useCallback(() => {
    setUnlockedSteps(steps.length);
    setActiveStep(steps.length - 1);
    setCompletedSteps(new Set(steps.map((_, i) => i)));
  }, [steps.length]);

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div>
          <h3 className="text-base font-medium text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-500 mt-1" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            Step {activeStep + 1} of {steps.length}
            {reveal_mode === 'mastery_gated' && ` • Requires ${currentMastery}`}
          </p>
        </div>
        <button
          onClick={handleRevealAll}
          className="text-xs px-3 py-1.5 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
        >
          Reveal all
        </button>
      </div>

      {/* Step Indicators */}
      <div className="flex gap-1 px-5 py-3 border-b border-zinc-800 overflow-x-auto">
        {steps.map((step, i) => {
          const unlocked = isStepUnlocked(i);
          const completed = completedSteps.has(i);
          const isActive = i === activeStep;
          return (
            <button
              key={step.id}
              onClick={() => handleStepClick(i)}
              disabled={!unlocked}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                borderColor: isActive ? '#d97706' : completed ? 'rgba(34,197,94,0.3)' : '#292524',
                background: isActive ? 'rgba(217,119,6,0.08)' : completed ? 'rgba(34,197,94,0.06)' : 'transparent',
                color: unlocked ? '#f5f5f4' : '#52525b',
                opacity: unlocked ? 1 : 0.5,
                cursor: unlocked ? 'pointer' : 'not-allowed',
              }}
            >
              <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
                completed ? 'bg-emerald-500 text-zinc-950' : isActive ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {completed ? '✓' : i + 1}
              </span>
              {step.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-5 py-6 min-h-[200px]">
        {steps.map((step, i) => {
          const isVisible = i <= activeStep;
          const isLocked = !isStepUnlocked(i);
          if (isLocked) {
            return (
              <div key={step.id} className={`${i === activeStep ? 'flex' : 'hidden'} items-center justify-center py-10 text-zinc-600 text-sm`}>
                <div className="text-center">
                  <div className="text-2xl mb-2">🔒</div>
                  <div>Unlocks at {step.mastery_unlock || 'L0'}</div>
                  <div className="text-xs mt-1 text-zinc-700">Continue studying to reveal</div>
                </div>
              </div>
            );
          }
          return (
            <div
              key={step.id}
              className={`${isVisible ? 'block' : 'hidden'} ${i < activeStep ? 'mb-5 pb-5 border-b border-zinc-800' : ''}`}
              style={{ animation: isVisible ? 'fadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none' }}
            >
              <div className="flex items-center gap-2 mb-2.5 text-sm font-medium text-amber-500">
                <span className="w-[22px] h-[22px] rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center text-[11px] font-semibold">
                  {i + 1}
                </span>
                {step.label}
              </div>
              <div className="text-[15px] leading-relaxed text-zinc-100">{step.content}</div>
              {step.hint && (
                <div className="mt-3 px-3.5 py-2.5 rounded-lg border border-dashed border-zinc-700 bg-amber-500/5 text-[13px] text-zinc-400">
                  💡 {step.hint}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between px-5 py-3 border-t border-zinc-800">
        <button
          onClick={handlePrev}
          disabled={!allow_backtrack || activeStep === 0}
          className="px-4 py-2 rounded-lg border border-zinc-800 bg-transparent text-[13px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: allow_backtrack && activeStep > 0 ? '#f5f5f4' : '#52525b' }}
        >
          ← Previous
        </button>
        <button
          onClick={handleNext}
          disabled={activeStep >= steps.length - 1}
          className="px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-500/15"
        >
          Next →
        </button>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

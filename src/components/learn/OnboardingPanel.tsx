import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Layers, Target, Users, Brain, Sparkles } from 'lucide-react';
import { HierarchyGuide } from './HierarchyGuide';

const steps = [
  {
    icon: <Layers className="w-5 h-5" />,
    title: 'How Lyceum is organized',
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-zinc-300">Lyceum has 4 levels of organization:</p>
        <HierarchyGuide showHeader={false} />
        <p className="text-zinc-400 text-xs">Topics are predefined. Groups are yours to create.</p>
      </div>
    ),
  },
  {
    icon: <Target className="w-5 h-5" />,
    title: 'Understanding levels (Beginner → Expert)',
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-zinc-300">Each Topic has a mastery level showing how well you know it:</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { level: 'Beginner', color: 'bg-zinc-700 text-zinc-400', desc: 'Never heard of it' },
            { level: 'Aware', color: 'bg-blue-500/15 text-blue-400', desc: 'Know the term' },
            { level: 'Apprentice', color: 'bg-teal-500/15 text-teal-400', desc: 'Can follow a recipe' },
            { level: 'Practitioner', color: 'bg-emerald-500/15 text-emerald-400', desc: 'Can do it independently' },
            { level: 'Proficient', color: 'bg-violet-500/15 text-violet-400', desc: 'Deep enough to teach' },
            { level: 'Expert', color: 'bg-amber-500/15 text-amber-400', desc: 'Can innovate & extend' },
          ].map(({ level, color, desc }) => (
            <div key={level} className={`rounded-lg p-2.5 ${color} border border-white/5`}>
              <div className="font-medium text-xs">{level}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
        <p className="text-zinc-400 text-xs">Your level updates automatically based on quiz results and tutor interactions.</p>
      </div>
    ),
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: 'Lessons and nodes',
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-zinc-300">Each lesson is a self-contained learning unit. Inside it:</p>
        <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 p-4 space-y-2 text-xs">
          <div className="text-zinc-300 font-medium">A lesson contains:</div>
          <div className="space-y-1.5 pl-2">
            <div>• <span className="text-clay-300">Nodes</span> — individual sections, each with its own mastery target</div>
            <div>• <span className="text-sage-300">Blocks</span> — content inside nodes (prose, code, diagrams, quizzes)</div>
            <div>• <span className="text-amber-300">Grounding</span> — sourced facts for the AI tutor</div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-700/40">
            <div className="text-zinc-300 font-medium">You can also create:</div>
            <div className="space-y-1.5 pl-2 mt-1.5">
              <div>• <span className="text-clay-300">Groups</span> — organize lessons into your own categories</div>
              <div>• <span className="text-sage-300">Knowledge entries</span> — things you already know (the AI uses these)</div>
            </div>
          </div>
        </div>
        <p className="text-zinc-400 text-xs">Larger topics need multiple lessons — one lesson can't cover everything in depth.</p>
      </div>
    ),
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: 'The AI tutor',
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-zinc-300">The tutor adapts to your level and knowledge:</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2 rounded-lg bg-zinc-800/50 border border-zinc-700/40 p-3">
            <Sparkles className="w-4 h-4 text-clay-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-zinc-200 font-medium">Quiz-based leveling</div>
              <div className="text-zinc-500 mt-0.5">Answer quizzes to level up. Get it wrong? The AI adjusts and teaches differently.</div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-zinc-800/50 border border-zinc-700/40 p-3">
            <Sparkles className="w-4 h-4 text-sage-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-zinc-200 font-medium">Your knowledge matters</div>
              <div className="text-zinc-500 mt-0.5">Tell it what you already know — it won't waste time re-teaching basics.</div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-zinc-800/50 border border-zinc-700/40 p-3">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-zinc-200 font-medium">Layered content</div>
              <div className="text-zinc-500 mt-0.5">Advanced material hides behind "Go deeper" — unlocked as you level up.</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

const STEP_CIRCLE = [
  'bg-clay-500/15 text-clay-300',
  'bg-clay-500/15 text-clay-400',
  'bg-clay-500/20 text-clay-400',
  'bg-sage-500/15 text-sage-400',
];
const STEP_DOT = ['bg-clay-300', 'bg-clay-400', 'bg-clay-400', 'bg-sage-400'];

export function OnboardingPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mx-4 rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-clay-400" />
            <h2 className="font-semibold text-zinc-100">How Lyceum Works</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${STEP_CIRCLE[currentStep] ?? STEP_CIRCLE[STEP_CIRCLE.length - 1]}`}>
              {steps[currentStep].icon}
            </div>
          </div>

          <h3 className="text-center text-lg font-medium text-zinc-100 mb-4">{steps[currentStep].title}</h3>
          <div className="text-zinc-400 leading-relaxed">{steps[currentStep].content}</div>

          <div className="flex items-center justify-center gap-2 mt-6">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition ${
                  i === currentStep
                    ? `${STEP_DOT[currentStep] ?? 'bg-clay-400'} w-5`
                    : i < currentStep
                    ? 'bg-sage-400/60'
                    : 'bg-zinc-700 hover:bg-zinc-600'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Previous
          </button>
          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              className="px-4 py-2 rounded-lg bg-clay-500/20 hover:bg-clay-500/30 text-clay-300 text-sm font-medium transition border border-clay-400/30"
            >
              Next
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-sage-500/20 hover:bg-sage-500/30 text-sage-300 text-sm font-medium transition border border-sage-400/30"
            >
              Got it
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { BlurFade } from '../../../components/ui/blur-fade';
import type { Question } from '../../../types/resume';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
}

export function QuestionCard({ question, questionNumber, totalQuestions }: QuestionCardProps) {
  const [showExample, setShowExample] = useState(false);

  return (
    <BlurFade delay={0} inView>
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5 overflow-hidden hover:border-zinc-700/60 transition-colors"
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--page-accent)]/40 to-transparent" />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--page-accent-15)] flex items-center justify-center ring-1 ring-[var(--page-accent)]/20">
              <MessageSquare className="w-4.5 h-4.5 text-[var(--page-accent)]" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--page-accent)]">{question.phaseName}</span>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Question {questionNumber} of {totalQuestions}
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">{question.inputType}</Badge>
        </div>

        <h3 className="text-[15px] font-medium text-white leading-relaxed mb-3">
          {question.text}
        </h3>

        {question.whyItMatters && (
          <div className="flex items-start gap-2.5 pt-3 border-t border-zinc-800/40">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-400 leading-relaxed">{question.whyItMatters}</p>
          </div>
        )}

        {question.showExample && question.exampleAnswer && (
          <div className="mt-3">
            <button
              onClick={() => setShowExample(!showExample)}
              className="flex items-center gap-1.5 text-[11px] text-[var(--page-accent)] hover:text-[var(--page-accent)]/80 font-medium transition-colors"
            >
              {showExample ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showExample ? 'Hide example' : 'See example'}
            </button>
            <AnimatePresence>
              {showExample && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 rounded-lg bg-[var(--page-accent-5)] ring-1 ring-[var(--page-accent)]/15">
                    <p className="text-xs text-zinc-400 italic leading-relaxed">{question.exampleAnswer}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </BlurFade>
  );
}

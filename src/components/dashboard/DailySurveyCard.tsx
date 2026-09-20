import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardCheck, Check, X, MessageSquare, 
  Send, Sparkles, ArrowRight
} from 'lucide-react';
import { GlareHover } from '../ui/glare-hover';
import { AnimatedShinyText } from '../ui/animated-shiny-text';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { confetti } from '../ui/confetti';

interface SurveyQuestion {
  goalId: string;
  goalTitle: string;
  question: string;
  completed: boolean | null;
  response?: string;
}

interface DailySurveyCardProps {
  goals: any[];
  onComplete?: (responses: SurveyQuestion[]) => void;
  className?: string;
}

export function DailySurveyCard({ goals, onComplete, className = '' }: DailySurveyCardProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayGoals = goals.filter(g => g.date === today && g.status !== 'done');
    
    const surveyQuestions: SurveyQuestion[] = todayGoals.map(goal => ({
      goalId: goal.id,
      goalTitle: goal.title,
      question: `Did you complete "${goal.title}"?`,
      completed: null,
      response: undefined
    }));

    setQuestions(surveyQuestions);
  }, [goals]);

  const handleAnswer = (index: number, completed: boolean) => {
    setQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, completed } : q
    ));
    
    if (completed) {
      confetti({ particleCount: 30, spread: 60, startVelocity: 25, colors: ['#8b5cf6', '#a78bfa', '#c4b5fd'] });
    }
  };

  const handleComplete = () => {
    onComplete?.(questions);
    setIsExpanded(false);
    setCurrentQuestion(0);
    setNotes('');
  };

  const completedCount = questions.filter(q => q.completed === true).length;
  const totalCount = questions.length;
  const allAnswered = questions.every(q => q.completed !== null);

  if (questions.length === 0) return null;

  return (
    <GlareHover
      width="100%"
      height="auto"
      background="rgba(24, 24, 27, 0.5)"
      color="#10b981"
      opacity={0.2}
      angle={-45}
      duration={600}
      className={`rounded-xl border border-zinc-800/50 ${className}`}
    >
      <div className="relative p-5 overflow-hidden">
        {/* Top edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/30 via-emerald-500/10 to-transparent" />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ClipboardCheck className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <AnimatedShinyText className="text-[15px] font-semibold" gradientFrom="#10b981" gradientTo="#34d399">
                Daily Survey
              </AnimatedShinyText>
              <p className="text-[11px] text-zinc-500">How did you do today?</p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-6 h-6 rounded-md bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            {isExpanded ? <X size={14} /> : <ArrowRight size={14} />}
          </button>
        </div>

        {/* Progress indicator */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
            <span>{completedCount} of {totalCount} completed</span>
            <span className="text-emerald-400">{Math.round((completedCount / totalCount) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / totalCount) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Expanded view */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <motion.div
                    key={question.goalId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/30"
                  >
                    <p className="text-[13px] text-zinc-300 mb-2">{question.question}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAnswer(index, true)}
                        className={`flex-1 ${
                          question.completed === true
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-700/50'
                        }`}
                      >
                        <Check size={12} className="mr-1" />
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAnswer(index, false)}
                        className={`flex-1 ${
                          question.completed === false
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-700/50'
                        }`}
                      >
                        <X size={12} className="mr-1" />
                        No
                      </Button>
                    </div>
                  </motion.div>
                ))}

                {/* Notes input */}
                <div className="mt-3">
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about today?"
                    className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-emerald-500/50"
                  />
                </div>

                {/* Complete button */}
                {allAnswered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Button
                      onClick={handleComplete}
                      className="w-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                    >
                      <Sparkles size={14} className="mr-2" />
                      Complete Survey
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed preview */}
        {!isExpanded && (
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <MessageSquare size={12} />
            <span>{totalCount} questions to answer</span>
          </div>
        )}
      </div>
    </GlareHover>
  );
}

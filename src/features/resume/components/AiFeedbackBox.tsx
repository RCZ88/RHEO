import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import type { AiFeedback } from '../../../types/resume';

interface AiFeedbackProps {
  feedback: AiFeedback;
  visible: boolean;
  onDismiss: () => void;
}

const qualityConfig = {
  strong: { icon: CheckCircle, color: 'text-emerald-400', ring: 'ring-emerald-500/20', bg: 'bg-emerald-500/5', badge: 'default' as const, label: 'Strong', gradient: 'from-emerald-500/10 to-transparent' },
  good: { icon: Info, color: 'text-blue-400', ring: 'ring-blue-500/20', bg: 'bg-blue-500/5', badge: 'secondary' as const, label: 'Good', gradient: 'from-blue-500/10 to-transparent' },
  needs_work: { icon: AlertTriangle, color: 'text-amber-400', ring: 'ring-amber-500/20', bg: 'bg-amber-500/5', badge: 'outline' as const, label: 'Needs Work', gradient: 'from-amber-500/10 to-transparent' },
  weak: { icon: XCircle, color: 'text-red-400', ring: 'ring-red-500/20', bg: 'bg-red-500/5', badge: 'destructive' as const, label: 'Weak', gradient: 'from-red-500/10 to-transparent' },
};

export function AiFeedbackBox({ feedback, visible, onDismiss }: AiFeedbackProps) {
  const config = qualityConfig[feedback.quality];
  const Icon = config.icon;
  const [keepOpen, setKeepOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && !keepOpen) {
      timerRef.current = setTimeout(() => onDismiss(), 8000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, keepOpen, onDismiss]);

  const handleKeepOpen = () => {
    setKeepOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -10, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`relative rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-4 overflow-hidden`}
        >
          {/* Quality accent gradient */}
          <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${config.color.replace('text-', 'via-')}/40 to-transparent`} />
          <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} pointer-events-none opacity-50`} />

          <div className="relative flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full ${config.bg} ring-1 ${config.ring} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3 h-3 text-[var(--page-accent)]" />
                <span className="text-xs font-semibold text-white">AI Coach</span>
                <Badge variant={config.badge} className="text-[10px]">{config.label}</Badge>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{feedback.comment}</p>
              {feedback.suggestion && (
                <p className="text-xs text-zinc-400 mt-2 italic">"{feedback.suggestion}"</p>
              )}
              {feedback.bulletDraft && (
                <div className="mt-3 p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
                  <p className="text-[10px] text-zinc-500 mb-1">Suggested bullet</p>
                  <p className="text-xs text-white font-mono leading-relaxed">{feedback.bulletDraft}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(feedback.bulletDraft)}
                    className="mt-1.5 text-[10px] text-[var(--page-accent)] hover:underline"
                  >
                    Copy to clipboard
                  </button>
                </div>
              )}
              {!keepOpen && (
                <div className="mt-2">
                  <button onClick={handleKeepOpen} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
                    Keep open
                  </button>
                </div>
              )}
            </div>
            <button onClick={onDismiss} className="text-zinc-500 hover:text-white transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {!keepOpen && (
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 8, ease: 'linear' }}
              className="h-0.5 bg-[var(--page-accent-30)] mt-3 origin-left rounded-full"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

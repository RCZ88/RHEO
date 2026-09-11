import { Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Progress } from './Progress'
import { cn } from '../lib/cn'
import { TEXT } from '../tokens'
import { aiBuildingVariants } from '../lib/motion'

interface AiBuildingIndicatorProps {
  visible: boolean
  label?: string
  progress?: number
  partialPreview?: React.ReactNode
  className?: string
}

export function AiBuildingIndicator({ visible, label = 'AI is building...', progress, partialPreview, className }: AiBuildingIndicatorProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          variants={aiBuildingVariants}
          initial="hidden" animate="building" exit="hidden"
          className={cn('rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-zinc-800/60', className)}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-violet-400 animate-pulse motion-reduce:animate-none" />
            <span className={cn('text-xs font-medium', TEXT.secondary)}>{label}</span>
            {progress != null && (
              <span className="text-[10px] tabular-nums text-zinc-500 ml-auto">{Math.round(progress * 100)}%</span>
            )}
          </div>
          <Progress accent="violet" indeterminate={progress == null} value={progress} aria-label="AI building progress" />
          {partialPreview && (
            <div className="mt-3 opacity-40 pointer-events-none">{partialPreview}</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

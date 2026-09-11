import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import { cn } from '../lib/cn'
import { TEXT } from '../tokens'
import { ListTransition } from '../primitives/ListTransition'
import { AutomationCard } from './AutomationCard'
import { VisualBuilderModal } from './VisualBuilder/VisualBuilderModal'
import { useAutomationActions } from './lib/useAutomationActions'
import type { AutomationConfig } from '../../types/automation'

interface AutomationListProps {
  showHeader?: boolean
  className?: string
}

export function AutomationList({ showHeader = true, className }: AutomationListProps) {
  const [showBuilder, setShowBuilder] = useState(false)
  const { automations, loading, createAutomation, toggleAutomation, deleteAutomation, testRun } = useAutomationActions()

  const handleSaved = async (config: AutomationConfig) => {
    await createAutomation(config)
    setShowBuilder(false)
  }

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2].map(i => (
          <div key={i} className="h-28 rounded-xl bg-zinc-900 light:bg-white/30 animate-pulse motion-reduce:animate-none" />
        ))}
      </div>
    )
  }

  if (automations.length === 0) {
    return (
      <div className={cn("flex flex-col items-center py-6 text-zinc-600", className)}>
        <Zap size={20} className="mb-2 opacity-30" />
        <p className="text-[10px]">No automations yet</p>
      </div>
    )
  }

  return (
    <>
      <div className={cn("flex flex-col gap-3", className)}>
        {showHeader && (
          <div className="flex items-center justify-between mb-1">
            <h3 className={cn("text-[12px] font-semibold", TEXT.primary)}>Automations</h3>
            <button
              onClick={() => setShowBuilder(true)}
              className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              + Create
            </button>
          </div>
        )}
        <ListTransition
          items={automations}
          renderItem={(auto) => (
            <AutomationCard
              data={auto}
              onEdit={() => setShowBuilder(true)}
              onToggle={() => toggleAutomation(auto.ruleId, auto.enabled)}
              onDelete={() => deleteAutomation(auto.ruleId, auto.name)}
              onTestRun={() => testRun(auto.ruleId, auto.name)}
              onDismiss={() => deleteAutomation(auto.ruleId, auto.name)}
            />
          )}
          itemClassName="space-y-3"
        />
      </div>

      <AnimatePresence>
        {showBuilder && (
          <VisualBuilderModal
            onClose={() => setShowBuilder(false)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </>
  )
}
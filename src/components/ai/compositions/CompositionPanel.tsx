import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus, Zap } from 'lucide-react'
import { cn } from '../lib/cn'
import { TEXT } from '../tokens'
import { ListTransition } from '../primitives/ListTransition'
import { AutomationCard } from '../automations/AutomationCard'
import { VisualBuilderModal } from '../automations/VisualBuilder/VisualBuilderModal'
import { AISuggestionModal } from './AISuggestionModal'
import { useAutomationActions } from '../automations/lib/useAutomationActions'
import type { AutomationConfig } from '../../types/automation'

export function CompositionPanel() {
  const [showBuilder, setShowBuilder] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)
  const { automations, loading, createAutomation, toggleAutomation, deleteAutomation, testRun, reload } = useAutomationActions()

  const handleSaved = async (config: AutomationConfig) => {
    await createAutomation(config)
    setShowBuilder(false)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className={cn("text-[15px] font-semibold", TEXT.primary)}>Automations</h2>
          <p className={cn("text-[11px] mt-0.5", TEXT.muted)}>Visual rules the AI runs for you</p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-600/80 hover:bg-violet-500/80 px-4 py-2 text-[12px] font-medium text-white transition-colors"
        >
          <Plus size={14} /> Create Automation
        </button>
        <button
          onClick={() => setShowSuggest(true)}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-[12px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <Zap size={14} /> Generate with AI
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl bg-zinc-900/30 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-zinc-500">
          <Zap size={36} className="mb-3 opacity-20" />
          <p className="text-[13px]">No automations yet</p>
          <p className="text-[11px] mt-1 text-zinc-600">Ask the AI to create one, or use the visual builder</p>
        </div>
      ) : (
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
          className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1"
        />
      )}

      {/* Visual Builder Modal */}
      <AnimatePresence>
        {showBuilder && (
          <VisualBuilderModal
            onClose={() => setShowBuilder(false)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>

      {/* AI Suggestion Modal */}
      {showSuggest && (
        <AISuggestionModal onClose={() => { setShowSuggest(false); reload() }} />
      )}
    </div>
  )
}
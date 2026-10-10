import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CategoryChipGrid } from './CategoryChipGrid'
import type { FinanceCategory } from '../finance-types'

const EASE = [0.16, 1, 0.3, 1] as const
const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
const dialogMotion = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
  transition: { duration: 0.25, ease: EASE },
}

interface Props {
  open: boolean
  count: number
  categories: FinanceCategory[]
  busy?: boolean
  onCancel: () => void
  onConfirm: (categoryId: number) => void
}

export function BatchRecategorizeModal({ open, count, categories, busy, onCancel, onConfirm }: Props) {
  const [picked, setPicked] = useState<number | null>(null)

  const handleCreateCategory = async (data: { name: string; type: string; icon?: string; color?: string }) => {
    try {
      const res = await (window as any).deskflowAPI?.financeCreateCategory?.(data)
      if (res?.id) {
        setPicked(res.id)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...overlayMotion}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            {...dialogMotion}
            role="dialog"
            aria-modal="true"
            aria-label="Recategorize selected transactions"
            className="w-full max-w-md rounded-xl border border-zinc-700/50 bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-semibold text-zinc-100">
              Recategorize {count} transaction{count === 1 ? '' : 's'}
            </h2>
            <p className="text-[12px] text-zinc-500 mt-1">
              Pick a new category. This only changes labels — balances are not affected.
            </p>

            <div className="mt-4 max-h-64 overflow-y-auto pr-1">
              <CategoryChipGrid
                categories={categories}
                selectedId={picked}
                onSelect={setPicked}
                accent="#10b981"
                onCreateCategory={handleCreateCategory}
                categoryType="expense"
              />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={onCancel}
                className="h-11 px-4 rounded-xl text-[13px] text-zinc-300 border border-white/10 hover:bg-white/5 transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={picked == null || busy}
                onClick={() => picked != null && onConfirm(picked)}
                className="h-11 px-4 rounded-xl text-[13px] font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply category
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

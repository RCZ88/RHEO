import { useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface CustomConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function CustomConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
}: CustomConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      // Focus the confirm button after animation
      const timer = setTimeout(() => confirmRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Keyboard: Escape = cancel, Enter = confirm
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel, onConfirm])

  const variantStyles = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      confirmBg: 'bg-red-500/80 hover:bg-red-500',
      border: 'border-red-500/20',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      confirmBg: 'bg-amber-500/80 hover:bg-amber-500',
      border: 'border-amber-500/20',
    },
    info: {
      icon: AlertTriangle,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      confirmBg: 'bg-blue-500/80 hover:bg-blue-500',
      border: 'border-blue-500/20',
    },
  }

  const v = variantStyles[variant]
  const Icon = v.icon

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-[380px] rounded-2xl border border-zinc-700/50 bg-[rgba(18,18,18,0.98)] backdrop-blur-xl shadow-2xl overflow-hidden light:bg-white light:border-[var(--ws-border-strong)]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-3 p-5 pb-0">
                <div className={`w-10 h-10 rounded-xl ${v.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon size={20} className={v.iconColor} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold text-white light:text-stone-900">{title}</h3>
                  <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed light:text-stone-500">{message}</p>
                </div>
                <button
                  onClick={onCancel}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 mt-0.5 light:hover:bg-stone-100"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 p-4 mt-2">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors light:text-stone-500 light:hover:bg-stone-100"
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmRef}
                  onClick={onConfirm}
                  className={`px-4 py-2 rounded-xl text-[12px] font-medium text-white ${v.confirmBg} transition-colors shadow-lg`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

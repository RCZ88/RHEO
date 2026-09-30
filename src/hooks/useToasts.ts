import { useState, useCallback, useEffect } from 'react'
import { getToastDurationMs, isSticky } from '../lib/toastDuration'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Re-read when the user changes the duration in Settings, so an open toast
  // picks it up without a reload.
  const [duration, setDuration] = useState(getToastDurationMs)

  useEffect(() => {
    const onChange = () => setDuration(getToastDurationMs())
    window.addEventListener('toast-duration-changed', onChange)
    return () => window.removeEventListener('toast-duration-changed', onChange)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    // A "sticky" duration (the max) means the toast stays until dismissed.
    if (!isSticky(duration)) setTimeout(() => removeToast(id), duration)
  }, [removeToast, duration])

  return { toasts, showToast, removeToast }
}

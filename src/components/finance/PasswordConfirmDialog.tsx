import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, AlertCircle, Key } from 'lucide-react';

interface PasswordConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<boolean>;
  title?: string;
  description?: string;
}

export function PasswordConfirmDialog({ open, onClose, onConfirm, title, description }: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onConfirm(password);
      if (ok) {
        setSuccess(true);
        setTimeout(() => {
          setPassword('');
          setSuccess(false);
          onClose();
        }, 400);
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Verification failed');
    }
    setSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">{title || 'Enter Password'}</h3>
          </div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">{description || 'Enter your finance password to continue'}</p>
        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Password"
            autoFocus
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-xs text-red-400"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          <motion.button
            whileTap={{ scale: submitting || success ? 1 : 0.98 }}
            onClick={handleSubmit}
            disabled={submitting || success || !password}
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {success ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Verified
              </motion.span>
            ) : submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Key className="w-4 h-4" />
                Confirm
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

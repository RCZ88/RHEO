// ============================================================================
// Workspace Design System — Modal Shell
// One consistent overlay + panel for EVERY workspace dialog.
// Portal-based, framer-motion animated, accent-aware.
// Import this instead of hand-rolling fixed/inset/overlay patterns.
// ============================================================================
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { DUR, EASE_OUT } from './motion';

// ---- Overlay ----------------------------------------------------------------
const OVERLAY_INIT = { opacity: 0 };
const OVERLAY_SHOW = { opacity: 1 };

// ---- Panel ------------------------------------------------------------------
const PANEL_INIT = { opacity: 0, scale: 0.97, y: 10 };
const PANEL_SHOW = { opacity: 1, scale: 1, y: 0 };
const PANEL_EXIT = { opacity: 0, scale: 0.98, y: 6 };

// ---- ModalShell -------------------------------------------------------------
// The single source of truth for all workspace modals.
// Props:
//   open      — controls visibility
//   onClose   — called on Escape / backdrop click / X button
//   title     — header text (required)
//   subtitle  — optional description below title
//   accent    — optional accent color name (adds colored dot + tint)
//   maxWidth  — max-width class (default: max-w-lg)
//   footer    — optional footer content (buttons, etc.)
//   children  — body content
export function ModalShell({
  open, onClose, title, subtitle, accent, maxWidth = 'max-w-lg',
  footer, children, className = '',
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  accent?: string; maxWidth?: string; footer?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  const reduce = useReducedMotion();

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const accentDot: Record<string, string> = {
    cyan: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]',
    green: 'bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]',
    rose: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]',
    amber: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
    purple: 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]',
    indigo: 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]',
  };
  const dotCls = accent ? accentDot[accent] : 'bg-zinc-400';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center p-4"
          initial={reduce ? undefined : OVERLAY_INIT}
          animate={OVERLAY_SHOW}
          exit={OVERLAY_INIT}
          transition={{ duration: reduce ? 0 : DUR.fast }}
        >
          {/* Backdrop */}
          <div
            aria-hidden
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? undefined : PANEL_INIT}
            animate={PANEL_SHOW}
            exit={PANEL_EXIT}
            transition={{ duration: reduce ? 0 : DUR.normal, ease: EASE_OUT as any }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full ${maxWidth} max-h-[85vh] flex flex-col rounded-xl bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl ring-1 ring-zinc-800/60 shadow-2xl shadow-black/50 overflow-hidden ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {dotCls && <div className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />}
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold text-zinc-100 truncate">{title}</h2>
                  {subtitle && <p className="text-[11px] text-zinc-500 truncate mt-0.5">{subtitle}</p>}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-all duration-150 active:scale-90 shrink-0 ml-3"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800/50 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---- ConfirmModal -----------------------------------------------------------
// A ready-made confirmation dialog. Use for destructive actions, confirmations, etc.
export function ConfirmModal({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', danger = false, loading = false,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string;
  danger?: boolean; loading?: boolean;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-zinc-300 bg-zinc-800 ring-1 ring-zinc-700/60 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-150 active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 ${
              danger
                ? 'text-white bg-red-600 hover:bg-red-500'
                : 'text-zinc-950 bg-[color:var(--page-accent,#2dd4bf)] hover:brightness-110'
            }`}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-zinc-400">{message}</p>
    </ModalShell>
  );
}

// ---- FormField --------------------------------------------------------------
// Consistent form field wrapper for use inside modals.
export function FormField({
  label, hint, children, className = '',
}: {
  label: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

// ---- FormInput --------------------------------------------------------------
// Consistent input for modals. Accent-driven focus ring.
export const FORM_INPUT =
  'w-full bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent,#2dd4bf)]/40 focus:border-[color:var(--page-accent,#2dd4bf)]/40 transition-all duration-150';

export const FORM_SELECT =
  'w-full bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg px-3 py-2 text-[13px] text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent,#2dd4bf)]/40 focus:border-[color:var(--page-accent,#2dd4bf)]/40 transition-all duration-150 cursor-pointer';

export const FORM_TEXTAREA =
  'w-full bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent,#2dd4bf)]/40 focus:border-[color:var(--page-accent,#2dd4bf)]/40 transition-all duration-150 resize-none';

// ---- Section Divider --------------------------------------------------------
// Used inside modals to separate logical sections.
export function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-zinc-800/40 pt-3 mt-3">
      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{title}</span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ============================================================================
// Workspace Design System — Shared form controls & modal shell
// One source of truth for inputs, buttons, filter chips, status pills, and the
// modal overlay used by every terminal-workspace tab. Import these instead of
// hand-rolling Tailwind so all sidebar pages stay visually identical.
// Accent is driven by the CSS var --page-accent set on each tab root.
// ============================================================================
import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './primitives';

// ---- Class tokens ----------------------------------------------------------
export const INPUT_CLS =
  'w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent)]/40 focus:border-[color:var(--page-accent)]/40 transition-colors';

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-[color:var(--page-accent)] hover:brightness-110 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

export const BTN_GHOST =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 ring-1 ring-zinc-700/60 hover:bg-zinc-700/60 hover:text-zinc-100 transition active:scale-95';

// Filter / segmented chip (accent-aware).
export const filterChipCls = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 min-h-[26px] transition-colors active:scale-95 ${
    active
      ? 'text-[color:var(--page-accent)] bg-[color-mix(in_srgb,var(--page-accent)_16%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--page-accent)_38%,transparent)]'
      : 'text-zinc-400 bg-zinc-800/70 ring-1 ring-zinc-700/50 hover:text-zinc-200 hover:bg-zinc-700/60'
  }`;

// Set the per-page accent as a CSS variable on a tab root.
export const accentVars = (hex: string): React.CSSProperties =>
  ({ ['--page-accent' as string]: hex } as React.CSSProperties);

// Inline style helper for status dots (avoids JSX double-brace literals).
export const dotStyle = (color: string): React.CSSProperties => ({ background: color });

// ---- Generic status pill ---------------------------------------------------
export const Pill: React.FC<{ label: string; cls: string; dot?: string; compact?: boolean }> = ({ label, cls, dot, compact }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${cls} ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}>
    {dot && <span className="w-1.5 h-1.5 rounded-full" style={dotStyle(dot)} />}
    {label}
  </span>
);

// ---- Modal shell (one consistent overlay for every workspace dialog) -------
const OVERLAY_INIT = { opacity: 0 };
const OVERLAY_SHOW = { opacity: 1 };
const PANEL_INIT = { opacity: 0, scale: 0.96, y: 8 };
const PANEL_SHOW = { opacity: 1, scale: 1, y: 0 };
const PANEL_EXIT = { opacity: 0, scale: 0.98, y: 4 };
const OVERLAY_TRANS = { duration: 0.15 };
const PANEL_TRANS = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as number[] };

export const ModalShell: React.FC<{
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
  maxWidth?: string;
}> = ({ onClose, title, children, accent, maxWidth = 'max-w-md' }) => (
  <motion.div
    initial={OVERLAY_INIT} animate={OVERLAY_SHOW} exit={OVERLAY_INIT} transition={OVERLAY_TRANS}
    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[var(--z-overlay)] p-4"
    style={accent ? accentVars(accent) : undefined}
    onClick={onClose}
  >
    <motion.div
      initial={PANEL_INIT} animate={PANEL_SHOW} exit={PANEL_EXIT} transition={PANEL_TRANS}
      onClick={(e) => e.stopPropagation()}
      className={`w-full ${maxWidth} max-h-[82vh] overflow-y-auto rounded-xl bg-zinc-900/95 backdrop-blur-xl ring-1 ring-zinc-800 shadow-2xl shadow-black/50 p-5`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">{title}</div>
        <IconButton title="Close" onClick={onClose}><X className="w-4 h-4" /></IconButton>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

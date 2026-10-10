// ============================================================================
// Workspace Design System — Form Controls
// Unified inputs, textareas, selects, and buttons for ALL workspace forms.
// Accent-driven via --page-accent CSS variable.
// ============================================================================
import React from 'react';
import { motion } from 'framer-motion';
import { DUR, EASE_OUT } from './motion';

// ---- Class Tokens -----------------------------------------------------------
// These are the SINGLE source of truth. Import from here, never inline.

export const WS_INPUT =
  'w-full bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent)]/40 focus:border-[color:var(--page-accent)]/40 transition-colors duration-150';

export const WS_INPUT_SM =
  'w-full bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent)]/40 focus:border-[color:var(--page-accent)]/40 transition-colors duration-150';

export const WS_TEXTAREA =
  'w-full bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent)]/40 focus:border-[color:var(--page-accent)]/40 transition-colors duration-150 resize-none min-h-[80px]';

export const WS_SELECT =
  'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg px-3 py-2 text-[13px] text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent)]/40 focus:border-[color:var(--page-accent)]/40 transition-colors duration-150 cursor-pointer';

// ---- Button Variants --------------------------------------------------------
export const WS_BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-zinc-950 bg-[color:var(--page-accent)] hover:brightness-110 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none';

export const WS_BTN_SECONDARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-zinc-300 bg-zinc-800 ring-1 ring-zinc-700/60 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none';

export const WS_BTN_GHOST =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none';

export const WS_BTN_DANGER =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white bg-red-600 hover:bg-red-500 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none';

export const WS_BTN_ICON =
  'grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700/60 transition-all duration-150 active:scale-90 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent)]/40';

// ---- Chip / Filter ----------------------------------------------------------
export const WS_CHIP = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 min-h-[28px] transition-all duration-150 active:scale-[0.97] focus-visible:outline-none ${
    active
      ? 'text-[color:var(--page-accent)] bg-[color-mix(in_srgb,var(--page-accent)_16%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--page-accent)_38%,transparent)]'
      : 'text-zinc-400 bg-zinc-800/70 ring-1 ring-zinc-700/50 hover:text-zinc-200 hover:bg-zinc-700/60'
  }`;

// ---- Helper -----------------------------------------------------------------
export const wsAccentStyle = (hex: string): React.CSSProperties =>
  ({ ['--page-accent' as string]: hex } as React.CSSProperties);

export const wsDotStyle = (color: string): React.CSSProperties => ({ background: color });

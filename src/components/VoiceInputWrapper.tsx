/**
 * VoiceInputWrapper — pass-through.
 *
 * CZ directive (2026-11-12): the microphone is REMOVED from ALL text inputs.
 * Voice belongs to the Halo island pill: the global shortcut Ctrl/Cmd+Shift+R
 * (registered in src/main.ts) toggles island recording via DictationIsland,
 * which owns the one microphone stream. Its transcript is saved to the
 * library and copied to the clipboard.
 *
 * The per-field dictation panel this component used to render (mic button,
 * portal panel, retry funnel, sentinel-undo) is gone. The wrapper remains as
 * a pass-through so its ~20 call sites keep compiling and their children
 * render unchanged. New per-field voice UI needs a deliberate design that
 * routes through the island, not a second engine per input.
 */

import { type ReactElement } from 'react';

interface VoiceInputWrapperProps {
  children: ReactElement;
  silenceMs?: number;
  className?: string;
}

export function VoiceInputWrapper({ children }: VoiceInputWrapperProps) {
  return <>{children}</>;
}

import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

/**
 * GlassSurface — the shared surface primitive for the whole finance module
 * (24 importers). Re-skinned to the /finance ledger contract.
 *
 * WHAT CHANGED AND WHY (PAINT Gate C, LAMINAR §7):
 *  - REMOVED the blur. It was on tiers 1 and 3, so every card AND the sticky
 *    header blurred. LAMINAR §7.3 makes backdrop-blur on chrome a hard-gate
 *    fail; modals and headers want a flat surface + hairline. Depth now comes
 *    from surface lightness and hairline brightness instead.
 *  - REMOVED the per-card top-sheen gradient (a 180deg white-alpha-to-
 *    transparent overlay div). It was a decorative chrome gradient
 *    (LAMINAR §7.1) painted on EVERY card, which is why cards looked busy
 *    rather than crisp. Note: the class is deliberately not quoted literally
 *    here — Tailwind's auto-source scan reads this file's text, including
 *    comments, and a pasted utility can become a real rule.
 *  - Colours now resolve to tokens (`--color-card`, `--color-border`), so the
 *    21 of 53 finance files that had zero `light:` variants inherit light mode
 *    for free instead of staying dark-on-light.
 *
 * The `tier` prop is kept so all 24 call sites keep working, but the three
 * tiers now mean three DEPTHS of one flat recipe rather than three blurs:
 *   1 = card · 2 = sunken well · 3 = chrome/header (raised + sticky)
 */
interface GlassSurfaceProps {
  tier?: 1 | 2 | 3;
  /** Deprecated: an accent BORDER on every card read as "important" on
   *  everything. Structure is expressed once, by the section eyebrow. */
  accent?: boolean;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerEnter?: () => void;
  style?: React.CSSProperties;
  'data-tx-id'?: number;
}

export function GlassSurface({
  tier = 1, accent, interactive, className = '', children, onClick, onPointerDown, onPointerEnter, style, 'data-tx-id': dataTxId,
}: GlassSurfaceProps) {
  const depth =
    tier === 1 ? 'fin-surface'
    : tier === 2 ? 'fin-surface fin-surface--sunken'
    : 'fin-surface fin-surface--raised';

  // Kept for call-site compatibility, but it is now a token-driven 1px rather
  // than a hue-coded border. `accent` used to hardcode emerald, which meant a
  // page whose accent changed kept painting green borders.
  const accentStyles = accent ? 'fin-surface--accent' : '';

  const interactiveStyles = interactive ? 'fin-surface--interactive cursor-pointer' : '';

  return (
    <motion.div
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      data-tx-id={dataTxId}
      onKeyDown={interactive && onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); /* Synthesising a click from a keypress; the handler only reads coordinates/values it does not need from the event. */ onClick(e as unknown as React.MouseEvent); } } : undefined}
      className={`relative rounded-xl ${depth} ${accentStyles} ${interactiveStyles} ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  );
}

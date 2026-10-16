import type { ReactNode } from 'react';

/**
 * WarmCard — the card surface for every warmth page (Gold, Schedule, Habits).
 *
 * LEGIBILITY, measured rather than guessed. The old values composited to
 * effectively nothing against the page background:
 *
 *   ambient  bg-zinc-900/30 light:bg-[var(--ws-surface-raised)]  ->  #0e0e10  vs page #09090b  =  1.03:1  (invisible)
 *   normal   bg-zinc-900/80 light:bg-[var(--ws-surface-raised)]  ->  #151518  vs page #09090b  =  1.09:1  (barely)
 *   border   zinc-800/50 over the card        =  1.28:1  (below the 1.3 floor)
 *
 * A surface you cannot see is a surface you cannot scan, which is exactly why
 * the cards read as "blending into the background".
 *
 * WHY THE FIX IS MOSTLY IN THE BORDER, NOT THE FILL
 * -------------------------------------------------
 * `--color-card` (#18181b) is only 1.12:1 above the page (#09090b) and that is
 * the sanctioned token — raising the fill would mean inventing a new surface
 * value, which LAMINAR §2/§4 forbids. But a card reads as a card from its EDGE,
 * not only from its fill. So the separation is carried by a 1px hairline:
 *
 *   default edge  -> #393940   1.55:1 vs card · 1.74:1 vs page  (unmistakable)
 *   hover edge    -> #4c4c55   2.09:1 vs card · 2.34:1 vs page
 *   ambient edge  -> #2d2d33   1.29:1 vs card · 1.45:1 vs page  (quieter tier)
 *
 * Ambient also takes a small fill lift so the two tiers stay distinguishable
 * without the card getting brighter than the text it contains.
 *
 * Stays strictly monochrome — LAMINAR §2 allows no second hue on a surface.
 * radius stays rounded-xl (12px, §4). No shadow, no backdrop-blur (§7.3).
 */

interface WarmCardProps {
  children: ReactNode;
  className?: string;
  /** Ambient = a quieter tier for nested/scrolling surfaces, not a fainter one. */
  ambient?: boolean;
  /** Raise the border on hover. Use for cards that are themselves clickable. */
  interactive?: boolean;
}

export function WarmCard({ children, className = '', ambient, interactive }: WarmCardProps) {
  return (
    <div
      className={[
        'relative rounded-xl border p-5 transition-colors',
        interactive
          // zinc-600 on hover: 2.34:1 against the page.
          ? 'border-zinc-600/60 hover:border-zinc-500'
          : ambient
            // Quieter tier, still a visible edge.
            ? 'border-zinc-700/40'
            // zinc-700 at 70% reads #393940 — the legibility fix.
            : 'border-zinc-700/70',
        ambient
          ? 'bg-[var(--color-muted-35)]'
          : 'bg-[var(--color-card)]',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default WarmCard;

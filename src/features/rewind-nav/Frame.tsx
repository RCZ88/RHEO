/**
 * Frame.tsx — one frame on the film strip.
 *
 * The strip itself (matte black base, sprocket holes along both edges, quiet edge
 * print) is drawn by the wrapper so consecutive frames read as ONE continuous
 * strip rather than a row of cards. Sprockets are therefore drawn on the wrapper,
 * not per frame — duplicating them per frame makes the pitch visibly wrong at the
 * seams.
 *
 * The frame body is a single component boundary so the preview can be swapped for
 * a real `webContents.capturePage` screenshot later without touching the strip.
 */
import { memo } from 'react'
import Preview from './previews'
import { highlight, type Range } from './useNavSearch'
import type { NavEntry } from './nav-tree'

export interface FrameProps {
  entry: NavEntry
  selected: boolean
  dim: boolean
  ranges: Range[]
  onSelect: () => void
  /** Registers the frame's DOM node so FilmNav can centre the strip on it. */
  frameRef?: (el: HTMLDivElement | null) => void
}

function FrameInner({ entry, selected, dim, ranges, onSelect, frameRef }: FrameProps) {
  const label = entry.title
  return (
    <div
      id={`rw-f-${entry.id}`}
      ref={frameRef}
      role="option"
      aria-selected={selected}
      aria-label={entry.trail.length ? `${entry.trail[entry.trail.length - 1]} ${label}` : label}
      onClick={onSelect}
      className={`group relative shrink-0 cursor-pointer px-1.5 py-3 transition-opacity duration-200 ${
        dim ? 'opacity-30' : 'opacity-100'
      }`}
      style={{ width: 170 }}
    >
      {/* matte frame body */}
      <div
        className={`relative h-[128px] overflow-hidden rounded-[8px] transition-colors duration-200 ${
          selected ? 'bg-amber-400/20 ring-2 ring-amber-400' : 'bg-zinc-900 light:bg-[var(--ws-surface-raised)] ring-1 ring-white/10 group-hover:ring-white/25'
        }`}
      >
        <Preview
          kind={entry.preview}
          className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${
            selected ? 'opacity-90' : 'opacity-55 group-hover:opacity-75'
          }`}
        />
        {/* title sits on the frame, quiet until selected */}
        <span
          className={`frame-title absolute inset-x-2.5 bottom-2 truncate text-[15px] font-semibold leading-tight transition-colors ${
            selected ? 'text-amber-400' : 'text-zinc-200'
          }`}
        >
          {ranges.length
            ? highlight(label, ranges).map((p, i) => (
                <span key={i} className={p.hit ? 'text-amber-300' : undefined}>{p.text}</span>
              ))
            : label}
        </span>
      </div>
    </div>
  )
}

/**
 * Memoised: spec §8, "memoize reels and frames. Do not re-render the whole rail on
 * every keystroke." `preview`/`entry` are rebuilt each parent render, so the
 * comparator compares the fields that actually drive pixels.
 */
export default memo(FrameInner, (a, b) =>
  a.entry.id === b.entry.id &&
  a.selected === b.selected &&
  a.dim === b.dim &&
  a.ranges === b.ranges &&
  a.onSelect === b.onSelect,
)
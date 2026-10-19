/**
 * Schedule layout shell — the user-facing half of the layout system.
 *
 * `layout.ts` already owns every rule (4 presets, slot maps, swap, hide, size
 * clamping + snapping, debounced persistence, untrusted-input sanitising). This
 * file is deliberately the *only* place that renders those rules, so there is
 * one implementation of the interaction rather than one per panel.
 *
 * Spec: agent/docs/SCHEDULE-LAYOUT-SYSTEM.md §15-21, §41-67
 *   §19  header: "Schedule" + date left; layout menu, view toggle, [<][Today][>] right
 *   §17  one screen, NO page scroll; each panel scrolls inside itself
 *   §21  below 1100px every preset collapses to one column
 *   §43  layout menu shows 4 small thumbnails, ~200ms, no bounce
 *   §45  swap by dragging one panel header onto another slot
 *   §47  per-panel hide toggle; hidden panels free their space
 *   §49  dividers draggable only within min/max, snapping to fixed steps
 *   §52  persist preset + swaps + hidden + sizes; "Reset layout" button
 *   §53  NO free dragging, NO floating panels, NO arbitrary resizing
 *   §64  keys M/W/D = view, T = today, arrows = prev/next, 1-4 = preset
 *
 * Two invariants are load-bearing and easy to undo:
 *   1. Swap is a two-element rewrite of `slots`. There is no separate "order"
 *      array that could disagree with the map.
 *   2. Focus declares three `drawer-*` slots rather than special-casing the
 *      render, so no branch anywhere needs to know a preset exists.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, LayoutGrid, RotateCcw, X,
  EyeOff, CalendarDays, ListTodo, Flag, CheckSquare,
} from 'lucide-react'
import {
  type PanelId, type PresetId, type ScheduleLayout, type ViewMode,
  PRESET_IDS, PRESET_LABEL, PRESET_SLOTS, PANEL_META,
  defaultLayout, withPreset, loadLayout, saveLayout, swapPanels, toggleHidden, isHidden,
  setSlotSize, snapSize,
} from './layout'

/* Local-clock YYYY-MM-DD. `toISOString()` is UTC, so it is off by one for
 * seven hours a day at UTC+7 — "go to today" would land on yesterday. */
function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const PANEL_ICON: Record<PanelId, typeof CalendarDays> = {
  calendar: CalendarDays,
  agenda: ListTodo,
  upcoming: Flag,
  todos: CheckSquare,
}

/* A preset is a grid description, not a JSX tree. Rendering the same slot
 * primitives for all four presets is what keeps "no page scroll" and "one
 * column below 1100px" true everywhere instead of in three of four presets. */
type GridSpec = { cols: string; rows: string; areas: string }
export const GRIDS: Record<PresetId, GridSpec> = {
  'calendar-first': {
    /* §26  left ~65% calendar full height; right ~35% (min 340px) stacked */
    cols: 'minmax(0,1.94fr) minmax(340px,1fr)',
    rows: 'minmax(0,1fr) minmax(0,0.62fr) minmax(0,0.62fr)',
    areas: '"cal side1" "cal side2" "cal side3"',
  },
  'today-first': {
    /* §30  left ~45% agenda full height; right ~55% calendar on top, then two
       beneath it side by side.
       `bl` and `br` are the areas SLOT_CELL names for this preset's last two
       slots, so they MUST be declared here. An earlier `'"ag cal" "ag side"'`
       declared `side` (which nothing references) and omitted `bl`/`br`, so those
       two panels were placed into IMPLICIT tracks — off the intended grid, even
       once the slot map was right. */
    cols: 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)',
    rows: 'minmax(0,1fr) minmax(0,0.9fr)',
    areas: '"ag cal cal" "ag bl br"',
  },
  'week-first': {
    /* §34  top ~60% week full width; bottom 3 equal columns */
    cols: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
    rows: 'minmax(0,1.5fr) minmax(0,1fr)',
    areas: '"wk wk wk" "a b c"',
  },
  focus: {
    /* §38  calendar full width; the other three live in the slide-in drawer */
    cols: 'minmax(0,1fr)',
    rows: 'minmax(0,1fr)',
    areas: '"cal"',
  },
}

/* Which grid cell each of a preset's four declared slots occupies. Exported so
 *  a test can hold it and `GRIDS` to the same set of area names — a slot naming
 *  an area the template never declares lands in an IMPLICIT track, which is how
 *  two of today-first's four panels went missing. */
export const SLOT_CELL: Record<PresetId, Record<string, string>> = {
  'calendar-first': { left: 'cal', 'right-top': 'side1', 'right-mid': 'side2', 'right-bottom': 'side3' },
  'today-first':   { left: 'ag',  'right-top': 'cal', 'right-bottom-left': 'bl', 'right-bottom-right': 'br' },
  'week-first':    { top: 'wk', 'bottom-left': 'a', 'bottom-mid': 'b', 'bottom-right': 'c' },
  focus:           { stage: 'cal', 'drawer-1': 'dr1', 'drawer-2': 'dr2', 'drawer-3': 'dr3' },
}

/* today-first puts Upcoming + Todos side by side under the calendar. That is
 *  now stated by the preset's own grid template (`"ag cal cal" "ag bl br"`), so
 *  the CELL_SPANS stopgap that used to live here is gone — it was never read. */

export interface ScheduleLayoutShellProps {
  selectedDate: string;
  onDateChange: (d: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  isToday: boolean;
  /** Renders the body of one panel. The shell never owns panel content. */
  renderPanel: (panel: PanelId, slot: string) => React.ReactNode;
  /** Focus preset (§39): Esc closes. */
  className?: string
}

export function ScheduleLayoutShell(props: ScheduleLayoutShellProps) {
  const { selectedDate, onDateChange, view, onViewChange, isToday, renderPanel } = props

  const [layout, setLayout] = useState<ScheduleLayout>(() => defaultLayout('today-first'))
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  /* Persist-on-change. `saveLayout` debounces internally (220ms) and the last
     write wins, so a drag does not hit settings storage on every frame. */
  const commit = useCallback((next: ScheduleLayout) => {
    setLayout(next)
    saveLayout(next)
  }, [])

  useEffect(() => {
    let alive = true
    loadLayout().then(l => { if (alive) setLayout(l) })
    return () => { alive = false }
  }, [])

  const slots = PRESET_SLOTS[layout.preset]
  const grid = GRIDS[layout.preset]

  /* ── §45 swap: drop one panel header onto another slot ── */
  const onDrop = useCallback((targetSlot: string) => {
    if (!dragging || dragging === targetSlot) { setDragging(null); setDragOver(null); return }
    /* `swapPanels` trades PANELS, but a drag reports SLOTS — resolve them
       through the map first. Passing the slot names straight through made every
       drop a silent no-op, because no slot holds a panel with the same name. */
    const a = layout.slots[dragging]
    const b = layout.slots[targetSlot]
    if (a && b) commit(swapPanels(layout, a, b))
    setDragging(null); setDragOver(null)
  }, [dragging, layout, commit])

  /* ── §49 resize: the divider only reports a raw fraction; clamping and
        snapping are the engine's job, so the limits cannot drift. ── */
  const resizeRef = useRef<{ slot: string; horizontal: boolean; start: number; startFrac: number; extent: number } | null>(null)
  const startResize = useCallback((slot: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    const host = (e.currentTarget as HTMLElement).parentElement
    if (!host) return
    /* week-first splits its bottom row horizontally, every other preset splits
     * vertically. Decide the axis ONCE here — deriving it per move event mixed
     * a Y delta against an X baseline. */
    const horizontal = layout.preset === 'week-first'
    const rect = host.getBoundingClientRect()
    resizeRef.current = {
      slot, horizontal,
      start: horizontal ? e.clientY : e.clientX,
      startFrac: layout.sizes[slot] ?? 0.5,
      /* the extent ALONG the split axis, which is height for week-first */
      extent: (horizontal ? rect.height : rect.width) || 1,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [layout.sizes])

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    const r = resizeRef.current
    /* `extent` (not `width`) — this field was renamed when the axis bug was
       fixed and one reference was missed, so the guard read `undefined` and the
       drag silently no-opped. */
    if (!r || r.extent <= 1) return
    const delta = (r.horizontal ? e.clientY : e.clientX) - r.start
    const raw = r.startFrac + delta / r.extent
    setLayout(prev => setSlotSize(prev, r.slot, snapSize(prev, r.slot, raw)))
  }, [layout.preset])

  const endResize = useCallback(() => {
    if (!resizeRef.current) return
    resizeRef.current = null
    saveLayout(layout)
  }, [layout])

  /* ── §64 keys ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Escape') { setMenuOpen(false); setDrawerOpen(false); return }
      const k = e.key.toLowerCase()
      if (k === 'm') onViewChange('month')
      else if (k === 'w') onViewChange('week')
      else if (k === 'd') onViewChange('day')
      /* 'T' means JUMP TO TODAY. Passing `selectedDate` back (which is what this
       * did) is a no-op that reads as a broken key. Today is derived here so
       * the caller never has to thread a second date down. */
      else if (k === 't') onDateChange(todayISO())
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const d = new Date(selectedDate + 'T00:00:00')
        d.setDate(d.getDate() + (e.key === 'ArrowRight' ? 1 : -1))
        onDateChange(d.toISOString().slice(0, 10))
      } else if ('1234'.includes(k)) {
        commit(withPreset(layout, PRESET_IDS[Number(k) - 1]))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, onViewChange, layout, commit, selectedDate, onDateChange])

  /* ── one panel cell ── */
  const cell = useCallback((slot: string) => {
    const panel = layout.slots[slot]
    if (!panel) return null
    const cellName = SLOT_CELL[layout.preset][slot]
    const hidden = isHidden(layout, panel)
    /* §47 hidden panels free their space entirely — they render nothing, not a
       collapsed shell, so the grid closes the gap. */
    if (hidden && !(layout.preset === 'focus' && slot.startsWith('drawer'))) return null

    const Icon = PANEL_ICON[panel]
    const meta = PANEL_META[panel]

    return (
      <div
        key={slot}
        className="contents"
      >
        <div
          style={{ gridArea: cellName }}
          className={[
            /* `flex-1` is inert while this element is a grid item, and gives the
               four panels an equal share of the column in the stacked fallback
               below 1100px — so the narrow path satisfies §17 the same way the
               grid does (fill the height, scroll inside) instead of stacking to
               a fixed floor and pushing the page past the viewport. */
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border',
            dragOver === slot ? 'border-[var(--page-accent)] ring-2 ring-[var(--page-accent)]/40' : 'border-zinc-800/60',
            'bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]',
          ].join(' ')}
          onDragOver={e => { e.preventDefault(); setDragOver(slot) }}
          onDragLeave={() => setDragOver(p => (p === slot ? null : p))}
          onDrop={() => onDrop(slot)}
        >
          {/* §45 the header is the drag handle; panels themselves never move. */}
          <div
            draggable
            onDragStart={() => setDragging(slot)}
            onDragEnd={() => { setDragging(null); setDragOver(null) }}
            className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b border-zinc-800/60 px-3 active:cursor-grabbing"
            title={`Drag to swap with another panel · ${meta.label}`}
          >
            <Icon size={12} className="text-zinc-500" aria-hidden />
            <span className="truncate text-[11px] font-medium text-zinc-400">{meta.label}</span>
            <span className="flex-1" />
            {/* §47 hide toggle, per panel, in its own header */}
            <button
              type="button"
              onClick={() => commit(toggleHidden(layout, panel))}
              aria-label={`${hidden ? 'Show' : 'Hide'} ${meta.label}`}
              className="rounded p-1 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
            >
              <EyeOff size={11} />
            </button>
          </div>

          {/* §17 each panel scrolls inside itself; the page never scrolls */}
          <div className="min-h-0 flex-1 overflow-auto ws-scroll">
            {renderPanel(panel, slot)}
          </div>

          {/* §49 divider. min/max/snap all live in PANEL_META via the engine. */}
          {layout.preset !== 'focus' && slot !== slots[slots.length - 1] && (
            <div
              onPointerDown={e => startResize(slot, e)}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              role="separator"
              aria-label={`Resize ${meta.label}`}
              className="h-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--page-accent-40)]"
            />
          )}
        </div>
      </div>
    )
  }, [layout, dragOver, dragging, renderPanel, startResize, onResizeMove, endResize, commit, slots, onDrop])

  const gridStyle = useMemo(() => ({
    /* `display` is deliberately NOT set here. An inline style outranks every
       class, so `display: 'grid'` in this object made the container a grid at
       ALL widths — including below 1100px, where §21 requires one column, and
       including when this element was the half that was supposed to be `hidden`.
       The mode is chosen by the `[@media(min-width:1100px)]:grid` class instead.
       The template below is inert until something turns the display on, so it
       costs nothing while the container is still a flex column. */
    gridTemplateColumns: grid.cols,
    gridTemplateRows: grid.rows,
    gridTemplateAreas: grid.areas,
    /* §17 no page scroll: the shell owns exactly the viewport minus the header */
    height: '100%',
    minHeight: 0,
    gap: '8px',
  }), [grid])

  const drawerSlots = slots.filter(s => s.startsWith('drawer'))

  return (
    /* §21 one column below 1100px, for every preset */
    <div className={`flex h-full min-h-0 flex-col gap-2 ${props.className ?? ''}`} data-page="schedule">
      {/* ── §19 header ── */}
      <header className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Schedule</h1>
          <span className="truncate text-[12px] text-zinc-500">{selectedDate}</span>
        </div>

        <span className="flex-1" />

        {/* §43 layout menu: 4 thumbnails, ~200ms, no bounce */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Layout"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >
            <LayoutGrid size={12} /> {PRESET_LABEL[layout.preset]}
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-9 z-50 w-56 rounded-xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-xl"
              >
                {PRESET_IDS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { commit(withPreset(layout, p)); setMenuOpen(false) }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-zinc-800"
                  >
                    {/* the thumbnail is the preset's own grid, at 1/4 scale */}
                    <span
                      aria-hidden
                      className="grid h-6 w-8 shrink-0 gap-[1px] rounded-sm border border-zinc-700 p-[1px]"
                      style={{
                        gridTemplateColumns: GRIDS[p].cols.split(' ').length === 1 ? '1fr' : '1.4fr 1fr',
                        gridTemplateRows: '1fr',
                        backgroundImage: `linear-gradient(to right, ${p === layout.preset ? 'var(--page-accent)' : 'transparent'} 22%, transparent 22%)`,
                        backgroundColor: p === layout.preset ? 'color-mix(in srgb, var(--page-accent) 18%, transparent)' : 'transparent',
                      }}
                    />
                    <span className={`text-[11px] ${p === layout.preset ? 'text-[var(--page-accent)]' : 'text-zinc-400'}`}>
                      {PRESET_LABEL[p]}
                    </span>
                  </button>
                ))}
                {/* §52 reset */}
                <div className="mt-1 border-t border-zinc-800 pt-1">
                  <button
                    type="button"
                    onClick={() => commit(defaultLayout(layout.preset))}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    <RotateCcw size={11} /> Reset layout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* §55 view toggle */}
        <div className="flex gap-0.5 rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5">
          {(['day', 'week', 'month'] as ViewMode[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`h-7 rounded px-2 text-[11px] capitalize transition-colors ${
                view === v ? 'bg-zinc-700/80 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >{v}</button>
          ))}
        </div>

        {/* §19 [<] [Today] [>] */}
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Previous day" onClick={() => {
            const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 1)
            onDateChange(d.toISOString().slice(0, 10))
          }} className="h-8 w-8 rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200">
            <ChevronLeft size={13} className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(selectedDate)}
            className={`h-8 rounded-md border px-2.5 text-[11px] ${isToday
              ? 'border-[var(--page-accent)]/40 text-[var(--page-accent)]'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'}`}
          >Today</button>
          <button type="button" aria-label="Next day" onClick={() => {
            const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1)
            onDateChange(d.toISOString().slice(0, 10))
          }} className="h-8 w-8 rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200">
            <ChevronRight size={13} className="mx-auto" />
          </button>
        </div>

        {/* §39 Focus: a thin edge tab opens the other three as a drawer */}
        {layout.preset === 'focus' && !drawerOpen && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="h-8 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
          >Panels</button>
        )}
      </header>

      {/* ── the grid (§17, §21) ──
       *
       * ONE container for both breakpoints, and every panel is rendered exactly
       * once. This used to be two sibling containers — a grid for ≥1100px and a
       * stacked copy for below — with CSS deciding which was visible. The narrow
       * end never worked: below 1100px BOTH were in flow, so every panel appeared
       * twice, and the first copy was still forced into the 2–3 column template,
       * which is what pushed panel content sideways out of its own column.
       *
       * Two reasons it could not be fixed by hiding one half: `gridStyle` used to
       * carry an inline `display: grid` that outranked `hidden`, and the stacked
       * copy was only hidden ABOVE 1100px, so below that both halves were live at
       * once. Deriving the mode from the media variant on a single element makes
       * the two mutually exclusive by construction.
       *
       * It also halves the mounts. A panel is a real consumer with its own
       * effects — the calendar derives a month of events, the upcoming and todo
       * panels fetch, ScheduleCard runs a minute timer — so the copy that could
       * never be seen was doubling every read and every timer on this page. */}
      <div
        style={gridStyle}
        className="flex min-h-0 flex-1 flex-col gap-2 [@media(min-width:1100px)]:grid"
      >
        {slots.filter(s => !s.startsWith('drawer')).map(cell)}
      </div>

      {/* §39 Focus drawer */}
      <AnimatePresence>
        {drawerOpen && layout.preset === 'focus' && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/50"
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed right-0 top-0 z-50 flex h-full w-[min(420px,90vw)] flex-col gap-2 border-l border-zinc-800 bg-zinc-900/95 p-3 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-zinc-300">Panels</span>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close panels" className="rounded p-1 text-zinc-500 hover:text-zinc-200">
                  <X size={14} />
                </button>
              </div>
              {drawerSlots.map(cell)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
import os
from pathlib import Path
os.chdir(Path(__file__).resolve().parent)

with open('src/components/MonthWall/MonthWall.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove console.log
content = content.replace("console.log('%c[MonthWall] v1.0 loaded', 'color:#fbbf24;font-weight:bold');\n", "")

# 2. Remove accent prop + usages
content = content.replace(
  "export function MonthWall({ accent = '#f59e0b', onMonthChange, renderDay, goals = [], deadlines = [], reminders = [], schedule = [], longTermGoals = [] }: MonthWallProps) {",
  "export function MonthWall({ onMonthChange, renderDay, goals = [], deadlines = [], reminders = [], schedule = [], longTermGoals = [] }: MonthWallProps) {"
)

# Remove accent from props interface
content = content.replace(
  "export interface MonthWallProps {\n  accent?: string;\n  onMonthChange?: (month: string) => void;\n",
  "export interface MonthWallProps {\n  onMonthChange?: (month: string) => void;\n"
)

# Remove all style={{ backgroundColor: accent }} and style={{ backgroundColor: `rgba(...)` }} and rgba(24,24,27) and rgba(255,255,255,0.06)
# Header accent block → use page token
content = content.replace(
  'style={{ backgroundColor: \'rgba(245,158,11,0.12)\', border: `1px solid ${accent}55` }}>',
  'style={{ backgroundColor: \'var(--color-card)\', border: \'1px solid var(--page-accent)\' }}>'
)
content = content.replace(
  '<CalendarDays size={15} style={{ color: accent }} />',
  '<CalendarDays size={15} style={{ color: \'var(--page-accent)\' }} />'
)

# Cell brightness rgba → token mapping
content = content.replace(
  "background: `rgba(24,24,27,${brightness})`,",
  "background: isPast ? 'var(--color-card)' : 'var(--color-background)',"
)

# Gloss line
content = content.replace(
  "style={{ background: 'rgba(255,255,255,0.06)' }}",
  "style={{ background: 'rgba(255,255,255,0.08)' }}"
)

# hueFor fallback
content = content.replace(
  "return style?.bg || style?.border || '#71717a';",
  "return style?.bg || style?.border || 'var(--color-muted-foreground)';"
)

# 3. Flatten 3D: remove perspective, transformStyle, translateZ, rotateX/Y, raf
content = content.replace(
  '<div ref={wallRef} className="relative" style={{ perspective: 1400 }} tabIndex={0} onKeyDown={onGridKeyDown} aria-label="Month calendar">',
  '<div ref={wallRef} className="relative" tabIndex={0} onKeyDown={onGridKeyDown} aria-label="Month calendar">'
)

# Remove 3D container + 3D inner grid
content = content.replace(
  '''        <div
            ref={containerRef}
            className="relative"
            style={{ transformStyle: 'preserve-3d' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="grid grid-cols-7 gap-[10px]" style={{ transformStyle: 'preserve-3d', padding: 10 }}>
              {grid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-11" />;
                const key = localDateKey(day);
                const isToday = key === todayKey;
                const isPast = key < todayKey;
                const row = Math.floor(idx / 7);
                const rowOffset = row - 2.5;
                const z = Math.max(-64, 48 - Math.abs(rowOffset) * 16);
                const brightness = isPast ? 0.75 : isToday ? 1 : 0.55;
                const list = eventsByDate[key] || [];

                return (
                  <Popover key={key} open={openDate === key} onOpenChange={(o) => (o ? openDay(key) : setOpenDate(null))}>
                    <PopoverTrigger asChild>
                      <div
                        style={{
                          transform: showFlat ? 'none' : `translateZ(${z}px)`,
                          zIndex: Math.round(100 - Math.abs(rowOffset)),
                          transition: reactiveTransition,
                        }}
                        className={`h-11 rounded-[6px] border cursor-pointer
                          ${isToday ? 'border-zinc-700/60' : isPast ? 'border-zinc-800/50' : 'border-zinc-800/40'}`}
                      >
                        <div className="relative h-full rounded-[6px] flex flex-col items-center justify-center p-1"
                          style={{
                            background: isPast ? 'var(--color-card)' : 'var(--color-background)',
                          }}>
                          <span className={`text-[11px] leading-none tabular-nums ${isToday ? 'font-bold text-zinc-100' : isPast ? 'text-zinc-500' : 'text-zinc-400'}`}>{day.getDate()}</span>
                          {list.length > 0 ? (
                            <div className="flex items-center gap-0.5 mt-0.5 flex-wrap justify-center">
                              {dots.map(d => (
                                <span key={d.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hueFor(d.category) }} />
                              ))}
                              {overflow > 0 && <span className="text-[8px] text-zinc-500">+{overflow}</span>}
                            </div>
                          ) : (
                            <span className="mt-0.5 h-1 w-1 rounded-full opacity-0 group-hover:opacity-40" style={{ backgroundColor: accent }} />
                          )}
                        </div>
                        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 bg-zinc-900 border-zinc-800 text-zinc-200">
                      <DayPanel date={day} events={getEventsForDay(events, key)} hueFor={hueFor} form={form} setForm={setForm} onSave={addEvent} onDelete={deleteEvent} inputRef={inputRef} />
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          </div>''',
  '''        <div className="grid grid-cols-7 gap-[10px]">
          {grid.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="h-11" />;
            const key = localDateKey(day);
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const list = eventsByDate[key] || [];

            return (
              <Popover key={key} open={openDate === key} onOpenChange={(o) => (o ? openDay(key) : setOpenDate(null))}>
                <PopoverTrigger asChild>
                  <div
                    className={`h-11 rounded-[6px] border cursor-pointer group
                      ${isToday ? 'border-zinc-700/60' : isPast ? 'border-zinc-800/50' : 'border-zinc-800/40'}`}
                  >
                    <div className="relative h-full rounded-[6px] flex flex-col items-center justify-center p-1"
                      style={{
                        background: isPast ? 'var(--color-card)' : 'var(--color-background)',
                      }}>
                      <span className={`text-[11px] leading-none tabular-nums ${isToday ? 'font-bold text-zinc-100' : isPast ? 'text-zinc-500' : 'text-zinc-400'}`}>{day.getDate()}</span>
                      {list.length > 0 ? (
                        <div className="flex items-center gap-0.5 mt-0.5 flex-wrap justify-center">
                          {dots.map(d => (
                            <span key={d.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hueFor(d.category) }} />
                          ))}
                          {overflow > 0 && <span className="text-[8px] text-zinc-500">+{overflow}</span>}
                        </div>
                      ) : (
                        <span className="mt-0.5 h-1 w-1 rounded-full opacity-0 group-hover:opacity-40" style={{ backgroundColor: 'var(--page-accent)' }} />
                      )}
                    </div>
                    <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-72 bg-zinc-900 border-zinc-800 text-zinc-200">
                  <DayPanel date={day} events={getEventsForDay(events, key)} hueFor={hueFor} form={form} setForm={setForm} onSave={addEvent} onDelete={deleteEvent} inputRef={inputRef} />
                </PopoverContent>
              </Popover>
            );
          })}
        </div>'''
)

# 4. Remove 3D state + handlers + timers
for old in [
  "  const [tiltX, setTiltX] = useState(0);\n  const [tiltY, setTiltY] = useState(0);\n  const [isDragging, setIsDragging] = useState(false);\n  const [showFlat, setShowFlat] = useState(false);\n  const [showReset, setShowReset] = useState(false);\n  const dragStart = useRef<{ x: number; y: number } | null>(null);\n  const tiltRef = useRef({ x: 0, y: 0 });\n  const rafRef = useRef<number>(0);\n",
  "  const applyTilt = useCallback((nx: number, ny: number) => {\n    tiltRef.current = { x: nx, y: ny };\n    if (rafRef.current) cancelAnimationFrame(rafRef.current);\n    rafRef.current = requestAnimationFrame(() => {\n      const { x, y } = tiltRef.current;\n      if (containerRef.current) {\n        containerRef.current.style.transform = showFlat ? 'none' : `rotateX(${x}deg) rotateY(${y}deg)`;\n      }\n      setTiltX(x);\n      setTiltY(y);\n    });\n  }, [showFlat]);\n\n  const onPointerDown = (e: React.PointerEvent) => {\n    if (showFlat || reducedMotion.current) return;\n    e.currentTarget.setPointerCapture(e.pointerId);\n    setIsDragging(true);\n    dragStart.current = { x: e.clientX, y: e.clientY };\n  };\n\n  const onPointerMove = useCallback((e: React.PointerEvent) => {\n    if (!isDragging || !dragStart.current) return;\n    const dx = e.clientX - dragStart.current.x;\n    const dy = e.clientY - dragStart.current.y;\n    const ny = Math.max(-35, Math.min(35, tiltRef.current.y + dx * 0.1));\n    const nx = Math.max(0, Math.min(30, tiltRef.current.x - dy * 0.1));\n    applyTilt(nx, ny);\n    dragStart.current = { x: e.clientX, y: e.clientY };\n    setShowReset(Math.abs(nx) > 8 || Math.abs(ny) > 8);\n  }, [isDragging, applyTilt]);\n\n  const onPointerUp = () => {\n    if (!isDragging) return;\n    setIsDragging(false);\n    dragStart.current = null;\n  };\n\n  const resetTilt = () => {\n    tiltRef.current = { x: 0, y: 0 };\n    applyTilt(0, 0);\n    setShowReset(false);\n    setShowFlat(false);\n  };\n\n  useLayoutEffect(() => {\n    if (containerRef.current) {\n      containerRef.current.style.transform = showFlat ? 'none' : `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;\n    }\n  }, [showFlat, tiltX, tiltY]);\n\n  const handleMouseMove = useCallback((e: React.MouseEvent) => {\n    if (showFlat || reducedMotion.current) return;\n    const rect = wallRef.current?.getBoundingClientRect();\n    if (!rect) return;\n    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 6;\n    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 6;\n    setTiltX(prev => Math.max(0, Math.min(30, prev + ny * 0.3)));\n    setTiltY(prev => Math.max(-35, Math.min(35, prev + nx * 0.5)));\n  }, [showFlat]);\n",
  ""
]:
  content = content.replace(old, "")

# Remove showFlat/reset UI
content = content.replace(
  '''          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowFlat(v => !v)}
            className="w-8 h-8 rounded-[6px] bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:text-white border border-zinc-700/50" title="Toggle perspective" aria-label="Toggle flat/perspective">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" transform="rotate(5 12 12)"/></svg>
          </motion.button>
          {showReset && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              onClick={resetTilt} className="h-8 px-2 rounded-[6px] bg-zinc-800/70 text-[10px] text-zinc-300 hover:text-white border border-zinc-700/50 whitespace-nowrap">
              RESET WALL
            </motion.button>
          )}''',
  ""
)

# Remove containerRef, unused wall handlers
content = content.replace(
  "  const containerRef = useRef<HTMLDivElement | null>(null);\n  const wallRef = useRef<HTMLDivElement | null>(null);\n\n  // 3D tilt state",
  "  const wallRef = useRef<HTMLDivElement | null>(null);\n"
)

# Remove onMouseLeave reset tilt
content = content.replace(
  "      onMouseMove={handleMouseMove}\n      onMouseLeave={() => { if (!isDragging && !showFlat) resetTilt(); }}",
  ""
)

# Remove unused imports
content = content.replace(
  "import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';\n",
  "import { useState, useEffect, useMemo, useRef, useCallback } from 'react';\n"
)

# Remove motion import if no longer needed for grid cells
# Keep motion for undo pill + tap scale if desired; here keep motion import

# Clamp radii: rounded-[6px] -> rounded-[8px] on cells, buttons, inputs, panels
replacements = {
  'rounded-[6px]': 'rounded-[8px]',
  'rounded-[10px]': 'rounded-[12px]',
}
for old, new in replacements.items():
  content = content.replace(old, new)

# Remove animate-pulse loading skeleton → static
content = content.replace(
  '        <div className="animate-pulse space-y-1.5" data-monthwall-state="loading">',
  '        <div className="space-y-1.5" data-monthwall-state="loading">'
)

# 5. keyboard month nav on header
content = content.replace(
  '''      {/* Month / Year */}\n      <div className="flex items-center justify-center mb-3">\n        <span className="text-[13px] font-semibold text-zinc-200">{MONTHS[month]} {year}</span>\n      </div>''',
  '''      {/* Month nav */}\n      <nav aria-label="Month" className="flex items-center justify-center gap-2 mb-3">\n        <button onClick={() => nav(-1)} aria-label="Previous month" className="h-7 w-7 rounded-[6px] border border-zinc-800 text-zinc-400 hover:text-white">‹</button>\n        <span className="text-[13px] font-semibold text-zinc-200 tabular-nums">{MONTHS[month]} {year}</span>\n        <button onClick={() => nav(1)} aria-label="Next month" className="h-7 w-7 rounded-[6px] border border-zinc-800 text-zinc-400 hover:text-white">›</button>\n      </nav>'''
)

# remove onKeyDown month nav
content = content.replace(
  '''  const onGridKeyDown = (e: React.KeyboardEvent) => {\n    if (e.key === 'PageUp') { e.preventDefault(); nav(-1); }\n    if (e.key === 'PageDown') { e.preventDefault(); nav(1); }\n  };''',
  ""
)
content = content.replace(
  '''<div ref={wallRef} className="relative" tabIndex={0} onKeyDown={onGridKeyDown} aria-label="Month calendar">''',
  '<div ref={wallRef} className="relative" aria-label="Month calendar">'
)

# Remove unused imports
content = content.replace(
  "import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';",
  "import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';\nimport { CATEGORY_COLORS, getCategoryColor } from '../../lib/CategoryColors';"
)
# Already imported, but ensure only once
content = content.replace(
  "import { CATEGORY_COLORS, getCategoryColor } from '../../lib/CategoryColors';\nimport type { Goal, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';\nimport { CATEGORY_COLORS, getCategoryColor } from '../../lib/CategoryColors';",
  "import type { Goal, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';\nimport { CATEGORY_COLORS, getCategoryColor } from '../../lib/CategoryColors';"
)

# Remove animate-pulse on LIVE dot and other status dots elsewhere? leave elsewhere.

# 6. Ensure reduced-motion TODO exists
if "TODO(M-1)" not in content:
  content = content.replace(
    "  const reactiveTransition = reducedMotion.current\n    ? 'none'\n    : 'background-color 140ms cubic-bezier(0.16,1,0.3,1), border-color 140ms cubic-bezier(0.16,1,0.3,1)';",
    "  const reactiveTransition = reducedMotion.current\n    ? '0ms'\n    : 'background-color 140ms cubic-bezier(0.16,1,0.3,1), border-color 140ms cubic-bezier(0.16,1,0.3,1)';\n  // TODO(M-1): unify with app motion-preference"
  )

with open('src/components/MonthWall/MonthWall.tsx', 'w', encoding='utf-8') as f:
  f.write(content)

print("Done")

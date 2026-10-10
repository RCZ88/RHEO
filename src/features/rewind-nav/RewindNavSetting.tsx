/**
 * RewindNavSetting.tsx — the Ctrl+K mode switch, as it appears in Settings.
 *
 * Lives beside the feature rather than in `pages/settings/` because the two modes
 * are a property OF the navigation feature, and the setting is meaningless without
 * knowing what "film" mode is. `pages/settings/ShortcutSection.tsx` was the obvious
 * home and turned out to be DEAD CODE — imported nowhere, with SettingsPage
 * rendering the shortcuts tab inline — so the control went where the tab actually
 * lives instead.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN INTENT (AGENTS.md §5b)
 *
 * 1. Idea — the setting IS the choice, so each option shows the shape of the mode
 *    rather than naming it. You pick by recognising a list or a film reel, not by
 *    reading "Classic" and hoping.
 * 2. Meaning — the diagrams are drawn from the real components: the reel has the
 *    six cutouts and hairline rim, the strip has the real sprocket pitch, and the
 *    selected state is the same amber used on screen. So the preview is a promise
 *    the implementation keeps.
 * 3. Meaning of the default — List is preselected because the film mode costs
 *    ~1.1s per navigation and is unfamiliar. Opting IN is the reversible choice;
 *    taxing everyone with the expensive mode is not.
 * 4. Fits — matte card, hairline border, same surface as every other Settings
 *    block. The novelty is the mode, not the control.
 *
 * States: this is a static two-value preference with no data behind it, so there
 * is nothing to be empty, loading or erroneous about. The one genuine state worth
 * handling is reduced motion, and that is surfaced explicitly below rather than
 * silently overridden.
 */
import { Film, List } from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { SectionHeader } from '@/components/SectionHeader'
import { effectiveMotion, useRewindSetting } from './useRewindSetting'
import type { RewindMotion } from './useRewindSetting'

export default function RewindNavSetting() {
  const { prefs, setMode, setMotion } = useRewindSetting()
  const effective = effectiveMotion(prefs)

  return (
    <GlassCard className="space-y-4">
      <SectionHeader title="Navigation" icon={<List className="w-5 h-5" />} />

      <p className="text-xs text-zinc-500">
        How Ctrl K opens. Both modes search every page and sub page, and both travel
        instantly with Shift Enter.
      </p>

      <div className="grid gap-3 pt-1 sm:grid-cols-2" role="radiogroup" aria-label="Navigation mode">
        <ModeCard
          selected={prefs.mode === 'classic'}
          onSelect={() => setMode('classic')}
          title="List"
          icon={<List className="h-3.5 w-3.5" aria-hidden />}
          blurb="Ranked rows, no animation. Fastest."
        >
          <ListDiagram />
        </ModeCard>

        <ModeCard
          selected={prefs.mode === 'film'}
          onSelect={() => setMode('film')}
          title="Rewind film"
          icon={<Film className="h-3.5 w-3.5" aria-hidden />}
          blurb="Reels and a film strip, with a rewind on travel."
        >
          <FilmDiagram />
        </ModeCard>
      </div>

      {prefs.mode === 'film' && (
        <>
          <div className="pt-1">
            <div className="mb-2 text-xs font-medium text-zinc-300">Rewind animation</div>
            <div className="flex gap-1" role="radiogroup" aria-label="Rewind animation">
              {(['full', 'quick', 'off'] as RewindMotion[]).map(m => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={prefs.motion === m}
                  onClick={() => setMotion(m)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    prefs.motion === m
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-600">
              If you travel more than three times in twenty seconds it drops to quick on its
              own, so a burst of navigation never feels slow.
            </p>
          </div>

          {/* Reduced motion is surfaced, never silently applied. The mode is the
              user's explicit choice, so we keep the film layout and drop only the
              travel animation, and we say so. */}
          {effective !== prefs.motion && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300/90">
              Your system asks for reduced motion, so travel is currently {effective}.
            </p>
          )}
        </>
      )}
    </GlassCard>
  )
}

function ModeCard({
  selected, onSelect, title, icon, blurb, children,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  icon: React.ReactNode
  blurb: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-zinc-700/40 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] hover:border-zinc-600/60 hover:bg-zinc-900/70 light:bg-[var(--ws-surface-raised)]'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={selected ? 'text-amber-400' : 'text-zinc-500'}>{icon}</span>
        <span className={`text-sm font-medium ${selected ? 'text-amber-200' : 'text-zinc-200'}`}>
          {title}
        </span>
        {selected && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-400">On</span>
        )}
      </span>
      <span className="block rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/60 p-2" aria-hidden>{children}</span>
      <span className="block text-[11px] leading-snug text-zinc-500">{blurb}</span>
    </button>
  )
}

/** Stacked rows with one highlighted — the literal shape of list mode. */
function ListDiagram() {
  return (
    <svg viewBox="0 0 120 52" className="h-14 w-full" aria-hidden>
      {[6, 18, 30, 42].map((y, i) => (
        <g key={y}>
          <rect
            x="4" y={y} width="112" height="9" rx="2"
            fill={i === 1 ? 'rgba(245,158,11,0.20)' : 'rgba(255,255,255,0.04)'}
          />
          <rect
            x="8" y={y + 3} width={i === 1 ? 42 : 30} height="3" rx="1.5"
            fill={i === 1 ? '#fbbf24' : '#52525b'}
          />
          <rect x="86" y={y + 3} width="26" height="3" rx="1.5" fill="#3f3f46" />
        </g>
      ))}
    </svg>
  )
}

/** A reel with six cutouts plus a sprocket strip with one lit frame — film mode. */
function FilmDiagram() {
  return (
    <svg viewBox="0 0 120 52" className="h-14 w-full" aria-hidden>
      <circle cx="18" cy="18" r="13" fill="#27272a" stroke="#52525b" strokeWidth="0.75" />
      {[0, 60, 120, 180, 240, 300].map(a => (
        <ellipse
          key={a} cx="18" cy="9.5" rx="2.4" ry="3.4" fill="#0b0b0d"
          transform={`rotate(${a} 18 18)`}
        />
      ))}
      <circle cx="18" cy="18" r="3" fill="#0b0b0d" />
      <rect x="40" y="14" width="76" height="20" rx="2" fill="#09090b" />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <rect key={`t${i}`} x={43 + i * 12.5} y="15.5" width="6" height="2.5" rx="0.8" fill="rgba(255,255,255,0.10)" />
      ))}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <rect key={`b${i}`} x={43 + i * 12.5} y="30" width="6" height="2.5" rx="0.8" fill="rgba(255,255,255,0.10)" />
      ))}
      <rect x="67" y="18" width="11" height="12" rx="1.5" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" strokeWidth="0.75" />
    </svg>
  )
}
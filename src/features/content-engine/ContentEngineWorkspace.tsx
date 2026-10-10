import { useCallback } from 'react'
import { useContentEngine, ContentEngineProvider } from './ContentEngineContext'
// The stage list lives in the page registry so ⌘K, the caption and this
// sidebar cannot disagree. Imported from the LEAF module (`pages/studio`),
// not the barrel, so this does not pull every other manifest in — and
// `types.ts` is type-only, so there is no runtime cycle either way.
import { CONTENT_ENGINE_STAGES } from '@/pages/registry/pages/studio'
import { resolveIcon } from '@/pages/registry/icons'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
// Removed here, all unreferenced in this file:
//   import { BlurFade } from './ui-laminar' — no ui-laminar.tsx at the feature
//     root (the module is at ./components/ui-laminar), so the specifier never
//     resolved. `React` default import is unused under the automatic JSX runtime,
//     and `Film` is not referenced. GradientShimmer, ShinyButton, NeonGradientCard,
//   Confetti and LightRays were likewise never used — and `Confetti` was a
//   broken specifier anyway, since the module exports `confetti` (lowercase).

import { AnimatedShinyText } from '@/components/ui/animated-shiny-text'
import { DotPattern } from '@/components/ui/dot-pattern'

import { BrainstormView } from './components/BrainstormView'
import { IdeasView } from './components/IdeasView'
import { EpisodesView } from './components/EpisodesView'
import { SeriesView } from './components/SeriesView'
import { ThemesView } from './components/ThemesView'
import { AnalyticsView } from './components/AnalyticsView'
import { LessonsView } from './components/LessonsView'
import { FrameworksView } from './components/FrameworksView'
import { ProcessGalleryView } from './components/ProcessGalleryView'
import { PlaybookView } from './components/PlaybookView'

// Single source of truth for the pipeline. This list used to live here AND
// as the hardcoded string "8-stage pipeline" below AND as
// `CONTENT_ENGINE_STAGES = 9` in labs/labRegistry.ts — three copies, all
// disagreeing, which is why `findIndex` could return -1 for `brainstorm`
// and the badge read "Stage 0 of 9". Now: one list, imported by the
// manifest too, so ⌘K and the caption cannot drift.
const PIPELINE_STAGES = CONTENT_ENGINE_STAGES.map(s => ({ ...s, icon: resolveIcon(s.icon) }))

function WorkspaceInner() {
  const { view, setView } = useContentEngine()

  // findIndex returns -1 for any view not in the nav list (brainstorm is
  // reachable but has no button), which rendered as "Stage 0". Clamp it.
  const stageIndex = Math.max(PIPELINE_STAGES.findIndex(s => s.id === view), 0)

  const renderView = useCallback(() => {
    switch (view) {
      case 'brainstorm': return <BrainstormView onNavigate={setView} />
      case 'ideas': return <IdeasView />
      case 'episodes': return <EpisodesView />
      case 'series': return <SeriesView />
      case 'themes': return <ThemesView />
      case 'analytics': return <AnalyticsView />
      case 'lessons': return <LessonsView />
      case 'frameworks': return <FrameworksView />
      case 'process': return <ProcessGalleryView />
      case 'playbook': return <PlaybookView />
      default: return <IdeasView />
    }
  }, [view, setView])

  return (
    <div className="flex h-full gap-0 p-3" data-page="content-engine">
      <aside className="flex w-52 shrink-0 flex-col rounded-xl border border-white/[0.08] bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] overflow-hidden">
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-white/70" />
            <AnimatedShinyText className="text-[11px] font-semibold tracking-wider text-zinc-200" shimmerWidth={80}>
              CONTENT ENGINE
            </AnimatedShinyText>
          </div>
          <div className="mt-0.5 text-[9px] text-zinc-500">{PIPELINE_STAGES.length}-stage pipeline</div>
        </div>
        <div className="flex-1 min-h-0 px-2 py-1 overflow-y-auto">
          <nav className="flex flex-col gap-0.5">
            {PIPELINE_STAGES.map((stage) => {
              const Icon = stage.icon
              const active = view === stage.id
              return (
                <button key={stage.id} onClick={() => setView(stage.id)}
                  className={cn(
                    'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[11px] font-medium transition-all duration-200',
                    active ? 'bg-white/[0.06] text-zinc-100' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                  )}>
                  <Icon size={13} />
                  <span>{stage.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
        <div className="px-3 py-2 border-t border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-zinc-500">Pipeline active</span>
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/80 light:bg-[var(--ws-surface-raised)]">
        {/* DotPattern only accepts className/opacity/radius/gap. The `colors`,
            `size` and `skip` props that were passed here do not exist on the
            component, so the whole call was a type error that silently dropped
            the intended 3% opacity. `gap` replaces the old `size` intent. */}
        <DotPattern
          className="absolute inset-0"
          opacity={0.03}
          radius={1}
          gap={16}
        />
        <div className="relative z-10 h-full overflow-y-auto" data-section={`engine.${view}`}>
          {renderView()}
        </div>
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
          <span className="text-[9px] text-zinc-500 px-2 py-0.5 rounded-full bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-white/[0.08]">
            Stage {stageIndex + 1} of {PIPELINE_STAGES.length}
          </span>
        </div>
      </main>
    </div>
  )
}

export function ContentEngineWorkspace() {
  return (
    <ContentEngineProvider>
      <WorkspaceInner />
    </ContentEngineProvider>
  )
}

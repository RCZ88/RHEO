import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { BrainVisualization } from './context-brain/BrainVisualization'
import { BrainManagementView } from './context-brain/BrainManagementView'
import { ExternalAITrail } from './context-brain/ExternalAITrail'
import type { GraphNode, GraphLink } from './context-graph/types'

// ── Shared accent palette (single source of truth) ──
export const ACCENTS = {
  purple:  '#8b5cf6',
  green:   '#22c55e',
  amber:   '#f59e0b',
  cyan:    '#06b6d4',
  rose:    '#f43f5e',
  slate:   '#71717a',
  surface: 'rgba(24,24,27,0.65)',
  border:  'rgba(255,255,255,0.06)',
}

// G2 (RESULT-M6, CZ-approved R-3): the slim view. All chrome — search, stats,
// legend, hint, AI Bridge chip and the EntityDetailPanel — is drawn once,
// inside BrainVisualization. The old fat view re-drew all of it around a
// hideChrome canvas, which is how two detail panels ended up alive at once.

export function ContextGraphView() {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 420 })
  const [state, setState] = useState<'loading' | 'empty' | 'error' | 'populated'>('loading')
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [hovered, setHovered] = useState<GraphNode | null>(null)
  const [selectionIds, setSelectionIds] = useState<Set<string>>(new Set())
  const firstLoad = useRef(true)

  // Resize only changes the canvas size. It never reloads data.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (r) setSize({ width: Math.floor(r.width), height: Math.floor(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const load = useCallback(async () => {
    const api = (window as any).deskflowAPI
    if (!api?.brainGetGraph) { setState('error'); return }
    if (firstLoad.current) setState('loading')
    try {
      const res = await api.brainGetGraph({ maxNodes: 300, maxFacts: 500, includeSynthetic: true })
      if (!res || res.status === 'error') { setState('error'); return }
      setNodes(res.nodes || [])
      setLinks(res.links || [])
      setState((res.nodes?.length ?? 0) > 0 ? 'populated' : 'empty')
    } catch {
      setState('error')
    } finally {
      firstLoad.current = false
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onClick = useCallback((n: GraphNode | null) => {
    setSelected(prev => (!n || prev?.id === n.id ? null : n))
    setSelectionIds(prev => (!n || prev.has(n.id) ? new Set() : new Set([n.id])))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div ref={boxRef} className="relative w-full" style={{ height: 'clamp(320px, 52vh, 460px)' }}>
        <BrainVisualization
          nodes={nodes}
          links={links}
          width={size.width}
          height={size.height}
          state={state}
          onNodeHover={setHovered}
          onNodeClick={onClick}
          hoveredNode={hovered}
          selectedNode={selected}
          selectionSet={selectionIds}
        />
        {/* Refresh sits bottom-right, but BOTH lower-right slots are already
            owned by BrainVisualization chrome (hint at bottom-3, AI Bridge
            chip at bottom-10 — both pointer-events-none, so bottom-3 would
            still be visually covered). bottom-20 clears both. */}
        <button
          type="button"
          onClick={load}
          aria-label="Refresh graph"
          className="absolute bottom-20 right-3 z-30 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <ExternalAITrail />
      <BrainManagementView />
    </div>
  )
}

/**
 * CanvasGraph — DEPRECATED ADAPTER. Use `BrainGraph` directly.
 *
 * ── Why this file still exists ──
 * `ContextGraphView.tsx` re-exports it, and something may still import the
 * name from there. Deleting the export chain is a CZ call, so this stays as a
 * thin pass-through rather than a second renderer.
 *
 * ── Why it is now 40 lines instead of 371 ──
 * This was an unmounted duplicate of `BrainGraph` (`rg "<CanvasGraph"` has no
 * hits), and it was actively harmful in three ways:
 *
 *  1. IT CRASHED. It called `d3.forceSimulation(...)` and typed
 *     `d3.Simulation<...>` while importing only *named* bindings, so the module
 *     scope had no `d3` at all. The moment anything rendered it, that was a
 *     `ReferenceError: d3 is not defined` inside a commit-phase effect — which
 *     unmounts the entire subtree, not just the canvas.
 *
 *  2. ITS EDGES VANISHED. It resolved endpoints with
 *     `nodes.find(n => n.id === link.source)`. `forceLink` REWRITES
 *     `link.source` from an id into a node object in place, so after the
 *     simulation had run that comparison was a string against an object,
 *     always false, and every edge hit the `continue`.
 *
 *  3. IT DRIFTED. Two renderers for the same job meant fixes landed in one and
 *     not the other — which is exactly how the edge bug and the crash ended up
 *     duplicated here in the first place.
 *
 * All three are gone: there is now one renderer, and it is the one with the
 * force layout, keyboard navigation and additive glow.
 */
import { BrainGraph } from './BrainGraph'
import type { GraphNode, GraphLink } from '../context-graph/types'

interface Props {
  nodes: GraphNode[]
  links: GraphLink[]
  width: number
  height: number
  onNodeHover?: (node: GraphNode | null) => void
  /** Historic signature omitted the `null` case; a click on empty space has to
   *  be able to clear the selection, so it is widened here. */
  onNodeClick?: (node: GraphNode | null) => void
  hoveredNode?: GraphNode | null
  selectedNode?: GraphNode | null
  selectionSet?: Set<string>
  reducedMotion?: boolean
}

export function CanvasGraph(props: Props) {
  return <BrainGraph {...props} />
}

export default CanvasGraph

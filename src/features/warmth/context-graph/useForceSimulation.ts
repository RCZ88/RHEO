import { useRef, useEffect, useCallback } from 'react'
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force-3d'
import type { GraphNode, GraphLink } from './types'

interface UseForceSimulationOptions {
  nodes: GraphNode[]
  links: GraphLink[]
  enabled?: boolean
}

export function useForceSimulation({ nodes, links, enabled = true }: UseForceSimulationOptions) {
  const simRef = useRef<ReturnType<typeof forceSimulation> | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const tickCountRef = useRef(0)

  // Update nodes ref without triggering re-renders
  nodesRef.current = nodes

  useEffect(() => {
    if (!enabled || nodes.length === 0) {
      if (simRef.current) {
        simRef.current.stop()
        simRef.current = null
      }
      return
    }

    // Create simulation
    const sim = forceSimulation(nodes, 3)
      .force('charge', forceManyBody().strength(-120).distanceMax(20))
      .force('link', forceLink(links as any).id((d: any) => d.id).distance(4).strength(0.5))
      .force('center', forceCenter(0, 0, 0).strength(0.05))
      .force('collide', forceCollide().radius(1.5).strength(0.7))
      .alphaDecay(0.02)
      .velocityDecay(0.3)

    // Run simulation synchronously to convergence
    for (let i = 0; i < 150; i++) {
      sim.tick()
      tickCountRef.current++
    }
    sim.stop()

    simRef.current = sim

    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [nodes, links, enabled])

  return { nodesRef }
}

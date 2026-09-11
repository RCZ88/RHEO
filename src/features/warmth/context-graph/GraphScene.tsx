import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GraphNodeMesh } from './GraphNode'
import { GraphEdge } from './GraphEdge'
import { useForceSimulation } from './useForceSimulation'
import type { GraphNode, GraphLink } from './types'

interface GraphSceneProps {
  nodes: GraphNode[]
  links: GraphLink[]
  selectedNodeId: string | null
  selectedNodeIds: Set<string>
  onNodeClick: (node: GraphNode, event: any) => void
  hoveredNodeId: string | null
  onNodeHover: (nodeId: string | null) => void
  hiddenTypes: Set<string>
  searchQuery: string
}

export function GraphScene({ nodes, links, selectedNodeId, selectedNodeIds, onNodeClick, hoveredNodeId, onNodeHover, hiddenTypes, searchQuery }: GraphSceneProps) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

  // Compute degree for each node
  const nodesWithDegree = useMemo(() => {
    const degreeMap = new Map<string, number>()
    for (const link of links) {
      const sId = typeof link.source === 'string' ? link.source : (link.source as any).id
      const tId = typeof link.target === 'string' ? link.target : (link.target as any).id
      degreeMap.set(sId, (degreeMap.get(sId) || 0) + 1)
      degreeMap.set(tId, (degreeMap.get(tId) || 0) + 1)
    }
    return nodes.map(n => ({
      ...n,
      degree: degreeMap.get(n.id) || 0,
    }))
  }, [nodes, links])

  // Run force simulation (positions mutated in place)
  const { nodesRef } = useForceSimulation({ nodes: nodesWithDegree, links })

  // Build node map for edge lookups
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>()
    for (const n of nodesWithDegree) map.set(n.id, n)
    return map
  }, [nodesWithDegree])

  // Find connected nodes for focus mode
  const connectedToSelected = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    const connected = new Set<string>([selectedNodeId])
    for (const link of links) {
      const sId = typeof link.source === 'string' ? link.source : (link.source as any).id
      const tId = typeof link.target === 'string' ? link.target : (link.target as any).id
      if (sId === selectedNodeId) connected.add(tId)
      if (tId === selectedNodeId) connected.add(sId)
    }
    return connected
  }, [selectedNodeId, links])

  // Determine dimming
  const isNodeDimmed = useCallback((node: GraphNode) => {
    if (hiddenTypes.has(node.type)) return true
    if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) return true
    if (selectedNodeIds.has(node.id)) return false
    if (selectedNodeId && !connectedToSelected.has(node.id)) return true
    return false
  }, [hiddenTypes, searchQuery, selectedNodeId, connectedToSelected, selectedNodeIds])

  const isEdgeDimmed = useCallback((link: GraphLink) => {
    if (selectedNodeId) {
      const sId = typeof link.source === 'string' ? link.source : (link.source as any).id
      const tId = typeof link.target === 'string' ? link.target : (link.target as any).id
      return !(sId === selectedNodeId || tId === selectedNodeId)
    }
    return false
  }, [selectedNodeId])

  const isEdgeHighlighted = useCallback((link: GraphLink) => {
    if (!selectedNodeId) return false
    const sId = typeof link.source === 'string' ? link.source : (link.source as any).id
    const tId = typeof link.target === 'string' ? link.target : (link.target as any).id
    return sId === selectedNodeId || tId === selectedNodeId
  }, [selectedNodeId])

  // Flash node on search match
  const flashNodeId = useMemo(() => {
    if (!searchQuery) return null
    const q = searchQuery.toLowerCase()
    const match = nodesWithDegree.find(n => n.name.toLowerCase().includes(q))
    return match?.id || null
  }, [searchQuery, nodesWithDegree])

  // Camera pan to selected node
  useEffect(() => {
    if (selectedNodeId) {
      const node = nodeMap.get(selectedNodeId)
      if (node && controlsRef.current) {
        const target = new THREE.Vector3(node.x, node.y, node.z)
        controlsRef.current.target.copy(target)
        // Pan camera to look at node from offset
        const offset = new THREE.Vector3(4, 3, 4)
        const newCamPos = target.clone().add(offset)
        camera.position.lerp(newCamPos, 0.5)
      }
    }
  }, [selectedNodeId, nodeMap, camera])

  return (
    <>
      <color attach="background" args={['#09090b']} />
      <fog attach="fog" args={['#09090b', 15, 40]} />

      <ambientLight intensity={0.3} />
      <pointLight position={[15, 15, 15]} intensity={0.6} color="#fafafa" />
      <pointLight position={[-10, -5, -10]} intensity={0.3} color="#3b82f6" />
      <pointLight position={[5, -10, 5]} intensity={0.2} color="#22c55e" />

      {/* Nodes */}
      {nodesWithDegree.map(node => (
        <GraphNodeMesh
          key={node.id}
          node={node}
          isSelected={selectedNodeIds.has(node.id)}
          isMultiSelected={selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)}
          isDimmed={isNodeDimmed(node)}
          flash={node.id === flashNodeId}
          onClick={(e: any) => onNodeClick(node, e)}
          onHover={(h: boolean) => onNodeHover(h ? node.id : null)}
        />
      ))}

      {/* Edges */}
      {links.map((link, i) => (
        <GraphEdge
          key={`${typeof link.source === 'string' ? link.source : (link.source as any).id}-${typeof link.target === 'string' ? link.target : (link.target as any).id}-${i}`}
          link={link}
          nodeMap={nodeMap}
          isDimmed={isEdgeDimmed(link)}
          isHighlighted={isEdgeHighlighted(link)}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={30}
        makeDefault
      />
    </>
  )
}

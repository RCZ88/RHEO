import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei'
import * as THREE from 'three'

interface GraphNode {
  id: string
  name: string
  type: string
  x: number
  y: number
  z: number
  facts: { predicate: string; value: string }[]
}

interface GraphEdge {
  from: string
  to: string
  predicate: string
}

interface ContextGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ═══ Color mapping by entity type ═══
const TYPE_COLORS: Record<string, string> = {
  goal: '#22c55e',
  project: '#3b82f6',
  deadline: '#ef4444',
  person: '#f59e0b',
  tool: '#8b5cf6',
  concept: '#06b6d4',
  default: '#71717a',
}

function getNodeColor(type: string): string {
  return TYPE_COLORS[type] || TYPE_COLORS.default
}

// ═══ Force-directed layout (simple spring simulation) ═══
function forceLayout(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]))
  const iterations = 50

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodeMap.get(nodes[i].id)!
        const b = nodeMap.get(nodes[j].id)!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1
        const force = 2.0 / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        const fz = (dz / dist) * force
        a.x -= fx; a.y -= fy; a.z -= fz
        b.x += fx; b.y += fy; b.z += fz
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.from)
      const b = nodeMap.get(edge.to)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dz = b.z - a.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1
      const force = (dist - 3.0) * 0.05
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force
      a.x += fx; a.y += fy; a.z += fz
      b.x -= fx; b.y -= fy; b.z -= fz
    }

    // Center gravity
    for (const node of nodeMap.values()) {
      node.x *= 0.98
      node.y *= 0.98
      node.z *= 0.98
    }
  }

  return Array.from(nodeMap.values())
}

// ═══ 3D Node Component ═══
function GraphNodeMesh({ node, onClick, isSelected }: { node: GraphNode; onClick: () => void; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = getNodeColor(node.type)
  const [hovered, setHovered] = useState(false)

  useFrame(() => {
    if (meshRef.current) {
      const scale = hovered ? 1.3 : isSelected ? 1.2 : 1.0
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1)
    }
  })

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.4 : isSelected ? 0.3 : 0.15}
          roughness={0.3}
          metalness={0.7}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, 0.55, 32]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.3 : 0.1} side={THREE.DoubleSide} />
      </mesh>
      {/* Label */}
      <Billboard position={[0, 0.7, 0]}>
        <Text
          fontSize={0.25}
          color={hovered ? '#ffffff' : '#a1a1aa'}
          anchorX="center"
          anchorY="bottom"
          font={undefined}
          maxWidth={3}
        >
          {node.name.length > 20 ? node.name.slice(0, 20) + '...' : node.name}
        </Text>
        <Text
          fontSize={0.15}
          color="#52525b"
          anchorX="center"
          anchorY="top"
          position={[0, -0.05, 0]}
        >
          {node.type}
        </Text>
      </Billboard>
    </group>
  )
}

// ═══ 3D Edge Component ═══
function GraphEdgeLine({ from, to, predicate }: { from: GraphNode; to: GraphNode; predicate: string }) {
  const points = useMemo(() => [
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ], [from.x, from.y, from.z, to.x, to.y, to.z])

  return (
    <Line
      points={points}
      color="#27272a"
      lineWidth={1}
      transparent
      opacity={0.4}
    />
  )
}

// ═══ Camera Controller ═══
function CameraController({ focusNode }: { focusNode?: GraphNode | null }) {
  const { camera } = useThree()

  useEffect(() => {
    if (focusNode) {
      const target = new THREE.Vector3(focusNode.x, focusNode.y, focusNode.z)
      camera.position.lerp(target.clone().add(new THREE.Vector3(3, 2, 3)), 0.5)
      camera.lookAt(target)
    }
  }, [focusNode, camera])

  return null
}

// ═══ Main Graph Component ═══
interface ContextGraphProps {
  data: ContextGraphData
  onNodeClick?: (node: GraphNode) => void
}

export function ContextGraph({ data, onNodeClick }: ContextGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  // Run force layout
  const laidOutNodes = useMemo(() => {
    if (data.nodes.length === 0) return []
    return forceLayout(data.nodes, data.edges)
  }, [data.nodes, data.edges])

  // Build node map for edge lookups
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>()
    for (const n of laidOutNodes) map.set(n.id, n)
    return map
  }, [laidOutNodes])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    onNodeClick?.(node)
  }, [onNodeClick])

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--ws-surface-sunken)', borderRadius: 12, overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [8, 6, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -5, -10]} intensity={0.3} color="#3b82f6" />

        {/* Nodes */}
        {laidOutNodes.map(node => (
          <GraphNodeMesh
            key={node.id}
            node={node}
            onClick={() => handleNodeClick(node)}
            isSelected={selectedNode?.id === node.id}
          />
        ))}

        {/* Edges */}
        {data.edges.map((edge, i) => {
          const from = nodeMap.get(edge.from)
          const to = nodeMap.get(edge.to)
          if (!from || !to) return null
          return <GraphEdgeLine key={i} from={from} to={to} predicate={edge.predicate} />
        })}

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={3}
          maxDistance={30}
        />
        <CameraController focusNode={selectedNode} />
      </Canvas>

      {/* Legend overlay */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        display: 'flex', gap: 8, flexWrap: 'wrap',
        padding: '6px 10px', borderRadius: 8,
        background: 'var(--ws-surface-raised)',
        border: '1px solid var(--ws-border)',
      }}>
        {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Node detail panel */}
      {selectedNode && (
        <div style={{
          position: 'absolute', top: 12, right: 12, width: 240, padding: 12, borderRadius: 10,
          background: 'var(--ws-surface-raised)',
          border: '1px solid var(--ws-border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedNode.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{selectedNode.type}</div>
          {selectedNode.facts.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Facts:</div>
              {selectedNode.facts.slice(0, 5).map((f, i) => (
                <div key={i} style={{ marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{f.predicate}</span>: {f.value}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              marginTop: 8, padding: '4px 8px', borderRadius: 6,
              background: 'var(--ws-surface-sunken)', border: 'none',
              color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

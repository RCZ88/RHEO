/** ActivityFeed — the suprathreshold readout complementing NeuralFlow's subthreshold hum.

 * Per spec §1: this is the "avalanche" window onto the same generative system.
 * It displays:
 *  - Cascade health (how many nodes are currently active, aggregate glow)
 *  - Recent avalanche sizes (the power-law distribution visualized as a bar)
 *  - A live event log of firing events with spike markers
 *
 * Reads the same activity state that drives BrainVisualization — one system,
 * two windows.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Activity } from 'lucide-react'
import type { GraphNode } from '../context-graph/types'
import { getNodeGlow } from './physics/avalanche'
import { ACCENTS } from '../ContextGraphView'

// ── Activity event types ──
export interface ActivityEvent {
  nodeId: string
  magnitude: number
  timestamp: number
  depth: number
}

// ── Props ──
interface ActivityFeedProps {
  nodes: GraphNode[]
  activity?: ActivityEvent[]
  reducedMotion?: boolean
}

const MAX_LOG = 30
const AVATAR_COLS = 20

// ── Helpers ──
function formatTimeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'now'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m`
}

function magnitudeColor(mag: number): string {
  if (mag > 0.7) return '#f59e0b'
  if (mag > 0.4) return '#fbbf24'
  return '#a16207'
}

// ── Component ──
export function ActivityFeed({ nodes, activity = [], reducedMotion = false }: ActivityFeedProps) {
  const [log, setLog] = useState<ActivityEvent[]>([])
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set())
  const tickRef = useRef<number>(0)

  // Track which nodes are currently "active" (recently fired)
  useEffect(() => {
    const now = Date.now()
    const active = new Set<string>()
    for (const node of nodes) {
      if (node.state === 'active' || (node.lastFiredAt !== undefined && now - node.lastFiredAt < 2000)) {
        active.add(node.id)
      }
    }
    setActiveNodes(active)
  }, [nodes])

  // Process incoming activity events into the log
  useEffect(() => {
    if (activity.length === 0) return
    const newEvents = activity.filter(e => {
      if (reducedMotion) return false
      const lastLog = log[0]
      if (!lastLog) return true
      return e.timestamp !== lastLog.timestamp || e.nodeId !== lastLog.nodeId
    })
    if (newEvents.length > 0) {
      setLog(prev => [...newEvents.map(e => ({ ...e })), ...prev].slice(0, MAX_LOG))
    }
  }, [activity, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick glow periodically — drives re-renders so glow stays live
  const [, setTick] = useState(0)
  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      setTick(t => t + 1)
    }, 250)
    return () => clearInterval(tickRef.current)
  }, [])

  // Aggregate glow — recomputed every render (cheap, ~nodes.length operations)
  const glow = useMemo(() => {
    const now = Date.now()
    let total = 0
    for (const node of nodes) {
      total += getNodeGlow(node, now)
    }
    return total
  }, [nodes])

  // Cascade size history (last AVATAR_COLS events)
  const cascadeHistory = useMemo(() => {
    const events = log.slice(0, AVATAR_COLS)
    return events.map(e => e.magnitude)
  }, [log])

  const activeCount = activeNodes.size
  const maxGlow = Math.max(1, glow)

  // Reduced-motion: show a static snapshot instead of a live log
  if (reducedMotion) {
    return (
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
          <Activity size={10} style={{ color: ACCENTS.cyan }} />
          Activity Snapshot
        </div>
        <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-600">
          {activeCount} nodes active · {nodes.length} total
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
        <Zap size={10} style={{ color: '#f59e0b' }} />
        Avalanche Activity
        {activeCount > 0 && (
          <span className="ml-auto flex items-center gap-1" style={{ color: '#f59e0b' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
            {activeCount} firing
          </span>
        )}
      </div>

      {/* Cascade health bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (activeCount / Math.max(1, nodes.length)) * 100)}%`,
              background: activeCount > 0 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : '#27272a',
            }}
          />
        </div>
        <span className="text-[9px] font-mono text-zinc-500 w-8 text-right">{activeCount}/{nodes.length}</span>
      </div>

      {/* Aggregate glow bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono text-zinc-600">glow</span>
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (glow / maxGlow) * 100)}%`,
              background: glow > 0.5 ? 'linear-gradient(90deg, #8b5cf6, #f59e0b)' : '#52525b',
              opacity: Math.max(0.3, glow / maxGlow),
            }}
          />
        </div>
        <span className="text-[9px] font-mono text-zinc-500 w-10 text-right">{glow.toFixed(2)}</span>
      </div>

      {/* Avalanche-size distribution (mini bar chart) */}
      <div className="flex items-end gap-[2px] h-10 mt-1">
        {cascadeHistory.map((mag, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-300"
            style={{
              height: `${Math.max(2, mag * 100)}%`,
              background: magnitudeColor(mag),
              opacity: Math.max(0.2, mag * 2),
              minWidth: 2,
            }}
          />
        ))}
        {cascadeHistory.length === 0 && (
          <span className="text-[9px] text-zinc-600 font-mono self-center">waiting…</span>
        )}
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-hidden flex flex-col gap-0.5 min-h-0">
        <AnimatePresence initial={false}>
          {log.slice(0, 10).map((event, i) => {
            const node = nodes.find(n => n.id === event.nodeId)
            return (
              <motion.div
                key={`${event.nodeId}-${event.timestamp}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 px-2 py-1 rounded text-[9px] font-mono"
                style={{ background: i === 0 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.01)' }}
              >
                <Zap size={8} style={{ color: magnitudeColor(event.magnitude), flexShrink: 0 }} />
                <span className="text-zinc-400 truncate flex-1">{node?.name ?? event.nodeId.slice(0, 12)}</span>
                <span style={{ color: magnitudeColor(event.magnitude) }}>×{event.magnitude.toFixed(2)}</span>
                <span className="text-zinc-600">{event.depth}h</span>
                <span className="text-zinc-700 shrink-0">{formatTimeAgo(event.timestamp)}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {log.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[9px] text-zinc-600">
            No spikes yet — the network is at rest
          </div>
        )}
      </div>
    </div>
  )
}

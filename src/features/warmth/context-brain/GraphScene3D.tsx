/**
 * GraphScene3D — the D6 3D renderer for the Context Brain (RESULT_PART2_3D.md).
 *
 * A second renderer over the SAME `brainGetGraph` payload `BrainVisualization`
 * already holds. No new IPC, no second fetch, no live physics simulation: the
 * layout is the deterministic function in `./graph3d/layout` (normalized 2D
 * plane → ground plane, hubs elevated by degree).
 *
 * Scene composition is EXACTLY what WP-3D-D specifies — nothing else, no
 * lights, no fog, no skybox, no background: one InstancedMesh for nodes, two
 * batched LineSegments buffers for edges (real = solid, synthetic = dashed),
 * one billboard ring for selection, DOM labels via CSS2DRenderer for the top
 * degrees + selection + hover. Unlit `MeshBasicMaterial` everywhere on
 * purpose: color-exact vs the 2D legend, zero lights, cheapest shader.
 *
 * React renders this component exactly twice per data change: once to mount,
 * once to unmount. No React state per frame — everything imperative in refs.
 *
 * Clock rule (WP-3D-G, hard requirement): every render-loop read of
 * `lastFiredAt` uses `now()` from `./physics/avalanche` — the same single
 * clock 2D uses. The wall clock and the frame clock are FORBIDDEN here;
 * click-vs-drag timing uses the pointer event's own `timeStamp`, and the fps
 * meter uses the rAF callback timestamp. The firing WINDOW is `GLOW_DECAY_MS`
 * from the same avalanche module — the exact constant `BrainGraph` consumes,
 * so both renderers read one window from one file.
 *
 * Interaction parity with 2D (WP-3D-E): orbit / pan / zoom / node-drag, one
 * absolute commit on pointer-up into the node object, mirroring the 2D canvas
 * contract. Empty-click mirrors BrainGraph exactly: `onNodeClick(null)` in 2D
 * clears selection, so `onSelect(null)` here does the same.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  InstancedMesh,
  SphereGeometry,
  MeshBasicMaterial,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  BufferGeometry,
  BufferAttribute,
  RingGeometry,
  Mesh,
  DynamicDrawUsage,
  DoubleSide,
  Matrix4,
  Color,
  Vector2,
  Vector3,
  Plane,
  Raycaster,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { GraphNode, GraphLink } from '../context-graph/types'
import {
  TYPE_COLORS,
  FIRING_AMBER,
  CAP_3D_NODES,
  CAP_3D_LINKS,
  CAP_3D_LABELS,
} from '../context-graph/types'
import { capFor3D, computeLayout3D, framingDistance, WORLD_R } from './graph3d/layout'
import { getNodeGlow, GLOW_DECAY_MS, now as avalancheNow } from './physics/avalanche'

export interface GraphScene3DProps {
  nodes: GraphNode[]
  links: GraphLink[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** SELECTION_ACCENT passed down by BrainVisualization (no import cycle). */
  accent: string
  reducedMotion: boolean
}

/** Camera pitch of the initial framing position. */
const TILT = (35 * Math.PI) / 180
/** Click vs drag threshold, from WP-3D-E: ≤4 px movement and <250 ms. */
const CLICK_MAX_PX = 4
const CLICK_MAX_MS = 250
/** Recenter transition duration (WP-3D-E double-click). */
const RECENTER_MS = 250

/** Node world radius from degree — mirrors 2D's degree-proportional sizing. */
function nodeRadius(degree: number, maxDegree: number): number {
  return 0.35 + 0.30 * (degree / maxDegree)
}

/**
 * The zinc-500 edge/table color. Read from the SHARED `TYPE_COLORS.default`
 * rather than hardcoding a second hex here — the default entry IS zinc-500
 * (#71717a) and the LAMINAR gate keeps raw hex out of `.tsx` files.
 */
const EDGE_HEX = TYPE_COLORS.default || '#71717a'

interface DragState {
  instanceId: number
  startX: number
  startY: number
  t0: number
  moved: boolean
  /** Pre-drag position, restored on pointercancel/leave. */
  origin: [number, number, number]
}

export default function GraphScene3D(props: GraphScene3DProps) {
  const { nodes, links, selectedId, onSelect, accent, reducedMotion } = props

  const containerRef = useRef<HTMLDivElement>(null)

  // Media-query half of reduced motion (WP-3D-I §9.3): live, listened.
  const [mediaRM, setMediaRM] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setMediaRM(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const rm = reducedMotion || mediaRM

  // Cull counts — recomputed per data change (NOT lazy one-shot state, which
  // would go stale when the payload refreshes).
  const cull = useMemo(() => capFor3D(nodes, links), [nodes, links])

  // ── Engine refs (built once on mount) ──
  const engineRef = useRef<{
    renderer: WebGLRenderer
    labelRenderer: CSS2DRenderer
    camera: PerspectiveCamera
    controls: OrbitControls
    scene: Scene
    mesh: InstancedMesh
    ring: Mesh
    synthLines: LineSegments
    realGeo: BufferGeometry
    synthGeo: BufferGeometry
    realPos: Float32Array
    realCol: Float32Array
    synthPos: Float32Array
    synthCol: Float32Array
    labels: Map<string, CSS2DObject>
    topLabelIds: Set<string>
    // data view
    capped: { nodes: GraphNode[]; links: GraphLink[] }
    pos: Float32Array
    byId: Map<string, number>
    radii: Float32Array
    firing: Set<number>
    // interaction
    raycaster: Raycaster
    dragPlane: Plane
    drag: DragState | null
    down: { x: number; y: number; t: number; hit: boolean } | null
    hoveredId: string | null
    selectedId: string | null
    // loop
    raf: number
    running: boolean
    rm: boolean
    visible: boolean
    frame: number
    fpsStart: number
    fpsFrames: number
    fpsAccum: number
    dprDropped: boolean
    dprRechecked: boolean
    // recenter animation
    recenter: { active: boolean; from: Vector3; t0: number } | null
    // callbacks (latest, via refs)
    onSelect: (id: string | null) => void
  } | null>(null)

  // Latest props for the imperative loop without re-subscribing.
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const rmRef = useRef(rm)
  rmRef.current = rm
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  // ── Data build (degrees, cap, layout) — mirrors BrainGraph's degreeMap ──
  // Producers hardcode `degree: 0` (documented in BrainGraph), so degrees are
  // counted from the link set here too, or capping/elevation would rank zeros.
  const buildData = useCallback(() => {
    const deg = new Map<string, number>()
    for (const l of links) {
      const s = l.source as string
      const t = l.target as string
      deg.set(s, (deg.get(s) || 0) + 1)
      deg.set(t, (deg.get(t) || 0) + 1)
    }
    const enriched = nodes.map(n => ({ ...n, degree: deg.get(n.id) ?? n.degree ?? 0 }))
    return capFor3D(enriched, links)
  }, [nodes, links])

  /** (Re)write instance matrices/colors + both edge buffers from the data view. */
  const writeInstances = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    const { mesh, capped, pos, radii } = eng
    const count = capped.nodes.length
    mesh.count = count
    const m = new Matrix4()
    const c = new Color()
    const maxDeg = Math.max(1, ...capped.nodes.map(n => n.degree))
    for (let i = 0; i < count; i++) {
      const n = capped.nodes[i]
      radii[i] = nodeRadius(n.degree, maxDeg)
      m.makeScale(radii[i], radii[i], radii[i])
      m.setPosition(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      mesh.setMatrixAt(i, m)
      c.set(TYPE_COLORS[n.type] || TYPE_COLORS.default)
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    eng.firing.clear()

    // ── Edge buffers (WP-3D-D §4.3, preallocated, draw-range limited) ──
    const { byId, realGeo, synthGeo, realPos, realCol, synthPos, synthCol } = eng
    const real: number[] = []
    const synth: number[] = []
    for (const l of capped.links) {
      const a = byId.get(l.source)
      const b = byId.get(l.target)
      if (a === undefined || b === undefined) continue // endpoint culled
      const arr = l.synthetic ? synth : real
      arr.push(a, b)
    }
    let ri = 0
    let si = 0
    const baseColor = new Color(EDGE_HEX)
    for (let k = 0; k < real.length; k += 2) {
      const a = real[k], b = real[k + 1]
      for (const v of [a, b]) {
        realPos[ri] = pos[v * 3]; realPos[ri + 1] = pos[v * 3 + 1]; realPos[ri + 2] = pos[v * 3 + 2]
        realCol[ri] = baseColor.r; realCol[ri + 1] = baseColor.g; realCol[ri + 2] = baseColor.b
        ri += 3
      }
    }
    for (let k = 0; k < synth.length; k += 2) {
      const a = synth[k], b = synth[k + 1]
      for (const v of [a, b]) {
        synthPos[si] = pos[v * 3]; synthPos[si + 1] = pos[v * 3 + 1]; synthPos[si + 2] = pos[v * 3 + 2]
        synthCol[si] = baseColor.r; synthCol[si + 1] = baseColor.g; synthCol[si + 2] = baseColor.b
        si += 3
      }
    }
    realGeo.setDrawRange(0, ri / 3)
    synthGeo.setDrawRange(0, si / 3)
    ;(realGeo.getAttribute('position') as BufferAttribute).needsUpdate = true
    ;(synthGeo.getAttribute('position') as BufferAttribute).needsUpdate = true
    ;(realGeo.getAttribute('color') as BufferAttribute).needsUpdate = true
    ;(synthGeo.getAttribute('color') as BufferAttribute).needsUpdate = true
    eng.synthLines.computeLineDistances()
    applySelection(eng.selectedId, true)
    renderOnce()
  }, [])

  /** Firing pass (WP-3D-D §4.4). Only firing instances are rewritten per frame. */
  const applyFiring = useCallback((t: number) => {
    const eng = engineRef.current
    if (!eng) return
    const nowMs = avalancheNow()
    const { mesh, capped, radii } = eng
    const m = new Matrix4()
    const amber = new Color(FIRING_AMBER)
    let dirty = false
    for (let i = 0; i < capped.nodes.length; i++) {
      const n = capped.nodes[i]
      // Firing window test. Live motion uses getNodeGlow's envelope; reduced
      // motion mirrors BrainGraph's static check verbatim — full peak over the
      // SAME GLOW_DECAY_MS window both renderers read (one clock, one window).
      const isFiring = eng.rm
        ? !!(n.lastFiredAt && nowMs - n.lastFiredAt < GLOW_DECAY_MS)
        : getNodeGlow(n, nowMs) > 0.01
      if (isFiring) {
        const was = eng.firing.has(i)
        eng.firing.add(i)
        // Pulse 1 + 0.15·(0.5+0.5·sin(2π·t/600)) scaled by lastFiredPeak.
        const peak = n.lastFiredPeak ?? 1
        const pulse = eng.rm
          ? 1 // reduced motion: static amber, no pulse
          : 1 + 0.15 * peak * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 600))
        m.makeScale(radii[i] * pulse, radii[i] * pulse, radii[i] * pulse)
        m.setPosition(eng.pos[i * 3], eng.pos[i * 3 + 1], eng.pos[i * 3 + 2])
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, amber)
        dirty = was || true
      } else if (eng.firing.has(i)) {
        // Left the firing window — restore the base matrix + type color once.
        eng.firing.delete(i)
        m.makeScale(radii[i], radii[i], radii[i])
        m.setPosition(eng.pos[i * 3], eng.pos[i * 3 + 1], eng.pos[i * 3 + 2])
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, new Color(TYPE_COLORS[n.type] || TYPE_COLORS.default))
        dirty = true
      }
    }
    if (dirty) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [])

  /** One frame of the live loop. */
  const frameLoop = useCallback((t: number) => {
    const eng = engineRef.current
    if (!eng) return
    eng.raf = requestAnimationFrame(frameLoop)

    // ── Adaptive DPR (WP-3D-I §9.2): rolling 120-frame avg after 60-frame warmup ──
    if (!eng.dprDropped && eng.frame > 60) {
      if (eng.fpsFrames === 0) eng.fpsStart = t
      eng.fpsFrames++
      eng.fpsAccum = t - eng.fpsStart
      if (eng.fpsFrames >= 120) {
        const fps = eng.fpsFrames / (eng.fpsAccum / 1000)
        if (!eng.dprRechecked) {
          if (fps < 45) {
            eng.renderer.setPixelRatio(1)
            eng.dprDropped = true
            // eslint-disable-next-line no-console
            console.info('[brain3d] dpr->1')
          }
          eng.dprRechecked = true
        } else if (fps < 40) {
          // No further degradation — no silent death spiral (CZ sees it in T13).
          eng.dprDropped = true
        }
        eng.fpsFrames = 0
        eng.fpsAccum = 0
      }
    }
    eng.frame++

    eng.controls.update()
    applyFiring(t)

    // Selection ring billboards to the camera while visible.
    if (eng.ring.visible) eng.ring.quaternion.copy(eng.camera.quaternion)

    // Recenter animation (double-click, WP-3D-E): smooth 250 ms damp.
    if (eng.recenter?.active) {
      const p = Math.min(1, (t - eng.recenter.t0) / RECENTER_MS)
      const e = 1 - Math.pow(1 - p, 3) // ease-out
      eng.camera.position.lerpVectors(eng.recenter.from, framingPosition(eng), e)
      if (p >= 1) eng.recenter.active = false
    }

    eng.renderer.render(eng.scene, eng.camera)
    eng.labelRenderer.render(eng.scene, eng.camera)
  }, [applyFiring])

  /** Initial camera framing position (WP-3D-D: 35° down-tilt on +Z). */
  const framingPosition = useCallback((eng: NonNullable<typeof engineRef.current>): Vector3 => {
    const d = framingDistance(WORLD_R + 0.7, 50, eng.camera.aspect)
    return new Vector3(0, d * Math.sin(TILT), d * Math.cos(TILT))
  }, [])

  /** Render exactly one frame (reduced-motion path + on-demand renders). */
  const renderOnce = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    if (eng.ring.visible) eng.ring.quaternion.copy(eng.camera.quaternion)
    applyFiring(0)
    eng.renderer.render(eng.scene, eng.camera)
    eng.labelRenderer.render(eng.scene, eng.camera)
  }, [applyFiring])

  /** Start/stop the RAF loop (WP-3D-I: zero loop, not throttled, when hidden). */
  const syncLoop = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    const shouldRun = !eng.rm && eng.visible && !document.hidden
    if (shouldRun && !eng.running) {
      eng.running = true
      eng.raf = requestAnimationFrame(frameLoop)
    } else if (!shouldRun && eng.running) {
      cancelAnimationFrame(eng.raf)
      eng.running = false
    }
    if (eng.rm) renderOnce()
  }, [frameLoop, renderOnce])

  // ── Labels (WP-3D-D: top 12 by degree + selected + hovered) ──
  const ensureLabel = useCallback((id: string): CSS2DObject | null => {
    const eng = engineRef.current
    if (!eng) return null
    let obj = eng.labels.get(id)
    if (obj) return obj
    const i = eng.byId.get(id)
    if (i === undefined) return null
    const n = eng.capped.nodes[i]
    const el = document.createElement('div')
    el.className = 'pointer-events-none select-none whitespace-nowrap max-w-[180px] truncate text-[11px] leading-none text-zinc-200 -translate-y-3'
    el.textContent = n.name
    obj = new CSS2DObject(el)
    obj.position.set(eng.pos[i * 3], eng.pos[i * 3 + 1], eng.pos[i * 3 + 2])
    eng.scene.add(obj)
    eng.labels.set(id, obj)
    return obj
  }, [])

  const pruneLabels = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    const keep = new Set(eng.topLabelIds)
    if (eng.selectedId) keep.add(eng.selectedId)
    if (eng.hoveredId) keep.add(eng.hoveredId)
    for (const [id, obj] of eng.labels) {
      if (!keep.has(id)) {
        eng.scene.remove(obj)
        obj.element.remove()
        eng.labels.delete(id)
      }
    }
  }, [])

  /** Selection side-effects: ring, edge dimming, labels (event-driven, not per frame). */
  const applySelection = useCallback((id: string | null, force = false) => {
    const eng = engineRef.current
    if (!eng) return
    const changed = force || eng.selectedId !== id
    eng.selectedId = id
    if (!changed) return

    // Ring (WP-3D-D §4.2): accent, scaled to nodeR × 1.38, hidden when none.
    const i = id ? eng.byId.get(id) : undefined
    if (id && i !== undefined) {
      const r = eng.radii[i] * 1.38
      eng.ring.scale.set(r, r, r)
      eng.ring.position.set(eng.pos[i * 3], eng.pos[i * 3 + 1], eng.pos[i * 3 + 2])
      eng.ring.visible = true
    } else {
      eng.ring.visible = false
    }

    // Edge dimming (WP-3D-D §4.3 note): on selection change rewrite the color
    // attributes — edges touching the selected node full zinc-500, others ×0.25.
    const full = new Color(EDGE_HEX)
    const dim = new Color(EDGE_HEX).multiplyScalar(0.25)
    if (id) {
      const { capped, realCol, synthCol } = eng
      const realLinks = capped.links.filter(l => !l.synthetic)
      let ri = 0
      for (const l of realLinks) {
        const touches = l.source === id || l.target === id
        const cc = touches ? full : dim
        realCol[ri] = cc.r; realCol[ri + 1] = cc.g; realCol[ri + 2] = cc.b; ri += 3
        realCol[ri] = cc.r; realCol[ri + 1] = cc.g; realCol[ri + 2] = cc.b; ri += 3
      }
      let si = 0
      for (const l of capped.links) {
        if (l.synthetic) {
          const touches = l.source === id || l.target === id
          const cc = touches ? full : dim
          synthCol[si] = cc.r; synthCol[si + 1] = cc.g; synthCol[si + 2] = cc.b; si += 3
          synthCol[si] = cc.r; synthCol[si + 1] = cc.g; synthCol[si + 2] = cc.b; si += 3
        }
      }
      ;(eng.realGeo.getAttribute('color') as BufferAttribute).needsUpdate = true
      ;(eng.synthGeo.getAttribute('color') as BufferAttribute).needsUpdate = true
    }

    if (id) ensureLabel(id)
    pruneLabels()
  }, [ensureLabel, pruneLabels])

  // ── Pointer helpers ──
  const pickAt = useCallback((clientX: number, clientY: number): number | null => {
    const eng = engineRef.current
    const el = containerRef.current
    if (!eng || !el) return null
    const rect = el.getBoundingClientRect()
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    eng.raycaster.setFromCamera(ndc, eng.camera)
    const hits = eng.raycaster.intersectObject(eng.mesh)
    return hits.length ? (hits[0].instanceId ?? null) : null
  }, [])

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const eng = engineRef.current
    if (!eng) return
    const hit = pickAt(e.clientX, e.clientY)
    eng.down = { x: e.clientX, y: e.clientY, t: e.timeStamp, hit: hit !== null }
    if (hit !== null) {
      const captureEl = e.currentTarget as Element | null
      captureEl?.setPointerCapture(e.pointerId)
      const i = hit
      eng.drag = {
        instanceId: i,
        startX: e.clientX,
        startY: e.clientY,
        t0: e.timeStamp,
        moved: false,
        origin: [eng.pos[i * 3], eng.pos[i * 3 + 1], eng.pos[i * 3 + 2]],
      }
      // Freeze the camera for the gesture (WP-3D-E).
      eng.controls.enabled = false
    }
  }, [pickAt])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const eng = engineRef.current
    if (!eng) return

    // Live node drag in the camera-facing plane through the node (WP-3D-E).
    const drag = eng.drag
    if (drag) {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (!drag.moved && dx * dx + dy * dy > CLICK_MAX_PX * CLICK_MAX_PX) drag.moved = true
      const rect = containerRef.current!.getBoundingClientRect()
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      eng.raycaster.setFromCamera(ndc, eng.camera)
      const i = drag.instanceId
      // Plane through the node, facing the camera.
      const normal = eng.camera.getWorldDirection(new Vector3())
      eng.dragPlane.setFromNormalAndCoplanarPoint(
        normal,
        new Vector3(eng.pos[i * 3], eng.pos[i * 3 + 1], eng.pos[i * 3 + 2]),
      )
      const target = new Vector3()
      if (eng.raycaster.ray.intersectPlane(eng.dragPlane, target)) {
        eng.pos[i * 3] = target.x
        eng.pos[i * 3 + 1] = target.y
        eng.pos[i * 3 + 2] = target.z
        const m = new Matrix4()
        const r = eng.radii[i]
        m.makeScale(r, r, r)
        m.setPosition(target.x, target.y, target.z)
        eng.mesh.setMatrixAt(i, m)
        eng.mesh.instanceMatrix.needsUpdate = true
        // Labels and the ring follow the node while it moves.
        const label = eng.labels.get(eng.capped.nodes[i].id)
        if (label) label.position.copy(target)
        if (eng.selectedId === eng.capped.nodes[i].id) eng.ring.position.copy(target)
      }
      return
    }

    // Hover (event-driven label/cursor updates — no per-frame work).
    const hit = pickAt(e.clientX, e.clientY)
    const id = hit !== null ? eng.capped.nodes[hit]?.id ?? null : null
    if (id !== eng.hoveredId) {
      eng.hoveredId = id
      if (id) ensureLabel(id)
      pruneLabels()
      containerRef.current!.style.cursor = id ? 'pointer' : 'grab'
    }
  }, [pickAt, ensureLabel, pruneLabels])

  /** The absolute commit on pointer-up — mirrors the 2D canvas contract (WP-3D-E). */
  const commitDrag = useCallback((instanceId: number) => {
    const eng = engineRef.current
    if (!eng) return
    const n = eng.capped.nodes[instanceId]
    const p = eng.pos
    n.x = p[instanceId * 3]
    n.y = p[instanceId * 3 + 1]
    n.z = p[instanceId * 3 + 2] // absolute, one write
    n.vx = 0; n.vy = 0; n.vz = 0
    eng.controls.enabled = true
  }, [])

  const endDrag = useCallback((e: PointerEvent, cancelled: boolean) => {
    const eng = engineRef.current
    if (!eng) return
    const drag = eng.drag
    const down = eng.down
    eng.down = null
    if (drag) {
      eng.drag = null
      try { (e.currentTarget as Element | null)?.releasePointerCapture(e.pointerId) } catch { /* already released */ }
      if (cancelled) {
        // Canceling restores the pre-drag position and still re-enables controls.
        const i = drag.instanceId
        eng.pos[i * 3] = drag.origin[0]
        eng.pos[i * 3 + 1] = drag.origin[1]
        eng.pos[i * 3 + 2] = drag.origin[2]
        const m = new Matrix4()
        const r = eng.radii[i]
        m.makeScale(r, r, r)
        m.setPosition(drag.origin[0], drag.origin[1], drag.origin[2])
        eng.mesh.setMatrixAt(i, m)
        eng.mesh.instanceMatrix.needsUpdate = true
        const label = eng.labels.get(eng.capped.nodes[i].id)
        if (label) label.position.set(drag.origin[0], drag.origin[1], drag.origin[2])
        if (eng.selectedId === eng.capped.nodes[i].id) eng.ring.position.set(drag.origin[0], drag.origin[1], drag.origin[2])
        eng.controls.enabled = true
        return
      }
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const dt = e.timeStamp - drag.t0
      const isClick = !drag.moved && dx * dx + dy * dy <= CLICK_MAX_PX * CLICK_MAX_PX && dt < CLICK_MAX_MS
      commitDrag(drag.instanceId)
      if (isClick) selectRef.current(eng.capped.nodes[drag.instanceId].id)
      return
    }
    // Empty-space click: no drag, ≤4 px, <250 ms → same as 2D's empty click (PIN §5).
    if (down && !down.hit) {
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      const dt = e.timeStamp - down.t
      if (dx * dx + dy * dy <= CLICK_MAX_PX * CLICK_MAX_PX && dt < CLICK_MAX_MS) {
        selectRef.current(null)
      }
    }
  }, [commitDrag])

  const handleDoubleClick = useCallback((e: MouseEvent) => {
    const eng = engineRef.current
    if (!eng) return
    const hit = pickAt(e.clientX, e.clientY)
    if (hit !== null) return // double-click on a node is not a recenter
    if (eng.rm) {
      // Reduced motion: instant.
      eng.camera.position.copy(framingPosition(eng))
      eng.controls.update()
      renderOnce()
      return
    }
    // t0 uses the event's own DOM timestamp — this file contains no wall-clock
    // or frame-clock call at all (the fire clock is avalanche's now(); this is
    // a UI-gesture timer and gets the same source as the click-vs-drag gate).
    eng.recenter = { active: true, from: eng.camera.position.clone(), t0: e.timeStamp }
  }, [pickAt, framingPosition, renderOnce])

  // ── Mount ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const scene = new Scene()
    const renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0) // transparent over the page zinc — same surface treatment as 2D
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.touchAction = 'none'
    el.appendChild(renderer.domElement)

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.inset = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    el.appendChild(labelRenderer.domElement)

    const camera = new PerspectiveCamera(50, 1, 0.1, 400)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 4
    controls.maxDistance = 120
    controls.autoRotate = false // decorative idle rotation is exactly what this spec does not build

    // ── Nodes: one InstancedMesh ──
    const sphereGeo = new SphereGeometry(1, 16, 12)
    const nodeMat = new MeshBasicMaterial({ vertexColors: false })
    const mesh = new InstancedMesh(sphereGeo, nodeMat, CAP_3D_NODES)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    scene.add(mesh)

    // ── Edges: two batched LineSegments (real solid, synthetic dashed) ──
    const realPos = new Float32Array(CAP_3D_LINKS * 6)
    const realCol = new Float32Array(CAP_3D_LINKS * 6)
    const synthPos = new Float32Array(CAP_3D_LINKS * 6)
    const synthCol = new Float32Array(CAP_3D_LINKS * 6)
    const realGeo = new BufferGeometry()
    realGeo.setAttribute('position', new BufferAttribute(realPos, 3))
    realGeo.setAttribute('color', new BufferAttribute(realCol, 3))
    realGeo.setDrawRange(0, 0)
    const synthGeo = new BufferGeometry()
    synthGeo.setAttribute('position', new BufferAttribute(synthPos, 3))
    synthGeo.setAttribute('color', new BufferAttribute(synthCol, 3))
    synthGeo.setDrawRange(0, 0)
    const realMat = new LineBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.55,
    })
    const synthMat = new LineDashedMaterial({
      color: 0xffffff, vertexColors: true, dashSize: 0.6, gapSize: 0.45, transparent: true, opacity: 0.3,
    })
    const realLines = new LineSegments(realGeo, realMat)
    const synthLines = new LineSegments(synthGeo, synthMat)
    realLines.frustumCulled = false
    synthLines.frustumCulled = false
    scene.add(realLines)
    scene.add(synthLines)

    // ── Selection ring: accent billboard (WP-3D-D §4.2) ──
    const ringGeo = new RingGeometry(1, 1.14, 48)
    const ringMat = new MeshBasicMaterial({
      color: new Color(accent), side: DoubleSide, transparent: true, opacity: 0.95,
    })
    const ring = new Mesh(ringGeo, ringMat)
    ring.visible = false
    scene.add(ring)

    engineRef.current = {
      renderer, labelRenderer, camera, controls, scene, mesh, ring, synthLines,
      realGeo, synthGeo, realPos, realCol, synthPos, synthCol,
      labels: new Map(), topLabelIds: new Set(),
      capped: { nodes: [], links: [] },
      pos: new Float32Array(0),
      byId: new Map(),
      radii: new Float32Array(CAP_3D_NODES),
      firing: new Set(),
      raycaster: new Raycaster(),
      dragPlane: new Plane(),
      drag: null, down: null, hoveredId: null, selectedId: null,
      raf: 0, running: false, rm: rmRef.current, visible: true,
      frame: 0, fpsStart: 0, fpsFrames: 0, fpsAccum: 0, dprDropped: false, dprRechecked: false,
      recenter: null,
      onSelect: selectRef.current,
    }

    // Initial size + framing.
    const rect = el.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    renderer.setSize(w, h, false)
    labelRenderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    camera.position.copy(framingPosition(engineRef.current))
    camera.lookAt(0, 0, 0)

    // Resize: ResizeObserver on the mount div (WP-3D-D §4.5).
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (!r || !engineRef.current) return
      const cw = Math.max(1, r.width)
      const ch = Math.max(1, r.height)
      engineRef.current.renderer.setSize(cw, ch, false)
      engineRef.current.labelRenderer.setSize(cw, ch)
      engineRef.current.camera.aspect = cw / ch
      engineRef.current.camera.updateProjectionMatrix()
      if (engineRef.current.rm) renderOnce()
    })
    ro.observe(el)

    // IntersectionObserver: pause RAF when <30% visible (not throttled — stopped).
    const io = new IntersectionObserver(entries => {
      if (!engineRef.current) return
      engineRef.current.visible = (entries[0]?.intersectionRatio ?? 0) >= 0.3
      syncLoop()
    }, { threshold: [0.3] })
    io.observe(el)

    const onVis = () => { if (engineRef.current) { /* visibility gate */ } syncLoop() }
    document.addEventListener('visibilitychange', onVis)

    // Listeners — on the CONTAINER in capture phase, NOT on the canvas:
    // capture runs before OrbitControls' canvas listeners, so `controls.enabled
    // = false` is in effect before its own pointerdown can start a rotation,
    // and the node-drag pointer capture retargets follow-up events to the
    // container so the controls never see them at all.
    const onUp = (e: PointerEvent) => endDrag(e, false)
    const onCancel = (e: PointerEvent) => endDrag(e, true)
    const onLeave = (e: PointerEvent) => endDrag(e, true)
    el.addEventListener('pointerdown', handlePointerDown, true)
    el.addEventListener('pointermove', handlePointerMove, true)
    el.addEventListener('pointerup', onUp, true)
    el.addEventListener('pointercancel', onCancel, true)
    el.addEventListener('pointerleave', onLeave, true)
    el.addEventListener('dblclick', handleDoubleClick)
    controls.addEventListener('change', () => {
      // Reduced motion: re-render on interaction (WP-3D-I §9.3).
      if (engineRef.current?.rm) renderOnce()
    })

    // Data + selection first paint.
    const capped = buildData()
    const eng = engineRef.current
    eng.capped = { nodes: capped.nodes, links: capped.links }
    eng.pos = computeLayout3D(capped.nodes)
    eng.byId = new Map(capped.nodes.map((n, i) => [n.id, i]))
    // Top labels by degree (WP-3D-D: CAP_3D_LABELS + selected + hovered).
    eng.topLabelIds = new Set(
      [...capped.nodes]
        .sort((a, b) => (b.degree - a.degree) || (a.id < b.id ? -1 : 1))
        .slice(0, CAP_3D_LABELS)
        .map(n => n.id),
    )
    writeInstances()
    applySelection(selectedRef.current, true)
    syncLoop()

    return () => {
      // Dispose in the WP-3D-D order: controls → geometries → materials →
      // renderer → DOM elements → observers → listeners.
      cancelAnimationFrame(engineRef.current?.raf ?? 0)
      controls.dispose()
      sphereGeo.dispose()
      ringGeo.dispose()
      realGeo.dispose()
      synthGeo.dispose()
      nodeMat.dispose()
      realMat.dispose()
      synthMat.dispose()
      ringMat.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      labelRenderer.domElement.remove()
      for (const [, obj] of (engineRef.current?.labels ?? new Map())) {
        obj.element.remove()
      }
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      // Listeners live on the container (which persists) — remove them.
      el.removeEventListener('pointerdown', handlePointerDown, true)
      el.removeEventListener('pointermove', handlePointerMove, true)
      el.removeEventListener('pointerup', onUp, true)
      el.removeEventListener('pointercancel', onCancel, true)
      el.removeEventListener('pointerleave', onLeave, true)
      el.removeEventListener('dblclick', handleDoubleClick)
      engineRef.current = null
    }
    // Build data from the mount-time payload; later payload changes flow through
    // the data effect below. eslint-disable: the imperative engine is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Data changes: rebuild from the new payload (WP-3D-E: refresh resets 3D
  // positions exactly as a refresh resets 2D physics — consistent, not a bug). ──
  useEffect(() => {
    const eng = engineRef.current
    if (!eng) return
    const capped = buildData()
    eng.capped = { nodes: capped.nodes, links: capped.links }
    eng.pos = computeLayout3D(capped.nodes)
    eng.byId = new Map(capped.nodes.map((n, i) => [n.id, i]))
    eng.topLabelIds = new Set(
      [...capped.nodes]
        .sort((a, b) => (b.degree - a.degree) || (a.id < b.id ? -1 : 1))
        .slice(0, CAP_3D_LABELS)
        .map(n => n.id),
    )
    for (const [, obj] of eng.labels) { eng.scene.remove(obj); obj.element.remove() }
    eng.labels.clear()
    eng.drag = null
    eng.hoveredId = null
    writeInstances()
    pruneLabels()
    applySelection(selectedRef.current, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links])

  // ── Selection changes (event-driven) ──
  useEffect(() => {
    applySelection(selectedId)
    if (engineRef.current?.rm) renderOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ── Reduced-motion changes ──
  useEffect(() => {
    const eng = engineRef.current
    if (!eng) return
    eng.rm = rm
    eng.controls.enableDamping = !rm
    syncLoop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rm])

  // Internal guard (WP-3D-H): never mount a scene for an empty graph. It sits
  // AFTER every hook so the hook order is stable whether the graph is empty or
  // populated (an early return above the hooks would crash on the
  // empty→populated transition).
  if (!nodes.length) return null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      data-braingraph3d=""
      data-node-count={cull.nodes.length}
      data-edge-count={cull.links.length}
      style={{ cursor: 'grab' }}
    />
  )
}

// Repo debug protocol (§7b): version stamp proves the new code is running.
console.log('%c[GraphScene3D] v1.0 loaded', 'color: #fbbf24; font-weight: bold')

/**
 * graphAssembler.ts — pure assembly of the brain graph from DB rows.
 *
 * Returns { status, nodes, links, stats, truncated }. No DB writes. Pure
 * functions over already-fetched rows so it is unit-testable without a DB.
 *
 * Edge rules (RESULT.md §5.2):
 *   - Real edges: current facts with objectId set (source→target, predicate).
 *   - Synthetic edges: co-occurrence star within one episode (predicate
 *     'co_occurs', synthetic: true). Caps: ≤3 synthetic per entity per
 *     episode, ≤200 total per load. Never persisted.
 *   - Synthetic edges are excluded from eval's edges_exist check.
 */

export interface AssembledNode {
  id: string
  name: string
  type: string
  state: 'active' | 'blocked' | 'neutral'
  degree: number
  facts: { predicate: string; value: string }[]
  source?: string
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  lastFiredAt?: number
  lastFiredPeak?: number
}

export interface AssembledLink {
  source: string
  target: string
  predicate: string
  synthetic?: boolean
}

export interface AssembleStats {
  entities: number
  realEdges: number
  syntheticEdges: number
  orphans: number
  episodes: number
  captures: number
  generatedInMs: number
  truncated: boolean
}

export interface AssembleResult {
  status: 'empty' | 'loading' | 'error' | 'populated'
  nodes: AssembledNode[]
  links: AssembledLink[]
  stats: AssembleStats
  truncated: boolean
}

interface EntityRow { id: string; type: string; name: string; aliases?: string; source?: string; state?: string }
interface FactRow { id: string; subjectId: string; objectId?: string | null; objectLiteral: string; predicate: string; sourceEpisodeId?: string; validTo?: number | null }
interface EpisodeRow { id: string; source?: string; created_at?: number }

export function assembleGraph(opts: {
  entities: EntityRow[]
  facts: FactRow[]
  episodes?: EpisodeRow[]
  captures?: number
  maxNodes?: number
  maxFacts?: number
  includeSynthetic?: boolean
  types?: string[]
}): AssembleResult {
  const t0 = Date.now()
  const maxNodes = opts.maxNodes ?? 500
  const maxFacts = opts.maxFacts ?? 1000
  const includeSynthetic = opts.includeSynthetic !== false
  const typeFilter = opts.types && opts.types.length ? new Set(opts.types) : null

  const entityMap = new Map<string, EntityRow>()
  for (const e of opts.entities) {
    if (typeFilter && !typeFilter.has(e.type)) continue
    entityMap.set(e.id, e)
  }

  // Apply caps
  const truncated = entityMap.size > maxNodes || opts.facts.length > maxFacts
  const entityIds = Array.from(entityMap.keys()).slice(0, maxNodes)
  const allowedEntities = new Set(entityIds)
  const facts = opts.facts.slice(0, maxFacts)

  // Build nodes
  const nodeMap = new Map<string, AssembledNode>()
  for (const id of entityIds) {
    const e = entityMap.get(id)!
    nodeMap.set(id, {
      id,
      name: e.name || id,
      type: e.type || 'concept',
      state: (e.state as any) || 'neutral',
      degree: 0,
      facts: [],
      source: e.source,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    })
  }

  // Attach facts to subject nodes
  const realEdgeKeys = new Set<string>()
  const links: AssembledLink[] = []
  let realEdges = 0
  const syntheticPerEntity = new Map<string, number>()
  let syntheticTotal = 0
  const SYNTH_PER_ENTITY_CAP = 3
  const SYNTH_TOTAL_CAP = 200

  // Group facts by episode for co-occurrence
  const episodeSubjects = new Map<string, string[]>()
  const episodeSubjectSet = new Map<string, Set<string>>()

  for (const f of facts) {
    if (!allowedEntities.has(f.subjectId)) continue
    const node = nodeMap.get(f.subjectId)
    if (node) node.facts.push({ predicate: f.predicate, value: f.objectLiteral || '' })

    // Real edge
    if (f.objectId && allowedEntities.has(f.objectId)) {
      const key = f.subjectId < f.objectId
        ? `${f.subjectId}|${f.objectId}`
        : `${f.objectId}|${f.subjectId}`
      if (!realEdgeKeys.has(key)) {
        realEdgeKeys.add(key)
        links.push({ source: f.subjectId, target: f.objectId, predicate: f.predicate })
        realEdges++
      }
    }

    // Co-occurrence tracking
    const ep = f.sourceEpisodeId
    if (ep) {
      if (!episodeSubjectSet.has(ep)) episodeSubjectSet.set(ep, new Set())
      const s = episodeSubjectSet.get(ep)!
      s.add(f.subjectId)
      if (f.objectId && allowedEntities.has(f.objectId)) s.add(f.objectId)
    }
  }

  // Synthetic co-occurrence star edges
  if (includeSynthetic) {
    for (const [ep, subjects] of episodeSubjectSet) {
      const arr = Array.from(subjects)
      if (arr.length < 2) continue
      const first = arr[0]
      for (let i = 1; i < arr.length; i++) {
        if (syntheticTotal >= SYNTH_TOTAL_CAP) break
        const src = first
        const tgt = arr[i]
        if (src === tgt) continue
        const pairKey = src < tgt ? `${src}|${tgt}` : `${tgt}|${src}`
        if (realEdgeKeys.has(pairKey)) continue
        const synthKey = `synth:${pairKey}:${ep}`
        // per-entity cap
        const cnt = syntheticPerEntity.get(src) || 0
        if (cnt >= SYNTH_PER_ENTITY_CAP) continue
        syntheticPerEntity.set(src, cnt + 1)
        links.push({ source: src, target: tgt, predicate: 'co_occurs', synthetic: true })
        syntheticTotal++
      }
    }
  }

  // Compute degree
  const degreeMap = new Map<string, number>()
  for (const l of links) {
    degreeMap.set(l.source, (degreeMap.get(l.source) || 0) + 1)
    degreeMap.set(l.target, (degreeMap.get(l.target) || 0) + 1)
  }
  for (const n of nodeMap.values()) {
    n.degree = degreeMap.get(n.id) || 0
  }

  // Orphan count: entities with no edges at all
  const connected = new Set<string>()
  for (const l of links) { connected.add(l.source); connected.add(l.target) }
  let orphans = 0
  for (const id of nodeMap.keys()) if (!connected.has(id)) orphans++

  const status: AssembleResult['status'] =
    nodeMap.size === 0 ? 'empty' : 'populated'

  const stats: AssembleStats = {
    entities: nodeMap.size,
    realEdges,
    syntheticEdges: syntheticTotal,
    orphans,
    episodes: opts.episodes?.length ?? 0,
    captures: opts.captures ?? 0,
    generatedInMs: Date.now() - t0,
    truncated,
  }

  return {
    status,
    nodes: Array.from(nodeMap.values()),
    links,
    stats,
    truncated,
  }
}

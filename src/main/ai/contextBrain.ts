/**
 * ContextBrain — Bitemporal knowledge graph + vector search
 * 
 * Captures episodes, extracts entities and facts,
 * manages bitemporal contradiction handling, and provides
 * multi-strategy retrieval (vector + keyword + graph traversal).
 */

let dbRef: any = null;

export function setBrainDb(db: any) { dbRef = db; }

// ═══ Episode Management ═══

export interface Episode {
  id: string
  source: string
  sourceRef?: string
  content: string
  occurredAt: string
  ingestedAt: string
  metadata?: Record<string, any>
}

export function logEpisode(source: string, content: string, sourceRef?: string, metadata?: Record<string, any>): string {
  if (!dbRef) return ''
  const id = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  dbRef.prepare(`
    INSERT INTO context_episodes (id, source, source_ref, content, occurred_at, ingested_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, source, sourceRef || null, content, now, now, metadata ? JSON.stringify(metadata) : null)
  return id
}

export function getEpisodes(source?: string, limit: number = 50, since?: string): Episode[] {
  if (!dbRef) return []
  let query = 'SELECT * FROM context_episodes'
  const params: any[] = []
  const conditions: string[] = []
  if (source) { conditions.push('source = ?'); params.push(source) }
  if (since) { conditions.push('occurred_at >= ?'); params.push(since) }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ' ORDER BY occurred_at DESC LIMIT ?'
  params.push(limit)
  return dbRef.prepare(query).all(...params).map((r: any) => ({
    id: r.id, source: r.source, sourceRef: r.source_ref,
    content: r.content, occurredAt: r.occurred_at,
    ingestedAt: r.ingested_at, metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  }))
}

// ═══ Entity Management ═══

export interface Entity {
  id: string
  type: string
  name: string
  aliases: string[]
  firstSeen: string
  lastSeen: string
}

function generateEntityId(type: string, name: string): string {
  return `ent_${type}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40)}`
}

export function upsertEntity(type: string, name: string, aliases: string[] = []): string {
  if (!dbRef) return ''
  const id = generateEntityId(type, name)
  const now = new Date().toISOString()
  const existing = dbRef.prepare('SELECT * FROM context_entities WHERE id = ?').get(id)
  if (existing) {
    const existingAliases = JSON.parse(existing.aliases || '[]')
    const mergedAliases = [...new Set([...existingAliases, ...aliases])]
    dbRef.prepare(`
      UPDATE context_entities SET last_seen = ?, aliases = ? WHERE id = ?
    `).run(now, JSON.stringify(mergedAliases), id)
  } else {
    dbRef.prepare(`
      INSERT INTO context_entities (id, type, name, aliases, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, type, name, JSON.stringify(aliases), now, now)
  }
  return id
}

export function getEntity(id: string): Entity | undefined {
  if (!dbRef) return undefined
  const r = dbRef.prepare('SELECT * FROM context_entities WHERE id = ?').get(id)
  if (!r) return undefined
  return { id: r.id, type: r.type, name: r.name, aliases: JSON.parse(r.aliases || '[]'), firstSeen: r.first_seen, lastSeen: r.last_seen }
}

export function findEntities(name: string, type?: string): Entity[] {
  if (!dbRef) return []
  let query = 'SELECT * FROM context_entities WHERE name LIKE ? OR aliases LIKE ?'
  const params: any[] = [`%${name}%`, `%${name}%`]
  if (type) { query += ' AND type = ?'; params.push(type) }
  query += ' ORDER BY last_seen DESC LIMIT 10'
  return dbRef.prepare(query).all(...params).map((r: any) => ({
    id: r.id, type: r.type, name: r.name, aliases: JSON.parse(r.aliases || '[]'), firstSeen: r.first_seen, lastSeen: r.last_seen,
  }))
}

// ═══ Fact Management (Bitemporal) ═══

export interface Fact {
  id: string
  subjectId: string
  predicate: string
  objectId?: string
  objectLiteral?: string
  validFrom: string
  validTo?: string
  sourceEpisodeId: string
  confidence: number
}

export function addFact(subjectId: string, predicate: string, objectLiteral: string, sourceEpisodeId: string, objectId?: string, confidence: number = 1.0): string {
  if (!dbRef) return ''
  const id = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()

  // Check for existing current fact with same subject+predicate
  const existing = dbRef.prepare(
    'SELECT id FROM context_facts WHERE subject_id = ? AND predicate = ? AND valid_to IS NULL'
  ).get(subjectId, predicate)

  if (existing) {
    // Close the old fact (bitemporal contradiction handling)
    dbRef.prepare('UPDATE context_facts SET valid_to = ? WHERE id = ?').run(now, existing.id)
  }

  dbRef.prepare(`
    INSERT INTO context_facts (id, subject_id, predicate, object_id, object_literal, valid_from, valid_to, source_episode_id, confidence)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(id, subjectId, predicate, objectId || null, objectLiteral, now, sourceEpisodeId, confidence)
  return id
}

export function getCurrentFacts(subjectId: string): Fact[] {
  if (!dbRef) return []
  return dbRef.prepare(
    'SELECT * FROM context_facts WHERE subject_id = ? AND valid_to IS NULL ORDER BY confidence DESC'
  ).all(subjectId).map(rowToFact)
}

export function getFactHistory(subjectId: string): Fact[] {
  if (!dbRef) return []
  return dbRef.prepare(
    'SELECT * FROM context_facts WHERE subject_id = ? ORDER BY valid_from DESC'
  ).all(subjectId).map(rowToFact)
}

export function getAllCurrentFacts(): Fact[] {
  if (!dbRef) return []
  return dbRef.prepare(
    'SELECT * FROM context_facts WHERE valid_to IS NULL ORDER BY confidence DESC'
  ).all().map(rowToFact)
}

function rowToFact(r: any): Fact {
  return {
    id: r.id, subjectId: r.subject_id, predicate: r.predicate,
    objectId: r.object_id, objectLiteral: r.object_literal,
    validFrom: r.valid_from, validTo: r.valid_to,
    sourceEpisodeId: r.source_episode_id, confidence: r.confidence,
  }
}

// ═══ Embedding Storage (simple cosine via blob) ═══

export function storeEmbedding(refId: string, refType: string, embedding: number[]): void {
  if (!dbRef) return
  const buf = Buffer.from(new Float32Array(embedding).buffer)
  dbRef.prepare(`
    INSERT OR REPLACE INTO context_embeddings (ref_id, ref_type, embedding) VALUES (?, ?, ?)
  `).run(refId, refType, buf)
}

export function getEmbedding(refId: string): number[] | undefined {
  if (!dbRef) return undefined
  const r = dbRef.prepare('SELECT embedding FROM context_embeddings WHERE ref_id = ?').get(refId)
  if (!r || !r.embedding) return undefined
  return Array.from(new Float32Array(r.embedding.buffer))
}

export function getAllEmbeddings(): Array<{ refId: string; refType: string; vec: number[] }> {
  if (!dbRef) return []
  const rows = dbRef.prepare('SELECT ref_id, ref_type, embedding FROM context_embeddings').all()
  return rows
    .filter((r: any) => r.embedding)
    .map((r: any) => ({
      refId: r.ref_id,
      refType: r.ref_type,
      vec: Array.from(new Float32Array(r.embedding.buffer)),
    }))
}

export function closeFact(factId: string): void {
  if (!dbRef) return
  dbRef.prepare('UPDATE context_facts SET valid_to = ? WHERE id = ? AND valid_to IS NULL').run(new Date().toISOString(), factId)
}

// ═══ Keyword Search ═══

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'what',
  'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me',
  'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
  'her', 'it', 'its', 'they', 'them', 'their', 'quick', 'instruction',
  'new', 'session', 'task', 'fix', 'implement', 'add', 'remove', 'update',
  'change', 'make', 'create', 'delete', 'edit', 'modify', 'set', 'get',
]);

export function keywordSearch(query: string, limit: number = 20): Array<{ type: string; id: string; name?: string; content?: string; score: number }> {
  if (!dbRef) return []
  const results: Array<{ type: string; id: string; name?: string; content?: string; score: number }> = []

  const rawWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const meaningfulWords = rawWords.filter(w => !STOP_WORDS.has(w))
  const searchWords = meaningfulWords.length > 0 ? meaningfulWords : rawWords

  if (searchWords.length === 0) {
    // All stop words — fallback to recent episodes
    const recent = dbRef.prepare(
      'SELECT * FROM context_episodes ORDER BY occurred_at DESC LIMIT ?'
    ).all(Math.min(limit, 5)) as any[]
    for (const e of recent) {
      results.push({ type: 'episode', id: e.id, content: e.content.slice(0, 200), score: 0.5 })
    }
    return results
  }

  const likeConditions = searchWords.map(() => '(name LIKE ? OR aliases LIKE ?)').join(' OR ')
  const entityParams = searchWords.flatMap(w => [`%${w}%`, `%${w}%`])
  const entities = dbRef.prepare(
    `SELECT * FROM context_entities WHERE ${likeConditions} ORDER BY last_seen DESC LIMIT ?`
  ).all(...entityParams, limit)
  for (const e of entities) {
    results.push({ type: 'entity', id: e.id, name: e.name, score: 0.8 })
  }

  const epConditions = searchWords.map(() => 'content LIKE ?').join(' OR ')
  const epParams = searchWords.map(w => `%${w}%`)
  const episodes = dbRef.prepare(
    `SELECT *, CASE WHEN occurred_at > datetime('now', '-7 days') THEN 2 ELSE 1 END as recency_weight FROM context_episodes WHERE ${epConditions} ORDER BY recency_weight DESC, occurred_at DESC LIMIT ?`
  ).all(...epParams, limit * 2)
  const sourceCounts: Record<string, number> = {}
  const MAX_PER_SOURCE = 3
  for (const e of episodes) {
    const src = e.source || 'unknown'
    sourceCounts[src] = (sourceCounts[src] || 0) + 1
    if (sourceCounts[src] <= MAX_PER_SOURCE) {
      results.push({ type: 'episode', id: e.id, content: e.content.slice(0, 200), score: 0.6 * (e.recency_weight || 1) })
    }
  }

  const factConditions = searchWords.map(() => 'object_literal LIKE ?').join(' OR ')
  const factParams = searchWords.map(w => `%${w}%`)
  const facts = dbRef.prepare(
    `SELECT * FROM context_facts WHERE (${factConditions}) AND valid_to IS NULL ORDER BY confidence DESC LIMIT ?`
  ).all(...factParams, limit)
  for (const f of facts) {
    results.push({ type: 'fact', id: f.id, content: `${f.predicate}: ${f.object_literal}`, score: 0.7 })
  }

  if (results.length === 0) {
    const recent = dbRef.prepare(
      'SELECT * FROM context_episodes ORDER BY occurred_at DESC LIMIT ?'
    ).all(Math.min(limit, 5)) as any[]
    for (const e of recent) {
      results.push({ type: 'episode', id: e.id, content: e.content.slice(0, 200), score: 0.4 })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

// ═══ Graph Traversal ═══

export function traverseFromEntity(entityId: string, depth: number = 2): { entities: Entity[]; facts: Fact[] } {
  if (!dbRef) return { entities: [], facts: [] }
  const visitedEntities = new Set<string>([entityId])
  const allFacts: Fact[] = []
  let currentIds = [entityId]

  for (let d = 0; d < depth; d++) {
    const nextIds: string[] = []
    for (const id of currentIds) {
      const facts = dbRef.prepare(
        'SELECT * FROM context_facts WHERE (subject_id = ? OR object_id = ?) AND valid_to IS NULL'
      ).all(id, id)
      for (const f of facts) {
        allFacts.push(rowToFact(f))
        const otherId = f.subject_id === id ? f.object_id : f.subject_id
        if (otherId && !visitedEntities.has(otherId)) {
          visitedEntities.add(otherId)
          nextIds.push(otherId)
        }
      }
    }
    currentIds = nextIds
  }

  const entities: Entity[] = []
  for (const id of visitedEntities) {
    const e = getEntity(id)
    if (e) entities.push(e)
  }

  return { entities, facts: allFacts }
}

// ═══ Retrieval Router ═══

export interface RetrievalResult {
  facts: Fact[]
  episodes: Episode[]
  entities: Entity[]
  strategy: string
}

export function retrieve(query: string, strategies: string[] = ['keyword', 'graph']): RetrievalResult {
  const result: RetrievalResult = { facts: [], episodes: [], entities: [], strategy: strategies.join('+') }

  // Keyword search
  if (strategies.includes('keyword')) {
    const keywordResults = keywordSearch(query, 10)
    for (const r of keywordResults) {
      if (r.type === 'fact' && r.id) {
        const fact = dbRef?.prepare('SELECT * FROM context_facts WHERE id = ?').get(r.id)
        if (fact) result.facts.push(rowToFact(fact))
      }
      if (r.type === 'entity' && r.id) {
        const entity = getEntity(r.id)
        if (entity) result.entities.push(entity)
      }
      if (r.type === 'episode' && r.id) {
        const ep = dbRef?.prepare('SELECT * FROM context_episodes WHERE id = ?').get(r.id)
        if (ep) result.episodes.push({ id: ep.id, source: ep.source, content: ep.content, occurredAt: ep.occurred_at, ingestedAt: ep.ingested_at })
      }
    }
  }

  // Graph traversal from found entities
  if (strategies.includes('graph') && result.entities.length > 0) {
    for (const entity of result.entities.slice(0, 3)) {
      const { entities: related, facts: relFacts } = traverseFromEntity(entity.id, 1)
      for (const e of related) {
        if (!result.entities.find(re => re.id === e.id)) result.entities.push(e)
      }
      for (const f of relFacts) {
        if (!result.facts.find(rf => rf.id === f.id)) result.facts.push(f)
      }
    }
  }

  // Recency weighting
  result.facts.sort((a, b) => {
    const aRecent = a.validTo ? 0 : 1
    const bRecent = b.validTo ? 0 : 1
    if (aRecent !== bRecent) return bRecent - aRecent
    return b.confidence - a.confidence
  })

  return result
}

// ═══ Context Bundle Export ═══

export function exportContextBundle(): string {
  if (!dbRef) return '{}'

  const facts = getAllCurrentFacts()
  const recentEpisodes = getEpisodes(undefined, 20)
  const entities = dbRef.prepare('SELECT * FROM context_entities ORDER BY last_seen DESC LIMIT 50').all()

  const bundle = {
    _meta: {
      exportedAt: new Date().toISOString(),
      source: 'DeskFlow Context Brain',
      version: 1,
    },
    entities: entities.map((e: any) => ({
      type: e.type,
      name: e.name,
      aliases: JSON.parse(e.aliases || '[]'),
      firstSeen: e.first_seen,
      lastSeen: e.last_seen,
    })),
    currentFacts: facts.map(f => ({
      subject: f.subjectId,
      predicate: f.predicate,
      value: f.objectLiteral || f.objectId,
      confidence: f.confidence,
      since: f.validFrom,
    })),
    recentActivity: recentEpisodes.map(e => ({
      source: e.source,
      content: e.content.slice(0, 500),
      when: e.occurredAt,
    })),
  }

  return JSON.stringify(bundle, null, 2)
}

// ═══ Stats ═══

export function getBrainStats(): { episodes: number; entities: number; facts: number; currentFacts: number } {
  if (!dbRef) return { episodes: 0, entities: 0, facts: 0, currentFacts: 0 }
  const episodes = dbRef.prepare('SELECT COUNT(*) as c FROM context_episodes').get().c
  const entities = dbRef.prepare('SELECT COUNT(*) as c FROM context_entities').get().c
  const facts = dbRef.prepare('SELECT COUNT(*) as c FROM context_facts').get().c
  const currentFacts = dbRef.prepare('SELECT COUNT(*) as c FROM context_facts WHERE valid_to IS NULL').get().c
  return { episodes, entities, facts, currentFacts }
}

// ═══ Management Lists (brain management UI) ═══

export interface EpisodeRow {
  id: string
  source: string
  sourceRef?: string
  content: string
  occurredAt: string
  ingestedAt: string
  metadata?: Record<string, any>
  entityCount?: number
  extractionStatus?: string
}

export function getEpisodesList(opts: { source?: string; search?: string; limit?: number; offset?: number } = {}): { items: EpisodeRow[]; total: number } {
  if (!dbRef) return { items: [], total: 0 }
  const { source, search, limit = 50, offset = 0 } = opts
  const conditions: string[] = []
  const params: any[] = []
  if (source && source !== 'all') { conditions.push('source = ?'); params.push(source) }
  if (search) { conditions.push('content LIKE ?'); params.push(`%${search}%`) }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
  const total = dbRef.prepare(`SELECT COUNT(*) as c FROM context_episodes${where}`).get(...params).c
  const rows = dbRef.prepare(
    `SELECT * FROM context_episodes${where} ORDER BY occurred_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset)
  const items: EpisodeRow[] = rows.map((r: any) => ({
    id: r.id, source: r.source, sourceRef: r.source_ref, content: r.content,
    occurredAt: r.occurred_at, ingestedAt: r.ingested_at,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    entityCount: 0, extractionStatus: undefined,
  }))
  // Enrich with extraction status from jobs table if it exists
  try {
    const jobRows = dbRef.prepare('SELECT episode_id, status FROM context_extraction_jobs').all()
    const jobMap = new Map(jobRows.map((j: any) => [j.episode_id, j.status]))
    for (const it of items) it.extractionStatus = jobMap.get(it.id) || 'none'
  } catch { /* jobs table may not exist yet */ }
  return { items, total }
}

export interface EntityRow {
  id: string
  type: string
  name: string
  aliases: string[]
  firstSeen: string
  lastSeen: string
  factCount: number
}

export function getEntitiesList(opts: { type?: string; search?: string; limit?: number; offset?: number } = {}): { items: EntityRow[]; total: number } {
  if (!dbRef) return { items: [], total: 0 }
  const { type, search, limit = 50, offset = 0 } = opts
  const conditions: string[] = []
  const params: any[] = []
  if (type && type !== 'all') { conditions.push('type = ?'); params.push(type) }
  if (search) { conditions.push('(name LIKE ? OR aliases LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
  const total = dbRef.prepare(`SELECT COUNT(*) as c FROM context_entities${where}`).get(...params).c
  const rows = dbRef.prepare(
    `SELECT * FROM context_entities${where} ORDER BY last_seen DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset)
  return {
    total,
    items: rows.map((r: any) => {
      const factCount = dbRef.prepare('SELECT COUNT(*) as c FROM context_facts WHERE subject_id = ?').get(r.id).c
      return {
        id: r.id, type: r.type, name: r.name, aliases: JSON.parse(r.aliases || '[]'),
        firstSeen: r.first_seen, lastSeen: r.last_seen, factCount,
      }
    }),
  }
}

export function getFactsList(opts: { currentOnly?: boolean; subjectId?: string; limit?: number; offset?: number } = {}): { items: Fact[]; total: number } {
  if (!dbRef) return { items: [], total: 0 }
  const { currentOnly, subjectId, limit = 50, offset = 0 } = opts
  const conditions: string[] = []
  const params: any[] = []
  if (currentOnly) conditions.push('valid_to IS NULL')
  if (subjectId) { conditions.push('subject_id = ?'); params.push(subjectId) }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
  const total = dbRef.prepare(`SELECT COUNT(*) as c FROM context_facts${where}`).get(...params).c
  const rows = dbRef.prepare(
    `SELECT * FROM context_facts${where} ORDER BY valid_from DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset)
  return { total, items: rows.map(rowToFact) }
}

export function getRelatedEpisodes(entityId: string, limit: number = 10): Episode[] {
  if (!dbRef) return []
  const facts = dbRef.prepare('SELECT source_episode_id FROM context_facts WHERE subject_id = ?').all(entityId)
  const ids = [...new Set(facts.map((f: any) => f.source_episode_id).filter(Boolean))]
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(',')
  const rows = dbRef.prepare(
    `SELECT * FROM context_episodes WHERE id IN (${placeholders}) ORDER BY occurred_at DESC LIMIT ?`
  ).all(...ids, limit)
  return rows.map((r: any) => ({
    id: r.id, source: r.source, sourceRef: r.source_ref,
    content: r.content, occurredAt: r.occurred_at, ingestedAt: r.ingested_at,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  }))
}

// ═══ Extraction Jobs ═══

export interface ExtractionJob {
  id: string
  episodeId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  attempts: number
  lastError?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  lockedAt?: number
}

export function createExtractionJob(episodeId: string): string {
  if (!dbRef) return ''
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    dbRef.prepare(`
      INSERT INTO context_extraction_jobs (id, episode_id, status, attempts, created_at)
      VALUES (?, ?, 'pending', 0, ?)
    `).run(id, episodeId, Date.now())
  } catch { /* table missing */ }
  return id
}

export function getPendingJobs(limit: number = 5): ExtractionJob[] {
  if (!dbRef) return []
  try {
    const rows = dbRef.prepare(
      "SELECT * FROM context_extraction_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?"
    ).all(limit)
    return rows.map(rowToJob)
  } catch { return [] }
}

export function getJobs(): ExtractionJob[] {
  if (!dbRef) return []
  try {
    return dbRef.prepare('SELECT * FROM context_extraction_jobs ORDER BY created_at DESC LIMIT 100').all().map(rowToJob)
  } catch { return [] }
}

export function getJob(jobId: string): ExtractionJob | undefined {
  if (!dbRef) return undefined
  try {
    const r = dbRef.prepare('SELECT * FROM context_extraction_jobs WHERE id = ?').get(jobId)
    return r ? rowToJob(r) : undefined
  } catch { return undefined }
}

export function updateJob(jobId: string, patch: Partial<Omit<ExtractionJob, 'id'>>): void {
  if (!dbRef) return
  const sets: string[] = []
  const args: any[] = []
  if (patch.status !== undefined) { sets.push('status = ?'); args.push(patch.status) }
  if (patch.attempts !== undefined) { sets.push('attempts = ?'); args.push(patch.attempts) }
  if (patch.lastError !== undefined) { sets.push('last_error = ?'); args.push(patch.lastError) }
  if (patch.startedAt !== undefined) { sets.push('started_at = ?'); args.push(patch.startedAt) }
  if (patch.completedAt !== undefined) { sets.push('completed_at = ?'); args.push(patch.completedAt) }
  if (patch.lockedAt !== undefined) { sets.push('locked_at = ?'); args.push(patch.lockedAt) }
  if (sets.length === 0) return
  try {
    dbRef.prepare(`UPDATE context_extraction_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...args, jobId)
  } catch { /* table missing */ }
}

export function retryJob(jobId: string): void {
  updateJob(jobId, { status: 'pending', attempts: 0, lastError: undefined })
}

function rowToJob(r: any): ExtractionJob {
  return {
    id: r.id, episodeId: r.episode_id, status: r.status, attempts: r.attempts || 0,
    lastError: r.last_error || undefined, createdAt: r.created_at,
    startedAt: r.started_at || undefined, completedAt: r.completed_at || undefined,
    lockedAt: r.locked_at || undefined,
  }
}

export function getJobStats(): { pending: number; processing: number; completed: number; failed: number; skipped: number } {
  if (!dbRef) return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 }
  try {
    const rows = dbRef.prepare('SELECT status, COUNT(*) as c FROM context_extraction_jobs GROUP BY status').all()
    const map: Record<string, number> = {}
    for (const r of rows) map[r.status] = r.c
    return {
      pending: map.pending || 0, processing: map.processing || 0, completed: map.completed || 0,
      failed: map.failed || 0, skipped: map.skipped || 0,
    }
  } catch { return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 } }
}
export const contextBrain = { getAllCurrentFacts, addFact, logEpisode, getEpisodes, traverseFromEntity, findEntities, getEntitiesList, getFactsList };

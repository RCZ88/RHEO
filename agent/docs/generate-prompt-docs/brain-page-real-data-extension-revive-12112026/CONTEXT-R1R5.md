# CONTEXT: R1–R5 answers (all five REQUESTs from RESULT-M6 §9)

> Ready for the Architect's next session. All sources full, line-anchored.
> PRAGMA results included inline for R2. R4 includes the exact excerpts requested.


## REQUEST R1: src/main/ai/contextBrain.ts (FULL, 628 lines)
   1: /**
   2:  * ContextBrain — Bitemporal knowledge graph + vector search
   3:  * 
   4:  * Captures episodes, extracts entities and facts,
   5:  * manages bitemporal contradiction handling, and provides
   6:  * multi-strategy retrieval (vector + keyword + graph traversal).
   7:  */
   8: 
   9: let dbRef: any = null;
  10: 
  11: export function setBrainDb(db: any) { dbRef = db; }
  12: 
  13: // ═══ Episode Management ═══
  14: 
  15: export interface Episode {
  16:   id: string
  17:   source: string
  18:   sourceRef?: string
  19:   content: string
  20:   occurredAt: string
  21:   ingestedAt: string
  22:   metadata?: Record<string, any>
  23: }
  24: 
  25: export function logEpisode(source: string, content: string, sourceRef?: string, metadata?: Record<string, any>): string {
  26:   if (!dbRef) return ''
  27:   const id = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  28:   const now = new Date().toISOString()
  29:   dbRef.prepare(`
  30:     INSERT INTO context_episodes (id, source, source_ref, content, occurred_at, ingested_at, metadata)
  31:     VALUES (?, ?, ?, ?, ?, ?, ?)
  32:   `).run(id, source, sourceRef || null, content, now, now, metadata ? JSON.stringify(metadata) : null)
  33:   return id
  34: }
  35: 
  36: export function getEpisodes(source?: string, limit: number = 50, since?: string): Episode[] {
  37:   if (!dbRef) return []
  38:   let query = 'SELECT * FROM context_episodes'
  39:   const params: any[] = []
  40:   const conditions: string[] = []
  41:   if (source) { conditions.push('source = ?'); params.push(source) }
  42:   if (since) { conditions.push('occurred_at >= ?'); params.push(since) }
  43:   if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  44:   query += ' ORDER BY occurred_at DESC LIMIT ?'
  45:   params.push(limit)
  46:   return dbRef.prepare(query).all(...params).map((r: any) => ({
  47:     id: r.id, source: r.source, sourceRef: r.source_ref,
  48:     content: r.content, occurredAt: r.occurred_at,
  49:     ingestedAt: r.ingested_at, metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  50:   }))
  51: }
  52: 
  53: // ═══ Entity Management ═══
  54: 
  55: export interface Entity {
  56:   id: string
  57:   type: string
  58:   name: string
  59:   aliases: string[]
  60:   firstSeen: string
  61:   lastSeen: string
  62: }
  63: 
  64: function generateEntityId(type: string, name: string): string {
  65:   return `ent_${type}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40)}`
  66: }
  67: 
  68: export function upsertEntity(type: string, name: string, aliases: string[] = []): string {
  69:   if (!dbRef) return ''
  70:   const id = generateEntityId(type, name)
  71:   const now = new Date().toISOString()
  72:   const existing = dbRef.prepare('SELECT * FROM context_entities WHERE id = ?').get(id)
  73:   if (existing) {
  74:     const existingAliases = JSON.parse(existing.aliases || '[]')
  75:     const mergedAliases = [...new Set([...existingAliases, ...aliases])]
  76:     dbRef.prepare(`
  77:       UPDATE context_entities SET last_seen = ?, aliases = ? WHERE id = ?
  78:     `).run(now, JSON.stringify(mergedAliases), id)
  79:   } else {
  80:     dbRef.prepare(`
  81:       INSERT INTO context_entities (id, type, name, aliases, first_seen, last_seen)
  82:       VALUES (?, ?, ?, ?, ?, ?)
  83:     `).run(id, type, name, JSON.stringify(aliases), now, now)
  84:   }
  85:   return id
  86: }
  87: 
  88: export function getEntity(id: string): Entity | undefined {
  89:   if (!dbRef) return undefined
  90:   const r = dbRef.prepare('SELECT * FROM context_entities WHERE id = ?').get(id)
  91:   if (!r) return undefined
  92:   return { id: r.id, type: r.type, name: r.name, aliases: JSON.parse(r.aliases || '[]'), firstSeen: r.first_seen, lastSeen: r.last_seen }
  93: }
  94: 
  95: export function findEntities(name: string, type?: string): Entity[] {
  96:   if (!dbRef) return []
  97:   let query = 'SELECT * FROM context_entities WHERE name LIKE ? OR aliases LIKE ?'
  98:   const params: any[] = [`%${name}%`, `%${name}%`]
  99:   if (type) { query += ' AND type = ?'; params.push(type) }
 100:   query += ' ORDER BY last_seen DESC LIMIT 10'
 101:   return dbRef.prepare(query).all(...params).map((r: any) => ({
 102:     id: r.id, type: r.type, name: r.name, aliases: JSON.parse(r.aliases || '[]'), firstSeen: r.first_seen, lastSeen: r.last_seen,
 103:   }))
 104: }
 105: 
 106: // ═══ Fact Management (Bitemporal) ═══
 107: 
 108: export interface Fact {
 109:   id: string
 110:   subjectId: string
 111:   predicate: string
 112:   objectId?: string
 113:   objectLiteral?: string
 114:   validFrom: string
 115:   validTo?: string
 116:   sourceEpisodeId: string
 117:   confidence: number
 118: }
 119: 
 120: export function addFact(subjectId: string, predicate: string, objectLiteral: string, sourceEpisodeId: string, objectId?: string, confidence: number = 1.0): string {
 121:   if (!dbRef) return ''
 122:   const id = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
 123:   const now = new Date().toISOString()
 124: 
 125:   // Check for existing current fact with same subject+predicate
 126:   const existing = dbRef.prepare(
 127:     'SELECT id FROM context_facts WHERE subject_id = ? AND predicate = ? AND valid_to IS NULL'
 128:   ).get(subjectId, predicate)
 129: 
 130:   if (existing) {
 131:     // Close the old fact (bitemporal contradiction handling)
 132:     dbRef.prepare('UPDATE context_facts SET valid_to = ? WHERE id = ?').run(now, existing.id)
 133:   }
 134: 
 135:   dbRef.prepare(`
 136:     INSERT INTO context_facts (id, subject_id, predicate, object_id, object_literal, valid_from, valid_to, source_episode_id, confidence)
 137:     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
 138:   `).run(id, subjectId, predicate, objectId || null, objectLiteral, now, sourceEpisodeId, confidence)
 139:   return id
 140: }
 141: 
 142: export function getCurrentFacts(subjectId: string): Fact[] {
 143:   if (!dbRef) return []
 144:   return dbRef.prepare(
 145:     'SELECT * FROM context_facts WHERE subject_id = ? AND valid_to IS NULL ORDER BY confidence DESC'
 146:   ).all(subjectId).map(rowToFact)
 147: }
 148: 
 149: export function getFactHistory(subjectId: string): Fact[] {
 150:   if (!dbRef) return []
 151:   return dbRef.prepare(
 152:     'SELECT * FROM context_facts WHERE subject_id = ? ORDER BY valid_from DESC'
 153:   ).all(subjectId).map(rowToFact)
 154: }
 155: 
 156: export function getAllCurrentFacts(): Fact[] {
 157:   if (!dbRef) return []
 158:   return dbRef.prepare(
 159:     'SELECT * FROM context_facts WHERE valid_to IS NULL ORDER BY confidence DESC'
 160:   ).all().map(rowToFact)
 161: }
 162: 
 163: function rowToFact(r: any): Fact {
 164:   return {
 165:     id: r.id, subjectId: r.subject_id, predicate: r.predicate,
 166:     objectId: r.object_id, objectLiteral: r.object_literal,
 167:     validFrom: r.valid_from, validTo: r.valid_to,
 168:     sourceEpisodeId: r.source_episode_id, confidence: r.confidence,
 169:   }
 170: }
 171: 
 172: // ═══ Embedding Storage (simple cosine via blob) ═══
 173: 
 174: export function storeEmbedding(refId: string, refType: string, embedding: number[]): void {
 175:   if (!dbRef) return
 176:   const buf = Buffer.from(new Float32Array(embedding).buffer)
 177:   dbRef.prepare(`
 178:     INSERT OR REPLACE INTO context_embeddings (ref_id, ref_type, embedding) VALUES (?, ?, ?)
 179:   `).run(refId, refType, buf)
 180: }
 181: 
 182: export function getEmbedding(refId: string): number[] | undefined {
 183:   if (!dbRef) return undefined
 184:   const r = dbRef.prepare('SELECT embedding FROM context_embeddings WHERE ref_id = ?').get(refId)
 185:   if (!r || !r.embedding) return undefined
 186:   return Array.from(new Float32Array(r.embedding.buffer))
 187: }
 188: 
 189: export function getAllEmbeddings(): Array<{ refId: string; refType: string; vec: number[] }> {
 190:   if (!dbRef) return []
 191:   const rows = dbRef.prepare('SELECT ref_id, ref_type, embedding FROM context_embeddings').all()
 192:   return rows
 193:     .filter((r: any) => r.embedding)
 194:     .map((r: any) => ({
 195:       refId: r.ref_id,
 196:       refType: r.ref_type,
 197:       vec: Array.from(new Float32Array(r.embedding.buffer)),
 198:     }))
 199: }
 200: 
 201: export function closeFact(factId: string): void {
 202:   if (!dbRef) return
 203:   dbRef.prepare('UPDATE context_facts SET valid_to = ? WHERE id = ? AND valid_to IS NULL').run(new Date().toISOString(), factId)
 204: }
 205: 
 206: // ═══ Keyword Search ═══
 207: 
 208: const STOP_WORDS = new Set([
 209:   'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
 210:   'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
 211:   'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
 212:   'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
 213:   'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
 214:   'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
 215:   'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
 216:   'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
 217:   'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
 218:   'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'what',
 219:   'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me',
 220:   'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
 221:   'her', 'it', 'its', 'they', 'them', 'their', 'quick', 'instruction',
 222:   'new', 'session', 'task', 'fix', 'implement', 'add', 'remove', 'update',
 223:   'change', 'make', 'create', 'delete', 'edit', 'modify', 'set', 'get',
 224: ]);
 225: 
 226: export function keywordSearch(query: string, limit: number = 20): Array<{ type: string; id: string; name?: string; content?: string; score: number }> {
 227:   if (!dbRef) return []
 228:   const results: Array<{ type: string; id: string; name?: string; content?: string; score: number }> = []
 229: 
 230:   const rawWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
 231:   const meaningfulWords = rawWords.filter(w => !STOP_WORDS.has(w))
 232:   const searchWords = meaningfulWords.length > 0 ? meaningfulWords : rawWords
 233: 
 234:   if (searchWords.length === 0) {
 235:     // All stop words — fallback to recent episodes
 236:     const recent = dbRef.prepare(
 237:       'SELECT * FROM context_episodes ORDER BY occurred_at DESC LIMIT ?'
 238:     ).all(Math.min(limit, 5)) as any[]
 239:     for (const e of recent) {
 240:       results.push({ type: 'episode', id: e.id, content: e.content.slice(0, 200), score: 0.5 })
 241:     }
 242:     return results
 243:   }
 244: 
 245:   const likeConditions = searchWords.map(() => '(name LIKE ? OR aliases LIKE ?)').join(' OR ')
 246:   const entityParams = searchWords.flatMap(w => [`%${w}%`, `%${w}%`])
 247:   const entities = dbRef.prepare(
 248:     `SELECT * FROM context_entities WHERE ${likeConditions} ORDER BY last_seen DESC LIMIT ?`
 249:   ).all(...entityParams, limit)
 250:   for (const e of entities) {
 251:     results.push({ type: 'entity', id: e.id, name: e.name, score: 0.8 })
 252:   }
 253: 
 254:   const epConditions = searchWords.map(() => 'content LIKE ?').join(' OR ')
 255:   const epParams = searchWords.map(w => `%${w}%`)
 256:   const episodes = dbRef.prepare(
 257:     `SELECT *, CASE WHEN occurred_at > datetime('now', '-7 days') THEN 2 ELSE 1 END as recency_weight FROM context_episodes WHERE ${epConditions} ORDER BY recency_weight DESC, occurred_at DESC LIMIT ?`
 258:   ).all(...epParams, limit * 2)
 259:   const sourceCounts: Record<string, number> = {}
 260:   const MAX_PER_SOURCE = 3
 261:   for (const e of episodes) {
 262:     const src = e.source || 'unknown'
 263:     sourceCounts[src] = (sourceCounts[src] || 0) + 1
 264:     if (sourceCounts[src] <= MAX_PER_SOURCE) {
 265:       results.push({ type: 'episode', id: e.id, content: e.content.slice(0, 200), score: 0.6 * (e.recency_weight || 1) })
 266:     }
 267:   }
 268: 
 269:   const factConditions = searchWords.map(() => 'object_literal LIKE ?').join(' OR ')
 270:   const factParams = searchWords.map(w => `%${w}%`)
 271:   const facts = dbRef.prepare(
 272:     `SELECT * FROM context_facts WHERE (${factConditions}) AND valid_to IS NULL ORDER BY confidence DESC LIMIT ?`
 273:   ).all(...factParams, limit)
 274:   for (const f of facts) {
 275:     results.push({ type: 'fact', id: f.id, content: `${f.predicate}: ${f.object_literal}`, score: 0.7 })
 276:   }
 277: 
 278:   if (results.length === 0) {
 279:     const recent = dbRef.prepare(
 280:       'SELECT * FROM context_episodes ORDER BY occurred_at DESC LIMIT ?'
 281:     ).all(Math.min(limit, 5)) as any[]
 282:     for (const e of recent) {
 283:       results.push({ type: 'episode', id: e.id, content: e.content.slice(0, 200), score: 0.4 })
 284:     }
 285:   }
 286: 
 287:   return results.sort((a, b) => b.score - a.score)
 288: }
 289: 
 290: // ═══ Graph Traversal ═══
 291: 
 292: export function traverseFromEntity(entityId: string, depth: number = 2): { entities: Entity[]; facts: Fact[] } {
 293:   if (!dbRef) return { entities: [], facts: [] }
 294:   const visitedEntities = new Set<string>([entityId])
 295:   const allFacts: Fact[] = []
 296:   let currentIds = [entityId]
 297: 
 298:   for (let d = 0; d < depth; d++) {
 299:     const nextIds: string[] = []
 300:     for (const id of currentIds) {
 301:       const facts = dbRef.prepare(
 302:         'SELECT * FROM context_facts WHERE (subject_id = ? OR object_id = ?) AND valid_to IS NULL'
 303:       ).all(id, id)
 304:       for (const f of facts) {
 305:         allFacts.push(rowToFact(f))
 306:         const otherId = f.subject_id === id ? f.object_id : f.subject_id
 307:         if (otherId && !visitedEntities.has(otherId)) {
 308:           visitedEntities.add(otherId)
 309:           nextIds.push(otherId)
 310:         }
 311:       }
 312:     }
 313:     currentIds = nextIds
 314:   }
 315: 
 316:   const entities: Entity[] = []
 317:   for (const id of visitedEntities) {
 318:     const e = getEntity(id)
 319:     if (e) entities.push(e)
 320:   }
 321: 
 322:   return { entities, facts: allFacts }
 323: }
 324: 
 325: // ═══ Retrieval Router ═══
 326: 
 327: export interface RetrievalResult {
 328:   facts: Fact[]
 329:   episodes: Episode[]
 330:   entities: Entity[]
 331:   strategy: string
 332: }
 333: 
 334: export function retrieve(query: string, strategies: string[] = ['keyword', 'graph']): RetrievalResult {
 335:   const result: RetrievalResult = { facts: [], episodes: [], entities: [], strategy: strategies.join('+') }
 336: 
 337:   // Keyword search
 338:   if (strategies.includes('keyword')) {
 339:     const keywordResults = keywordSearch(query, 10)
 340:     for (const r of keywordResults) {
 341:       if (r.type === 'fact' && r.id) {
 342:         const fact = dbRef?.prepare('SELECT * FROM context_facts WHERE id = ?').get(r.id)
 343:         if (fact) result.facts.push(rowToFact(fact))
 344:       }
 345:       if (r.type === 'entity' && r.id) {
 346:         const entity = getEntity(r.id)
 347:         if (entity) result.entities.push(entity)
 348:       }
 349:       if (r.type === 'episode' && r.id) {
 350:         const ep = dbRef?.prepare('SELECT * FROM context_episodes WHERE id = ?').get(r.id)
 351:         if (ep) result.episodes.push({ id: ep.id, source: ep.source, content: ep.content, occurredAt: ep.occurred_at, ingestedAt: ep.ingested_at })
 352:       }
 353:     }
 354:   }
 355: 
 356:   // Graph traversal from found entities
 357:   if (strategies.includes('graph') && result.entities.length > 0) {
 358:     for (const entity of result.entities.slice(0, 3)) {
 359:       const { entities: related, facts: relFacts } = traverseFromEntity(entity.id, 1)
 360:       for (const e of related) {
 361:         if (!result.entities.find(re => re.id === e.id)) result.entities.push(e)
 362:       }
 363:       for (const f of relFacts) {
 364:         if (!result.facts.find(rf => rf.id === f.id)) result.facts.push(f)
 365:       }
 366:     }
 367:   }
 368: 
 369:   // Recency weighting
 370:   result.facts.sort((a, b) => {
 371:     const aRecent = a.validTo ? 0 : 1
 372:     const bRecent = b.validTo ? 0 : 1
 373:     if (aRecent !== bRecent) return bRecent - aRecent
 374:     return b.confidence - a.confidence
 375:   })
 376: 
 377:   return result
 378: }
 379: 
 380: // ═══ Context Bundle Export ═══
 381: 
 382: export function exportContextBundle(): string {
 383:   if (!dbRef) return '{}'
 384: 
 385:   const facts = getAllCurrentFacts()
 386:   const recentEpisodes = getEpisodes(undefined, 20)
 387:   const entities = dbRef.prepare('SELECT * FROM context_entities ORDER BY last_seen DESC LIMIT 50').all()
 388: 
 389:   const bundle = {
 390:     _meta: {
 391:       exportedAt: new Date().toISOString(),
 392:       source: 'DeskFlow Context Brain',
 393:       version: 1,
 394:     },
 395:     entities: entities.map((e: any) => ({
 396:       type: e.type,
 397:       name: e.name,
 398:       aliases: JSON.parse(e.aliases || '[]'),
 399:       firstSeen: e.first_seen,
 400:       lastSeen: e.last_seen,
 401:     })),
 402:     currentFacts: facts.map(f => ({
 403:       subject: f.subjectId,
 404:       predicate: f.predicate,
 405:       value: f.objectLiteral || f.objectId,
 406:       confidence: f.confidence,
 407:       since: f.validFrom,
 408:     })),
 409:     recentActivity: recentEpisodes.map(e => ({
 410:       source: e.source,
 411:       content: e.content.slice(0, 500),
 412:       when: e.occurredAt,
 413:     })),
 414:   }
 415: 
 416:   return JSON.stringify(bundle, null, 2)
 417: }
 418: 
 419: // ═══ Stats ═══
 420: 
 421: export function getBrainStats(): { episodes: number; entities: number; facts: number; currentFacts: number } {
 422:   if (!dbRef) return { episodes: 0, entities: 0, facts: 0, currentFacts: 0 }
 423:   const episodes = dbRef.prepare('SELECT COUNT(*) as c FROM context_episodes').get().c
 424:   const entities = dbRef.prepare('SELECT COUNT(*) as c FROM context_entities').get().c
 425:   const facts = dbRef.prepare('SELECT COUNT(*) as c FROM context_facts').get().c
 426:   const currentFacts = dbRef.prepare('SELECT COUNT(*) as c FROM context_facts WHERE valid_to IS NULL').get().c
 427:   return { episodes, entities, facts, currentFacts }
 428: }
 429: 
 430: // ═══ Management Lists (brain management UI) ═══
 431: 
 432: export interface EpisodeRow {
 433:   id: string
 434:   source: string
 435:   sourceRef?: string
 436:   content: string
 437:   occurredAt: string
 438:   ingestedAt: string
 439:   metadata?: Record<string, any>
 440:   entityCount?: number
 441:   extractionStatus?: string
 442: }
 443: 
 444: export function getEpisodesList(opts: { source?: string; search?: string; limit?: number; offset?: number } = {}): { items: EpisodeRow[]; total: number } {
 445:   if (!dbRef) return { items: [], total: 0 }
 446:   const { source, search, limit = 50, offset = 0 } = opts
 447:   const conditions: string[] = []
 448:   const params: any[] = []
 449:   if (source && source !== 'all') { conditions.push('source = ?'); params.push(source) }
 450:   if (search) { conditions.push('content LIKE ?'); params.push(`%${search}%`) }
 451:   const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
 452:   const total = dbRef.prepare(`SELECT COUNT(*) as c FROM context_episodes${where}`).get(...params).c
 453:   const rows = dbRef.prepare(
 454:     `SELECT * FROM context_episodes${where} ORDER BY occurred_at DESC LIMIT ? OFFSET ?`
 455:   ).all(...params, limit, offset)
 456:   const items: EpisodeRow[] = rows.map((r: any) => ({
 457:     id: r.id, source: r.source, sourceRef: r.source_ref, content: r.content,
 458:     occurredAt: r.occurred_at, ingestedAt: r.ingested_at,
 459:     metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
 460:     entityCount: 0, extractionStatus: undefined,
 461:   }))
 462:   // Enrich with extraction status from jobs table if it exists
 463:   try {
 464:     const jobRows = dbRef.prepare('SELECT episode_id, status FROM context_extraction_jobs').all()
 465:     const jobMap = new Map(jobRows.map((j: any) => [j.episode_id, j.status]))
 466:     for (const it of items) it.extractionStatus = jobMap.get(it.id) || 'none'
 467:   } catch { /* jobs table may not exist yet */ }
 468:   return { items, total }
 469: }
 470: 
 471: export interface EntityRow {
 472:   id: string
 473:   type: string
 474:   name: string
 475:   aliases: string[]
 476:   firstSeen: string
 477:   lastSeen: string
 478:   factCount: number
 479: }
 480: 
 481: export function getEntitiesList(opts: { type?: string; search?: string; limit?: number; offset?: number } = {}): { items: EntityRow[]; total: number } {
 482:   if (!dbRef) return { items: [], total: 0 }
 483:   const { type, search, limit = 50, offset = 0 } = opts
 484:   const conditions: string[] = []
 485:   const params: any[] = []
 486:   if (type && type !== 'all') { conditions.push('type = ?'); params.push(type) }
 487:   if (search) { conditions.push('(name LIKE ? OR aliases LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
 488:   const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
 489:   const total = dbRef.prepare(`SELECT COUNT(*) as c FROM context_entities${where}`).get(...params).c
 490:   const rows = dbRef.prepare(
 491:     `SELECT * FROM context_entities${where} ORDER BY last_seen DESC LIMIT ? OFFSET ?`
 492:   ).all(...params, limit, offset)
 493:   return {
 494:     total,
 495:     items: rows.map((r: any) => {
 496:       const factCount = dbRef.prepare('SELECT COUNT(*) as c FROM context_facts WHERE subject_id = ?').get(r.id).c
 497:       return {
 498:         id: r.id, type: r.type, name: r.name, aliases: JSON.parse(r.aliases || '[]'),
 499:         firstSeen: r.first_seen, lastSeen: r.last_seen, factCount,
 500:       }
 501:     }),
 502:   }
 503: }
 504: 
 505: export function getFactsList(opts: { currentOnly?: boolean; subjectId?: string; limit?: number; offset?: number } = {}): { items: Fact[]; total: number } {
 506:   if (!dbRef) return { items: [], total: 0 }
 507:   const { currentOnly, subjectId, limit = 50, offset = 0 } = opts
 508:   const conditions: string[] = []
 509:   const params: any[] = []
 510:   if (currentOnly) conditions.push('valid_to IS NULL')
 511:   if (subjectId) { conditions.push('subject_id = ?'); params.push(subjectId) }
 512:   const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
 513:   const total = dbRef.prepare(`SELECT COUNT(*) as c FROM context_facts${where}`).get(...params).c
 514:   const rows = dbRef.prepare(
 515:     `SELECT * FROM context_facts${where} ORDER BY valid_from DESC LIMIT ? OFFSET ?`
 516:   ).all(...params, limit, offset)
 517:   return { total, items: rows.map(rowToFact) }
 518: }
 519: 
 520: export function getRelatedEpisodes(entityId: string, limit: number = 10): Episode[] {
 521:   if (!dbRef) return []
 522:   const facts = dbRef.prepare('SELECT source_episode_id FROM context_facts WHERE subject_id = ?').all(entityId)
 523:   const ids = [...new Set(facts.map((f: any) => f.source_episode_id).filter(Boolean))]
 524:   if (ids.length === 0) return []
 525:   const placeholders = ids.map(() => '?').join(',')
 526:   const rows = dbRef.prepare(
 527:     `SELECT * FROM context_episodes WHERE id IN (${placeholders}) ORDER BY occurred_at DESC LIMIT ?`
 528:   ).all(...ids, limit)
 529:   return rows.map((r: any) => ({
 530:     id: r.id, source: r.source, sourceRef: r.source_ref,
 531:     content: r.content, occurredAt: r.occurred_at, ingestedAt: r.ingested_at,
 532:     metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
 533:   }))
 534: }
 535: 
 536: // ═══ Extraction Jobs ═══
 537: 
 538: export interface ExtractionJob {
 539:   id: string
 540:   episodeId: string
 541:   status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
 542:   attempts: number
 543:   lastError?: string
 544:   createdAt: number
 545:   startedAt?: number
 546:   completedAt?: number
 547:   lockedAt?: number
 548: }
 549: 
 550: export function createExtractionJob(episodeId: string): string {
 551:   if (!dbRef) return ''
 552:   const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
 553:   try {
 554:     dbRef.prepare(`
 555:       INSERT INTO context_extraction_jobs (id, episode_id, status, attempts, created_at)
 556:       VALUES (?, ?, 'pending', 0, ?)
 557:     `).run(id, episodeId, Date.now())
 558:   } catch { /* table missing */ }
 559:   return id
 560: }
 561: 
 562: export function getPendingJobs(limit: number = 5): ExtractionJob[] {
 563:   if (!dbRef) return []
 564:   try {
 565:     const rows = dbRef.prepare(
 566:       "SELECT * FROM context_extraction_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?"
 567:     ).all(limit)
 568:     return rows.map(rowToJob)
 569:   } catch { return [] }
 570: }
 571: 
 572: export function getJobs(): ExtractionJob[] {
 573:   if (!dbRef) return []
 574:   try {
 575:     return dbRef.prepare('SELECT * FROM context_extraction_jobs ORDER BY created_at DESC LIMIT 100').all().map(rowToJob)
 576:   } catch { return [] }
 577: }
 578: 
 579: export function getJob(jobId: string): ExtractionJob | undefined {
 580:   if (!dbRef) return undefined
 581:   try {
 582:     const r = dbRef.prepare('SELECT * FROM context_extraction_jobs WHERE id = ?').get(jobId)
 583:     return r ? rowToJob(r) : undefined
 584:   } catch { return undefined }
 585: }
 586: 
 587: export function updateJob(jobId: string, patch: Partial<Omit<ExtractionJob, 'id'>>): void {
 588:   if (!dbRef) return
 589:   const sets: string[] = []
 590:   const args: any[] = []
 591:   if (patch.status !== undefined) { sets.push('status = ?'); args.push(patch.status) }
 592:   if (patch.attempts !== undefined) { sets.push('attempts = ?'); args.push(patch.attempts) }
 593:   if (patch.lastError !== undefined) { sets.push('last_error = ?'); args.push(patch.lastError) }
 594:   if (patch.startedAt !== undefined) { sets.push('started_at = ?'); args.push(patch.startedAt) }
 595:   if (patch.completedAt !== undefined) { sets.push('completed_at = ?'); args.push(patch.completedAt) }
 596:   if (patch.lockedAt !== undefined) { sets.push('locked_at = ?'); args.push(patch.lockedAt) }
 597:   if (sets.length === 0) return
 598:   try {
 599:     dbRef.prepare(`UPDATE context_extraction_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...args, jobId)
 600:   } catch { /* table missing */ }
 601: }
 602: 
 603: export function retryJob(jobId: string): void {
 604:   updateJob(jobId, { status: 'pending', attempts: 0, lastError: undefined })
 605: }
 606: 
 607: function rowToJob(r: any): ExtractionJob {
 608:   return {
 609:     id: r.id, episodeId: r.episode_id, status: r.status, attempts: r.attempts || 0,
 610:     lastError: r.last_error || undefined, createdAt: r.created_at,
 611:     startedAt: r.started_at || undefined, completedAt: r.completed_at || undefined,
 612:     lockedAt: r.locked_at || undefined,
 613:   }
 614: }
 615: 
 616: export function getJobStats(): { pending: number; processing: number; completed: number; failed: number; skipped: number } {
 617:   if (!dbRef) return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 }
 618:   try {
 619:     const rows = dbRef.prepare('SELECT status, COUNT(*) as c FROM context_extraction_jobs GROUP BY status').all()
 620:     const map: Record<string, number> = {}
 621:     for (const r of rows) map[r.status] = r.c
 622:     return {
 623:       pending: map.pending || 0, processing: map.processing || 0, completed: map.completed || 0,
 624:       failed: map.failed || 0, skipped: map.skipped || 0,
 625:     }
 626:   } catch { return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 } }
 627: }
 628: export const contextBrain = { getAllCurrentFacts, addFact, logEpisode, getEpisodes, traverseFromEntity, findEntities, getEntitiesList, getFactsList };

## REQUEST R2: src/main/ai/contextScheduler.ts (FULL, 129 lines)
   1: /**
   2:  * ContextScheduler — background workers for the context system
   3:  * 
   4:  * Tier 3 batch operations (spec §21):
   5:  * - Extraction queue worker: every 60s, process pending LLM extraction jobs
   6:  * - Signal decay recalculation: every 6h, re-score aging signals
   7:  * - Embedding catch-up: every 30min, embed episodes missing embeddings
   8:  * - Full profile rebuild: daily (and on-demand via IPC)
   9:  */
  10: 
  11: import * as brain from './contextBrain'
  12: import * as userContext from './userContextService'
  13: import * as extraction from './entityExtraction'
  14: import * as embeddings from './embeddingService'
  15: 
  16: let timers: Array<ReturnType<typeof setInterval>> = []
  17: let started = false
  18: let lastRun: Record<string, number> = {}
  19: 
  20: function logWorker(name: string, detail: string) {
  21:   console.log(`[ContextScheduler] ${name}: ${detail}`)
  22: }
  23: 
  24: async function runExtractionWorker() {
  25:   try {
  26:     const processed = await extraction.processPendingJobs(3)
  27:     if (processed > 0) logWorker('extraction', `processed ${processed} job(s)`)
  28:   } catch (err: any) {
  29:     console.warn('[ContextScheduler] extraction worker error:', err?.message)
  30:   }
  31: }
  32: 
  33: function runDecayRecalc() {
  34:   try {
  35:     const now = Date.now()
  36:     const signals = userContext.getSignals(undefined, undefined, 500, true)
  37:     let updated = 0
  38:     for (const s of signals) {
  39:       if (!s.active || s.supersededBy) continue
  40:       const ageDays = (now - s.lastSeenAt) / 86400000
  41:       const halfLife = HALF_LIFE_OVERRIDES[s.signalType] ?? 90
  42:       const decay = halfLife === Infinity ? 1 : Math.exp(-ageDays / halfLife)
  43:       const newConf = Math.min(1, s.confidence * (0.6 + 0.4 * decay))
  44:       if (Math.abs(newConf - s.confidence) > 0.02) {
  45:         userContext.setSignalConfidence(s.id, newConf)
  46:         updated++
  47:       }
  48:     }
  49:     if (updated > 0) logWorker('decay', `re-scored ${updated} signal(s)`)
  50:   } catch (err: any) {
  51:     console.warn('[ContextScheduler] decay error:', err?.message)
  52:   }
  53: }
  54: 
  55: const HALF_LIFE_OVERRIDES: Record<string, number> = {
  56:   correction: 365,
  57:   preference: 180,
  58:   communication: 180,
  59:   habit: 60,
  60:   interest: 90,
  61:   milestone: Infinity,
  62:   goal_pattern: 90,
  63: }
  64: 
  65: function runEmbeddingCatchUp() {
  66:   try {
  67:     // Only run when the machine is idle-ish: skip if a reindex happened recently
  68:     if (Date.now() - (lastRun.reindex || 0) < 30 * 60000) return
  69:     const res = embeddings.reindexEpisodes()
  70:     if (res.processed > 0) logWorker('embeddings', `embedded ${res.processed} episode(s), skipped ${res.skipped}`)
  71:   } catch (err: any) {
  72:     console.warn('[ContextScheduler] embedding error:', err?.message)
  73:   }
  74: }
  75: 
  76: function runNightlyRebuild() {
  77:   try {
  78:     userContext.rebuildProfile()
  79:     logWorker('rebuild', 'full profile projection rebuilt')
  80:   } catch (err: any) {
  81:     console.warn('[ContextScheduler] rebuild error:', err?.message)
  82:   }
  83: }
  84: 
  85: export function startSchedulers(): void {
  86:   if (started) return
  87:   started = true
  88: 
  89:   // Extraction queue worker — every 60s
  90:   timers.push(setInterval(() => { runExtractionWorker() }, 60000))
  91:   // Decay recalculation — every 6h
  92:   timers.push(setInterval(() => { runDecayRecalc() }, 6 * 3600000))
  93:   // Embedding catch-up — every 30min
  94:   timers.push(setInterval(() => { runEmbeddingCatchUp() }, 30 * 60000))
  95:   // Nightly full rebuild — every 24h
  96:   timers.push(setInterval(() => { runNightlyRebuild() }, 24 * 3600000))
  97: 
  98:   // Immediate first pass (after short delay so DB is warm)
  99:   setTimeout(() => { try { runExtractionWorker() } catch {} }, 15000)
 100:   setTimeout(() => { try { runEmbeddingCatchUp() } catch {} }, 60000)
 101: 
 102:   logWorker('start', 'schedulers running (extraction 60s / decay 6h / embeddings 30m / rebuild 24h)')
 103: }
 104: 
 105: export function stopSchedulers(): void {
 106:   for (const t of timers) clearInterval(t)
 107:   timers = []
 108:   started = false
 109: }
 110: 
 111: export function getSchedulerStatus(): any {
 112:   return {
 113:     started,
 114:     lastRun: { ...lastRun },
 115:     extractionAvailable: extraction.isLlmAvailable(),
 116:     pendingJobs: (() => {
 117:       try { return brain.getJobStats() } catch { return {} }
 118:     })(),
 119:   }
 120: }
 121: 
 122: export function runNow(kind: 'extraction' | 'decay' | 'embeddings' | 'rebuild'): any {
 123:   lastRun[kind] = Date.now()
 124:   switch (kind) {
 125:     case 'extraction': return runExtractionWorker()
 126:     case 'decay': runDecayRecalc(); return { ok: true }
 127:     case 'embeddings': runEmbeddingCatchUp(); return { ok: true }
 128:     case 'rebuild': runNightlyRebuild(); return { ok: true }
 129:   }
 130: }

## R2 PRAGMA table_info(context_scheduler_state):

## REQUEST R3: src/main/ai/contextFormatter.ts (FULL, 115 lines) + src/main/ai/memoryRetrieval.ts (FULL, 62 lines)
### contextFormatter.ts:
   1: // contextFormatter.ts — formats Context Brain + Memory Store retrieval output for
   2: // injection into terminal agent sessions (assemble-context). Pure functions, no deps.
   3: // Spec: agent/docs/generate-prompt-docs/context-retrieval-memory-restore-17082026/RESULT.md
   4: 
   5: export function formatBrainContext(topic: string, result: any): string {
   6:   const lines: string[] = [];
   7:   lines.push(`## Memory — ${topic} (from Context Brain)`);
   8: 
   9:   const facts = (result?.facts || []).slice(0, 8);
  10:   if (facts.length > 0) {
  11:     lines.push('### Facts');
  12:     for (const f of facts) {
  13:       const confidence = typeof f.confidence === 'number' ? f.confidence.toFixed(2) : '?';
  14:       const objectValue = f.objectLiteral ?? f.objectId ?? '?';
  15:       lines.push(`- ${f.subjectId} ${f.predicate} ${objectValue} (confidence: ${confidence})`);
  16:     }
  17:   }
  18: 
  19:   const entities = (result?.entities || []).slice(0, 6);
  20:   if (entities.length > 0) {
  21:     lines.push('### Related entities');
  22:     for (const e of entities) {
  23:       const aliases = e.aliases?.length ? ` (aliases: ${e.aliases.join(', ')})` : '';
  24:       lines.push(`- ${e.type}: ${e.name}${aliases}`);
  25:     }
  26:   }
  27: 
  28:   const episodes = (result?.episodes || []).slice(0, 5);
  29:   if (episodes.length > 0) {
  30:     lines.push('### Relevant episodes');
  31:     for (const ep of episodes) {
  32:       const excerpt = String(ep.content || '').replace(/\s+/g, ' ').slice(0, 200);
  33:       lines.push(`- [${ep.source}] ${excerpt}... (${ep.occurredAt || ''})`);
  34:     }
  35:   }
  36: 
  37:   return lines.join('\n');
  38: }
  39: 
  40: export function formatMemoryContext(agentMemories: any[], chatMemories: any[]): string {
  41:   const items: string[] = [];
  42:   for (const m of (agentMemories || []).slice(0, 3)) {
  43:     const date = m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : '';
  44:     const excerpt = String(m.content || '').replace(/\s+/g, ' ').slice(0, 200);
  45:     items.push(`- ${excerpt}... (${date})`);
  46:   }
  47:   for (const m of (chatMemories || []).slice(0, 3)) {
  48:     const date = m.created_at ? String(m.created_at).slice(0, 10) : '';
  49:     const excerpt = String(m.content || '').replace(/\s+/g, ' ').slice(0, 200);
  50:     items.push(`- ${excerpt}... (${date})`);
  51:   }
  52:   if (items.length === 0) return '';
  53:   return ['## Memory — saved notes', ...items].join('\n');
  54: }
  55: 
  56: export function truncateToBudget(markdownString: string, maxChars: number): string {
  57:   if (markdownString.length <= maxChars) return markdownString;
  58: 
  59:   const sections = splitSections(markdownString);
  60:   const facts = sections.filter(s => s.header.includes('Facts'));
  61:   const entities = sections.filter(s => s.header.includes('entities'));
  62:   const episodes = sections.filter(s => s.header.includes('episodes'));
  63:   const notes = sections.filter(s => s.header.includes('saved notes'));
  64: 
  65:   let output = '';
  66:   let currentLength = 0;
  67: 
  68:   for (const block of [...facts, ...entities]) {
  69:     output += block.raw + '\n';
  70:     currentLength += block.raw.length;
  71:   }
  72: 
  73:   episodes.sort((a, b) => b.raw.length - a.raw.length);
  74:   for (const ep of episodes) {
  75:     if (currentLength + ep.raw.length < maxChars - 200) {
  76:       output += ep.raw + '\n';
  77:       currentLength += ep.raw.length;
  78:     } else {
  79:       const allowedChars = maxChars - currentLength - 100;
  80:       if (allowedChars > 50) {
  81:         output += ep.raw.substring(0, allowedChars) + '... [TRUNCATED]\n';
  82:       }
  83:       break;
  84:     }
  85:   }
  86: 
  87:   for (const note of notes) {
  88:     if (currentLength + note.raw.length < maxChars) {
  89:       output += note.raw + '\n';
  90:       currentLength += note.raw.length;
  91:     }
  92:   }
  93: 
  94:   if (output.length > maxChars) {
  95:     output = output.substring(0, Math.max(0, maxChars - 3)) + '...';
  96:   }
  97: 
  98:   return output.trim();
  99: }
 100: 
 101: function splitSections(markdownString: string): Array<{ header: string; raw: string }> {
 102:   const sections: Array<{ header: string; raw: string }> = [];
 103:   let currentHeader = '';
 104:   let currentBody: string[] = [];
 105:   for (const line of markdownString.split('\n')) {
 106:     if (line.startsWith('### ')) {
 107:       if (currentHeader) sections.push({ header: currentHeader, raw: [currentHeader, ...currentBody].join('\n') });
 108:       currentHeader = line;
 109:       currentBody = [];
 110:     } else {
 111:       currentBody.push(line);
 112:     }
 113:   }
 114:   if (currentHeader) sections.push({ header: currentHeader, raw: [currentHeader, ...currentBody].join('\n') });
 115:   return sections;
 116: }
### memoryRetrieval.ts:
   1: import type { Database } from "better-sqlite3"
   2: 
   3: export function getRelevantMemories(
   4:   db: Database,
   5:   threadDate: string,
   6:   query?: string,
   7:   limit = 8
   8: ): Array<{ id: string; content: string; category: string; importance: number }> {
   9:   let current: any[] = []
  10: 
  11:   if (threadDate && threadDate.trim().length > 0) {
  12:     current = db.prepare(`
  13:       SELECT id, content, category, importance 
  14:       FROM ai_chat_memories 
  15:       WHERE thread_date = ? 
  16:       ORDER BY importance DESC, created_at DESC 
  17:       LIMIT ?
  18:     `).all(threadDate, limit) as any[]
  19:   } else if (query && query.trim().length > 0) {
  20:     const searchPattern = `%${query.trim()}%`
  21:     current = db.prepare(`
  22:       SELECT id, content, category, importance 
  23:       FROM ai_chat_memories 
  24:       WHERE content LIKE ? OR category LIKE ?
  25:       ORDER BY importance DESC, created_at DESC 
  26:       LIMIT ?
  27:     `).all(searchPattern, searchPattern, limit) as any[]
  28: 
  29:     if (current.length === 0) {
  30:       current = db.prepare(`
  31:         SELECT id, content, category, importance 
  32:         FROM ai_chat_memories 
  33:         ORDER BY importance DESC, created_at DESC 
  34:         LIMIT ?
  35:       `).all(limit) as any[]
  36:     }
  37:   } else {
  38:     current = db.prepare(`
  39:       SELECT id, content, category, importance 
  40:       FROM ai_chat_memories 
  41:       ORDER BY importance DESC, created_at DESC 
  42:       LIMIT ?
  43:     `).all(limit) as any[]
  44:   }
  45: 
  46:   const recent = db.prepare(`
  47:     SELECT id, content, category, importance 
  48:     FROM ai_chat_memories 
  49:     WHERE thread_date != ? AND importance > 0.6
  50:     ORDER BY created_at DESC 
  51:     LIMIT ?
  52:   `).all(threadDate || '__none__', Math.floor(limit / 2)) as any[]
  53: 
  54:   const merged = [...current, ...recent]
  55:   const seen = new Set<string>()
  56:   return merged.filter(m => {
  57:     const key = m.content.toLowerCase().slice(0, 30)
  58:     if (seen.has(key)) return false
  59:     seen.add(key)
  60:     return true
  61:   }).slice(0, limit)
  62: }

## REQUEST R4: src/main.ts 17960-18010 (backfill wiring)
17960:                 const p = userPreferences || {};
17961:                 const pState = migrateProviderNames(JSON.parse(p.aiProviders || 'null'));
17962:                 if (!pState || !pState.providers || pState.providers.filter((x: any) => x.enabled).length === 0) {
17963:                     throw new Error('No AI provider configured');
17964:                 }
17965:                 const chain = buildChain(pState, 'goalAssistant');
17966:                 if (chain.length === 0) throw new Error('No AI provider configured');
17967:                 const { result } = await runWithFallback(chain, {
17968:                     systemPrompt,
17969:                     messages: [{ role: 'user', content: prompt }],
17970:                     maxTokens: maxTokens || 600,
17971:                 });
17972:                 return result.content;
17973:             });
17974:             console.log('[ContextBrain] LLM extraction caller wired');
17975:         } catch (e: any) { console.warn('[ContextBrain] LLM caller wiring failed:', e?.message); }
17976:         // Start background schedulers
17977:         try {
17978:             const { startSchedulers } = require('./main/ai/contextScheduler');
17979:             startSchedulers();
17980:         } catch (e: any) { console.warn('[ContextBrain] Scheduler start failed:', e?.message); }
17981:         // History backfill — mine existing data into the brain (idempotent)
17982:         try {
17983:             const { setContextDb, runContextBackfill } = require('./main/ai/contextBackfill');
17984:             setContextDb(db);
17985:             setTimeout(() => { try { runContextBackfill() } catch {} }, 3000);
17986:         } catch (e: any) { console.warn('[ContextBackfill] init failed:', e?.message); }
17987:         // Rebuild profile on startup from existing data
17988:         setTimeout(() => { try { userContextService.rebuildProfile(); } catch {} }, 5000);
17989:         // Embedding catch-up after warmup
17990:         setTimeout(() => { try { require('./main/ai/embeddingService').reindexEpisodes(); } catch {} }, 20000);
17991:     } catch (e) { console.error('[Context] Init failed:', e); }
17992: }
17993: 
17994: // Initialize Context Brain system on startup
17995: let mcpServerRunning = false;
17996: function initContextBrain() {
17997:     try {
17998:         contextBrain.setBrainDb(db);
17999:         // Start MCP server
18000:         const { startMcpServer } = require('./main/ai/contextBrainMCP');
18001:         const server = startMcpServer();
18002:         if (server) mcpServerRunning = true;
18003:         console.log('[ContextBrain] Initialized');
18004:     } catch (e) { console.error('[ContextBrain] Init failed:', e); }
18005: }
18006: 
18007: electron_1.ipcMain.handle('memory:get', async (_event, tier: string, limit: number = 50) => {
18008:     return memoryStore.getMemoriesByTier(tier, limit);
18009: });
18010: 

### R4: brain:enrich-prompt handler
18222: electron_1.ipcMain.handle('brain:enrich-prompt', async (_event, opts?: any) => {
18223:     try {
18224:         const prompt = opts?.prompt || ''
18225:         const budget = opts?.tokenBudget || 800
18226:         const health = await (async () => { try { const h = db.prepare('SELECT COUNT(*) as c FROM context_entities').get().c; return h > 0 } catch { return false } })()
18227:         if (!health) return { enriched: prompt, usedFacts: 0, tokensEst: Math.ceil(prompt.length / 4) }
18228:         const facts = contextBrain.getFactsList({ currentOnly: true, limit: 200 }).items || []
18229:         const entities = contextBrain.getEntitiesList({ limit: 500 }).items || []
18230:         const entityMap = new Map(entities.map((e: any) => [e.id, e]))
18231:         const tokens = prompt.toLowerCase().split(/\W+/).filter(Boolean)
18232:         const scored = facts.map((f: any) => {
18233:             const hay = `${entityMap.get(f.subjectId)?.name || f.subjectId} ${f.predicate} ${f.objectLiteral}`.toLowerCase()
18234:             const overlap = tokens.reduce((acc: number, t: string) => acc + (hay.includes(t) ? 1 : 0), 0)
18235:             return { f, score: overlap }
18236:         }).filter((x: any) => x.score > 0).sort((a: any, b: any) => b.score - a.score)
18237:         const lines: string[] = [prompt, '', '--- Brain context ---']
18238:         let used = 0, tok = 0
18239:         for (const { f } of scored) {
18240:             const srcName = entityMap.get(f.subjectId)?.name || f.subjectId
18241:             const line = `- ${srcName}: ${f.predicate} ${f.objectLiteral}`
18242:             if (tok + Math.ceil(line.length / 4) > budget) break
18243:             lines.push(line); tok += Math.ceil(line.length / 4); used++
18244:         }
18245:         const enriched = used > 0 ? lines.join('\n') : prompt
18246:         return { enriched, usedFacts: used, tokensEst: Math.ceil(enriched.length / 4) }
18247:     } catch (e: any) {
18248:         return { enriched: opts?.prompt || '', usedFacts: 0, tokensEst: 0, error: e?.message }
18249:     }
18250: })
18251: 
18252: electron_1.ipcMain.handle('brain:run-extraction', async (_event, opts?: any) => {
18253:     try {
18254:         const { runNow } = require('./main/ai/contextScheduler')
18255:         const r = await runNow('extraction')
18256:         return { processed: r?.processed ?? 0, ok: true }
18257:     } catch (e: any) { return { processed: 0, ok: false, error: e?.message } }
18258: })
18259: 
18260: electron_1.ipcMain.handle('brain:evaluate', async () => {
18261:     const checks: any[] = []
18262:     const skip = (name: string, reason: string) => checks.push({ name, pass: true, skipped: true, value: null, threshold: null, detail: reason })
18263:     try {
18264:         const entityCount = db.prepare('SELECT COUNT(*) as c FROM context_entities').get().c
18265:         const factCount = db.prepare('SELECT COUNT(*) as c FROM context_facts').get().c
18266:         const factWithObject = db.prepare('SELECT COUNT(*) as c FROM context_facts WHERE object_id IS NOT NULL').get().c
18267:         const episodeCount = db.prepare('SELECT COUNT(*) as c FROM context_episodes').get().c
18268:         const captureCount = db.prepare('SELECT COUNT(*) as c FROM ai_context_captures').get().c
18269:         const captureWithEpisode = db.prepare("SELECT COUNT(*) as c FROM ai_context_captures WHERE episode_status = 'episode_written'").get().c
18270:         const orphanFacts = db.prepare('SELECT COUNT(*) as c FROM context_facts f LEFT JOIN context_entities e ON f.subject_id = e.id WHERE e.id IS NULL').get().c
18271:         const totalJobs = db.prepare('SELECT COUNT(*) as c FROM context_extraction_jobs').get().c
18272:         const completedJobs = db.prepare("SELECT COUNT(*) as c FROM context_extraction_jobs WHERE status = 'completed'").get().c
18273:         const failedJobs = db.prepare("SELECT COUNT(*) as c FROM context_extraction_jobs WHERE status = 'failed'").get().c
18274:         const embeddedCount = (() => { try { return db.prepare('SELECT COUNT(*) as c FROM context_embeddings').get().c } catch { return 0 } })()
18275:         const schedState = (() => { try { return db.prepare("SELECT value FROM context_scheduler_state WHERE key = 'signal_decay.lastRun'").get()?.value } catch { return null } })()

### R4: brain:export-subgraph handler
18138: electron_1.ipcMain.handle('brain:export-subgraph', async (_event, opts?: any) => {
18139:     try {
18140:         const rootId = opts?.rootId
18141:         const entityIds = opts?.entityIds || []
18142:         const depth = opts?.depth || 2
18143:         const budget = opts?.tokenBudget || 1200
18144:         const entities = contextBrain.getEntitiesList({ limit: 500 }).items || []
18145:         const facts = contextBrain.getFactsList({ currentOnly: true, limit: 1000 }).items || []
18146:         const entityMap = new Map(entities.map((e: any) => [e.id, e]))
18147: 
18148:         // BFS from root or explicit set
18149:         const selected = new Set<string>(entityIds)
18150:         if (rootId && entityMap.has(rootId)) {
18151:             const queue: Array<{ id: string; d: number }> = [{ id: rootId, d: 0 }]
18152:             const visited = new Set<string>([rootId])
18153:             selected.add(rootId)
18154:             while (queue.length) {
18155:                 const { id, d } = queue.shift()!
18156:                 if (d >= depth) continue
18157:                 for (const f of facts) {
18158:                     if (f.subjectId === id && f.objectId && entityMap.has(f.objectId)) {
18159:                         if (!visited.has(f.objectId)) { visited.add(f.objectId); selected.add(f.objectId); queue.push({ id: f.objectId, d: d + 1 }) }
18160:                     }
18161:                     if (f.objectId === id && entityMap.has(f.subjectId)) {
18162:                         if (!visited.has(f.subjectId)) { visited.add(f.subjectId); selected.add(f.subjectId); queue.push({ id: f.subjectId, d: d + 1 }) }
18163:                     }
18164:                 }
18165:             }
18166:         }
18167:         // If no root/explicit, take top by degree
18168:         if (selected.size === 0) {
18169:             const deg = new Map<string, number>()
18170:             for (const f of facts) {
18171:                 if (f.objectId) { deg.set(f.subjectId, (deg.get(f.subjectId) || 0) + 1); deg.set(f.objectId, (deg.get(f.objectId) || 0) + 1) }
18172:             }
18173:             Array.from(entityMap.keys()).sort((a, b) => (deg.get(b) || 0) - (deg.get(a) || 0)).slice(0, 20).forEach(id => selected.add(id))
18174:         }
18175: 
18176:         // Fill by degree desc
18177:         const deg = new Map<string, number>()
18178:         for (const f of facts) {
18179:             if (f.objectId && selected.has(f.subjectId) && selected.has(f.objectId)) {
18180:                 deg.set(f.subjectId, (deg.get(f.subjectId) || 0) + 1)
18181:                 deg.set(f.objectId, (deg.get(f.objectId) || 0) + 1)
18182:             }
18183:         }
18184:         const selectedArr = Array.from(selected).filter(id => entityMap.has(id))
18185: 
18186:         // Build text
18187:         const lines: string[] = ['# Brain subgraph', '']
18188:         lines.push('## Entities')
18189:         for (const id of selectedArr) {
18190:             const e = entityMap.get(id)
18191:             lines.push(`- ${e.name} (${e.type})`)
18192:         }
18193:         lines.push('')

### R4: brain:evaluate signal_decay_ran region
18260: electron_1.ipcMain.handle('brain:evaluate', async () => {
18261:     const checks: any[] = []
18262:     const skip = (name: string, reason: string) => checks.push({ name, pass: true, skipped: true, value: null, threshold: null, detail: reason })
18263:     try {
18264:         const entityCount = db.prepare('SELECT COUNT(*) as c FROM context_entities').get().c
18265:         const factCount = db.prepare('SELECT COUNT(*) as c FROM context_facts').get().c
18266:         const factWithObject = db.prepare('SELECT COUNT(*) as c FROM context_facts WHERE object_id IS NOT NULL').get().c
18267:         const episodeCount = db.prepare('SELECT COUNT(*) as c FROM context_episodes').get().c
18268:         const captureCount = db.prepare('SELECT COUNT(*) as c FROM ai_context_captures').get().c
18269:         const captureWithEpisode = db.prepare("SELECT COUNT(*) as c FROM ai_context_captures WHERE episode_status = 'episode_written'").get().c
18270:         const orphanFacts = db.prepare('SELECT COUNT(*) as c FROM context_facts f LEFT JOIN context_entities e ON f.subject_id = e.id WHERE e.id IS NULL').get().c
18271:         const totalJobs = db.prepare('SELECT COUNT(*) as c FROM context_extraction_jobs').get().c
18272:         const completedJobs = db.prepare("SELECT COUNT(*) as c FROM context_extraction_jobs WHERE status = 'completed'").get().c
18273:         const failedJobs = db.prepare("SELECT COUNT(*) as c FROM context_extraction_jobs WHERE status = 'failed'").get().c
18274:         const embeddedCount = (() => { try { return db.prepare('SELECT COUNT(*) as c FROM context_embeddings').get().c } catch { return 0 } })()
18275:         const schedState = (() => { try { return db.prepare("SELECT value FROM context_scheduler_state WHERE key = 'signal_decay.lastRun'").get()?.value } catch { return null } })()
18276:         const profileState = (() => { try { return db.prepare("SELECT value FROM context_scheduler_state WHERE key = 'profile.lastRebuild'").get()?.value } catch { return null } })()
18277: 
18278:         checks.push({ name: 'entities_exist', pass: entityCount > 0, value: entityCount, threshold: 1, detail: entityCount > 0 ? 'ok' : 'no entities' })
18279:         checks.push({ name: 'edges_exist', pass: factWithObject > 0, value: factWithObject, threshold: 1, detail: factWithObject > 0 ? 'ok' : 'no real edges (objectId missing)' })
18280:         checks.push({ name: 'no_orphan_facts', pass: orphanFacts === 0, value: orphanFacts, threshold: 0, detail: orphanFacts === 0 ? 'ok' : `${orphanFacts} orphan facts` })
18281: 
18282:         if (totalJobs < 5) {
18283:             skip('extraction_success_rate', `only ${totalJobs} jobs (need >=5)`)
18284:         } else {
18285:             const rate = totalJobs > 0 ? completedJobs / totalJobs : 0
18286:             checks.push({ name: 'extraction_success_rate', pass: rate > 0.8, value: rate, threshold: 0.8, detail: `${completedJobs}/${totalJobs}` })
18287:         }
18288: 
18289:         // capture_to_entity_latency: needs logger deltas — skip for now
18290:         skip('capture_to_entity_latency', 'logger delta tracking not wired yet')
18291: 
18292:         const decayOk = schedState ? (Date.now() - Number(schedState) < 7 * 3600 * 1000) : false
18293:         checks.push({ name: 'signal_decay_ran', pass: schedState ? decayOk : false, value: schedState ? Number(schedState) : null, threshold: 7 * 3600 * 1000, detail: schedState ? (decayOk ? 'ok' : 'stale') : 'no recorded run' })
18294: 
18295:         const profileOk = profileState ? (Date.now() - Number(profileState) < 25 * 3600 * 1000) : false
18296:         checks.push({ name: 'profile_fresh', pass: profileState ? profileOk : false, value: profileState ? Number(profileState) : null, threshold: 25 * 3600 * 1000, detail: profileState ? (profileOk ? 'ok' : 'stale') : 'no recorded rebuild' })
18297: 
18298:         const embCoverage = episodeCount > 0 ? embeddedCount / episodeCount : 0
18299:         checks.push({ name: 'embeddings_coverage', pass: episodeCount === 0 ? true : embCoverage > 0.5, value: embCoverage, threshold: 0.5, detail: `${embeddedCount}/${episodeCount}` })
18300: 
18301:         // mcp server up
18302:         let mcpUp = false
18303:         try {
18304:             const http = require('http')
18305:             mcpUp = await new Promise((resolve) => {
18306:                 const req = http.get('http://127.0.0.1:54322', (res: any) => { resolve(res.statusCode === 200) })
18307:                 req.on('error', () => resolve(false))
18308:                 req.setTimeout(1000, () => { req.destroy(); resolve(false) })
18309:             })
18310:         } catch {}
18311:         checks.push({ name: 'mcp_server_up', pass: mcpUp, value: mcpUp, threshold: true, detail: mcpUp ? 'ok' : 'not responding on 54322' })
18312: 
18313:         const nonSkipped = checks.filter(c => !c.skipped)
18314:         const pass = nonSkipped.every(c => c.pass)
18315:         return { pass, checks }
18316:     } catch (e: any) {
18317:         return { pass: false, checks, error: e?.message }
18318:     }
18319: })
18320: 
18321: electron_1.ipcMain.handle('brain:health', async () => {
18322:     try {
18323:         const entityCount = db.prepare('SELECT COUNT(*) as c FROM context_entities').get().c;
18324:         const factCount = db.prepare('SELECT COUNT(*) as c FROM context_facts').get().c;
18325:         const factWithObject = db.prepare('SELECT COUNT(*) as c FROM context_facts WHERE object_id IS NOT NULL').get().c;
18326:         const episodeCount = db.prepare('SELECT COUNT(*) as c FROM context_episodes').get().c;
18327:         const captureCount = db.prepare('SELECT COUNT(*) as c FROM ai_context_captures').get().c;
18328:         const pendingJobs = db.prepare("SELECT COUNT(*) as c FROM context_extraction_jobs WHERE status = 'pending'").get().c;
18329:         const orphanFacts = db.prepare('SELECT COUNT(*) as c FROM context_facts f LEFT JOIN context_entities e ON f.subject_id = e.id WHERE e.id IS NULL').get().c;
18330:         const status = entityCount === 0 ? 'red' : (factWithObject === 0 ? 'amber' : 'green');
18331:         const reason = entityCount === 0
18332:             ? (captureCount === 0 ? 'no captures yet' : 'captures exist but no entities extracted')
18333:             : (factWithObject === 0 ? 'entities exist but no edges (objectId missing)' : 'healthy');
18334:         return { status, reason, entities: entityCount, facts: factCount, factsWithObject: factWithObject, episodes: episodeCount, captures: captureCount, pendingJobs, orphanFacts };
18335:     } catch (e: any) {

### R4: writeAiChatEpisode call sites (3 lines context each)
22600-    tx();
22601-    // Capture AI chat episode into context brain (debounced per thread)
22602-    try {
22603:      episodeWriters.writeAiChatEpisode(messages.filter((m: any) => m.role === 'user'), threadDate);
22604-    } catch {}
22605-    // Mirror into the Chat Library so in-app chats are searchable/groupable
22606-    // alongside external-AI captures. Idempotent — same transcript is a no-op.

## REQUEST R5: src/main/ai/conceptExtraction.ts (FULL, 66 lines) + src/main/ai/predicates.ts (FULL, 55 lines)
### conceptExtraction.ts:
   1: /**
   2:  * conceptExtraction.ts — pure, deterministic, LLM-free concept extractor.
   3:  *
   4:  * Used at capture time so every capture produces connected graph edges even
   5:  * when no LLM is configured. Regex + static dictionary only; no network, no
   6:  * DB access, no side effects. Fully unit-testable.
   7:  */
   8: const TECH_TOKENS = [
   9:   'react', 'typescript', 'python', 'rust', 'electron', 'sqlite', 'vite', 'node',
  10:   'docker', 'git', 'tailwind', 'framer', 'next.js', 'three.js', 'svelte',
  11:   'vue', 'angular', 'webpack', 'rollup', 'esbuild', 'prisma', 'postgres',
  12:   'redis', 'mongodb', 'graphql', 'rest', 'api', 'oauth', 'jwt', 'css',
  13:   'html', 'javascript', 'java', 'go', 'rust', 'kotlin', 'swift', 'flutter',
  14:   'ollama', 'openai', 'claude', 'anthropic', 'gemini', 'ollama', 'llm',
  15:   'mcp', 'sqlite', 'better-sqlite3', 'tailwindcss', 'framer-motion',
  16:   'd3', 'canvas', 'webgl', 'threejs', 'r3f',
  17: ]
  18: 
  19: const STOPWORD_HEADS = new Set([
  20:   'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'How',
  21:   'Why', 'Who', 'If', 'We', 'I', 'You', 'He', 'She', 'It', 'They', 'A', 'An',
  22:   'And', 'But', 'Or', 'So', 'Yet', 'For', 'To', 'Of', 'In', 'On', 'At', 'By',
  23:   'With', 'From', 'As', 'Is', 'Are', 'Was', 'Were', 'Be', 'Been', 'Being',
  24:   'Have', 'Has', 'Had', 'Do', 'Does', 'Did', 'Will', 'Would', 'Could', 'Should',
  25:   'May', 'Might', 'Must', 'Can', 'Shall', 'Not', 'No', 'Yes', 'OK', 'Okay',
  26: ])
  27: 
  28: const CAP_PHRASE_RE = /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,3})\b/g
  29: 
  30: export function extractConcepts(text: string, providerName?: string): string[] {
  31:   const seen = new Set<string>()
  32:   const concepts: string[] = []
  33:   const providerKey = (providerName || '').toLowerCase()
  34: 
  35:   // 1. Tech/dictionary tokens (lowercase match, surfaced capitalised)
  36:   const lower = text.toLowerCase()
  37:   for (const tok of TECH_TOKENS) {
  38:     if (concepts.length >= 24) break
  39:     if (lower.includes(tok) && !seen.has(tok)) {
  40:       seen.add(tok)
  41:       concepts.push(tok.charAt(0).toUpperCase() + tok.slice(1))
  42:     }
  43:   }
  44: 
  45:   // 2. Capitalized phrases
  46:   let m: RegExpExecArray | null
  47:   CAP_PHRASE_RE.lastIndex = 0
  48:   while ((m = CAP_PHRASE_RE.exec(text)) !== null) {
  49:     if (concepts.length >= 24) break
  50:     const name = m[1].trim()
  51:     if (name.length < 2 || name.length > 40) continue
  52:     const words = name.split(/\s+/)
  53:     if (words.length > 4) continue
  54:     if (/^\d/.test(name)) continue
  55:     if (STOPWORD_HEADS.has(words[0])) continue
  56:     const key = name.toLowerCase()
  57:     if (seen.has(key)) continue
  58:     if (providerKey && key === providerKey) continue
  59:     seen.add(key)
  60:     concepts.push(name)
  61:     if (concepts.length >= 8 + 16) break
  62:   }
  63: 
  64:   // Cap: 8 from phrases + 16 from tokens, but total ≤ 24
  65:   return concepts.slice(0, 24)
  66: }
### predicates.ts:
   1: /**
   2:  * predicates.ts — canonical predicate vocabulary for the Context Brain.
   3:  *
   4:  * Every episode writer and the LLM extraction layer MUST import predicate
   5:  * strings from here. Typos silently fragment the graph (EntityDetailPanel
   6:  * renders per-predicate, and retrieval ranks by predicate), so a registry with
   7:  * a typed union is the single source of truth.
   8:  *
   9:  * Adding a predicate: append to PREDICATES and to the Predicate type.
  10:  * Unknown predicates at write time are logged (warn) but not blocked, so a
  11:  * new writer can ship before the registry is updated.
  12:  */
  13: export const PREDICATES = {
  14:   // status / state
  15:   HAS_STATUS: 'has_status',
  16:   HAS_PHASE: 'has_phase',
  17:   HAS_CONVERSATION: 'has_conversation',
  18:   HAS_AMOUNT: 'has_amount',
  19:   HAS_ACCOUNT: 'has_account',
  20:   HAS_PROGRESS: 'has_progress',
  21:   // categorisation
  22:   IN_CATEGORY: 'in_category',
  23:   IN_SERIES: 'in_series',
  24:   BELONGS_TO_COURSE: 'belongs_to_course',
  25:   BELONGS_TO_PROJECT: 'belongs_to_project',
  26:   // relationships
  27:   WITH_PERSON: 'with_person',
  28:   TAUGHT_LESSON: 'taught_lesson',
  29:   COVERS_TOPIC: 'covers_topic',
  30:   PRODUCED_IDEA: 'produced_idea',
  31:   // temporal
  32:   COMPLETED_AT: 'completed_at',
  33:   TRANSACTED_ON: 'transacted_on',
  34:   DUE_DATE: 'due_date',
  35:   SUMMARIZED_AS: 'summarized_as',
  36:   // activity
  37:   RAN_COMMAND: 'ran_command',
  38:   ERRORED_WITH: 'errored_with',
  39:   IN_SESSION: 'in_session',
  40:   SAID_IN_CHAT: 'said_in_chat',
  41:   DISCUSSED: 'discussed',
  42:   MENTIONS: 'mentions',
  43:   AT_LOCATION: 'at_location',
  44:   PLAYED_MEDIA: 'played_media',
  45:   // co-occurrence (synthetic, rendering-time only — never persisted)
  46:   CO_OCCURS: 'co_occurs',
  47:   // generic
  48:   RELATES: 'relates',
  49: } as const
  50: 
  51: export type Predicate = (typeof PREDICATES)[keyof typeof PREDICATES]
  52: 
  53: export function isKnownPredicate(p: string): p is Predicate {
  54:   return (Object.values(PREDICATES) as string[]).includes(p)
  55: }

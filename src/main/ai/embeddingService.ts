/**
 * EmbeddingService — local embedding generation + cosine similarity search
 * 
 * Primary: hashed term-vector (bag-of-words with hashing to a fixed
 * dimension, L2-normalized) — zero native dependencies, works offline.
 * Optional: lazy-loads transformers.js ONNX/WASM model when available
 * (NOT installed by default — the fallback keeps everything functional).
 * 
 * Embeddings are stored as Float32Array BLOBs in context_embeddings.
 */

import * as brain from './contextBrain'
import * as userContext from './userContextService'

// D1 (WP-D, R-4): 256 → 512. Random overlap at 512 dims is ~0.044, so
// MIN_SEMANTIC_SCORE = 0.12 is ~2.7 sigma — real matches only.
const DIM = 512
const MIN_SEMANTIC_SCORE = 0.12

// ═══ Hashing ═══
function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'this', 'that', 'these', 'those', 'my', 'your', 'our', 'their', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'can', 'could', 'should', 'not', 'no', 'so', 'if', 'then', 'than',
  'too', 'very', 'just', 'about', 'into', 'over', 'after', 'before', 'again', 'once', 'here', 'there'])

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
}

export function embedText(text: string): number[] {
  const vec = new Array(DIM).fill(0)
  const tokens = tokenize(text)
  // D2 (WP-D, R-4): signed hashing — collisions cancel instead of piling up —
  // plus adjacent-bigram terms so short phrases survive tokenization.
  const add = (term: string, w: number) => {
    const h = hashString(term)
    const sign = (hashString(term + '#') & 1) ? 1 : -1
    vec[h % DIM] += sign * w
  }
  const counts = new Map<string, number>()
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1)
  for (const [t, c] of counts) add(t, 1 + Math.log(c))
  for (let i = 0; i + 1 < tokens.length; i++) add(tokens[i] + ' ' + tokens[i + 1], 0.6)
  // L2 normalize
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  return vec.map(v => v / norm)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot // both normalized → dot = cosine
}

// ═══ Embedding storage ═══

// D3 (WP-D): in-memory cache so a query does not rebuild every vector.
let cache: Array<{ refId: string; refType: string; vec: Float32Array }> | null = null
export function invalidateEmbeddingCache() { cache = null }
function loadCache() {
  if (!cache) {
    cache = brain.getAllEmbeddings()
      .filter(e => e.vec.length === DIM) // old 256-d vectors are ignored until reindexed
      .map(e => ({ refId: e.refId, refType: e.refType, vec: Float32Array.from(e.vec) }))
  }
  return cache
}

export function embedEpisode(episodeId: string, content: string): void {
  const vec = embedText(content)
  brain.storeEmbedding(episodeId, 'episode', vec)
  invalidateEmbeddingCache()
}

export function embedSignal(signalId: string, content: string): void {
  const vec = embedText(content)
  brain.storeEmbedding(signalId, 'signal', vec)
  invalidateEmbeddingCache()
}

// ═══ Search ═══

export function searchEmbeddings(query: string, limit: number = 10): Array<{ refId: string; refType: string; score: number }> {
  const queryVec = Float32Array.from(embedText(query))
  const scored = loadCache()
    .map(({ refId, refType, vec }) => {
      let dot = 0
      for (let i = 0; i < queryVec.length; i++) dot += queryVec[i] * vec[i]
      return { refId, refType, score: dot } // both normalized → dot = cosine
    })
    .filter(r => r.score >= MIN_SEMANTIC_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return scored
}

function getRawEmbeddings(): Array<{ refId: string; refType: string; vec: number[] }> {
  // Reached via brain's db — export a helper from contextBrain
  return brain.getAllEmbeddings()
}

// ═══ Reindex ═══

// D4 (WP-D): re-embed old-dimension vectors and include signals. Note the
// lenOf helper: brain.getEmbedding's real return type is ASSUMED (R1), so it
// accepts both a raw array and a { vec } wrapper shape.
export function reindexAll(): { episodes: number; signals: number; skipped: number } {
  let episodes = 0, signals = 0, skipped = 0
  const lenOf = (v: any) => Array.isArray(v) ? v.length : (v?.vec?.length ?? v?.length ?? 0)
  for (const ep of brain.getEpisodes(undefined, 5000)) {
    if (lenOf(brain.getEmbedding(ep.id)) === DIM) { skipped++; continue }
    embedEpisode(ep.id, ep.content); episodes++
  }
  for (const s of userContext.getSignals(undefined, undefined, 5000)) {
    if (lenOf(brain.getEmbedding(s.id)) === DIM) { skipped++; continue }
    embedSignal(s.id, s.content); signals++
  }
  invalidateEmbeddingCache()
  return { episodes, signals, skipped }
}

export function reindexEpisodes(): { processed: number; skipped: number } {
  const r = reindexAll()
  return { processed: r.episodes, skipped: r.skipped }
}

// ═══ Optional transformers.js lazy load (NOT installed by default) ═══

// Downloads a model from the network on first use. Do not call without an explicit user opt-in.

let semanticModel: any = null
let semanticAttempted = false

export async function tryLoadSemanticModel(): Promise<boolean> {
  if (semanticModel) return true
  if (semanticAttempted) return false
  semanticAttempted = true
  try {
    const mod = await import('@xenova/transformers')
    const { pipeline } = mod as any
    semanticModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    return true
  } catch {
    return false
  }
}

export async function semanticEmbed(text: string): Promise<number[] | null> {
  if (!semanticModel) return null
  try {
    const out = await semanticModel(text, { pooling: 'mean', normalize: true })
    return Array.from(out.data as Float32Array)
  } catch {
    return null
  }
}

// ═══ Hybrid retrieval (keyword + embedding) ═══

// D5 (WP-D): rank fusion (RRF) instead of mixing raw scores — keyword scores
// and cosine similarities live on different scales, so the old weighted sum
// compared apples to seconds.
export function hybridSearch(query: string, limit: number = 15): Array<{ type: string; id: string; score: number }> {
  const K = 60
  const merged = new Map<string, { type: string; id: string; score: number }>()
  const add = (type: string, id: string, rank: number) => {
    const k = `${type}:${id}`
    const cur = merged.get(k)
    const s = 1 / (K + rank + 1)
    if (cur) cur.score += s
    else merged.set(k, { type, id, score: s })
  }
  brain.keywordSearch(query, limit * 2).forEach((k, i) => add(k.type, k.id, i))
  searchEmbeddings(query, limit * 2).forEach((s, i) => add(s.refType === 'episode' ? 'episode' : 'signal', s.refId, i))
  const max = 2 / (K + 1)
  return Array.from(merged.values()).map(m => ({ ...m, score: Math.min(1, m.score / max) }))
    .sort((a, b) => b.score - a.score).slice(0, limit)
}
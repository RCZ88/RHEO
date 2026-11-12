// Mock contextBrain for the WP-D probe (aliased over the real module).
let state = { episodes: [], signals: [], embeddings: new Map() }

export function __setMockBrain(next) { state = next }
export function getAllEmbeddings() {
  return Array.from(state.embeddings.entries())
    .map(([refId, [refType, vec]]) => ({ refId, refType, vec: Array.from(vec) }))
}
export function getEmbedding(id) {
  const e = state.embeddings.get(id)
  return e ? Array.from(e[1]) : undefined
}
export function storeEmbedding(refId, refType, vec) { state.embeddings.set(refId, [refType, vec]) }
export function getEpisodes() { return state.episodes }
export function keywordSearch(q, limit) { return state.keywordSearch ? state.keywordSearch(q, limit) : [] }

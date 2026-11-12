// Probe: WP-D embeddings v2 — real embeddingService bundled, mock brain db.
// D2 signed hashing + bigrams, D3 cache + MIN_SEMANTIC_SCORE, D4 reindexAll,
// D5 RRF fusion. Prints PASS/FAIL per assertion; exit 1 on any failure.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const ROOT = process.cwd()
const require_ = createRequire(import.meta.url)
const esbuild = require_('esbuild')
const OUT = '/tmp/opencode/embeddings.test.mjs'

await esbuild.build({
  entryPoints: ['agent/probes/embeddings-wpd.test-src.mjs'],
  bundle: true, format: 'esm', platform: 'node', outfile: OUT,
  external: ['electron'],
  plugins: [{
    name: 'mock-brain-and-usercontext',
    setup(b) {
      b.onResolve({ filter: /^\.\.?\/(contextBrain|userContextService)$/ }, (args) => ({
        path: path.join(ROOT, 'agent', 'probes',
          args.path.endsWith('contextBrain') ? 'embeddings-mock-brain.mjs' : 'embeddings-mock-user-context.mjs'),
      }))
    },
  }],
  logLevel: 'error',
})
const svc = await import(OUT)

let pass = 0, fail = 0
const check = (n, c, d) => { if (c) { pass++; console.log(`  PASS  ${n}`) } else { fail++; console.log(`  FAIL  ${n}${d ? ' — ' + d : ''}`) } }

// ── D2: embedText ──
{
  const v = svc.embedText('the quick brown fox jumps over the lazy dog')
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  check('D2 unit L2 norm', Math.abs(norm - 1) < 1e-6, norm.toFixed(6))
  check('D2 dimension is 512', v.length === 512, v.length)
  const v2 = svc.embedText('the quick brown fox jumps over the lazy dog')
  check('D2 deterministic', v.every((x, i) => x === v2[i]))
  // signed hashing: ~half of terms map negative; collisions cancel
  const tokens = ['zzqx', 'alpha', 'widget', 'kubernetes', 'purple', 'deploy', 'budget', 'notes', 'focus', 'steam']
  const anyNegative = tokens.some(t => svc.embedText(t).some(x => x < 0))
  check('D2 signed weights appear (some negative components)', anyNegative)
  // bigrams: "brown fox" phrase vs separate words differ beyond noise
  const a = svc.embedText('brown fox runs'), b = svc.embedText('fox brown runs')
  const dot = a.reduce((s, x, i) => s + x * b[i], 0)
  check('D2 bigram order matters (cos < 1)', dot < 0.999, dot.toFixed(4))
  check('D2 semantically equal text matches itself high', (() => {
    const p = svc.embedText('user prefers dark theme for the interface')
    const q = svc.embedText('prefers dark theme for the interface')
    return p.reduce((s, x, i) => s + x * q[i], 0) > 0.7
  })())
}

// ── D3 + D4: cache, reindexAll with mock brain ──
{
  const episodes = [
    { id: 'ep1', content: 'Kubernetes deployment debugging session' },
    { id: 'ep2', content: 'Finance budget review for groceries' },
    { id: 'ep3', content: 'Kubernetes cluster autoscaling notes' },
  ]
  const signals = [
    { id: 'sg1', content: 'User prefers concise answers', signalType: 'preference' },
  ]
  const embeddings = new Map()
  svc.__setMockBrain({ episodes, signals, embeddings, keywordSearch: () => [] })
  svc.__setMockSignals(signals)

  // seed one STALE 256-d vector to prove reindex re-embeds it
  embeddings.set('ep2', ['episode', new Array(256).fill(0.1)])

  const r = svc.reindexAll()
  check('D4 reindex re-embedded stale 256-d episode', r.episodes === 3, JSON.stringify(r))
  check('D4 reindex embedded signals too', r.signals === 1, JSON.stringify(r))
  check('D4 all stored vectors are now 512-d',
    Array.from(embeddings.values()).every(([, vec]) => vec.length === 512))

  // search via cache
  const hits = svc.searchEmbeddings('kubernetes deployment', 5)
  check('D3 semantic search ranks the kubernetes episodes first',
    hits[0]?.refId === 'ep1' || hits[0]?.refId === 'ep3', JSON.stringify(hits))
  check('D3 all hits pass MIN_SEMANTIC_SCORE (0.12)', hits.every(h => h.score >= 0.12))

  // cache invalidation: mutate store, next search reflects it
  svc.embedSignal('sg2', 'User likes trailing spaces removed')
  const after = svc.searchEmbeddings('trailing spaces removed', 3)
  check('D3 cache invalidated after embedSignal (new signal findable)',
    after.some(h => h.refId === 'sg2'), JSON.stringify(after.map(h => h.refId)))
}

// ── D5: RRF fusion ──
{
  // The bundled module keeps its D3-block cache; the mock store changed underneath.
  svc.invalidateEmbeddingCache()
  const embeddings = new Map()
  // 'both' must rank first in BOTH lists; kw_only is keyword-strong but
  // semantically weaker, so raw scales can never rescue it.
  embeddings.set('both', ['episode', svc.embedText('kubernetes cluster autoscaling deep dive notes')])
  embeddings.set('kw_only', ['episode', svc.embedText('kubernetes brief remark')])
  svc.__setMockBrain({
    episodes: [], signals: [], embeddings,
    keywordSearch: () => [
      { type: 'episode', id: 'both', score: 0.9 },
      { type: 'episode', id: 'kw_only', score: 0.85 },
    ],
  })
  const hits = svc.hybridSearch('kubernetes autoscaling', 5)
  const top = hits[0]
  check('D5 dual-list item outranks single-list items', top?.id === 'both', JSON.stringify(hits.slice(0, 2)))
  check('D5 scores normalized to ≤ 1', hits.every(h => h.score <= 1), Math.max(...hits.map(h => h.score)).toFixed(3))
  const kwOnly = hits.find(h => h.id === 'kw_only')
  check('D5 single-list item still present with RRF score', !!kwOnly && kwOnly.score > 0 && kwOnly.score <= 1)
}

console.log(`\n${pass} passed, ${fail} failed`)
fs.rmSync(OUT, { force: true })
process.exit(fail ? 1 : 0)

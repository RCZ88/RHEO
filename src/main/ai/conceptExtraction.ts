/**
 * conceptExtraction.ts — pure, deterministic, LLM-free concept extractor.
 *
 * Used at capture time so every capture produces connected graph edges even
 * when no LLM is configured. Regex + static dictionary only; no network, no
 * DB access, no side effects. Fully unit-testable.
 */
const TECH_TOKENS = [
  'react', 'typescript', 'python', 'rust', 'electron', 'sqlite', 'vite', 'node',
  'docker', 'git', 'tailwind', 'framer', 'next.js', 'three.js', 'svelte',
  'vue', 'angular', 'webpack', 'rollup', 'esbuild', 'prisma', 'postgres',
  'redis', 'mongodb', 'graphql', 'rest', 'api', 'oauth', 'jwt', 'css',
  'html', 'javascript', 'java', 'go', 'rust', 'kotlin', 'swift', 'flutter',
  'ollama', 'openai', 'claude', 'anthropic', 'gemini', 'ollama', 'llm',
  'mcp', 'sqlite', 'better-sqlite3', 'tailwindcss', 'framer-motion',
  'd3', 'canvas', 'webgl', 'threejs', 'r3f',
]

const STOPWORD_HEADS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'How',
  'Why', 'Who', 'If', 'We', 'I', 'You', 'He', 'She', 'It', 'They', 'A', 'An',
  'And', 'But', 'Or', 'So', 'Yet', 'For', 'To', 'Of', 'In', 'On', 'At', 'By',
  'With', 'From', 'As', 'Is', 'Are', 'Was', 'Were', 'Be', 'Been', 'Being',
  'Have', 'Has', 'Had', 'Do', 'Does', 'Did', 'Will', 'Would', 'Could', 'Should',
  'May', 'Might', 'Must', 'Can', 'Shall', 'Not', 'No', 'Yes', 'OK', 'Okay',
])

const CAP_PHRASE_RE = /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,3})\b/g

export function extractConcepts(text: string, providerName?: string): string[] {
  const seen = new Set<string>()
  const concepts: string[] = []
  const providerKey = (providerName || '').toLowerCase()

  // 1. Tech/dictionary tokens (lowercase match, surfaced capitalised)
  const lower = text.toLowerCase()
  for (const tok of TECH_TOKENS) {
    if (concepts.length >= 24) break
    if (lower.includes(tok) && !seen.has(tok)) {
      seen.add(tok)
      concepts.push(tok.charAt(0).toUpperCase() + tok.slice(1))
    }
  }

  // 2. Capitalized phrases
  let m: RegExpExecArray | null
  CAP_PHRASE_RE.lastIndex = 0
  while ((m = CAP_PHRASE_RE.exec(text)) !== null) {
    if (concepts.length >= 24) break
    const name = m[1].trim()
    if (name.length < 2 || name.length > 40) continue
    const words = name.split(/\s+/)
    if (words.length > 4) continue
    if (/^\d/.test(name)) continue
    if (STOPWORD_HEADS.has(words[0])) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    if (providerKey && key === providerKey) continue
    seen.add(key)
    concepts.push(name)
    if (concepts.length >= 8 + 16) break
  }

  // Cap: 8 from phrases + 16 from tokens, but total ≤ 24
  return concepts.slice(0, 24)
}

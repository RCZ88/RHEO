/**
 * ContextBrainMCP — MCP Server for DeskFlow Context System
 * 
 * Exposes context brain as an MCP server so any MCP-compatible AI
 * (Claude, ChatGPT desktop, Cursor, etc.) can query the user's context.
 * 
 * Runs on HTTP (stateless per MCP 2026-07-28 spec).
 * Hardened: localhost-only bind, optional token auth, rate limiting.
 */

import * as http from 'http'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as brain from './contextBrain'
import * as userContext from './userContextService'
import * as embeddingService from './embeddingService'
import { buildBrainContext } from './brainContext'

const PORT = 54322

// ═══ Security ═══
const RATE_LIMIT_PER_MIN = 60
let rateBuckets: Map<string, number[]> = new Map()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = (rateBuckets.get(ip) || []).filter(t => now - t < 60000)
  if (bucket.length >= RATE_LIMIT_PER_MIN) {
    rateBuckets.set(ip, bucket)
    return true
  }
  bucket.push(now)
  rateBuckets.set(ip, bucket)
  return false
}

// A1 (RESULT-M6, CZ-approved R-1): default-DENY with a generated token. The old
// behavior — "no env var means open server" — let any local process (or a
// CSRFing web page) read the user's whole context graph.
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`])
let tokenCache: string | null = null

/** Env var wins. Otherwise a token file in userData, created on first start. */
export function getMcpToken(): string {
  if (tokenCache) return tokenCache
  const env = process.env.DESKFLOW_MCP_TOKEN
  if (env) return (tokenCache = env)
  let dir = process.cwd()
  try { dir = require('electron').app.getPath('userData') } catch { /* not in electron */ }
  const file = path.join(dir, 'mcp-token.txt')
  try { tokenCache = fs.readFileSync(file, 'utf8').trim() } catch { /* create below */ }
  if (!tokenCache) {
    tokenCache = crypto.randomBytes(24).toString('hex')
    fs.writeFileSync(file, tokenCache + '\n', { mode: 0o600 })
  }
  return tokenCache
}

/** Path of the token file, for the brain:mcp-info Debug panel. */
export function getMcpTokenPath(): string {
  let dir = process.cwd()
  try { dir = require('electron').app.getPath('userData') } catch { /* not in electron */ }
  return path.join(dir, 'mcp-token.txt')
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a)
  const B = Buffer.from(b)
  return A.length === B.length && A.length > 0 && crypto.timingSafeEqual(A, B)
}

function checkToken(req: http.IncomingMessage): boolean {
  const expected = getMcpToken()
  const x = String(req.headers['x-deskflow-mcp-token'] || '')
  const auth = String(req.headers.authorization || '')
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return safeEqual(x, expected) || safeEqual(bearer, expected)
}

/** Stops browser pages (CSRF) and DNS rebinding. Returns a reason string or null. */
function badRequestShape(req: http.IncomingMessage): string | null {
  if (!ALLOWED_HOSTS.has(String(req.headers.host || ''))) return 'bad host'
  if (req.headers.origin) return 'browser origin not allowed'
  return null
}

const clampInt = (v: any, min: number, max: number, def: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : def
}

// ═══ MCP Protocol Handlers ═══

function handleInitialize(): any {
  return {
    jsonrpc: '2.0',
    result: {
      protocolVersion: '2026-07-28',
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
      },
      serverInfo: { name: 'deskflow-context-brain', version: '1.1.0' },
    },
  }
}

function handleToolsList(): any {
  return {
    jsonrpc: '2.0',
    result: {
      tools: [
        {
          name: 'search_context',
          description: 'Search the user\'s context memory using keyword, graph, hybrid (rank fusion), or semantic strategies. Returns ranked facts, episodes, and related entities. Note: semantic and hybrid return ids and scores only (text resolution coming).',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              strategy: { type: 'string', enum: ['keyword', 'graph', 'hybrid', 'semantic', 'all'], default: 'keyword', description: 'Retrieval strategy' },
              limit: { type: 'number', default: 20, description: 'Max results' },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_entity',
          description: 'Get the full current state of an entity (all current facts, no history).',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Entity name to look up' },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_entity_history',
          description: 'Get the bitemporal history of an entity\'s facts (when things changed).',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Entity name' },
            },
            required: ['name'],
          },
        },
        {
          name: 'log_episode',
          description: 'Write a new episode into the context system (e.g. "remember that I decided X"). Also queues LLM enrichment.',
          inputSchema: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Source: external_ai, voice_note, manual' },
              content: { type: 'string', description: 'The content to remember' },
            },
            required: ['source', 'content'],
          },
        },
        {
          name: 'get_stats',
          description: 'Get statistics about the context brain (episode count, entity count, fact count).',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_user_profile_summary',
          description: 'Get a compact summary of the user\'s derived context profile (traits, interests, communication style, focus). Does not expose raw private signals.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_active_facts',
          description: 'Get all current (non-expired) facts in the knowledge graph.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_recent_signals',
          description: 'Get the most recent high-confidence context signals (preferences, corrections, habits).',
          inputSchema: { type: 'object', properties: { limit: { type: 'number', default: 10 } } },
        },
        {
          name: 'add_memory',
          description: 'Write a fact the agent has learned into the context brain (persisted, queued for LLM extraction). Use this to remember decisions, preferences, and corrections discovered during a session.',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'What to remember' },
              source: { type: 'string', description: 'Source tag, e.g. external_ai, in_terminal_agent', default: 'external_ai' },
            },
            required: ['content'],
          },
        },
        {
          name: 'add_reflection',
          description: 'Log a self-improvement reflection / mistake / correction to the agent-reflect logs. Persisted as markdown and re-injected into future agent context so the same mistake is not repeated.',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Short title, e.g. "never use git reset --hard"' },
              content: { type: 'string', description: 'Full reflection / lesson text' },
              severity: { type: 'string', enum: ['info', 'warn', 'critical'], default: 'warn' },
            },
            required: ['title', 'content'],
          },
        },
        {
          name: 'get_context_for_prompt',
          description: 'Build a compact block of the user\'s own local context (profile, rules, relevant facts, notes) for injecting into a prompt. Budgeted. Finance and terminal data are never included.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'The prompt or question to gather context for' },
              token_budget: { type: 'number', default: 800, description: 'Max tokens (100-4000)' },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'list_signals',
          description: 'List the user\'s context signals (preferences, corrections, rules, habits) with their active/superseded state.',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Filter by signal type, e.g. preference, correction, rule' },
              include_inactive: { type: 'boolean', default: false, description: 'Include inactive/superseded signals' },
              limit: { type: 'number', default: 20 },
            },
          },
        },
        {
          name: 'correct_signal',
          description: 'Correct a stored signal: reject a wrong one, confirm a right one, or replace it with better wording.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The signal id' },
              action: { type: 'string', enum: ['reject', 'confirm', 'replace'] },
              replacement: { type: 'string', description: 'New content (required for replace)' },
            },
            required: ['id', 'action'],
          },
        },
      ],
    },
  }
}

/** A1: cheap duplicate guard for write-in tools — same source + normalized content within the last 50. */
function isRecentDuplicate(source: string, content: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const target = norm(content)
  return brain.getEpisodes(source, 50).some(e => norm(e.content) === target)
}

function handleToolsCall(name: string, args: any): any {
  switch (name) {
    case 'search_context': {
      const limit = clampInt(args.limit, 1, 100, 20)
      if (args.strategy === 'semantic' || args.strategy === 'hybrid') {
        // E3: rank-fusion hybrid (and pure semantic) via embeddingService. Text
        // resolution needs a getEpisode(id) helper that does not exist yet (R1),
        // so these return ids + scores only — stated in the tool description.
        const hits = args.strategy === 'semantic'
          ? embeddingService.searchEmbeddings(args.query, limit)
          : embeddingService.hybridSearch(args.query, limit)
        return {
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({ query: args.query, strategy: args.strategy, hits }, null, 2),
            }],
          },
        }
      }
      let strategies = ['keyword']
      if (args.strategy === 'all') strategies = ['keyword', 'graph']
      else if (args.strategy === 'graph') strategies = ['graph']
      const result = brain.retrieve(args.query, strategies)
      return {
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query: args.query,
              strategy: result.strategy,
              facts: result.facts.slice(0, limit).map(f => ({
                predicate: f.predicate,
                value: f.objectLiteral || f.objectId,
                confidence: f.confidence,
                current: !f.validTo,
              })),
              entities: result.entities.map(e => ({ name: e.name, type: e.type })),
              episodes: result.episodes.slice(0, 5).map(e => ({
                source: e.source,
                content: e.content.slice(0, 300),
                when: e.occurredAt,
              })),
            }, null, 2),
          }],
        },
      }
    }
    case 'get_entity': {
      const entities = brain.findEntities(args.name)
      if (entities.length === 0) {
        return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: `No entity found matching "${args.name}"` }] } }
      }
      const entity = entities[0]
      const facts = brain.getCurrentFacts(entity.id)
      return {
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              entity: { name: entity.name, type: entity.type, aliases: entity.aliases },
              currentFacts: facts.map(f => ({ predicate: f.predicate, value: f.objectLiteral || f.objectId, confidence: f.confidence })),
              firstSeen: entity.firstSeen,
              lastSeen: entity.lastSeen,
            }, null, 2),
          }],
        },
      }
    }
    case 'get_entity_history': {
      const entities = brain.findEntities(args.name)
      if (entities.length === 0) {
        return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: `No entity found matching "${args.name}"` }] } }
      }
      const history = brain.getFactHistory(entities[0].id)
      return {
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              entity: entities[0].name,
              history: history.map(f => ({
                predicate: f.predicate,
                value: f.objectLiteral || f.objectId,
                validFrom: f.validFrom,
                validTo: f.validTo || '(current)',
                confidence: f.confidence,
              })),
            }, null, 2),
          }],
        },
      }
    }
    case 'log_episode': {
      const content = String(args.content || '').slice(0, 8000)
      if (isRecentDuplicate(args.source || 'external_ai', content)) {
        return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: 'Memory already stored' }] } }
      }
      const epId = brain.logEpisode(args.source || 'external_ai', content)
      if (epId && (args.content || '').length >= 40) brain.createExtractionJob(epId)
      return {
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: `Episode logged: ${epId}` }],
        },
      }
    }
    case 'add_memory': {
      const content = (args.content || '').trim().slice(0, 8000)
      if (!content) return { jsonrpc: '2.0', error: { code: -32602, message: 'content is required' } }
      if (isRecentDuplicate(args.source || 'external_ai', content)) {
        return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: 'Memory already stored' }] } }
      }
      const epId = brain.logEpisode(args.source || 'external_ai', content)
      if (epId && content.length >= 40) brain.createExtractionJob(epId)
      return {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: `Memory stored: ${epId}` }] },
      }
    }
    case 'add_reflection': {
      const title = (args.title || '').trim().slice(0, 120)
      const content = (args.content || '').trim().slice(0, 8000)
      const severity = args.severity || 'warn'
      if (!title || !content) return { jsonrpc: '2.0', error: { code: -32602, message: 'title and content are required' } }
      // A1: ALSO log an episode so the reflection is searchable and counts as
      // the 'reflection' source (already in EXTRACTION_SOURCES). The repo file
      // write only happens in unpackaged dev builds — a packaged app has no
      // repo agent/ folder to write into.
      let fileNote = 'episode only (packaged app)'
      try {
        if (!require('electron').app.isPackaged) {
          // Locate repo root: walk up from this file to find package.json / agent dir.
          let root = __dirname
          for (let i = 0; i < 6; i++) {
            if (fs.existsSync(path.join(root, 'agent', 'skills', 'agent-reflect', 'logs'))) break
            const parent = path.dirname(root)
            if (parent === root) break
            root = parent
          }
          const logDir = path.join(root, 'agent', 'skills', 'agent-reflect', 'logs')
          fs.mkdirSync(logDir, { recursive: true })
          const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          const safeTitle = title.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
          const file = path.join(logDir, `${stamp}_${safeTitle}.md`)
          const header = `<!-- agent-reflection | severity: ${severity} | source: in_terminal_agent | ${stamp} -->\n# ${title}\n\n`
          fs.writeFileSync(file, header + content + '\n', 'utf-8')
          fileNote = path.basename(file)
        }
      } catch (e: any) {
        console.warn('[ContextBrainMCP] reflection file write skipped:', e?.message)
      }
      brain.logEpisode('reflection', `${title}\n${content}`.slice(0, 1500), undefined, { severity })
      return {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: `Reflection logged: ${fileNote}` }] },
      }
    }
    case 'get_context_for_prompt': {
      // E3: budgeted brain context. No way to request finance or terminal —
      // the builder's ALWAYS_DENY source gate makes that impossible by design.
      const budget = clampInt(args.token_budget, 100, 4000, 800)
      const ctx = buildBrainContext({ query: String(args.prompt || ''), tokenBudget: budget })
      return {
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({ text: ctx.text, tokens_est: ctx.tokensEst, used: ctx.used.length }, null, 2),
          }],
        },
      }
    }
    case 'list_signals': {
      const signals = userContext.getSignals(args.type || undefined, undefined, clampInt(args.limit, 1, 100, 20), !!args.include_inactive)
      return {
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(signals.map(s => ({
              id: s.id,
              signal_type: s.signalType,
              content: s.content,
              confidence: s.confidence,
              active: s.active,
              superseded_by: s.supersededBy ?? null,
              occurrences: s.occurrenceCount,
            })), null, 2),
          }],
        },
      }
    }
    case 'correct_signal': {
      const id = String(args.id || '')
      if (!id) return { jsonrpc: '2.0', error: { code: -32602, message: 'id is required' } }
      if (args.action === 'reject') {
        userContext.rejectSignal(id)
        return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: `Signal ${id} rejected (inactive, confidence 0)` }] } }
      }
      if (args.action === 'confirm') {
        userContext.setSignalConfidence(id, 1)
        return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: `Signal ${id} confirmed (confidence 1)` }] } }
      }
      if (args.action === 'replace') {
        const replacement = String(args.replacement || '').trim().slice(0, 8000)
        if (!replacement) return { jsonrpc: '2.0', error: { code: -32602, message: 'replacement is required for replace' } }
        const old = userContext.getSignals(undefined, undefined, 500, true).find(s => s.id === id)
        if (!old) return { jsonrpc: '2.0', error: { code: -32602, message: `Signal ${id} not found` } }
        userContext.addSignal(old.signalType, replacement, 'correction', 1.0, { supersedes: id })
        return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: `Signal ${id} superseded by the replacement` }] } }
      }
      return { jsonrpc: '2.0', error: { code: -32602, message: `Unknown action: ${args.action}` } }
    }
    case 'get_stats': {
      const stats = brain.getBrainStats()
      const jobStats = brain.getJobStats()
      return {
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: JSON.stringify({ ...stats, jobs: jobStats }, null, 2) }],
        },
      }
    }
    case 'get_user_profile_summary': {
      const profile = userContext.getProfile()
      const interests = Object.values(profile.interests || {})
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, 5)
        .map((i: any) => i.content)
      return {
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              summary: profile.summary,
              communication_style: Object.values(profile.communicationStyle || {}).map((c: any) => c.content),
              top_interests: interests,
              active_focus: interests[0] || null,
              growth_markers: (profile.growthMarkers || []).slice(-3).map((m: any) => m.label),
              context_version: profile.contextVersion,
            }, null, 2),
          }],
        },
      }
    }
    case 'get_active_facts': {
      const facts = brain.getAllCurrentFacts()
      return {
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(facts.slice(0, 50).map(f => ({
              predicate: f.predicate,
              value: f.objectLiteral || f.objectId,
              confidence: f.confidence,
              since: f.validFrom,
            })), null, 2),
          }],
        },
      }
    }
    case 'get_recent_signals': {
      const signals = userContext.getSignals(undefined, undefined, clampInt(args.limit, 1, 50, 10))
      return {
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(signals.map(s => ({
              signal_type: s.signalType,
              content: s.content,
              confidence: s.confidence,
              occurrences: s.occurrenceCount,
              last_seen_at: new Date(s.lastSeenAt).toISOString(),
            })), null, 2),
          }],
        },
      }
    }
    default:
      return { jsonrpc: '2.0', error: { code: -32601, message: `Unknown tool: ${name}` } }
  }
}

function handleResourcesList(): any {
  return {
    jsonrpc: '2.0',
    result: {
      resources: [
        { uri: 'context://recent-episodes', name: 'Recent Episodes', description: 'Last 20 episodes from all sources', mimeType: 'application/json' },
        { uri: 'context://active-facts', name: 'Active Facts', description: 'All current (non-expired) facts', mimeType: 'application/json' },
        { uri: 'context://stats', name: 'Brain Stats', description: 'Episode/entity/fact counts', mimeType: 'application/json' },
        { uri: 'context://user-profile-summary', name: 'User Profile Summary', description: 'Compact derived profile summary', mimeType: 'application/json' },
        { uri: 'context://recent-signals', name: 'Recent Signals', description: 'Latest high-confidence context signals', mimeType: 'application/json' },
      ],
    },
  }
}

function handleResourcesRead(uri: string): any {
  switch (uri) {
    case 'context://recent-episodes': {
      // A1/E3 source gate: finance and terminal episode text never leaves the machine.
      const episodes = brain.getEpisodes(undefined, 60).filter(e => e.source !== 'finance' && e.source !== 'terminal').slice(0, 20)
      return {
        jsonrpc: '2.0',
        result: {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(episodes.map(e => ({
              source: e.source,
              content: e.content.slice(0, 500),
              when: e.occurredAt,
            })), null, 2),
          }],
        },
      }
    }
    case 'context://active-facts': {
      const facts = brain.getAllCurrentFacts()
      return {
        jsonrpc: '2.0',
        result: {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(facts.map(f => ({
              predicate: f.predicate,
              value: f.objectLiteral || f.objectId,
              confidence: f.confidence,
            })), null, 2),
          }],
        },
      }
    }
    case 'context://stats': {
      const stats = brain.getBrainStats()
      return {
        jsonrpc: '2.0',
        result: {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(stats, null, 2) }],
        },
      }
    }
    case 'context://user-profile-summary': {
      const profile = userContext.getProfile()
      const interests = Object.values(profile.interests || {})
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, 5)
        .map((i: any) => i.content)
      return {
        jsonrpc: '2.0',
        result: {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              summary: profile.summary,
              communication_style: Object.values(profile.communicationStyle || {}).map((c: any) => c.content),
              top_interests: interests,
            }, null, 2),
          }],
        },
      }
    }
    case 'context://recent-signals': {
      const signals = userContext.getSignals(undefined, undefined, 10)
      return {
        jsonrpc: '2.0',
        result: {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(signals.map(s => ({
              signal_type: s.signalType,
              content: s.content,
              confidence: s.confidence,
            })), null, 2),
          }],
        },
      }
    }
    default:
      return { jsonrpc: '2.0', error: { code: -32601, message: `Unknown resource: ${uri}` } }
  }
}

// ═══ HTTP Server ═══

export function startMcpServer(): http.Server | null {
  const server = http.createServer((req, res) => {
    const ip = (req.socket.remoteAddress || 'local').replace('::ffff:', '')

    // A1: shape checks FIRST (host + origin) — stops CSRF/rebinding before anything else.
    const shape = badRequestShape(req)
    if (shape) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32003, message: shape } }))
      return
    }

    // Rate limiting
    if (isRateLimited(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32005, message: 'Rate limit exceeded (60 req/min)' } }))
      return
    }

    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end('Method not allowed')
      return
    }

    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      res.writeHead(415)
      res.end('Content-Type must be application/json')
      return
    }

    // Token auth (default-deny since R-1)
    if (!checkToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' } }))
      return
    }

    let body = ''
    let tooLarge = false
    req.on('data', chunk => {
      body += chunk
      if (body.length > 100000 && !tooLarge) {
        tooLarge = true
        // Reply BEFORE destroying so the client actually receives the 413.
        res.writeHead(413)
        res.end('Payload too large')
        req.destroy()
      }
    })
    req.on('end', () => {
      if (tooLarge) return
      // A1: parse errors and handler errors are DIFFERENT json-rpc codes.
      let msg: any
      try {
        msg = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }))
        return
      }
      let response: any
      try {
        switch (msg.method) {
          case 'initialize': response = handleInitialize(); break
          case 'tools/list': response = handleToolsList(); break
          case 'tools/call': response = handleToolsCall(msg.params?.name, msg.params?.arguments || {}); break
          case 'resources/list': response = handleResourcesList(); break
          case 'resources/read': response = handleResourcesRead(msg.params?.uri); break
          case 'notifications/initialized': response = null; break
          case 'ping': response = { jsonrpc: '2.0', result: {} }; break
          default: response = { jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${msg.method}` } }
        }
      } catch (e: any) {
        response = { jsonrpc: '2.0', error: { code: -32603, message: String(e?.message || 'Internal error').slice(0, 200) } }
      }

      if (response) {
        response.id = msg.id
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))
      } else {
        res.writeHead(204)
        res.end()
      }
    })
  })

  server.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.warn(`[ContextBrain] MCP port ${PORT} already in use — MCP server not started`)
    } else {
      console.error('[ContextBrain] MCP server error:', err?.message)
    }
  })

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[ContextBrain] MCP server running on http://127.0.0.1:${PORT}`)
  })

  return server
}
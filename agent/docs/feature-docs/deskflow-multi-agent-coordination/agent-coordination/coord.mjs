#!/usr/bin/env node
/**
 * agent-coordination/coord.mjs
 * ---------------------------------------------------------------------------
 * Dependency-free multi-agent coordination registry for DeskFlow.
 *
 * It tracks, across every concurrently running agent / sub-agent / shell:
 *   - live agents         (with a heartbeat so dead ones are auto-reaped)
 *   - file leases         (an agent "claims" the paths it is editing)
 *   - named exclusive locks (build / app / db / migrate / ...)
 *
 * All state lives in ONE JSON file (registry.json) guarded by an atomic
 * mkdir-based mutex, so read-modify-write is safe across processes.
 *
 * Node built-ins only. Works as a library (import) and as a CLI.
 * ---------------------------------------------------------------------------
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REG_PATH = path.join(HERE, 'registry.json')
const MUTEX_DIR = path.join(HERE, '.reg.lockdir')

// --- Tunables --------------------------------------------------------------
export const AGENT_TTL_MS = 90_000          // agent is "dead" after 90s with no heartbeat
export const DEFAULT_LOCK_TTL_MS = 20 * 60_000 // hard safety cap so a crashed lock can't wedge forever
const MUTEX_STALE_MS = 15_000               // break the registry mutex if older than this
const MUTEX_WAIT_MS = 8_000                 // how long to wait for the registry mutex

const now = () => Date.now()
function msleep(ms) {
  // blocking sleep without deps (fine for a short-lived CLI/critical section)
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function emptyReg() {
  return { version: 1, agents: {}, leases: {}, locks: {} }
}

function readRegRaw() {
  try {
    const r = JSON.parse(fs.readFileSync(REG_PATH, 'utf8'))
    return {
      version: 1,
      agents: r.agents || {},
      leases: r.leases || {},
      locks: r.locks || {},
    }
  } catch {
    return emptyReg()
  }
}

function writeRegRaw(reg) {
  const tmp = REG_PATH + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(reg, null, 2))
  fs.renameSync(tmp, REG_PATH) // atomic replace on same filesystem
}

// --- Cross-process mutex around the registry -------------------------------
function acquireMutex() {
  const deadline = now() + MUTEX_WAIT_MS
  for (;;) {
    try {
      fs.mkdirSync(MUTEX_DIR) // atomic: throws if it already exists
      fs.writeFileSync(path.join(MUTEX_DIR, 'owner'), String(process.pid))
      return
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      // Someone holds it. Break it if it's stale.
      try {
        const age = now() - fs.statSync(MUTEX_DIR).mtimeMs
        if (age > MUTEX_STALE_MS) {
          try { fs.rmSync(MUTEX_DIR, { recursive: true, force: true }) } catch {}
          continue
        }
      } catch {}
      if (now() > deadline) throw new Error('coord: timed out acquiring registry mutex')
      msleep(40)
    }
  }
}
function releaseMutex() {
  try { fs.rmSync(MUTEX_DIR, { recursive: true, force: true }) } catch {}
}

// --- Reaping: drop dead agents and anything they were holding --------------
function reap(reg) {
  const t = now()
  for (const [id, a] of Object.entries(reg.agents)) {
    if (t - (a.lastHeartbeat || 0) > AGENT_TTL_MS) delete reg.agents[id]
  }
  for (const [p, l] of Object.entries(reg.leases)) {
    if (!reg.agents[l.agent]) delete reg.leases[p]
  }
  for (const [name, l] of Object.entries(reg.locks)) {
    const expired = t - (l.since || 0) > (l.ttlMs || DEFAULT_LOCK_TTL_MS)
    if (!reg.agents[l.agent] || expired) delete reg.locks[name]
  }
  return reg
}

/** Run fn(reg) inside the mutex; reap first, persist after. Returns fn's value. */
function withReg(fn) {
  acquireMutex()
  try {
    const reg = reap(readRegRaw())
    const out = fn(reg)
    writeRegRaw(reg)
    return out
  } finally {
    releaseMutex()
  }
}

function upsertAgent(reg, agent, task) {
  const prev = reg.agents[agent] || { id: agent, startedAt: now() }
  reg.agents[agent] = {
    ...prev,
    id: agent,
    task: task ?? prev.task ?? '',
    pid: process.pid,
    lastHeartbeat: now(),
  }
}

// --- Path lease helpers ----------------------------------------------------
function norm(p) {
  return path.posix.normalize(String(p).replace(/\\/g, '/')).replace(/\/+$/, '')
}
function overlaps(a, b) {
  if (a === b) return true
  return a.startsWith(b + '/') || b.startsWith(a + '/')
}

// ===========================================================================
// Public API
// ===========================================================================
export function getState() {
  return withReg((reg) => JSON.parse(JSON.stringify(reg)))
}

export function register(agent, task) {
  return withReg((reg) => { upsertAgent(reg, agent, task); return reg.agents[agent] })
}

export function heartbeat(agent, task) {
  return withReg((reg) => { upsertAgent(reg, agent, task); return true })
}

/** Remove an agent and release every lease + lock it held. */
export function done(agent) {
  return withReg((reg) => {
    delete reg.agents[agent]
    for (const [p, l] of Object.entries(reg.leases)) if (l.agent === agent) delete reg.leases[p]
    for (const [n, l] of Object.entries(reg.locks)) if (l.agent === agent) delete reg.locks[n]
    return true
  })
}

/** Claim edit-exclusivity over paths. Returns { ok, conflicts:[{path,agent}] }. */
export function claim(agent, paths, task) {
  const wanted = paths.map(norm)
  return withReg((reg) => {
    upsertAgent(reg, agent, task)
    // A claim is the ONLY proof another agent is alive. If the registry is empty,
    // every other "lock" in this repo is decorative -- say so loudly instead of
    // letting an agent assume it has exclusive access it does not have.
    const others = Object.keys(reg.agents).filter(a => a !== agent)
    if (others.length === 0) {
      console.warn(
        '[coord] WARNING: you are the ONLY registered agent. No peer has registered,\n' +
        '[coord]          so this claim protects nothing. Other agents may be editing\n' +
        '[coord]          right now without a lease. Do not assume exclusive access.'
      )
    }
    const conflicts = []
    for (const w of wanted) {
      for (const [held, l] of Object.entries(reg.leases)) {
        if (l.agent !== agent && overlaps(w, held)) conflicts.push({ path: w, agent: l.agent, held })
      }
    }
    if (conflicts.length) return { ok: false, conflicts }
    for (const w of wanted) reg.leases[w] = { agent, since: now() }
    return { ok: true, conflicts: [] }
  })
}

export function release(agent, paths) {
  const wanted = paths.map(norm)
  return withReg((reg) => {
    for (const w of wanted) {
      const l = reg.leases[w]
      if (l && l.agent === agent) delete reg.leases[w]
    }
    return true
  })
}

/** Acquire a named exclusive lock. Returns { ok, heldBy? }. Reentrant for same agent. */
export function acquireLock(agent, name, ttlMs = DEFAULT_LOCK_TTL_MS, task) {
  return withReg((reg) => {
    upsertAgent(reg, agent, task)
    const cur = reg.locks[name]
    if (cur && cur.agent !== agent) return { ok: false, heldBy: cur.agent, since: cur.since }
    reg.locks[name] = { agent, since: cur?.since || now(), ttlMs }
    return { ok: true }
  })
}

export function releaseLock(agent, name) {
  return withReg((reg) => {
    const cur = reg.locks[name]
    if (cur && cur.agent === agent) delete reg.locks[name]
    return true
  })
}

// ===========================================================================
// CLI
// ===========================================================================
function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const vals = []
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) vals.push(argv[++i])
      out[key] = vals.length === 0 ? true : vals.length === 1 ? vals[0] : vals
    } else out._.push(a)
  }
  return out
}

function fmtState(s) {
  const lines = []
  const agents = Object.values(s.agents)
  lines.push(`AGENTS (${agents.length})`)
  for (const a of agents) {
    const age = Math.round((now() - a.lastHeartbeat) / 1000)
    lines.push(`  • ${a.id}  pid=${a.pid}  ${age}s ago  — ${a.task || '(no task)'}`)
  }
  const locks = Object.entries(s.locks)
  lines.push(`LOCKS (${locks.length})`)
  for (const [n, l] of locks) lines.push(`  🔒 ${n}  held by ${l.agent}`)
  const leases = Object.entries(s.leases)
  lines.push(`FILE LEASES (${leases.length})`)
  for (const [p, l] of leases) lines.push(`  📄 ${p}  ← ${l.agent}`)
  return lines.join('\n')
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const a = parseArgs(rest)
  const agent = a.agent || process.env.AGENT_ID
  const need = (v, msg) => { if (!v) { console.error(msg); process.exit(2) } }
  const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

  switch (cmd) {
    case 'status': {
      console.log(fmtState(getState()))
      break
    }
    case 'register': {
      need(agent, 'register: --agent <id> required')
      register(agent, a.task || '')
      console.log(`registered ${agent}`)
      break
    }
    case 'heartbeat': {
      need(agent, 'heartbeat: --agent <id> required')
      heartbeat(agent, a.task)
      break
    }
    case 'done': {
      need(agent, 'done: --agent <id> required')
      done(agent)
      console.log(`released everything for ${agent}`)
      break
    }
    case 'claim': {
      need(agent, 'claim: --agent <id> required')
      const r = claim(agent, asList(a.paths), a.task)
      if (!r.ok) {
        console.error('CLAIM DENIED — these paths are owned by another live agent:')
        for (const c of r.conflicts) console.error(`  ${c.path}  ← ${c.agent}`)
        process.exit(3)
      }
      console.log(`claimed ${asList(a.paths).length} path(s) for ${agent}`)
      break
    }
    case 'release': {
      need(agent, 'release: --agent <id> required')
      release(agent, asList(a.paths))
      console.log(`released path(s) for ${agent}`)
      break
    }
    case 'lock': {
      need(agent, 'lock: --agent <id> required')
      need(a.name, 'lock: --name <build|app|db|migrate|...> required')
      const ttl = a.ttl ? Number(a.ttl) * 1000 : DEFAULT_LOCK_TTL_MS
      const r = acquireLock(agent, a.name, ttl, a.task)
      if (!r.ok) {
        console.error(`LOCK DENIED — "${a.name}" is held by ${r.heldBy}`)
        process.exit(3)
      }
      console.log(`locked "${a.name}" for ${agent}`)
      break
    }
    case 'unlock': {
      need(agent, 'unlock: --agent <id> required')
      need(a.name, 'unlock: --name required')
      releaseLock(agent, a.name)
      console.log(`unlocked "${a.name}"`)
      break
    }
    case 'reap': {
      getState()
      console.log('reaped stale agents/locks/leases')
      break
    }
    default:
      console.log(`coord.mjs — multi-agent coordination registry

Usage:
  node coord.mjs status
  node coord.mjs register  --agent <id> --task "..."
  node coord.mjs heartbeat --agent <id>
  node coord.mjs done      --agent <id>
  node coord.mjs claim     --agent <id> --paths <a> <b> ...
  node coord.mjs release   --agent <id> --paths <a> <b> ...
  node coord.mjs lock      --agent <id> --name <build|app|db|migrate> [--ttl <sec>]
  node coord.mjs unlock    --agent <id> --name <name>
  node coord.mjs reap
`)
  }
}

// pathToFileURL handles absolute-vs-relative argv[1] AND percent-encoding
// (this repo lives under a path with a space in it: "App Tracker"). The old
// `file://${process.argv[1]}` template silently never matched on Linux, so
// main() never ran and every CLI command was a silent no-op.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main()

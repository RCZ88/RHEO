#!/usr/bin/env node
/**
 * scripts/build-with-log.mjs
 * ---------------------------------------------------------------------------
 * Telemetry wrapper around the build. Addresses defect MEM-5 in
 * agent/docs/generate-prompt-docs/agent-orchestration-interview/LAG-RCA-REPORT.md
 *
 * WHY THIS EXISTS
 *   There was no record of when a build started, which command ran, or how much
 *   memory it used. The kernel logs OOM kills with timestamps and victim names,
 *   but NOT command lines — so an OOM'd build could not be attributed to anything.
 *   `scripts/build.mjs` only ever wrote a lock-PID file (line 25). Every
 *   `build*.log` in the repo root was a stale manual redirect from Jul/Aug.
 *
 * WHAT IT WRITES
 *   Append-only JSONL to agent/logs/build.log, one JSON object per line:
 *     { event:"start", ts, pid, cmd, argv, cwd, nodeOptions }
 *     { event:"end",   ts, pid, exitCode, signal, durationMs, peakRssKb,
 *                      peakTreeRssKb, peakTreeProcs, oomSuspect }
 *
 * DESIGN NOTES (these matter for OOM attribution)
 *   1. The "start" record is flushed and fsync'd BEFORE the child is spawned. If
 *      the build is OOM-killed, or if the whole session dies, the start record
 *      still exists and can be joined against `journalctl -k` by timestamp.
 *      Writing the log only on completion is useless for exactly the case we
 *      care about.
 *   2. We record the CHILD's pid, because `journalctl -k` reports the pid of the
 *      process that was killed. That is the join key.
 *   3. Peak RSS is sampled across the whole child PROCESS TREE. V8 spawns worker
 *      threads and esbuild spawns a service process; measuring only the direct
 *      child under-reports the real footprint.
 *   4. Node built-ins only, matching scripts/build.mjs and coord.mjs. No new deps.
 *
 * Usage:  node scripts/build-with-log.mjs            (wraps `npm run build:inner`)
 *         node scripts/build-with-log.mjs -- <cmd>   (wrap any command)
 *
 * ---------------------------------------------------------------------------
 * DO NOT TRUNCATE agent/logs/build.log.
 * It is append-only on purpose: it is the forensic trail for OOM attribution, and
 * other agents' build attempts land in it too. During the 2026-10-02 setup, a
 * smoke test cleared the file and took a real 0.38 GB `npm run build:inner`
 * attempt by a concurrent agent with it. Read it; never `: > build.log`.
 * To start clean, move it aside: `mv agent/logs/build.log{,.$(date +%s)}`
 * ---------------------------------------------------------------------------
 */
import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const LOG_DIR = resolve(ROOT, 'agent/logs')
const LOG_FILE = resolve(LOG_DIR, 'build.log')

const SAMPLE_MS = 400
// A build above this is assumed to be heading for trouble. Purely advisory:
// recorded, never enforced. Enforcement is defect MEM-9 (admission control).
const OOM_SUSPECT_KB = 6 * 1024 * 1024 // 6 GB

function ensureLog() {
  try { mkdirSync(LOG_DIR, { recursive: true }) } catch { /* already there */ }
}

/** Append one record. Never throws — telemetry must not break the build. */
function record(obj) {
  try {
    appendFileSync(LOG_FILE, JSON.stringify({ ...obj, ts: new Date().toISOString() }) + '\n')
  } catch (e) {
    try { console.error(`[build-log] write failed: ${e.message}`) } catch {}
  }
}

/** Write the start record and fsync it so it survives a hard kill. */
function recordDurable(obj) {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const line = JSON.stringify({ ...obj, ts: new Date().toISOString() }) + '\n'
    const fd = openSync(LOG_FILE, 'a')
    try { writeSync(fd, line); fsyncSync(fd) } finally { closeSync(fd) }
  } catch (e) {
    try { console.error(`[build-log] durable write failed: ${e.message}`) } catch {}
  }
}

/** All descendant pids of `pid` (one level of children is enough here). */
function childPids(pid) {
  const out = []
  try {
    const raw = execSync(`ps -eo pid=,ppid= --no-headers`, { encoding: 'utf8' })
    for (const line of raw.split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\d+)$/)
      if (m && Number(m[2]) === pid) out.push(Number(m[1]))
    }
  } catch {}
  return out
}

/** Peak across the child and its descendants. Returns { treeKb, procs }. */
function sampleTree(pid) {
  try {
    const pids = [pid, ...childPids(pid)]
    const args = pids.join(',')
    const raw = execSync(`ps -o rss= -p ${args}`, { encoding: 'utf8' })
    const rows = raw.split('\n').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0)
    if (!rows.length) return { treeKb: 0, procs: 0 }
    return { treeKb: rows.reduce((a, b) => a + b, 0), procs: rows.length }
  } catch {
    return { treeKb: 0, procs: 0 }
  }
}

// --- Resolve what to wrap --------------------------------------------------
const argv = process.argv.slice(2)
let cmd
let cmdArgs
const dash = argv.indexOf('--')
if (dash !== -1) {
  cmd = argv[dash + 1]
  cmdArgs = argv.slice(dash + 2)
} else {
  cmd = 'npm'
  cmdArgs = ['run', 'build:inner']
}

ensureLog()

const startedMs = Date.now()
console.error(`[build-log] wrapping: ${cmd} ${cmdArgs.join(' ')}`)

const child = spawn(cmd, cmdArgs, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})

// CRITICAL: durable start record, written BEFORE we sample anything, keyed by
// the child's pid so it can be joined against journalctl's OOM victim pid.
recordDurable({
  event: 'start',
  pid: child.pid,
  ppid: process.pid,
  cmd: [cmd, ...cmdArgs].join(' '),
  argv: [cmd, ...cmdArgs],
  cwd: ROOT,
  nodeOptions: process.env.NODE_OPTIONS || null,
  heapCapBytes: (() => {
    const m = /max-old-space-size=(\d+)/.exec(process.env.NODE_OPTIONS || '')
    return m ? Number(m[1]) * 1024 * 1024 : null
  })(),
})

let peakTreeKb = 0
let peakProcs = 0
let peakSelfKb = 0

const timer = setInterval(() => {
  const { treeKb, procs } = sampleTree(child.pid)
  if (treeKb > peakTreeKb) peakTreeKb = treeKb
  if (procs > peakProcs) peakProcs = procs
  try {
    const raw = execSync(`ps -o rss= -p ${child.pid}`, { encoding: 'utf8' })
    const selfKb = Number(raw.trim())
    if (Number.isFinite(selfKb) && selfKb > peakSelfKb) peakSelfKb = selfKb
  } catch {}
}, SAMPLE_MS)

function finish(code, signal) {
  clearInterval(timer)
  const durationMs = Date.now() - startedMs
  record({
    event: 'end',
    pid: child.pid,
    exitCode: code,
    signal: signal || null,
    durationMs,
    peakRssKb: peakSelfKb,
    peakTreeRssKb: peakTreeKb,
    peakTreeProcs: peakProcs,
    peakTreeRssGb: Number((peakTreeKb / 1048576).toFixed(2)),
    oomSuspect: peakTreeKb >= OOM_SUSPECT_KB,
  })
  console.error(
    `[build-log] pid=${child.pid} exit=${code ?? signal} duration=${(durationMs / 1000).toFixed(1)}s ` +
    `peakTreeRSS=${(peakTreeKb / 1048576).toFixed(2)}GB across ${peakProcs} procs ` +
    `-> ${LOG_FILE}`
  )
  process.exit(signal ? 1 : (code ?? 0))
}

child.on('exit', (code, signal) => finish(code, signal))
child.on('error', (err) => {
  record({ event: 'spawn_error', pid: child.pid, error: String(err && err.message) })
  console.error(`[build-log] spawn failed: ${err && err.message}`)
  clearInterval(timer)
  process.exit(127)
})

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { try { child.kill(sig) } catch {} })
}
// If THIS wrapper is killed (e.g. the OOM killer takes the parent), the durable
// start record already on disk is the forensic trail. Note that in the log too.
process.on('exit', () => {
  record({ event: 'wrapper_exit', pid: child.pid, note: 'wrapper exited; child may still be running' })
})
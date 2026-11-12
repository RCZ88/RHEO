/**
 * brainLogger.ts — structured logger for the Context Brain.
 *
 * Entry: { ts, level, component, msg, payload? }.
 * - Ring buffer of last 500 entries in memory (queryable via brain:logs).
 * - Console mirror: `[BRAIN-<COMPONENT>] <msg> <json>`.
 * - Append-only file `agent/logs/brain.log`, 500 ms debounced batch write,
 *   rotate at 10 MB -> `brain.log.1` (one generation kept).
 * - File writes never throw into callers.
 */
import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogComponent = 'EXT' | 'EPISODE' | 'GRAPH' | 'CTX' | 'RETRIEVE' | 'SIGNAL' | 'EMBED' | 'PROFILE' | 'MCP' | 'HEALTH' | 'EVAL' | 'JOB'

export interface LogEntry {
  ts: string
  level: LogLevel
  component: LogComponent
  msg: string
  payload?: any
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const RING_SIZE = 500
const ROTATE_BYTES = 10 * 1024 * 1024
const FLUSH_MS = 500

let ring: LogEntry[] = []
let fileLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'
let flushTimer: any = null
let pending: LogEntry[] = []
let logDir: string = ''
let logPath: string = ''

export function init(dir?: string) {
  try {
    logDir = dir || path.join(process.cwd(), 'agent', 'logs')
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    logPath = path.join(logDir, 'brain.log')
  } catch { /* never throw */ }
}

function rotateIfNeeded() {
  try {
    if (!logPath || !fs.existsSync(logPath)) return
    const st = fs.statSync(logPath)
    if (st.size >= ROTATE_BYTES) {
      const rotated = logPath + '.1'
      try { if (fs.existsSync(rotated)) fs.unlinkSync(rotated) } catch {}
      fs.renameSync(logPath, rotated)
    }
  } catch { /* never throw */ }
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    const batch = pending.splice(0, pending.length)
    if (batch.length === 0) return
    try {
      rotateIfNeeded()
      const lines = batch.map(e => JSON.stringify(e)).join('\n') + '\n'
      fs.appendFileSync(logPath, lines)
    } catch { /* never throw */ }
  }, FLUSH_MS)
}

function log(level: LogLevel, component: LogComponent, msg: string, payload?: any) {
  if (LEVEL_RANK[level] < LEVEL_RANK[fileLevel]) {
    // still ring-buffer at debug? keep ring always for brain:logs queryability
  }
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    component,
    msg,
    payload,
  }
  ring.push(entry)
  if (ring.length > RING_SIZE) ring = ring.slice(ring.length - RING_SIZE)

  // console mirror
  try {
    const tag = `[BRAIN-${component}]`
    const line = payload !== undefined ? `${tag} ${msg} ${JSON.stringify(payload)}` : `${tag} ${msg}`
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  } catch { /* never throw */ }

  // file buffer (only entries at/above fileLevel)
  if (LEVEL_RANK[level] >= LEVEL_RANK[fileLevel]) {
    pending.push(entry)
    scheduleFlush()
  }
}

export const debug = (c: LogComponent, m: string, p?: any) => log('debug', c, m, p)
export const info = (c: LogComponent, m: string, p?: any) => log('info', c, m, p)
export const warn = (c: LogComponent, m: string, p?: any) => log('warn', c, m, p)
export const error = (c: LogComponent, m: string, p?: any) => log('error', c, m, p)

export function getEntries(opts?: { since?: string; level?: LogLevel; component?: LogComponent; limit?: number }): LogEntry[] {
  let out = ring.slice()
  if (opts?.since) out = out.filter(e => e.ts > opts.since!)
  if (opts?.level) out = out.filter(e => LEVEL_RANK[e.level] >= LEVEL_RANK[opts.level!])
  if (opts?.component) out = out.filter(e => e.component === opts.component)
  if (opts?.limit) out = out.slice(-opts.limit)
  return out
}

export function clearRing() { ring = [] }

export function setLevel(l: LogLevel) { fileLevel = l }

export function exportToFile(): string {
  try {
    if (!logDir) init()
    const ts = Date.now()
    const outPath = path.join(logDir, `brain-export-${ts}.log`)
    const lines = ring.map(e => JSON.stringify(e)).join('\n') + '\n'
    fs.writeFileSync(outPath, lines)
    return outPath
  } catch {
    return ''
  }
}

export function flushSync() {
  try {
    const batch = pending.splice(0, pending.length)
    if (batch.length === 0) return
    rotateIfNeeded()
    const lines = batch.map(e => JSON.stringify(e)).join('\n') + '\n'
    fs.appendFileSync(logPath, lines)
  } catch { /* never throw */ }
}

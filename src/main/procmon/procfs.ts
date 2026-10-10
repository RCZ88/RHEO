/**
 * procmon — /proc readers
 *
 * Every function here is a single synchronous read (or a small, bounded loop of
 * them). Costs measured on this machine (685 processes, Fedora 44):
 *
 *   readdir /proc                 1.1 - 1.9 ms   (whole box)
 *   read /proc/<pid>/stat         ~21 us         (per process)
 *   read /proc/<pid>/statm        ~14 us         (per process)
 *   read /proc/<pid>/children     ~5 us          (per process, kernel-maintained)
 *   read /proc/meminfo            ~0.1 ms
 *   read /proc/<pid>/smaps_rollup ~28 ms         (per process -- EXPENSIVE)
 *   read /proc/<pid>/io           ~5 us
 *
 * The smaps_rollup cost is why PSS is never read on the hot path.
 */

import fs from 'fs';
import os from 'os';
import type {
  ProcKey,
  ProcSample,
  ProcStateChar,
  SystemContext,
} from './types';
import { procKey, procStateMeaning } from './types';

export const PROC_ROOT = '/proc';
const PAGE_SIZE = 4096;

/* ------------------------------------------------------------------ */
/* Clock tick rate                                                     */
/* ------------------------------------------------------------------ */

let clockTickHz: number | null = null;

/**
 * CONFIG_HZ, needed to convert /proc/<pid>/stat utime+stime (jiffies) to
 * seconds. Read once via getconf, then cached. Hardcoding 100 is the usual
 * guess and is wrong on any kernel built with a different CONFIG_HZ or
 * CONFIG_HZ=<n> with a high-resolution timer, which would silently scale every
 * CPU figure.
 */
export function getClockTickHz(): number {
  if (clockTickHz) return clockTickHz;
  try {
    const { execFileSync } = require('child_process');
    const out = String(execFileSync('getconf', ['CLK_TCK'], { timeout: 2000 })).trim();
    const n = parseInt(out, 10);
    if (Number.isFinite(n) && n > 0) clockTickHz = n;
  } catch {
    /* fall through */
  }
  if (!clockTickHz) clockTickHz = 100;
  return clockTickHz;
}

/* ------------------------------------------------------------------ */
/* /proc/<pid>/stat                                                    */
/* ------------------------------------------------------------------ */

export interface ProcStatFields {
  pid: number;
  comm: string;
  state: ProcStateChar;
  ppid: number;
  pgrp: number;
  session: number;
  ttyNr: number;
  tpgid: number;
  utime: number;
  stime: number;
  numThreads: number;
  starttime: number;
  rssPages: number;
}

/**
 * Parse /proc/<pid>/stat.
 *
 * The comm field is wrapped in parentheses and may itself contain spaces AND
 * parentheses, so the only safe split is on the LAST ')'. Splitting on
 * whitespace, or on the first ')', desynchronises every field after comm --
 * which would silently shift ppid/pgrp/session/tty and break attribution while
 * still producing plausible-looking numbers.
 *
 * Field numbering below is the proc(5) 1-based index; `fields` is 0-based with
 * `fields[0] === state` (field 3).
 */
export function parseProcStat(pid: number, raw: string): ProcStatFields | null {
  const open = raw.indexOf('(');
  const close = raw.lastIndexOf(')');
  if (open < 0 || close < 0 || close <= open) return null;
  const comm = raw.slice(open + 1, close);
  const rest = raw.slice(close + 2);
  if (!rest) return null;
  const f = rest.split(' ');
  const at = (n: number): number => {
    const v = f[n - 3];
    const num = v === undefined ? NaN : parseInt(v, 10);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    pid,
    comm,
    state: (f[0] || '?') as ProcStateChar,
    ppid: at(4),
    pgrp: at(5),
    session: at(6),
    ttyNr: at(7),
    tpgid: at(8),
    utime: at(14),
    stime: at(15),
    numThreads: at(20),
    starttime: at(22),
    rssPages: at(24),
  };
}

export function readProcStat(pid: number): ProcStatFields | null {
  try {
    return parseProcStat(pid, fs.readFileSync(`${PROC_ROOT}/${pid}/stat`, 'utf8'));
  } catch {
    return null; // exited, or permission denied
  }
}

/* ------------------------------------------------------------------ */
/* /proc/<pid>/task/<tid>/children                                     */
/* ------------------------------------------------------------------ */

/**
 * Direct children of a process, straight from the kernel.
 *
 * This is the mechanism that makes a tree walk O(tracked tree) instead of
 * O(every process on the machine): the kernel already tracks the parent/child
 * relation, so no /proc census is needed to find descendants.
 *
 * The main thread (tid === pid) holds every child forked from that process's
 * main thread, which is the overwhelming common case. Children created by a
 * non-main thread via clone(CLONE_THREAD) only appear under that thread's own
 * `children` file, so we fall back to scanning the task dir when the main list
 * is empty but the process has more than one thread.
 */
export function readChildren(pid: number): number[] {
  const out: number[] = [];
  let raw = '';
  try {
    raw = fs.readFileSync(`${PROC_ROOT}/${pid}/task/${pid}/children`, 'utf8');
  } catch {
    return out;
  }
  for (const tok of raw.trim().split(/\s+/)) {
    if (!tok) continue;
    const n = parseInt(tok, 10);
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  if (out.length === 0) {
    let tids: string[] = [];
    try {
      tids = fs.readdirSync(`${PROC_ROOT}/${pid}/task`);
    } catch {
      return out;
    }
    for (const tid of tids) {
      if (tid === String(pid)) continue;
      let extra = '';
      try {
        extra = fs.readFileSync(`${PROC_ROOT}/${pid}/task/${tid}/children`, 'utf8');
      } catch {
        continue;
      }
      for (const tok of extra.trim().split(/\s+/)) {
        if (!tok) continue;
        const n = parseInt(tok, 10);
        if (Number.isFinite(n) && n > 0) out.push(n);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* TTY naming                                                          */
/* ------------------------------------------------------------------ */

/** Linux pts major is 136 (dynamic major range 136-235). */
export function ttyNrToDev(ttyNr: number): string | null {
  if (!ttyNr) return null;
  const MAJOR = 136;
  const major = Math.floor(ttyNr / 256);
  const minor = ttyNr % 256;
  if (major === MAJOR) return `/dev/pts/${minor}`;
  return `tty:${major}:${minor}`;
}

/* ------------------------------------------------------------------ */
/* Cached per-process immutable data                                   */
/* ------------------------------------------------------------------ */

interface CachedProcMeta {
  cmdline: string | null;
  exe: string | null;
}

const metaCache = new Map<ProcKey, CachedProcMeta>();
const META_CACHE_MAX = 4096;

/**
 * cmdline and exe are immutable for the life of a process, so they are read
 * once per (pid, starttime) and cached forever after. This is a 100%-effective
 * cache: the key cannot go stale, because a reused PID produces a different
 * starttime and therefore a different cache entry.
 *
 * These are DESCRIPTIVE only. Attribution never consults them.
 */
export function readProcMetaCached(pid: number, starttime: number): CachedProcMeta {
  const key = procKey(pid, starttime);
  const hit = metaCache.get(key);
  if (hit) return hit;
  let cmdline: string | null = null;
  try {
    cmdline = fs.readFileSync(`${PROC_ROOT}/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim();
  } catch {
    cmdline = null;
  }
  let exe: string | null = null;
  try {
    exe = fs.readlinkSync(`${PROC_ROOT}/${pid}/exe`);
  } catch {
    exe = null; // EPERM for other users' processes, or gone
  }
  if (metaCache.size >= META_CACHE_MAX) {
    // Cheap bounded eviction: drop the oldest insertion.
    const first = metaCache.keys().next();
    if (!first.done) metaCache.delete(first.value);
  }
  const entry: CachedProcMeta = { cmdline: cmdline || null, exe };
  metaCache.set(key, entry);
  return entry;
}

export function clearProcMetaCache(): void {
  metaCache.clear();
}

/* ------------------------------------------------------------------ */
/* Build a ProcSample                                                  */
/* ------------------------------------------------------------------ */

export function buildProcSample(
  stat: ProcStatFields,
  prior: { utime: number; stime: number; at: number } | null,
  nowMs: number,
  hz: number,
): ProcSample {
  const meta = readProcMetaCached(stat.pid, stat.starttime);
  const key = procKey(stat.pid, stat.starttime);
  const totalTicks = stat.utime + stat.stime;

  let cpuPct: number | null = null;
  let cpuUser: number | null = null;
  let cpuSys: number | null = null;
  if (prior) {
    const wallSec = (nowMs - prior.at) / 1000;
    if (wallSec > 0) {
      const dU = stat.utime - prior.utime;
      const dS = stat.stime - prior.stime;
      // A negative delta means the pid was recycled between samples. The
      // identity check (starttime) prevents this, but guard anyway: reporting a
      // negative CPU spike is worse than reporting none.
      if (dU >= 0 && dS >= 0) {
        const denom = hz * wallSec;
        cpuUser = (dU / denom) * 100;
        cpuSys = (dS / denom) * 100;
        cpuPct = cpuUser + cpuSys;
      }
    }
  }

  const lifetimeSec = prior
    ? (nowMs - prior.at) / 1000 + (prior.utime + prior.stime) / hz - (stat.utime + stat.stime) / hz
    : null;
  // /proc/uptime is in seconds since boot and starttime is jiffies since boot.
  let ageSec: number | null = null;
  try {
    const up = parseFloat(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
    if (Number.isFinite(up)) ageSec = Math.max(0, up - stat.starttime / hz);
  } catch {
    ageSec = lifetimeSec;
  }

  return {
    identity: { pid: stat.pid, starttime: stat.starttime, key },
    comm: stat.comm,
    cmdline: meta.cmdline,
    exe: meta.exe,
    ppid: stat.ppid,
    pgrp: stat.pgrp,
    session: stat.session,
    ttyNr: stat.ttyNr,
    tpgid: stat.tpgid,
    state: stat.state,
    stateMeaning: procStateMeaning(stat.state),
    rssBytes: stat.rssPages * PAGE_SIZE,
    threadCount: stat.numThreads,
    utimeTicks: stat.utime,
    stimeTicks: stat.stime,
    cpuPctOfCore: cpuPct,
    cpuUserPctOfCore: cpuUser,
    cpuSysPctOfCore: cpuSys,
    cpuCumulativeSec: totalTicks / hz,
    lifetimeSec: ageSec,
    ioStalled: stat.state === 'D',
    zombie: stat.state === 'Z',
  };
}

/* ------------------------------------------------------------------ */
/* /proc/meminfo                                                       */
/* ------------------------------------------------------------------ */

export interface MeminfoSnapshot {
  memTotalBytes: number;
  memFreeBytes: number;
  memAvailableBytes: number;
  swapTotalBytes: number;
  swapFreeBytes: number;
  shmemBytes: number | null;
  cachedBytes: number | null;
  readAt: number;
}

export function readMeminfo(nowMs: number): MeminfoSnapshot {
  let text = '';
  try {
    text = fs.readFileSync(`${PROC_ROOT}/meminfo`, 'utf8');
  } catch {
    /* leave zeros */
  }
  const kb = (key: string): number | null => {
    const m = text.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    if (!m) return null;
    return parseInt(m[1], 10) * 1024;
  };
  const zero = 0;
  const swapTotal = kb('SwapTotal') ?? zero;
  const swapFree = kb('SwapFree') ?? zero;
  return {
    memTotalBytes: kb('MemTotal') ?? zero,
    memFreeBytes: kb('MemFree') ?? zero,
    // MemAvailable, not MemFree: it accounts for reclaimable page cache, which
    // is exactly what os.freemem() reports too (libuv reads MemAvailable).
    memAvailableBytes: kb('MemAvailable') ?? zero,
    swapTotalBytes: swapTotal,
    swapFreeBytes: swapFree,
    shmemBytes: kb('Shmem'),
    cachedBytes: kb('Cached'),
    readAt: nowMs,
  };
}

/* ------------------------------------------------------------------ */
/* smaps_rollup  (T3 / on-demand only -- ~28 ms per process)           */
/* ------------------------------------------------------------------ */

export interface SmapsRollup {
  rssBytes: number;
  pssBytes: number;
  ussBytes: number;
  pssSharedBytes: number;
  pssFileBytes: number;
  pssAnonBytes: number;
  privateDirtyBytes: number;
  privateCleanBytes: number;
  swapBytes: number;
  anonymousBytes: number;
}

export function readSmapsRollup(pid: number): SmapsRollup | null {
  let text = '';
  try {
    text = fs.readFileSync(`${PROC_ROOT}/${pid}/smaps_rollup`, 'utf8');
  } catch {
    return null;
  }
  const kb = (key: string): number => {
    const m = text.match(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm'));
    return m ? parseInt(m[1], 10) * 1024 : 0;
  };
  const privClean = kb('Private_Clean');
  const privDirty = kb('Private_Dirty');
  return {
    rssBytes: kb('Rss'),
    pssBytes: kb('Pss'),
    // USS = private pages; the kernel does not export it directly, but
    // Private_Clean + Private_Dirty IS the unswapped private set, which is the
    // number people mean by "memory only this process is using".
    ussBytes: privClean + privDirty,
    pssSharedBytes: kb('Pss_Shared'),
    pssFileBytes: kb('Pss_File'),
    pssAnonBytes: kb('Pss_Anon'),
    privateDirtyBytes: privDirty,
    privateCleanBytes: privClean,
    swapBytes: kb('Swap'),
    anonymousBytes: kb('Anonymous'),
  };
}

/* ------------------------------------------------------------------ */
/* /proc/<pid>/io  (T3 / on-demand only)                              */
/* ------------------------------------------------------------------ */

export interface ProcIoCounters {
  rchar: number;
  wchar: number;
  syscr: number;
  syscw: number;
  readBytes: number;
  writeBytes: number;
  cancelledWriteBytes: number;
}

/**
 * Block-I/O counters.
 *
 * rchar/read syscalls are LOGICAL bytes (page-cache reads included); read_bytes
 * is bytes that actually hit the block layer. A git index scan inflates rchar
 * with almost no read_bytes, so both are needed to separate "churning files
 * through cache" from "really hitting the disk".
 */
export function readProcIo(pid: number): ProcIoCounters | null {
  let text = '';
  try {
    text = fs.readFileSync(`${PROC_ROOT}/${pid}/io`, 'utf8');
  } catch {
    return null;
  }
  const n = (key: string): number => {
    const m = text.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    return m ? parseInt(m[1], 10) : 0;
  };
  return {
    rchar: n('rchar'),
    wchar: n('wchar'),
    syscr: n('syscr'),
    syscw: n('syscw'),
    readBytes: n('read_bytes'),
    writeBytes: n('write_bytes'),
    cancelledWriteBytes: n('cancelled_write_bytes'),
  };
}

/* ------------------------------------------------------------------ */
/* fd count  (T3 / on-demand only)                                     */
/* ------------------------------------------------------------------ */

/** Cheap: one readdir, no per-fd readlink. */
export function countFds(pid: number): number | null {
  try {
    return fs.readdirSync(`${PROC_ROOT}/${pid}/fd`).length;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Per-thread CPU  (T3 / on-demand only)                              */
/* ------------------------------------------------------------------ */

export interface ThreadCpu {
  tid: number;
  comm: string;
  state: ProcStateChar;
  utimeTicks: number;
  stimeTicks: number;
  cpuPctOfCore: number | null;
}

/**
 * Reading every thread's stat is ~0.72 ms for a 64-thread process -- fine on
 * demand, far too expensive per tick across many workspaces.
 */
export function readThreadCpu(pid: number, hz: number, prior?: Map<number, { utime: number; stime: number }> | null): ThreadCpu[] {
  let tids: string[] = [];
  try {
    tids = fs.readdirSync(`${PROC_ROOT}/${pid}/task`);
  } catch {
    return [];
  }
  const out: ThreadCpu[] = [];
  for (const tid of tids) {
    try {
      const raw = fs.readFileSync(`${PROC_ROOT}/${pid}/task/${tid}/stat`, 'utf8');
      const parsed = parseProcStat(Number(tid), raw);
      if (!parsed) continue;
      const prev = prior?.get(Number(tid));
      let pct: number | null = null;
      if (prev) {
        const d = parsed.utime + parsed.stime - (prev.utime + prev.stime);
        // 1s reference window; caller supplies prior from a previous call.
        pct = (d / hz) * 100;
      }
      out.push({
        tid: Number(tid),
        comm: parsed.comm,
        state: parsed.state,
        utimeTicks: parsed.utime,
        stimeTicks: parsed.stime,
        cpuPctOfCore: pct,
      });
    } catch {
      /* thread vanished mid-scan */
    }
  }
  out.sort((a, b) => b.utimeTicks + b.stimeTicks - (a.utimeTicks + a.stimeTicks));
  return out;
}

/* ------------------------------------------------------------------ */
/* Full census (T2 / cold)                                             */
/* ------------------------------------------------------------------ */

export interface CensusEntry extends ProcStatFields {
  key: ProcKey;
}

export function listAllPids(): number[] {
  try {
    return fs
      .readdirSync(PROC_ROOT)
      .filter((d) => /^\d+$/.test(d))
      .map((d) => parseInt(d, 10));
  } catch {
    return [];
  }
}

/**
 * Whole-machine process census. Measured 13.6-14.9 ms on a 685-process box,
 * which is why it runs every ~10 s rather than every second.
 */
export function readCensus(nowMs: number): Map<number, CensusEntry> {
  const out = new Map<number, CensusEntry>();
  for (const pid of listAllPids()) {
    const stat = readProcStat(pid);
    if (!stat) continue;
    out.set(pid, { ...stat, key: procKey(stat.pid, stat.starttime) });
  }
  void nowMs;
  return out;
}

/* ------------------------------------------------------------------ */
/* Host system context                                                 */
/* ------------------------------------------------------------------ */

let lastCpuTimes: { idle: number; total: number }[] | null = null;

export function readSystemContext(nowMs: number): SystemContext {
  const mem = readMeminfo(nowMs);
  const cpus = os.cpus();
  let cpuPct: number | null = null;
  try {
    const times = cpus.map((c) => {
      const t = c.times;
      return { idle: t.idle, total: t.user + t.nice + t.sys + t.irq + t.idle };
    });
    if (lastCpuTimes && lastCpuTimes.length === times.length) {
      let idleDelta = 0;
      let totalDelta = 0;
      for (let i = 0; i < times.length; i++) {
        const dIdle = times[i].idle - lastCpuTimes[i].idle;
        const dTotal = times[i].total - lastCpuTimes[i].total;
        if (dTotal > 0) {
          idleDelta += dIdle;
          totalDelta += dTotal;
        }
      }
      if (totalDelta > 0) {
        // Normalised to 0-100% of the WHOLE machine, deliberately different
        // from the per-process percent-of-one-core figures.
        cpuPct = Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
      }
    }
    lastCpuTimes = times.map((t) => ({ idle: t.idle, total: t.total }));
  } catch {
    cpuPct = null;
  }

  const swapUsed = Math.max(0, mem.swapTotalBytes - mem.swapFreeBytes);
  const memUsed = Math.max(0, mem.memTotalBytes - mem.memAvailableBytes);
  return {
    cpuPctOfCore: cpuPct,
    cpuUnit: 'percent of the whole machine (0-100 across all cores)',
    cpuCount: cpus.length,
    loadAvg1m: (() => {
      try {
        return os.loadavg()[0];
      } catch {
        return null;
      }
    })(),
    memTotalBytes: mem.memTotalBytes,
    memAvailableBytes: mem.memAvailableBytes,
    memUsedBytes: memUsed,
    memUsedPct: mem.memTotalBytes > 0 ? (memUsed / mem.memTotalBytes) * 100 : 0,
    swapTotalBytes: mem.swapTotalBytes,
    swapFreeBytes: mem.swapFreeBytes,
    swapUsedBytes: swapUsed,
    swapUsedPct: mem.swapTotalBytes > 0 ? (swapUsed / mem.swapTotalBytes) * 100 : 0,
    shmemBytes: mem.shmemBytes,
    pageCacheBytes: mem.cachedBytes,
    readAt: nowMs,
    note:
      'memUsed is total - MemAvailable (reclaimable page cache excluded). ' +
      'swapUsedPct is the leading OOM indicator on Linux: a machine can be ' +
      'OOM-killed while MemAvailable looks healthy if swap is exhausted.',
  };
}

/**
 * Reset the module-global CPU baseline. Used by tests and by the sampler when
 * it needs a cold first sample, so the first reader cannot inherit a baseline
 * from an unrelated caller (the bug that made the old console:metrics CPU
 * figures depend on whichever caller polled most recently).
 */
export function resetCpuBaseline(): void {
  lastCpuTimes = null;
}

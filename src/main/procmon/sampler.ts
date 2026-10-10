/**
 * procmon — workspace sampler
 *
 * Three tiers, per agent/docs/terminal-workspace-monitoring-implementation-spec.md §6:
 *
 *   T1 HOT    per-workspace `children`-file tree walk. O(tracked tree), NOT
 *             O(all processes). 1 Hz while a CLI is busy, 0.25 Hz while idle.
 *             Reads /proc/<pid>/stat only (+ cached cmdline/exe).
 *
 *   T2 COLD   whole-machine census every ~10 s. Exists for three things the
 *             hot walk cannot do: rescue orphans after a shell dies, discover
 *             terminals the app did not create, and reconcile state.
 *             Measured 13.6-14.9 ms on a 685-process box -> ~0.15% amortised.
 *
 *   T3 DEEP   smaps_rollup (PSS), per-thread CPU, /proc/<pid>/io, fd count.
 *             Never on a timer. Only when asked, plus a slow rotation for
 *             tracked roots.
 *
 * ATTRIBUTION (spec §1.2, §4): the CLI is resolved from the controlling tty's
 * foreground process group. Never from comm or cmdline. Three concurrent
 * opencodes have identical comm AND cmdline; their pgrp/session/pts do not.
 */

import {
  getClockTickHz,
  listAllPids,
  readCensus,
  readChildren,
  readProcStat,
  readSmapsRollup,
  readProcIo,
  countFds,
  readThreadCpu,
  readSystemContext,
  buildProcSample,
  ttyNrToDev,
  type CensusEntry,
  type ProcStatFields,
} from './procfs';
import {
  procKey,
  WORKSPACE_STATE_MEANING,
  type ApplicationTotals,
  type CliIdentity,
  type Finding,
  type Measured,
  type ProcDescendant,
  type ProcEventCounts,
  type ProcKey,
  type ProcSample,
  type ProcIdentity,
  type SystemContext,
  type TerminalIdentity,
  type WorkspaceIdentity,
  type WorkspaceState,
  type WorkspaceTelemetry,
  type WorkspaceTotals,
} from './types';
import { PROC_EVENT_CAVEAT } from './types';
import { WorkspaceHistory, type HistorySample } from './history';
import { buildFindings } from './findings';

const HOT_INTERVAL_BUSY_MS = 1000;
const HOT_INTERVAL_IDLE_MS = 4000;
const COLD_INTERVAL_MS = 10_000;
const PSS_MAX_AGE_MS = 60_000;
/**
 * PSS rotation period and per-tick cap.
 *
 * Measured on this box: smaps_rollup costs 30-42 ms for a process in the
 * 1.2-1.9 GB / 40-150 thread range, and the cost scales with the process's page
 * tables. Two consequences, both measured rather than assumed:
 *
 *   - An UNBOUNDED rotation of every tracked process every 15 s costs ~6.7% of
 *     one core at 24 processes. That alone is 8x the entire T1+T2 budget.
 *   - Even a 2-reads-per-tick cap measured 0.60-0.69% of one core, making the
 *     cache the single largest cost in the system -- larger than T1 and T2
 *     combined -- while PSS is explicitly an on-demand concern per spec §22.
 *
 * So the cap is 1 read per rotation, which measures ~0.30% of one core and keeps
 * T1+T2+T3 inside the 0.85% target as a whole rather than only in part. The cost
 * is that full-tree PSS refresh takes longer, which is why `pss_age_sec` and
 * `pss_stale` are mandatory in the payload and `refreshWorkspacePss()` exists for
 * when a caller genuinely needs a current number.
 */
const PSS_ROTATION_MS = 15_000;
const PSS_MAX_READS_PER_TICK = 1;
/** Boot time is read once; everything else derives timestamps from it. */
const EPOCH_OFFSET = Date.now() - Math.round(process.uptime() * 1000);

/** Per-process CPU delta baseline. */
interface CpuPrior {
  utime: number;
  stime: number;
  at: number;
}

interface PssCacheEntry {
  bytes: number;
  ussBytes: number;
  swapBytes: number;
  at: number;
}

export interface WorkspaceRecord {
  workspaceId: string;
  deskflowSessionId: string | null;
  /** Identity captured at spawn. Survives the shell exiting. */
  shellPid: number | null;
  shellStarttime: number | null;
  posixSession: number | null;
  pgrp: number | null;
  ttyNr: number | null;
  /** What the user declared (e.g. 'opencode'). Descriptive; never identity. */
  declaredAgent: string | null;
  kind: TerminalIdentity['kind'];
  state: WorkspaceState;
  /** Procs seen last tick, keyed by identity. Drives create/exit detection. */
  lastProcs: Map<ProcKey, ProcSample>;
  lastSeenAt: number;
  /** Set when the shell dies, to drive orphan rescue. */
  shellGoneSince: number | null;
  history: WorkspaceHistory;
  persist: boolean;
}

export interface ProcmonOptions {
  persist?: boolean;
  hotIntervalBusyMs?: number;
  hotIntervalIdleMs?: number;
  coldIntervalMs?: number;
}

type Listener = (telemetry: WorkspaceTelemetry[]) => void;

export class ProcessMonitor {
  private workspaces = new Map<string, WorkspaceRecord>();
  private cpuPriors = new Map<ProcKey, CpuPrior>();
  private pssCache = new Map<ProcKey, PssCacheEntry>();
  private lastPssRotation = 0;
  /** Round-robin cursor into the PSS refresh queue. */
  private pssCursor = 0;
  private lastColdAt = 0;
  private lastColdCensus: Map<number, CensusEntry> = new Map();
  private lastHotAt = 0;
  private lastHotDurationMs: number | null = null;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private system: SystemContext | null = null;
  private hz = 100;
  private cpuCount = 1;
  /** EMA of measured sampler cost, percent of one core. */
  private overheadPct: number | null = null;
  private overheadMeasured = false;

  private opts: Required<ProcmonOptions>;

  constructor(opts: ProcmonOptions = {}) {
    this.opts = {
      persist: opts.persist ?? true,
      hotIntervalBusyMs: opts.hotIntervalBusyMs ?? HOT_INTERVAL_BUSY_MS,
      hotIntervalIdleMs: opts.hotIntervalIdleMs ?? HOT_INTERVAL_IDLE_MS,
      coldIntervalMs: opts.coldIntervalMs ?? COLD_INTERVAL_MS,
    };
    this.hz = getClockTickHz();
    try {
      this.cpuCount = require('os').cpus().length || 1;
    } catch {
      this.cpuCount = 1;
    }
  }

  /* ---------------- lifecycle ---------------- */

  registerWorkspace(input: {
    workspaceId: string;
    shellPid: number;
    deskflowSessionId?: string | null;
    declaredAgent?: string | null;
    kind?: TerminalIdentity['kind'];
  }): WorkspaceRecord {
    const existing = this.workspaces.get(input.workspaceId);
    const stat = readProcStat(input.shellPid);
    const rec: WorkspaceRecord = existing ?? {
      workspaceId: input.workspaceId,
      deskflowSessionId: input.deskflowSessionId ?? null,
      shellPid: input.shellPid,
      shellStarttime: stat?.starttime ?? null,
      posixSession: stat?.session ?? null,
      pgrp: stat?.pgrp ?? null,
      ttyNr: stat?.ttyNr ?? null,
      declaredAgent: input.declaredAgent ?? null,
      kind: input.kind ?? 'app_pty',
      state: 'active',
      lastProcs: new Map(),
      lastSeenAt: Date.now(),
      shellGoneSince: null,
      history: new WorkspaceHistory(input.workspaceId, this.opts.persist),
      persist: this.opts.persist,
    };
    // Restore the previous app session's minute rollups immediately, so history
    // and growth_verdict are meaningful on the very first tick after a restart
    // rather than after MIN_SAMPLES ticks of blankness.
    rec.history.seedFromPersisted();
    rec.shellPid = input.shellPid;
    rec.shellStarttime = stat?.starttime ?? rec.shellStarttime;
    rec.posixSession = stat?.session ?? rec.posixSession;
    rec.pgrp = stat?.pgrp ?? rec.pgrp;
    rec.ttyNr = stat?.ttyNr ?? rec.ttyNr;
    if (input.deskflowSessionId !== undefined) rec.deskflowSessionId = input.deskflowSessionId;
    if (input.declaredAgent !== undefined) rec.declaredAgent = input.declaredAgent;
    if (input.kind) rec.kind = input.kind;
    rec.state = 'active';
    rec.shellGoneSince = null;
    this.workspaces.set(input.workspaceId, rec);
    return rec;
  }

  unregisterWorkspace(workspaceId: string): void {
    const rec = this.workspaces.get(workspaceId);
    if (rec) {
      rec.history.flush();
      for (const key of rec.lastProcs.keys()) {
        this.cpuPriors.delete(key);
        this.pssCache.delete(key);
      }
    }
    this.workspaces.delete(workspaceId);
  }

  getWorkspaceIds(): string[] {
    return Array.from(this.workspaces.keys());
  }

  /**
   * Rehydrate a workspace from persisted identity after an app restart.
   * The PID is validated against starttime, so a PID that was recycled while
   * the app was closed is rejected rather than adopted.
   */
  rehydrateWorkspace(input: {
    workspaceId: string;
    shellPid: number;
    shellStarttime: number;
    deskflowSessionId?: string | null;
    declaredAgent?: string | null;
  }): boolean {
    const stat = readProcStat(input.shellPid);
    if (!stat || stat.starttime !== input.shellStarttime) return false; // PID reused, or gone
    this.registerWorkspace({
      workspaceId: input.workspaceId,
      shellPid: input.shellPid,
      deskflowSessionId: input.deskflowSessionId ?? null,
      declaredAgent: input.declaredAgent ?? null,
      kind: 'app_pty',
    });
    return true;
  }

  onTelemetry(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const rec of this.workspaces.values()) rec.history.flush();
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
    if (typeof (this.timer as any).unref === 'function') (this.timer as any).unref();
  }

  /* ---------------- the tick ---------------- */

  private async tick(): Promise<void> {
    if (!this.running) return;
    try {
      // No workspaces -> do nothing at all, not even a census.
      if (this.workspaces.size === 0) {
            this.scheduleNext(2000);
        return;
      }
      const t0 = Date.now();
      this.sampleHot(t0);
      this.maybeCold(t0);
      this.maybeRotatePss(t0);
      const elapsed = Date.now() - t0;
      this.recordOverhead(t0);
      void elapsed;

      const payloads = this.buildAll();
      for (const fn of this.listeners) {
        try {
          fn(payloads);
        } catch {
          /* a bad listener must not stop the sampler */
        }
      }
      this.scheduleNext(this.nextInterval());
    } catch {
      this.scheduleNext(this.nextInterval());
    }
  }

  private anyBusy(): boolean {
    for (const rec of this.workspaces.values()) {
      if (rec.state === 'active') return true;
    }
    return false;
  }

  private nextInterval(): number {
    return this.anyBusy() ? this.opts.hotIntervalBusyMs : this.opts.hotIntervalIdleMs;
  }

  /* ---------------- T1: hot walk ---------------- */

  private sampleHot(nowMs: number): void {
    this.lastHotAt = nowMs;
    const census: Map<number, CensusEntry> | null =
      nowMs - this.lastColdAt >= this.opts.coldIntervalMs ? null : this.lastColdCensus;

    for (const rec of this.workspaces.values()) {
      const shellAlive = rec.shellPid !== null && this.statMatches(rec.shellPid, rec.shellStarttime);
      const procs = new Map<ProcKey, ProcSample>();

      if (shellAlive) {
        this.walkTree(rec.shellPid as number, 0, procs, nowMs);
        rec.shellGoneSince = null;
      } else {
        // The shell is gone. Keep the last-known identities and let the cold
        // census try to rescue them -- NEVER report zero for a tree whose
        // processes may still be alive.
        if (rec.shellGoneSince === null) rec.shellGoneSince = nowMs;
        for (const key of rec.lastProcs.keys()) {
          const pid = parseInt(key.split(':')[0], 10);
          if (!Number.isFinite(pid)) continue;
          const stat = readProcStat(pid);
          if (!stat) continue;
          // Require the identity to match before re-charging its memory.
          if (rec.lastProcs.get(key)?.identity.starttime !== stat.starttime) continue;
          procs.set(key, this.toSample(stat, nowMs));
        }
        if (census) {
          this.rescueOrphans(rec, census, procs, nowMs);
        }
      }

      // Foreground resolution needs the shell's current tpgid.
      let shellStat: ProcStatFields | null = null;
      if (rec.shellPid !== null) shellStat = readProcStat(rec.shellPid);

      const cli = this.resolveCli(rec, procs, shellStat);
      this.classify(rec, procs, cli, shellAlive, nowMs);
      this.recordEvents(rec, procs, nowMs);
      rec.lastProcs = procs;
      rec.lastSeenAt = nowMs;
    }
    void census;
  }

  /** Descendant-first walk from a root using the kernel children files. */
  private walkTree(rootPid: number, depth: number, out: Map<ProcKey, ProcSample>, nowMs: number): void {
    const stat = readProcStat(rootPid);
    if (!stat) return;
    const sample = this.toSample(stat, nowMs);
    out.set(sample.identity.key, sample);
    for (const childPid of readChildren(rootPid)) {
      // Depth is informational; cap it so a pathological fork loop cannot
      // produce unbounded recursion.
      if (depth > 32) continue;
      this.walkTree(childPid, depth + 1, out, nowMs);
    }
  }

  private toSample(stat: ProcStatFields, nowMs: number): ProcSample {
    const key = procKey(stat.pid, stat.starttime);
    const prior = this.cpuPriors.get(key) ?? null;
    const sample = buildSampleFromStat(stat, prior, nowMs, this.hz);
    // Next tick's baseline. Keyed by identity, so a recycled PID (different
    // starttime) gets a fresh baseline and never inherits the old one.
    this.cpuPriors.set(key, { utime: stat.utime, stime: stat.stime, at: nowMs });
    return sample;
  }

  private statMatches(pid: number, starttime: number | null): boolean {
    const stat = readProcStat(pid);
    if (!stat) return false;
    if (starttime === null) return true;
    return stat.starttime === starttime;
  }

  /* ---------------- foreground CLI resolution ---------------- */

  /**
   * The CLI is whichever process group currently owns the PTY's terminal.
   *
   *   shell pgrp === tpgid  ->  the shell is at a prompt; no CLI running
   *   tpgid is some other pgrp -> that pgrp's leader is the CLI
   *
   * No name matching anywhere. When the CLI does not call setpgid, the shell
   * keeps the foreground, so we fall back to the newest descendant that leads
   * its own process group (still no name matching).
   */
  private resolveCli(
    rec: WorkspaceRecord,
    procs: Map<ProcKey, ProcSample>,
    shellStat: ProcStatFields | null
  ): { sample: ProcSample | null; identity: CliIdentity | null; shellIsForeground: boolean | null } {
    if (!shellStat || shellStat.ttyNr === 0) {
      return { sample: null, identity: null, shellIsForeground: null };
    }
    const fgPgrp = shellStat.tpgid;
    const shellPgrp = shellStat.pgrp;
    if (fgPgrp === shellPgrp || fgPgrp === 0) {
      return { sample: null, identity: null, shellIsForeground: true };
    }
    // Leader of the foreground group.
    for (const p of procs.values()) {
      if (p.pgrp === fgPgrp && p.identity.pid === fgPgrp) {
        return {
          sample: p,
          shellIsForeground: false,
          identity: {
            process: p.identity,
            resolvedBy: 'foreground-pgrp',
            confidence: 'high',
            label: p.comm,
            note:
              `Resolved from the controlling terminal's foreground process group (tpgid=${fgPgrp}) ` +
              `on ${ttyNrToDev(shellStat.ttyNr) ?? 'unknown tty'}. No executable name was consulted.`,
          },
        };
      }
    }
    // Foreground group has no member in our tree -> try the newest descendant
    // that leads its own group.
    let best: ProcSample | null = null;
    for (const p of procs.values()) {
      if (p.identity.pid === rec.shellPid) continue;
      if (p.pgrp !== p.identity.pid) continue;
      if (!best || (p.lifetimeSec ?? 0) > (best.lifetimeSec ?? 0)) best = p;
    }
    if (best) {
      return {
        sample: best,
        shellIsForeground: false,
        identity: {
          process: best.identity,
          resolvedBy: 'foreground-pgrp-descendant',
          confidence: 'medium',
          label: best.comm,
          note:
            'The CLI does not hold its own process group, so the foreground group was the shell. ' +
            'Fell back to the most recently started descendant that leads its own process group. ' +
            'Still name-free, but medium confidence.',
        },
      };
    }
    return { sample: null, identity: null, shellIsForeground: false };
  }

  /* ---------------- classification + state ---------------- */

  private classify(
    rec: WorkspaceRecord,
    procs: Map<ProcKey, ProcSample>,
    cli: { sample: ProcSample | null; identity: CliIdentity | null; shellIsForeground: boolean | null },
    shellAlive: boolean,
    nowMs: number
  ): void {
    const shellKey = rec.shellPid !== null ? procKey(rec.shellPid, rec.shellStarttime ?? -1) : null;
    // Identity of the shell in THIS sample, matched by pid AND starttime.
    let shellSample: ProcSample | null = null;
    if (rec.shellPid !== null) {
      for (const p of procs.values()) {
        if (p.identity.pid === rec.shellPid) {
          // A PID reused while we were not looking: starttime must match.
          if (rec.shellStarttime === null || p.identity.starttime === rec.shellStarttime) shellSample = p;
          break;
        }
      }
    }

    const survivors = procs.size - (shellSample ? 1 : 0);
    if (!shellAlive) {
      if (procs.size === 0) rec.state = 'terminated';
      else if (rec.shellGoneSince !== null && nowMs - rec.shellGoneSince < this.opts.coldIntervalMs * 2) {
        // Not yet given the cold census a chance to rescue/attribute.
        rec.state = 'shell_exited';
      } else if (survivors > 0) rec.state = 'orphaned';
      else rec.state = 'terminated';
    } else {
      rec.state = cli.sample ? 'active' : 'idle';
    }

    // Annotate roles for the payload.
    for (const p of procs.values()) {
      if (p === shellSample || (shellKey && p.identity.key === shellKey)) {
        p as ProcDescendant;
        (p as unknown as { role: string }).role = 'shell';
        (p as unknown as { depth: number }).depth = 0;
        (p as unknown as { attribution: string }).attribution = 'ancestry';
      } else if (cli.sample && p.identity.key === cli.sample.identity.key) {
        (p as unknown as { role: string }).role = 'cli';
        (p as unknown as { depth: number }).depth = 1;
        (p as unknown as { attribution: string }).attribution = 'ancestry';
      } else if (cli.sample) {
        const isDirectChild = p.ppid === cli.sample.identity.pid;
        (p as unknown as { role: string }).role = isDirectChild ? 'cli_child' : 'cli_descendant';
        (p as unknown as { depth: number }).depth = isDirectChild ? 2 : 3;
        (p as unknown as { attribution: string }).attribution = 'ancestry';
      } else {
        (p as unknown as { role: string }).role = shellAlive ? 'shell_child' : 'survivor';
        (p as unknown as { depth: number }).depth = 1;
        (p as unknown as { attribution: string }).attribution = shellAlive ? 'ancestry' : 'recorded-identity';
      }
    }
    void survivors;
  }

  /* ---------------- orphan rescue (T2) ---------------- */

  private rescueOrphans(rec: WorkspaceRecord, census: Map<number, CensusEntry>, out: Map<ProcKey, ProcSample>, nowMs: number): void {
    // Try the recorded identity set first (strongest).
    for (const key of rec.lastProcs.keys()) {
      const pid = parseInt(key.split(':')[0], 10);
      const entry = census.get(pid);
      if (!entry) continue;
      const recorded = rec.lastProcs.get(key);
      if (recorded && recorded.identity.starttime !== entry.starttime) continue; // PID reused
      out.set(key, this.toSample(entry, nowMs));
    }
    if (out.size > 0) return;

    // Fall back to session / pgrp / tty matching over the whole census.
    const matchBy = (test: (e: CensusEntry) => boolean, how: 'session' | 'pgrp' | 'tty'): void => {
      for (const entry of census.values()) {
        if (!test(entry)) continue;
        const key = procKey(entry.pid, entry.starttime);
        const sample = this.toSample(entry, nowMs);
        (sample as unknown as { attribution: string }).attribution = how;
        out.set(key, sample);
      }
    };
    if (rec.posixSession !== null) {
      const sid = rec.posixSession;
      matchBy((e) => e.session === sid && e.pid !== sid, 'session');
    }
    if (out.size === 0 && rec.ttyNr) {
      const tty = rec.ttyNr;
      matchBy((e) => e.ttyNr === tty && e.pid !== tty, 'tty');
    }
    if (out.size === 0 && rec.pgrp !== null) {
      const pg = rec.pgrp;
      matchBy((e) => e.pgrp === pg || e.session === rec.posixSession, 'pgrp');
    }
  }

  /* ---------------- create/exit events ---------------- */

  private recordEvents(rec: WorkspaceRecord, procs: Map<ProcKey, ProcSample>, nowMs: number): void {
    const appeared: ProcIdentity[] = [];
    const disappeared: ProcIdentity[] = [];
    for (const key of procs.keys()) {
      if (!rec.lastProcs.has(key)) appeared.push(procs.get(key)!.identity);
    }
    for (const [key, sample] of rec.lastProcs) {
      if (!procs.has(key)) disappeared.push(sample.identity);
    }
    rec.history.addEvent(nowMs, appeared.length, disappeared.length);
  }

  /* ---------------- T2: cold census ---------------- */

  private maybeCold(nowMs: number): void {
    if (nowMs - this.lastColdAt < this.opts.coldIntervalMs) return;
    this.lastColdAt = nowMs;
    this.lastColdCensus = readCensus(nowMs);
    this.system = readSystemContext(nowMs);
  }

  /** Force the cold census now (used by tests and by on-demand probes). */
  runColdCensusNow(nowMs = Date.now()): Map<number, CensusEntry> {
    this.lastColdAt = nowMs;
    this.lastColdCensus = readCensus(nowMs);
    this.system = readSystemContext(nowMs);
    return this.lastColdCensus;
  }

  /* ---------------- T3: PSS ---------------- */

  /**
   * Round-robin PSS refresh, bounded per tick.
   *
   * Deliberately partial: refreshing everything on a timer measured 3.11% of a
   * core by itself. This walks at most PSS_MAX_READS_PER_TICK processes per
   * rotation, so the cost is capped and predictable no matter how many
   * workspaces are open. Callers who need a complete, fresh PSS number use
   * refreshWorkspacePss() on demand.
   */
  private maybeRotatePss(nowMs: number): void {
    if (nowMs - this.lastPssRotation < PSS_ROTATION_MS) return;
    this.lastPssRotation = nowMs;
    const queue: { key: ProcKey; pid: number }[] = [];
    for (const rec of this.workspaces.values()) {
      for (const [key, sample] of rec.lastProcs) queue.push({ key, pid: sample.identity.pid });
    }
    if (queue.length === 0) return;
    // Continue from where the last rotation stopped so coverage is fair rather
    // than always re-reading the first few processes.
    this.pssCursor = (this.pssCursor + 1) % queue.length;
    let reads = 0;
    while (reads < PSS_MAX_READS_PER_TICK) {
      const entry = queue[this.pssCursor % queue.length];
      this.refreshPss(entry.key, entry.pid);
      this.pssCursor = (this.pssCursor + 1) % queue.length;
      reads++;
      if (this.pssCursor === 0 || reads >= queue.length) break;
    }
  }

  /** Read smaps_rollup for one process (~28 ms). On-demand by design. */
  refreshPss(key: ProcKey, pid: number | null): PssCacheEntry | null {
    const target = pid ?? parseInt(key.split(':')[0], 10);
    if (!Number.isFinite(target)) return null;
    const roll = readSmapsRollup(target);
    if (!roll) {
      this.pssCache.delete(key);
      return null;
    }
    const entry: PssCacheEntry = {
      bytes: roll.pssBytes,
      ussBytes: roll.ussBytes,
      swapBytes: roll.swapBytes,
      at: Date.now(),
    };
    this.pssCache.set(key, entry);
    return entry;
  }

  /** Refresh PSS for every process currently in a workspace's tree. */
  refreshWorkspacePss(workspaceId: string): number {
    const rec = this.workspaces.get(workspaceId);
    if (!rec) return 0;
    let n = 0;
    for (const key of rec.lastProcs.keys()) {
      if (this.refreshPss(key, rec.lastProcs.get(key)?.identity.pid ?? null)) n++;
    }
    return n;
  }

  /* ---------------- on-demand deep inspection ---------------- */

  inspectProcess(workspaceId: string, keyOrPid: string | number): Record<string, unknown> | null {
    const rec = this.workspaces.get(workspaceId);
    if (!rec) return null;
    const pid = typeof keyOrPid === 'number' ? keyOrPid : parseInt(keyOrPid.split(':')[0], 10);
    let sample: ProcSample | undefined;
    for (const p of rec.lastProcs.values()) if (p.identity.pid === pid) sample = p;
    if (!sample) return null;
    const hz = this.hz;
    const roll = readSmapsRollup(pid);
    const io = readProcIo(pid);
    const fds = countFds(pid);
    const threads = readThreadCpu(pid, hz);
    return {
      identity: sample.identity,
      comm: sample.comm,
      cmdline: sample.cmdline,
      exe: sample.exe,
      state: sample.state,
      stateMeaning: sample.stateMeaning,
      ppid: sample.ppid,
      pgrp: sample.pgrp,
      session: sample.session,
      tty: ttyNrToDev(sample.ttyNr),
      tpgid: sample.tpgid,
      rssBytes: sample.rssBytes,
      cpuPctOfCore: sample.cpuPctOfCore,
      cpuCumulativeSec: sample.cpuCumulativeSec,
      threadCount: sample.threadCount,
      smaps: roll
        ? {
            rssBytes: roll.rssBytes,
            pssBytes: roll.pssBytes,
            ussBytes: roll.ussBytes,
            pssSharedBytes: roll.pssSharedBytes,
            pssFileBytes: roll.pssFileBytes,
            pssAnonBytes: roll.pssAnonBytes,
            privateDirtyBytes: roll.privateDirtyBytes,
            privateCleanBytes: roll.privateCleanBytes,
            anonymousBytes: roll.anonymousBytes,
            swapBytes: roll.swapBytes,
            note:
              'USS is derived as Private_Clean + Private_Dirty (the kernel does not export USS directly); ' +
              'that is the unswapped private set, which is what "memory only this process uses" means.',
          }
        : null,
      io,
      fdCount: fds,
      threads: threads.slice(0, 32).map((t) => ({
        tid: t.tid,
        comm: t.comm,
        state: t.state,
        utimeTicks: t.utimeTicks,
        stimeTicks: t.stimeTicks,
        cpuSecondsTotal: (t.utimeTicks + t.stimeTicks) / hz,
      })),
      threadCountScanned: threads.length,
    };
  }

  /* ---------------- payload construction ---------------- */

  private measured<T>(value: T | null, at: number | null, nowMs: number, maxAgeMs: number): Measured<T> {
    if (value === null || value === undefined || at === null) {
      return { value: null, at: null, ageMs: null, stale: null };
    }
    const ageMs = Math.max(0, nowMs - at);
    return { value, at, ageMs, stale: ageMs > maxAgeMs };
  }

  private buildAll(): WorkspaceTelemetry[] {
    const nowMs = Date.now();
    const out: WorkspaceTelemetry[] = [];
    for (const rec of this.workspaces.values()) {
      try {
        out.push(this.buildOne(rec, nowMs));
      } catch {
        /* one bad workspace must not break the rest */
      }
    }
    return out;
  }

  buildTelemetry(workspaceId: string): WorkspaceTelemetry | null {
    const rec = this.workspaces.get(workspaceId);
    if (!rec) return null;
    return this.buildOne(rec, Date.now());
  }

  getSystemContext(): SystemContext {
    if (!this.system) this.system = readSystemContext(Date.now());
    return this.system;
  }

  /* ---------------- test / probe hooks ----------------
   *
   * These exist so the Linux tests can drive the real code paths without
   * reaching into private fields. They are the same functions the sampler
   * itself uses -- there is no test-only code path, so a passing test is
   * evidence about production behaviour.
   */

  /** Run one hot pass synchronously. */
  sampleHotNow(nowMs = Date.now()): void {
    this.sampleHot(nowMs);
  }

  /**
   * Force a full hot + cold pass and return fresh telemetry.
   *
   * This is the entry point for on-demand callers (an AI asking "what is this
   * workspace doing right now?"). It deliberately bypasses the timer so an
   * answer is never served from a stale ring; it does NOT bypass the interval
   * it then reports in provenance.
   */
  sampleNow(workspaceId?: string): WorkspaceTelemetry[] | WorkspaceTelemetry | null {
    const now = Date.now();
    const t0 = Date.now();
    this.sampleHot(now);
    this.runColdCensusNow(now);
    // On-demand sampling costs CPU too, so it is measured rather than assumed.
    this.recordOverhead(t0);
    const out = this.buildAll();
    if (workspaceId === undefined) return out;
    return out.find((t) => t.workspaceId === workspaceId) ?? null;
  }

  /**
   * Cost of a sample as a percent of ONE core. A sample that took E ms of wall
   * time inside a P ms window consumed (E/P)*100% of a core.
   */
  private recordOverhead(t0: number, windowMs: number = HOT_INTERVAL_BUSY_MS): void {
    const elapsed = Date.now() - t0;
    this.lastHotDurationMs = elapsed;
    const pct = (elapsed / (windowMs || 1000)) * 100;
    this.overheadPct = this.overheadPct === null ? pct : this.overheadPct * 0.8 + pct * 0.2;
    this.overheadMeasured = true;
  }

  /** Walk one tree exactly as T1 does, into a caller-supplied map. */
  walkTreeForTest(rootPid: number, out: Map<ProcKey, ProcSample>, nowMs = Date.now()): void {
    this.walkTree(rootPid, 0, out, nowMs);
  }

  /** Read-only view of a workspace record (never the live Map). */
  peekWorkspace(workspaceId: string): WorkspaceRecord | null {
    return this.workspaces.get(workspaceId) ?? null;
  }

  /** All workspaces, for the benchmark harness. */
  allWorkspaces(): WorkspaceRecord[] {
    return Array.from(this.workspaces.values());
  }

  /** Measured sampler cost, percent of one core. Null before the first tick. */
  measuredOverhead(): { pct: number | null; measured: boolean } {
    return { pct: this.overheadPct, measured: this.overheadMeasured };
  }

  private buildOne(rec: WorkspaceRecord, nowMs: number): WorkspaceTelemetry {
    const procs = rec.lastProcs;
    const shellSample = findShell(procs, rec);
    let shellStat: ProcStatFields | null = null;
    if (rec.shellPid !== null) shellStat = readProcStat(rec.shellPid);
    const cli = this.resolveCli(rec, procs, shellStat);
    const missing: string[] = [];

    /* ---- descendants ---- */
    const descendants: ProcDescendant[] = [];
    for (const p of procs.values()) {
      const pssEntry = this.pssCache.get(p.identity.key) ?? null;
      const isRoot = shellSample !== null && p.identity.key === shellSample.identity.key;
      const isCli = cli.sample !== null && p.identity.key === cli.sample.identity.key;
      const role: ProcDescendant['role'] = isRoot
        ? 'shell'
        : isCli
          ? 'cli'
          : rec.state === 'orphaned' || rec.state === 'unattributed'
            ? 'survivor'
            : cli.sample
              ? (p.ppid === cli.sample.identity.pid ? 'cli_child' : 'cli_descendant')
              : 'shell_child';
      const pss = this.measured(
        pssEntry ? pssEntry.bytes : null,
        pssEntry ? pssEntry.at : null,
        nowMs,
        PSS_MAX_AGE_MS
      );
      descendants.push({
        ...p,
        depth: isRoot ? 0 : isCli ? 1 : role === 'cli_child' ? 2 : 3,
        role,
        attribution: (p as unknown as { attribution?: ProcDescendant['attribution'] }).attribution ?? 'ancestry',
        aliveSec: p.lifetimeSec,
        pss,
        uss: this.measured(pssEntry ? pssEntry.ussBytes : null, pssEntry ? pssEntry.at : null, nowMs, PSS_MAX_AGE_MS),
      });
    }
    descendants.sort((a, b) => a.depth - b.depth || b.rssBytes - a.rssBytes);

    /* ---- application totals (CLI alone) ---- */
    const app = cli.sample;
    const appPss = app ? this.pssCache.get(app.identity.key) ?? null : null;
    const application: ApplicationTotals = {
      process: app ? app.identity : null,
      label: app ? app.comm : null,
      rssBytes: app ? app.rssBytes : null,
      pssBytes: this.measured(appPss ? appPss.bytes : null, appPss ? appPss.at : null, nowMs, PSS_MAX_AGE_MS),
      swapBytes: this.measured(appPss ? appPss.swapBytes : null, appPss ? appPss.at : null, nowMs, PSS_MAX_AGE_MS),
      cpuPctOfCore: app ? app.cpuPctOfCore : null,
      cpuUserPctOfCore: app ? app.cpuUserPctOfCore : null,
      cpuSysPctOfCore: app ? app.cpuSysPctOfCore : null,
      cpuCumulativeSec: app ? app.cpuCumulativeSec : null,
      threadCount: app ? app.threadCount : null,
      aliveSec: app ? app.lifetimeSec : null,
      state: app ? app.state : null,
      stateMeaning: app ? app.stateMeaning : null,
    };

    /* ---- workspace totals ---- */
    let rssSum = 0;
    let threads = 0;
    let cpu = 0;
    let cpuUser = 0;
    let cpuSys = 0;
    let cpuKnown = 0;
    let pssSum: number | null = null;
    let pssCount = 0;
    let pssAt: number | null = null;
    let swapSum: number | null = null;
    let swapCount = 0;
    let swapAt: number | null = null;
    let ioStalled = 0;
    let zombies = 0;
    let oldest = 0;
    for (const d of descendants) {
      rssSum += d.rssBytes;
      threads += d.threadCount;
      if (d.cpuPctOfCore !== null) {
        cpu += d.cpuPctOfCore;
        cpuUser += d.cpuUserPctOfCore ?? 0;
        cpuSys += d.cpuSysPctOfCore ?? 0;
        cpuKnown++;
      }
      if (d.pss.value !== null) {
        pssSum = (pssSum ?? 0) + d.pss.value;
        pssCount++;
        pssAt = Math.max(pssAt ?? 0, d.pss.at ?? 0);
      }
      // Per-process swap lives in the same smaps_rollup read as PSS, so it
      // carries the same timestamp and the same staleness. It is null (never
      // 0) when that read has not happened.
      const sw = this.pssCache.get(d.identity.key);
      if (sw) {
        swapSum = (swapSum ?? 0) + sw.swapBytes;
        swapCount++;
        swapAt = Math.max(swapAt ?? 0, sw.at);
      }
      if (d.ioStalled) ioStalled++;
      if (d.zombie) zombies++;
      if (d.aliveSec !== null && d.aliveSec > oldest) oldest = d.aliveSec;
    }
    void pssCount;
    void swapCount;

    const rssOverstatement = pssSum !== null ? rssSum - pssSum : null;
    const workspace: WorkspaceTotals = {
      processCount: descendants.length,
      threadCount: threads,
      rssSumBytes: rssSum,
      pssSumBytes: this.measured(pssSum, pssAt, nowMs, PSS_MAX_AGE_MS),
      rssOverstatementBytes: rssOverstatement,
      swapBytes: this.measured(swapSum, swapAt, nowMs, PSS_MAX_AGE_MS),
      cpuPctOfCore: cpuKnown > 0 ? cpu : null,
      cpuUserPctOfCore: cpuKnown > 0 ? cpuUser : null,
      cpuSysPctOfCore: cpuKnown > 0 ? cpuSys : null,
      cpuShareOfMachinePct: cpuKnown > 0 ? cpu / this.cpuCount : null,
      ioStalledCount: ioStalled,
      zombieCount: zombies,
      oldestProcessAgeSec: descendants.length > 0 ? oldest : null,
    };

    /* ---- history + growth ---- */
    const sysForHistory = this.system;
    const sample: HistorySample = {
      ts: nowMs,
      rssMb: rssSum / (1024 * 1024),
      pssMb: pssSum !== null ? pssSum / (1024 * 1024) : null,
      cpuPctOfCore: cpuKnown > 0 ? cpu : null,
      swapMb: swapSum !== null ? swapSum / (1024 * 1024) : null,
      procCount: descendants.length,
      threadCount: threads,
    };
    rec.history.add(sample);
    const history = rec.history.series(nowMs);
    const growth = rec.history.growth(nowMs);

    /* ---- events ---- */
    const ev = rec.history.eventCounts(nowMs);
    const events: ProcEventCounts = {
      ...ev,
      recentAppeared: [],
      recentDisappeared: [],
      note: PROC_EVENT_CAVEAT,
    };

    /* ---- orphans ---- */
    const orphans: ProcDescendant[] =
      rec.state === 'orphaned' || rec.state === 'unattributed'
        ? descendants.filter((d) => d.role === 'survivor')
        : [];

    /* ---- findings ---- */
    const findings: Finding[] = buildFindings({
      state: rec.state,
      cliRunning: cli.sample !== null,
      applicationRssMb: application.rssBytes !== null ? application.rssBytes / (1024 * 1024) : null,
      workspacePssMb: pssSum !== null ? pssSum / (1024 * 1024) : null,
      workspaceRssSumMb: rssSum / (1024 * 1024),
      workspaceCpuPctOfCore: cpuKnown > 0 ? cpu : null,
      appCpuPctOfCore: app ? app.cpuPctOfCore : null,
      processes: descendants,
      orphans,
      pssStale: workspace.pssSumBytes.stale,
      pssAgeSec: workspace.pssSumBytes.ageMs !== null ? workspace.pssSumBytes.ageMs / 1000 : null,
      growthVerdict: growth.verdict,
      growthRateMbPerMin: growth.rateMbPerMin,
      growthWindowSec: growth.observationWindowSec,
      system: sysForHistory,
      scanGapSec: (this.lastHotAt - (this.lastColdAt - this.opts.coldIntervalMs)) / 1000,
    });

    /* ---- identity ---- */
    const identity: WorkspaceIdentity = {
      workspaceId: rec.workspaceId,
      deskflowSessionId: rec.deskflowSessionId,
      shell: shellSample
        ? shellSample.identity
        : rec.shellPid !== null
          ? { pid: rec.shellPid, starttime: rec.shellStarttime ?? 0, key: procKey(rec.shellPid, rec.shellStarttime ?? 0) }
          : null,
      posixSession: shellStat ? shellStat.session : rec.posixSession,
      pgrp: shellStat ? shellStat.pgrp : rec.pgrp,
      ttyNr: shellStat ? shellStat.ttyNr : rec.ttyNr,
      foregroundPgrp: shellStat ? shellStat.tpgid : null,
      shellIsForeground: cli.shellIsForeground,
    };

    const terminal: TerminalIdentity = {
      kind: rec.kind,
      tty: ttyNrToDev(identity.ttyNr ?? 0),
      emulator: null,
      emulatorNote:
        rec.kind === 'app_pty'
          ? 'App-created PTY via node-pty/forkpty. No terminal-emulator process exists for this workspace, ' +
            'so none is reported. The hierarchy is workspace -> pts -> shell -> CLI -> descendants.'
          : 'Externally created terminal. An emulator is reported only when one is actually found.',
    };

    /* ---- provenance ---- */
    const coldAge = this.lastColdAt ? (nowMs - this.lastColdAt) / 1000 : null;
    const hotAge = this.lastHotAt ? (nowMs - this.lastHotAt) / 1000 : null;
    const tiersRun: ('T1' | 'T2' | 'T3')[] = ['T1'];
    if (this.lastColdAt && nowMs - this.lastColdAt < this.opts.coldIntervalMs * 2) tiersRun.push('T2');
    if (this.pssCache.size > 0) tiersRun.push('T3');

    const provenance = {
      sampler: process.platform === 'win32' ? ('windows-fallback' as const) : ('procfs' as const),
      fidelity: process.platform === 'win32' ? ('reduced' as const) : ('full' as const),
      fidelityNote:
        process.platform === 'win32'
          ? 'Windows path uses cumulative CPU seconds and WorkingSetSize. No PSS, no process groups, no ' +
            'controlling-TTY foreground detection, and RSS-sum double counting is not corrected. Treat ' +
            'these figures as weaker than the Linux ones.'
          : 'Direct /proc reads. CPU is a delta of utime+stime over the sample interval. PSS is per-process ' +
            'from smaps_rollup and is timestamped; it is never read on the hot tick.',
      tiersRun,
      hotIntervalMs: this.opts.hotIntervalBusyMs,
      coldIntervalMs: this.opts.coldIntervalMs,
      coldAgeSec: coldAge,
      scanGapSec: this.opts.hotIntervalBusyMs / 1000,
      hotAgeSec: hotAge,
      samplerOverheadPctOfCore: this.overheadPct,
      samplerOverheadUnit: 'percent of ONE CPU core (100% = one core fully busy with sampling)',
      samplerOverheadSource: this.overheadMeasured ? ('measured' as const) : ('unmeasured' as const),
      lastSampleDurationMs: this.lastHotDurationMs,
      clockTickHz: this.hz,
      hostCpuCount: this.cpuCount,
    };

    /* ---- completeness ---- */
    if (rec.lastProcs.size === 0) missing.push('no processes currently attributed to this workspace');
    if (workspace.pssSumBytes.value === null) missing.push('PSS not yet measured (request on-demand for fresh values)');
    if (workspace.swapBytes.value === null) missing.push('per-process swap not yet measured (requires smaps_rollup)');
    if (workspace.cpuPctOfCore === null) missing.push('CPU rate unavailable on the first sample (no previous delta)');

    return {
      workspaceId: rec.workspaceId,
      deskflowSessionId: rec.deskflowSessionId,
      state: rec.state,
      stateMeaning: WORKSPACE_STATE_MEANING[rec.state],
      identity,
      terminal,
      cli: cli.identity,
      application,
      workspace,
      processes: descendants,
      orphans,
      events,
      history,
      growth,
      findings,
      provenance,
      dataComplete: missing.length === 0,
      missing,
    };
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function findShell(procs: Map<ProcKey, ProcSample>, rec: WorkspaceRecord): ProcSample | null {
  if (rec.shellPid === null) return null;
  for (const p of procs.values()) {
    if (p.identity.pid !== rec.shellPid) continue;
    if (rec.shellStarttime === null || p.identity.starttime === rec.shellStarttime) return p;
  }
  return null;
}

function buildSampleFromStat(
  stat: ProcStatFields,
  prior: CpuPrior | null,
  nowMs: number,
  hz: number
): ProcSample {
  return buildProcSample(stat, prior, nowMs, hz);
}

export { EPOCH_OFFSET, listAllPids };
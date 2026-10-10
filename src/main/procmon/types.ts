/**
 * procmon — schema types
 *
 * DESIGN CONTRACT (read before changing any field):
 *
 * 1. CPU is expressed as PERCENT OF ONE CORE, never percent of the machine.
 *    A workspace with 8 busy threads legitimately reports 800%. The field names
 *    all end in `PctOfCore` so that no consumer can accidentally compare it
 *    against a 0-100 machine-wide figure.
 *
 * 2. Process identity is `${pid}:${starttime}`. PIDs are reused; `starttime`
 *    (jiffies since boot, from /proc/<pid>/stat field 22) is monotonic and is
 *    never reused for a different process. PID alone is NOT an identity.
 *
 * 3. Missing data is `null`, never 0. A null PSS means "not measured"; a 0 PSS
 *    means "measured, and this process has none". Conflating them is how a
 *    monitoring system starts lying. Freshness travels with every expensive
 *    measurement (see `Measured<T>`).
 *
 * 4. Every measurement that is not read from the OS on the hot tick carries a
 *    timestamp and a staleness flag, so an AI can tell live from cached.
 */

export const CPU_UNIT_NOTE =
  'CPU percentages are percent of ONE core. 100% = one fully busy core; a ' +
  'multi-threaded process may legitimately exceed 100%. This is NOT percent of ' +
  'the machine — divide by os.cpus().length for that.';

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Collision-free process identity key: `${pid}:${starttime}`. */
export type ProcKey = string;

export function procKey(pid: number, starttime: number): ProcKey {
  return `${pid}:${starttime}`;
}

export interface ProcIdentity {
  pid: number;
  /** Jiffies since boot. Stable for the life of the process; never reused. */
  starttime: number;
  key: ProcKey;
}

/** Kernel run-state, with the interpretation an AI actually needs. */
export type ProcStateChar = 'R' | 'S' | 'D' | 'Z' | 'T' | 't' | 'W' | 'X' | 'x' | 'K' | 'P' | 'I' | '?' | string;

export const PROC_STATE_MEANING: Record<string, string> = {
  R: 'running or runnable — consuming CPU right now',
  S: 'sleeping interruptibly — idle, waiting for an event',
  D: 'uninterruptible sleep — blocked on I/O; likely filesystem or device stall',
  Z: 'zombie — exited but not reaped; the parent is not calling wait()',
  T: 'stopped by a job-control signal (SIGSTOP)',
  t: 'tracing stop (ptrace)',
  W: 'paging (not used on modern Linux)',
  X: 'dead (should not be visible)',
  x: 'dead (should not be visible)',
  K: 'wakekill',
  P: 'parked',
  I: 'idle (kernel thread, CONFIG_IDLE_TSD)',
};

export function procStateMeaning(state: string): string {
  return PROC_STATE_MEANING[state] || `kernel state '${state}' (see proc(5) for the full state list)`;
}

/**
 * A measurement that is not taken on every tick. `null` value means "never
 * measured"; `stale` means measured but too old to present as current.
 */
export interface Measured<T> {
  value: T | null;
  /** Epoch ms when the value was read from the OS. */
  at: number | null;
  /** Age in ms at payload-build time. Null when `value` is null. */
  ageMs: number | null;
  /** True when too old to present as live. Never silently reported as live. */
  stale: boolean | null;
}

/* ------------------------------------------------------------------ */
/* Per-process sample                                                  */
/* ------------------------------------------------------------------ */

export interface ProcSample {
  identity: ProcIdentity;
  /** Kernel `comm`, truncated to 15 chars by the kernel. Descriptive only. */
  comm: string;
  /**
   * Full argv. DESCRIPTIVE ONLY — never used for attribution. Three processes
   * running the identical CLI have identical comm AND identical cmdline.
   */
  cmdline: string | null;
  /** Real path from /proc/<pid>/exe. Descriptive only; null if unreadable. */
  exe: string | null;
  ppid: number;
  pgrp: number;
  /** POSIX session id. Survives the death of the session leader. */
  session: number;
  /** Controlling tty device number; 0 when the process has none. */
  ttyNr: number;
  /** Foreground process group of the controlling tty. */
  tpgid: number;

  state: ProcStateChar;
  stateMeaning: string;
  /** Resident set size, bytes. Shared pages counted in full for every sharer. */
  rssBytes: number;
  threadCount: number;
  utimeTicks: number;
  stimeTicks: number;

  /* --- derived, rate-based. Null on the first sample (no prior to diff). --- */
  cpuPctOfCore: number | null;
  cpuUserPctOfCore: number | null;
  cpuSysPctOfCore: number | null;
  /** Lifetime CPU seconds (user+sys), a monotonically increasing counter. */
  cpuCumulativeSec: number | null;
  lifetimeSec: number | null;
  /** True when the kernel state was 'D' at sample time. */
  ioStalled: boolean;
  /** True when the kernel state was 'Z'. */
  zombie: boolean;
}

/* ------------------------------------------------------------------ */
/* Workspace lifecycle state                                           */
/* ------------------------------------------------------------------ */

/**
 * - active        shell alive, CLI currently in the foreground
 * - idle          shell alive, no CLI in the foreground (at a prompt)
 * - shell_exited  the PTY shell is gone; surviving processes may still hold resources
 * - orphaned      shell gone AND surviving descendants were re-attributed
 * - unattributed shell gone and survivors exist but could NOT be re-attributed
 * - terminated    nothing survives; the workspace is genuinely over
 */
export type WorkspaceState =
  | 'active'
  | 'idle'
  | 'shell_exited'
  | 'orphaned'
  | 'unattributed'
  | 'terminated';

export const WORKSPACE_STATE_MEANING: Record<WorkspaceState, string> = {
  active: 'PTY shell alive and a CLI/TUI holds the foreground of its terminal',
  idle: 'PTY shell alive, no CLI in the foreground (shell is at a prompt)',
  shell_exited:
    'the PTY shell process is gone; surviving descendants may still hold memory — this is NOT zero usage',
  orphaned:
    'shell gone; surviving processes were re-attributed to this workspace via session/pgrp/pty and are still being charged to it',
  unattributed:
    'shell gone and surviving processes exist but could not be reliably attributed — usage is reported as unknown, not as zero',
  terminated: 'no processes from this workspace survive',
};

/* ------------------------------------------------------------------ */
/* Attribution                                                         */
/* ------------------------------------------------------------------ */

export interface TerminalIdentity {
  /**
   * 'app_pty' for terminals the app created via node-pty/forkpty, 'external'
   * for a terminal the user launched themselves (Konsole, kitty, ...) that the
   * cold census discovered. An app-created PTY has NO emulator process — one
   * is never invented.
   */
  kind: 'app_pty' | 'external' | 'unknown';
  /** e.g. '/dev/pts/10'. Null when the process has no controlling tty. */
  tty: string | null;
  /** Emulator process, only ever populated when one actually exists. */
  emulator: { pid: number; comm: string; exe: string | null } | null;
  emulatorNote: string;
}

export interface WorkspaceIdentity {
  workspaceId: string;
  /** DeskFlow terminal_sessions.id, when known. */
  deskflowSessionId: string | null;
  shell: ProcIdentity | null;
  /** POSIX session id of the PTY. */
  posixSession: number | null;
  pgrp: number | null;
  ttyNr: number | null;
  /**
   * Foreground process group id of the PTY — i.e. whichever program currently
   * owns the terminal. Equal to the shell's own pgrp when the shell has the
   * terminal, which is how "no CLI is running" is detected without looking at
   * any executable name.
   */
  foregroundPgrp: number | null;
  /** True when foregroundPgrp === shell pgrp, i.e. no CLI holds the terminal. */
  shellIsForeground: boolean | null;
}

export interface CliIdentity {
  process: ProcIdentity;
  /** 'foreground-pgrp' — resolved from tty+pgrp, never from the name. */
  resolvedBy: 'foreground-pgrp' | 'foreground-pgrp-descendant' | null;
  confidence: 'high' | 'medium' | 'none';
  /** argv[0]-style display name. Descriptive; NOT the identity. */
  label: string | null;
  note: string;
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface ProcDescendant extends ProcSample {
  /** Depth from the shell; 1 == direct child of the shell. */
  depth: number;
  /**
   * Relationship to the CLI, which is what makes "who is eating the RAM"
   * answerable without the AI reading argv for 14 processes.
   * - 'shell'          the PTY shell
   * - 'cli'            the foreground CLI/TUI itself
   * - 'cli_child'      direct child of the CLI
   * - 'cli_descendant' deeper descendant of the CLI
   * - 'shell_child'    child of the shell that is NOT the CLI
   * - 'survivor'       re-attributed after the shell died (orphan rescue)
   */
  role: 'shell' | 'cli' | 'cli_child' | 'cli_descendant' | 'shell_child' | 'survivor';
  /** How this process is currently attributed; 'ancestry' is the strong one. */
  attribution: 'ancestry' | 'session' | 'pgrp' | 'tty' | 'recorded-identity' | 'none';
  /** Seconds this process has been alive. */
  aliveSec: number | null;
  /** Where the PSS came from, so a stale number is never mistaken for live. */
  pss: Measured<number>;
  /** USS (private memory) — only from smaps_rollup, so on-demand only. */
  uss: Measured<number>;
}

/** The CLI process alone. */
export interface ApplicationTotals {
  process: ProcIdentity | null;
  label: string | null;
  rssBytes: number | null;
  pssBytes: Measured<number>;
  swapBytes: Measured<number>;
  cpuPctOfCore: number | null;
  cpuUserPctOfCore: number | null;
  cpuSysPctOfCore: number | null;
  cpuCumulativeSec: number | null;
  threadCount: number | null;
  aliveSec: number | null;
  state: ProcStateChar | null;
  stateMeaning: string | null;
}

/** CLI plus every attributed descendant. */
export interface WorkspaceTotals {
  processCount: number;
  threadCount: number;
  /** Sum of per-process RSS. Overstates when pages are shared. */
  rssSumBytes: number;
  /**
   * Sum of per-process PSS. Additive-correct: shared pages are divided among
   * sharers by the kernel, so this equals what freeing the tree would return.
   * This is the primary memory attribution when fresh.
   */
  pssSumBytes: Measured<number>;
  /** rssSumBytes - pssSumBytes, i.e. the phantom portion. */
  rssOverstatementBytes: number | null;
  swapBytes: Measured<number>;
  cpuPctOfCore: number | null;
  cpuUserPctOfCore: number | null;
  cpuSysPctOfCore: number | null;
  /** Share of one core used; 16 cores fully busy == 1600. */
  cpuShareOfMachinePct: number | null;
  /** Processes observed in D state — filesystem/device stall. */
  ioStalledCount: number;
  zombieCount: number;
  /** Oldest surviving process's age, seconds. */
  oldestProcessAgeSec: number | null;
}

/* ------------------------------------------------------------------ */
/* Process create/exit events (observable ones only)                   */
/* ------------------------------------------------------------------ */

export interface ProcEventCounts {
  /** New descendants observed since the previous sample. */
  appeared: number;
  /** Descendants gone since the previous sample. */
  disappeared: number;
  /** appeared / disappeared over the trailing 60 s window. */
  appearedPerMin: number;
  disappearedPerMin: number;
  /** Appended identities for auditing; bounded. */
  recentAppeared: ProcIdentity[];
  recentDisappeared: ProcIdentity[];
  /**
   * Explicit caveat. A process that lives entirely between two samples is
   * never observed, so these counts UNDERCOUNT by design.
   */
  note: string;
}

export const PROC_EVENT_CAVEAT =
  'Counts are observed-between-samples, not exhaustive. A process whose whole ' +
  'lifetime falls between two samples is never seen; catching it would need ' +
  'eBPF or audit, which this sampler deliberately does not use.';

/* ------------------------------------------------------------------ */
/* History + growth                                                    */
/* ------------------------------------------------------------------ */

export type GrowthVerdict =
  | 'stable'
  | 'slow_growth'
  | 'rapid_growth'
  | 'decreasing'
  | 'insufficient_data';

export const GROWTH_VERDICT_MEANING: Record<GrowthVerdict, string> = {
  stable: 'no sustained upward trend across the observation window',
  slow_growth: 'monotonic upward trend, but below the rapid-growth threshold',
  rapid_growth: 'steep monotonic upward trend — consistent with a leak or unbounded accumulation; NOT a proof of one',
  decreasing: 'values trending down across the observation window',
  insufficient_data: 'too few valid samples in the window to judge a trend',
};

export interface HistorySeries {
  /** Most recent last. Downsampled; length varies by age. */
  samples: { ts: number; rssMb: number; pssMb: number | null; cpuPct: number | null; swapMb: number | null; procCount: number; threadCount: number }[];
  sampleCount: number;
  /** Seconds actually covered by the samples above. */
  windowSec: number;
  /** True when sampling gaps exceeded the configured interval. */
  hasGaps: boolean;
  note: string;
}

export interface GrowthAnalysis {
  verdict: GrowthVerdict;
  verdictMeaning: string;
  /** Slope over the observation window, MB/min, signed. */
  rateMbPerMin: number | null;
  /** Window the slope was computed over, seconds. */
  observationWindowSec: number;
  /** The numbers the verdict was derived from, so it can be audited. */
  evidence: {
    firstMb: number | null;
    lastMb: number | null;
    minMb: number | null;
    maxMb: number | null;
    peakMb: number | null;
    meanMb: number | null;
    monotonicIncrease: boolean | null;
    validSamples: number;
  };
  /** Never a bare boolean; the AI decides whether the pattern is suspicious. */
  note: string;
}

/* ------------------------------------------------------------------ */
/* Findings                                                            */
/* ------------------------------------------------------------------ */

export type FindingSeverity = 'critical' | 'warning' | 'info';

export interface Finding {
  code: string;
  severity: FindingSeverity;
  evidence: string;
  whyItMatters: string;
  nextProbe: string;
}

/* ------------------------------------------------------------------ */
/* Provenance                                                          */
/* ------------------------------------------------------------------ */

export interface Provenance {
  sampler: 'procfs' | 'windows-fallback' | 'unavailable';
  /** 'app_pty' telemetry is Linux-correct; the fallback is weaker. */
  fidelity: 'full' | 'reduced';
  fidelityNote: string;
  /** Tiers that contributed to this payload. */
  tiersRun: ('T1' | 'T2' | 'T3')[];
  /** Interval of the most recent hot sample, ms. */
  hotIntervalMs: number | null;
  /** Interval of the cold census, ms. */
  coldIntervalMs: number | null;
  /** Age of the newest cold full census, seconds. */
  coldAgeSec: number | null;
  /**
   * Blind window for processes that start and exit between samples. An AI must
   * not claim "no git process" on the strength of this data.
   */
  scanGapSec: number;
  /** Age of the hot tree walk, seconds. */
  hotAgeSec: number | null;
  /** Measured cost of this sampler, percent of ONE core. */
  samplerOverheadPctOfCore: number | null;
  samplerOverheadUnit: string;
  /** Where the overhead figure came from — measured, or not yet measured. */
  samplerOverheadSource: 'measured' | 'unmeasured' | 'estimated';
  /** ms the most recent hot sample took to build. */
  lastSampleDurationMs: number | null;
  clockTickHz: number;
  hostCpuCount: number;
}

/* ------------------------------------------------------------------ */
/* Top-level payload                                                   */
/* ------------------------------------------------------------------ */

export interface WorkspaceTelemetry {
  workspaceId: string;
  deskflowSessionId: string | null;
  state: WorkspaceState;
  stateMeaning: string;
  identity: WorkspaceIdentity;
  terminal: TerminalIdentity;
  cli: CliIdentity | null;
  application: ApplicationTotals;
  workspace: WorkspaceTotals;
  /** Every attributed process, not collapsed into one number. */
  processes: ProcDescendant[];
  orphans: ProcDescendant[];
  events: ProcEventCounts;
  history: HistorySeries;
  growth: GrowthAnalysis;
  findings: Finding[];
  provenance: Provenance;
  /** True when a CPU or memory figure is null because it was not measurable. */
  dataComplete: boolean;
  missing: string[];
}

/* ------------------------------------------------------------------ */
/* System-level (host) context, shared by every workspace             */
/* ------------------------------------------------------------------ */

export interface SystemContext {
  cpuPctOfCore: number | null;
  cpuUnit: string;
  cpuCount: number;
  loadAvg1m: number | null;
  memTotalBytes: number;
  memAvailableBytes: number;
  memUsedBytes: number;
  memUsedPct: number;
  swapTotalBytes: number;
  swapFreeBytes: number;
  swapUsedBytes: number;
  swapUsedPct: number;
  shmemBytes: number | null;
  pageCacheBytes: number | null;
  readAt: number;
  note: string;
}

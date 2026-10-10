/**
 * procmon — diagnostic findings
 *
 * A finding is only emitted when the evidence is actually present in the
 * sample. Each one carries `evidence` (the numbers that triggered it) so an AI
 * can audit the conclusion rather than trusting it, and `nextProbe` so it knows
 * what to look at next. Findings are advisory; the numbers are authoritative.
 */

import type { Finding, ProcDescendant, WorkspaceState } from './types';

const MB = 1024 * 1024;
import type { SystemContext } from './types';

export interface FindingInput {
  state: WorkspaceState;
  cliRunning: boolean;
  applicationRssMb: number | null;
  workspacePssMb: number | null;
  workspaceRssSumMb: number | null;
  workspaceCpuPctOfCore: number | null;
  appCpuPctOfCore: number | null;
  processes: ProcDescendant[];
  orphans: ProcDescendant[];
  pssStale: boolean | null;
  pssAgeSec: number | null;
  growthVerdict: string;
  growthRateMbPerMin: number | null;
  growthWindowSec: number;
  system: SystemContext | null;
  scanGapSec: number;
}

/** A child using more than this share of the workspace total is "the culprit". */
const CHILD_DOMINANCE = 0.5;

export function buildFindings(input: FindingInput): Finding[] {
  const out: Finding[] = [];

  /* --- host swap pressure ------------------------------------------- */
  const sys = input.system;
  if (sys && sys.swapTotalBytes > 0) {
    if (sys.swapUsedPct >= 95) {
      out.push({
        code: 'SWAP_SATURATED',
        severity: 'critical',
        evidence: `system swap ${sys.swapUsedPct.toFixed(1)}% used (${mb(sys.swapUsedBytes)} of ${mb(sys.swapTotalBytes)} MB); MemAvailable ${mb(sys.memAvailableBytes)} MB of ${mb(sys.memTotalBytes)} MB`,
        whyItMatters:
          'Anonymous pages are being paged out. Memory pressure will show up as sudden allocation failures and OOM kills even while MemAvailable looks acceptable.',
        nextProbe: 'workspace.workspace.swapBytes — which process in THIS workspace is swapped',
      });
    } else if (sys.swapUsedPct >= 50) {
      out.push({
        code: 'SWAP_PRESSURE',
        severity: 'warning',
        evidence: `system swap ${sys.swapUsedPct.toFixed(1)}% used (${mb(sys.swapUsedBytes)} MB); MemAvailable ${mb(sys.memAvailableBytes)} MB`,
        whyItMatters: 'Sustained swap use slows every memory-touching access and precedes OOM kills.',
        nextProbe: 'host swap over time, and which workspace is holding the largest swapped footprint',
      });
    }
  }

  /* --- memory growth ------------------------------------------------ */
  if (input.growthVerdict === 'rapid_growth') {
    out.push({
      code: 'RAPID_MEMORY_GROWTH',
      severity: 'warning',
      evidence: `memory trend ${input.growthRateMbPerMin !== null ? input.growthRateMbPerMin.toFixed(1) : '?'} MB/min over ${Math.round(input.growthWindowSec)}s`,
      whyItMatters:
        'Sustained one-way growth is consistent with a leak or unbounded in-memory accumulation. It is not proof of one — check whether the process count also grew.',
      nextProbe: 'workspace.growth.evidence and workspace.processes — is the growth in one process or all of them',
    });
  } else if (input.growthVerdict === 'slow_growth') {
    out.push({
      code: 'SLOW_MEMORY_GROWTH',
      severity: 'info',
      evidence: `memory trend ${input.growthRateMbPerMin !== null ? input.growthRateMbPerMin.toFixed(1) : '?'} MB/min over ${Math.round(input.growthWindowSec)}s`,
      whyItMatters: 'A slow climb that persists across a session becomes a large climb across a day.',
      nextProbe: 'workspace.history — confirm the slope is sustained rather than allocator noise',
    });
  }

  /* --- CPU attribution --------------------------------------------- */
  const wsCpu = input.workspaceCpuPctOfCore;
  const appCpu = input.appCpuPctOfCore;
  if (wsCpu !== null && wsCpu > 20) {
    const children = input.processes.filter((p) => p.role === 'cli_child' || p.role === 'cli_descendant' || p.role === 'shell_child');
    let childCpu = 0;
    for (const c of children) childCpu += c.cpuPctOfCore ?? 0;
    if (childCpu > wsCpu * 0.5 && childCpu > 5) {
      const top = [...children]
        .filter((c) => (c.cpuPctOfCore ?? 0) > 0)
        .sort((a, b) => (b.cpuPctOfCore ?? 0) - (a.cpuPctOfCore ?? 0))[0];
      out.push({
        code: 'CPU_IN_CHILD',
        severity: 'info',
        evidence:
          `workspace CPU ${wsCpu.toFixed(1)}% of one core; the CLI itself ${appCpu !== null ? appCpu.toFixed(1) : '?'}%, ` +
          `children ${childCpu.toFixed(1)}%` +
          (top ? `; largest is pid ${top.identity.pid} (${top.comm}) at ${(top.cpuPctOfCore ?? 0).toFixed(1)}%` : ''),
        whyItMatters:
          'The CLI is not the CPU bottleneck — a child process is. Attributing this to the CLI would send an investigation down the wrong path.',
        nextProbe: `workspace.processes — inspect pid ${top ? top.identity.pid : '?'} cmdline and its own children`,
      });
    }
  }

  /* --- memory attribution: one child dominating --------------------- */
  if (input.workspaceRssSumMb !== null && input.workspaceRssSumMb > 200) {
    const children = input.processes.filter((p) => p.role === 'cli_child' || p.role === 'cli_descendant');
    let childRss = 0;
    for (const c of children) childRss += c.rssBytes;
    if (childRss > input.workspaceRssSumMb * CHILD_DOMINANCE) {
      const top = [...children].sort((a, b) => b.rssBytes - a.rssBytes)[0];
      out.push({
        code: 'MEMORY_IN_CHILD',
        severity: 'info',
        evidence:
          `workspace RSS ${mb(input.workspaceRssSumMb)} MB, of which ${mb(childRss / MB)} MB ` +
          `(${((childRss / MB / input.workspaceRssSumMb) * 100).toFixed(0)}%) is in child processes` +
          (top ? `; largest is pid ${top.identity.pid} (${top.comm}) at ${mb(top.rssBytes / MB)} MB` : ''),
        whyItMatters:
          'The CLI process is not the memory consumer. Killing or tuning the CLI will not reclaim most of this footprint.',
        nextProbe: 'workspace.processes[].cmdline — identify what the large child actually is',
      });
    }
  }

  /* --- orphans ------------------------------------------------------ */
  if (input.state === 'orphaned' && input.orphans.length > 0) {
    let bytes = 0;
    for (const o of input.orphans) bytes += o.rssBytes;
    out.push({
      code: 'ORPHANS_SURVIVING',
      severity: 'warning',
      evidence: `shell exited; ${input.orphans.length} process(es) re-attributed to this workspace still hold ${mb(bytes)} MB RSS`,
      whyItMatters:
        'These processes keep running and keep holding memory after the terminal is logically gone. Closing the tab does NOT free this.',
      nextProbe: 'workspace.orphans[].cmdline — decide whether to terminate them',
    });
  } else if (input.state === 'unattributed') {
    out.push({
      code: 'UNATTRIBUTED_SURVIVORS',
      severity: 'warning',
      evidence: 'shell exited and surviving processes exist but could not be attributed to this workspace',
      whyItMatters:
        'Their memory is NOT counted here, so workspace totals under-report. Do not conclude this workspace is free.',
      nextProbe: 'the process list directly — look for processes whose session or pgrp matches the old shell',
    });
  }

  /* --- blocked / zombie --------------------------------------------- */
  const stalled = input.processes.filter((p) => p.ioStalled);
  if (stalled.length > 0) {
    out.push({
      code: 'IO_STALLED',
      severity: 'warning',
      evidence: `${stalled.length} process(es) in uninterruptible sleep (state D): ${stalled.slice(0, 3).map((p) => `pid ${p.identity.pid} ${p.comm}`).join(', ')}`,
      whyItMatters:
        'State D means blocked in the kernel on I/O — a slow or full filesystem, not CPU starvation. Waiting for CPU time will never clear it.',
      nextProbe: 'on-demand I/O counters for those pids; then check filesystem capacity and mount health',
    });
  }
  const zombies = input.processes.filter((p) => p.zombie);
  if (zombies.length > 0) {
    out.push({
      code: 'ZOMBIE_PROCESS',
      severity: zombies.length > 3 ? 'warning' : 'info',
      evidence: `${zombies.length} zombie process(es): ${zombies.slice(0, 3).map((p) => `pid ${p.identity.pid}`).join(', ')}`,
      whyItMatters:
        'Zombies consume a PID slot and an entry in the parent process table until the parent calls wait(). A rising count means something upstream is not reaping.',
      nextProbe: 'the parent pids of those zombies',
    });
  }

  /* --- thread count -------------------------------------------------- */
  let threads = 0;
  for (const p of input.processes) threads += p.threadCount;
  if (threads > 400) {
    out.push({
      code: 'HIGH_THREAD_COUNT',
      severity: 'info',
      evidence: `workspace holds ${threads} threads across ${input.processes.length} processes`,
      whyItMatters:
        'High thread counts carry per-thread stack and kernel bookkeeping cost, and make context switching more expensive. A steadily climbing count is a leak signature.',
      nextProbe: 'workspace.processes[].threadCount over time, and on-demand per-thread CPU',
    });
  }

  /* --- no CLI running ------------------------------------------------ */
  if (!input.cliRunning && input.state === 'idle') {
    out.push({
      code: 'NO_CLI_FOREGROUND',
      severity: 'info',
      evidence: 'the PTY shell owns the foreground of its terminal; no CLI process is running',
      whyItMatters:
        'Resources attributed to the application are currently zero because no CLI is running, not because telemetry is broken.',
      nextProbe: 'workspace.identity.foregroundPgrp vs shell pgrp',
    });
  }

  /* --- freshness ------------------------------------------------------ */
  if (input.pssStale === true) {
    out.push({
      code: 'PSS_STALE',
      severity: 'info',
      evidence: `PSS is ${input.pssAgeSec !== null ? input.pssAgeSec.toFixed(0) : '?'}s old; the workspace PSS figure is cached, not live`,
      whyItMatters:
        'Treat workspace PSS as a recent estimate, not a current measurement. RSS in the same payload IS live.',
      nextProbe: 'request an on-demand PSS refresh for this workspace',
    });
  }

  /* --- sampling blind spot -------------------------------------------- */
  if (input.scanGapSec >= 2) {
    out.push({
      code: 'SHORT_LIVED_BLIND_SPOT',
      severity: 'info',
      evidence: `hot sampling interval is ${input.scanGapSec}s; a process living under ~${input.scanGapSec}s can be missed entirely`,
      whyItMatters:
        'Absence of evidence here is not evidence of absence. A git invocation that ran and finished between samples will not appear anywhere.',
      nextProbe: 'the terminal transcript, or an event-level tool (out of scope for this sampler)',
    });
  }

  return out;
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}
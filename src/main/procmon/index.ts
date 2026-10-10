/**
 * procmon — public surface
 *
 * Linux terminal/process observability for the Terminal Workspace.
 *
 * See agent/docs/terminal-workspace-monitoring-implementation-spec.md
 * and agent/docs/terminal-workspace-resource-monitoring-AUDIT.md
 *
 * Integration notes for main.ts:
 *   - `ProcessMonitor.registerWorkspace()` must be called from the PTY spawn
 *     path with the shell pid node-pty returned.
 *   - `onTelemetry()` fires once per hot tick with the full payload list.
 *   - `configureRollupStore()` wires the single-writer DB writer.
 *   - The legacy `terminal:resource-stats` payload is built from
 *     `toLegacyStats()` so existing UI consumers keep working.
 */

export * from './types';
export * from './procfs';
export * from './history';
export * from './findings';
export * from './sampler';

import { ProcessMonitor } from './sampler';
import { configureRollupStore } from './history';

/**
 * Legacy `terminal:resource-stats` shape.
 *
 * KEPT EXACTLY AS BEFORE for backward compatibility, because two UI components
 * depend on it (PerformanceMetricsPanel.tsx, TerminalPage.tsx
 * SessionResourceStats). The one intentional correction is `memMB`: it was
 * always documented as "RAM" but was actually an RSS sum over the tree. It is
 * unchanged in value, and the new payload adds the PSS-derived primary number
 * alongside it, so nothing that reads the old field gets a surprise.
 */
export interface LegacyResourceStats {
  pid: number | null;
  alive: boolean;
  /** RSS sum over the process tree, MB. Overstates shared pages. */
  memMB: number;
  /** Sum of per-process PSS over the tree, MB. Prefer this. */
  pssMB: number | null;
  /** Per-process swap over the tree, MB. */
  swapMB: number | null;
  /** percent of ONE core, a true inter-sample rate. */
  cpuPct: number;
  cpuUserPct: number | null;
  cpuSysPct: number | null;
  processCount: number;
  threadCount: number;
  state: string;
  eventLoopLagMs: number;
  ts: number;
}

const MB = 1024 * 1024;

export function toLegacyStats(
  telemetry: ReturnType<ProcessMonitor['buildTelemetry']>,
  eventLoopLagMs: number
): LegacyResourceStats | null {
  if (!telemetry) return null;
  const shellPid = telemetry.identity.shell?.pid ?? null;
  return {
    pid: shellPid,
    // NOT the same as `state === 'terminated'`: a workspace whose shell died but
    // whose descendants survive is still very much alive, and the old code
    // reported that as dead+0MB.
    alive: telemetry.state !== 'terminated',
    memMB: Math.round((telemetry.workspace.rssSumBytes / MB) * 10) / 10,
    pssMB: telemetry.workspace.pssSumBytes.value !== null
      ? Math.round((telemetry.workspace.pssSumBytes.value / MB) * 10) / 10
      : null,
    swapMB: telemetry.workspace.swapBytes.value !== null
      ? Math.round((telemetry.workspace.swapBytes.value / MB) * 10) / 10
      : null,
    cpuPct: telemetry.workspace.cpuPctOfCore !== null ? Math.round(telemetry.workspace.cpuPctOfCore * 10) / 10 : 0,
    cpuUserPct: telemetry.workspace.cpuUserPctOfCore !== null ? Math.round(telemetry.workspace.cpuUserPctOfCore * 10) / 10 : null,
    cpuSysPct: telemetry.workspace.cpuSysPctOfCore !== null ? Math.round(telemetry.workspace.cpuSysPctOfCore * 10) / 10 : null,
    processCount: telemetry.workspace.processCount,
    threadCount: telemetry.workspace.threadCount,
    state: telemetry.state,
    eventLoopLagMs,
    ts: Date.now(),
  };
}

export { configureRollupStore };

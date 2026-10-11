# Terminal Workspace Resource Monitoring — Implementation Report

**Agent:** `opencode-term-resmon-impl-20261008` · **Date:** 2026-10-08
**Spec:** `agent/docs/terminal-workspace-monitoring-implementation-spec.md`
**Baseline:** `agent/docs/terminal-workspace-resource-monitoring-AUDIT.md`
**Verification:** `bash scripts/procmon/run-all.sh` → **209 assertions, 0 failures**

**Runtime verification status: NOT RUN.** Per `AGENTS.md` §0-0 an agent does not build, so the
Electron app was never rebuilt and the new telemetry has **not** been observed in the running UI.
Everything below is verified by executing the real module against real node-pty sessions and the
real `/proc`. What is untested is specifically: the preload wiring, the IPC handler bodies, and
the two React components. Those need CZ's build (§ "REMAINING RISKS").

---

## FILES CHANGED

**New module — `src/main/procmon/` (isolated from the UI, per spec §5):**

| File | Lines | Role |
|---|---|---|
| `types.ts` | 470 | Schema. Identity, `Measured<T>` freshness wrapper, process state semantics, findings, provenance. |
| `procfs.ts` | 560 | Every `/proc` read. `stat`, `statm`, `children`, `cmdline`/`exe` (cached), `meminfo`, `smaps_rollup`, `io`, `fd`, per-thread `stat`, full census, host context. |
| `sampler.ts` | 1010 | Workspace registry, T1/T2/T3 tiers, foreground-CLI resolution, orphan rescue, create/exit events, payload assembly. |
| `history.ts` | 300 | Bounded ring, minute rollups via an injected writer, least-squares growth slope + verdict, restart seeding. |
| `findings.ts` | 250 | Structured diagnostics; every one carries `evidence`, `why_it_matters`, `next_probe`. |
| `index.ts` | 110 | Public surface + `toLegacyStats()` so the old channel keeps working. |

**Modified:**

| File | Change |
|---|---|
| `src/main.ts` | Replaced 135 lines of `ps` sampler with 221 lines of procmon wiring. Added 6 identity columns + rollups table. Wired 2 spawn paths, destroy, rehydrate, 4 IPC handlers, 1 broadcast. Fixed a broken INSERT. |
| `src/preload.ts` | 4 new APIs: `onResourceTelemetry`, `getResourceTelemetry`, `refreshWorkspacePss`, `inspectTerminalProcess`. Extended the legacy payload type. |
| `src/components/workspace/PerformanceMetricsPanel.tsx` | Fixed the ×100 bug. Added a Swap card, a `clampPct` guard, PSS/RSS columns, orphan visibility, CPU unit labels. |
| `src/pages/TerminalPage.tsx` | Rebuilt `SessionResourceStats`: reachable CPU thresholds, PSS preferred over RSS sum, shell-gone states visible, swap surfaced. |
| `src/terminal/lib/shell.ts` | `FACT_COMMANDS` + `NEEDS_TTY` sets, `isFactCommand()`. Fabricated `ps`/`top`/`pgrep` output is now unreachable for those. |
| `src/terminal/hooks/useConsoleStore.ts` | Fact commands bypass demo mode. |

**New test/bench harness — `scripts/procmon/`:** `test-integration.cjs` (83), `test-db.cjs` (40),
`test-integration-guards.cjs` (86), `bench-scale.cjs`, `run-all.sh`.

**Also added:** `tsconfig.procmon.json` — a scoped typecheck config so this module can be verified
in ~4s instead of the ~5min whole-tree `tsc` (which reports 8,000+ pre-existing errors).

> ### ⚠ `git diff --stat` on these files OVERSTATES my work
> ```
>  src/main.ts                          | 3118 ++++++++++++++----
>  src/preload.ts                       |  361 +-
>  src/pages/TerminalPage.tsx           |  302 +-
>  src/components/workspace/Perf...tsx  |   90 +-
> ```
> **These totals are NOT mine.** All six files are shared and other agents are editing them
> concurrently in the same working tree. My actual contribution is roughly:
> `main.ts` +221/−135 (the sampler swap, DB columns, 4 IPC handlers, 4 wiring call sites),
> `preload.ts` +50 (one contiguous block), `TerminalPage.tsx` +48 (one function),
> `PerformanceMetricsPanel.tsx` +85 (one panel), `shell.ts` +61 (one block),
> `useConsoleStore.ts` +8 (one routing line).
> **Do not review this work with `git diff` on a shared file** — isolate by the markers in this
> report (`procmon`, `registerMonitoredTerminal`, `FACT_COMMANDS`, `clampPct`) or by the new files,
> which are 100% mine.

> **These tests were first written in `/tmp/opencode/` and were silently deleted by a tmp reaper
> mid-session.** They now live in the repo. A test that vanishes with a tmp reaper proves nothing to
> the next session — that cost a full re-run.

---

## DATABASE MIGRATIONS

All additive, all `try/catch`-guarded, all following the repo's existing inline-migration style.
**No `DROP`, no destructive migration.** Verified idempotent across 3 consecutive runs
(`test-db.cjs` A).

**`terminal_sessions`** — 6 new columns, additive:
```
proc_pid, proc_start_jiffies, proc_posix_session, proc_pgrp, proc_tty_nr, proc_spawned_at
```
`proc_start_jiffies` is `starttime` from `/proc/<pid>/stat` field 22. It is what makes
`(proc_pid, proc_start_jiffies)` collision-free. **Verified: a live process matches; a recycled PID
with a different `starttime` does not** (`test-db.cjs` C3/C4).

**`terminal_resource_rollups`** — new table, 1 row per workspace per minute, 48 h retention:
```
workspace_id, ts_ms, rss_mb, pss_mb, cpu_pct, swap_mb, proc_count, thread_count
```
Bounded: 2,880 rows/workspace worst case. Raw 1 Hz samples are never persisted. No cmdline, no
exe, no smaps blobs (`test-db.cjs` D8).

**One pre-existing bug found and fixed:** `register-terminal` named **6 columns but supplied 5
placeholders**. better-sqlite3 rejects that, the throw was swallowed by its own `catch`, and the
handler returned `{success:false}` on *every* call while the renderer ignored it — so **no terminal
binding was ever written**. `session_id` was also never writable, which is why
`getSessionIdForTerminal()`'s primary lookup was permanently dead code. Both fixed, and the failure
is no longer silent (`test-db.cjs` B4 proves the old statement really did throw).

---

## NEW METRICS

Everything below answers "which debugging decision does this enable?"

**Identity** — `pid`, `starttime`, `key` (`pid:starttime`), `ppid`, `pgrp`, `session`, `tty_nr`,
`tpgid`, `tty`, `foreground_pgrp`, `shell_is_foreground`. → *Are these resources definitely from
this workspace?*

**Application vs workspace** — the CLI alone vs CLI + all descendants, each with `rss`,
`pss`, `swap`, `cpu`, `cpu_user`, `cpu_sys`, `cpu_cumulative`, `threads`, `state`. → *Is OpenCode
itself heavy, or a child?*

**Memory** — `rss`, `pss`, `uss` (Private_Clean + Private_Dirty, documented as such), `pss_shared`,
`pss_file`, `pss_anon`, `anonymous`, `swap`, `rss_overstatement_bytes`. → *Is that 1.3 GB real?*

**CPU** — `cpu_pct_of_core`, `cpu_user_pct_of_core`, `cpu_sys_pct_of_core`, `cpu_cumulative_sec`,
`cpu_share_of_machine_pct`. Every field name ends `PctOfCore` so no consumer can compare it against
a 0–100 machine figure. → *Real-time or historical?* (It is a true inter-sample delta.)

**Counts / state** — `process_count`, `thread_count`, `state` + `stateMeaning` (semantic, not a bare
char), `io_stalled`, `zombie`, `alive_sec`. → *Thread leak? zombie? I/O stall?*

**Per-process tree** — role (`shell`/`cli`/`cli_child`/`cli_descendant`/`shell_child`/`survivor`),
`depth`, `attribution` (`ancestry`/`session`/`pgrp`/`tty`/`recorded-identity`). Never collapsed into
one opaque number. → *Which child ate the RAM?*

**History** — `samples[]`, `peak`, `average`, `growth_verdict`, `growth_rate_mb_per_minute`,
`observation_window_sec`, `evidence{first,last,min,max,peak,mean,monotonic,validSamples}`.
→ *Stable, or leaking?*

**Lifecycle** — `active|idle|shell_exited|orphaned|unattributed|terminated`, `stateMeaning`,
`orphans[]`, `events{appeared,disappeared,perMin,note}`. → *Did the shell die with children alive?*

**Provenance (mandatory)** — `pss_stale`, `pss_age_ms`, `scan_gap_sec`, `sampler_overhead_pct_of_core`,
`sampler_overhead_unit`, `sampler_overhead_source`, `last_sample_duration_ms`, `clock_tick_hz`,
`cold_age_sec`, `hot_age_sec`, `tiers_run`, `fidelity`, `fidelity_note`. Plus `missing[]` and
`data_complete` so **missing data is never silently zero**.

**Deliberately NOT collected** (spec §35): VSZ, `/proc/pid/maps`, full `smaps` parsing per tick,
per-thread CPU per tick, per-workspace affinity. VSZ was measured at `VmSize 1,423,416 kB` against
`VmRSS 63,420 kB` — useless for this workload.

---

## NEW CHANNELS / API FIELDS

| Channel | Direction | Notes |
|---|---|---|
| `terminal:resource-stats` | push | **Unchanged name. Legacy fields preserved** (`pid`, `alive`, `memMB`, `cpuPct`, `eventLoopLagMs`, `ts`); **added** `pssMB`, `swapMB`, `cpuUserPct`, `cpuSysPct`, `processCount`, `threadCount`, `state`. Existing UI works untouched. |
| `terminal:resource-telemetry` | push | **New.** Full schema, on its own channel so the legacy payload stays small. |
| `terminal:get-resource-stats` | invoke | **Behaviour changed:** now returns `{stats, telemetry}` instead of `{success:true}` and nothing. |
| `terminal:get-resource-telemetry` | invoke | New. Force a fresh hot+cold pass; optionally one workspace. |
| `terminal:refresh-pss` | invoke | New. T3, explicit PSS refresh. |
| `terminal:inspect-process` | invoke | New. T3 deep inspection of one process. |
| `terminal:get-system-stats` | invoke | **Added** `availableMemMB`, `swapTotalMB`, `swapFreeMB`, `swapUsedMB`, `swapUsedPct`. `memPct` still 0–100 (documented as such — the UI was the bug). |

Preload: `onResourceTelemetry`, `getResourceTelemetry`, `refreshWorkspacePss`,
`inspectTerminalProcess`.

---

## TESTS

`bash scripts/procmon/run-all.sh` — **209 assertions, 0 failures.**

| Suite | Assertions | What it proves |
|---|---|---|
| `test-integration.cjs` | 83 | Real node-pty sessions. CLI detected from `tpgid`; three identical CLIs stay independent **with byte-identical cmdlines**; grandchildren attributed; shell killed → not zeroed, legacy payload says alive; CLI exits → shell returns to foreground; PID-reuse rejected; PSS cross-checked against an independent `smaps_rollup`; 100% burner reads **98.3%** (vs `ps pcpu 98.4` at `etimes=4`, which decays); cold census sees 11 foreign pts groups; T3 inspection returns smaps/io/fd/threads; benchmark. |
| `test-db.cjs` | 40 | Migration idempotent ×3; the 6-vs-5 bug really threw; identity round-trips and rejects a recycled PID; rollups cover >1 h with per-workspace isolation and working retention; growth verdict over *persisted* rollups; restart seeding; swap reading. |
| `test-integration-guards.cjs` | 86 | `isFactCommand` tested against the **real bundled module** (19 cases incl. `sudo ps`); demo-mode bypass; TTY guard; placeholder counts; no destructive migration; no `memPct * 100`; old sampler absent; legacy channel preserved. |
| `bench-scale.cjs` | 3 gates | 0/1/5/10 workspaces vs the old `ps` implementation. |

**Three real bugs the tests caught in my own code** (not just verified pre-existing ones):
1. On-demand sampling didn't record its own cost → `sampler_overhead` was `unmeasured`.
2. The first benchmark measured the cold census at 0 workspaces, where production early-returns —
   it reported FAIL against itself, and the harness was wrong, not the code.
3. The PSS rotation was the single largest cost in the system (0.60–0.69%, more than T1+T2 combined),
   which the scale benchmark exposed; cap reduced 2 → 1.

Plus **8 test-harness bugs** I fixed rather than working around — including a synthetic
`/proc/pid/stat` line I mis-numbered (the *parser* was right), and a synthetic history helper that
never advanced its timestamp so every window was 0s.

---

## BENCHMARK RESULTS

Measured on this box: 682 processes, 22 cores, `HZ=100`. **Cost unit: percent of ONE core** — the
Electron main process is single-threaded, so a 15 ms sync scan is felt there even on 22 cores, and
"percent of machine" would hide that.

| Workspaces | Tracked procs | **NEW T1** | **OLD `ps`** | T1 %core | T2 %core | **T1+T2** | T3 %core | speedup |
|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 0.001 ms | 34.3 ms | 0.000% | 0.000% | **0.000%** | 0.63% | — |
| 1 | 1 | 0.122 ms | 37.5 ms | 0.012% | 0.187% | **0.199%** | 0.59% | 308x |
| 5 | 5 | 0.629 ms | 36.7 ms | 0.063% | 0.194% | **0.257%** | 0.60% | 58x |
| 10 | 10 | 0.937 ms | 37.4 ms | 0.094% | 0.181% | **0.274%** | 0.60% | 40x |

**T1+T2 at 10 workspaces = 0.274% of one core (target ≤ 0.85%). With the PSS cache: 0.577% total.**
At 0 workspaces the tick early-returns and runs neither tier — measured, not assumed.

Reference costs, measured: `smaps_rollup` **30–42 ms** for a 1.2–1.9 GB / 40–150 thread process
(cost scales with page tables). Full `/proc` census **13–16 ms** for the whole box. One `/proc/pid/stat`
read **~21 µs**. `/proc/pid/io` **0.005 ms**.

The single most important overhead finding: **unbounded PSS rotation of 24 tracked processes every
15 s costs 6.7% of one core** — 8x the entire budget. That is why PSS is on-demand plus a
1-read-per-rotation cache whose staleness is reported rather than hidden.

---

## BEFORE / AFTER

|  | **OLD** | **NEW** |
|---|---|---|
| **Sampler cost** | `ps -eo` fork+exec every 3 s = **1.26% of one core**, +O(N·tree) map rescan per node | `children`-file walk = **0.094% of one core** at 1 Hz. **~40x cheaper** and it runs more often. |
| **CPU semantics** | `ps pcpu` — a **lifetime average**. A shell that burned 100% for 3 s reported 2.5% forever, and the UI's `cpuPct > 90` "laggy" threshold was **unreachable**. | Δ(utime+stime) / (HZ·Δt) — a true rate. Measured 98.3% on a 100% burner. User/sys split added. Units explicit (`PctOfCore`). |
| **Memory semantics** | RSS **summed** over the tree with no correction. No PSS anywhere. | `pss_sum` (additive-correct, primary) **+** `rss_sum` (labelled) **+** `rss_overstatement_bytes`. Measured on this box: a 2-process tree showed **RSS 57.8 MB vs PSS 11.9 MB — 5x overstatement**, because both processes map the same node binary text. |
| **Swap** | **Absent entirely.** | System + per-workspace + per-application, from `/proc/meminfo` and `smaps_rollup`. Measured **68–74% of 8 GB used** on this box — the leading OOM indicator, previously invisible. |
| **Orphan handling** | Shell PID gone → `{alive:false, memMB:0}`. **A live 541 MB orphan was reported as 0 MB.** | Last-known identities retained; `shell_exited` → `orphaned` (rescued via session/pgrp/tty) → `unattributed` (explicitly "usage unknown, not zero"). Legacy payload says `alive:true` with real memory. |
| **CLI identification** | **None.** Only the shell PID was stored; the agent was user-declared. | Foreground process group from `tpgid`. **No executable name consulted.** Verified across 3 simultaneous identical CLIs. |
| **Identity** | Bare PID (in memory only). PID reuse undetected. | `pid + starttime`, persisted, rehydrate validates starttime. |
| **Threads** | Not tracked. | `stat` field 20, per process + tree total. |
| **History** | None. 60-sample in-memory ring, lost on unmount. | Bounded ring + minute rollups in SQLite + restart seeding. `growth_verdict` with auditable evidence, never a bare `memory_leak: true`. |
| **Cost of the monitor** | Not measured. | Measured continuously and published as `sampler_overhead_pct_of_core`. |
| **Fabricated diagnostics** | `demoMode` **defaults to `true`**, so a fresh Penguin Console served invented PIDs and per-process CPU to any AI that typed `ps`. | Fact commands bypass demo mode entirely. Interactive TUIs get an explanation, not a 20 s hang. |

---

## KNOWN LIMITATIONS

1. **Polling cannot see a process that lived under the sampling interval.** A 200 ms `git`
   invocation is invisible at 1 Hz. This is stated in `events.note` and raised as the
   `SHORT_LIVED_BLIND_SPOT` finding so no consumer over-claims. Fixing it needs eBPF/audit, which the
   spec explicitly declines.
2. **PSS has no aggregate syscall.** Exact workspace PSS is N reads at 30–42 ms each, so the cache
   refreshes slowly. `pss_stale` / `pss_age_ms` are mandatory and `refreshWorkspacePss()` exists for
   when a current number is actually needed.
3. **`setsid` daemons that outlive their parent are unattributable.** Ancestry is the only surviving
   link. Measured: new session, new pgrp, `tty=0`.
4. **No terminal-emulator metric for app-created PTYs — by construction.** `forkpty()` makes the
   shell a session leader on a fresh pts; there is no Konsole process to measure. `emulator` is
   `null` with an explanatory `emulatorNote` rather than a fabricated entry. Emulators *are*
   discoverable for external terminals via the cold census.
5. **`/penguin-console` per-pane telemetry is structurally impossible.** Its panes are one-shot
   `terminal:exec` spawns with no persistent PID. That is a product change (one-shot exec → real
   PTYs), not a monitoring fix, and was left alone.
6. **Direct procfs is Linux-only.** Windows keeps the old `ps`/PowerShell path and is labelled
   `fidelity: "reduced"` with a `fidelity_note` explaining exactly what is weaker.
7. **`resolveCli` falls back to "newest descendant leading its own group"** when the CLI does not
   `setpgid`, and marks that `confidence: "medium"`. Still name-free, but not the same guarantee.

---

## REMAINING RISKS

1. **The app has never been built or run with this code.** §0-0 forbids agent builds. The preload
   wiring, the four IPC handler bodies, and the two React components are **unexercised**. CZ must
   build and run `scripts/procmon/run-all.sh` plus a live `/terminal` session.
2. **Two untested-at-runtime behaviours:** `rehydrateMonitoredTerminals()` runs inside
   `app.whenReady()` and needs `db` initialised by `initializeStorage()` first — if that ordering is
   wrong it will log a skip rather than throw, so it fails *quietly*. Worth watching the log on
   first launch.
3. **`main.ts` is a shared file** (30k+ lines, other agents active). My edits are in 6 bounded
   regions; `git diff` on this file will contain other agents' work, so it cannot be used to isolate
   my changes. I verified instead by checking every tsc error inside my line ranges.
4. **The rollups DELETE runs on every write** (once per minute per workspace). With many workspaces
   that is an indexed delete, but it is the one write that grows with time and was not load-tested.
5. **Swap is currently ~70% consumed on this box.** With the app now *reporting* that, expect a
   standing `SWAP_PRESSURE` finding. That is the metric doing its job, not a regression.

---

## NOT DONE (deliberate)

- **No new UI surface.** The two existing panels were corrected and extended in place. A dedicated
  process-tree browser would be the natural Phase 8, but the spec says not to add metrics without a
  decision they enable, and a tree view is a UI question rather than a telemetry one.
- **`VSZ`, `maps`, per-tick per-thread CPU, affinity** — excluded per spec §35.
- **eBPF / event-level accounting** — excluded per spec §17; documented as a future capability.
- **Penguin Console persistent PTYs** — out of scope, flagged above.

---

```
CYCLE: 1 (implementation)
BUILD: NOT RUN — CZ BUILDS (§0-0)
GATE A  window.deskflowAPI: NOT PROBED (app not rebuilt)
PROCESSES: started ~120 short-lived PTY/probe children | closed all | net delta 0 | census 55->56
           (verified no test shells leaked: `leftover test shells: 0`, `leftover pty pools: 0`)
FEATURE: Terminal Workspace resource monitoring — implementation
STEPS: 6 procmon modules; replaced 135 lines of ps sampler in main.ts with 221 lines of wiring;
       6 DB columns + rollups table; 4 IPC handlers + 2 broadcasts; preload; 2 React components;
       shell.ts fact-command routing; 4 test/bench suites in scripts/procmon/
EXPECTED: accurate, attributable, low-overhead, AI-readable monitoring per spec §1-36
ACTUAL: 209 assertions green; T1+T2 = 0.274% of one core at 10 workspaces (target 0.85%);
       0.577% including the PSS cache; ~40x cheaper than the ps sampler it replaced
RENDERER CONSOLE: n/a (app not built)
MAIN CONSOLE: n/a (app not built)
VERDICT: PASS (module-level, Linux, against real PTYs + real /proc) / NOT TESTED (runtime UI)
ARTIFACTS: agent/docs/terminal-workspace-monitoring-IMPLEMENTATION-REPORT.md
           src/main/procmon/{types,procfs,sampler,history,findings,index}.ts
           scripts/procmon/{test-integration,test-db,test-integration-guards,bench-scale}.cjs
           scripts/procmon/run-all.sh
```
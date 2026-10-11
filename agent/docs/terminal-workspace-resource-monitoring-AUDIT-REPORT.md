# Terminal Workspace — Resource Monitoring Audit (Cycle Report)

**Date:** 2026-10-08
**Agent:** `opencode-term-resource-audit-20261007`
**Status:** AUDIT ONLY — **zero source files modified**
**Companion doc:** `agent/docs/terminal-workspace-resource-monitoring-AUDIT.md` (full long-form audit)
**Probes:** `/tmp/opencode/procprobe.mjs`, `procprobe2.mjs`, `procprobe3.mjs`, `procprobe4.mjs`, `procprobe5.mjs`, `refine.mjs`

> **Measurement conditions:** this box, live — 685 processes, 10 concurrent opencode trees
> (54 processes / 799 threads), Fedora 44 / Wayland, `CONFIG_HZ=100` (verified via `getconf CLK_TCK`).
> Every number below is measured, not assumed.

---

## A. Current architecture

The entire system is four numbers, on one 3000 ms timer:

```
TerminalPage:1785 spawnTerminal → main.ts:15524 → terminalManager.spawn (main.ts:15158)
  └─ pty.spawn(shell, []) main.ts:15172   ← the SHELL, not the agent
  └─ terminals.set(id, {id, pty, cwd, pid})  main.ts:15182   ← IN MEMORY ONLY
then the agent is TYPED in: TerminalPage:1210 terminalWriteRaw(id, "opencode\n")

setInterval 3000ms (main.ts:14798) → __sampleTerminalStats (main.ts:14764)
  └─ execFile('ps', ['-eo','pid=,ppid=,rss=,pcpu='])           main.ts:14687
  └─ __sumProcessTree(pty.pid, snapshot)                       main.ts:14748
  └─ broadcast('terminal:resource-stats', {pid, alive, memMB, cpuPct, eventLoopLagMs})
```

There are **no `/proc` reads anywhere in `src/`** for monitoring. No `pid` column on any DB table —
`spawnedPid`'s own comment says "(DB correlation)" and no SQL ever touches it (`main.ts:14379`).
No metrics table exists. Nothing is persisted; restart erases all of it.

Also: the `pty.spawn` in `src/terminal/lib/electron.ts:26` is **inside a template literal** —
copy-paste text rendered in the UI. Nothing under `src/terminal/**` spawns a PTY. Penguin Console
runs `terminal:exec` → one-shot `cp.spawn` (`main.ts:16283`), so its panes have **no persistent PID
at all** and per-pane process telemetry is structurally impossible there.

## B. Current capabilities

RSS sum per PTY tree (from `ps rss`), `ps pcpu` sum, host CPU% (true delta),
`os.totalmem/freemem`, main-process-only `appRssMB`, GPU, renderer V8 heap / frames / IPC RTT.

**Absent:** peak, growth rate, any history for workspaces, PSS/USS/VSZ, swap, per-process CPU,
per-process RAM, thread counts, I/O, create/exit events, orphan detection, application-vs-workspace
split, per-child attribution, PTY/session/CLI identity.

## C. Correctness audit

**C.1 — `ps pcpu` is a LIFETIME AVERAGE, treated as instantaneous.**
Measured: a burner at 81% reported `pcpu 80.1` at `etimes=1`. A 2-min-old shell that burned 100% for 3 s
reports **2.5% forever**. Therefore `TerminalPage.tsx:270`'s `cpuPct > 90` lag threshold is
**unreachable on Linux**, and `:271`'s `> 60` busy threshold survives only via its memory clause.
The correct delta code **already exists but only on Windows** (`__cpuPrev`, `main.ts:14732`).

**C.2 — RSS double counting: real, but smaller than expected.**

| tree | RSS | PSS | ratio | threads |
|---|---|---|---|---|
| `/dev/pts/10` (opencode 894.6 + 2 MCP + 2 npm + probe) | 1158.1 MB | 1140.0 MB | **1.02x** | 106 |
| `/dev/pts/11` (opencode 1025.6) | 1230.5 MB | 1205.3 MB | **1.02x** | 88 |
| all 10 opencode trees | 9360.9 MB | 9168.4 MB | **1.02x** | 799 |
| **3 identical node processes** | 140.5 MB | 50.4 MB | **2.79x** | 21 |

> **Does 800 MB + 300 MB + 200 MB = 1.3 GB? No, not necessarily.**
> Overstatement is the *shared* pages, and it scales with how many children share the same binary
> and libs — which is why identical-`node` children hit 2.79x while today's opencode fan-out
> (distinct binaries) lands at 1.02x. Bounded *today*; will silently inflate as agent frameworks change.
> The dominant shared component here is **file-backed text** (`Pss_File`), not COW anon.

**C.3 — Orphans are misreported, not merely missed.**
Measured: SIGKILL a shell with 2 children → both survive, reparent to ppid 1319.
`ppid-walk` finds **0**. `session-walk` finds 6, `pgrp-walk` finds 4. And `main.ts:14777` zeroes the
session (`alive:false, memMB:0`) when the shell dies — so a live 541 MB orphan is reported as **0 MB**.
That is the exact opposite of the truth. `setsid` makes it worse: measured new session + new pgrp +
`tty=0`, so all three rescues fail.

**C.9 — confirmed UI bug.** `main.ts:14921` returns `memPct` as 0–100;
`PerformanceMetricsPanel.tsx:134` renders `memPct * 100` → **9312%**.

**C.10 — claim tested and REFUTED.** "os.freemem() is pessimistic vs MemAvailable" is **false**:
`MemFree 1575 | MemAvailable 2188 | os.freemem() 2184` — libuv reads `MemAvailable`.
The real defect is worse: **swap is never read at all**, and this box is at
`SwapTotal 8192 / SwapFree 0` = **100% full**, with 12 recorded OOM kills. The metric that would have
predicted every one of them is not collected.

**C.11 — the Console will hand the AI fabricated data.** `src/terminal/lib/shell.ts:428` routes
`ps`/`free`/`top`/`pgrep` to hardcoded strings *in REAL mode*. An AI typing `ps` gets invented PIDs.

## D. Missing information

Application-vs-workspace split; per-child attribution; **which descendant is the CLI**;
process/thread counts (opencode runs **44–64 threads**, never read); peak + growth rate (so Case A and
Case B are indistinguishable today); swap; user-vs-kernel CPU; create/exit events; orphan state; any
surviving restart.

## E. Linux feasibility — the key results

**The central question — can a session be reliably mapped to its CLI? Yes, with zero name matching.**
Measured:

```
/dev/pts/10  shell 254117  pgrp=254117 session=254117 tty_nr=34826  tpgid=254616
             tpgid=254616 => opencode + all 6 of its descendants
             BACKGROUND: bash only
/dev/pts/11  tpgid=261249 => opencode 261249 (+5 descendants)
```

`tpgid` (stat field 8) **is** the running CLI, and it reverts to the shell's pgrp when the CLI exits —
a free "is an agent running" signal. Three concurrent opencodes stay distinct because this is keyed on
pgrp/session/pts, never a name. Verified: 3 identical `node -e` processes have **identical `comm` and
identical `cmdline`**; only `starttime` differs.

**`/proc/<pid>/task/<tid>/children` works and is exact.** Content `"318994 318995 318996 "` matched the
real spawned pids exactly. This is the cost killer: a tree walk becomes O(tracked tree) instead of
O(all processes).

**Measured cost table** (685 procs, ms/tick):

| operation | ms | % of one core @1 Hz |
|---|---|---|
| `readdir /proc` only | 1.1–1.9 | 0.11–0.19% |
| full scan + `stat` per pid | 13.6–14.9 | 1.36–1.49% |
| `children`-walk, stat+statm, 55 procs | **6.9** | **0.69%** |
| **`ps -eo pid,ppid,rss,pcpu`** | **37.7** | **3.5%** |
| `smaps_rollup` whole box | **1023** | ≈100% |
| `smaps_rollup` × 10 tracked | 280 | 28% |
| thread scan, 64-thread opencode | 0.72 | on-demand |

So **today's `ps` sampler costs 3.5%/core; the recommended hot tier costs 0.69%.**
The change is better monitoring at *lower* cost.

**Emulator row is the uncomfortable one:** `forkpty()` makes the app's shell a session+pgroup leader
on a **fresh pts** (verified: pid 320192, `/dev/pts/14`, `pgrp==pid==session`).
**App-spawned terminals are emulator-less by construction — there is no Konsole to measure.**
"Terminal emulator overhead" is only meaningful for terminals the *user* launched outside the app,
discoverable by the cold full scan.

## F. Recommended metric set

**Essential:** `cpu_pct` (Δutime+Δstime), `cpu_user/sys_pct`, `cpu_cumulative`, `rss`, `swap`,
`thread_count`, `state` (`D`=disk stall, `Z`=unreaped), `(pid, starttime)`,
`ppid/pgrp/session/tty_nr/tpgid`.

**Useful:** PSS/USS/file/shared, peak RSS, I/O rates, fd count, per-thread top-5, exe/cmdline,
spawn/exit rates.

**Do not track:** **VSZ** — measured `VmSize 1,423,416 kB` with `VmRSS 63,420 kB` (Node reserves ~800 MB
arenas it never touches; it would swamp every display); RSS-sum as the headline; `ps pcpu`;
full `smaps` parse; `/proc/<pid>/maps` parsing; per-thread CPU per tick; per-workspace affinity.

## G. Attribution architecture

Three tiers: **T1 hot** `children`-walk + `stat`, 1 Hz busy / 0.25 Hz idle (0.69% core).
**T2 cold** full scan every 10 s (0.15% amortized) — exists *only* for orphan rescue via
`(session, pgrp)` and for discovering terminals the app didn't spawn.
**T3 on-demand** PSS/threads/io/fd (never on a timer).

Memory reporting must show **three** numbers: `application` (CLI alone), `workspace.pss_sum`
(additive-correct — this is the primary), and `workspace.rss_sum` **labelled with
`rss_overstatement_mb`**. CPU is summed as **rates**, never percentages.

Multi-instance key is **`${pid}:${starttime}`** everywhere. Orphan state is **retained, never zeroed**.

## H. AI schema

Designed so each field answers one of the target questions, with three rules: `pss_stale` +
`scan_gap_sec` are **mandatory** (a monitor that can't say how fresh it is makes the AI over-confident);
`growth_verdict` is a computed verdict with the series included so it's auditable; `role` is an
explicit hint while `identity` is the fact — conflating them is how a monitor starts lying.
Full schema plus a `findings[]` array carrying `evidence` / `why_it_matters` / `next_probe` is in the
companion doc.

## I. Overhead target

**T1+T2 ≤ 0.85% of one core, measured, at 1 Hz with 10 workspaces; zero when no terminal exists** —
published in the payload as `provenance.sampler_overhead_cpu_pct`. "% of one core" is the right unit
because the Electron main process is single-threaded and a 15 ms sync scan (or 1100 ms `smaps_rollup`)
is felt there; "% of machine" would be misleadingly easy on 16 cores.

## J. Implementation plan

**Phase 0** bug fixes + **add swap to `console:metrics`** (highest-value single line in the plan).
**Phase 1** persist identity columns. **Phase 2** extract `src/main/procmon/`, replace `ps`, extend the
existing channel additively so no UI change is needed. **Phase 3** true CPU + application/workspace
split + foreground-pgrp detection. **Phase 4** orphans + exit events + UI. **Phase 5** history ring +
rollup table so a *fresh AI session* can see the last hour. **Phase 6** on-demand depth.
**Phase 7** fix the Console's fabricated output.

## Limitations on record now

Polling cannot see a process that lived under the sample interval (a 200 ms `git` is invisible —
needs eBPF); PSS has no aggregate syscall so exact tree PSS is N×28 ms; `setsid` orphans are
unattributable after re-parenting; "emulator overhead" doesn't exist for app-spawned sessions;
Penguin Console per-pane telemetry needs a *product* change (one-shot exec → persistent PTY), not a
monitoring fix.

---

## Implementation status — NOTHING IS IMPLEMENTED

Explicitly recorded so this document cannot be misread as a completion report:

| Still broken (unchanged in the working tree) | Where |
|---|---|
| CPU is a lifetime average, not a rate | `main.ts:14687` |
| RAM is RSS-summed (overstates) | `main.ts:14748` |
| Swap never measured at all (100% full on this box) | `console:metrics` |
| Orphans reported as `memMB: 0` | `main.ts:14777` |
| No CLI identification — only the shell pid is known | `main.ts:15172` |
| No history / peak / growth rate | absent |
| Nothing persisted | no metrics table |
| RAM % renders as 9312% | `PerformanceMetricsPanel.tsx:134` |
| Console fabricates `ps`/`top` output in real mode | `shell.ts:428` |

Phases 0–7 are **proposals only**. `VERDICT: PASS` in the cycle report below refers to *the audit being
delivered*, **not** to the monitoring being fixed.

---

## Open questions for review

Two load-bearing judgements worth challenging before implementation:

1. **PSS treatment.** The RSS/PSS overstatement is only 1.02x for real opencode trees today. Does PSS
   deserve on-demand-only treatment rather than being the primary per-tick number?
2. **Emulator-less by construction.** If you want per-workspace emulator/shell/CLI layering comparable
   to a Konsole-vs-app comparison, that changes the design rather than fixing it.

---

```
CYCLE: 5 (audit pass, no code changes)
BUILD: NOT RUN — CZ BUILDS (§0-0)
GATE A  window.deskflowAPI: not probed — runtime verification not applicable (read-only audit)
PROCESSES: started ~40 short-lived probe children | closed all | net delta 0 | census 55->56
           (+1 = another agent's session, not mine; my probes verified absent via ps)
FEATURE: Terminal Workspace resource monitoring — audit
STEPS: registered/claimed; read main.ts:14674-14935 sampler + 15136-15214 spawn manager + DDL;
       2 parallel explore agents over src/ for metrics and identity; 5 numeric probes on /proc;
       1 real node-pty spawn to verify forkpty identity
EXPECTED: determine whether current monitoring measures the right things and is technically correct on Linux
ACTUAL: 12 numbered defects, 6 absent concept layers, 5 live-measured identity mechanisms, 11-row cost table
RENDERER CONSOLE: n/a
MAIN CONSOLE: n/a
VERDICT: PASS (audit delivered, zero code modified)
ARTIFACTS: agent/docs/terminal-workspace-resource-monitoring-AUDIT.md
           /tmp/opencode/procprobe{,2,3,4,5}.mjs, /tmp/opencode/refine.mjs
```
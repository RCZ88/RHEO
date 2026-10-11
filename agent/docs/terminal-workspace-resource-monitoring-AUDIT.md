# Terminal Workspace — Resource Monitoring Audit

**AUDIT ONLY — no code changed.** All numbers measured on this box (Fedora 44, kernel from `/proc/sys/kernel/osrelease`, 685 processes, 10 live opencode trees / 54 processes / 799 threads, `CONFIG_HZ=100`).
Probes: `/tmp/opencode/procprobe{,2,3,4,5}.mjs`, `/tmp/opencode/refine.mjs`.

---

## A. Current architecture

### A.1 The full data path (it is four lines long)

```
TerminalPage.handleCreateNewSession (TerminalPage.tsx:1760)
  └─ generateTerminalId() -> "term-<ms>-<rand9>"                          (:80-82)
  └─ window.deskflowAPI.spawnTerminal(id, cwd, agentType, cols, rows)      (:1431)
       └─ preload.ts:732  -> ipcMain 'spawn-terminal'                      (main.ts:15524)
            └─ terminalManager.spawn(id, cwd, cols, rows)                  (main.ts:15158)
                 └─ pty.spawn(shell, [], {name:'xterm-256color', ...})     (main.ts:15172)
                    shell = process.env.SHELL || '/bin/bash'   <-- the SHELL, not the agent
                 └─ terminals.set(id, {id, pty, cwd, pid: proc.pid})       (main.ts:15182)  IN MEMORY ONLY
  └─ then the agent is TYPED into the PTY                                (TerminalPage.tsx:1210)
       terminalWriteRaw(id, "opencode\n")

every 3000 ms  __startResourceStatsSampler()                               (main.ts:14798)
  └─ __sampleTerminalStats()                                               (main.ts:14764)
       └─ __collectProcSnapshotUnix()  execFile('ps',['-eo','pid=,ppid=,rss=,pcpu='])   (main.ts:14687)
       └─ for each terminal: __sumProcessTree(pty.pid, snapshot)            (main.ts:14748)
            RSS: sum of ps `rss` over the whole ppid subtree  (KB -> MB)
            CPU: sum of ps `pcpu`                                (lifetime average on Unix)
       └─ broadcast('terminal:resource-stats', { [terminalId]: {pid, alive, memMB, cpuPct, eventLoopLagMs, ts} })
            └─ preload.ts:756 onResourceStats()  ->  TerminalPage.tsx:748 useState
                 └─ SessionResourceStats badge                             (TerminalPage.tsx:263)
            └─ PerformanceMetricsPanel card grid + totals                  (PerformanceMetricsPanel.tsx:120)
```

That is the entire per-workspace monitoring system. **Four numbers: `pid`, `alive`, `memMB`, `cpuPct`** (plus a self-instrumented `eventLoopLagMs` that describes *DeskFlow's* main process, not the workspace).

### A.2 The other three metric systems (all in `main.ts`)

| System | IPC | Cadence | What it measures | Persistence |
|---|---|---|---|---|
| Per-PTY tree | `terminal:resource-stats` (push) + `terminal:get-resource-stats` (fires a sample, returns `{success:true}` — **no data**) | 3000 ms | RSS sum + `ps pcpu` sum per PTY tree | **none** |
| Host (`console:metrics`) | `console:metrics` (pull) | 2000 ms `MetricsPanel` / 3000 ms `perfRecorder` | host CPU% (true delta), `os.totalmem/freemem`, **main-process-only** `appRssMB`, GPU | **none** |
| Static system | `terminal:get-system-stats` (pull) | 3000 ms | cpuCount, cpuModel, uptime, `lspci|grep -i vga` | **none** |
| Renderer (`/profiler`) | reuses `console:metrics` | 250/2000/5000 ms | frame time, long tasks, V8 heap, IPC RTT | in-memory |

### A.3 What is *not* there

- **No `/proc` reads anywhere in `src/`** for monitoring. The only `/proc` in the app is `src/linuxForeground.ts:345,365` (`readlink /proc/<pid>/exe` for compositor window detection) and the separate legacy `rheo-tracker/`.
- No PSS/USS, no `smaps*`, no `VmRSS`/`VmHWM`/`VmSwap`, no `Threads`, no `/proc/<pid>/stat` parsing, no `utime`/`stime`, no `statm`, no `/proc/<pid>/io`, no `/proc/meminfo` read, no `cgroup`, no `swap`, no `tty`/`pts`, no terminal-emulator detection.
- **No `pid` column on any DB table.** `terminal_sessions` (main.ts:2742) has no pid. `spawnedPid` is stored in two in-memory Maps and its own comment claims "(DB correlation)" — no SQL ever touches it (main.ts:14379).
- **No metrics table exists.** Nothing is persisted. Every number dies with the process.

### A.4 Two different apps called "terminal"

|  | `/terminal` (Terminal Workspace) | `/penguin-console` |
|---|---|---|
| Backend | real `node-pty` PTYs | **no PTY at all** — `terminal:exec` → one-shot `cp.spawn(shell,['-c',cmd])` (main.ts:16283) |
| Store | SQLite | `localStorage` only (`useConsoleStore.ts:215`) |
| Per-pane process telemetry | yes (that is the `terminal:resource-stats` tree) | **structurally impossible** — a pane has no long-lived PID |
| `MetricsPanel` | — | host metrics only, and it says so honestly (MetricsPanel.tsx:126-137) |

The `pty.spawn` in `src/terminal/lib/electron.ts:26` is **inside a template literal** — a copy-paste snippet rendered as text in the UI, and it documents channels (`pty:data`/`pty:write`) that do not exist. Nothing under `src/terminal/**` spawns a PTY.

---

## B. Current monitoring capabilities (complete list)

**Implemented**
| metric | mechanism | correct? |
|---|---|---|
| per-tree RSS sum (KB→MB) | `ps rss` summed over ppid subtree | overstated 1.02–1.14x measured; unbounded with same-binary children (2.79x measured) |
| per-tree CPU % | `ps pcpu` sum | **NO — lifetime average, not a rate** |
| per-tree process count | implied (tree walk) | not reported |
| per-tree thread count | — | **absent** (opencode runs 44–61 threads) |
| host CPU % | two `os.cpus()` reads, delta | correct, but `_lastCpuTimes` is module-global and shared by two pollers at 2000 ms and 3000 ms, so each computes an interval it did not measure |
| host RAM | `os.totalmem()`/`os.freemem()` | `freemem()` == `MemAvailable` (libuv) — **correct**; swap never read |
| main-process RSS + heapUsed | `process.memoryUsage()` | correct, but renderer/GPU/zygote invisible |
| main-process event-loop lag | self-timer drift | correct, but describes DeskFlow not the workspace |
| renderer V8 heap, frames, long tasks, IPC RTT | `perfRecorder` | correct, different subsystem |
| GPU util/VRAM | `nvidia-smi`, else `/sys/class/drm/card0/...` | hardcoded `card0` |
| uptime/platform/cores/model | `os.*` | correct |
| per-session health badge | thresholds on cpuPct/memMB/lag | thresholds unreachable (see C.1) |

**Absent:** peak RAM, RAM growth rate, any history for workspaces, PSS/USS/VSZ, swap, per-process CPU, per-process RAM, thread counts, fd counts, I/O counters, process create/exit events, orphan detection, short-lived-process detection, application-vs-workspace split, per-child attribution, terminal-emulator identity, PTY identity, shell identity, CLI identity, anything at all about `/terminal` terminals on `/penguin-console`.

---

## C. Correctness audit

### C.1 `ps pcpu` is a LIFETIME AVERAGE — the app treats it as instantaneous. **MEASURED.**

```
wall=1.50s  jiffies_delta=121  => TRUE instantaneous CPU = 81%
ps says: 314854 80.1  1 00:00:01          (etimes=1)
```
`ps` computes `pcpu = jiffies_since_start / etimes`. It decays monotonically. A 2-minute-old shell that burned 100% for 3 s reports **2.5%** thereafter — permanently.

Consequences, all live:
- `TerminalPage.tsx:270` `const laggy = stats.eventLoopLagMs > 200 || stats.cpuPct > 90;` — **unreachable on Linux.**
- `TerminalPage.tsx:271` `const warm = !laggy && (stats.cpuPct > 60 || stats.memMB > 1500);` — reachable only via the memory clause.
- `PerformanceMetricsPanel.tsx:121` sums these averages across terminals into "App Load".
- The CPU delta machinery **already exists but only on Windows** (`__cpuPrev`, main.ts:14732). The Linux path never uses it.

### C.2 RSS-sum double counting. **MEASURED, and smaller than feared — but structurally unbounded.**

```
/dev/pts/10  8 procs   opencode 894.6MB / probe 16.5 / npm 48.5 / npm 48.7 / mcp 53.4 / mcp 95.4
            RSS 1158.1 MB | PSS 1140.0 MB | 1.02x | 18.1 MB phantom | 106 threads
/dev/pts/11  7 procs   opencode 1025.6MB RSS / 1001.8 PSS
            RSS 1230.5 MB | PSS 1205.3 MB | 1.02x | 25.1 MB phantom | 88 threads
ALL 10 opencode trees: 54 procs, 799 threads
            RSS 9360.9 MB | PSS 9168.4 MB | 1.02x | 192.5 MB phantom
3 IDENTICAL node processes:  RSS 140.5 MB | PSS 50.4 MB | 2.79x  <-- same-binary children
single large node process:   RSS 366.0 MB | PSS 344.2 MB | 1.06x
synthetic 4-proc COW tree:   RSS 959.6 MB | PSS 842.7 MB | 1.14x
```
**Answer to the brief's question:** OpenCode 800 MB + Bun 300 MB + MCP 200 MB does **not** necessarily mean 1.3 GB. The overstatement is the shared pages, and it scales with how many children share the *same binary and libs*. Today's opencode fan-out is mostly distinct binaries (opencode, node, bun) so it lands at ~2%; a bun-heavy or node-heavy fan-out lands at 2–3x. It is a real bug, it is bounded today, and it will silently inflate as agent frameworks change.

The dominant shared component here is **file-backed text** (`Pss_File`), not COW anon: opencode's PSS is 16.2 MB below its RSS because it shares the binary's text with 5 node children.

### C.3 Orphans are structurally undetectable today. **MEASURED.**

```
bash pid 318210, 2 children (541 MB + 41 MB)
--- SIGKILL the shell only ---
SURVIVING descendants: 2/2, both reparented to ppid=1319
  ppid-walk from shell pid 318210:  0 procs   <-- the app's ONLY method. MISSES BOTH.
  session-id walk (sid=318136):    6 procs   <-- finds them
  pgrp walk      (pgrp=318137):    4 procs   <-- finds them
```
And `main.ts:14777` does `if (!pid || !snap.has(pid)) { alive:false, memMB:0, cpuPct:0 }` — when the shell dies it **zeroes the session and discards it**. A 541 MB orphan holding its memory is reported as `memMB: 0`. That is the exact opposite of the truth.

`setsid` makes it worse: a daemonized child gets a **different session, a different pgrp, and tty=0**. Measured. All three rescue mechanisms fail; only ancestry works, and ancestry is gone.

### C.4 The app stores the SHELL pid, not the agent pid — and there is no way to tell them apart today

`pty.spawn(shell, [])` (main.ts:15172) then `terminalWriteRaw(id, "opencode\n")` (TerminalPage.tsx:1210). `proc.pid` is bash. `AGENT_CONFIGS` (main.ts:14189) is used only for readiness regexes and input modes; agent *type* is user-selected (or `'opencode'` default) and never inferred. So `memMB` labelled "session" is `bash + everything bash spawned`, which does include opencode — but the app cannot say *which descendant is opencode*, which is the single most important fact for "OpenCode is using 4 GB".

### C.5 PID reuse is unguarded

`pid` is the join key everywhere (`terminals` Map, `alive` check via `snap.has(pid)`, broadcast key). Nothing records `starttime`. A reused PID is indistinguishable from the terminal. `spawnedPid` is captured and never read for a decision.

### C.6 Multi-instance is accidentally OK, structurally unverified

5 concurrent opencode trees exist on this box (pts/3,4,5,6,7,8,10,11), each a separate session/pgrp/pts, with 0 cross-talk — because each PTY gets a fresh pts. That is correctness by accident of `forkpty()`, not by design. The moment attribution moves to name matching it breaks: 3 identical `node -e` processes have **identical `comm` and identical `cmdline`** (measured).

### C.7 The 3-second cadence cannot see short-lived processes

Measured: 8 processes spawned and exited; a 20 ms sampler observed 687 distinct pids. At 3000 ms, a `git` invocation that lives 200 ms is invisible in every sample. **A finished process leaves no post-mortem data in `/proc`** — so "was Git stuck?" can never be answered from polling alone, only "is Git running right now, and for how long".

### C.8 `console:metrics` CPU delta is corrupted by two pollers

`_lastCpuTimes` is module-global (main.ts:14851-14866). `MetricsPanel` polls at 2000 ms; `perfRecorder.sampleHost` polls at 3000 ms. They interleave, so each computes a delta over an interval it did not time, and the first caller after an idle gap gets `null`.

### C.9 Confirmed UI defect — RAM percentage renders 100x too large

`main.ts:14921` returns `memPct: Math.round(((total-free)/total)*100)/100` → a **0–100** number.
`PerformanceMetricsPanel.tsx:134` renders `` `${Math.round(systemStats.memPct * 100)}% of ...` `` → renders **9312%**.

### C.10 `MemFree` vs `MemAvailable` — claim under test, **REFUTED**

> claim: "`os.freemem()` is systematically pessimistic vs `MemAvailable` because it excludes reclaimable page cache."

```
MemFree 1575 MB | MemAvailable 2188 MB | os.freemem() 2184 MB
=> os.freemem() tracks MemAvailable
```
libuv reads `MemAvailable`. **There is no pessimism.** Refuted by measurement. The real defect is different and worse: **swap is never read at all.**

```
SwapTotal 8192 MB | SwapFree 0 MB  => SWAPPED 8192 MB (100.0% FULL)
```
`MEMORY.md` records 12 global OOM kills on this box in 24 h. The app reports **0 swap** and 93% RAM. On a box where every build died of swap exhaustion, the metric that predicted the kill is not collected.

### C.11 `/penguin-console` will hand the AI fabricated data

`src/terminal/lib/shell.ts:428` `SPECIAL_COMMANDS` routes `ps`, `free`, `top`, `htop`, `pgrep`, `nvidia-smi` to **hardcoded strings** — in REAL mode, not just demo mode:
```
case "ps": return ok([{ text: "    PID TTY          TIME CMD\n   1842 pts/0 ... 4410 pts/2 node server/index.ts" }]);
```
An AI that types `ps` in a Console pane gets 2019-era invented PIDs. This is an active diagnostic trap, not a cosmetic issue.

### C.12 Other verified defects
- `terminal_bindings.session_id` is read by `getSessionIdForTerminal` (main.ts:16182) and **written by nothing** — the primary branch is dead code.
- `PerformanceMetricsPanel.tsx:121-122` sums per-terminal RSS across terminals, compounding the C.2 error, with no dedup for shared ancestry.
- `lspci | grep -i vga` (main.ts:14912) misses `3D controller`/`Display controller` → `gpuName` is usually `Unknown` on modern AMD/Intel.
- `console:metrics` GPU probes one hardcoded `/sys/class/drm/card0` path.
- `getResourceStats` returns `{success:true}` and **no data** (main.ts:14804).
- `terminal_sessions.terminal_id` has no index but is queried on every PTY chunk (main.ts:15386, 15591).
- `src/preload2.ts` is dead (never imported; `scripts/build.mjs:151` builds `src/preload.ts`). Harmless, but a grep trap.

---

## D. Missing information

Everything the brief asks about that the brief's questions require:

1. **Application vs workspace split.** Cannot answer "OpenCode 1.1 GB / workspace 2.4 GB / children: Git 50, Bun 400, MCP 700".
2. **Per-child attribution.** No process in the tree is ever named or measured individually.
3. **Which descendant is the CLI.** Requires name matching (unreliable) or `tpgid` (not implemented).
4. **Process/thread counts.** opencode runs 44–61 threads; `Threads` is never read. Thread count is the cheapest thread-leak detector there is.
5. **Peak RSS and RAM growth rate.** Only an instantaneous value exists; nothing can distinguish a stable 1.2 GB from 400 MB → 2.0 GB.
6. **Swap.** Absent entirely, and this box is 100% swapped.
7. **User vs kernel CPU split.** `utime`/`stime` would immediately separate "computing" from "syscall thrash / page fault storm".
8. **Process exit/create events.** No way to say "this session spawned 40 processes in the last minute" or "Git has been alive 94 s".
9. **Orphan state.** Not just undetected — actively misreported as `memMB: 0`.
10. **Application memory ceiling / leak verdict.** No trend, no slope, no verdict.
11. **PTY / session / pgrp identity.** Not recorded, so nothing survives a restart and nothing can be re-attributed.
12. **Anything per-pane on `/penguin-console`** — because nothing there is a process. That is architectural, not a bug, and must be stated rather than faked.
13. **I/O rate.** `/proc/<pid>/io` is 0.005 ms/read and exists. `read_bytes` is the disk-pressure signal; `rchar` is the "churning files" signal.

---

## E. Linux feasibility — what can and cannot be tracked

Measured on this box unless noted.

| Layer | Trackable? | Mechanism | Reliability |
|---|---|---|---|
| **Terminal emulator** (Konsole/Kitty/…) | **Only if the user launched it outside the app** | group by `tty_nr`; the emulator owns the pts the shell was started on | **N/A for app-spawned sessions.** Verified: `node-pty`'s `forkpty()` makes the child shell a **session + pgroup leader on a fresh pts**, so app terminals are *emulator-less by construction* — there is no Konsole to measure. Detecting a *foreign* Konsole is reliable (see row 4) but is a different feature. |
| **Terminal tab/session** | **Yes, exactly** | `tty_nr` → `/dev/pts/N`; or `session` id | Exact and unique. Measured: 14 distinct pts, 5 opencode sessions, 0 cross-talk. |
| **PTY** | **Yes, free** | `tty_nr` from `stat` field 7; `readlink /proc/<pid>/fd/0` gives `/dev/pts/N` directly | Exact. **Available at spawn time with zero extra cost.** |
| **Shell** | **Yes** | the `forkpty()` pid itself — `pgrp == pid == session`, verified | Exact, and it needs no name matching. **Not shell-specific**: works for bash/zsh/fish/nu alike. |
| **CLI/TUI app** | **Yes — no name matching needed** | **foreground process group**: `stat` field 8 `tpgid` = the pgrp that currently owns the shell's pts | **Measured, works perfectly**: pts/10 shell `tpgid=254616` → `opencode 254616`, and that pgrp contains opencode + all 6 of its descendants. pts/11 `tpgid=261249` = `opencode 261249`. Reverts to the shell's own pgrp when the CLI exits → a free "is an agent running right now" signal. |
| **CLI, when it does not setpgid** | Degrades | then `tpgid == shell.pgrp`, so pick the *newest* descendant whose `pgrp == pid` and that is not the shell | Still no name matching needed. opencode setpgid's; verified. |
| **Direct children** | **Yes, from the kernel** | **`/proc/<pid>/task/<tid>/children`** | **Verified exact**: content `"318994 318995 318996 "` matched the real spawned pids exactly. Turns a tree walk from O(all processes) into O(tracked tree) — **2.2x cheaper measured**, and it is the correctness-preserving way to find MCP servers. |
| **Descendants (incl. re-parented orphans)** | **Yes** | `children` files + `(session, pgrp)` rescue | Verified: ppid-walk finds 0 after the parent dies, session-walk finds 6, pgrp-walk finds 4. |
| **Daemonized (`setsid`) descendants** | **While alive: yes (ppid/children). After re-parenting: no** | measured: new session, new pgrp, `tty=0` | Ancestry is the *only* link. So the orphan record must be kept in-process, not re-derived. |
| **Process identity** | **Yes, collision-free** | **`(pid, starttime)`** — `stat` field 22, jiffies since boot, monotonic | The only PID-reuse-proof key. Verified: 3 identical processes differ only in `starttime`. `pidfd_open()` is stronger but Node does not expose it. |
| **CPU (instantaneous)** | **Yes, exact** | Δ(`utime`+`stime`) over Δwall / (`CONFIG_HZ`) | Verified `HZ=100` via `getconf CLK_TCK`; measured 81% true vs 80.1% reported by `ps` at etimes=1. |
| **User vs kernel CPU** | **Yes** | Δ`utime` vs Δ`stime` separately | Free — same field pair. |
| **Per-thread CPU** | **Yes, cheap** | `/proc/<pid>/task/<tid>/stat` | Measured 0.72 ms for a **64-thread** opencode → on-demand only. Distinguishes "GC thread pegged" from "one hot worker". |
| **RSS** | **Yes, free** | `stat` field 24 `rss_pages` ×4 KB (one read, same read as CPU) | Exact current value. |
| **PSS / USS** | **Yes, expensive** | `/proc/<pid>/smaps_rollup` | **PER-PID ONLY — no aggregate tree PSS exists.** Measured **1023 ms for 266 pids (≈1 full core)**; 280 ms for 10 tracked. Must be low-frequency or on-demand. Correct by construction (kernel splits shared pages N ways). |
| **Swap (per process)** | **Yes** | `smaps_rollup: Swap` | Only via `smaps_rollup` → on-demand tier. |
| **Host swap** | **Yes, free** | `/proc/meminfo: SwapTotal/SwapFree` | One 1.5 KB read. Currently **never read**. |
| **Host RAM** | **Yes** | `MemAvailable`; `os.freemem()` already == it | Correct today; keep, and add swap + `Shmem`. |
| **Threads** | **Yes** | `stat` field 20 | Free, same read. |
| **FD count** | **Yes** | `readdir /proc/<pid>/fd` | ~17 ms/685 pids measured → tracked pids only. |
| **I/O** | **Yes** | `/proc/<pid>/io` (deltas only) | 0.005 ms/read. `read_bytes` = real disk; `rchar` = churn. |
| **State (R/S/D/Z/T)** | **Yes** | `stat` field 3 | Free. `D` = uninterruptible = **the filesystem-bottleneck signal**; `Z` = a leaked child nobody reaped. |
| **Lifetime** | **Yes** | now − `starttime` | Free, and answers "is Git stuck?". |
| **Short-lived processes** | **Partially** | 1 Hz scan sees those alive >1 s | Measured: needs ≤20 ms sampling to catch a 60 ms process. Below ~500 ms, you are in eBPF/audit territory. **Honest answer: polling cannot see a process that lived 200 ms, and no amount of procfs tuning fixes that.** |
| **Portability** | — | everything above is Linux-specific except RSS/priority on other OSes | Today's `ps` approach is nominally cross-platform (with a Windows branch). Direct procfs is not — the honest trade is **one correct Linux path + a clearly-labelled reduced fallback**, rather than two mediocre ones. |

---

## F. Recommended metric set

Every item must answer *"which debugging decision does this enable?"*

### Essential (every tick, every tracked process)
| metric | source | decision it enables |
|---|---|---|
| `cpu_pct` (Δutime+Δstime) | stat 14,15 | "is it CPU-bound right now, and by whom" |
| `cpu_user_pct`, `cpu_sys_pct` | Δ14 vs Δ15 | "kernel thrash / syscall storm" vs "actually computing" |
| `cpu_cumulative_sec` | stat 14+15 | "how much total work has this workspace done" |
| `rss_bytes` | stat 24 | the honest instantaneous resident set |
| `swap_bytes` | meminfo (host) + smaps_rollup (proc, on-demand) | "is this process being paged out" — **100% full on this box** |
| `thread_count` | stat 20 | thread leak; opencode already runs 44–64 |
| `state` | stat 3 | `D` = disk stall, `Z` = unreaped zombie |
| `start_jiffies` + `pid` | stat 22 | collision-free identity, lifetime |
| `ppid`, `pgrp`, `session`, `tty_nr`, `tpgid` | stat 4,5,6,7,8 | attribution + orphan rescue + CLI identification |

### Useful (cheap, low rate, or on demand)
| metric | tier | decision |
|---|---|---|
| `pss_bytes`, `uss_bytes`, `pss_file`, `pss_shared` | on-demand / 30 s | "is the 1.3 GB real, or shared pages counted twice" — the exact question in the brief |
| `peak_rss` (VmHWM or in-app max) | 30 s | "has it ever been this big" |
| `rchar_rate`, `read_bytes_rate` | on-demand | "is it churning the FS / hitting the disk" |
| `fd_count` | on-demand | "file-handle leak" |
| per-thread `Δutime` top-5 | on-demand | "GC thread pegged vs one hot worker" |
| `exe` (readlink) + `cmdline` | on-demand, cached per pid+starttime | "which binary is this really" |
| `processes_spawned_last_60s` | derived from create/exit events | "is it forking-storming" |
| `longest_lived_child` + name | derived | "is Git stuck" |

### Optional (nice, defer)
GPU per workspace (needs device-level attribution — a lot of work for a metric that is usually 0 here); cgroup `memory.current` (only meaningful if you wrap workspaces in transient scopes — a bigger design change); `oom_score` / `oom_score_adj`.

### **Do not track**
| metric | why not |
|---|---|
| **VSZ / VmSize** | **measured: `VmSize 1423416 kB` with `VmRSS 63420 kB`** — 1.4 GB of *virtual* for a 63 MB process, because Node reserves ~800 MB arenas it never touches. It would swamp every display and invite wrong conclusions. |
| **RSS-sum as the headline "RAM"** | proven to overstate; keep it only as a labelled secondary. |
| **`ps pcpu`** | wrong by construction (C.1). |
| **full `smaps` parse** (non-rollup) | same data, far larger. |
| **`/proc/<pid>/maps` parsing** | to attribute memory to modules — enormous cost, near-zero diagnostic yield for "which process eats RAM", which the AI already knows. |
| **per-thread CPU every tick** | 0.72 ms per 64-thread process. On-demand only. |
| **CPU affinity / core count per workspace** | noise for these workloads. |
| **`loadavg` as a per-workspace metric** | host-global; belongs to `console:metrics`, not to a workspace. |
| **syscall tracing / strace / eBPF** | root, high risk, huge cost. Out of scope. |

---

## G. Recommended process attribution architecture

### G.1 Anchor at spawn, with the kernel's own identifiers

`forkpty()` (verified) makes the child shell a **session leader and pgroup leader on a fresh pts**. So the moment `pty.spawn` returns, `proc.pid` alone yields a complete identity set for free:

```
read /proc/<shellPid>/stat  ->  pid, ppid, pgrp (== pid), session (== pid),
                                tty_nr (fresh pts), starttime, utime, stime, rss, threads, state
```
Store all of it, **persist `pid`, `starttime`, `pgrp`, `session`, `tty_nr` in `terminal_sessions`** (new columns, `ALTER TABLE ... try/catch` per this repo's existing migration style). This is the single highest-value change: it is what makes attribution survive a restart and makes PID reuse detectable.

### G.2 Three-tier sampling (measured costs)

| tier | mechanism | interval | measured cost |
|---|---|---|---|
| **T1 hot** | walk tracked trees via `/proc/<pid>/task/<tid>/children`; read `stat` per member | **1 Hz while an agent is `busy`, 0.25 Hz when idle** | **6.9 ms / 0.69% of one core @1 Hz** for 10 trees / 55 procs |
| **T2 cold** | full `readdir /proc` + `stat` per pid | **every 10 s** | 14.9 ms → **0.15% amortized** |
| **T3 on-demand** | `smaps_rollup`, `cmdline`, `exe`, `task/<tid>/stat`, `io`, `fd` | only when the AI asks, or a 30 s rotation for tracked roots only | 28 ms per pid for PSS |

**T2 exists for two reasons T1 cannot serve:** (a) orphan rescue needs a *global* view to re-associate a reparented process with a dead session's `session`/`pgrp`; (b) it discovers terminals the app did not spawn (a Konsole tab running opencode), which is how "is this opencode even mine?" gets answered. Without T2 the system is blind outside its own spawn tree.

### G.3 The CLI identification rule (no name matching)

```
foreground = procs on the shell's tty_nr whose pgrp == the shell's tpgid
if foreground's pgrp leader != shell.pid  ->  that IS the running CLI
if foreground's pgrp leader == shell.pid  ->  no agent running (shell at prompt)
```
Verified: pts/10 → `tpgid=254616` = `opencode`, and that pgrp holds opencode + probe + 2×npm + 2×MCP (7 procs), with bash as the only background member. **Three concurrent opencodes stay distinct because this is keyed on pgrp/session/pts, never on a name.**

Fallback when the CLI does not setpgid: among descendants of the shell, the agent is the one with `pgrp == pid` and the latest `starttime`. Still name-free.

### G.4 Tree semantics — the application/workspace split

```
application  = the CLI process only
             -> "OpenCode: 1.1 GB, 61 threads, 0% CPU"

workspace    = application + all descendants, aggregated correctly:
   - tree PSS   = Σ PSS(each proc)          <-- additive-correct, matches what freeing it returns
   - tree RSS   = Σ RSS(each proc)          <-- keep, but LABELLED "overstates by X"
   - owner charge= RSS(application) + Σ PSS(descendants)
```
Report **all three**. The AI needs `pss_sum` to answer "is 1.3 GB real" and `rss_sum` to recognise the existing number during migration.

**CPU must never be summed as percentages.** `ps pcpu` summing is meaningless; with true deltas, `tree_cpu = Σ proc_cpu` is valid and `application_cpu` is a subset — so "is the CPU in opencode or in a child" becomes a subtraction.

### G.5 Multi-instance, orphans, teardown

- **Identity key everywhere: `${pid}:${starttime}`.** On every tick, if a tracked pid's `starttime` changed, it is a *different process* — drop it and report `pid_reused`.
- **Orphan state is retained, never discarded.** On root exit, keep the last-known child set and re-verify liveness each tick for N seconds. Report them as `orphans: [...]` with their own PSS/RSS so "the CLI died and left 541 MB running" is answerable. This inverts today's behaviour, which reports `memMB: 0`.
- **Rescue by `(session, pgrp)`** during T2 for processes whose ancestry is gone — measured to recover 100% of the surviving set in the kill test. `setsid` daemons are the documented exception; flag them as `attribution: "ancestry-only"`.
- **Teardown:** on `terminal:destroy`, record the tree, then kill leaves-first so no intermediate orphan is created.

### G.6 Preserve, don't replace

Keep the existing channel names and push model — extend the payload. `terminal:resource-stats` gains fields; `PerformanceMetricsPanel` and `SessionResourceStats` keep working (old fields still populated), so this is additive and the UI can be upgraded in a later phase without touching main's sampler contract.

---

## H. Recommended AI diagnostic schema

Designed so that every field answers a question in the brief. Kept deliberately small — the AI needs a *verdict-carrying* document, not a metric dump.

```jsonc
{
  "workspace_id": "term-1759823...-a1b2c3d4e",
  "session_id": "session-...",
  "agent": { "declared": "opencode", "resolved_by": "foreground-pgrp",
             "confidence": "high", "note": "differs from declared" },

  // G.3 output — how we know which process is the CLI
  "identity": {
    "pty": "/dev/pts/10",
    "session_id_os": 254117,          // POSIX session
    "pgrp": 254616,                   // foreground pgrp == the CLI
    "shell_pid": 254117, "shell_start_jiffies": 1198366,
    "emulator": null                  // null is CORRECT for app-spawned PTYs
  },

  "application": {                    // THE CLI ALONE
    "pid": 254616, "name": "opencode", "start_jiffies": 1198400,
    "rss_mb": 894.6, "pss_mb": 878.4, "swap_mb": 49.3,
    "cpu_pct": 3.1, "cpu_user_pct": 2.4, "cpu_sys_pct": 0.7,
    "cpu_cumulative_sec": 8412.0,
    "threads": 61, "state": "S",
    "lifetime_sec": 3944, "fd_count": 312
  },

  "workspace": {                      // CLI + ALL DESCENDANTS
    "process_count": 8, "thread_count": 106,
    "pss_mb": 1140.0,                 // PRIMARY RAM
    "rss_mb": 1158.1,                 // secondary, labelled
    "rss_overstatement_mb": 18.1,     // so the AI can explain the gap
    "swap_mb": 83.6,
    "cpu_pct": 5.4, "cpu_user_pct": 4.1, "cpu_sys_pct": 1.3,
    "share_of_host_cpu_pct": 0.34,
    "share_of_host_pss_pct": 3.6
  },

  // NEW — the section the brief asks for and the app cannot produce today
  "breakdown": {
    "by_role": { "cli": 878.4, "mcp_server": 148.8, "package_runner": 97.2,
                 "cli_tool": 15.3, "other": 0.3 },   // pss_mb
    "by_role_note": "role is a HINT from argv[0]/exe, not an identity claim",
    "children": [
      { "pid": 254802, "name": "shadcn-mcp", "role": "mcp_server",
        "ppid": 254616, "pss_mb": 95.4, "cpu_pct": 0.4, "threads": 7,
        "lifetime_sec": 3387, "state": "S",
        "cmdline": "node .../_npx/d66c5096c.../shadcn mcp" },
      { "pid": 254788, "name": "playwright-mcp", "role": "mcp_server",
        "pss_mb": 53.4, "cpu_pct": 0.0, "threads": 7, "lifetime_sec": 3387 },
      { "pid": 254678, "name": "npm", "role": "package_runner", "pss_mb": 48.5, "threads": 11 }
    ]
  },

  // G.5 — retained instead of zeroed
  "orphans": [ { "pid": 318211, "name": "node", "pss_mb": 541.0,
                 "former_parent": 318210, "alive_sec": 74,
                 "attribution": "session-rescued" } ],

  "history": {                        // downsampled, see G.4
    "window_sec": 1800,
    "samples": 30,
    "pss_mb_series": [1140, 1138, 1141, 1139, 1140, 1140],
    "peak_pss_mb": 1163.0,
    "growth_mb_per_min": 0.4,
    "growth_verdict": "stable",        // stable | growing | leaking | shrinking
    "leak_confidence": "high",
    "cpu_p95": 12.1, "peak_cpu_pct": 94.0,
    "spawns_last_60s": 0, "exits_last_60s": 0,
    "sample_coverage_pct": 100
  },

  "host": {
    "cpu_pct": 34.2, "cpu_count": 16,
    "mem_total_mb": 31686, "mem_available_mb": 2188, "mem_pct_used": 93.1,
    "swap_total_mb": 8192, "swap_used_mb": 8192, "swap_pct_used": 100.0,  // <-- would have predicted the OOM
    "load_avg_1m": 6.2, "oom_kills_24h": 12
  },

  // the thing an AI actually acts on
  "findings": [
    { "code": "SWAP_SATURATED", "severity": "critical",
      "evidence": "host swap 100% (8192/8192 MB) while mem_available=2188 MB",
      "why_it_matters": "anonymous pages are being paged out; next allocation spikes for OOM",
      "next_probe": "workspace.breakdown.by_role" },
    { "code": "MCP_SHEAVY", "severity": "info",
      "evidence": "2 MCP servers = 148.8 MB PSS, alive 3387 s, 0 spawns",
      "why_it_matters": "13% of the workspace for tooling that was idle",
      "next_probe": "on_demand_threads" }
  ],

  "provenance": {
    "sampler": "procfs", "tiers_run": ["T1", "T2"],
    "pss_measured": true, "pss_age_sec": 12,
    "pss_stale": false,             // <-- AI must know if it is reading a stale PSS
    "scan_gap_sec": 9.4,            // blind window (for short-lived procs)
    "sampler_overhead_cpu_pct": 0.84
  }
}
```

**Rules the schema enforces:**
1. `pss_stale` / `scan_gap_sec` are mandatory. A monitoring system that cannot say *how fresh it is* will make the AI confident about a number it should hedge.
2. `growth_verdict` is a computed verdict, not raw samples — that is what lets "is this a memory leak?" be a lookup. `peak + series + window` are included so the verdict is auditable.
3. `role` is explicitly a hint; `identity` is the fact. Conflating them is how a monitoring system starts lying.
4. `by_role` exists because "which process is consuming the RAM" is answered in one line, not by reading `children`.

---

## I. Monitoring overhead

### Measured on this box (685 processes)
| operation | ms/tick | % of one core @1 Hz |
|---|---|---|
| `readdir /proc` only | 1.1 – 1.9 | 0.11 – 0.19% |
| `readdir` + `stat` per pid (whole box) | 13.6 – 14.9 | **1.36 – 1.49%** |
| `statm` per pid | 9.4 | 0.94% |
| `cmdline` per pid | 11.5 | 1.15% |
| `readlink exe` per pid | 17.3 | 1.73% |
| **`smaps_rollup` per pid (whole box)** | **1023** | **≈100%** |
| `smaps_rollup` × 10 tracked | 280 | 28% |
| **`children`-walk, stat+statm, 11 roots / 55 procs** | **6.9** | **0.69%** |
| `ps -eo pid,ppid,rss,pcpu` (fork+exec) | **37.7** | **3.5%** |
| `stat` × 10 tracked | 0.18 | 0.02% |
| `statm` × 10 tracked | 0.10 | 0.01% |
| thread scan, 64-thread opencode | 0.72 | on-demand only |
| `/proc/<pid>/io` | 0.005 | free |

### The target, and why it is the right target
The brief suggests "comfortably below ~1% CPU". Stated precisely, the right unit is **% of one core**, and it must be qualified by scope:

> **T1+T2 steady-state ≤ 0.85% of one core, measured, at 1 Hz with 10 workspaces; zero when no terminal exists.**

Rationale: (a) 0.85% of one core on a 16-core box is **0.05% of the machine** — invisible; (b) the number must be *measured and published in the payload* (`provenance.sampler_overhead_cpu_pct`) so the AI can tell whether to trust the sample; (c) a target expressed as "% of machine" would be misleadingly easy on many-core boxes, and "% of the whole box's total capacity" hides the fact that the Electron main process is single-threaded and could be blocked by a 15 ms synchronous scan.

### The decisions that get there
1. **`children` file, not a full scan, for the hot tier** — the single biggest win, and it is also *more correct* (kernel-maintained, no scan gap for direct children).
2. **Full scan at 10 s, not 1 s** — amortised 0.15%, and it only exists for orphan rescue + foreign discovery, neither of which is per-second work.
3. **Adaptive cadence** — 1 Hz only while an `AgentState.phase` is `busy`; 0.25 Hz when idle. Most sessions are idle most of the time.
4. **Never `smaps_rollup` on a timer** — 1023 ms for the whole box is disqualifying. On-demand, or a 30 s rotation for tracked roots only (28 ms each ⇒ 10 roots = 280 ms / 30 s = **0.93% amortised**; keep it off by default and let the AI request it).
5. **Cache the immutable parts** — `cmdline`/`exe` are re-read only when `(pid, starttime)` changes. That is 100% effective because both are immutable for the life of a process.
6. **Do no work when there is nothing to watch** — `__sampleTerminalStats` already early-returns on an empty Map; keep that and extend it to "no live terminals ⇒ no timer".
7. **Read synchronously but off the critical path** — a 7 ms sync loop in the main process is fine; a 1100 ms `smaps_rollup` loop is not, and must be chunked or deferred to a `setImmediate` chain.

### Cost of the *current* system, for comparison
`ps` fork+exec every 3 s = **37.7 ms / 3 s = 1.26% of one core**, plus one fork+exec per tick, plus `__sumProcessTree`'s **O(N) rescan of the whole process map per visited node** (main.ts:14759) — for 55 procs in a tree that is ~3000 map iterations per tick, growing as O(procs × tree size). So the current sampler is both **more expensive than the recommended hot tier** and **wrong**. That is the strongest possible argument for the change: it is not "better monitoring at higher cost", it is better monitoring at *lower* cost.

---

## J. Implementation plan

Phased so each phase is independently verifiable and each fixes a class of user-visible wrongness. No phase requires a build by an agent (§0-0 — CZ builds); each is verified with scoped `tsc` + `esbuild --bundle --outfile=/dev/null` on its own files plus a numeric probe.

### Phase 0 — Stop the bleeding (pure bug fixes, ~60 lines, no new module)
Fixes C.9 (`memPct ×100`), C.12 (`getResourceStats` returns nothing, dead `terminal_bindings.session_id`), C.8 (make `_lastCpuTimes` per-caller, or have one sampler and share the result). Add `/proc/meminfo` `SwapTotal`/`SwapFree` to `console:metrics` and surface it — **this is the single highest-value line in the whole plan**, because on this box it is the metric that would have predicted 12 OOM kills.
*Verify:* probe that `console:metrics` returns non-zero swap and that memPct renders ≤ 100.

### Phase 1 — Identity, made durable
New `terminal_sessions` columns: `pid`, `start_jiffies`, `pgrp`, `session_id_os`, `tty_nr`, `spawned_at` (additive `ALTER ... try/catch`, matching this repo's migration style). Write them at spawn in `terminalManager.spawn` from one `/proc/<pid>/stat` read. Rehydrate on app start for sessions marked active. Expose `spawnedPid` on `agent:get-status` for real.
*Verify:* numeric probe — spawn a PTY, kill the app-side Map, reload from DB, re-derive the same identity; and assert a `starttime` change is detected as `pid_reused`.

### Phase 2 — The procfs sampler (`src/main/procmon/`)
Extract the sampler out of the 30,836-line `main.ts` into a dedicated module. Replace `ps` with `readdir` + `stat`; implement T1 (`children`-walk) and T2 (full scan, 10 s); adaptive interval keyed on `AgentState.phase`. Keep the `terminal:resource-stats` channel and **extend** the payload (old fields still emitted) so no UI change is required in this phase. Keep the Windows branch as-is and label it `sampler: "windows-fallback"` so the AI knows the numbers are weaker there.
*Verify:* `children`-walk and ppid-walk return the **identical pid set** over 200 samples (assert the property, not a hand-typed list); measure sampler overhead and assert < 1% of one core.

### Phase 3 — Correct CPU, and the application/workspace split
Per-process `Δutime`/`Δstime` at `CONFIG_HZ` (read `getconf CLK_TCK`, do not hardcode 100). Tree CPU = sum of per-process rates. Split `application` (CLI) vs `workspace` (CLI + descendants), and add `cpu_user_pct`/`cpu_sys_pct`. Implement G.3 (foreground-pgrp CLI detection) with the pgrp-leader fallback.
*Verify:* probe a known 100% burner — assert measured ≈ 100% within tolerance, and assert a *long-idle* process reports ≈ 0 (this is precisely what `ps pcpu` gets wrong, so it is the regression test that matters).

### Phase 4 — Orphans, exit events, and the application-vs-workspace UI
Retain the last-known child set on root exit; add T2 session/pgrp rescue; report `orphans[]` with their own PSS/RSS. Emit process create/exit events with `(pid, starttime, ppid, role)`. Replace the `alive:false → memMB:0` behaviour. Then update `SessionResourceStats` and `PerformanceMetricsPanel` to render application vs workspace, and stop summing across terminals.
*Verify:* spawn a shell → child, SIGKILL the shell, assert the orphan is reported with its real RSS (today it reports 0) and that `ppid-walk` alone would have found 0 — i.e. prove the rescue path is what works.

### Phase 5 — History and verdicts
Main-process downsampled ring: 1 Hz × 5 min → 10 s × 1 h → 60 s × 24 h. Per-session `peak_pss`, linear-regression slope, `growth_verdict`, `leak_confidence`, `cpu_p95`. Persist 1-minute rollups to a new `terminal_resource_rollups` table so a **fresh AI session can see the last hour** — this is what makes Case A vs Case B in the brief distinguishable across restarts, and it is the answer to "is this a leak".
*Verify:* feed a synthetic 400 MB→2.0 GB ramp and a flat series; assert `growth_verdict` is `leaking` on the first and `stable` on the second, and that both survive a process restart via the rollup table.

### Phase 6 — On-demand depth (only if the AI actually asks)
PSS via `smaps_rollup` (request-triggered + 30 s rotation for roots only), per-thread CPU top-5, `/proc/<pid>/io` rates, fd counts. All behind one `terminal:inspect-process` handler with an explicit `depth` parameter, so the cost is never paid implicitly.
*Verify:* assert a full `inspect-process` on a 64-thread, 900 MB opencode returns in < 100 ms and that the periodic loop never calls it.

### Phase 7 — Fix the Penguin Console's honesty problems
Separate from monitoring but in scope for the brief: (a) `shell.ts SPECIAL_COMMANDS` must stop returning fabricated `ps`/`free`/`top` output in REAL mode — either execute for real or say `not available in this surface`; (b) make the "System" tab (`SysPanel`) state plainly that panes are one-shot `terminal:exec` processes with no persistent PID, instead of describing persistent node-pty panes that do not exist.

### Explicitly NOT in scope
Rewriting `/terminal` or `/penguin-console`; per-process GPU attribution; cgroup wrapping; eBPF/strace; persisting full per-tick samples indefinitely; any change to the agent FSM or the page registry.

---

## Limitations I want on the record now, before implementation

1. **Polling cannot see a process that lived less than the sample interval.** A 200 ms `git` invocation is invisible at 1 Hz. Fixing this needs eBPF or audit — out of scope. The schema's `scan_gap_sec` exists so the AI never over-claims.
2. **PSS is per-process and expensive** (28 ms per process here; 1023 ms for the box). There is no aggregate tree-PSS syscall, so an exact workspace PSS is N reads. That is why it is on-demand.
3. **`setsid` daemons that outlive their parent are unattributable.** Ancestry is the only link and it is gone. The schema marks them `attribution: "ancestry-only"` rather than guessing.
4. **"Terminal emulator overhead" does not exist for app-spawned sessions** — they are emulator-less by construction. The metric is only meaningful for terminals the *user* launched outside the app, which the T2 scan can discover. If you want Konsole-vs-app comparison, that is a separate feature, not a fix.
5. **No app-spawned PTY has a per-pane process on `/penguin-console`**, so per-pane resource telemetry there is not implementable without changing that surface from one-shot `exec` to persistent PTYs. That is a product decision, not a monitoring fix.
6. **Direct procfs is Linux-only.** The honest trade is one correct Linux path plus a visibly-labelled weaker fallback, rather than preserving a cross-platform abstraction that is wrong on the platform that matters.
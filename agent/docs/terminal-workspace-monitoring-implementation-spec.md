# Terminal Workspace Resource Monitoring — IMPLEMENTATION PHASE

The previous agent completed the full resource-monitoring audit.

That audit was explicitly read-only and modified **zero source files**. It measured the current implementation on Fedora 44 / Wayland with 10 concurrent OpenCode trees and established the Linux process/session model, resource-accounting problems, sampler costs, and implementation phases.

You are now authorized to **START IMPLEMENTING the monitoring architecture**.

Do not redo the entire audit from scratch.

Use the audit findings as the implementation baseline, but verify relevant assumptions against the current working tree before modifying code.

The goal is:

> Build a highly accurate, low-overhead Linux terminal/process observability layer that can reliably attribute resource usage to an individual Terminal Workspace and its CLI/TUI process tree, while exposing structured diagnostics that another AI can use to debug resource problems.

The objective is NOT maximum telemetry.

Every metric must have a clear diagnostic purpose.

---

# 1. Non-negotiable implementation principles

## 1.1 Preserve the existing architecture where possible

Do not rewrite unrelated Terminal Workspace functionality.

Do not redesign the application.

Do not replace working UI components merely because a cleaner implementation is possible.

Make the resource monitoring architecture substantially better while keeping existing APIs/channels compatible where reasonably possible.

Prefer additive changes first.

---

## 1.2 Do not identify applications by executable name

Do NOT build attribution around:

```text
process.name === "opencode"
```

or:

```text
cmdline.includes("opencode")
```

Multiple instances of the same CLI can exist simultaneously.

The primary identity must come from Linux process/session/PTY relationships.

Executable name/cmdline may be retained as descriptive identity metadata, but not as the fundamental workspace identity.

---

# 2. Implement the process identity model

The current architecture stores the PTY shell PID.

That remains useful.

Build a proper identity model around:

```text
workspace_id
shell_pid
shell_starttime
session_id
process_group_id
tty_nr
foreground_process_group_id
foreground_pid
foreground_starttime
cli_identity
```

The stable process identity must be:

```text
pid + starttime
```

Never use PID alone as a persistent process identity because PIDs can be reused.

Represent this explicitly in code rather than passing raw numeric PIDs throughout the monitoring system.

---

# 3. Terminal / PTY / shell / CLI model

The conceptual hierarchy must be:

```text
Terminal Workspace
    │
    └── PTY / terminal session
          │
          └── shell
                │
                └── foreground CLI/TUI process group
                      │
                      ├── child
                      ├── child
                      └── descendant
```

For app-created terminals, do not invent a terminal-emulator process when none exists.

The application uses `forkpty()`.

Therefore, distinguish:

```text
external terminal
```

from:

```text
app-created PTY
```

For an internal Terminal Workspace:

```text
workspace
→ PTY
→ shell
→ foreground process group
→ CLI
→ descendants
```

For externally launched terminal sessions, an emulator process can be discovered when it actually exists.

Do not force an emulator metric into the internal workspace abstraction.

---

# 4. Foreground CLI detection

Implement Linux foreground process detection using the controlling terminal and process-group information.

The audit established that:

```text
tpgid
```

can identify the currently foreground process group for the PTY.

Use this to determine whether a CLI is currently running without depending on the executable name.

The important behavior is:

```text
shell is foreground
    → no active CLI

OpenCode becomes foreground
    → foreground process group changes

OpenCode exits
    → shell becomes foreground again
```

Support multiple simultaneous identical CLIs.

For example:

```text
Workspace A
  /dev/pts/10
  OpenCode PID 1234

Workspace B
  /dev/pts/11
  OpenCode PID 5678

Workspace C
  /dev/pts/12
  OpenCode PID 9012
```

These must remain completely independent even though all three processes have identical names and command lines.

---

# 5. Replace the `ps` monitoring hot path

The current Linux sampler uses:

```text
ps -eo pid=,ppid=,rss=,pcpu=
```

Do not continue using this for the hot telemetry path.

Create a dedicated Linux process-monitoring module, preferably something conceptually like:

```text
src/main/procmon/
```

Keep the implementation isolated from the Terminal Workspace UI.

Use `/proc` directly.

The audit already established that targeted process-tree traversal is materially cheaper than the current `ps` approach.

---

# 6. Hot sampling architecture

Implement a three-tier sampler.

## T1: HOT

Used continuously for active workspaces.

Target:

```text
1 Hz while busy
0.25 Hz while idle
```

The exact adaptive implementation can be chosen based on the existing application architecture.

T1 should use cheap `/proc` data only.

It should collect at minimum:

```text
CPU delta
RSS
swap
process state
process count
thread count
process identity
process relationships
```

Do not perform expensive `smaps` operations here.

---

# 7. Efficient process-tree traversal

Do NOT scan the entire `/proc` directory for every workspace every second.

Use the measured mechanism:

```text
/proc/<pid>/task/<tid>/children
```

to discover descendants from tracked roots.

Recursively walk only the relevant tree.

The intended complexity should be approximately:

```text
O(number of tracked processes)
```

rather than:

```text
O(number of processes on the entire machine)
```

Cache data that can safely be cached.

Avoid spawning subprocesses such as `ps` for every sample.

---

# 8. Correct CPU measurement

The current Linux `ps pcpu` value is a lifetime average and is therefore NOT an acceptable instantaneous CPU metric.

Replace it with delta-based CPU accounting.

Use:

```text
utime
stime
```

from `/proc/<pid>/stat`.

Use the system clock tick rate:

```text
getconf CLK_TCK
```

or the equivalent runtime mechanism.

Compute CPU usage from the difference between consecutive samples.

Conceptually:

```text
delta_cpu_ticks
÷
(HZ × sampling_interval)
×
100
```

For each process, calculate:

```text
cpu_user_pct
cpu_sys_pct
cpu_pct
cpu_cumulative
```

Aggregate CPU across workspace descendants as a rate.

Do not average arbitrary percentage values.

A workspace using multiple cores may legitimately exceed 100% of one core.

Make the unit explicit in the API/schema so an AI cannot confuse:

```text
100% of one CPU core
```

with:

```text
100% of the entire machine
```

Preserve the existing Windows delta-based approach where useful and unify the semantics between platforms where practical.

---

# 9. Correct memory model

Do NOT use RSS sum as the only workspace memory number.

Expose distinct memory concepts.

At minimum:

```text
application_rss
workspace_rss_sum

application_pss
workspace_pss

workspace_swap

rss_overstatement_mb
```

Use clear labels.

The primary workspace memory attribution should be:

```text
workspace PSS
```

when a sufficiently fresh PSS sample is available.

However:

**Do not calculate PSS with `smaps_rollup` every hot tick.**

PSS is expensive.

Use a hybrid approach:

```text
HOT
RSS + cheap memory information

PERIODIC / ON-DEMAND
PSS
```

The system must expose:

```text
pss_timestamp
pss_age_ms
pss_stale
```

An AI must never be given a PSS number without knowing how old that measurement is.

If PSS is stale:

```text
do not present it as live
```

The latest valid PSS may still be used for historical/diagnostic context.

---

# 10. Explain memory correctly

The implementation must distinguish:

```text
RSS
PSS
shared memory
anonymous memory
file-backed memory
swap
```

where the operating system exposes those values cheaply enough.

Do not expose every possible field simply because Linux provides it.

For AI-facing data, make the semantic meaning explicit.

For example:

```text
RSS
"physical pages currently resident and attributed to this process; shared pages may be counted in multiple processes"

PSS
"proportional physical memory attribution; shared pages are divided"

workspace_pss
"sum of per-process PSS attribution for the workspace tree"
```

Use actual implementation semantics, not vague labels.

---

# 11. Swap

Implement swap monitoring immediately.

At minimum collect:

```text
system_swap_total
system_swap_free
system_swap_used
system_swap_used_pct

workspace_swap
application_swap
```

Use `/proc/meminfo` for system memory/swap information.

Use the appropriate per-process `/proc` data for workspace swap.

This is a high-priority metric.

The current machine was measured with all 8 GB of swap consumed, and swap is completely absent from the current telemetry.

---

# 12. Process state

Track process state.

At minimum recognize:

```text
R
S
D
T
Z
```

Expose the state in AI-readable form.

Especially flag:

```text
D = uninterruptible sleep / likely I/O stall
Z = zombie
```

Do not merely display a single character to the AI.

Provide a semantic interpretation.

---

# 13. Thread counts

Track total thread count for:

```text
application
workspace
```

This must be cheap.

Do not scan every thread's CPU data every tick.

Thread CPU details belong in the on-demand tier.

The audit observed OpenCode trees with dozens of threads, but the current system does not track thread count at all.

---

# 14. Process attribution

For every tracked workspace maintain:

```text
application process
```

and:

```text
workspace process tree
```

Example:

```text
Workspace
│
├── shell
│
└── OpenCode
    ├── bun
    ├── git
    ├── git
    ├── MCP server
    └── other child
```

The data model must allow the UI and AI to answer:

```text
How much RAM is OpenCode itself using?

How much RAM is the whole workspace using?

Which child is consuming the most RAM?

Which child is consuming the most CPU?

How many descendants exist?

Which processes are currently alive?

Which processes appeared recently?

Which processes disappeared?
```

Do not collapse all descendants into a single opaque number.

---

# 15. Orphan detection

The current implementation incorrectly reports a dead shell as:

```text
alive: false
memMB: 0
```

even when descendants remain alive.

Do NOT zero resource usage merely because the original shell PID disappeared.

Implement orphan-aware tracking.

The system should retain the last-known workspace/process identity and attempt rescue through:

```text
session
process group
TTY
```

using a periodic cold census.

Where a process can no longer be attributed reliably, explicitly represent that uncertainty.

Never fabricate:

```text
0 MB
```

when the system actually means:

```text
shell disappeared; surviving descendants may exist but attribution is currently uncertain
```

For orphan states, expose a clear state such as:

```text
active
shell_exited
orphaned
unattributed
terminated
```

Use names appropriate to the existing codebase.

---

# 16. COLD sampler

Implement T2.

Target approximately:

```text
every 10 seconds
```

The cold sampler performs the full process census.

Its main purposes are:

1. Orphan rescue
2. Discovery of externally created terminal sessions
3. Reconciliation of process state
4. Detecting process changes that the hot tree may no longer capture

Do not run the full census at 1 Hz.

---

# 17. Short-lived process limitation

Do not pretend polling can observe every process.

A process that lives for:

```text
200 ms
```

can disappear between samples.

Document this limitation.

Do not add eBPF merely for theoretical completeness.

If future event-level process accounting is desired, leave it as a clearly separated future capability.

The current implementation should remain lightweight.

---

# 18. Application versus workspace metrics

Every resource metric that matters should support this distinction:

```text
APPLICATION
```

versus:

```text
WORKSPACE
```

For example:

```text
OpenCode RSS: 1.1 GB
Workspace RSS: 1.3 GB

OpenCode PSS: 0.9 GB
Workspace PSS: 1.1 GB

OpenCode CPU: 62%
Workspace CPU: 81%
```

This is necessary to diagnose whether OpenCode itself is heavy or whether a child process/MCP/Git process is responsible.

---

# 19. History and growth detection

The AI must be able to distinguish:

```text
stable high memory
```

from:

```text
continuously growing memory
```

Implement a lightweight history system.

Maintain a recent in-memory ring buffer.

Then persist compact rollups so that restarting the application does not erase all knowledge of recent resource behavior.

The historical layer should support at least:

```text
current
peak
average
growth rate
recent samples
```

for:

```text
CPU
RSS
PSS when available
swap
process count
thread count
```

Do not persist every raw 1 Hz sample forever.

Use a bounded ring plus compact rollups.

The important requirement is that a fresh AI session can inspect recent behavior from the last approximately hour without requiring the previous Electron process to still exist.

---

# 20. Growth verdict

Implement a computed diagnostic verdict for memory trend.

For example:

```text
stable
slow_growth
rapid_growth
insufficient_data
decreasing
```

Use names that fit the project.

Do not make the verdict opaque.

The telemetry must include the underlying recent measurements so the AI can audit why the verdict was produced.

Do not tell the AI:

```text
memory_leak: true
```

unless you have actual evidence.

A better semantic model is:

```text
growth_verdict
growth_rate_mb_per_minute
observation_window_sec
evidence
```

Then the AI can determine whether that pattern is suspicious.

---

# 21. Process creation / exit awareness

Track process creation/destruction between samples where observable.

At minimum, detect:

```text
new descendants
removed descendants
```

and expose the rate/count.

This helps answer:

```text
Is the agent spawning hundreds of short-lived processes?
```

Do not claim to have captured processes that existed entirely between samples.

---

# 22. On-demand diagnostics

Implement T3.

These metrics should only run when specifically requested by:

```text
UI
AI
debugging action
```

Potential on-demand data:

```text
PSS / smaps_rollup
USS
detailed file/shared memory breakdown
I/O statistics
FD count
per-thread CPU
top CPU-consuming threads
top memory-consuming processes
full process metadata
```

Do not put expensive diagnostics on the regular sampler.

---

# 23. I/O

Add process/workspace I/O metrics where cheap enough.

At minimum investigate:

```text
read bytes
write bytes
read rate
write rate
```

Use `/proc/<pid>/io` or the most appropriate Linux mechanism.

Keep detailed I/O in T3/on-demand unless measurements demonstrate it is cheap enough for a slower periodic tier.

The primary purpose is diagnosing:

```text
high CPU vs high I/O vs blocked process
```

not producing storage analytics.

---

# 24. File descriptors

Track FD count on-demand or in a slower tier.

This helps diagnose descriptor leaks or abnormal process behavior.

Do not continuously enumerate every file descriptor.

A count is enough for normal telemetry.

Detailed FD inspection should be on-demand.

---

# 25. AI-facing schema

Create a strongly structured internal schema.

It should contain concepts equivalent to:

```text
identity
terminal
application
workspace
process_tree
resources
history
findings
provenance
```

The exact TypeScript types are up to you.

The schema must include:

```text
process identity
pid
starttime
session
pgrp
tty
tpgid

application identification

CPU:
current rate
user rate
system rate
cumulative CPU

memory:
RSS
PSS
swap
freshness

process/thread counts

process state

history

growth verdict

sampling freshness

sampler overhead
```

Mandatory provenance/freshness metadata must include at minimum:

```text
pss_stale
pss_age_sec
scan_gap_sec
sampler_overhead_cpu_pct
```

An AI must be able to tell whether a value is:

```text
live
sampled recently
cached
stale
unknown
```

Never silently turn missing data into zero.

---

# 26. Findings system

Implement structured diagnostic findings.

Each finding should contain information equivalent to:

```text
finding
severity
evidence
why_it_matters
next_probe
```

Examples:

```text
High swap pressure detected

Workspace CPU concentrated in child process

Memory has grown continuously for 18 minutes

Shell exited but descendants remain alive

Zombie process detected

Process is blocked in D state

PSS data is stale
```

Do not hardcode conclusions that exceed the available evidence.

---

# 27. Monitoring provenance

Expose the monitoring system's own overhead.

The telemetry should contain something equivalent to:

```text
provenance.sampler_overhead_cpu_pct
```

The unit should be explicit:

```text
percent of one CPU core
```

not percent of the entire machine.

The measured design target is approximately:

```text
T1 + T2 <= 0.85% of one CPU core
```

under the audit workload.

Measure the actual implementation.

Do not claim this target is satisfied until it is benchmarked.

---

# 28. Persistence

Implement the minimum persistence necessary for resource history and identity.

The current database has no useful PID identity columns and no resource history.

Add proper persistence for:

```text
stable terminal identity
resource rollups
recent history
```

Be careful with migrations.

Do not store large raw process snapshots indefinitely.

Use bounded/compact data.

---

# 29. Existing UI compatibility

Keep the existing:

```text
terminal:resource-stats
```

channel compatible where possible.

Prefer extending the payload rather than immediately breaking consumers.

Correct the existing RAM percentage bug where the value is being multiplied by 100 twice.

The UI must not display impossible values such as:

```text
9312%
```

Resource names must also make the semantics obvious.

For example, distinguish:

```text
Application RAM
Workspace RAM
System RAM
Swap
```

Do not label an RSS sum simply as:

```text
RAM
```

without explaining what it represents.

---

# 30. Fix fabricated terminal diagnostics

Investigate:

```text
src/terminal/lib/shell.ts
```

The current real-mode handling of commands such as:

```text
ps
free
top
pgrep
```

must not return fabricated process information.

This is particularly important because AI agents operating inside the terminal may use those commands to diagnose system state.

Ensure that real mode returns actual information or delegates to the real system command.

Do not leave hardcoded fake process information in the production diagnostic path.

---

# 31. Recommended implementation sequence

Follow this order.

## Phase 0

Fix the immediate correctness defects:

```text
CPU metric semantics
RAM percentage bug
swap metrics
fabricated diagnostic command behavior
```

Do not wait until the very end for these.

---

## Phase 1

Introduce stable process identity:

```text
pid + starttime
session
pgrp
tty
tpgid
```

Persist the necessary terminal identity.

---

## Phase 2

Create the Linux `/proc` monitor module.

Replace the Linux `ps` hot sampler.

Implement:

```text
children traversal
stat
statm
status
meminfo
CPU deltas
RSS
swap
state
thread counts
```

Do this without changing the UI unnecessarily.

---

## Phase 3

Implement:

```text
foreground CLI detection
application/workspace split
process tree attribution
multi-instance correctness
```

Verify with several simultaneous identical CLI processes.

---

## Phase 4

Implement:

```text
orphan detection
cold census
process reconciliation
process create/exit tracking
```

Never turn surviving orphan resources into zero.

---

## Phase 5

Implement:

```text
history ring
persistent rollups
peak
average
growth rate
growth verdict
```

Make recent history available to a fresh AI session.

---

## Phase 6

Implement on-demand diagnostics:

```text
PSS
USS
I/O
FD count
detailed thread data
detailed process memory breakdown
```

---

## Phase 7

Polish the UI and AI integration.

Expose the important information without dumping dozens of low-value metrics into the normal interface.

---

# 32. Testing requirements

Do not declare the implementation complete merely because TypeScript compiles.

Create real Linux tests/probes for:

### Single CLI

```text
shell → OpenCode
```

Verify:

```text
CLI detected
shell distinguished from CLI
resources correct
```

### Multiple identical CLIs

Run:

```text
OpenCode A
OpenCode B
OpenCode C
```

Verify they cannot be mixed.

### Child processes

Verify attribution of:

```text
Git
Bun
Node
MCP
```

or equivalent subprocesses.

### Shell termination

Kill the shell while descendants remain alive.

Verify:

```text
workspace is not falsely zeroed
descendants remain observable
orphan state is represented
```

### CLI exit

Verify that the shell becomes foreground again and the workspace correctly transitions to no-active-CLI.

### Process PID reuse

Ensure the `pid + starttime` identity prevents an unrelated reused PID from inheriting old telemetry.

### Memory

Verify:

```text
RSS
PSS
swap
```

against `/proc`.

### CPU

Use a known CPU burner and verify measured CPU rate behaves like a rate rather than lifetime average.

### Monitoring overhead

Benchmark:

```text
0 workspaces
1 workspace
5 workspaces
10 workspaces
```

Measure the monitor's own CPU and memory consumption.

Compare against the previous `ps` implementation.

---

# 33. Build and verification discipline

After each major phase:

1. Typecheck.
2. Run relevant tests.
3. Run focused Linux probes.
4. Inspect the actual produced telemetry.
5. Verify no unrelated files changed.

Do not silently modify unrelated architecture.

Before declaring completion, provide:

```text
FILES CHANGED
DATABASE MIGRATIONS
NEW MODULES
NEW METRICS
NEW CHANNEL/API FIELDS
TESTS
BENCHMARK RESULTS
KNOWN LIMITATIONS
REMAINING RISKS
```

Also provide a before/after comparison:

```text
OLD
ps sampler cost
CPU semantics
memory semantics
orphan handling
CLI identification

NEW
/proc sampler cost
CPU semantics
memory semantics
orphan handling
CLI identification
```

---

# 34. Critical completion criterion

The final implementation should allow an AI to receive a workspace and answer questions such as:

```text
Why is this OpenCode instance using 4 GB RAM?

Is OpenCode itself responsible, or one of its children?

Is memory stable or continuously growing?

Is the machine under swap pressure?

Is CPU usage real-time or merely historical?

Is a Git/MCP/Bun process responsible?

Did the shell die while children survived?

Are these resources definitely from this workspace?

How fresh is the telemetry?

How expensive is the monitor itself?
```

If the implementation cannot answer those reliably, it is not finished.

---

# 35. Do not overbuild

Avoid adding metrics solely because they are technically available.

Do NOT add as core telemetry:

```text
VSZ
full maps parsing
full smaps parsing every tick
per-thread CPU every tick
per-workspace affinity
arbitrary kernel internals
```

unless a concrete diagnostic requirement justifies them.

The goal is:

```text
accurate
low overhead
attributable
historically useful
AI-readable
```

not:

```text
collect everything
```

---

# 36. Start now

The audit phase is complete.

Proceed with implementation.

Do not ask for permission to begin each phase.

Use the current repository as the source of truth.

When you encounter a design choice not explicitly resolved above, make the smallest change consistent with:

```text
correct attribution
low overhead
Linux correctness
backward compatibility
AI diagnostic usefulness
```

At the end, report the implementation status and evidence.

Do not claim a feature works merely because the code looks correct.

Show test/benchmark evidence for the critical monitoring paths.

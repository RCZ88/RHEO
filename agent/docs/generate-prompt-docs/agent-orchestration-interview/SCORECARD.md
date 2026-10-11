# 📊 Coordination SCORECARD — measurable, or it didn't happen

> Companion to `prompt.md`. One row per interview cycle. This file is the **only** thing that
> tells you whether the coordination system is actually improving or we are just feeling better.
> Append a row, never rewrite history. Strike through a metric that regressed — keep the evidence.

---

## Metrics — definitions and how to measure each

| Metric | Definition | How measured | Healthy | Cost of ignoring |
|---|---|---|---|---|
| **Time-to-lock** | wall-clock from first `exit=3` REFUSED → `[coord] acquired` | timestamp the two log lines; take median over the cycle | **< 30s** | This *is* CZ's complaint |
| **Poll tax** | count of `sleep && retry` iterations per blocked build | count shell invocations in the session transcript | **0** | Each poll = 1 full LLM turn + context |
| **Prompt tax** | wasted turns × avg tokens/turn | `(refusals × interval) / turn_latency` | **0** | Silent context burn; causes bad handoffs |
| **Wasted work** | tasks abandoned because the queue looked long | Q8 answer | **0** | Unbounded, invisible, never reported by agents |
| **Contention** | refusals per session that were *justified* (real conflict) | `exit=3` ÷ total refusals | **high** | Low = over-broad lock = the problem is Category A |
| **Stale locks** | locks held by a PID that no longer exists | `registry.json` + `ps -p <pid>` | **0** | Real waiting on nothing |
| **Lease loss** | file leases expired while the holder was still working | lease `since` vs holder heartbeat | **0** | **Silent corruption** — two agents, one file |
| **Concurrent `dist/` writers** | builds overlapping in `dist/` | registry history + agent reports | **0, ALWAYS** | **BLACK SCREEN.** Non-negotiable. |
| **Node procs** | `pgrep -c -f '[n]ode'` | §0.6d census | **~20** | >60 ⇒ dead sessions leaking MCP servers |
| **RAM avail** | `free -m` avail MB at build start | M1 | **> 9000** | <2000 swap-free ⇒ next build is OOM-killed |
| **Contradiction count** | auto-loaded files disagreeing on "may I build?" | M5 grep | **0** | Manufactures the entire poll tax |

---

## Cycle log

| Cycle | Date | Census | Contention | Poll tax | Time-to-lock | Lease loss | Concurrent `dist/` | Contradictions | Defects opened | Defects closed | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 2026-10-02 | 19 | — | — | — | — | 0 | **13:1 VERIFIED** | 7 | 0 | baseline |

| 1 | 2026-10-02 | **24** (+5 vs C0) | — | **55 turns** (self-reported) | **UNKNOWN** | **1 self-inflicted** (leases expired <90s, undetected) | 0 (unverified) | **13:1, but wrong side blamed** (COORD-8) | 3 (COORD-8/9/10) | 0 | census regression; contradiction re-attributed |

> **Baseline read:** 19 node procs (healthy; ~20 expected). CPU count and RAM avail not yet
> captured — run §2 M1. The two P1-correctness defects (**COORD-5**, **COORD-6**) are *verified
> in source*, not inferred, and both are silent-corruption class. That is why this file hard-gates
> on `Concurrent dist/ writers` rather than on speed.

---

## Open defects (mirror of the prompt's §4 table)

| ID | Cat | Claim | Falsifier | Priority | Cost | Status | Fixed by |
|---|---|---|---|---|---|---|---|
| COORD-1 | D | The wait is an **LLM poll loop**, not a lock wait — `acquireLock` returns `{ok:false}` instantly and `run-exclusive.mjs` exits 3 with no queue, so each retry costs a full model turn | a blocking wait exists in the acquire path | P1 waste | S | open | — |
| COORD-2 | B | **VERIFIED 13:1 contradiction.** 13 instruction files tell agents to run `run-exclusive.mjs build`; **exactly one** forbids it. `AGENTS.md` + `agent/AGENTS.md` + `MULTI_AGENT_PROTOCOL.md` + `agent/DEFAULT_SYSTEM_PROMPT.md` + `agent/skills/multi-agent-coordination/SKILL.md` + `SETUP.md` all say *run the wrapper*. `agent/MEMORY.md` [2026-10-02] says *"DO NOT RUN `npm run build` — CZ BUILDS."* **`AGENTS.md` and `DEFAULT_SYSTEM_PROMPT.md` are BOTH force-loaded into every single prompt**, so the agent reads *run the wrapper*, obeys it, gets `exit=3`, and polls. | the two files agree once read literally | P1 waste | S | open | — |
| COORD-3 | A | The `build` mutex is **wider than the hazard**: two builds with different `--outDir` never touch the same files, yet are mutually excluded | concurrent `--outDir` builds demonstrably corrupt something | P1 waste | M | open | — |
| COORD-4 | A/C | `npm run build` hardcodes `NODE_OPTIONS=--max-old-space-size=8192`; on 31GB shared, N concurrent builds is **physically impossible**, so `dist/` builds cannot be parallelised no matter how good the queue is | two 8GB builds coexist here without swap death | **unfixable** | — | by-design | — |
| COORD-5 | A | **VERIFIED IN SOURCE.** Lock liveness keys off `l.since` (**acquisition time**) in `reap()` (coord.mjs:99) and is **never refreshed by the heartbeat**: `heartbeat()` (coord.mjs:149) only calls `upsertAgent`, and re-entrant `acquireLock` preserves the original via `since: cur?.since \|\| now()` (coord.mjs:208). So a build exceeding `DEFAULT_LOCK_TTL_MS` (20 min) has its lock **reaped while it is still running**, and a second build enters `dist/`. The 30s heartbeat in `run-exclusive.mjs:74` keeps the *agent* alive but does nothing for the *lock*. | a >20-min build's lock survives in `registry.json` | **P1 correctness** | S | open | — |
| COORD-6 | B/D | `AGENT_TTL_MS = 90_000`, and the heartbeat is only ever sent by `run-exclusive.mjs`. An agent that runs `register` + `claim` and then spends 3 minutes reading files has its **agent row reaped, and with it every lease it held** (coord.mjs:93-95) — freeing files a second agent then legitimately claims. Silent two-writers-one-file. | a working agent's lease survives a 3-min silence without an explicit heartbeat | **P1 correctness** | S | open | — |
| COORD-7 | D | **There is no queue.** `acquireLock` returns `{ok:false, heldBy}` immediately; `run-exclusive.mjs:66-70` prints REFUSED and `exit(3)`. Nothing anywhere waits, orders, or times out — so *ordering is per-agent-model discretion*, which is exactly why agents collide and why nobody can say who is next. | a FIFO/ticket/priority structure exists in coord.mjs | P1 waste | M | open | — |

---

## Leaks observed (reported, never self-swept)

Per `AGENTS.md` §0.6c: these were **not started by the observing agent**, so they are reported,
not killed. Killing them would break whichever live session still holds them.

| PID | Age at capture | What | Note |
|---|---|---|---|
| 349389 / 349407 | ~41 min | `npm exec vite preview --port 4173` | `vite preview` is a named repeat offender (§0.6b). Holds port 4173 + ~48MB. Parent/child pair — kill the tree, never the leaf. |
| 359557 / 359575 | ~33 min | `npm exec vite preview --outDir /tmp/opencode/scroll-dist` | Same signature, second instance. Together the two prove the leak is **systematic, not a one-off**. |

> **Why this is a COORD defect, not just a hygiene note:** a leaked `vite preview` holds a
> **port**, so the next agent that tries to verify its own build picks a different port, gets a
> different URL, or dies on `--strictPort`. Silent verification failures get misattributed to
> the build. Same class as COORD-1: the cost lands somewhere the victim can't see it.
> Note both are `npm exec` → `sh` → `node` chains, so killing only the `node` leaf orphans `sh`.

---

## Memory metrics (added 2026-10-02 — from LAG-RCA-REPORT.md)

These gate the **freeze**, not just the wait. `MEM-*` IDs refer to that report's defect register.

| Metric | How measured | Healthy | Baseline 2026-10-02 |
|---|---|---|---|
| **Global OOM events / 24 h** | `journalctl --since -24h -k \| grep -c "oom-kill:"` | **0** | **12** ❌ |
| **Collateral desktop kills** | `… grep "Out of memory: Killed" \| grep -oE "\([a-z]+\)"` minus `node-MainThread` | **0** | **4** (code×1, electron×2, spotify×1) ❌ |
| **Peak build RSS** | needs MEM-5 build log | **< 4 GB** | **4.4–5.9 GB** (8 OOM deaths) ❌ |
| **Memory available** | `free -m` field 7 | **> 9000 MB** | **4009 MB** ❌ |
| **Swap free** | `free -m` field 3 of Swap | **> 2000 MB** | **47 MB** ❌ |
| **zram physical parked** | `/sys/block/zram0/mm_stat` field 5 | **< 1500 MB** | **4009 MB** ❌ |
| **zram `mem_limit` set?** | `cat /sys/block/zram0/mem_limit` | non-empty | **empty — unbounded** ❌ |
| **`ManagedOOM` policy present?** | `grep -r ManagedOOM /etc/systemd /usr/lib/systemd` | ≥1 hit | **0 hits** ❌ |
| **user-slice `memory.max`** | cgroup file | bounded | **max — unbounded** ❌ |
| **Builds bypassing the lock** | `grep -c coord package.json` | **≥1** | **0** ❌ |
| **Leaked `vite preview` chains** | `ps -eo etimes,args \| grep "[v]ite preview"` | **0** | **2** (3 h old) ❌ |
| **MCP enabled / npx-wrapped** | `opencode.json` → `mcp` | ≤6 / ≤4 | **13 / 11** ❌ |

> **8 of 12 memory metrics are red at baseline.** The gate that matters most is
> **Collateral desktop kills** — it is the one where the *user* pays (VS Code, Electron, Spotify
> dying mid-session). A cycle that improves OOM count while collateral stays >0 has moved half a
> number, not the one that matters.

---

## Rules for this file

1. **Never delete a row.** Strike through closed defects; append new cycles. The trend is the
   product.
2. **`Concurrent dist/ writers` is a hard gate.** If that cell is ever non-zero, the protocol has
   failed regardless of how good every other number looks. Escalate immediately.
3. **A fix that doesn't move its metric is `FIX INEFFECTIVE`,** not `fixed`. Record it. A
   dashboard that only shows wins is not measuring.
4. **Re-baseline when the machine changes** (different box, fewer agents, different RAM) — the
   numbers are not comparable across machines, and pretending otherwise manufactures
   false regressions.

### Cycle 1 — notes

- **Census regression 19 → 24.** Three `shadcn mcp` instances and two `playwright-mcp` trees =
  leaked-session signature (§0.6c). Reported, **not swept** — they belong to other sessions.
- **Swap-free 120 MB** (threshold 2000). Category C is binding, not hypothetical → COORD-10.
- **COORD-2 re-attributed.** Cycle 0 ranked it "13:1 contradiction, fix the count". Cycle 1 shows
  the count was never the problem: the two sides are *both* force-loaded, and standing instructions
  beat a dated memory line. The fix belongs in `AGENTS.md` + `DEFAULT_SYSTEM_PROMPT.md`. → COORD-8.
- **COORD-6 confirmed by self-harm.** This cycle's own agent claimed 16 paths and then read for
  >90 s without heartbeating. Leases expired, undetected, with no warning to the holder.
- **One hypothesis refuted.** "Build running with no lock held" — `scripts/build.mjs:7-31` self-locks.
  Recorded so the next cycle does not re-derive it as a corruption bug.
- **Time-to-lock left UNKNOWN on purpose.** It has never been instrumented. A guessed number here
  would be worse than a blank.
- **CZ's stated priority: app performance, not coordination.** See `RESULT.md` §B. The app-lag
  defects (`getLogs` shipping 10 MB per app-switch, Lenis scroll hijack, a 3,571-line `App()`) are
  ordinary application bugs and are tracked in the session spoke, not here.

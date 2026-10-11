# 🩺 ROOT-CAUSE REPORT — Desktop Freezes & Agent Wait Cycles

**Date:** 2026-10-02 · **Host:** `czFedora888` (Fedora 44) · **Kernel:** 6.x · **RAM:** 31685 MB · **Swap:** 8191 MB zram, **no disk swap**
**Reporter:** opencode session `opencode-coordfix-20261002` · **For:** CZ + external AI (Claude/ChatGPT)
**Change made:** **NONE.** This was a read-only investigation. One experiment was deliberately **not** run — see §9.

---

## 1. EXECUTIVE SUMMARY — what caused the lag

**The desktop freezes and the agents' wait loops are the same failure. There is one root cause chain:**

```
 ┌─ B. DOC CONTRADICTION ─────────────────────────────────────────────┐
 │  13 files say "run run-exclusive.mjs build".                        │
 │  1 file  says "CZ builds — DO NOT RUN".                            │
 │  3 of the 6 FORCE-LOADED prompt files conflict.                     │
 └──────────────────────────────┬───────────────────────────────────────┘
                                ↓
 ┌─ D. POLL TAX ─────────────────────────────────────────────────────┐
 │  Agent obeys the docs → launches an 8 GB build → lock REFUSED      │
 │  (exit 3, no queue) → `sleep 15 && retry` → launches ANOTHER 8 GB  │
 │  build 15 s later → forever.                                       │
 └──────────────────────────────┬───────────────────────────────────────┘
                                ↓
 ┌─ C. RAM WALL ─────────────────────────────────────────────────────┐
 │  8192 is a PERMISSION, not a requirement — builds die at 4.4–5.9 GB│
 │  because the SYSTEM is exhausted (only ~4 GB available).            │
 │  zram is 100% full and parks a fixed 4.0 GB of physical RAM.        │
 │  3 agents polling ⇒ repeated competing 8 GB requests.              │
 └──────────────────────────────┬───────────────────────────────────────┘
                                ↓
 ┌─ FREEZE ──────────────────────────────────────────────────────────┐
 │  Kernel global-OOM fires. zram decompress is CPU-bound and         │
 │  uninterruptible ⇒ whole desktop stalls. systemd-oomd has NO       │
 │  ManagedOOM policy ⇒ kernel picks victims by oom_score ⇒          │
 │  VS Code, 2× Electron and Spotify are killed too.                  │
 └────────────────────────────────────────────────────────────────────┘
```

> **The single most important sentence in this report:**
> **Polling does not merely waste tokens — it is a repeating OOM generator.**
> That is why "stop agents waiting" and "stop the desktop freezing" are one project, not two.

**Headline numbers**

| Metric | Value |
|---|---|
| Global OOM events, last 24 h | **12** |
| Killed: `node-MainThread` (the offender) | **8** — every one at **4.4–5.9 GB** RSS |
| Killed: **collateral desktop apps** | **4** — VS Code (412 MB), 2× Electron (312/348 MB), Spotify (248 MB) |
| **Memory available** | **~17,700 MB idle → ~4,000 MB during a build** (bimodal, swing 13.7 GB) |
| Swap free | **47 MB** during a build (**100 % used**); 8191 MB idle |
| zram physical RAM parked | **4305526784 B = 4.0 GB** (fixed tax, no `mem_limit`, no disk swap) |
| Build heap ceiling | **8192 MB permitted** — never reached; kills happened far below it |
| MCP servers | **16 configured / 13 enabled / 11 via `npx -y`** → ~22 processes per session |
| Coordination registry | reports **0 live agents** while 13 sessions are active; **`npm run build` has zero lock integration** |

> ⚠ **A single `MemoryMax` cannot fix this.** The machine swings between 17.7 GB and 4.0 GB
> available. The burst must be **bounded** (heap + cap) *and* builds must be **refused when they
> cannot fit** — see §4.2 and `MEM-9`.

---

## 2. ASSESSMENT METHOD

Applied the protocol at `agent/docs/generate-prompt-docs/agent-orchestration-interview/prompt.md`
(§2 INSTRUMENT first, §4 classify-and-rank). Read-only throughout.

| # | Evidence source | Command / path |
|---|---|---|
| M1 | Machine capacity | `free -m`, `swapon --show`, `/proc/vmstat`, `vmstat` |
| M2 | OOM events + victims | `journalctl -k --since "-24h"` |
| M3 | Heap setting | `package.json:14` |
| M4 | MCP inventory | `opencode.json` → `mcp` (tokens redacted) |
| M5 | Force-loaded instructions | `opencode.json` → `instructions` + file sizes |
| M6 | Lock semantics | `coord.mjs:99, 203-211`; `run-exclusive.mjs:64-72` |
| M7 | Process census by class | `ps -eo rss,args` classified |
| M8 | zram / cgroup / oomd policy | `/sys/block/zram0/*`, `/usr/lib/systemd/zram-generator.conf`, cgroup files, unit grep |
| M9 | Build telemetry | `scripts/build.mjs`, `build*.log` timestamps |

**Assessment result:** the protocol's own **§3 interview was mostly SKIPPED** — every question was
answerable by measurement. That is the correct outcome and it is why this report is evidence-dense
rather than interview-dense. The questions that *could not* be answered by measurement are recorded
as **UNKNOWN** in §7, not guessed.

---

## 3. DIRECT ANSWERS TO CLAUDE'S FIVE QUESTIONS

### Q1 — Where is the 8 GB heap set? Real peak? Would 4 GB work?

**Location — exactly one place in the entire repo:**

```
package.json:14
"build": "cross-env NODE_OPTIONS=--max-old-space-size=8192 vite build && node scripts/build.mjs"
```

No `.npmrc`, no `.env`, no wrapper overrides it. `grep -rn "max-old-space-size"` across
`package.json`, `*.mjs`, `*.js`, `*.sh`, `*.ps1`, `*.ts` (excluding `node_modules`) returns **one hit**.

**Real peak — from the kernel's own kill log, last 24 h:**

| anon-rss at death | total-vm | pgtables |
|---|---|---|
| 5,907,188 kB (5.9 GB) | 19.1 GB | 146 MB |
| 5,805,084 kB | 19.0 GB | — |
| 5,535,312 kB | 18.7 GB | — |
| 5,321,924 kB | 18.5 GB | 128 MB |
| 5,082,532 kB | 18.2 GB | — |
| 4,867,896 kB | 18.0 GB | — |
| 4,621,116 kB | 17.8 GB | 114 MB |
| 4,427,512 kB | 17.6 GB | — |

**Eight kills inside a tight 4.4–5.9 GB band = one workload profile, repeated.**

**The decisive detail: none of these was a V8 heap failure.** All read
`oom-kill:constraint=CONSTRAINT_NONE … global_oom` — killed by the **kernel** for system-wide
exhaustion, at RSS **far below the 8192 MB the process was permitted**.

> **8192 is a permission, not a requirement.** The build never approached the ceiling.
> It died at ~5 GB because the machine ran out, not because V8 ran out.

**Would 4 GB work? The window is bracketed by two hard data points:**

| Value | Status | Source |
|---|---|---|
| **2560 MB** | **PROVEN FAIL** — `FATAL ERROR: Ineffective mark-compacts near heap limit` | `agent/MEMORY.md` 2026-10-01 |
| **~4400 MB** | **PROVEN ALIVE** — still resident and growing when the kernel killed it for global reasons | `journalctl -k`, this report |
| **4096 MB** | **UNTESTED — and the highest-value single experiment** | — |

The requirement lies in **(2.5 GB, 4.4 GB)**. 4096 MB sits inside that window.

> ⚠ **Inference flagged, not proven.** `journalctl -k` prints no cmdline, so I cannot *prove* those
> 8 PIDs were `vite build` rather than the agent runtime. Supporting evidence is strong — the 8 GB
> heap reservation, 17–19 GB virtual, 114–146 MB of page tables (characteristic of a large heap
> reservation), the konsole-tab cgroup attribution, and `agent/MEMORY.md`'s independent record of
> vite builds dying this exact way — but it **is** inference. Fix **MEM-5** closes it definitively.

### Q2 — Which MCP servers does each session start? Which are really needed?

`opencode.json` → `mcp`. Tokens/keys **REDACTED**.

```
[1]  @21st-dev/magic     type=url     enabled   x-api-key:REDACTED
[2]  probe               type=local   enabled   node ../probe/dist/index.js
[3]  notion              type=local   enabled   NOTION_API_TOKEN:REDACTED
[4]  shadcn              type=local   enabled   npx -y shadcn@latest mcp
[5]  magicui             type=local   enabled   npx -y @magicuidesign/mcp@latest
[6]  lucide              type=local   enabled   npx -y lucide-icons-mcp
[7]  unsplash            type=local   enabled   node scripts/mcp-launcher.mjs unsplash
[8]  reactbits           type=local   enabled   npx -y REDACTED
[9]  iconify             type=local   enabled   npx -y better-icons-mcp
[10] fragments-ui        type=local   enabled   npx -y @usefragments/mcp
[11] shadcn-ui-mcp       type=local   enabled   npx -y @jpisnice/REDACTED
[12] refero-mcp          type=local   DISABLED  npx -y @refero/mcp
[13] aidesigner          type=url     DISABLED
[14] google-design-mcp   type=remote  enabled   https://design.googleapis.com/mcp
[15] google-webfonts     type=remote  DISABLED
[16] playwright          type=local   enabled   npx -y @playwright/mcp --cdp-endpoint http://localhost:9222
```

**16 configured · 13 enabled · 11 resolved through `npx -y`.**

Each `npx -y` spawns an **`npm exec` wrapper PLUS a node process** → **~22 processes per session,
not 13.** Measured live: 6 npx-resolved MCP procs = **226 MB**, 7 local (probe/launcher) = **62 MB**.

**Genuinely needed for this project:**

| Keep | Why |
|---|---|
| `probe` | the only sanctioned runtime testing path |
| `shadcn` (+ its 4 registries) | the only sanctioned way to pull real components |
| `lucide` | icons — used constantly in UI work |
| `playwright` | browser verification |

**Not needed for a local-first Electron app — pure idle cost:**

| Drop | Saving |
|---|---|
| `notion` | holds an **API token open** for a service this project does not sync to |
| `unsplash` | stock photos, not used by any feature |
| `iconify` | `lucide` already covers icons |
| `fragments-ui` | unused registry |
| `@21st-dev/magic` | remote, unused |
| `shadcn-ui-mcp` | duplicates `shadcn` |
| `google-design-mcp` | remote, unused |

≈ **7 servers × ~2 procs × ~40 MB ≈ 560 MB per session of pure idle overhead**, multiplied by every
concurrent session. `google-webfonts`, `refero-mcp`, `aidesigner` are already disabled — that part
is correct.

### Q3 — How many agents run at once? How many sit in the `sleep 15` retry loop?

```
coord.mjs status  →  AGENTS (0)    LOCKS (0)    FILE LEASES (0)
agent/state.md    →  13 sessions active within 24 h
agent/state/*.md  →  106 spokes ever written
```

> **This question cannot be answered — and that IS the finding.**

- The coordination registry reports **zero live agents while 13 sessions are recorded as active**.
  It has no live visibility into concurrency.
- The `sleep 15 && retry` loop **writes no telemetry whatsoever** — no PID, no attempt counter, no
  timestamps. You cannot count sleepers, measure how long they slept, or attribute an OOM to one.
- Live snapshot at measurement time: **31 node processes, 1131 MB** total (§4, M7).

### Q4 — Do agents also run dev servers, tests, or browsers? How many? How much memory?

| Class | Count | RSS |
|---|---|---|
| `vite dev` | **0** | — |
| `vite preview` | **3** (2 leaked, aged 3.0 h / 2.8 h; 1 fresh) | 39 + 48 + 108 = **195 MB** |
| esbuild `--service` | 3 | 18 MB |
| `playwright-mcp` | 1 pair | 47 + 51 = **98 MB** |
| **Electron app tree** | **1 running** | **315 MB** (measured 938 MB minutes earlier — see note) |
| chrome / test runner | **0** | — |
| `tsc --noEmit` | 1 transient | 241 MB |

**No `vite dev` and no test runners — that part is healthy.** Problems found:

1. **Two leaked `vite preview` servers** (`npm exec` → `sh` → `node` chains, 3 h old). `vite preview`
   is a named repeat offender (`AGENTS.md` §0.6b). They hold **ports**, so the next agent picks a
   different port, gets a different URL, or dies on `--strictPort` — silent verification failures
   that get misattributed to the build.
2. **One full Electron tree live** (315–938 MB, fluctuating) while builds may be running. Violates
   R3 (`never run the app while building`).
3. **A `probe` process alive 9.3 h** — `probe_close` was not honoured by a dead session. Holds a
   debug port and an Electron tree.

### Q5 — Is there a log of build start/end times comparable with OOM kill times?

> **NO. Such a log does not exist.**

- `scripts/build.mjs` writes **no timestamped output**. Its only `writeFileSync` is a **lock-PID
  file** (`scripts/build.mjs:25`).
- Every `build*.log` in the repo root is a **stale manual redirect**: `build2.log` (Jul 1 22:25),
  `build3.log` (Jul 1 23:14), `build4.log` (Jul 1 23:18), `build_final.log` / `build_retry.log` /
  `build_fore.log` (Aug 30).
- **Consequence:** you have the OOM kills (the kernel timestamps them) but **the builds themselves
  are invisible**. Correlation is impossible today. This is fix **MEM-5**.

---

## 4. SYSTEM CONSTRAINTS THAT MUST CHANGE

```
Mem:31685 total | 27675 used | 4009 available ← only 4 GB spare
Swap:  8191 total |  8144 used |    47 free          ← 100 % full
zram0  mm_stat: mem_used_total 4305526784 = 4.0 GB permanently parked
       (7.05 GB original → 3.89 GB compressed; fixed 4 GB tax on 32 GB)
cgroup user.slice: memory.max = max | memory.high = max | memory.swap.max = max
systemd-oomd: active, but NO ManagedOOM= directive anywhere on the system
/usr/lib/systemd/zram-generator.conf: zram-size = min(ram, 8192)
       (no mem-limit, no compression-algorithm, no writeback-device → all defaults)
/etc/fstab: no swap line → NO DISK SWAP
```

### 4.1 This is the freeze mechanism

1. Only **4 GB** is available.
2. A build is **permitted 8 GB** and will attempt to take all of it.
3. Swap is **100 % full** and held entirely in **zram**, whose decompression is **CPU-bound and
   uninterruptible**. `vmstat` confirms ongoing swapin (`si` 6–17) and **43k–59k major faults/sec**.
4. ⇒ The kernel spends its time decompressing zram. **That is the desktop freeze.**
5. Because **systemd-oomd has no `ManagedOOM` policy**, the **kernel** chooses victims by
   `oom_score`. It picked the offender 8 times (correct) — and 4 times it also killed **VS Code,
   two Electron processes and Spotify** as collateral.

**12 events, 8 offender, 4 collateral. A ManagedOOM policy would have made systemd-oomd kill only
the offender and spared all 4 collateral kills.**

### 4.2 The baseline is BIMODAL — and that changes the fix

A second measurement, taken minutes after §4.1:

```
t= 3s  avail=17685MB  swapfree=8191MB
t= 6s  avail=17640MB  swapfree=8191MB
t= 9s  avail=17667MB  swapfree=8191MB
t=12s  avail=17753MB  swapfree=8191MB
t=15s  avail=17699MB  swapfree=8191MB
t=18s  avail=17748MB  swapfree=8191MB
t=21s  avail=17752MB  swapfree=8191MB
```

| Phase | Mem available | Swap free |
|---|---|---|
| **Agent-idle** | **~17,700 MB** | **8191 MB (empty)** |
| **Build in flight** | **~4,000 MB** | **47 MB (100 % used)** |
| **Swing** | **~13.7 GB** | **8.1 GB** |

During this report's own census a process appeared at **1.67 GB RSS 66 s after start** and then
exited within ~2 min — a burst passing through. Node count barely moved (31→32); only the memory
swung. **All the figures in §4.1 were captured during a burst, i.e. in the crisis state. They are
not a steady-state baseline and must not be read as one.**

**Why this matters for the fix — it invalidates the "just pick a cap" plan:**

The machine oscillates between 17.7 GB and 4.0 GB available. So:

- A cap set to fit the burst (**10 G**, as originally proposed) is larger than the *entire* idle
  budget's headroom in the low phase → still freezes.
- A cap set to protect the desktop tightly (**3 G**) will simply fail the build, because the build
  provably needs **> 2.5 GB** and was alive at **4.4 GB**.

> **Therefore a fixed `MemoryMax` alone cannot fix this. Two things are needed:**
>
> **(a) Bound the burst** — heap `4096` + `MemoryMax=5G` (§8.2 #2).
> **(b) Refuse to start a build that cannot fit.** The lock is currently *blind to memory*: it
> serialises builds but never checks whether there is room. A build launched into the 4 GB phase is
> fatal; the same build launched into the 17.7 GB phase is fine. **The fix is admission control on
> `MemAvailable`, not a bigger number** → new defect **MEM-9**.

**Corollary for the desktop:** the burst evicts Konsole/Plasma because nothing reserves memory for
them. Giving the desktop cgroups a `MemoryMin`/`MemoryLow` floor would make the burst yield to the
desktop instead of the other way round.

### 4.3 Note on memory readings

Two snapshots minutes apart gave **2.1 GB** and **1131 MB** total node RSS, and the machine then
swung **13.7 GB** in available memory (§4.2). The machine is not in a steady state — that
instability is itself a symptom, and it is why every figure here carries its measurement time
rather than being presented as a constant.

---

## 5. OOM TIMELINE (last 24 h)

```
13:11:53  node-MainThread  5,805,084 kB   ← 3 min later:
13:15:12  node-MainThread  5,535,312 kB       a repeat 2 min after
14:37:27  node-MainThread  5,082,532 kB
16:50:11  node-MainThread  4,427,512 kB   ← 2.5 min later:
16:52:52  electron          311,976 kB       collateral
17:36:03  node-MainThread  5,907,188 kB
18:02:20  node-MainThread  4,621,116 kB
19:16:33  code              412,196 kB   ← collateral (VS Code)
19:21:39  electron          348,364 kB   ← collateral
19:21:39  spotify           248,312 kB   ← collateral
19:32:11  node-MainThread  5,321,924 kB
22:07:10  node-MainThread  4,867,896 kB
```

**The `13:11 → 13:15` (3 min) and `16:50 → 16:52` (2.5 min) pairs are the retry-loop signature** —
a build relaunching shortly after the previous one died, exactly as `sleep 15 && retry` would produce
once a build outlives the poll interval.

---

## 6. DEFECT REGISTER

### 6.1 Memory / infrastructure (`MEM-*`) — new this cycle

| ID | Cat | Claim | Evidence | Falsifier | Priority | Cost |
|---|---|---|---|---|---|---|
| **MEM-1** | C | `package.json:14` permits an 8192 MB heap on a box with **4009 MB available** — the permission can never be honoured, so it guarantees thrash | `free -m`; 8 kills at 4.4–5.9 GB, all `global_oom` | a build completes with <4 GB available | **P1 correctness** | S |
| **MEM-2** | C | `zram` has **no `mem_limit`** and **no disk swap**, so it parks an unbounded amount of physical RAM — currently a **fixed 4.0 GB** — and decompression freezes the desktop | `/sys/block/zram0/mem_limit` = empty; `mm_stat mem_used_total = 4305526784`; no swap in `/etc/fstab` | swap pressure does not reduce free RAM | **P1 correctness** | S |
| **MEM-3** | C | **No `ManagedOOM` policy exists**, so the kernel killer picks victims by `oom_score` and killed VS Code, 2× Electron and Spotify | `systemd-oomd` active; zero `ManagedOOM=` in unit files; cgroup `memory.max = max` | systemd-oomd killed only the offender | **P1 correctness** | S |
| **MEM-4** | D | **No user slice memory cap at all** (`memory.max = max`, `memory.swap.max = max`), so nothing stops one build consuming the machine | cgroup files under `/user.slice/user-1000.slice/` | a build is contained today | P1 waste | S |
| **MEM-5** | D | **`scripts/build.mjs` writes no build log** (`writeFileSync` at :25 is a lock-PID file only); all `build*.log` are stale manual redirects from Jul/Aug ⇒ **builds cannot be correlated with OOM kills** | `scripts/build.mjs`; `ls -la build*.log` | a timestamped build log exists | P1 waste | S |
| **MEM-6** | B | **`npm run build` has ZERO coordination** — `grep -c coord package.json` = **0**. The `run-exclusive.mjs` discipline is **opt-in and trivially bypassed**, so the lock protects nothing against a direct `npm run build` | `package.json` scripts; `grep -c coord package.json` → 0 | build is unreachable without the lock | **P1 waste** | M |
| **MEM-7** | D | **13 MCP servers enabled, 11 via `npx -y`** ⇒ ~22 processes and ≈560 MB of idle overhead per session, incl. an API token held open by `notion` | `opencode.json` → `mcp`; live `ps` | per-session MCP RSS is materially lower | P2 | S |
| **MEM-8** | D | **Two leaked `vite preview` chains (3 h old) hold ports**; verification then fails or silently targets a different URL, and the failure gets blamed on the build | PIDs 349389/349407, 359557/359575 | those ports are held by a live session | P2 | S |
| **MEM-9** | C | **The lock is blind to memory.** `run-exclusive.mjs` serialises builds but never checks whether the machine has room, so a build launched into the **4 GB phase** is fatal while the same build into the **17.7 GB phase** is fine. Needs **admission control on `MemAvailable`**, and a `MemoryMin`/`MemoryLow` floor for the desktop cgroups so bursts yield to the desktop, not the reverse | §4.2 bimodal sampling; `run-exclusive.mjs:47-70` has no memory precondition | a build is ever refused for lack of memory | **P1 correctness** | M |

### 6.2 Coordination (`COORD-*`) — carried from the survey

| ID | Cat | Claim | Evidence | Priority | Status |
|---|---|---|---|---|---|
| **COORD-1** | D | The wait is an **LLM poll loop, not a lock wait** — `acquireLock` returns `{ok:false}` instantly (`coord.mjs:207`); `run-exclusive.mjs:66-70` prints REFUSED and `exit(3)`. Nothing waits or orders. Each retry = one full model turn | `coord.mjs:203-211`; `run-exclusive.mjs:64-72` | P1 waste | open |
| **COORD-2** | B | **13:1 doc contradiction.** 13 files say run the wrapper; exactly 1 (`agent/MEMORY.md`) forbids it. **3 of the 6 force-loaded files conflict**: `DEFAULT_SYSTEM_PROMPT.md` (#2) and `MULTI_AGENT_PROTOCOL.md` (#6) say run it; `MEMORY.md` (#5) says CZ builds. Those 6 files inject **62 KB ≈ 16k tokens into EVERY prompt** | `opencode.json` → `instructions`; grep across `*.md` | **P1 waste** | open |
| **COORD-3** | A | The `build` mutex is **wider than the hazard** — two builds with different `--outDir` never touch the same files yet are mutually excluded | `run-exclusive.mjs`; single `dist/`-wide lock | P1 waste | open |
| **COORD-4** | C | `dist/` builds cannot be parallelised on this box at all — **physics, not a bug**. Do not attempt to "optimise" it; only schedule it or forbid it | `free -m`; `package.json:14` | **unfixable** | by-design |
| **COORD-5** | A | Lock liveness keys off `l.since` (**acquisition time**) at `coord.mjs:99` and is **never refreshed by the heartbeat** (`heartbeat()` at :149 only calls `upsertAgent`; `acquireLock` preserves the original via `since: cur?.since \|\| now()` at :208). A build exceeding `DEFAULT_LOCK_TTL_MS` (20 min) has its lock **reaped while still running** ⇒ a second build enters `dist/` ⇒ **black screen** | `coord.mjs:99, 149, 208`; `run-exclusive.mjs:74` | **P1 correctness** | open |
| **COORD-6** | B/D | `AGENT_TTL_MS = 90_000`, but only `run-exclusive.mjs` sends heartbeats. An agent that runs `register` + `claim` then reads for 3 min is reaped at :93-95 **and loses every lease it held** ⇒ a second agent legitimately claims those files ⇒ **silent two-writers-one-file** | `coord.mjs:27, 90-103` | **P1 correctness** | open |
| **COORD-7** | D | **There is no queue** — no FIFO, no ticket, no priority, no human override. Ordering is per-agent-model discretion, which is why agents collide and nobody can say who is next | absence in `coord.mjs` | P1 waste | open |

### 6.3 Priority summary

- **P1 correctness (silent corruption — fix before anything about speed):**
  `COORD-5`, `COORD-6`, `MEM-1`, `MEM-2`, `MEM-3`
- **P1 waste (this is the freeze driver):** `COORD-2` → `COORD-1`/`COORD-7` → `MEM-1`
- **P2:** `MEM-7`, `MEM-8`, `COORD-3`
- **Unfixable:** `COORD-4` — schedule it, don't optimise it.

---

## 7. UNKNOWNS — not guessed

These could not be answered by measurement and are **deliberately left blank** rather than filled
with a plausible story. They are the first questions of the next survey cycle.

| # | Unknown | Why it matters | How to resolve |
|---|---|---|---|
| U1 | **Were the 8 killed `node-MainThread` PIDs actually `vite build`?** | The whole MEM-1 conclusion rests on it | Fix MEM-5 — log PID + cmdline. Definitive. |
| U2 | **How many agents were in the `sleep 15` loop, and for how long?** | Quantifies D; currently zero visibility | Instrument the poll loop (COORD-1) or add a heartbeat log |
| U3 | **How many builds were actually launched, and when?** | Only OOM'd ones are visible; successful builds are invisible | Fix MEM-5 |
| U4 | **Does 4096 MB actually complete?** | Decides the entire heap policy | §9 — gated experiment |
| U5 | **How many concurrent sessions at peak?** | MCP cost multiplies by this | Log sessions at register time |
| U6 | **Is the Electron app intentionally running during builds?** | 315–938 MB + violates R3 | `coord.mjs status` cannot answer; needs owner input |
| U7 | **Peak RSS of a *successful* build** | All 8 samples are deaths, not completions | Fix MEM-5, then read it |

---

## 8. RECOMMENDED FIXES (ranked; **none applied — awaiting CZ approval**)

### 8.1 Correction to the proposed `MemoryMax=10G`

> **`systemd-run --user --scope -p MemoryMax=10G` must NOT ship as written.**
> Available memory is **4009 MB**. A 10 G ceiling lets the build consume 10 GB before the cgroup
> kills it — you keep **every second of zram thrashing** and only convert a *kernel* OOM into a
> *cgroup* OOM. The freeze would still happen.
>
> **The ceiling must sit inside what the desktop can actually spare: `MemoryMax=5G`.**
> And it must be paired with `--max-old-space-size=4096` so **V8 fails fast and cleanly** instead
> of the kernel killing the process ambiguously.

### 8.2 Ranked fix list

| # | Fix | Files | Moves which number | Risk |
|---|---|---|---|---|
| **1** | **Resolve the 13:1 contradiction** — pick ONE: agents build, or only CZ builds | `AGENTS.md`, `agent/AGENTS.md`, `agent/DEFAULT_SYSTEM_PROMPT.md`, `MULTI_AGENT_PROTOCOL.md`, `agent/skills/multi-agent-coordination/SKILL.md`, `SETUP.md`, `agent/MEMORY.md` | kills D at the source; removes the OOM generator | none (docs only) |
| **2** | **Heap `8192` → `4096`**, wrap build in `MemoryMax=5G` | `package.json:14` + new `scripts/build.sh` | caps peak; takes kills off the desktop | low — gated on §9 |
| **3** | **Add a build log**: PID, cmdline, start, end, exit code, peak RSS | `scripts/build.mjs` | enables all correlation; closes U1/U3/U7 | none |
| **4** | **`ManagedOOMMemoryPressure` on `user.slice`** | new `~/.config/systemd/user.slice.d/oomd.conf` | systemd-oomd kills the offender, not Spotify | none — reversible |
| **5** | **Cap zram `mem_limit`, or add real disk swap** | `/usr/lib/systemd/zram-generator.conf` (or drop-in) + `/etc/fstab` | releases part of the fixed 4.0 GB | MEDIUM — swap config can make boot worse if wrong |
| **6** | **Trim MCP 13 → ~6**; drop `notion`, `unsplash`, `iconify`, `fragments-ui`, `@21st-dev`, `shadcn-ui-mcp`, `google-design-mcp` | `opencode.json` → `mcp` | ≈560 MB/session | none — reversible, re-enable any time |
| **7** | **Make the build lock real** — `npm run build` must not bypass it (`MEM-6`) | `scripts/`, `AGENTS.md` | stops uncoordinated builds | low |
| **8** | **Fix `COORD-5` + `COORD-6`** — lock/lease liveness off heartbeat | `coord.mjs:99, 149, 208`; `coord.mjs:90-103` | eliminates silent corruption | low, but **touch a shared file** — needs a lease + CZ sign-off |
| **9** | **Sweep the 2 leaked `vite preview` chains** (kill the process **group**) | — | frees 2 ports + ~90 MB | **needs CZ authorisation** — not self-service |
| **10** | **Real queue or zero-turn wait** (`COORD-1`, `COORD-7`) | `coord.mjs`, `run-exclusive.mjs` | stops the poll tax | M |
| **11** | **Memory-aware admission control** — refuse a build when `MemAvailable` < threshold instead of launching blindly; plus `MemoryMin`/`MemoryLow` floor for desktop cgroups (`MEM-9`, §4.2) | `run-exclusive.mjs:47-70`, `coord.mjs` | stops the "launched into the 4 GB phase" failure | M |
| **12** | **Make the wait zero-turn** — waiting must be a blocking call inside one tool call, never an LLM `sleep` loop (`COORD-1`) | `run-exclusive.mjs`, `coord.mjs` | removes the poll tax at its root | M |

### 8.3 APPLIED — 2026-10-02 (CZ approved fixes 1, 3, 6)

| Fix | Status | What changed |
|---|---|---|
| **1** — resolve the 13:1 contradiction | ✅ **APPLIED** | Canonical **§0-0 BUILD POLICY (OPTION B)** added to root `AGENTS.md` as a §-0 block (before "WHO YOU ARE"), so it loads before anything else. All build-wrapper instructions removed from `AGENTS.md` (§0a, §1c, §7, §8), `agent/DEFAULT_SYSTEM_PROMPT.md`, `MULTI_AGENT_PROTOCOL.md` (§3, §4A, §5.7), `SKILL.md` (tree, table, §"queue don't race", never-do), `SETUP.md`, and `deskflow-multi-agent-coordination/AGENTS.md`. `sleep 15 && retry` explicitly banned. **Verification: 0 remaining "run the build wrapper" instructions in any instruction file** (was 6 files). |
| **3** — build log | ✅ **APPLIED** | New `scripts/build-with-log.mjs`; `package.json:14` `build` → `node scripts/build-with-log.mjs`, real command preserved as `build:inner`. Appends JSONL to `agent/logs/build.log` (already gitignored). Writes a **fsync'd `start` record before spawning** — so an OOM-killed build still leaves a pid+argv+timestamp joinable against `journalctl -k`. Samples peak RSS across the whole child **process tree** every 400 ms (V8 workers + esbuild service included). Verified end-to-end by wrapping `npm run validate:pages`: `pid=31390 exit=0 peakTreeRSS=0.16GB across 2 procs`. |
| **6** — trim MCP | ✅ **APPLIED** | `opencode.json`: **4 enabled** (`probe`, `shadcn`, `lucide`, `playwright`), **12 disabled** — flipped with `"enabled": false`, **reversible**, no credentials deleted. Round-trip verified byte-identical before writing (the file holds live API tokens, so it was edited programmatically, never by hand). |

**Not applied, by CZ's instruction:** fix 2 (heap `4096` + `MemoryMax=5G`), fix 4 (`ManagedOOM`), fix 5 (zram/swap/fstab). **`coord.mjs` was not touched** (fixes 8, 11, 12 all require editing it and are still gated on your approval).

**Consequence to be aware of:** the heap is **still 8192 MB**. The build log is what makes that decision safe — CZ's first real build now records its true peak RSS in `agent/logs/build.log`, which replaces the inferred 4.4–5.9 GB band with a measured number. **That is the input fix 2 needs.**

**Two caveats found while applying:**

1. **`opencode.json` is not git-tracked** (`git ls-files` → no match), so the MCP trim is **not** captured by a commit and would be lost if that file is ever restored from git. Worth tracking it deliberately, or documenting the enabled-set somewhere version-controlled.
2. **`AGENTS.md` §9 relies on servers I just disabled.** §9 states the shadcn MCP "browses ALL FOUR registries" (`@react-bits`, `@magicui`, `@kokonutui`, `@bklit`) and AGENTS.md §5b/§5d make `shadcn-ui-mcp` + `reactbits` + `magicui` part of the mandatory UI workflow. I followed your list exactly (`probe`, `shadcn`, `lucide`, `playwright`) and disabled the rest — **so UI work that needs React Bits / Magic UI components will lose those two MCP tools.** Re-enable `magicui` + `reactbits` on days you do UI work, or accept `shadcn` alone for the `@kokonutui`/`@bklit` registries it still covers.

### 8.4 Option B — assessment

**Option B (only CZ builds) is the right call**, with three caveats:

1. It does **not** make a build cheaper. A scratch `--outDir` build compiles the **same import
   graph** and needs the **same heap**. Option B's saving is that exactly **one** build exists at a
   time and it happens **deliberately**, not that it is lighter.
2. It must be accompanied by **fix 2** (heap + cap), or one deliberate build can still freeze the
   desktop.
3. `COORD-5` (`coord.mjs:99`) becomes **more** dangerous under Option B, because CZ's single
   deliberate build is exactly the kind that can run past 20 minutes — and when its lock is reaped
   mid-run, a second build enters `dist/`. **Fix 8 is mandatory, not optional, under Option B.**

---

## 9. THE ONE EXPERIMENT NOT RUN (deliberate)

**Would `--max-old-space-size=4096` complete a build?**

**Not run.** Reasons:
1. It is the exact operation whose failure mode is the reported symptom.
2. Memory available is **4009 MB** — an unconstrained build attempt *is* the freeze.
3. The user instruction for this cycle was **read-only: "do NOT change anything yet."**

**Recommended form when approved — bounded so it cannot freeze the desktop:**

```bash
# scratch outDir: dist/ is never touched, so a failed test cannot black-screen the app
systemd-run --user --scope -p MemoryMax=5G \
  npx cross-env NODE_OPTIONS=--max-old-space-size=4096 \
  vite build --outDir /tmp/opencode/heap4096-probe --emptyOutDir
```

**Acceptance criteria:**
- exit 0 **and** `dist` untouched **and** desktop responsive throughout
- record peak RSS (answers **U7**, the one number we do not have)
- if it fails with `Ineffective mark-compacts`, the window is `(2.5 GB, 4 GB]` — go to 5120
- if it succeeds, **8192 was never needed** and MEM-1 closes permanently

> Do **not** run this unguarded. The cap is the point — it converts a possible desktop freeze into a
> contained, attributable failure. That containment is also fix 2, so the experiment validates the fix.

---

## 10. APPENDIX — raw evidence

```
$ free -m
              total   used   free  shared  buff/cache  available
Mem:          31685  27675   1068    2689       6343      4009
Swap:          8191   8144     47

$ swapon --show
NAME       TYPE      SIZE USED PRIO
/dev/zram0 partition   8G   8G  100

$ cat /sys/block/zram0/mem_limit          # (empty = unbounded)
$ cat /sys/block/zram0/mm_stat
7572291584 4178070141 4217638912  0 4305526784  32599  283801  643652  740794
                                  ^ mem_used_total = 4.0 GB physical

$ cat /usr/lib/systemd/zram-generator.conf
[zram0]
zram-size = min(ram, 8192)      # no mem-limit, no compression-algorithm, no writeback-device

$ grep -rn "max-old-space-size" --include=package.json --include=*.mjs --include=*.js \
       --include=*.sh --include=*.ps1 --include=*.ts . | grep -v node_modules
./package.json:14:  "build": "cross-env NODE_OPTIONS=--max-old-space-size=8192 vite build && node scripts/build.mjs"

$ grep -c coord package.json
0                                        # build has ZERO coordination — lock is bypassable

$ ps -eo rss,args | grep -E "[n]ode|[e]lectron" | (classified by class)
  MCP via npx -y (2 procs each)        226 MB
  tsc --noEmit                         241 MB
  Electron app tree                    315 MB
  vite preview/dev server              134 MB
  other node (agent runtime/sync/IDE)  134 MB
  MCP local (probe/launcher)            62 MB
  esbuild service                       19 MB
  TOTAL                               1131 MB   (31 processes)

$ node coord.mjs status
AGENTS (0)   LOCKS (0)   FILE LEASES (0)      # while state.md records 13 active sessions

$ coord.mjs:99      const expired = t - (l.since || 0) > (l.ttlMs || DEFAULT_LOCK_TTL_MS)
$ coord.mjs:149     export function heartbeat(agent, task) { return withReg(reg => { upsertAgent(...) }) }
$ coord.mjs:208     reg.locks[name] = { agent, since: cur?.since || now(), ttlMs }   // never refreshed
$ run-exclusive.mjs:66-70   REFUSED → console.error → process.exit(3)              // no queue, no wait

$ journalctl --since "-24h" -k | grep -c "oom-kill:"
12
$ journalctl --since "-24h" -k | grep "Out of memory: Killed" | grep -oE "\([a-zA-Z-]+\)" | sort | uniq -c
      8 node-MainThread
      2 electron
      1 spotify
      1 code

$ ls -la build*.log        # ALL stale manual redirects
build2.log Jul  1 22:25 | build3.log Jul  1 23:14 | build4.log Jul  1 23:18
build_final.log Aug 30 17:50 | build_retry.log Aug 30 18:08 | build_fore.log Aug 30 18:00
```

---

## 11. RELATED ARTIFACTS

| File | Purpose |
|---|---|
| `agent/docs/generate-prompt-docs/agent-orchestration-interview/prompt.md` | the diagnostic interview protocol (measure first, then ask) |
| `agent/docs/generate-prompt-docs/agent-orchestration-interview/SCORECARD.md` | tracked metrics + open `COORD-*` defects |
| **this file** | memory + freeze root cause, and the answers to the external AI's 5 questions |
| `agent/MEMORY.md` | durable lessons (carries the 2560 MB heap failure record) |
| `agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/MULTI_AGENT_PROTOCOL.md` | coordination rules (**conflicts with `MEMORY.md` — see COORD-2**) |

---

**Bottom line:** one chain, four links. A **doc contradiction** makes agents obey the wrong
instruction; the **lock refuses instead of queueing**, so agents **poll**; polling **relaunches 8 GB
builds** every 15 seconds on a box with **4 GB free** and **zram 100 % full**; the **kernel** — not
systemd-oomd — kills the offender **and your desktop apps**, and the zram decompression that follows
**is** the freeze. Fix the contradiction and the polling stops; cap the heap and the freeze stops.
Everything else is cleanup.

> **U1 remains unproven.** The 8 kills are attributed to `vite build` by inference (§3 Q1). If a
> build log (MEM-5) shows those PIDs were something else, MEM-1's conclusion changes and this
> report must be revised. Do not treat §3 Q1 as settled until that log exists.

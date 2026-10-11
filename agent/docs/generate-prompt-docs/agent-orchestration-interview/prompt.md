# 🎛️ Agent Orchestration Interview — Diagnostic Protocol (v1.0)

## ▶ HOW TO USE THIS FILE

**This file IS the prompt.** Everything below this line is what you paste — there is nothing
else to assemble.

```bash
# 1. copy it to the clipboard, then paste into any opencode session
cat agent/docs/generate-prompt-docs/agent-orchestration-interview/prompt.md | xclip -selection clipboard

# 2. or read it in-place
less agent/docs/generate-prompt-docs/agent-orchestration-interview/prompt.md

# 3. the tracked metrics + defects found so far live beside it
less agent/docs/generate-prompt-docs/agent-orchestration-interview/SCORECARD.md
```

**Paste target:** any opencode session that is about to edit, build, run, or verify this repo.
**What comes back:** a ranked, evidence-backed defect list (§4) + a `RESULT.md` fix packet for an
external AI (§5) + a measurable delta for next time (§6).

> There is exactly ONE canonical copy of this prompt. Do not duplicate it into another folder —
> this repo already burned a full cycle on six parallel registries drifting apart. Edit here.

---

> **What this is:** a *self-interview protocol*. Paste it into any opencode session that is
> trying to edit, build, run, or verify this repo. It makes the agent **interrogate its own
> working conditions** and — more importantly — **interrogate the coordination layer itself** —
> producing a ranked, evidence-backed defect list that becomes a fix packet.
>
> **Who runs it:** the agent (you). **Who it interviews:** you, plus the artifacts on disk.
> **Who it informs:** CZ, and an external AI (ChatGPT/Claude) that writes the actual patches.
>
> **Why it exists:** the user reports that agents *"spend all their time waiting for each other
> to finish building."* That symptom has **at least four completely different root causes** which
> all look identical from the outside. Guessing wastes days. This protocol forces the distinction.
>
> **The one rule that makes this work: NEVER ASK A QUESTION A COMMAND CAN ANSWER.**
> Every question in §3 is reserved for information that exists **only in a session's lived
> experience** (what it actually felt like, what it typed, what happened at 03:00). Everything
> derivable from disk must be *measured* in §2 and reported without asking anyone.

---

## §0. Hard constraints (read before anything else)

| # | Rule | Why |
|---|------|-----|
| 1 | **Read-only during Phases 0–3.** No edits, no builds, no `run-exclusive.mjs`, no DB writes. | A diagnostic that mutates the system destroys the evidence it is measuring. |
| 2 | **Never run `npm run build` / `run-exclusive.mjs build` during this protocol.** | Build is the contended resource under investigation. Measuring it by joining the queue proves nothing. |
| 3 | **Never `pkill`/`killall`/pattern-kill.** Report leaks; do not sweep them. | §0.5 of `AGENTS.md`. Other live agents depend on those processes. |
| 4 | **Every number must come with the command that produced it.** | "Feels slow" is worthless. `exit=3, held by X, waited 240s` is a bug report. |
| 5 | **One hypothesis per defect. Never bundle.** | "Coordination is bad" cannot be fixed. "Lock expiry keys off `since` not heartbeat" can. |
| 6 | **A CONFIRMED defect must cite `file:line`.** | Otherwise the external AI has to re-derive your work. |
| 7 | **Time-box the whole interview: 12 minutes of tool calls.** | This is an instrument, not a project. If it runs longer it has become a project. |
| 8 | **Answer only what was asked.** Do not start fixing in Phase 3. | Fixing before the defect list is ranked is how you ship the wrong patch. |

---

## §1. FRAMEWORK — the four causes of "everyone is waiting"

**Do not treat these as one problem.** They have different fixes, different costs, and only
one of them is even a *lock* problem.

```
   SYMPTOM (what CZ sees):  "agents keep waiting for each other to finish building"
                |
        +-------+-------+
        |               |
   IS IT THE LOCK?    IS IT THE MACHINE?
        |               |
   +----+----+     +----+----+
   |         |     |         |
 LOCK      POLICY   RAM      PROMPT
 CONTENT   CONFLICT  WALL    SIZE
   |         |       |         |
 binary    docs say 8GB heap  every poll
 mutex on  "CZ      requested  = one full
 dist/     builds"  x N       LLM turn
   |         |       |         |
   |         |       |         +--> fix: batch, don't poll
   |         |       +--> fix: cap concurrency by real free RAM,
   |         |            or never share the 8GB heap
   |         +--> fix: make ONE source of truth. contradictions
   |              are pure waste — cost zero to remove
   +--> fix: narrow the mutex to the ACTUAL hazard
        (two builds with different --outDir do not
         collide at all — the lock is wider than the risk)
```

**Category A — LOCK CONTENT.** The mutex protects something broader than the real hazard.
*Test:* name two operations that are mutually excluded. If they don't actually conflict on
disk, the lock is wrong.

**Category B — POLICY CONTRADICTION.** Two instruction sources disagree, so the agent obeys the
wrong one, gets refused, and then waits for a thing that was never going to happen.
*Test:* grep every auto-loaded instruction file for the contested command. Diff them.

**Category C — RAM WALL.** The mutex is *correct* and the machine genuinely can't parallelise.
`npm run build` hardcodes `NODE_OPTIONS=--max-old-space-size=8192`; on a 31GB box shared by
N agents, N concurrent builds is physically impossible.
*Test:* read `free -m`. Count concurrent 8GB requests. This one cannot be "optimised" — only
*scheduled* or *avoided*.

**Category D — PROMPT BUDGET.** The wait happens **inside the agent**, not inside the lock.
A `sleep 15 && retry` loop costs a full model turn every 15 seconds: latency *and* context.
*Test:* count poll iterations and estimate tokens burned.

> **The single most likely finding, and the cheapest to fix:** the wait is Category D, and it is
> a direct consequence of Category B. Fix B and D mostly disappear for free.

---

## §2. PHASE 0 — INSTRUMENT (no questions; measure only)

Run all of these. Paste raw output into the report. **Do not summarise, do not paraphrase.**

```bash
cd "<repo root>"

# --- M1. Machine capacity. Category C evidence. ---
free -m; echo "CPUs: $(nproc)"
echo "SWAP FREE (MB): $(free -m | awk 'NR==3{print $4}')"   # <2000 ⇒ you WILL be OOM-killed

# --- M2. Registry state as it is RIGHT NOW. ---
COORD=agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs
node $COORD status

# --- M3. Raw registry: look for locks whose agent is gone (stale/wedged). ---
cat "$COORD" >/dev/null && cat agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/registry.json

# --- M4. LEAK CENSUS (baseline for §0.6d). Record the number. ---
ps -eo pid,ppid,rss,etimes,args --sort=-rss | grep -E "[n]ode|[e]lectron" | head -30
echo "TOTAL NODE: $(pgrep -c -f '[n]ode')"
# Healthy baseline on this box ≈ 20. ~90 ⇒ ~9 dead sessions leaked their MCP servers.

# --- M5. WHO TELLS AGENTS TO BUILD? Category B evidence. ---
grep -rln "run-exclusive.mjs build" --include=*.md --include=*.json . 2>/dev/null | grep -v node_modules
grep -rn "npm run build" --include=*.md AGENTS.md agent/ 2>/dev/null | grep -v node_modules | head -20
grep -rn "DO NOT RUN\|CZ BUILDS\|cz builds" --include=*.md . 2>/dev/null | grep -v node_modules | head

# --- M6. THE HEAP FLOOR. Category C quantification. ---
node -e "console.log(require('./package.json').scripts.build)"

# --- M7. Does the lock even WAIT, or refuse instantly? Category D root cause. ---
sed -n '200,215p' "$COORD"          # acquireLock
sed -n '64,72p'  "$(dirname $COORD)/run-exclusive.mjs"   # the refusal branch

# --- M8. Lock expiry semantics — read reap() closely. Correctness hunt. ---
grep -n "l.since\|ttlMs\|lastHeartbeat" "$COORD"
```

**Then answer these from the output alone — do not ask anyone:**

- Q0.1 Does `acquireLock` block/wait/queue, or return immediately on contention?
- Q0.2 If it returns immediately, what exit code does `run-exclusive.mjs` emit, and is that
      code handled by a *wait* or by the *agent deciding to retry*?
- Q0.3 Is `locks[].since` refreshed by the 30s heartbeat, or only set at acquisition?
      → **This is a suspected live correctness bug: a build running longer than the lock TTL
      has its lock reaped *while still running*, letting a second build into `dist/`.**
- Q0.4 List every file that instructs an agent to build, and every file that forbids it.
      Do they agree?
- Q0.5 How many 8GB-heap builds could this machine run at once, honestly?

---

## §3. PHASE 1 — THE INTERVIEW

Now — and only now — ask questions. Ten clusters. **Skip any cluster whose answer is already
established by §2 evidence or by the session transcript in front of you.** Do not perform an
interview to fill a quota; a skipped cluster is a good outcome.

For each answer you *do* solicit, you must **demand a specific artifact, not an impression.**

| # | Cluster | Ask | Demand as evidence |
|---|---------|-----|-------------------|
| **Q1** | **The wall clock** | "Walk me through the last time you were blocked. Timestamps." | Exact time from first `exit=3` to first `[coord] acquired`. Not "a while". |
| **Q2** | **The poll tax** | "Show me your actual retry loop." | Paste the literal `sleep && retry` command(s) you ran. How many iterations? What was the interval? |
| **Q3** | **Context burn** | "What did waiting cost you?" | Count of wasted turns; rough token/turn estimate; whether you lost task state across the loop. |
| **Q4** | **The contradiction** | "Which file told you to build? Which told you not to? Which won?" | Quote the two lines with their file paths. This determines whether the fix is a doc edit. |
| **Q5** | **False signals** | "Did you ever wait for a lock that was never going to be released?" | `registry.json` snapshot + whether the holder PID existed (`ps -p <pid>`). |
| **Q6** | **Lease decay** | "Did you hold a file lease while working for more than 90s without a heartbeat?" | Lease `since` vs your last `heartbeat` timestamps. **A lease silently expiring mid-edit is a data-corruption class bug, not a throughput one.** |
| **Q7** | **The right that was refused** | "Were you ever blocked from a file that did not actually overlap anyone?" | The two `claim` paths. If they don't overlap on disk, the lease was over-broad. |
| **Q8** | **Work you abandoned** | "Did you give up a task because the queue looked long?" | The task, and the wall-clock cost. **This is the metric that quantifies the user's complaint.** |
| **Q9** | **What you never attempted** | "What did you decide not to do because you assumed it was unsafe?" | The assumption + whether it was ever verified. Silent fear is invisible cost. |
| **Q10** | **The real ceiling** | "If coordination were perfect, what would still be slow?" | Separates fixable waiting from Category C (physics). |

**Interview rules:**
- Ask **one cluster at a time**; do not dump all ten.
- Never ask CZ to recall history you can read in `agent/state/*.md`, `MEMORY.md`, or
  `registry.json`. The whole point of this repo's state system is that you don't have to.
- If the answer is "I don't remember", record `UNKNOWN` — that is a valid and useful datum.
  Do not fill it with a plausible guess.
- **Never ask a question whose answer is a file's contents.**

---

## §4. PHASE 2 — CLASSIFY & RANK

Every candidate defect gets exactly one row. A defect that cannot be named in one sentence is
not a defect yet — split it.

| Field | Required content |
|---|---|
| **ID** | `COORD-<n>` |
| **Category** | A (lock content) · B (policy contradiction) · C (RAM) · D (prompt budget) |
| **Claim** | One sentence, falsifiable |
| **Evidence** | `file:line` and/or command + output. `UNKNOWN` if unavailable. |
| **Falsifier** | *What observation would prove this wrong.* |
| **Blast radius** | What silently corrupts if unfixed (e.g. "two builds in `dist/`" = black screen) |
| **Fix owner** | `coord.mjs` · `run-exclusive.mjs` · `AGENTS.md`/`MEMORY.md` · scheduling · unfixable |
| **Cost** | S · M · L |
| **Priority** | `P1 correctness` > `P1 waste` > `P2` > `P3` |

**Ranking rules (apply strictly, they are the point of this phase):**
1. Any **silent-corruption** defect outranks any **waiting** defect, no matter how annoying the
   waiting is. A wedged queue wastes time; two concurrent `dist/` writes black-screen the app.
2. Category **B** outranks **D**: contradictions are free to remove, and removing them deletes
   most of the polling that *causes* D.
3. Category **C** cannot be optimised, only scheduled. Say so; do not invent a fix.
4. If two rows have the same priority, the lower **Cost** goes first.

---

## §5. PHASE 3 — EXTERNAL HANDOFF (generate the fix packet)

Once ranked, emit the handoff for a strong external AI (ChatGPT/Claude). **Do not hand it a
problem — hand it a spec.** Place it at
`agent/docs/generate-prompt-docs/agent-orchestration-interview/RESULT.md`.

The handoff must contain:

1. **The ranked defect table** from §4, verbatim, including `UNKNOWN`s and falsifiers.
2. **Verbatim source** of the implicated functions (`acquireLock`, `reap`, `withReg`, the
   refusal branch of `run-exclusive.mjs`) — do not paraphrase, paste it.
3. **Raw §2 output** as an appendix, so the external AI sees the machine it must schedule for.
4. **Hard constraints it may not violate:**
   - No new npm dependencies (`coord.mjs` is deliberately dependency-free and node-builtins-only).
   - Must work across processes on one shared machine; a single-writer JSON file with an atomic
     mutex is the established pattern — extend it, don't replace it with a socket server.
   - Must degrade to a clear `REFUSED` message, never to a hang.
   - Must never make two processes write `dist/` concurrently. *Non-negotiable.*
   - Windows-compatible paths (this repo path contains a space).
5. **The specific questions you want decided**, e.g.:
   - Should the build lock become a **ticket queue with FIFO + priority + human override**,
     or should waiting become a **single blocking call** that costs the agent zero turns?
   - Can verification builds (`--outDir /tmp/...`) be made **lock-free and concurrent** with a
     RAM-derived concurrency cap, while `dist/` builds stay strictly serial?
   - Should lock liveness key off **last-heartbeat** rather than **acquisition time**?
   - Should leases inherit the agent's heartbeat, so a working agent cannot lose its claim?

> **Ask for the design, not a menu.** "Do NOT present Options A/B/C. Design the single best
> solution, state the one tradeoff you accepted, and explain why the alternatives lose."

---

## §6. PHASE 4 — CLOSE THE LOOP (this is the "continuously improve" part)

The protocol is not finished when the report is written. It is finished when the *next* run
shows a number moved.

1. Record the baseline metrics into `SCORECARD.md` (same directory).
2. After fixes land, **re-run §2 unchanged** and diff.
3. Every regression gets a new `COORD-<n>` row. Every confirmed-fixed row gets struck through
   with the commit that fixed it.
4. If a fix did **not** move the metric, that is the most valuable outcome of the cycle —
   record it as `FIX INEFFECTIVE` with the reason. A protocol that only confirms successes is
   not measuring anything.

### The four numbers that matter

| Metric | How to get it | Healthy |
|---|---|---|
| **Time-to-lock** | median wall-clock from first refusal → acquisition | seconds, not minutes |
| **Poll tax** | count of `sleep && retry` iterations per blocked build | **0** |
| **Wasted work** | tasks abandoned to queue length (Q8) | 0 |
| **Silent-corruption incidents** | concurrent `dist/` writers; leases lost mid-edit | **0, always** |

---

## §7. Output format (this protocol's deliverable)

```
COORDINATION INTERVIEW — <date> — <agent-id>
CENSUS: <before> node procs | RAM avail <n>MB | swap free <n>MB | CPUs <n>
QUEUE STATE: <n> agents | <n> locks | <n> leases | stale locks: <list or none>
MEASURED (Phase 0): Q0.1 … Q0.5  — one line each, with the command that answered it
INTERVIEWED: Q1 ✅ … Q10 ⏭(skipped — answered by <evidence>)
DEFECTS:
  COORD-1  [B]  <claim>                     P1 waste      cost:S  evidence:file:line
  COORD-2  [D]  <claim>                     P1 waste      cost:S  evidence:cmd output
  COORD-3  [A]  <claim>                     P1 correctness cost:M evidence:file:line
UNKNOWNS: <what nobody could answer — these become the next interview's first questions>
UNFIXABLE: <Category C items — physics, not bugs>
HANDOFF: RESULT.md written — <n> defects, <n> falsifiers
NEXT INTERVIEW MUST START WITH: <the unknowns>
```

---

## §8. Anti-patterns — do not do these

- ❌ **Interrogate without measuring.** Asking "is the queue slow?" when `registry.json` holds
  the answer is the failure this whole document exists to prevent.
- ❌ **Invent a queue.** There isn't one. `acquireLock` refuses instantly; the *agent* then
  chooses to wait. Diagnose the wait, do not describe a queue that does not exist.
- ❌ **Call it solved because the lock is free.** Free lock + 19 leaked node processes = slower
  machine = longer builds. Always report the census.
- ❌ **Treat `pkill` as a fix.** It deletes the other nine agents' MCP servers.
- ❌ **Fix before ranking.** An unranked patch is a guess with extra steps.
- ❌ **Let the protocol become a project.** 12 minutes, then report.
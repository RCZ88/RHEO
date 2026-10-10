# Multi-Agent Coordination Protocol (DeskFlow)

> **Read this before you touch anything if you are an AI agent, sub-agent, or an
> automated shell working in this repo. You are NOT alone.** Other agents may be
> editing files, building, running the app, or writing to the database at the
> same moment. Acting as if you have exclusive control is what corrupts the DB,
> triggers "internal server error" mode, and makes agents silently overwrite
> each other so nothing actually ships.

---

## 1. The mental model

Speed from parallelism is real, but it is **borrowed against consistency**. Two
agents going fast in the same place don't add up — they *collide*, and the
result is often *negative* progress (each reverts the other, or they wedge a
shared resource). The whole point of this protocol is:

1. **Awareness** — every agent announces itself and can see who else is active.
2. **Exclusivity** — shared, single-owner resources (the DB, the build output,
   the running app, a file being edited) are held by *exactly one* agent at a
   time, enforced by real locks — not politeness.
3. **Safety** — destructive operations take a backup first and are reversible.
4. **Liveness** — a crashed agent must not wedge the system; locks expire.

Enforcement lives in `agent-coordination/`. The rules below are backed by
commands you MUST run — not vibes.

---

## 2. DeskFlow's hard physical facts (why collisions hurt here specifically)

| Resource | Reality in this codebase | Failure when shared |
|---|---|---|
| **Database** | `better-sqlite3`, one file `userData/deskflow-data.db`, default rollback journal, **no `busy_timeout`** | Second writer → `SQLITE_BUSY` / "database is locked" → your "DB disconnected". |
| **Schema** | `CREATE TABLE IF NOT EXISTS` + column-add migrations run **on every startup** (`main.ts`) | Two instances booting at once = concurrent schema writes on a single-writer DB. |
| **App server** | Renderer served on an ephemeral port; **browser-integration server on a fixed port** that already must handle `EADDRINUSE` | Second app instance → port collision → "internal server error mode". |
| **Build** | Vite build replaces `dist/` | Building while the app loads `dist/` = the app runs half-old/half-new code and breaks. |
| **Source files** | Plain files on disk, CRLF | Two agents editing/rewriting the same file = last-writer-wins, silent revert. |

**Consequence rules (non-negotiable):**

- **R1 — One DB writer, ever.** Only the running app OR one db-lock holder may
  write the DB. Never both.
- **R2 — One app instance, ever.** Single `app` lock. It also owns the DB.
- **R3 — Never build while the app runs; never start the app while a build runs.**
- **R4 — One writer per file/dir.** Claim a file before editing it.
- **R5 — Back up before any destructive/migration/bulk DB op.**

---

## 3. The workflow every agent MUST follow

```bash
# 0. Pick a stable id for yourself, e.g. AGENT_ID=subagent-ui-3
export AGENT_ID="<your-unique-id>"

# 1. Announce yourself + what you're doing.
node agent-coordination/coord.mjs register --agent "$AGENT_ID" --task "wire AiPage chat"

# 2. See who else is active BEFORE you plan writes.
node agent-coordination/coord.mjs status

# 3. Claim the files/dirs you intend to edit. If DENIED, do NOT edit them —
#    coordinate or pick different work.
node agent-coordination/coord.mjs claim --agent "$AGENT_ID" \
     --paths src/pages/AiPage.tsx src/hooks/useAiChat.ts

# 4. While working on something long, keep your heartbeat fresh (or use the
#    wrappers below, which do it for you).
node agent-coordination/coord.mjs heartbeat --agent "$AGENT_ID"

# 5. Release when done (also releases everything you held).
node agent-coordination/coord.mjs release --agent "$AGENT_ID" --paths src/pages/AiPage.tsx
node agent-coordination/coord.mjs done    --agent "$AGENT_ID"
```

**Never** run `npm run build`, `npm start`, or a migration directly. Use the
wrappers so the locks are enforced automatically:

```bash
# BUILD: an agent does NOT build. Per AGENTS.md §0-0 (Option B, 2026-10-02) only CZ
# builds — `package.json:14` permits an 8192 MB heap on a box with ~4 GB available,
# which produced 12 global OOM events in 24 h and killed VS Code/Electron/Spotify as
# collateral. CZ runs `npm run build` directly; it self-logs to agent/logs/build.log.
# There is deliberately no `build` example here. Verify with scoped tsc/esbuild and
# `npm run validate:pages` instead.

# Start app: single instance; must not overlap a build.
node agent-coordination/run-exclusive.mjs app --forbid build app -- npm start

# DB migration / bulk import (backs up first; refuses if app is running)
node agent-coordination/db-guard.mjs run -- node scripts/migrate.mjs

# Manual safety snapshot any time
node agent-coordination/db-guard.mjs backup
```

---

## 4. Edge-case catalog — what goes wrong with multiple agents

### A. Build / compile collisions
- **Duplicate builds** overwrite `dist/` mid-write → corrupt/partial output.
  → *CZ is the only builder (§0-0 Option B).* No agent build can collide with CZ's.
  The exclusive `build` lock remains in `run-exclusive.mjs` as a backstop, not a workflow.
- **Build while app runs** → app loads swapped assets → white screen / errors.
  → *CZ: `npm run build` only while the app is closed.*
- **Port already in use** (`EADDRINUSE`) from a leftover dev server/app.
  → *Single `app` lock (R2)* + kill stale instance before starting.
- **Concurrent `npm install`** mutating `node_modules`/lockfile → corruption.
  → *Treat installs as an exclusive op:* `run-exclusive.mjs deps -- npm ci`.

### B. Runtime / app collisions
- **Two app instances** → two SQLite writers → lock errors + fixed-port clash.
  → *R1 + R2.*
- **Stale/zombie main process** holding the DB or port after a crash.
  → *Lock TTL + reaping;* verify with `coord.mjs status`, then relaunch.

### C. Database
- **Simultaneous writes** → `SQLITE_BUSY` / "database is locked".
  → *R1.* (Also strongly recommended: enable WAL + `busy_timeout` — see §6.)
- **Migration runs twice / mid-write** → half-applied schema, dropped data.
  → *`db-guard.mjs run` (backup + `db` lock + app-not-running check).*
- **Destructive op with no undo** (DELETE, DROP, bulk overwrite, file replace).
  → *R5: backup first.* `backups/` holds the last 20 snapshots.
- **Reading while another writes** → torn/partial reads.
  → Route all writes through the single owner.

### D. Filesystem / source (the "stack on top of each other, delete everything")
- **Two agents edit the same file** → last save wins, the other's work vanishes.
  → *R4: file leases via `claim`.*
- **Full-file rewrite over a concurrent edit** → wholesale silent revert.
  → **Prefer surgical edits** (targeted string replacements) over rewriting a
    whole file you don't exclusively own.
- **Deleting a file another agent depends on** → broken imports for everyone.
  → Claim the file, announce intent in `--task`, verify no other lease nearby.
- **Two agents create the same new file** with different content → one clobbers.
  → Claim the target path *before* generating it.
- **Directory-level work** (e.g. regenerating a folder) overlapping a file edit
  inside it. → Leases are prefix-aware: claiming `src/x/` conflicts with
  `src/x/y.ts` and vice-versa.

### E. Git / VCS
- **Concurrent commits / interleaved staging** → one agent commits another's
  half-done work. → Treat committing as an exclusive op (`git` lock); never
  `git add -A` while another agent is mid-edit.
- **Force-push / branch reset** wipes work. → Forbidden without an explicit
  human ok; never rewrite shared history from an agent.
- **Stash collisions.** → Don't `git stash` a tree you don't own.

### F. Environment / shared resources
- **`.env`, config, cache files** overwritten by parallel agents.
  → Claim them like source; never blind-write shared config.
- **Zipping/downloading a directory while it's being written** → corrupt
  archive. → Package only after builders/writers have released their locks.

### G. The coordination layer itself
- **Crashed agent holding a lock forever** → everyone blocked.
  → **Heartbeat + TTL:** dead agents (90s silent) and expired locks are reaped.
- **Registry read-modify-write race** → lost updates.
  → **Atomic mkdir mutex** around every registry mutation.
- **Clock/lease drift, ignored denials** → an agent that ignores a DENIED
  result and edits anyway defeats the system. A denial is a hard stop, not a
  suggestion.

### H. Leaked processes (the node pile-up) — read this, it is the #1 resource leak

Every extra `node` process on this box makes the next agent's **build** more likely
to be OOM-killed. A build that dies silently is a symptom of a process leak, not
of a code error. So process hygiene is a *correctness* rule here, not tidiness.

| Owner | Rule | Action |
|---|---|---|
| You (Probe) | Every `probe_open` has a matching `probe_close` | `open` → act → `report` → **`close`**. Also on failure. Also when out of context. |
| You (npm/npx/dev server) | Capture the PID at launch, kill it at end | `npm run dev & echo "pid=$!"` … `kill -- -$PGID` (kill the group, not the leaf) |
| opencode host (MCP) | You did **not** start it → you must **not** kill it | Report the count; end your cycle cleanly so opencode reaps them |

- **`probe_close` is mandatory and idempotent.** Never end a cycle with a live
  Probe session. It holds a debug port, an Electron tree (~350MB), and a
  `/tmp/opencode/df-*` profile dir.
- **opencode spawns all FOURTEEN servers in `opencode.json` `mcp`, per session,**
  and most resolve via `npx -y` — so ~5 extra node processes per session before
  you write a line. They leak only when a session dies hard (`kill -9`, crash,
  timeout) — so **exit cleanly**. A sweep, if CZ authorises one, is a targeted
  sweep by the **generic** signature below, run once by a named agent — never a
  self-service pattern-kill, and never `pkill node`.
  ```bash
  # every npx-resolved MCP server, whatever package it is — NEVER hardcode names
  ps -eo pid=,args= | awk '{a=$0; sub(/^[ ]*[0-9]+[ ]+/,"",a);
      if (a ~ /_npx\/[a-z0-9]+\/node_modules\/\.bin\//) print $1}'
  ```
  Hardcoding a short list (e.g. only `shadcn` + `playwright`) silently leaves 12
  servers per dead session running — this exact bug shipped once already.
- **NEVER `pkill node` / `killall node` / `pkill -f vite`.** The IDE's
  `js-language-service`, RHEO's own Electron main process, the sync server, and
  every other agent's build are all `node`.
- **Repeat offenders to self-check:** `vite dev`, `vite preview`, `esbuild --watch`,
  `tsc --watch`, `npm run tailwind`, `node --watch`, and anything resolved from
  `_npx/<hash>/`.
- **Dry-run and print before any kill, and dry-run the filter itself.** A
  `ps | grep` filter whose own command line contains the search string matches
  **itself and its own shell**; and `for p in $(ps -eo pid=,etimes=,args=)`
  word-splits, so `$2` is a *word of the command* and the age test throws
  `integer expected` while appending garbage PIDs. Parse PIDs in `awk`, exclude
  `$$`, then verify the user's real apps (RHEO, WebStorm, `sync-server`, Spotify,
  Obsidian) are absent from the list.
- **Leak census at the start AND end of every cycle:**
  ```bash
  ps -eo pid,ppid,rss,etimes,args --sort=-rss | grep -E "[n]ode|[e]lectron" | head -30
  echo "TOTAL NODE: $(pgrep -c -f '[n]ode')"
  ```
  The only acceptable delta is processes you can name and can point at a PID you
  killed. **Report the delta in your cycle report.** A cycle that changed source
  and reports a positive net delta is an incomplete cycle.
  A healthy baseline here is **~20 node/electron processes** (RHEO + zygotes,
  WebStorm, sync-server, one live session's MCP set). A count in the 90s means
  ~9 dead sessions leaked their MCP servers.


---

## 5. Constraints & rules of engagement (the checklist)

1. **Announce or abstain.** No writes before `register` + `status`.
2. **Claim before you edit.** No file write without an owned lease (R4).
3. **A DENIED lock/claim is a STOP.** Re-plan; never override.
4. **Serialize the singletons.** DB, app, build, deps, git = one owner at a time.
5. **Prefer additive + surgical.** Small targeted edits over whole-file rewrites;
   new files over mutating shared ones.
6. **Back up before destruction.** No DELETE/DROP/bulk-overwrite without a snapshot.
7. **Never build while running, never run while building.** (R3) — and per §0-0,
   **agents never build at all**; only CZ does.
8. **Leave it clean.** Always `release`/`done` (wrappers do this on exit + crash).
   Every process you opened is closed too — see §H.
9. **Nothing survives your cycle.** `probe_close` for every `probe_open`; `kill`
   for every npm/npx/dev-server you started, by recorded PID. See §H.
10. **Idempotency.** Assume your step may be retried; guard with `IF NOT EXISTS`,
    upserts, and "already done?" checks.
11. **Least blast radius.** Claim the narrowest path set that gets the job done;
    don't lock `src/` when you only touch one file.
12. **Partition, don't overlap.** When fanning out sub-agents, give them a
    **disjoint** set of files/dirs. Overlap = collision by construction.
13. **Humans own history & destructive infra.** No force-push, no dropping
    tables, no deleting the DB without explicit human confirmation.

---

## 6. Recommended hardening (optional but high-value)

These reduce collisions even when coordination slips. They are *suggestions for
a human to approve*, not something an agent should silently apply to `main.ts`:

- **Enable SQLite WAL + busy timeout** right after opening the DB:
  ```js
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  ```
  WAL lets readers and one writer coexist; `busy_timeout` turns instant
  "database is locked" errors into short waits.
- **Single-instance lock for the Electron app** (`app.requestSingleInstanceLock()`)
  so a second launch focuses the existing window instead of fighting for the
  port and DB.
- **Run migrations once behind a guard** (a `schema_version` row / `PRAGMA
  user_version`) instead of on every boot path.

---

## 7. Orchestrating sub-agents (for the parent/coordinator)

- **Plan the partition first.** Split the work into disjoint file/dir sets and
  hand each sub-agent its slice. Never give two sub-agents the same file.
- **Serialize the shared phases.** Fan-out for editing is fine; **building,
  running, DB migration, dependency installs, and commits must be serial** and
  go through the wrappers.
- **Barrier before packaging.** Wait until every sub-agent has `done` and all
  locks are clear (`coord.mjs status` shows none) before you build/zip/deploy.
- **One integrator.** After parallel edits, a single agent does the
  build + typecheck + commit so results don't stack on each other.

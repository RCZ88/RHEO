---
name: multi-agent-coordination
description: MANDATORY LOAD-BEFORE-ANY-WRITE when more than one agent may be working in this repo. Covers the register → status → claim → build-lock protocol, the shared singletons (dist/, DB, app, deps), how to recover from another agent's half-finished edit, and how to commit without swallowing someone else's work. Load this before editing source files, building, running the app, migrating the DB, or committing.
---

# Multi-Agent Coordination

**This repo is shared with other opencode agents running at the same time.** They do not
announce themselves in conversation. Your only visibility is the coordination tool.

> **THE ONE RULE:** another agent editing a file you are about to edit is not a rare
> accident — it is the normal case here. Uncoordinated writes are how this repo loses
> work. Two real incidents, both observed in one session:
>
> 1. An agent's baseline commit silently swallowed **713 lines** belonging to a
>    different agent, because that agent had staged nothing and the committer used
>    a broad add.
> 2. `src/pages/TerminalPage.tsx` was mid-rewrite (**+4,570 lines**) by another agent
>    with unbalanced JSX. A full build failed on it. Restoring or "fixing" that file
>    would have destroyed live work.

Both were avoidable by running four commands before touching anything.

---

## 0. The tool

All of it lives in one directory:

```
agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/
├── coord.mjs              register · status · claim · release · heartbeat · lock · done
├── run-exclusive.mjs      build / app / deps singletons — USE THESE, never bare npm
├── db-guard.mjs           single DB writer (backs up first)
└── registry.json          shared state (agents, leases, locks)
```

Full spec: `agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/MULTI_AGENT_PROTOCOL.md`

Set once per shell:

```bash
export AGENT_ID="opencode-<what-you-are-doing>-$(date +%Y%m%d)"
```

---

## 1. BEFORE you write anything — the four commands

```bash
export AGENT_ID="opencode-tiercolors-20260930"
COORD=agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs

# 1. Announce yourself and say what you're doing.
node $COORD register --agent "$AGENT_ID" --task "fix calendar v10 API"

# 2. LOOK BEFORE YOU LEAP. Who else is live, and what do they hold?
node $COORD status

# 3. Claim exactly the paths you will edit. A DENIED claim is a HARD STOP.
node $COORD claim --agent "$AGENT_ID" --paths src/components/ui/calendar.tsx src/components/ui/v-calendar.tsx

# 4. Keep the lease alive while you work (every few minutes, or use a wrapper).
node $COORD heartbeat --agent "$AGENT_ID"
```

**`status` is not optional.** Skipping it is how you end up editing a file someone
else owns. Step 2 takes one second.

**A DENIED claim means STOP.** Do not edit anyway. Re-plan, pick different files, or
coordinate. Ignoring a denial defeats the entire purpose of having locks.

**Release when done** (the wrappers do this automatically, even on crash):

```bash
node $COORD done --agent "$AGENT_ID"
```

---

## 2. Singletons — never run these bare

| Resource | Why it's exclusive | Use instead of |
|---|---|---|
| `dist/` | Vite **replaces** it; two builds interleave and corrupt it | `run-exclusive.mjs build -- node scripts/build.mjs` |
| App process | Owns the DB; second instance = two writers | `run-exclusive.mjs app -- npm start` |
| Database | better-sqlite3 is single-writer | `db-guard.mjs run -- <cmd>` |
| `node_modules` | concurrent install corrupts it | `run-exclusive.mjs deps -- npm ci` |

```bash
COORD=agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination
node $COORD/run-exclusive.mjs build -- node scripts/build.mjs
```

**Queue, don't race.** If `status` shows a `build` lock, that is a live build. Wait it
out — poll `pgrep -f "vite build|scripts/build.mjs"` — rather than starting a second
one. Colliding builds produce half-written `dist/`, which shows up as a black screen.

---

## 3. Verify the tool actually ran

**A zero exit code with no output is not evidence of success.** The CLI once shipped a
broken main-guard (`import.meta.url === \`file://${process.argv[1]}\``) that failed
silently for every relative path — and it returned `EXIT=0` with empty stdout while
writing nothing.

So confirm by output, not exit code:

```bash
node $COORD status | head -3     # must print "AGENTS (n)"
```

If that prints nothing, the tool is a no-op and **none of this protocol is enforced**.
Treat every lock as if it does not exist until it is proven otherwise.

---

## 4. Reading `status` output

```
AGENTS (2)
  • opencode-sidebar-20260930  pid=193683  5s ago  — restore /agentic nav item
  • opencode-calendar-tier-20260930  pid=193895  0s ago  — fix calendar v10 API
LOCKS (1)
  🔒 build  held by opencode-sidebar-20260930
FILE LEASES (3)
  📄 src/pages/TerminalPage.tsx  ← opencode-sidebar-20260930
```

- **Not listed under AGENTS** but a file is leased → the lease reaped (owner dead ≥90s).
- **A lock with a PID that no longer exists** → stale. Confirm with `ps -p <pid>`,
  then `coord.mjs unlock --agent <owner> --name <lock>`.

---

## 5. Known limits (verified)

The core is sound. Verified live:

| Property | Result |
|---|---|
| Conflicting claim denied | ✅ denied, named the owner |
| Re-claim own path | ✅ idempotent |
| Lock mutual exclusion | ✅ second acquirer refused |
| 6 processes racing one file | ✅ exactly 1 winner (atomic-mkdir mutex) |
| Dead agent's leases/locks reaped | ✅ after 90s / lock TTL |

Real gaps to plan around:

1. **No enforcement.** Nothing forces an agent to `register`/`claim`. A brand-new agent
   will edit freely if it never runs this skill. This skill + the `skill-router` entry
   are the entire mitigation.
2. **`AGENT_TTL_MS` = 90s.** A long silent stretch (>90s without heartbeat) makes you
   look dead and your leases get reaped while you still hold them. Heartbeat regularly.
3. **Lock TTL = 20 min.** A build OOM-killed mid-run leaves the lock held for up to 20
   minutes, and it looks identical to a live build. `ps -p <pid>` decides it.
4. **No cross-machine safety.** `registry.json` is a single file; the mutex is
   `mkdir`, which is atomic on one filesystem only.

---

## 6. Finding out whose mess you are standing in

```bash
git status --porcelain <file>        # 'MM' = another agent is mid-edit RIGHT NOW
stat -c %y <file>                     # compare against your own last edit
git diff -- <file>                    # is the change theirs or yours?
```

**If a file you did not edit has uncommitted changes, it is not yours to fix.** Do not
`git checkout`, `git restore`, or rewrite it — that destroys live work. Report it.

---

## 7. Committing without swallowing other agents' work

**Never `git add -A`. Never `git add .`.** In a shared repo that stages other agents'
half-finished edits under your message.

```bash
git add <explicit paths, one by one>
git diff --cached --name-only        # CONFIRM the list before committing
git diff --cached | grep -i "<their known symbols>"   # did anything leak in?
git commit
```

If a single file contains **both** your work and another agent's, you cannot cleanly
separate it with `git add`. Either:
- leave it uncommitted and say so, or
- use `git add -p` to stage only your hunks.

Always report which files you committed and which you deliberately left alone.

---

## 8. Never do these

- `git checkout -- <file>` / `git restore` on a file you did not write
- `git reset --hard` / `git clean -fd`
- Editing a file whose claim was **DENIED**
- Running `npm run build` / `npm start` outside the wrappers
- Killing processes you did not start (`Get-Process`/`pkill` on all electron)
- Destructive SQL without `db-guard.mjs backup` first
- Assuming "it built" — always re-check `dist/index.html` and the asset count, because
  `emptyOutDir` wipes `dist/` and a failed build leaves it empty (instant black screen)

---

## 9. Completion checklist

- [ ] `register`ed with a task string
- [ ] `status` read **before** the first write
- [ ] Every edited path claimed; zero denials ignored
- [ ] Heartbeat kept alive during long work
- [ ] Builds/app/DB went through the wrappers
- [ ] `coord.mjs status` output visually confirmed (not just exit 0)
- [ ] `done` called; leases and locks released
- [ ] Commit staged explicit paths, never `-A`
- [ ] Reported: files committed, files left to others, anything broken by others
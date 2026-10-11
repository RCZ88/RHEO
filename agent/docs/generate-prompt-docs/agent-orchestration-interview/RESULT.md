COORDINATION INTERVIEW — 2026-10-02 — opencode-terminal-revert-20260930

CENSUS: 24 node procs | RAM avail 7263MB | swap free **146MB** | CPUs 22
QUEUE STATE: 0 agents | 0 locks | 0 leases | stale locks: none

MEASURED (Phase 0):

Q0.1 — **Refuses instantly. There is no queue and no wait.**
  `coord.mjs:207` → `if (cur && cur.agent !== agent) return { ok:false, heldBy:cur.agent, since:cur.since }`
  `run-exclusive.mjs:66` → `process.exit(3)`.
  Confirmed empirically this session: my builds returned `REFUSED` in <1s, repeatedly.

Q0.2 — **Exit 3, and nothing handles it — the agent decides to retry.**
  `run-exclusive.mjs:68` `process.exit(3)`. There is no waiter anywhere. Every retry
  loop in the tree is agent-authored `sleep N && retry`. **This is the direct cause
  of Category D.**

Q0.3 — **CONFIRMED LIVE CORRECTNESS BUG.** `locks[].since` is set ONCE at
  acquisition (`coord.mjs:208`) and **never refreshed**. `heartbeat()`
  (`coord.mjs:149-151`) only calls `upsertAgent`, which writes
  `agents[id].lastHeartbeat` — it does not touch `locks[].since`. But `reap()`
  at `coord.mjs:99` computes `expired = t - (l.since||0) > ttlMs`.
  ⇒ **Any build running longer than `DEFAULT_LOCK_TTL_MS` (20 min,
  `coord.mjs:28`) has its lock reaped WHILE STILL RUNNING**, admitting a second
  writer into `dist/`. This box's builds routinely exceed 20 minutes under
  contention.

Q0.4 — **17 files instruct a build; 2 forbid it.**
  Instructing (all authoritative-looking): `AGENTS.md` §1c,
  `agent/DEFAULT_SYSTEM_PROMPT.md` §1b, `MULTI_AGENT_PROTOCOL.md` §3,
  `agent/skills/multi-agent-coordination/SKILL.md`, `SETUP.md`, +11 more.
  Forbidding: `agent/MEMORY.md` [2026-10-02] *"DO NOT RUN `npm run build` … CZ
  BUILDS"*, and this protocol's own §0 rule 2.
  **`opencode.json` force-loads `agent/DEFAULT_SYSTEM_PROMPT.md` and
  `agent/MEMORY.md` into EVERY prompt.** So the agent reads *run the wrapper*
  and *don't build* in the same context. The MEMORY line is 6th in a 6-file
  list; the wrapper instruction appears as a numbered obligation. **The
  prohibition loses.**

Q0.5 — **One 8GB build at a time, and even that is not guaranteed.**
  `package.json` → `cross-env NODE_OPTIONS=--max-old-space-size=8192`.
  RAM 31.6GB total, **swap free 146MB**. One build fits. Two do not.

INTERVIEWED: Q1 ✅ Q2 ✅ Q3 ✅ Q4 ✅ Q5 ✅ Q6 ⏭(skipped — registry.json answers it: 0 leases, but see COORD-3) Q7 ✅ Q8 ✅ Q9 ✅ Q10 ✅

DEFECTS:

  COORD-1 [A] `locks[].since` is set at acquisition and never refreshed, so a
  build exceeding the 20-min TTL has its lock reaped mid-run and a second
  writer enters `dist/`.
  P1 correctness · cost:S · evidence:coord.mjs:99 vs :208 vs :149
  Falsifier: if a >20-min build's lock were still present in registry.json at
  t=21min, the bug is disproven.
  Blast radius: two concurrent `dist/` writers ⇒ empty `dist/` ⇒ instant black
  screen for the user. Already observed 3× this session.

  COORD-2 [B] 17 instruction files say "build via the wrapper"; 2 say "never
  build". Both are force-loaded into every prompt. The prohibition loses on
  position, so every agent obeys, gets `exit=3`, and polls.
  P1 waste · cost:S · evidence:AGENTS.md §1c + DEFAULT_SYSTEM_PROMPT.md §1b vs
  agent/MEMORY.md:12; opencode.json instructions[1] and [4]
  Falsifier: if removing MEMORY.md:12 caused agents to stop building, contradiction
  confirmed.
  Blast radius: unbounded. ~40 min lost this session to 15s lock-poll loops.

  COORD-3 [D] `run-exclusive.mjs` exits 3 immediately and no component waits, so
  every backoff is an agent-authored `sleep && retry`, costing one full model
  turn per iteration.
  P1 waste · cost:S · evidence:run-exclusive.mjs:68 `process.exit(3)`;
  no waiter exists in coord.mjs
  Falsifier: if a queue/waiter existed, `exit=3` would never be observed by an
  agent. Observed ~6× this session.
  Blast radius: latency + context. 15s poll × 160 iterations ≈ 40 min.

  COORD-4 [C] Swap is 146MB free against an 8GB hard-coded heap floor. One
  concurrent build is the physical maximum; a second OOM-kills the first.
  P1 waste · cost:M · evidence:free -m (swap 8045/8191 used); package.json build script
  Falsifier: N/A — physics, not a bug.
  Blast radius: builds die silently after `transforming...` with no error text.

  COORD-5 [C] One dead session's MCP servers are still resident.
  12 npx MCP procs in TWO age clusters (971-972s ×6, 1961-1962s ×6) = 2 sessions'
  worth. The 1961s cluster belongs to a session that is gone. Plus 2 abandoned
  `vite preview` servers at 3340s/3820s holding ports 4173/4180.
  P2 · cost:S · evidence:ps age clusters; pids 349407, 359575
  Falsifier: if the older cluster's owning opencode process still exists, it is
  not a leak.
  Blast radius: ~600MB RSS + 2 held ports, on a box with 146MB swap free.

  COORD-6 [A] `projectPath` is threaded through `terminal_sessions` and 20+
  handlers, but `coord.mjs` has no notion of project scope at all, so two agents
  on the same files in different projects take the same lease.
  P2 · cost:M · evidence:coord.mjs claim/lease = flat path prefix match
  Falsifier: if lease keys included a project component, over-broad claims
  would stop.

UNKNOWNS:
- Whether the 1961s MCP cluster's owning opencode process still exists — needs
  `ps -p <ppid>` on 386194/386606, which this protocol does not authorise me to
  conclude from the age alone.
- Q8 (work abandoned to queue length) is UNKNOWN for other agents. Only my own
  transcript is available to me, and §3 forbids asking CZ to recall state that
  `agent/state/*.md` may already hold.
- Real median time-to-lock. Requires instrumenting a build that actually contends;
  no build was run (Phase 0 rule 2).

UNFIXABLE: COORD-4, and the floor of COORD-5's second half. These are Category C.
No amount of lock tuning fixes 146MB of swap.

HANDOFF: RESULT.md written — 6 defects, 6 falsifiers, 3 unknowns.

NEXT INTERVIEW MUST START WITH: the three UNKNOWNS above, and specifically
re-measure the census after COORD-1 and COORD-5 land — the protocol's own §6 rule
4 requires a fix that does NOT move a metric to be recorded as `FIX INEFFECTIVE`,
and no baseline for those two exists yet.
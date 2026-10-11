# PROMPT — Give the Agent Workforce scene real "what is this AI doing" visibility

## Context you are dropped into

RHEO (Electron + React + TypeScript + Vite). There is a working **Agent Workforce**
ambient scene in the terminal workspace (`#/terminal`) that renders one animated
"micro-office worker" per live AI agent session. It already works: agents appear,
states animate, clicking a worker focuses its terminal, nothing renders when zero
agents are open.

**Read these first — they are the spec and the code you are extending:**
- `src/components/terminal/workforce/workforceTypes.ts` — the `VisualAgent` model,
  `VisualState`, `ActivityKind`, and `deriveVisualState()` priority rules
- `src/components/terminal/workforce/AgentCharacter.tsx` — one worker (desk, arms,
  screen, activity strip, tooltip)
- `src/components/terminal/workforce/WorkforceScene.tsx` — the room, seat layout,
  density tiers (roomy / dense / swarm), `hiddenCount` overflow
- `src/components/terminal/workforce/agentVisuals.ts` — `WF_PALETTE` (single colour
  source of truth — **use `WF_PALETTE` / `--wf-*` CSS vars, never raw hex**)
- `src/components/terminal/workforce/workforce.css` — keyframes + `.wf-scene`
  token block
- `src/components/terminal/workforce/useVisualAgents.ts` — the data→render adapter
- `src/components/terminal/workforce/conductorWorkforce.ts` — merges Conductor
  coworkers with plain sessions into one worker list
- `src/components/terminal/AgentAmbientAnimation.tsx` — the public entry point

Mounted in `src/pages/TerminalPage.tsx` inside a collapsible `<details>` strip.

## The actual problem

Right now a worker tells you its **mood** (`working` / `thinking` / `needs input`)
and its **topic string** in a hover tooltip. It does **not** tell you what the agent
is actually doing. You cannot tell:

- is it writing a file, running a test, reading docs, or stuck?
- what did it just change? which files?
- did the last command succeed or fail?
- how far along is it?

A user watching 8 workers has no idea whether to intervene, wait, or kill something.
That is the gap to close.

## Hard constraints — read before designing

1. **LAMINAR governs.** `design/design.md` is the constitution and overrides every
   styling default. One signal hue per surface. Radii ∈ {8px, 12px, pill} —
   `rounded-2xl`/`rounded-3xl` are banned. No `backdrop-blur` glassmorphism on
   chrome. No spring/bounce. Max 2 font families. No emoji as icons — `lucide`
   only. Reuse `--page-accent` and the `--wf-*` tokens; do not invent colours.
2. **Do not add a dependency.** No new npm packages. `motion` (v12) is the project
   animation engine and is already present — `framer-motion` is NOT.
3. **Live data must stay local and cheap.** There is exactly one PTY data feed
   (`onTerminalData` in preload) and a transcript flush path
   (`flushTranscriptToDb` in `src/main.ts`). **Do not poll the filesystem or the DB
   per worker.** Any new signal must arrive as an event or be derived from the
   buffer you already receive.
4. **Absent signal ⇒ absent UI.** If you have no evidence for a state, render
   nothing or render "unknown". Never render a fake "working" because a worker
   exists. This is the single most important rule — a lying viz is worse than none.
5. `prefers-reduced-motion` must keep working. The existing CSS degrades to static
   state indicators; your additions must degrade the same way (static state, not
   no-state).
6. Plain terminal sessions and Conductor coworkers both flow through
   `useVisualAgents`. Do not break either path.

## Deliverable 1 — real activity classification (the core ask)

`ActivityKind` is currently only as specific as the data allows
(`coding | research | terminal | thinking | waiting | working | none`) and
`classifyActivity()` in `workforceTypes.ts` is regex-on-a-string. That is the
weakest link.

Upgrade it to derive **verifiable** activity from what the agent's terminal actually
emits, then propagate:

- **code change** — a file write/patch event. Show WHICH file, and a
  added/modified/deleted count.
- **command run** — show the command, and whether it exited 0 or non-zero.
- **test run** — show pass/fail counts when the output parses them.
- **search/read** — show what it searched for or which path it read.
- **blocked/asking** — already exists as `attention`; make it prominent.

Design the **event shape** first and put it in a comment block in the PR body. The
main-process side already parses agent output (`parseAgentOutput` in
`src/main.ts`) and already stamps session ids — extend that path rather than
inventing a parallel one. Keep the existing priority order in
`deriveVisualState()` intact: specific `agent:*` phase event beats session status
beats generic fallback.

## Deliverable 2 — per-worker detail surface

Clicking a worker currently just focuses the terminal. Make the click open an
inspector panel for that worker:

- current objective / topic, role, mission, autonomy level (L2/L3/L4), depth
- **recent activity feed** — last N actions with timestamps
- **files touched this session** with +/- line counts
- last command + its exit status
- token / cost / duration, if the session row has them
- a live status line for the worker

Design it per the LAMINAR rules above. It must degrade gracefully for a plain
terminal session with none of this data — say "no activity recorded" rather than
rendering empty chrome.

## Deliverable 3 — crowd pressure made meaningful

`hiddenCount` (workers past seat capacity) currently renders as a bare "+N" chip.
Give it meaning and make it actionable:

- surface the mission's capacity and how many workers are active vs blocked
- when pressure is high, the visual treatment should be legible at a glance across
  the room (not only in a tooltip)
- **wire a per-worker close control.** The backend now supports it — call
  `window.deskflowAPI.conductorCloseNode(missionId, nodeId, { reason, checkpointFirst: true })`.
  It tells the worker to checkpoint, waits, then kills the PTY, and returns
  `{ ok, crowd }`. Confirm before closing; never close silently.

## Deliverable 4 — sandbox isolation, visible

Every Conductor coworker already runs in its own git worktree
(`node.worktreePath`, `node.branch`). A user closing one worker needs to trust that
nothing outside it was touched. Surface the worktree path and branch in the
inspector, and make it clear that closing preserves the worktree.

## Deliverable 5 — manager AI takes over from the human

The goal: **the human closes a crowded worker; the director AI decides what happens
next, and at higher autonomy levels the human stops having to decide at all.**

- On close, `conductorCloseNode` raises a `budget` escalation. At **L4** the
  existing `raiseEscalation()` already auto-approves some reasons — check whether
  closing a worker should join that set at L3/L4.
- The director should be able to **spawn a replacement worker** so the freed seat
  refills itself.
- Show, in the UI, which escalations the director is handling itself and which are
  genuinely waiting on a human. A human must never wonder "is this thing going to
  sort itself out?".
- **Always keep an undo.** A killed PTY is not recoverable, so a replacement prompt
  must be reversible until the new worker has actually started.

## Deliverable 6 — the animation itself

It should feel alive but never distracting. Requirements:

- typing, thinking, running, and blocked must be visually distinguishable **at a
  glance from across the room**, at `roomy` and `swarm` density
- work in the swarm floor where workers are ~small; the code already has `abbr`
  (two-letter) for dense tiers — use it, and do not shrink below legibility
- state changes must not make the layout jump (seat assignment is hysteresis-based;
  do not defeat that)
- `prefers-reduced-motion` ⇒ static state indicators that still communicate state

## Out of scope — already done, do not redo

- The renderer/worker data adapter (`useVisualAgents`) — working
- Conductor ↔ session merge (`conductorWorkforce.ts`) — working
- Palette tokens — **use them**, do not introduce new colours
- `hiddenCount` overflow — exists, needs meaning not implementation
- Backend per-worker close + crowd pressure — **just landed**, use the existing API

## What to hand back

1. The event shape you designed for activity, as a comment block or a
   `workforceActivity.ts` type module.
2. Working components, wired into `WorkforceScene` / `AgentCharacter` / the
   TerminalPage strip.
3. `npx tsc --noEmit --project tsconfig.app.json` — the repo has thousands of
   pre-existing errors, so **report a delta scoped to the files you touched**, not
   a bare pass/fail.
4. Screenshots of: 1 worker, 6 workers, 14 workers; and busy / blocked / error
   states. Reduce your own screenshots to prove reduced-motion works.
5. A one-paragraph note on what you deliberately did NOT do and why.
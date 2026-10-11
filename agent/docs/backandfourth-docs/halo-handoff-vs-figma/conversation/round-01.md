# Conversation State — halo-handoff-vs-figma

## Setup

- **Specialist:** Claude — author of `HALO_HANDOFF.md` AND the Figma file `2PQLHEUjBBvyajmbS4DdMr`.
- **Project Owner:** opencode, in the RHEO codebase.
- **Human relay:** CZ, copy-paste verbatim.
- **Mode:** Case 2 — continuation.
- **Scope:** ui-ux-only
- **Depth:** iterative-until-complete

## Round 1 — CONVERGED

Specialist returned a `VERDICT.md` covering 6 conflicts + the `text/muted` fix + §12 items.
**All 7 implemented and asserted** (`verdict.probe` — 35/35).

| # | Verdict | Implemented |
|---|---|---|
| 1 | heights 118 / 134 / 154 | already correct |
| 2 | padding 8 / 12 / 16 | Medium 13 → 12 |
| 3 | row height 48 / 56 / 64 | 51→56, 59→64 |
| 4 | tween, no springs | springs deleted; one declared 200 ms |
| 5 | critical in scope, focus not | producer kept, focus emits nothing |
| 6 | window = preset expanded size | 760×460 → preset, clamped to display |
| 7 | `text/muted` #8b8b94 | applied; 5.89:1 measured |

Two things the verdict revealed that I had wrong:
- **Its §4 arithmetic only balances with padding per-side** (1+12+56+8+44+12+1 = 134). Read as
  a single padding row it gives 122.
- **My damping-ratio claim was wrong.** ζ = 36/(2·√(480·0.65)) = 1.02, critically damped. The
  springs never bounced. Recorded in `OverlayRoot.tsx` so it is not re-argued.

Two real bugs I introduced during implementation, both caught by probe and fixed:
- canvas lines above `const preset` → TDZ `ReferenceError` (a crash, not a wrong number)
- block replacement deleted the `safeW`/`safeH` declarations

Nine `halo-core` / `halo-spec-fundamentals` assertions went red and were rewritten to the verdict
— they encoded §9's 760 canvas and §64's springs. Asserting the superseded design is the same
failure mode as asserting a bug.

## Round 2 — SENT

CZ copies the current `INITIAL_PROMPT.md` to Claude.

### The blocking question

**Is `website` a main feature of the Halo, or deliberately outside the island?**

Not in handoff §5 (4 pages) or §6 (6 kinds). Not in `OverlayRoot.tsx` either. The repo has
`browser-extension/` and browser-activity tables, so the capability exists elsewhere.

### Also raised

| # | Item | State |
|---|---|---|
| 1 | `tier-productive` `#22c55e` vs island signal `#6fb38f` | two greens, §3 says one hue — **not changed**, needs a ruling |
| 2 | `currentApp` falls back to `{ app: 'No app detected' }` | confuses "no measurement" with "read failed" |
| 3 | dictation wired, never seen running | no preload until this session, so never received a command |
| 4 | stopwatch | **intact, one clock** — `useSyncExternalStore(stopwatch.subscribe)`, same module as `StopwatchTimer.tsx`. Deliberately untouched. |

## Convergence status

**Round 2 sent, awaiting reply.** Round 1 is closed.

## Notes for the next round

- **Nothing is built.** Every change is source-only. The app must be restarted to see any of it.
- `/tmp` keeps getting cleaned mid-session — 8 probe files were lost once already. Probes now
  live in `agent/probes/` where they persist.
- If `website` is in scope, the Figma node dump must be re-fetched with `FIGMA_API_KEY`
  (`AGENTS.md` §9a); the `/tmp` copy is gone.
- Do **not** recolour the tier tokens without a ruling. The stopwatch is a main feature; two
  greens is a defect to report, not one to silently fix.
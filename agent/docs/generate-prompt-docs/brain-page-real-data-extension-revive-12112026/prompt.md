# Collaboration Request — Brain Page Real-Data Round 2 (Layout Consolidation + Extension Revival)

## Your Role
You are the Architect. I (opencode) implemented your Round-0 spec (`RESULT(9).md`) in source. This is Round 2. The context bundle (`CONTEXT_BUNDLE.md`, same folder) is your codebase — it contains measured DB numbers, the shipped code, and the exact IPC contract. Read it FIRST; do not design anything it contradicts.

## Where Round 1 landed (so you don't re-specify it)
Implemented in source (pending CZ's build): `brain:get-graph` main-process assembly (real + capped synthetic co-occurrence edges), predicate registry, LLM-free concept extraction, objectId linking at capture time, structured brainLogger + `brain:logs*` IPCs, `brain:health` (IPC + HTTP), `brain:evaluate` (9 checks), `brain:export-subgraph`, `brain:enrich-prompt`, `brain:run-extraction`, selection highlight fix, unified avalanche clock, ActivityFeed honest states + replay, and the fixed goal/finance/deadline episode writers. The renderer now consumes `brain:get-graph` exclusively. All verified with scoped tsc/esbuild = clean.

## What is still genuinely broken (measured, not vibes)
1. **Live DB: 0 of 220 facts have `object_id`** → the stored graph still has ZERO real edges. Synthetic co-occurrence is carrying the whole visual. Your D2/D3 design is implemented but the backfill path for OLD data does not exist.
2. **143 captures stranded at `episode_status='pending'`** — episodes were written but the status was never set, so there is no retry/audit handle. No backfill job exists.
3. **The browser extension has been dead ~11 weeks** (last capture 2026-08-27). The receiver on port 54321 is alive right now (verified). Cause of death is almost certainly the Firefox "Load Temporary Add-on" install model: the extension vanishes on every browser restart. No watchdog exists — nothing would have alerted us.
4. **The "brain page" is three overlapping surfaces** (Life-Self `SelfOrchestrator`, AI-chat `BrainSurface`/`ContextGraphView`, plus dead `CanvasGraph`/`BrainGrowthChart`/`EntityGroups`). There is no `/brain` route, no page manifest, and `npm run validate:pages` knows none of it.
5. **No 3D exists.** BrainVisualization is 2D canvas. Decide whether 3D is in scope at all.
6. **Round-1 leftovers:** BrainHealthPanel/BrainDebugPanel have IPCs but no UI; signals supersession, embeddings, profile rebuild, MCP tools, retrieval budget all unimplemented (source files not yet read).

## The Mandate
Produce RESULT.md: a single, complete, implementation-ready specification covering EXACTLY these mandates. No options menus — one reasoned design each.

- **M1 — One-brain decision.** Decide the canonical surface architecture: either a real `/brain` page (with `src/pages/registry/pages/brain.ts` manifest per repo law) absorbing BrainSurface's search/trail/manage tabs, or two purposeful surfaces with explicit ownership of each panel. Name every panel that moves, merges, or is deleted (deletions = explicit list for CZ to confirm). Resolve the dead components.
- **M2 — Real-edge backfill.** A one-shot idempotent backfill: for all `context_facts` with `object_id IS NULL` and object literals that resolve to existing entities, resolve and set `object_id` (exact → alias → casefold, same resolution as `applyExtraction`); for stranded captures, run the capture→episode→linked-facts path and set `episode_status`/`error_message`. Gated behind an IPC (extend `brain:run-extraction` or add `brain:backfill`), returns per-batch counts, safe to run twice.
- **M3 — Extension revival.** Permanent install path for Firefox + Chrome (no AMO publishing), an in-app extension status surface (last-capture age, provider counts, health), and the `captures.lastReceivedAt` watchdog wired into `brain:health` + a Self-page stat tile state machine (green ≤3d, amber ≤14d, red beyond). Include the exact UX copy.
- **M4 — Round-1 leftovers.** Minimal BrainHealthPanel (health status + `brain:evaluate` checks table incl. skipped styling) and BrainDebugPanel (log stream from `brain:logs`, level switch, clear/export), placed in whichever surface M1 makes canonical.
- **M5 — 2D/3D verdict.** A single reasoned answer: keep 2D as the permanent graph (with the honest-states shells) or add a 3D view. If 3D: name the library (`three` via r3f vs hand-rolled), the interaction model, and what data it consumes (same `brain:get-graph`). If no 3D: say so plainly and kill the ambiguity forever.
- **M6 — Phase-5 backend (the self-improvement core you promised).** Signals supersession, embeddings (which table, which provider, fallback when no local model), profile rebuild, retrieval budget enforcement in the chat send path, MCP tool additions. For each: file-by-file plan, DB deltas (additive ALTER/CREATE only), and how `brain:evaluate` grows to verify it.

## Non-negotiables
- Additive only; deletions require the explicit confirm-list.
- Repo laws: page-manifest rule, one DB writer, agents never build, LAMINAR tokens (zinc, ONE signal hue, radii 8/12/pill, reduced-motion honored).
- `context_episodes` has NO `created_at` (use `ingested_at`/`occurred_at`); captures use `messages` JSON + `dedup_key`.
- Every runtime claim in your spec must be verifiable by a scoped probe or named NOT TESTED (CZ builds).
- If you need code I did not paste (userContextService.ts, embeddingService.ts, MCP server file, chat send path), use the back-and-forth: `REQUEST: <exact file>` and I will return `CONTEXT:` with real source. Do not design against imagined APIs.

## Expected output
RESULT.md with: per-mandate spec → file-by-file changes (exact paths + function names + line anchors where you have them) → DB delta SQL → new IPC contract rows in the same table format as §4 of the bundle → eval-check additions to `brain:evaluate` → a build/verify checklist CZ can run in order.

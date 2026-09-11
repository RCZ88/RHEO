# Agent Intelligence Gap — Improvement Plan
**Project:** DeskFlow / Tracker Mind  
**Goal:** Close the capability gap between top-tier models (Opus 4, Gemini 2.5 Pro, etc.) and mid/lower-tier models (mini, flash, haiku, smaller open-weights) operating inside the terminal workspace.  
**Status:** Plan — Ready for agent to process and schedule  
**Date:** 2026-05-26

---

## Problem Statement

Top-tier models (Opus 4, Sonnet 4.5, Gemini 2.5 Pro, GLM-4) reliably:
- Read and internalize all agent workspace files on session start
- Maintain state coherently across long sessions
- Utilize the full infrastructure (problems, requests, checklists, skills, glossary, patterns)
- Produce structured output in the expected format (metadata blocks, actions.json)

Lower/mid-tier models (GPT-4o-mini, Haiku, flash variants, smaller open-weights) commonly fail at:
- Not reading `state.md`, `context.md`, `glossary.md`, `patterns.md` even when instructed
- Ignoring or misformatting the `## Session Metadata` and `## Actions` output blocks
- Not updating `agent/state.md` at session end
- Forgetting which problem is bound, which checklist is active
- Producing non-parseable `actions.json` payloads
- Context window overflow causing silent truncation of early instructions

---

## Root Causes

| Cause | Impact |
|-------|--------|
| Instructions buried deep in a long init prompt | Model attends to recency, misses critical rules |
| No reinforcement loop — rules stated once, never re-anchored | Drift after ~20 turns |
| Workspace files listed but not quoted inline — model has to "remember" to read them | It doesn't |
| `actions.json` schema only described in prose | Smaller models produce invalid JSON |
| No runtime check that validates agent output format | Silent failures accumulate |
| State file is human-readable prose, not machine-parseable | Hard for weak models to extract structured data |
| Glossary and patterns are in separate files, only loaded if the model decides to read them | They rarely do |
| No feedback to the model when an action failed to parse | No self-correction signal |

---

## Improvement Plan

The plan is organized into 5 tiers. Each tier can be implemented independently. Lower tiers yield the highest return for effort.

---

### TIER 1 — Prompt Architecture (Highest ROI, no new code)

**Goal:** Restructure the system prompt so critical rules survive model attention decay.

#### 1.1 — Layered System Prompt Format

Restructure `buildInitContent()` and the assembled system prompt into explicit layers, not a flat text blob:

```
[LAYER 0 — IDENTITY & CONSTRAINTS]          ← First 300 tokens. Never changes.
[LAYER 1 — CURRENT STATE SNAPSHOT]          ← Injected fresh every session
[LAYER 2 — TASK CONTEXT]                    ← Problem/request bound to this terminal
[LAYER 3 — WORKSPACE RULES & PATTERNS]      ← Compressed. Key rules only.
[LAYER 4 — REFERENCE MATERIAL]              ← Skills, glossary (only relevant subset)
```

Rules: Layer 0 and Layer 1 must always be present. Layers 3–4 can be trimmed for shorter context windows.

#### 1.2 — Mandatory File Pre-read Block

In the init prompt, instead of telling the model "you should read `state.md`", **inline the file content directly**:

```
## CURRENT STATE (auto-injected from agent/state.md — do not skip)
<state content here>

## GLOSSARY EXCERPT (key terms only)
<top 20 glossary entries>

## ACTIVE PATTERNS
<patterns.md content>
```

This removes the dependency on the model choosing to read the file. The `assembleContext()` / `buildInitContent()` pipeline already reads these files — the change is to inline them unconditionally for all agent tiers, not just when the toggle is on.

#### 1.3 — Compressed Rules Card

Create `agent/RULES_COMPACT.md`: a 200-token distillation of the most critical behavioral rules. This is injected at the **top** of every system prompt, before anything else:

```markdown
# AGENT RULES (read first — always)
1. At session start: read state.md, context.md, active problem, active checklist.
2. At session end: write ## Session Metadata block. Write actions.json if changes.
3. actions.json format: { "actions": [ { "type": "...", "payload": {...} } ] }
4. Never guess file paths. Use list-agent-dir-files if unsure.
5. Current bound problem: {{PROBLEM_ID}} — {{PROBLEM_TITLE}}
6. If unsure about a term: check glossary.md before asking the user.
```

Template variables (e.g. `{{PROBLEM_ID}}`) are filled by `buildInitContent()` at session creation time.

#### 1.4 — Anchored Reminders (Mid-Session Re-injection)

Currently rules are stated once at session start. Add periodic re-injection of a mini rules card. Two mechanisms:

**Option A — Threshold-based:** After every N user messages (configurable, default 10), prepend a compact reminder to the next user message automatically in `terminalWriteRaw`.

**Option B — Explicit remind command:** A "remind" preset that writes the RULES_COMPACT block + current state snapshot into the terminal on demand. This is a single preset command, trivial to add.

Both should be implemented. Option B is immediate (1 hour of work). Option A requires middleware in the write pipeline.

---

### TIER 2 — State File Improvements (Medium effort, high reliability gain)

**Goal:** Make `state.md` machine-readable so weak models can parse it reliably.

#### 2.1 — Structured State Format

Convert `agent/state.md` from prose to a structured format that is both human and machine readable:

```markdown
# Agent State

## Metadata
- version: 3.41
- last_updated: 2026-05-21T18:00:00Z
- agent: claude-sonnet-4

## Active Work
- active_problem_id: P-042
- active_problem_title: "Terminal resize race condition"
- active_request_id: R-017
- active_checklist_ids: [CL-008, CL-009]
- current_phase: "implementation"
- blocked: false
- blocked_reason: null

## Session Continuity
- last_session_summary: |
  Fixed the chunked write issue. Next: tackle the resize handler.
- open_questions:
  - "Should the resize debounce be 100ms or 200ms?"

## Progress
- problems_solved_this_sprint: [P-039, P-040, P-041]
- files_modified: [src/main.ts, src/components/TerminalWindow.tsx]
```

This format is trivially parseable by any model and survives context compression better than prose paragraphs.

#### 2.2 — Automated State Snapshot on Session Init

In `initializeSession()` (or `initializeTerminal()`), automatically read the current `state.md`, `PROBLEMS.md` (active issues only), and active checklists, then write them as a single `## CURRENT STATE SNAPSHOT` block into the terminal **after** the main init prompt. This means the model sees fresh state right before its first turn, not just at init time.

#### 2.3 — State Update Validation

When the model writes a `## Session Metadata` block, validate it against an expected schema before persisting. If fields are missing or malformed, write a short error message back into the terminal: `[SYSTEM: Session metadata parse failed. Expected fields: summary, tokens_used, changes_made. Please re-emit the block.]`

This gives even weak models a correction signal.

---

### TIER 3 — actions.json Hardening (Medium effort, eliminates silent failures)

**Goal:** Make `actions.json` parsing robust and give the model feedback when it fails.

#### 3.1 — Strict JSON Schema + Inline Examples

Add `agent/ACTIONS_SCHEMA.md` with the exact JSON schema and 3 worked examples (create_problem, update_problem, complete_checklist). Inline this in the system prompt for all agents (it's ~400 tokens).

#### 3.2 — Parse Error Feedback Loop

In `executeActionsFromFile()`, when JSON parse fails or a required field is missing:
1. Log the raw content to `agent/actions_error.log` with timestamp
2. Write a `[SYSTEM: actions.json parse error — {reason}. Raw content saved to actions_error.log. Please re-emit a valid actions.json.]` message back to the terminal via `terminalWriteRaw`

Currently errors are silent. This single change will cause most models to self-correct.

#### 3.3 — Action Type Whitelist + Partial Recovery

If actions.json contains some valid actions and some invalid ones, execute the valid ones and report the failures. Currently any invalid JSON aborts the entire batch.

---

### TIER 4 — Context Assembly Improvements (Higher effort, major capability unlock)

**Goal:** Smarter context assembly that gives each model the right amount of the right content.

#### 4.1 — Model Tier Profiles

Add a `modelTier` field to session config: `"top" | "mid" | "low"`. Wire this to `NewSessionDialog` as a dropdown alongside the agent type selector.

Each tier gets a different context assembly profile:

| Profile | LLM Wiki | Skills | Graphify | PARA | State Inline | Compact Rules |
|---------|----------|--------|----------|------|--------------|---------------|
| top | full | full | full | full | no (model reads it) | optional |
| mid | full | excerpts | summary | top projects only | yes | yes |
| low | compressed | top 3 relevant | disabled | disabled | yes (verbose) | yes (repeated) |

This is a config change in `ContextConfig.ts` + UI change in `NewSessionDialog.tsx`.

#### 4.2 — Relevant-Skills-Only Injection

Currently skills are injected as a list. Instead, at session init time, match the active problem's `category` and `title` keywords against skill names/descriptions and inject only the top 3–5 most relevant skills inline. This reduces token waste and improves signal-to-noise for smaller models.

#### 4.3 — Problem-Aware Context Injection

When a problem is bound to the terminal, auto-inject into the init prompt:
- The full problem record (title, description, root_cause, files affected)
- All checklist items for that problem
- Any linked requests
- The last 3 messages from any previous session that touched this problem

This gives mid/low models the precise context they need without requiring them to navigate files themselves.

---

### TIER 5 — Tooling & UI (Lower ROI, quality-of-life improvements)

#### 5.1 — Model Capability Badge in Terminal Tabs

Show a small badge in each terminal tab indicating the model tier (e.g., "top / mid / low"). This helps the user calibrate their expectations and decide which model to use for which task.

#### 5.2 — "Remind" Preset (Quick Win)

Add a built-in preset named `[SYSTEM] Remind` that writes the RULES_COMPACT block + current state snapshot into the active terminal. Zero new code architecture, just a preset command. Implement immediately.

#### 5.3 — State Diff View in Sessions Tab

In the Session Messages Viewer, add a "State Changes" tab that diffs `state.md` before and after the session. Helps the user see at a glance what the agent actually remembered/updated.

#### 5.4 — Fix the 4 Known Undefined Functions

From `TERMINAL_AND_WORKSPACE_FEATURES.md` section 27, these 4 undefined functions currently break key UI:
- `handleTerminalMoveToGroup` — Map tab drag-drop broken
- `loadSavedConfigs` — Configs tab broken
- `handleSaveWorkspace` — Save Config dialog broken
- `handleLoadWorkspace` — Load workspace broken

These are not model-tier issues but they degrade the overall workspace reliability, which affects agent productivity indirectly. Fix these before implementing Tier 4+.

---

## Implementation Priority Order

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Fix 4 undefined functions (T5.4) | 1–2h | Unblocks existing features |
| 2 | RULES_COMPACT.md + inject at prompt top (T1.3) | 1h | Immediate behavior improvement |
| 3 | Inline state.md + patterns.md unconditionally (T1.2) | 2h | Eliminates #1 failure mode |
| 4 | actions.json parse error feedback (T3.2) | 2h | Eliminates silent failures |
| 5 | "Remind" preset (T5.2) | 30m | Immediate, zero-risk quick win |
| 6 | Structured state.md format (T2.1) | 2h | Better state tracking for all tiers |
| 7 | Problem-aware context injection (T4.3) | 3h | Major boost for mid-tier models |
| 8 | Mid-session re-injection — Option B (T1.4) | 1h | Prevents drift in long sessions |
| 9 | Model tier profiles in ContextConfig (T4.1) | 4h | Full control over context per model |
| 10 | Relevant-skills-only injection (T4.2) | 3h | Reduces noise, improves focus |
| 11 | State update validation (T2.3) | 2h | Self-correction loop |
| 12 | Layered system prompt format (T1.1) | 3h | Clean architecture for all future changes |

---

## Files to Create / Modify

### New Files
- `agent/RULES_COMPACT.md` — 200-token rules card with template variables
- `agent/ACTIONS_SCHEMA.md` — actions.json schema + 3 examples
- `agent/actions_error.log` — parse error log (auto-created by main.ts)

### Modified Files
- `agent/state.md` — convert to structured YAML-like format (T2.1)
- `src/services/ContextConfig.ts` — add `modelTier` field + tier profiles (T4.1)
- `src/services/ContextService.ts` — implement tier-aware assembly + inline injection (T1.2, T4.1, T4.2, T4.3)
- `src/main.ts` — `executeActionsFromFile()` error feedback (T3.2), partial recovery (T3.3), state snapshot injection (T2.2)
- `src/pages/TerminalPage.tsx` — fix 4 undefined functions (T5.4), re-injection middleware (T1.4-A)
- `src/components/NewSessionDialog.tsx` — model tier selector (T4.1), problem-aware context preview
- `src/lib/defaults.ts` — add RULES_COMPACT template, ACTIONS_SCHEMA constant

---

## Success Metrics

After implementing Tiers 1–3, measure against these:

| Metric | Before | Target |
|--------|--------|--------|
| % of sessions where model reads state.md | ~40% (mid-tier) | >95% |
| % of sessions with valid Session Metadata block | ~60% (mid-tier) | >95% |
| % of actions.json writes that parse successfully | ~70% (mid-tier) | >98% |
| User-reported "model forgot context" incidents per week | ~5–8 | <1 |
| Mid-tier model completes multi-step problem without drift | ~30% | >70% |

---

## Notes for Agent Processing This Plan

- Work through priority order. Do not skip to Tier 4 before Tier 1 is done.
- `RULES_COMPACT.md` template variables use `{{PLACEHOLDER}}` syntax — `buildInitContent()` must fill these before injection.
- Do not modify `src/index.css` Tailwind imports — v4 only.
- No git commands. Fix code manually.
- All DB/file operations go through IPC preload bridge (no direct Node in renderer).
- After each implemented item, update `agent/state.md` and `agent/PROBLEMS.md` accordingly.
- The structured `state.md` format (T2.1) is a breaking change — update all code that reads/writes state.md atomically in one session to avoid partial breakage.
# Model Improvement — Verification & Walkthrough Guide
**Project:** DeskFlow / Tracker Mind  
**Purpose:** Concrete proof that every improvement from `model_improv.md` exists and is working  
**Source of truth:** `agent/docs/model-improvements-verification/CONTEXT_BUNDLE.md`  
**Date:** 2026-05-28

---

## Quick Summary — What Was Built

| # | Improvement | Files Changed | Visible Evidence |
|---|-------------|---------------|-----------------|
| 1 | RULES_COMPACT.md rules card | `agent/RULES_COMPACT.md` (new) | Open the file |
| 2 | Layered context assembly | `src/services/ContextService.ts:149–275` | Context preview in NewSessionDialog |
| 3 | Model tier profiles | `src/services/ContextConfig.ts:1–98` | Tier dropdown in New Session Dialog |
| 4 | Tier badge in terminal tabs | `src/pages/TerminalPage.tsx:1511–1518` | Colored badge on each tab |
| 5 | Auto re-injection middleware | `src/main.ts:6716–6730`, `5993–5998` | Every 10 messages → `[SYSTEM]` appears in terminal |
| 6 | Actions parse feedback | `src/main.ts:6485–6564`, `6585–6687` | `[SYSTEM]` error message in terminal on bad JSON |
| 7 | `[SYSTEM] Remind` preset | `src/pages/TerminalPage.tsx:549`, `968–997` | Built-in preset in Presets tab |
| 8 | ACTIONS_SCHEMA.md | `agent/ACTIONS_SCHEMA.md` (new) | Open the file |
| 9 | Structured state.md | `agent/state.md:1–31` | Open the file — YAML-like format |
| 10 | Configs tab functions fixed | `src/pages/TerminalPage.tsx` | Configs tab no longer crashes |

---

## Part 1 — File Evidence (What to Open, What to Look For)

### Item 1 — RULES_COMPACT.md

**Open:** `agent/RULES_COMPACT.md`  
**Search for:** `AGENT RULES (read first — always)`  
**Verify:** File exists and contains exactly 9 numbered rules ending with `NEVER change @import "tailwindcss"`. Two template variables visible: `{{PROBLEM_ID}}` and `{{PROBLEM_TITLE}}` on line 5.  
**How it works:** `buildInitContent()` reads this file, fills in the template variables from the bound problem record, and injects the result at the very top of every system prompt before any other content.

---

### Item 2 — Layered Context Assembly

**Open:** `src/services/ContextService.ts`  
**Go to:** Lines 149–275  
**Search for:** `forceAdd`  
**Verify:** You should see `forceAdd` called three times in sequence — once for RULES_COMPACT, once for state.md (capped at 2000 chars), once for patterns.md (capped at 1500 chars). These three calls happen before the token-budget loop that handles Layers 3–4. Any content added via `forceAdd` is not counted against the budget and cannot be trimmed.  
**How it works:** The function builds context in order. Layers 0–2 are unconditional. Layers 3–4 enter a budget loop that trims from the outside in if the total would exceed the tier's token limit.

---

### Item 3 — Model Tier Profiles

**Open:** `src/services/ContextConfig.ts`  
**Go to:** Lines 1–98  
**Search for:** `TIER_PROFILES`  
**Verify:** You should see a `ModelTier` type (`'top' | 'mid' | 'low'`) and a `TIER_PROFILES` object with three entries. Each entry specifies a `total_token_budget`, which systems are enabled, and whether excerpts or full content are used. Budgets should read approximately: top=10000, mid=7000, low=4000.

---

### Item 4 — Model Tier Badge in Terminal Tabs

**Open:** `src/pages/TerminalPage.tsx`  
**Go to:** Lines 1511–1518  
**Search for:** `modelTier === 'top'`  
**Verify:** A conditional JSX block rendering a `<span>` with three color branches: `bg-green-500/20 text-green-400` for top, `bg-blue-500/20 text-blue-400` for mid, `bg-yellow-500/20 text-yellow-400` for low.

---

### Item 5 — Auto Re-injection Middleware

**Open:** `src/main.ts`  
**Go to:** Lines 6716–6730 (function definition), then 5993–5998 (call site)  
**Search for:** `maybeReinjectRules` and `RULES_REINJECT_THRESHOLD`  
**Verify:** The constant `RULES_REINJECT_THRESHOLD = 10` is visible. The `maybeReinjectRules` function reads `agent/RULES_COMPACT.md` from the terminal's working directory and writes it to the PTY. At the `write-terminal` IPC handler call site, you should see a counter increment and a modulo check (`count % RULES_REINJECT_THRESHOLD === 0`) that triggers the function. Also search for `terminalMessageCounts.delete` inside the terminal `kill()` function — the counter is cleared on terminal kill so each new session starts fresh.

---

### Item 6 — Actions Parse Feedback

**Open:** `src/main.ts`  
**Go to:** Lines 6485–6564 (terminal output actions), 6585–6687 (actions.json file watcher)  
**Search for:** `actionCount`, `failCount`, `actions_error.log`  
**Verify (terminal output):** Variables `actionCount` and `failCount` track successes and failures per `## Actions` block. At the end of the block, a `[SYSTEM] Actions block:` message is written to the terminal if any action failed.  
**Verify (file watcher):** The `executeActionsFromFile` function catches JSON parse errors and: (a) writes the raw content to `agent/actions_error.log` with a timestamp, (b) writes `[SYSTEM] actions.json parse error` to the terminal, (c) continues to execute any valid actions it found before the error (partial recovery). Search for `partial recovery` comment or the `errors.push()` / `validActions` split pattern.

---

### Item 7 — `[SYSTEM] Remind` Built-in Preset

**Open:** `src/pages/TerminalPage.tsx`  
**Go to:** Line 549 (preset definition), lines 968–997 (execution handler)  
**Search for:** `builtin-remind` and `isBuiltIn: true`  
**Verify (definition):** Object `{ id: 'builtin-remind', name: 'Remind', command: '', category: 'system', isBuiltIn: true }` in the default presets array.  
**Verify (handler):** The execution handler for `builtin-remind` reads `RULES_COMPACT.md` and `state.md` at execution time (not stored), then writes a `## [SYSTEM] Remind — Current Session Context` header followed by both file contents to the active terminal. `state.md` is truncated to 1500 chars to avoid flooding.

---

### Item 8 — ACTIONS_SCHEMA.md

**Open:** `agent/ACTIONS_SCHEMA.md`  
**Search for:** `create_problem`, `update_problem`, `complete_checklist`, `update_request`  
**Verify:** File is 48 lines. Contains the JSON schema definition followed by 3 complete worked examples, one for each major action type. This file is inlined into the system prompt by `buildInitContent()` — search `ContextService.ts` for `ACTIONS_SCHEMA` to confirm the injection point.

---

### Item 9 — Structured state.md Format

**Open:** `agent/state.md`  
**Search for:** `## Active Work` and `active_problem_id:`  
**Verify:** File follows the key-value format: `## Metadata`, `## Active Work`, `## Session Continuity`, `## Progress` sections. Values use `field: value` syntax, not prose paragraphs. Lists use `[item1, item2]` syntax. No run-on narrative text in structured fields.

---

### Item 10 — Configs Tab Functions Fixed

**Open:** `src/pages/TerminalPage.tsx`  
**Search for:** `handleSaveWorkspace`, `handleLoadWorkspace`, `handleTerminalMoveToGroup`, `loadSavedConfigs`  
**Verify:** All four function names resolve to actual function bodies (not undefined). `handleSaveWorkspace` should contain IPC calls to save layout + sessions + presets. `handleLoadWorkspace` should contain `spawnTerminal` calls. `handleTerminalMoveToGroup` should contain `findLeafInTree` / `removeLeafFromTree` / `addLeafToGroup` calls. `loadSavedConfigs` should contain `deskflowAPI.getTerminalPresets()`.

---

## Part 2 — UI Walkthrough (Running App)

Follow these steps in the running Electron app to see each improvement in the UI.

### Step 1 — See the Model Tier Dropdown
1. Open the **Tracker Mind** page (terminal workspace)
2. Click **New Session** in the Sessions tab sidebar
3. The `NewSessionDialog` opens — look below the **AI Agent** selector dropdown
4. You should see a **Model Tier** dropdown with options: `top`, `mid`, `low`
5. Default selection is `mid`

### Step 2 — See the Tier Badge on Terminal Tabs
1. Create a new session with tier set to `top`
2. Look at the terminal tab bar at the top of the workspace
3. Next to the session name, a small colored badge reads `top` in green
4. Create another session with tier `low` — badge appears in yellow
5. `mid` sessions show a blue badge

### Step 3 — Trigger the `[SYSTEM] Remind` Preset
1. Open the **Presets** tab in the sidebar (⚡ icon)
2. Scroll to the bottom of the preset list — `[SYSTEM] Remind` appears with a blue badge and no delete button
3. Click the ▶ Run button
4. In the active terminal, you will see a `## [SYSTEM] Remind` block printed, showing the current RULES_COMPACT content and a truncated state.md snapshot
5. The model sees this output as context

### Step 4 — See Auto Re-injection in Action
1. Open a terminal with an active agent session
2. Send 10 messages to the terminal (any content)
3. On the 10th message, immediately after your input, a `[SYSTEM] Rules reminder (auto-injected)` block appears in the terminal output
4. This repeats every 10 messages for the lifetime of that terminal
5. Open a new terminal — the counter resets to 0

### Step 5 — Trigger an Actions Parse Error
1. In an agent terminal, manually write a malformed JSON to `agent/actions.json`:
   ```
   { "actions": [ { "type": "create_problem" BROKEN } ] }
   ```
2. Save the file
3. Within ~2 seconds, the terminal prints: `[SYSTEM] actions.json parse error — Unexpected token...`
4. Open `agent/actions_error.log` — it contains a timestamped entry with the raw malformed content

### Step 6 — See the Configs Tab Working
1. Open the **Configs** tab in the sidebar (⊞ icon)
2. Previously this tab crashed on load — now it loads the saved presets list
3. Click **Save Workspace** — a dialog appears (previously was broken/undefined)
4. Click **Load Workspace** — a dialog appears with saved workspace configurations
5. In the Map tab, drag a terminal to a new group — the move completes without errors (previously `handleTerminalMoveToGroup` was undefined)

---

## Part 3 — Engineering Specifications

### Auto Re-injection System
- **Trigger:** Every `write-terminal` IPC call from renderer increments a per-terminal counter (`terminalMessageCounts`)
- **Threshold:** When `count % 10 === 0`, `maybeReinjectRules(terminalId)` fires
- **Content:** Reads `agent/RULES_COMPACT.md` from `terminalInfo.cwd` — always fresh from disk, never cached
- **Format:** Prepends `[SYSTEM] Rules reminder (auto-injected):\n` before the file content
- **Delivery:** Written directly to PTY via `terminalInfo.pty.write()` — bypasses all React state
- **Lifecycle:** Counter is deleted from the Map when the terminal is killed, so resuming creates a fresh counter

### Tier-Aware Context Assembly
- **Layer 0–2 (forceAdd):** Bypass the token budget check entirely. Always injected. Cannot be disabled or trimmed. Budget counter is not incremented for these layers.
- **Layer 3 (problem context):** Only injected if a problem is bound to the terminal. Counts against budget. Trimmed first if budget is exceeded.
- **Layer 4 (reference material):** LLM wiki, skills, graphify, PARA, QMD. Trimmed per tier profile. Low tier receives compressed wiki + top-3 relevant skills matched against the active problem's category. Top tier receives full everything.
- **Relevant skills matching:** Problem title and category keywords are matched against skill names and descriptions using substring matching. Top N skills by match score are selected, where N = tier profile's `max_skills`.

### Actions Feedback Loop
- **Per-action tracking:** `actionCount` and `failCount` counters increment for each action processed in a block
- **Error accumulation:** `errors[]` array collects failure reasons per action
- **Summary message:** Written to terminal at end of block only if `failCount > 0`
- **Partial recovery:** Valid actions in the same block execute even when others fail. Execution does not abort on first failure.
- **File watcher path:** On `actions.json` change → read → parse → if valid JSON: execute actions → clear file. If invalid JSON: log to `actions_error.log` → write `[SYSTEM]` error to terminal → do not clear file (preserves for debugging)

### Remind Preset Mechanics
- Preset has `command: ''` — the Run handler detects the empty command + `isBuiltIn: true` flag and routes to the built-in handler
- Files are read at execution time from `terminalInfo.cwd` — not baked in at session creation. This means if you update `RULES_COMPACT.md` or `state.md` mid-session, the Remind preset will show the updated versions.
- `state.md` is truncated to 1500 characters to avoid overwhelming the context. The truncation adds `\n[...truncated]` at the cut point.
- The preset is always present in the list even if no project is loaded — it gracefully handles missing files with a `[SYSTEM] File not found` notice

---

## Part 4 — Configurable Parameters

All parameters below can be changed without rebuilding the renderer (main.ts changes require `npm run build:electron`; ContextConfig/ContextService changes require `npm run build:renderer`).

| Parameter | File | Line | Default | How to Change |
|-----------|------|------|---------|---------------|
| Auto re-injection threshold | `src/main.ts` | 6717 | `10` | Change `RULES_REINJECT_THRESHOLD` constant |
| Model tier default | `src/components/NewSessionDialog.tsx` | ~493 | `'mid'` | Change `useState('mid')` initial value |
| Top tier token budget | `src/services/ContextConfig.ts` | TIER_PROFILES | `10000` | Edit `top.total_token_budget` |
| Mid tier token budget | `src/services/ContextConfig.ts` | TIER_PROFILES | `7000` | Edit `mid.total_token_budget` |
| Low tier token budget | `src/services/ContextConfig.ts` | TIER_PROFILES | `4000` | Edit `low.total_token_budget` |
| Max skills injected (low tier) | `src/services/ContextConfig.ts` | TIER_PROFILES | `3` | Edit `low.max_skills` |
| Max skills injected (mid tier) | `src/services/ContextConfig.ts` | TIER_PROFILES | `5` | Edit `mid.max_skills` |
| State.md inline max chars (Layer 1) | `src/services/ContextService.ts` | ~165 | `2000` | Change the slice/cap constant |
| Patterns.md inline max chars (Layer 2) | `src/services/ContextService.ts` | ~175 | `1500` | Change the slice/cap constant |
| Remind preset state.md truncation | `src/pages/TerminalPage.tsx` | ~985 | `1500` | Change truncation length in handler |
| Actions error log path | `src/main.ts` | ~6600 | `agent/actions_error.log` | Change path string in `executeActionsFromFile` |
| RULES_COMPACT rules card path | `src/services/ContextService.ts` | ~155 | `agent/RULES_COMPACT.md` | Change path string in Layer 0 injection |

---

## Part 5 — Build Verification

Run these commands from the project root to confirm everything compiles cleanly after the changes:

```bash
# Build both renderer and electron
npm run build

# Check for TypeScript errors only (no output files)
npx tsc --noEmit

# Start the app to confirm runtime
npm start
```

**Expected:** Zero TypeScript errors. The four previously-broken functions (`handleSaveWorkspace`, `handleLoadWorkspace`, `handleTerminalMoveToGroup`, `loadSavedConfigs`) no longer produce `ReferenceError: X is not defined` at runtime.

**Regression check:** Open the Configs tab, the Map tab drag-drop, and the Save Checkpoint dialog — all three should function without console errors.

---

## Part 6 — Failure Mode Reference

If something isn't working, use this table to diagnose:

| Symptom | Likely cause | Where to check |
|---------|-------------|----------------|
| Re-injection not appearing every 10 messages | `write-terminal` IPC not being used (agent writing directly?) | Confirm renderer uses `deskflowAPI.terminalWriteRaw`, not raw PTY |
| RULES_COMPACT not appearing in session init | Template vars not filled, file missing | Check `buildInitContent()` for `{{PROBLEM_ID}}` substitution; check file exists |
| Tier badge not showing | `modelTier` not saved in session object | Check `saveTerminalSession` IPC includes `model_tier` field |
| Remind preset missing | `builtin-remind` filtered out of presets list | Check if list filters on `isBuiltIn` anywhere |
| actions.json feedback not appearing | `fs.watch` not firing, or error swallowed | Check `agent/actions_error.log` for entries; check main.ts `executeActionsFromFile` catch block |
| state.md still in prose format | File was manually edited back | Re-apply structured format from Item 9 above |
| Configs tab crashing | One of the 4 functions still undefined | Search TerminalPage.tsx for each function name — confirm it has a body, not just a call |
# Durable Debugging Rules

Rules extracted from real bugs to prevent repeat mistakes.

## 1. Tailwind v4 CSS — NEVER use v3 directives

This project uses `tailwindcss` v4 (`4.2.1`). `src/index.css` MUST use `@import "tailwindcss";`. NEVER change it to v3 directives (`@tailwind base; @tailwind components; @tailwind utilities;`) — v3 directives silently break v4 (CSS builds successfully but most utility classes are missing).

## 2. Package pinning — NEVER run `npm install tailwindcss@latest`

`tailwindcss: "4.2.1"` and `@tailwindcss/vite: "4.2.1"` are pinned exact. Running `@latest` may downgrade to v3. Do NOT add `autoprefixer` or `postcss` — they are v3 dependencies. `electron.vite.config.ts` already handles everything.

## 3. Jest config — `testEnvironment: "jsdom"` NOT "node"

This project uses `jsdom` (not "node") because components render DOM. Keep test environment set to "jsdom".

## 4. Do NOT use git checkout/restore/reset/stash

Git revert commands destroy work. If something broke, fix the code manually. Never run:
- `git checkout -- <file>`
- `git checkout HEAD -- <file>`
- `git restore <file>`
- `git reset --hard`
- `git stash`

## 5. Identifiers colliding with DOM globals

If a JSX variable has a name like `name`, `title`, `description`, `list`, `items` — check if it shadows a DOM global or HTML attribute. Use more specific names like `sessionName`, `dialogTitle`, etc.

## 6. CSS calc with Tailwind

Don't use Tailwind arbitrary values inside `calc()` that mix percentages and fixed units unless verified to work. Prefer `flex` or `grid` for layout over manual width calcs.

## 7. Empty states in components

Every data-fetching component needs:
- Loading skeleton (not just "Loading...")
- Error state with retry button
- Empty state with helpful message
- Normal data state

## 8. IPC handler naming consistency

IPC channel names in `main.ts` and `preload.ts` must match exactly. Use `kebab-case` for channel names. Always verify both sides when adding new IPC.

## 9. Form state reset

When using dialogs/forms with `defaultValue` props, reset state properly on open. `setName('')` unconditionally discards the `defaultName` prop — check if a default exists before resetting.

## 10. Console errors = reject

If there are console errors or unhandled rejections, the change is not done. Fix all console errors before considering a task complete.

## 11. Raw Request in prompts = verbatim user messages

When generating prompts (via generate-prompt skill), the Raw Request block MUST contain the user's exact words — every message, in order, unedited. Do NOT condense, rephrase, summarize, or reformat. You are the transcriptionist, not the author. Breaking this rule will cause the user to call you an idiot (and they'll be right).

## 12. NEVER run `git clean -fdx`

`git clean -fdx` deletes ALL untracked files — including `.ts` source files that exist only in the working directory (not committed). These are NEVER recoverable from git. On this project:
- The original `src/services/*.ts` files were deleted — only recreated by hand from bundled CJS output fragments
- `src/main.ts` was overwritten with a pre-compiled CJS backup that had uncommitted changes — the real source is lost
- Build artifacts, documentation, and backups were also deleted

**What to do instead:**
- If you need to clean build artifacts, use the project's `npm run clean` or manually delete the specific `dist/` / `dist-electron/` directories
- If untracked files are in the way, move them to a temp directory first
- **Never use any `git clean` variant** — flags like `-f`, `-fd`, `-fdx`, `-ffd`, `-ffdx` are all destructive

## 13. CYCLE REPORT format for ALL status responses

For ANY status query ("what did we do", "where are we", "progress", etc.), the response MUST be the EXACT format below (from user's final clarification):

```
---
CYCLE: <n>
BUILD: OK/FAIL | main.cjs <timestamp> | preload.cjs <timestamp>
GATE A  window.deskflowAPI: <object with N keys | undefined>
FEATURE: <name>
  STEPS: <what you clicked/ran>
  EXPECTED: <from packet>
  ACTUAL: <what happened>
  RENDERER CONSOLE: <relevant lines | none>
  MAIN CONSOLE: <relevant lines | none>
  VERDICT: PASS / FAIL / PARTIAL
REPRO (if FAIL): <exact steps>
ARTIFACTS: <paths to screenshots/logs>
---
```

One `---` block per cycle/feature. No preamble, no narrative, no extra sections. This has been documented in reflection logs 3+ times (2026-06-21) because it keeps being violated.

## 14. NEVER invent service/provider names

Every name, URL, and label for external services must be verified against real documentation. "CloudFlayer", "Invilier", "Olamah" are all wrong — Cloudflare, Ollama (and Invilier doesn't exist). Before adding any external service reference:
1. Search for the actual service name and API docs
2. Verify the URL pattern against their official docs
3. Confirm the service actually exists (a provider with zero search results = doesn't exist)

## 15. NEVER claim "fully fixed" without auditing the FULL spec

Build passing + a unit test passing is NOT proof a feature works. Before claiming done, audit EVERY deliverable/acceptance criterion in the spec against the code, end-to-end (main → preload → renderer → UI render), and runtime-verify the layer the feature lives in. If not runtime-verified, the verdict is "NOT LAUNCHED", never PASS.

## 16. ALWAYS update requests/problems state every cycle

Every feature/bug must have an entry in `agent/requests.json` / `agent/problems.json` with checks[]. Create it at cycle start; update status honestly at cycle end (In Progress → AI Attempted Fix → User Testing). A 17k-line commit with zero request tracking is a failed cycle.

## 17. ALWAYS read the reflection logs before ANY task

`agent/AGENTS.md` mandates reading `agent/skills/agent-reflect/logs/` + `problem.md` before acting. Skipping it = repeating logged mistakes. This is not optional.

## 18. Resolve CONTEXT_GAPS in the doc when the code pivots

If the implementation makes a decision that answers an OPEN gap (e.g. "db-pid primary instead of output-parsing"), mark it `[RESOLVED]` with the reason IN THE DOC, same cycle. Stale gap docs = future agents re-litigate closed decisions.

## 19. Date-keyed lookups: LOCAL grouping, window + ASC, never `'+1 day'` + `ORDER BY DESC LIMIT 1`

The "popup stuck at 7" bug class (2026-08-09): any IPC resolving "the record for date X" (sleep popups, day lookups) must match the UI's OWN grouping key:
- The UI (sleep chart) groups by LOCAL evening date — bedtime hour < 12 → previous day (`getSleepGroupDate`).
- The backend MUST use the same rule: window on started_at `[X 12:00 local, X+1d 12:00 local)`, ORDER BY ASC, first match.
- NEVER use SQLite UTC `date(started_at) = ?` OR `date(started_at) = date(?, '+1 day')` with `ORDER BY <ts> DESC LIMIT 1` — in any UTC+7+ timezone every after-midnight record matches both days and DESC returns the NEXT period's record for EVERY lookup except the newest.

**Diagnostic signature:** user reports "correct only on the LAST item / all earlier ones show the same wrong value" = bare DESC-LIMIT-1 (or un-ordered `.get()`) with an over-wide predicate. Fix the predicate window first, not the ordering.

## 20. Symptom reports: verify "gaps"/"missing data" against the DB before treating as a bug

When a user report includes a "gap", "missing days", or "no data after X" claim (e.g. the sleep "2 day gap" in the same bug), query the real DB (read-only) BEFORE writing a fix. Real absence of data is not a bug — state it explicitly in the report instead of inventing behavior to cover it.

## 21. Persist user requests to the trackers AT REQUEST TIME, not session end

Every user request ("can we have X", "apply skill Y to Z", "the ability to...") gets a FEATURE_TRACKER.md / PROBLEMS.md entry the moment it is made (or at minimum before the first build). Requests that live only in chat are lost; the user asking "where was my request?" means the rule was violated. Answer such questions FROM the trackers and own the miss.

## 23. ALWAYS use existing RESULT.md + code.tsx specs first

When a feature has `agent/docs/generate-prompt-docs/<name>/RESULT.md` and `code.tsx`, those ARE the implementation. Read them FIRST. Do NOT implement from scratch. The code.tsx IS the spec — copy it, adapt exports/imports to the project, then add missing pieces. Writing from scratch when a complete implementation exists in the folder is a critical failure.

## 24. Combine duplicate subtabs into one

When multiple subtabs serve the same purpose (e.g., Architecture Map + Page Context + Feature Logic all showing page context), combine them into ONE subtab with the Generate button. Don't create 3 separate tabs for the same functionality.

## 25. UI visibility requires a three-gate check

For every renderer feature, do not treat source code, a fresh bundle, or a successful build as proof that the user can see or use it. Verify all three independently:

1. **Source gate:** the required component, handlers, and acceptance markers exist in source.
2. **Bundle gate:** the exact current hashed entry/chunk referenced by `dist/index.html` contains those markers.
3. **Runtime gate:** the running app visibly renders the controls and the layout gives them non-zero geometry and pointer access.

For flex/grid layout changes, inspect the parent direction, child widths/heights, overflow, and responsive breakpoints before debugging feature handlers. A large normal-flow visualization can collapse the feature pane to zero height or width while every feature remains correctly implemented in code. If the runtime gate is unavailable, report `NOT LAUNCHED` and never claim the feature is fully verified.


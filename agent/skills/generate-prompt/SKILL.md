---
id: generate-prompt
name: Generate Prompt
category: design
applicable_to: [prompts, design-specs]
version: 2.0.0
created: 2026-04-19
updated: 2026-06-02
tags: [prompts, design, engineering, dsl-test]
inputs:
  - name: Prompt Type
    type: enum
    choices: [design, engineering, architecture, research, planning, bug-fix, refactor]
    default: design
    required: true
    description: Category of prompt to generate
    source: user
    group: Basic

  - name: Output Format
    type: enum
    choices: [full-prompt, system-prompt, user-prompt, prompt-template]
    default: full-prompt
    description: How the prompt should be structured
    source: user
    group: Basic

  - name: User Request
    type: textarea
    required: true
    description: The user's original verbatim request — copied exactly
    source: user
    placeholder: Paste the user's exact words here, word for word...
    group: Content

  - name: Context Bundle
    type: file
    description: CONTEXT_BUNDLE.md reference document (auto-generated or existing)
    source: system
    group: Content

  - name: Additional Instructions
    type: textarea
    required: false
    description: Extra context, preferences, or constraints from the user
    source: user
    placeholder: Any specific requirements not covered above...
    group: Content

  - name: Target AI
    type: enum
    choices: [claude, gpt-4, gemini-2.5, deepseek, custom]
    default: claude
    description: Which AI model will receive the generated prompt
    source: user
    group: Advanced

  - name: Detail Level
    type: number
    min: 1
    max: 10
    step: 1
    default: 7
    widget: slider
    description: How detailed the prompt should be (1=concise, 10=exhaustive)
    source: user
    group: Advanced

  - name: Creativity
    type: number
    min: 0
    max: 100
    step: 5
    default: 20
    widget: slider
    description: How much creative freedom the target AI gets (0=precise, 100=creative)
    source: user
    group: Advanced

  - name: Include Sections
    type: multienum
    choices: [context, requirements, constraints, examples, output-format, edge-cases, faq]
    default: [context, requirements, constraints, output-format]
    description: Sections to include in the generated prompt
    source: user
    group: Advanced

  - name: Context Sources
    type: multienum
    choices: [state.md, context.md, codebase, design-system, data-layer, ipc-endpoints]
    description: Sources to auto-gather context from
    source: system
    widget: checkbox
    group: Advanced

  - name: Auto-Generate Context Bundle
    type: boolean
    default: true
    description: Automatically create CONTEXT_BUNDLE.md from selected sources
    source: system
    group: Advanced

  - name: Max Tokens
    type: number
    min: 500
    max: 8000
    step: 500
    default: 4000
    widget: slider
    description: Maximum token length for the generated prompt
    source: user
    group: Advanced

  - name: Response Format
    type: enum
    choices: [markdown, json, yaml, plain-text]
    default: markdown
    widget: radio
    description: Expected output format from the target AI
    source: user
    group: Advanced

  - name: Use Legacy Mode
    type: boolean
    default: false
    widget: checkbox
    description: Skip context bundle creation, use legacy prompt format
    source: user
    group: Advanced

outputs:
  - name: Design Prompt
    type: markdown
    description: High-fidelity design specification prompt
    preview: true
  - name: Component Breakdown
    type: list
    description: Identified UI components and their relationships
    preview: false
  - name: Context Bundle
    type: file
    description: Generated CONTEXT_BUNDLE.md with gathered code context
    preview: true

components:
  - name: Raw Request Block
    description: User's verbatim request section (always included)
    source: user
  - name: Context Reference
    description: CONTEXT_BUNDLE.md as source of truth for code structure
    source: system
  - name: Prompt Template
    description: Base prompt structure with variable slots for each section
    source: system
  - name: Section Assembler
    description: Combines selected sections (from Include Sections) into final prompt
    source: system
  - name: Format Transformer
    description: Converts prompt to selected Response Format
    source: system
---

# 📝 Generate Prompt for High-Fidelity Solutions

## Core Philosophy

**Request a design. Not a menu.**

The prompt you generate should equip the receiving AI with context and then task it with acting as the **Lead Designer and Engineer**. It should not provide "Options A, B, and C" for the user to pick from. Instead, it should demand a single, comprehensive, and well-reasoned solution that includes data-processing logic, visual specifications, and interaction design.

## ⚠️ Runtime Pitfalls

### Context Compaction Prunes Large Skill Content

The `generate-prompt` SKILL.md is very large (~27K chars). When Hermes compresses context during a long session, the `skill_view(name='generate-prompt')` call may return pruned content — sections A/B/C, Phase 1-4 details, and source code examples can be truncated or lost entirely.

**Recovery procedure when skill_view returns pruned content:**
1. The skill's structural requirements are: §A (skills list), §B (MCP inventory), §C (anti-slop checklist), §D-H (source code snippets for StatusBand, MomentumHero, DeskFlowCard), design tokens, animation tokens, engineering/design/UX tasks, Phase 3 planning.
2. Rebuild the PROMPT.md from these structural requirements even without the full skill content loaded.
3. Use `git show ec849f3:src/pages/dashboard/StatusBand.tsx` and similar commands to recover source code from the last known-good commit.
4. The CONTEXT_BUNDLE.md must include actual source code lines, not descriptions.

### Conditional `motion.div` Component Type Requires `as any` Cast

When using `framer-motion` with conditional rendering:
```tsx
const Comp = noMotion ? 'div' : motion.div
```
TypeScript fails with `TS2322` when spreading props because `'div' | typeof motion.div` doesn't match `HTMLMotionProps<"div">`. The `motion.div` variant also rejects `children: (Element | null)[]`.

**Fix:** Cast the conditional component:
```tsx
const Comp = noMotion ? 'div' : motion.div as any
```
Do NOT use `React.FC<HTMLMotionProps<"div">>` — it resolves `children` to `React.ReactNode` and still fails. `as any` is the only reliable approach.

## MANDATORY: Before Creating Any Prompt

**STEP 0 — Update state.md first:**
1. Read current `state.md`.
2. Add entry: what problem is being solved, mark **IN PROGRESS**.
3. Then proceed.

## MANDATORY FOR FRONTEND PROMPTS: Add MCP Inventory + Skills List

When generating a prompt for a **frontend/UI task**, you MUST include these sections in the prompt:

### A. List ALL frontend design skills (verbatim names + what they do):
1. **Frontend Design** — DeskFlow-specific component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design dimensions (typography, color, spatial, motion, interaction, responsive, UX writing), 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels (L1 Composed / L2 Responsive / L3 Expressive), motion taxonomy, recipes
5. **UI UX Pro Max** — industry-specific design rules (dev tools, AI/ML, financial), style library
6. **Design Taste System** — master aggregator, design variance knobs, anti-repetition rules
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist

### B. Query ALL MCP servers and list their real inventory in the prompt:
YOU (the agent generating the prompt) must query each MCP and include ACTUAL component names in the prompt. Do not just say "use shadcn components" — list WHAT components.

1. **shadcn MCP** → Run `npx -y shadcn@latest search '@shadcn'` and `npx -y shadcn@latest view '@shadcn/<component>'` for relevant ones. Include real component names, props, variants.
2. **Magic UI MCP** → Fetch from https://magicui.design/docs/components/ to get the real component list. Include names like Animated Beam, Border Beam, Number Ticker, Particles, etc.
3. **Lucide MCP** — List specific icon names relevant to the task (Bot, Send, Sparkles, Target, etc.)
4. **React Bits MCP** — Note that 135+ components are available
5. **Iconify MCP** — 200k+ icons as fallback

Create a table in the prompt for each MCP showing:
```
| Component | Source | Use for |
|-----------|--------|---------|
| card | shadcn | Standard UI cards |
| dialog | shadcn | Modals |
| Animated Beam | Magic UI | Connecting lines |
| Bot | Lucide | AI icon |
```

### C. Include the Anti-Slop Checklist:
After any MCP-sourced component, the target AI must:
1. Re-skin to DeskFlow tokens (colors → --bg-primary, --accent-primary, etc.)
2. Max rounded-xl, p-5 padding
3. Dark mode only
4. Geist + JetBrains Mono fonts
5. Glass layer (bg-zinc-900/80 backdrop-blur-xl)

## What to Gather

1. **Project context:** `agent/state.md`, `agent/context.md`, relevant `PLANNING.md`.
2. **Current implementation:** affected files, what exists, what's broken.
3. **Design system:** colors, components, patterns in use.
4. **Data layer:** How data is currently stored vs. how it needs to be processed.
5. **Backend completeness:** Before designing any feature, verify that the necessary backend/IPC infrastructure exists. Check:
   - IPC channel definitions in `src/preload.ts`
   - IPC handlers in `src/main.ts`
   - Service classes in `src/services/`
   - DB schema in relevant DB files
   - **If IPC channel exists but returns mock/no-op data** — flag it
   - **If IPC channel doesn't exist at all** — flag it
   - **If the feature is purely frontend (localStorage only)** — note explicitly

### MANDATORY: Create a Context Bundle

**Before writing the prompt, create a CONTEXT_BUNDLE.md.** The target AI receiving the prompt does NOT have access to your codebase. The context bundle replaces that gap.

**Folder naming convention (STRICT — must follow exactly):**
```
agent/docs/generate-prompt-docs/<descriptive-name>-DDMMYYYY/
```
- `<descriptive-name>` = short kebab-case description of the task (e.g., `dashboard-redesign`, `ai-assistant-fix`, `finance-revamp`)
- `-DDMMYYYY` = today's date with NO separators (e.g., `-27072026`)
- Example: `agent/docs/generate-prompt-docs/dashboard-redesign-27072026/`
- The folder MUST be unique. Check existing folders first. If a folder with the same name+date exists, append a suffix (e.g., `-v2`).

**Inside the folder, create two files:**
1. `CONTEXT_BUNDLE.md` — the code context
2. `PROMPT.md` — the prompt to send to the target AI

Save CONTEXT_BUNDLE.md to `agent/docs/generate-prompt-docs/<name>-DDMMYYYY/CONTEXT_BUNDLE.md` and include:

- **Relevant source code** — copy-paste exact lines, file paths, and line numbers for every file the solution touches
- **Data structures** — schemas, interfaces, types, enums
- **IPC endpoints** — channel names, payload shapes, example usage
- **State management** — relevant stores, actions, selectors, and their structure
- **Design tokens** — hex codes, component names, CSS patterns in use
- **Architecture notes** — how the relevant subsystems connect (data flow direction, event flow)

The bundle must be **self-contained**. The target AI should be able to design the complete solution using only this file, without needing to read the codebase itself.

**If you cannot gather all context autonomously** (e.g., a file is too large, or the relevant section isn't obvious), include a step in the prompt that asks the user to provide specific files or code sections.

#### Context Bundle Requirements — MUST Include Actual Source Code (Not Descriptions)

The single biggest failure mode is writing CONTEXT_BUNDLE.md with prose descriptions of code shapes instead of actual source. The target AI will produce "plausible-sounding instead of correct" specs. **Every context bundle MUST include the actual source code for each of the following** (where applicable to the task):

1. **Current type/interface definitions** — The exact TypeScript interfaces the spec will modify. Include all fields, not a summary. Example: if the task modifies TutorAnswer, include the full interface with all 9 fields, not just `{ answer_md, citations, ... }`.

2. **Current implementation of every affected function** — The full function body with line numbers. Do NOT summarize logic as "does X, Y, Z" — include the actual `.replace()` calls, actual `if/else` branches, actual SQL queries. The target AI needs to see the current code to know what to change and what not to break.

3. **End-to-end IPC wiring example** — Show the complete chain for ONE working IPC channel: preload.ts bridge → main.ts handler → service method → DB call. Include the `ipcRenderer.invoke()`, the `ipcMain.handle()`, the service method signature, and the repo/database call. This teaches the target AI the exact conventions to follow for new channels.

4. **DB access pattern** — Show the actual repository file (repo.ts or similar) with prepared statements, transactions, and error handling. Show one complete migration SQL file. The target AI needs to see how migrations are applied (`PRAGMA user_version` increment) and how queries are written (prepared statements with `?` placeholders).

5. **Result/error wrapper type** — Include `type Result<T> = { ok: true, data: T } | { ok: false, error: string }` or whatever pattern is used. Every IPC handler returns this.

6. **Current UI component source** — For every component the spec touches, include the full source (props interface, all states, rendering logic). Do NOT describe what the component does — paste the actual `return()` JSX.

7. **Design tokens** — Include the actual Tailwind config theme extension or CSS custom properties. Hex codes, font stacks, spacing values, breakpoints. Not a summary like "uses dark zinc palette" — the actual `colors: { clay: { 400: '#...' } }` values.

8. **AI/provider call chain** — Show how the LLM is actually called. Is it a direct main-process function call? HTTP fetch? SSE stream? Include the actual provider wrapper code so the target AI knows what streaming capabilities exist and which don't.

9. **Database schema** — Include the actual CREATE TABLE statements from migration files. Every column name, type, default, FK constraint. Not a summary table.

10. **Current state management** — Show the actual state variables, hooks, and their types. Include the full useState declarations if relevant.

Each item above must include the exact file path and line number range, e.g.:
```markdown
### src/components/learn/TutorPanel.tsx (lines 56-63):
function renderAnswerHtml(md: string): string {
  return md
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '...')
    .replace(/`([^`]+)`/g, '...')
    .replace(/\*\*(.+?)\*\*/g, '...')
    .replace(/\*(.+?)\*/g, '...')
    .replace(/\n/g, '<br/>');
}
```

**If any of these items is missing from the context bundle, the prompt will produce unreliable output.** Do not skip this step.

## What the Generated Prompt Should Include

- **User's original request (verbatim):** Copy-paste the user's exact words word-for-word at the top of the prompt. This ensures the receiving AI sees the raw request without any interpretation loss. Mark it clearly (e.g., `## Raw Request` block).
- **Problem statement:** What's wrong and why it matters to the user (e.g., "The data feels unprocessed and poorly showcased").
- **Context bundle reference:** Reference `CONTEXT_BUNDLE.md` as the source of truth for code structure, data shapes, and architecture. The target AI must read this first.
- **Engineering Task:** Specifically ask the AI to design the **Data Processing Pipeline** (e.g., aggregation math, smoothing logic, caching strategies).
- **Design Task:** Specifically ask for **High-Fidelity Visual Specs** (e.g., exact hex codes, pixel-level spacing, chart types, animation curves).
- **UX Task:** Specifically ask for the **Interaction Flow** (e.g., what happens on click, hover, and empty states).
- **Constraints:** Hard limits only (e.g., must work with existing API, must stay in this file).

## What the Generated Prompt Should NOT Include

- **Multiple options (Option A / B / C):** Do not ask the user to choose; ask the AI to design the *best* version.
- **Ambiguous outcomes:** Do not say "design something better"; say "design the technical and visual specifications for X."
- **Prescribed component structure:** Let the AI decide the architecture of the code.
- **Your own interpretation or framing:** Do NOT use your (AI's) perspective, tone, or phrasing. Copy the user's exact words. Do not rephrase, summarize, or add your own framing to what the user said. The raw request goes in verbatim — you are the transcriptionist, not the author.

## MANDATORY: Show File Paths After Every Write

**After EVERY file write (Write tool, Edit tool, or any file creation), you MUST immediately output the full absolute path on its own line:**

```
File written to:
C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\<full\path\to\file.ext>
```

This is NON-NEGOTIABLE. The user cannot see what you wrote unless you show the path. Every. Single. Time. No exceptions. No "I'll show it at the end." Show it IMMEDIATELY after the write completes.

## Output Format

Prompt should feel like a high-level technical brief:
- **Context:** The "Why" and the "Where."
- **The Mandate:** "Design a comprehensive solution for..."
- **Requirement Checklist:** Data processing, visual specs, and UX flow.

## Example Flow

1. **User:** "the charts on external page are bad."
2. **You:** [Update `state.md`]
3. **You:** [Read codebase and planning docs]
4. **You:** [Check existing folders in `agent/docs/generate-prompt-docs/` to ensure uniqueness]
5. **You:** [Create `agent/docs/generate-prompt-docs/external-page-chart-revamp-02072026/CONTEXT_BUNDLE.md` with relevant code snippets, schemas, IPC endpoints, design tokens]
6. **You:** [Write prompt referencing the context bundle, demanding a high-fidelity design → save to `agent/docs/generate-prompt-docs/external-page-chart-revamp-02072026/PROMPT.md`]
7. **You:** "I have created a context bundle and prompt. The prompt tasks the AI with designing a complete data-processing and visual overhaul for the charts, with the context bundle as its codebase reference. Send the prompt and context bundle to the AI to get the full design."

---

## CRITICAL: RESULT.md Usage Rules

When the design prompt generates a `RESULT.md` (or equivalent output), follow these rules strictly:

### Rule 1 — RESULT.md is RAW and UNTOUCHABLE

The RESULT.md from the prompt's target AI must be consumed **exactly as-is**. Do NOT:
- Edit, rewrite, or summarize it
- Add your own interpretation or commentary
- Pre-process it to "fit" the codebase
- Remove or reorder sections

Save it to `agent/docs/generate-prompt-docs/<name>-DDMMYYYY/RESULT.md` verbatim.

### Rule 2 — Implement After Analysis (Not During)

After saving RESULT.md raw:
1. **Read RESULT.md fully**
2. **Trace the codebase** to understand how the proposed solution maps to existing code
3. **Identify gaps** between the solution and the actual code structure
4. **Plan modifications** — what needs to change, what can stay, what must be adapted
5. **Only then** implement, making pragmatic adaptations to fit the codebase while preserving the solution's design intent

The solution from RESULT.md is the **design target**. Code adaptations are the **implementation path**. Do not judge the design; adapt the implementation.

### Rule 3 — Removal MUST Be Confirmed

If RESULT.md (or your implementation analysis) involves **removing any existing code, UI elements, features, buttons, or functionality**, you MUST pause and ask the user for explicit confirmation before removing anything. State exactly:

> "RESULT.md proposes removing [X]. Can I proceed?"

Do not skip this. Do not assume. The user decides what gets removed.

### Rule 4 — Backup Before Every Removal

**Before deleting or replacing any file**, create a timestamped backup:

```bash
# Copy the file to a timestamped backup path
cp <filepath> <filepath>.bak.<YYYYMMDD-HHMMSS>
```

Backups go in the same directory as the original. If a file is being replaced (not deleted), keep the backup alongside the replacement. The backup is for your reference in case the removal was a mistake.

Do not skip this. Do not assume the file can be recovered from git. The git history may not contain the latest version (uncommitted changes).

### Rule 5 — Backend Logic MUST Be Verified

**Before sending a prompt, verify that every proposed feature has real backend logic.** Do not design frontends for features whose backend doesn't exist or is a no-op.

For each feature in the prompt, check:
1. **IPC channel** — defined in `preload.ts`? Handled in `main.ts`? Returns real data or mock?
2. **Service layer** — does a corresponding service class exist in `src/services/`?
3. **DB schema** — does the relevant DB table/column exist?
4. **File system** — does it read/write real files or just simulate?

**If the backend doesn't exist → Generate two things:**
- The frontend spec (as normal)
- A **backend implementation spec** specifying IPC channels, service methods, DB schemas needed

**If the backend is a mock/no-op → Flag it explicitly** in the prompt with "⚠️ BACKEND IS STUB" and include the implementation needed.

---

---

## ⚡ MANDATORY: Post-Result Workflow

After the target AI returns its RESULT.md, you MUST run this three-phase workflow before touching any code.

### Phase 1 — Recursive Completeness Check

**Do NOT skip this. Do NOT assume coverage. Recursively verify every item.**

1. **Extract all requirements** from the PROMPT.md:
   - Every bug/task number (e.g., Bug #1, Bug #21)
   - Every engineering task letter (e.g., Task A, Task B)
   - Every data flow diagram specification
   - Every constraint
   - Every explicit question from the "Raw Request" section

2. **Create a coverage table** mapping each PROMPT.md item → its location in RESULT.md:
   ```
   | PROMPT.md Item | Covered In RESULT.md? | Location |
   |----------------|----------------------|----------|
   | Bug #1: onSend STUB | ✅ Yes | Fix 1, Phase 1 |
   | Bug #2: Toggle cards decorative | ✅ Yes | Fix 2, Phase 1 |
   | Bug #3: create-terminal events | ❌ No | — |
   | ... | | |
   ```

3. **Flag uncovered items.** If any item from PROMPT.md has no corresponding section in RESULT.md, it goes into a **Gaps list**.

4. **If gaps exist → send a follow-up prompt.** Create a new prompt (`UNCOVERED_GAPS.md` or similar) that asks the target AI to extend RESULT.md to cover the missing items. Include:
   - The original PROMPT.md item reference
   - Why it's missing
   - Where it should be inserted in RESULT.md (which phase/section)

5. **Loop until complete.** After receiving the updated RESULT.md, re-run steps 1-4. Continue until the coverage table shows 100% — every PROMPT.md item has a corresponding section in RESULT.md. This is NOT optional. Do not stop at "close enough."

### Phase 2 — Task Splitting (Only for Large Specifications)

If RESULT.md is very large (10+ fixes, 5+ phases, or covers multiple distinct systems), split it into focused work units:

1. **Identify natural boundaries:** Each phase, each system, each feature cluster.
2. **Create focused sub-prompts** that each cover one unit:
   - `RESULT_PHASE1_FIXES.md` — Core flows only (Fixes 1-5)
   - `RESULT_SESSION_CREATION.md` — Session-related fixes only
   - `RESULT_TERMINAL_LAYOUT.md` — Layout/split/resize fixes only
3. **Each sub-prompt must be self-contained** — include only the relevant RESULT.md sections plus the necessary architectural context (you can reference `CONTEXT_BUNDLE.md` for this).
4. **Process sequentially** — only move to the next sub-prompt after the current one is fully implemented and the build passes.

### Phase 3 — Implementation Planning from Partial Context

Before writing ANY code, plan how the RESULT.md solution maps to your specific codebase. The target AI that wrote RESULT.md has **no knowledge of your actual code structure**.

1. **Create an implementation plan** that answers:
   - **Which exact files** are affected (from your codebase, not from RESULT.md's generic paths)
   - **What needs to change in each file** — specific functions, state variables, event handlers, IPC channels
   - **Adaptation notes** — where RESULT.md's proposal doesn't match your code's reality and must be adjusted
   - **Ripple effects** — what else might break when you change these files
   - **Test strategy** — how to verify each change manually (since there's no test suite)

2. **Trace every proposed change against the actual codebase:**
   - RESULT.md says "change `onSend` at line 1384" → open your file and verify that line number
   - RESULT.md says "add `electron:execute-command` handler" → grep main.ts to see if it already exists
   - RESULT.md says "write to `agent/context/session-summaries.json`" → check the path exists and has correct permissions

3. **Store this plan** as `agent/docs/generate-prompt-docs/.../IMPLEMENTATION_PLAN.md`. It should include:
   ```markdown
   ## Implementation Plan
   
   ### Fix N: [Title]
   - **Files:** `src/pages/FileA.tsx` (lines X-Y), `src/main.ts` (functions Z)
   - **Changes:** [bullet list of exact edits]
   - **Codebase adaptation:** [what RESULT.md assumed vs what your code actually looks like]
   - **Verification:** [how to test this works]
   - **Ripple check:** [what else references these lines/functions]
   ```

4. **Only now write code.** Follow the plan step by step. After each step:
   - Run the build (`npm run build`)
   - Fix any errors
   - Mark the step done
   - Move to the next

---

### Phase 4 — Backend Logic Verification

**Every RESULT.md feature must be traced to real backend code. Do not skip.**

For each change proposed in RESULT.md:
1. **Find the IPC channel** it would use → does it exist in `src/preload.ts` and `src/main.ts`?
2. **Find the service** → does a real class in `src/services/` handle this?
3. **Find the DB query** → does the schema support it?
4. **If any of these is missing** → the feature has a backend gap.

Create a **Backend Audit Table**:
```
| Feature | IPC Channel | Handler Exists? | Service Class | DB Schema | Status |
|---------|-------------|-----------------|---------------|-----------|--------|
| Context Sidebar - Systems | n/a (localStorage) | N/A | N/A | N/A | ✅ UI-only |
| Initialize Workspace | tracker-mind-setup | ✅ main.ts:10200 | ✅ ProblemsService | ✅ SQLite | ✅ Real |
| Model Improvisation | n/a (localStorage) | N/A | N/A | N/A | ✅ UI-only |
| ... | | | | | |
```

**Flag any row where Status is NOT real.** These become a **Backend Gaps** section in the implementation plan. If gaps exist, generate a separate backend prompt to fill them.

---

### Key Changes Made:
* **Added Phase 1 — Recursive Completeness Check:** Mandatory loop until 100% coverage between PROMPT.md and RESULT.md.
* **Added Phase 2 — Task Splitting:** Large specs get split into focused sub-prompts for sequential implementation.
* **Added Phase 3 — Implementation Planning:** Context-free AI proposals must be mapped to actual codebase before coding begins.
* **Added Phase 4 — Backend Logic Verification:** Every feature traced to real IPC, service, and DB code. Backend Gaps flagged.
* **Added Rule 5 — Backend Logic MUST Be Verified:** Prevents designing frontends for non-existent backends.
* **Added backend completeness check to What to Gather step 5.**
* **Removed the "Menu" approach:** Explicitly forbids generating Options A, B, and C.
* **Mandated Technical Logic:** Added a requirement to ask for the "Data Processing Pipeline" and the "math" behind the display.
* **High-Fidelity Visuals:** Changed the focus from "don't include pixel specs" to "ask the AI to *provide* pixel specs".
* **Lead Role:** Instructions now state the receiving AI must act as a **Lead Designer and Engineer**, owning the entire solution from logic to pixels.
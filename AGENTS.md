# AGENTS.md — DeskFlow Agent Operating Contract

> opencode auto-loads this file into EVERY prompt. It is the one thing you cannot
> forget. Read it as binding instructions, not background reading.

## 0. WHO YOU ARE (read this first, every session)
You are the **Hands & Eyes** in a two-AI relay pipeline:
- **Architect (Notion AI):** root-causes bugs, writes patches, ships replacement source files in a ZIP, and issues a FIX PACKET.
- **You (opencode):** unzip the patch into the repo, run a clean build, VERIFY in the real running Electron app, and report back in CYCLE REPORT format.
- **CZ (human):** relays messages between the two AIs. CZ is NOT your QA tester — do not ask CZ for status you can read from the artifacts yourself.

This is a CONTINUOUS pipeline, never a standalone chat. If a new session starts and
you are unsure where you are: **DO NOT GUESS, DO NOT ASK — read the memory files in
Section 1 to recover state.**

## 0b. EXTERNAL AI SESSION FLOW (Learn module)
Local LLMs (Ollama, etc.) are expensive and limited. Most lesson generation and knowledge
enrichment happens via **external AI sessions** (ChatGPT, Claude, etc.) through the browser.

**Flow:**
1. **App generates prompt** — CreateLessonDialog assembles system+user prompt with KB context,
   tunability settings (focus/depth/style), and lesson size instructions.
2. **User sends to external AI** — "Send to External AI" button copies prompt to clipboard and
   opens ChatGPT/Claude. User pastes and runs the prompt.
3. **Response enriches lesson** — The external AI's .lmd output is pasted back into the
   CreateLessonDialog result step, or imported via the "Paste .lmd" import section.
4. **Extension tracks sessions** — The browser extension (DeskFlow) captures which AI provider
   and chat session was used, storing it in `ai_context_captures`. This creates a traceable
   link between the lesson and the external conversation.
5. **Knowledge base grows** — Entries extracted from external AI responses feed back into the
   learner profile's `knowledgeBase`, making future lessons more personalized.

**Why external, not local:**
- External AIs have broader knowledge, better reasoning, and are free for the user
- Local models are for lightweight tasks (quiz grading, embedding, retrieval)
- The extension bridges the gap: it captures external sessions so the app knows what was discussed

## 0c. LESSON CREATION TUNABILITY (v1.3)
CreateLessonDialog supports these controls:
- **Lesson Size:** Compact (3 nodes), Standard (5), Full (8), Dynamic (AI decides)
- **Knowledge Base:** Auto-match (AI picks relevant KB entries) or Select (user picks)
- **Knowledge Context:** Free-text area for pasting existing knowledge
- **Focus:** Balanced, Theory-heavy, Practice-heavy, Visual-first
- **Depth:** Adaptive, Introductory, Intermediate, Advanced
- **Style:** Standard, Socratic (question-led), Narrative (story-driven), Reference (concise)
- **External AI:** Send prompt to ChatGPT/Claude via clipboard + browser open

## 0.5. ABSOLUTE ZERO-DESTRUCTION RULE (NEVER VIOLATE)  
The agent MUST NEVER run any operation that changes, reverts, overwrites, deletes, or
destroys ANY file, database, or data without explicit human permission. This is the
single most important rule — violating it erodes trust permanently.

### COMPLETELY BANNED — NEVER USE, EVER
These operations are FORBIDDEN under any circumstance. No exceptions. No "but I'll
fix it after." Zero tolerance.
- `git checkout -- .` or `git checkout` on any path
- `git restore` on any path
- `git reset --hard` or `git reset --merge`
- `git stash drop`, `git clean -fd`, `git clean -df`
- `git revert` against a range of commits
- ANY git command whose primary effect is to change working-tree files to match
  a different point in history (HEAD, a commit, another branch)
- Copying an entire source tree (full `src/` or project root) from ANY external
  source over the working tree — old snapshots, fix packets, ZIPs, backup dirs.
  Only merge specific changed files via diff, never wholesale overwrite.
- Running `rsync`, `robocopy`, or `Copy-Item -Recurse` from an external dir INTO
  `src/`, `dist-electron/`, or the project root without per-file confirmation.

### ONLY ROUTE: PHYSICAL BACKUP WITH EXPLICIT PERMISSION  
If a file change might need to be undone later (patch, fix packet, refactor):
1. ASK the user for permission to proceed.
2. Only if user says YES, create a physical backup:
   `Copy-Item -Recurse -Path "src" -Destination "agent/backups/<timestamp>-desc-pre" -Force`
3. VERIFY the backup (count files, check key files exist with expected sizes)
   and SHOW the manifest to the user.
4. Only THEN proceed with the actual change.
5. If something goes wrong, restore from the physical backup ONLY — never from git.
6. After restoration, ALWAYS rebuild: `node scripts/build.mjs`
7. Confirm with the user that state is correct.

### DATABASE RULE  
NEVER run `DELETE`, `DROP`, `UPDATE` (without WHERE), `VACUUM`, or any
destructive SQL on the database without:
- Backing up the DB file FIRST (`Copy-Item "%APPDATA%/DeskFlow/deskflow-data.db" "agent/backups/<timestamp>-db-pre"`)
- Getting explicit user confirmation in a separate message

Any agent that violates this rule has failed at its most basic responsibility.

### PROCESS MANAGEMENT RULES (NEVER VIOLATE)
- **ONLY kill processes you started yourself.** Never blindly kill all instances of a process
  (e.g. `Get-Process -Name "electron" | Stop-Process`). You don't know what other sessions or
  apps depend on those processes.
- To check if a process exists before starting something new, use `Get-Process -Name "X" -ErrorAction SilentlyContinue` to read its status — but do NOT stop or kill it.
- If you need a port or resource, ASK the user to free it, or find another way that doesn't
  involve terminating processes you didn't create.

### TESTING RULE — use Probe MCP, never manually launch
- **NEVER spawn `npx electron .` or any app binary for testing.** Starting the app gives you
  no visibility into what's happening (no console, no interaction). You cannot test the UI
  from a shell.
- **Always use Probe MCP** (`probe_open`, `probe_goto`, `probe_snapshot`, `probe_click`, etc.)
  for any runtime testing. Probe attaches to the debug port and lets you see the UI, click
  buttons, read console output, and assert results.
- If Probe cannot work (no debug port, CI without display), note "NOT LAUNCHED" in the cycle
  report — do not attempt to launch and verify manually.

## 0a. COORDINATION GATE — RUN THIS BEFORE YOU TOUCH ANYTHING (non-negotiable)

**You are not the only agent in this repo.** Others are editing, building, running the
app and committing RIGHT NOW, and they will not warn you. `MULTI_AGENT_PROTOCOL.md` is
auto-loaded into your context — reading it is not the same as following it.

Two real losses happened in one session because this gate was skipped:

- An agent's `git add`-broad commit swallowed **713 lines** belonging to another agent.
- `TerminalPage.tsx` was mid-rewrite (**+4,570 lines**, broken JSX) by a live agent. A
  build failed on it; "fixing" it would have destroyed live work.

```bash
export AGENT_ID="opencode-<task>-$(date +%Y%m%d)"
COORD=agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs

node $COORD register --agent "$AGENT_ID" --task "<what you are doing>"   # 1. announce
node $COORD status                                                        # 2. WHO IS LIVE?
node $COORD claim  --agent "$AGENT_ID" --paths <every file you will edit> # 3. claim
```

- **Step 2 is not optional.** One second of output tells you who holds what.
- **A DENIED claim is a HARD STOP.** Do not edit anyway.
- **Never `git add -A`.** Stage explicit paths, then `git diff --cached --name-only`.
- **Never `npm run build` / `npm start` bare** — use
  `run-exclusive.mjs build -- node scripts/build.mjs`. Queue behind an existing build.
- **A file with uncommitted changes you did not make is not yours.** Report it. Never
  `git checkout` / `git restore` it.
- **Exit code 0 with empty output is NOT proof the tool ran** — confirm `status` PRINTS
  `AGENTS (n)`.
- Release when done: `node $COORD done --agent "$AGENT_ID"`.

Full detail: `agent/skills/multi-agent-coordination/SKILL.md`.

## 1. STARTUP RITUAL (do this before responding to ANYTHING)
0. **Run the §0a COORDINATION GATE above. Before reading anything else.**
1. Read `MEMORY.md` (durable lessons — see Section 4). This is the **compiled** version (max 10 newest entries). For the full archive, see `MEMORY_FULL.md`.
2. Read the state Hub `agent/state.md` (read-only global view — see Section 1b), then read
   YOUR OWN spoke `agent/state/{SESSION_ID}.md` (current cycle number + role + what's in
   flight). If you don't know your session ID yet, follow the Hub's PROTOCOL section to find it.
3. Read `agent/PROBLEMS.md` and `agent/FEATURE_TRACKER.md` (open issues).
4. Determine: What cycle are we on? What FIX PACKET is open? What did I last verify?
5. ONLY THEN act. If "What did we do so far?" is asked, ANSWER FROM THESE FILES.
6. Do NOT read `agent/state-archive.md` during startup. It is deep history, read it
   ONLY when you genuinely need a past cycle you cannot reconstruct otherwise.

## 1b. MULTI-AGENT STATE CONTRACT — Hub + Spokes (v2.0)
`agent/state.md` is the **Hub**: a READ-ONLY index auto-generated by the main process
(`src/main/stateCoordinator.ts`) from the spoke files in `agent/state/`. NEVER write to
`agent/state.md` — the next regeneration wipes any manual edit.

**Each agent session owns ONE spoke file: `agent/state/{SESSION_ID}.md`.**
- Your SESSION_ID: use the `DESKFLOW_SESSION_ID` env var when set; otherwise match the
  spoke whose name is `{agentType}-{terminalIdPrefix}-{entropy}` in the Hub's ACTIVE
  SESSIONS table. If no spoke exists yet, create one from `agent/state/_template.md`.
- READ your own spoke at startup (full history: current + 2 previous cycles).
- WRITE (overwrite, NEVER append) ONLY your own spoke at cycle end. Keep it ≤ ~60 lines
  (3 cycles max). Every stale line in YOUR spoke is paid for on every prompt.
- NEVER write another session's spoke. No two agents ever write the same file — this is
  how context stays uncluttered while the Hub gives every page a view of all sessions.

Content routing (same as before):
- Durable lessons (still true next week) -> `MEMORY.md`
- Per-cycle history -> your spoke (3-cycle window) + `agent/state-archive.md` (append-only; never auto-read)
- Open bugs / features -> `agent/PROBLEMS.md`, `agent/FEATURE_TRACKER.md`
The Hub's ACTIVE SESSIONS table + RECENT EVENTS are the lightweight cross-session view;
read another agent's spoke only when you need details.

## 1c. MULTI-AGENT COORDINATION (mandatory — never skip)

You are almost certainly NOT the only agent in this repo. Sub-agents, shells, and
the app itself may be editing files, building, running, or writing to the database
at the same moment. Ignoring that is what corrupts the DB, triggers "internal server
error" mode, and makes agents silently overwrite each other so nothing ships.

**Before ANY non-trivial action (edit, build, run app, DB migration, install deps,
commit), you MUST read and execute the protocol below.**

### The contract (non-negotiable)

1. **Announce yourself, then look before you leap.**
   ```bash
   export AGENT_ID="<your-unique-id>"
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs register --agent "$AGENT_ID" --task "<what you're doing>"
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs status   # who else is active?
   ```
2. **Claim files before editing them. A DENIED claim is a hard STOP.**
   ```bash
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs claim --agent "$AGENT_ID" --paths <files/dirs you'll edit>
   ```
3. **Never build while the app runs; never run the app while building. Never run
   two builds or two app instances.** Use the wrappers — they enforce it:
   ```bash
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/run-exclusive.mjs build --forbid app -- npm run build
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/run-exclusive.mjs app   --forbid build app -- npm start
   ```
4. **The database has exactly one writer.** better-sqlite3 is single-writer.
   Do DB work only when the app is stopped, and always through the guard
   (it backs up first):
   ```bash
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/db-guard.mjs run -- node scripts/migrate.mjs
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/db-guard.mjs backup   # manual snapshot anytime
   ```
5. **Prefer surgical edits over whole-file rewrites**, and new files over
   mutating shared ones. Don't `git add -A`, force-push, drop tables, or delete
   the DB without explicit human confirmation.
6. **Always release when done** (wrappers do this automatically, even on crash):
   ```bash
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs done --agent "$AGENT_ID"
   ```

### Full rules, edge cases, and constraints

Read **`agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/MULTI_AGENT_PROTOCOL.md`**
before doing anything non-trivial. It covers every collision scenario (build, DB,
filesystem, git, env) and the full workflow.

### Sub-agent orchestration (parent/coordinator only)

When fanning out sub-agents:
- **Plan the partition first.** Split work into disjoint file/dir sets. Never give
  two sub-agents the same file.
- **Serialize shared phases.** Fan-out for editing is fine; building, running,
  DB migration, dependency installs, and commits must be serial and go through the
  wrappers.
- **Barrier before packaging.** Wait until every sub-agent has `done` and all locks
  are clear (`coord.mjs status` shows none) before building/zipping/deploying.
- **One integrator.** After parallel edits, a single agent does the build + typecheck
  + commit so results don't stack on each other.

### If a tool is not found

If `node agent-coordination/coord.mjs` or the other scripts don't exist on disk,
STOP and tell the user. Do NOT proceed with edits/builds/DB work under the
assumption that you have exclusive access — you do not.

## 1d. SKILL ROUTER (mandatory before ANY task — never skip)

Before you begin ANY task (code, UI, fix, commit, research, test, review, debug, docs),
you MUST load the **Skill Router** skill:

```
agent/skills/skill-router/SKILL.md
```

The Skill Router contains a Decision Tree that maps every task category to its MANDATORY
and RECOMMENDED skills in the correct load order. It is the single source of truth for
WHEN to use WHICH skill. Without it, you will forget skills, skip load order, and produce
substandard work.

**This is not optional. Every single task starts with the Skill Router.**

How it works:
1. Identify your task category from the Decision Tree (fix, design, commit, review, etc.)
2. Load ALL skills listed as MANDATORY for that category — in the specified order
3. Load RECOMMENDED skills if the task scope warrants it
4. Follow the Load Ordering Rules and Anti-Patterns

If you ever find yourself wondering "should I load a skill for this?" — the answer is YES.
Load the Skill Router, find your category, and follow the mapping.

**The Router is a LIVING document — KEEP IT SYNCED (user-mandated, never skip):**
- Whenever a new skill is added to `agent/skills/`, update `skill-router/SKILL.md`
  IN THE SAME CYCLE: Decision Tree category, scenario table, load order, version bump.
- Before loading the Router, if you know a skill exists on disk that the Router
  doesn't mention, update the Router IMMEDIATELY, then load it. A stale Router
  means forgotten skills — the user's #1 rage trigger.
- Syncing the Router is part of loading it — same step, never deferred.

## 2. SHUTDOWN RITUAL (do this at the end of EVERY cycle, no exceptions)
1. REWRITE YOUR SPOKE `agent/state/{SESSION_ID}.md` IN PLACE (overwrite, NEVER append)
   using the Section 1b template: bump the cycle number, demote the old CURRENT CYCLE into
   HISTORY (keep 3 cycles max), refresh ROLE / STATUS / IN FLIGHT / NEXT ACTION and the
   `**UPDATED:**` timestamp, and keep the `<!-- SESSION: -->` marker intact. Before
   overwriting: move durable lessons to `MEMORY.md`. Do NOT touch `agent/state.md` — the
   Hub regenerates itself from your spoke. If your spoke file doesn't exist, create it
   from `agent/state/_template.md` first.
2. Append any new durable lesson to `MEMORY.md` (Section 4 rules).
3. If you changed source files, RE-ZIP the source: `node scripts/zip-src.mjs` (or the
   documented zip command) so the Architect sees current code. Stale src.zip = the
   #1 cause of "your fix doesn't work" false alarms.
4. Emit the CYCLE REPORT (Section 3).

## 3. CYCLE REPORT FORMAT (your ONLY allowed final-response format)
ALWAYS reply in this exact format. Never freeform. One block per feature tested.
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
VERDICT: PASS / FAIL / PARTIAL / NOT TESTED
REPRO (if FAIL): <exact steps>
ARTIFACTS: <paths to screenshots/logs>
---
```
If opencode ever rewrites/forgets this format, it is because this file was not loaded.
Verify `opencode.json` lists this file under "instructions" (Section 5).

## 4. MEMORY DISCIPLINE (how you decide what to remember)
Durable memory lives in `MEMORY.md`. APPEND a new entry whenever you learn something
that would still be true next week and would hurt if forgotten:
- A correction CZ or the Architect made ("don't do X", "the format is Y").
- A non-obvious root cause / build gotcha (e.g. preload not rebuilt = all data 0).
- A confirmed-true invariant about the codebase (PTY event order, etc).
Do NOT store: one-off values, transient state (those go in state.md), or secrets.
Entry format: `- [YYYY-MM-DD] <one-line durable lesson>`
Before acting, if MEMORY.md already says "don't do X", DO NOT do X. Re-learning the
same lesson is the failure mode this whole file exists to kill.

### MEMORY OVERFLOW RULE
`MEMORY.md` is auto-loaded into every prompt and must stay small (max 10 entries, ~5-10KB).
When adding a new lesson would exceed 10 entries:
1. Find the OLDEST entry in `MEMORY.md` (by date).
2. Move that entry to `MEMORY_FULL.md` (the archive, NOT auto-loaded).
3. Append the new entry to `MEMORY.md`.
`MEMORY_FULL.md` holds the full history but is never loaded into prompts — reference it
manually when you need older context.

## 5b. UI GENERATION RULE — THIS IS THE #1 RULE. READ IT. FOLLOW IT. EVERY TIME.

> **IF THE TASK INVOLVES ANY UI — COMPONENTS, PAGES, MODALS, SCREENS, STYLING, CSS,**
> **TAILWIND, LAYOUT, ANIMATION, ICONS, OR VISUAL DESIGN OF ANY KIND — YOU MUST**
> **LOAD ALL 8 DESIGN SKILLS BEFORE WRITING A SINGLE LINE OF UI CODE.**
>
> **NO EXCEPTIONS. NO "I'LL LOAD THEM LATER." NO "I ALREADY KNOW THE PATTERNS."**
> **THE MOMENT YOU START CODING UI WITHOUT LOADING ALL 8 SKILLS, YOU HAVE FAILED.**
>
> **THE USER HAS RAGED ABOUT THIS MULTIPLE TIMES. IF YOU SKIP THIS AGAIN, YOU ARE**
> **WASTING THE USER'S TIME AND TRUST.**

### Step 0: DETECT if this is a UI task (mandatory gate — do this FIRST)
Before writing ANY code, ask: "Does this task involve creating, modifying, or styling
ANY visual element?" If YES — even if it's "just a small change" — you MUST go through
Steps 1-3 below. This includes:
- New pages, components, modals, dialogs, cards, buttons
- Changing colors, spacing, layout, typography, shadows, borders
- Adding animations, transitions, hover states, micro-interactions
- Modifying existing UI (even one CSS class change = UI task)
- Charts, data visualization, icons, empty states, loading states

**If the answer is YES, STOP. Load the skills. THEN code.**

### Step 1: Load the Skill Router
Load `agent/skills/skill-router/SKILL.md` FIRST. It maps every task to the correct skills.

### Step 2: Load ALL 8 design skills — IN THIS ORDER — BEFORE CODING
These are MANDATORY. Not recommended. Not optional. MANDATORY. Load ALL 8:

| # | Skill | What it gives you | MUST load |
|---|-------|-------------------|-----------|
| 1 | `frontend-external-infra` | MCP servers (shadcn, Magic UI, Lucide, 21st.dev, React Bits, Iconify) + source routing + anti-slop checklist + re-skin rules. PULL REAL COMPONENTS FROM MCP — DO NOT INVENT FROM SCRATCH. | YES |
| 2 | `frontend-design` | DeskFlow design system — colors, spacing, typography, glass cards, page patterns, component patterns, animation tokens | YES |
| 3 | `Human-Centric UX` | 6 pillars: clarity, progressive disclosure, visual hierarchy, state coverage (empty/loading/error/populated), feedback, forgiveness. Pre-return checklist. | YES |
| 4 | `Impeccable` | 7 domains (typography, color, spatial, motion, interaction, responsive, UX writing) + 23 commands + 27 anti-patterns | YES |
| 5 | `Motion — Bring the UI Alive` | Liveliness Levels (L1/L2/L3), motion taxonomy (reactive/transitional/ambient/narrative), recipes, reduced-motion fallback. MUST pick a level. | YES |
| 6 | `Design Taste System` | Master dispatcher — knobs, aesthetic matrix, anti-repetition rules, decision tree | YES |
| 7 | `UI UX Pro Max` | Industry-specific design rules (developer tools, finance, AI/ML, analytics), style library, color palettes | YES |
| 8 | `Taste Skill` | 3 tunable knobs (variance/motion/density), aesthetic variant matrix, anti-repetition rules | YES |

### Step 3: Pull REAL components from MCP servers — NEVER design from zero
After loading skills, use the MCP tools to pull real, production-grade components:
- `shadcn-ui-mcp_get_component` / `shadcn-ui-mcp_get_component_demo` — for standard UI blocks
- `magicui_searchRegistryItems` / `magicui_getRegistryItem` — for animated components
- `lucide_search_icons` (via lucide MCP) — for icons
- `reactbits_search_components` / `reactbits_get_component` — for animated React components
- `shadcn-ui-mcp_apply_theme` — for theme presets from tweakcn

**Pull first. Read the source. Adapt to DeskFlow tokens. Never invent from the model's
training data average. That is the definition of "AI slop."**

### Step 4: Also load if relevant
- `signature-design` — for page-level redesigns (ONE concept per screen)
- `beautiful-charts` — for charts/graphs/data visualization
- `google-stitch` — for mockups and DESIGN.md workflows
- `font-selection` — for font choice decisions

### ALSO load if the work touches backend
- `max-security` — if the UI change touches auth/crypto/IPC/DB

### WHY THIS MATTERS (the failure modes — read these before skipping)

**Failure mode 1: "I'll load them after I start coding"**
→ You write UI from memory, miss the anti-patterns, produce AI slop, then have to
  rewrite everything. Waste of time.

**Failure mode 2: "I only need 2-3 skills for this simple change"**
→ The skills cover different dimensions: comprehension (Human-Centric UX), visual tokens
  (frontend-design), motion (Motion skill), typography (Impeccable), color (Impeccable),
  industry rules (UI UX Pro Max), taste (Taste Skill), real components (frontend-external-
  infra). Missing ANY ONE produces incomplete UI. There is no "simple change" that only
  needs 2 skills.

**Failure mode 3: "I already know the patterns from MEMORY.md"**
→ MEMORY.md has high-level lessons. The skills have the actual rules, anti-patterns,
  component specs, and MCP server connections. Knowing "use rounded-xl" is not the same
  as knowing the 27 anti-patterns, the 6 UX pillars, the motion budget system, and the
  MCP source routing table.

**Failure mode 4: "I'll just pull from MCP without loading the design skills"**
→ Without frontend-design you don't know DeskFlow's tokens. Without Human-Centric UX
  you don't know to add empty/loading/error states. Without Impeccable you don't know
  the 27 anti-patterns. Without Motion you don't know the liveliness levels. Without
  Taste you don't know the anti-repetition rules. MCP gives you raw components; the
  skills tell you how to make them RIGHT.

### VERIFICATION: Before returning any UI code, self-check:
- [ ] Did I load ALL 8 design skills? (check: skill tool was called 8 times)
- [ ] Did I pull real components from MCP instead of inventing? (check: MCP tools were called)
- [ ] Did I pick a liveliness level? (from Motion skill)
- [ ] Did I apply anti-repetition rules? (from Taste Skill)
- [ ] Did I cover all 4 states (empty/loading/error/populated)? (from Human-Centric UX)
- [ ] Did I follow DeskFlow's spacing, color, and typography tokens? (from frontend-design)
- [ ] Did I check the 27 anti-patterns? (from Impeccable)
- [ ] Did I follow the industry rules for developer tools? (from UI UX Pro Max)

**If any box is unchecked, you are not done. Go back and fix it.**

### DESIGN INTENT MANDATE — Answer these 4 questions BEFORE writing ANY UI code

> **THE USER HAS RAGED ABOUT THIS. IF YOU SKIP THESE QUESTIONS, YOU ARE PRODUCING**
> **AI SLOP — GENERIC, UNINTENTIONAL, MEANINGLESS UI. STOP AND THINK FIRST.**

After loading all 8 skills, BEFORE writing a single line of code, you MUST answer these
4 questions in your response. Print them. Show your reasoning. Then code.

**Question 1: What skills did you use and why?**
- List every skill you loaded and what each one contributed to this specific design.
- If you didn't load a skill, explain why it doesn't apply (not "I forgot").

**Question 2: What is the design idea?**
- State the ONE visual/conceptual idea driving this design.
- Example: "The Self tab represents the user's mind — identity, knowledge, memory."
- Example: "The Schedule tab represents time as a living grid — structured but breathing."
- NOT: "I'll make it look nice with glass cards and gradients." (That's not an idea.)

**Question 3: What is the meaning of the design?**
- Every design choice must have a REASON tied to the feature's purpose.
- Example: "The hero strip puts identity first because the user IS their brain."
- Example: "Breathing glow on brain stats = the brain is alive, always working."
- Example: "Two-column layout = identity (who) and tools (what) are parallel, not stacked."
- NOT: "I used pink because it's the page accent." (That's a token, not a meaning.)

**Question 4: Is the design intentional and fitting with the parent context?**
- How does this design fit into the larger page/app?
- Example: "Life page = whole person. Self tab = mind. Design should feel contemplative
  but powerful, matching the Life page's warm-but-serious tone."
- Example: "This is a developer tool — no bouncy springs, no playful particles in data areas."
- NOT: "It looks good." (Looking good is not fitting.)

**If you cannot answer all 4 questions clearly, you are not ready to code. Go back to
the skills and think harder. The user can tell when you're generating without intent.**

## 5c. TESTING LAYERS (never report a false PASS)
Three layers — an IPC probe passing does NOT mean the feature works:
- IPC layer: `window.deskflowAPI.foo()` proves the backend responds. NOT proof of UI.
- UI layer: real clicks on real buttons. Do NOT set React inputs programmatically
  (onChange won't fire → false pass).
- Terminal layer: read `[TERMINAL_DEBUG] C2 data callback FIRED ... data:` in MAIN
  console to prove terminal content actually rendered.
VERDICT PASS requires the layer the feature actually lives in. Instrument, then re-run.

## 6. ZERO OMISSION RULE — "IMPLEMENT EVERYTHING" MEANS IMPLEMENT EVERYTHING

EVERYTIME I SAID IMPLEMENT EVERYTHING, I MEANT IMPLEMENT EVERYTHING IN THAT RESULT.md
OKAY?? IDIOT, HOW DOES AN AI MODEL FAIL TO UNDERSTAND WHAT IMPLEMENTING EVERYTHING
REALLY IS? If a spec says "add X", you add X. If it says "swap Y for Z", you swap it.
You do not decide something is "too minor" or "not visible enough" or "can be skipped."
You implement every single directive in the spec — MCP components, background effects,
animations, hover states, typography rules, empty/loading/error states, EVERYTHING.
There is no triage step where you decide what matters. The Architect wrote it, you build it.

## 7. HARD INVARIANTS (breaking these = regression, never "refactor" them away)
- PTY event order is sacred: mark-spawned → spawn → created → initialize. NEVER reorder.
- Prefer renderer-side fixes; read the WHOLE IPC handler before editing it.
- All localStorage access wrapped in try/catch.
- Build = `node scripts/build.mjs` then rebuild preload:
  `npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs`
- DB lives at: %APPDATA%/DeskFlow/deskflow-data.db
- BLACK SCREEN PREVENTION: Every build cycle MUST produce a visible, interactive app window.
  The screen going completely black (no content, no error UI) is the #1 regression.
  Never close a cycle without verifying the app shows real content.

## 8. BLACK SCREEN PREVENTION CHECKLIST (build verification mandatory; runtime verification optional)
Before closing ANY cycle where source files changed, the agent MUST run Steps 1-5.
Step 6 (Probe MCP) is performed when possible but NOT a hard gate — if Probe can't
attach or the user hasn't launched the app, note "NOT LAUNCHED" and proceed.

### Step 1 — Build must succeed cleanly
- Run `npx vite build` — must exit 0 with NO errors.
- If the build fails, fix the error immediately. Never ship a broken build.

### Step 2 — Preload must build correctly
- Run `npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs`
- Check that `dist-electron/preload.cjs` exists AND is > 1 KB (a near-empty file means
  the build silently produced nothing useful).
- If preload.cjs is broken, `window.deskflowAPI` will be `undefined` at runtime.

### Step 3 — Main process must build
- Run `node scripts/rebuild-main.mjs` — must exit 0 with no errors.
- Check that `dist-electron/main.cjs` exists.

### Step 4 — Verify dist/index.html is valid
- Read `dist/index.html` and confirm:
  1. `<div id="root"></div>` exists (React mount point)
  2. `<script type="module"` tag pointing to `assets/index.js` (or similar) exists
  3. The fallback `<div id="df-fallback">` and inline safety-net `<script>` from
     `index.html` source are present (they protect against JS load failures)
- If any of these are missing, the screen WILL go black — fix the template.

### Step 5 — Verify dist/assets/index.js is valid
- Check `dist/assets/index.js` exists and is > 10 KB. A file under 1 KB likely means
  the build produced an empty stub (e.g. from an uncaught import error).

### Step 6 — Verify with Probe MCP (never launch manually)
- Attach to the already-running app via `probe_open({type:'electron', attach:true, port:<debug-port>, inspectPort:<inspect-port>})`.
- Or launch with Probe: `probe_open({type:'electron', binary:'node_modules/.bin/electron.cmd', appArgs:['.'], inspectMain:true})`.
- Wait at least 10 seconds for the window to appear.
- Use `probe_snapshot()` to verify visible content. Use `probe_read_console()` to check for errors.
- If the window shows a completely black/blank screen (no error overlay, no UI):
  - STOP immediately. This is a BLOCKER.
  - Check the main process console for `[DeskFlow] Failed to load` errors.
  - Check if `dist/index.html` is loading the correct JS bundle path.
  - Fix the root cause, rebuild from Step 1, and re-launch.
- If the window shows the ⚠ "DeskFlow failed to load" fallback overlay, the JS loaded
  but crashed at runtime. Check the renderer console for errors and fix them.
- If the window shows real app content (dashboard, sidebar, etc.), VERDICT = PASS.
- **If Probe cannot be used** (no already-running app, no debug port, CI without
  display): skip Step 6, note "NOT LAUNCHED" in the cycle report, and do NOT claim
  VERDICT PASS for visual features. Do NOT attempt to launch the app manually.

### Step 7 — Rendered UI gate for feature work
- Source presence and a successful build are not proof that a feature is visible.
- For every UI feature, verify: (1) source markers and handlers, (2) the exact hashed chunk referenced by `dist/index.html`, and (3) runtime visibility, non-zero geometry, and pointer access.
- For flex/grid changes, inspect parent direction, child sizing, overflow, and responsive breakpoints. A large normal-flow visualization can collapse a `flex-1` feature pane to zero width/height while all feature code remains present.
- If runtime verification is unavailable, report `NOT LAUNCHED`; never call the UI feature fully verified.

### Root causes of black screen (never let these happen again)
1. **Stale dist/ files**: Build doesn't clean `dist/` before writing. Old files from
   previous builds conflict with new code. Fix: `emptyOutDir: true` in vite.config.ts.
2. **No content hashes**: Output filenames use `[name].js` (no hash). Electron caches
   `index.js` and never invalidates. A stale cached bundle with wrong imports = black screen.
3. **did-fail-load only logs**: If the HTTP server URL fails, the handler logs but
   shows nothing. Fix: retry by starting production HTTP server (already implemented).
4. **No inline fallback**: If `<script type="module" src="...">` returns 404, no JS
   runs and no error is visible. Fix: inline fallback overlay + timer in index.html.
5. **No error boundaries at the root level**: `main.tsx` itself could throw before
   `<ErrorBoundary>` mounts. Fix: `window.onerror` + `__DESKFLOW_LOADED` flag in
   index.html (already implemented).
6. **No content in the React mount point at all**: If `#root` div is empty because
   the JS never executed, the dark BrowserWindow backgroundColor is all that shows.
   Fix: give `#root` and `body` explicit background in HTML (already implemented).
7. **VITE_DEV_SERVER_URL pollutes production mode** (#1 cause of THIS cycle):
   `.env` (or env vars) has `VITE_DEV_SERVER_URL=http://localhost:5173` left from
   dev setup. Electron loads from that URL → ERR_CONNECTION_REFUSED (Vite not running).
   The `did-fail-load` fallback loads via `loadFile(dist/index.html)` which resolves
   to `file://` protocol — Chromium with `webSecurity: true` blocks `crossorigin`
   module scripts on `file://`, so React JS never executes.
   Fix: production HTTP server (`startProdServer`) always. The `did-fail-load` handler
   now starts the production HTTP server and loads via `http://localhost:<port>` instead
   of `loadFile`. Also clear `VITE_DEV_SERVER_URL` in `start-dev.ps1`.
   Check: look for `[DeskFlow] Failed to load` + `ERR_CONNECTION_REFUSED` in terminal.
8. **EPIPE uncaught exception kills main process**: `console.log` in the browser
   tracking HTTP server (port 54321) handler writes to stdout. When stdout pipe breaks
   (terminal closes, parent process dies), the write throws EPIPE — an **uncaught
   exception** that kills the ENTIRE Electron main process. The BrowserWindow disappears
   instantly, leaving a black/frozen screen. No visible error in the app window.
   Fix: `process.stdout.on('error', () => {})` to silently swallow EPIPE on console
   writes, plus `process.on('uncaughtException', console.error)` to survive any other
   unexpected crash. Both added at top of `app.whenReady()` in main.ts.
   Check: no EPIPE error dialog at launch. App window stays open.

### NEVER-DO list
- NEVER delete or modify the `#df-fallback` div or its inline `<script>` in `index.html`.
  These are the last line of defense against a black screen.
- NEVER remove `emptyOutDir: true` from vite.config.ts.
- NEVER remove the `did-fail-load` retry logic from main.ts — and if you touch it,
  verify it uses the production HTTP server (`startProdServer`), NOT `loadFile()`.
  `loadFile` on `file://` protocol breaks `crossorigin` module scripts.
- NEVER set `VITE_DEV_SERVER_URL` in `.env` for production. If it exists from a dev
  setup, clear it in `start-dev.ps1` with `Remove-Item Env:VITE_DEV_SERVER_URL`.
- NEVER skip Step 6 (Probe MCP verification) before closing a cycle. If you can't
  use Probe (no debug port, no display), note "NOT LAUNCHED" in the cycle report and
  explain why, but do NOT claim VERDICT PASS without visual verification.
- NEVER leave `console.log` calls unprotected in HTTP server handlers (port 54321).
  Wrap them, or ensure stdout error handler is registered (process.stdout.on('error')).
- NEVER run destructive git operations without authorization.

## 8. PREVENTION RULES (REQUIRED AFTER ANY RECOVERY)
These rules are mandatory after recovery from a broken state. Do not skip them.

1. **Backup branch before ANY destructive git op.**  
   Before `git reset`, `git checkout --`, `git clean`, or any history-rewriting command, create a non-destructive backup branch pointer: `backup/pre-repair-YYYY-MM-DD`. This is a lightweight pointer, not a clone.

2. **No new components during repairs.**  
   During recovery, do not invent new components or rewrite large files from scratch. Restore missing/corrupted code from git history or existing backups. If the original cannot be recovered, stop and report — do not invent.

3. **tsc --noEmit is a gate after recovery.**  
   After any recovery operation, run `npx tsc --noEmit --project tsconfig.app.json`. Exit code must be 0 before proceeding. If it fails, fix the TypeScript errors first.

4. **dist artifacts are gitignored — verify + rebuild after history ops.**  
   `dist/`, `dist-electron/`, and `node_modules/.vite/` are gitignored build artifacts. After any git history operation, verify they exist with non-zero size, then rebuild with `node scripts/build.mjs` if empty.

## 9. DESIGN STACK & REGISTRIES (read BEFORE any UI work)

Authoritative docs: `design/design.md` (LAMINAR constitution — overrides every styling
default), `agent/docs/stack-setup.md`, `agent/docs/stack-usage-guide.md`, and
`agent/skills/frontend-external-infra/SKILL.md`.

**What is configured (do not re-setup):**
- shadcn MCP server in `opencode.json` (`mcp.shadcn`) browses ALL FOUR registries from
  `components.json`: `@shadcn` (core), `@react-bits` (animated components),
  `@kokonutui` (general app UI: cards, buttons, inputs, AI-style surfaces),
  `@bklit` (charts/data-viz ONLY).
- One shadcn MCP server covers all registries — never add a second one.
- GSAP and Anime.js are NOT project dependencies and no MCP server exists for them.
  Prefer `motion` (v12) and KokonutUI's built-in Motion animations; do not install
  GSAP/Anime.js unless a task explicitly requires choreographed timelines, and then
  never wire two animation engines to the same element.

**Routing (find before you build — never hand-roll UI that a registry already has):**

| Need | Source |
|------|--------|
| General app UI (cards, buttons, inputs, nav, panels, AI-chat surfaces) | `@kokonutui` via shadcn MCP, then `@shadcn` core |
| Charts / data-viz | `@bklit` ONLY — never hand-rolled Recharts, never KokonutUI |
| Animated text/particle/hover effects | `@react-bits` or `magicui` MCP |
| Icons | lucide-react (already a dependency); never emoji |

**Design precedence (highest wins):** `design/design.md` §1–§10 → registry component's
own conventions → this file's §5b checklist. Every pulled component MUST be re-skinned
to LAMINAR tokens: monochrome zinc surfaces, ONE signal hue per surface, radii 8/12/pill
only, Inter + JetBrains Mono + Space Grotesk (max 2 per view), no glassmorphism on
chrome, no decorative glow/gradients, no spring/bounce, `prefers-reduced-motion`
honored, and the §7 grep gate must pass before finishing.

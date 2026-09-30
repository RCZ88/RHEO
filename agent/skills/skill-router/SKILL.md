# Skill Router — Universal Skill Dispatcher v1.5.0

> **PURPOSE:** This is the master routing table for ALL skills in `agent/skills/`. It maps every task/scenario to the correct skill(s), enforces load order, and ensures no skill is forgotten. Load this skill FIRST whenever you begin a task.
>
> **LIVING DOCUMENT:** this Router is itself a skill that must stay synced with `agent/skills/` — see §7 Self-Maintenance. The user demands it is continuously updated whenever new skills exist. A stale Router is a failure.

## 1. How to use this skill

1. Identify the user's task category from the Decision Tree (§2).
2. Read the scenario-to-skill mapping for that category (§3).
3. Load ALL skills listed under "MANDATORY" for that scenario — in the specified order.
   **Exception — DESIGN category:** load `paint` and nothing else. `paint` is the conductor
   for all design work; it sequences the other design skills itself.
4. Load skills listed under "RECOMMENDED" if the task scope warrants it.
5. Respect the activation conditions and load ordering rules (§4).
6. Never skip a MANDATORY skill because you think it doesn't apply — if in doubt, load it.
7. If you know of a skill on disk that this Router does NOT list (glob `agent/skills/*/SKILL.md`), update the Router (§7) BEFORE loading it — never work around a stale Router.

## 2. Decision Tree — what category is this task?

```
User task enters
│
├─ ANY task that writes source, builds, runs the app, migrates the DB, or commits
│  └─ COORDINATION category → load `multi-agent-coordination` FIRST
│     (other agents share this repo; register → status → claim before you write)
│
├─ "fix the problems" / "work through problems.md"
│  └─ FIX PROBLEMS category
│
├─ User wants UI changes / component work / design
│  └─ DESIGN category → load `paint` ONLY (it conducts everything else)
│
├─ "commit" / "stage" / "push" / "save changes"
│  └─ COMMIT category
│
├─ Code has been written and needs review before shipping
│  └─ SECURITY REVIEW category
│
├─ User asks for research / investigation / deep analysis
│  └─ RESEARCH category
│
├─ User asks to test / verify / "make sure it works" in browser
│  └─ TESTING category
│
├─ User says "create a prompt" / "write a prompt" / "generate problem"
│  └─ PROMPT GENERATION category
│
├─ Terminal / PTY / agent communication is failing
│  └─ TERMINAL DEBUG category
│
├─ App detection / foreground tracking is wrong
│  └─ APP DETECTION DEBUG category
│
├─ "create a README" / "write docs" / "generate documentation"
│  └─ DOCUMENTATION category
│
├─ After code changes — sync knowledge / update context
│  └─ CONTEXT MAINTENANCE category
│
├─ "add a tutorial" / "walkthrough" / "onboarding steps"
│  └─ TUTORIAL category
│
├─ Learn / Lyceum / lesson generation / curriculum / knowledge intake / quiz / flashcard
│  └─ LEARN category
│
├─ "send to external AI" / "paste into ChatGPT" / "let my AI decide" / format-only prompts / import from AI
│  └─ EXTERNAL AI BRIDGE category
│
├─ "generate a license" / "add license" / "choose license"
│  └─ LICENSE category
│
├─ Database migration failing / better-sqlite3 errors
│  └─ SQLITE MIGRATION category
│
├─ User corrects behavior / "never do X" / session boundary
│  └─ AGENT REFLECT category
│
└─ Everything else not covered above
   └─ GENERAL DEVELOPMENT category
```

## 3. Scenario-to-Skill Mapping

### FIX PROBLEMS
**Trigger:** User says "fix the problems", "work through problems.md", "fix issue X.Y", "fix one issue", "fix all the issues"
**Goal:** Read PROBLEMS.md, fix bugs, mark as AI Attempted Fix, report

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `fix-problems` | Core fix loop — autonomous recursive bug fixing with user confirmation gates |
| MANDATORY | `humancentred-UIUX` | Every fix must pass human-comprehension review (check for empty/loading/error states) |
| RECOMMENDED | `max-security` | If the fix touches security-sensitive code (auth, crypto, IPC, DB) |
| RECOMMENDED | `recursive-playwright` | If the fix needs browser-level verification (UI bugs, form handling) |

**Load order:** fix-problems → humancentred-UIUX → max-security (if needed) → recursive-playwright (if needed)

---

### DESIGN
**Trigger:** Any UI change, component work, new page, "make it look better", "polish", "redesign", "design audit", "visual system", "motion mechanics"
**Goal:** Generate production-quality UI that follows DeskFlow design system + visual mechanic vocabulary

> **⚠ THE DESIGN CATEGORY IS NOW DISPATCHED THROUGH `paint`.** Load `paint` FIRST and let it
> conduct the pipeline. It owns the entry gate, the phase order, the MCP sourcing rule, the
> conflict-resolution table, and the ship gates. The rows below are the skills `paint` loads —
> they are listed for traceability and so you can verify `paint` is not stale, **but you do
> not load them directly.** Loading them in an arbitrary order is what causes contradictory
> output (three accent colors, four radius maximums, glass banned and mandated at once).

| Priority | Skill | Why |
|----------|-------|-----|
| **ENTRY** | `paint` | **The conductor.** Loads all design skills in a fixed 8-phase order, routes every MCP call, resolves conflicts against `design/design.md` (LAMINAR), and runs 6 ship gates. Load this one. |
| loaded by `paint` P3 | `frontend-external-infra` | Never design from zero — pull from MCP component libraries first. Source routing table. |
| loaded by `paint` P4 | `frontend-design` | DeskFlow design system — component patterns, type scale, page archetypes, z-index ladder |
| loaded by `paint` P0/P5 | `humancentred-UIUX` | Mandated by AGENTS.md §5b. All 5 states. 6 pillars: clarity, progressive disclosure, visual hierarchy, state coverage, feedback, forgiveness. |
| loaded by `paint` P4/P5/P7 | `impeccable` | 7 domains + 23 commands + 27 anti-patterns. Catches the details other skills miss. |
| loaded by `paint` P6 | `motion-alive` | Pick a Liveliness Level (L1/L2/L3) first. Taxonomy: reactive, transitional, ambient, narrative. Reduced-motion mandatory. |
| loaded by `paint` P1 | `design-taste` | Aggregator view — live knob config + sub-skill index |
| loaded by `paint` P1 | `taste-skill` | 3 tunable knobs (variance/motion/density). ⚠ Its anti-repetition rules are VOID for App UI. |
| loaded by `paint` P0 | `ui-ux-pro-max` | Industry-specific rules (developer tools, finance, AI/ML, analytics), style library, color palettes, typography pairings. |
| loaded by `paint` P3 | `ui-and-charts` | KokonutUI (general UI) + Bklit (charts ONLY). Search registry BEFORE writing custom markup. |
| loaded by `paint` P2 | `signature-design` | Page-level redesign / hero work: ONE concept-true centerpiece per screen. Conditional — most dense surfaces correctly have no hero. |
| loaded by `paint` P4 | `font-selection` | Never invent a font |
| RECOMMENDED | `beautiful-charts` | Chart craft: form follows the question, axis/tooltip/legend discipline |
| RECOMMENDED | `animation-stack` | Engine selection: GSAP choreography / Anime.js single-element / Motion default. One engine per element. |
| RECOMMENDED | `google-stitch` | When the user mentions "mockup", "Stitch", "vibe design", "DESIGN.md" |

**Load order:** `paint` ONLY. It sequences everything. If you must reason manually, the
order is: `ui-ux-pro-max` → `taste-skill` → `design-taste` → `signature-design` (if) →
`frontend-external-infra` → `ui-and-charts` → `frontend-design` → `impeccable` →
`font-selection` → `humancentred-UIUX` → `motion-alive` → `animation-stack` → `beautiful-charts`.

**NEVER load a design sub-skill directly. Load `paint`.** The user has raged about this
repeatedly. Do not skip `paint` because it "looks like just another skill" — it is the only
one that knows which of the other eleven to believe.

**Authority order when skills disagree:** `design/design.md` (LAMINAR) → live tokens in
`src/index.css` → registry component conventions → `paint` phase order → the sub-skills.
See `agent/skills/paint/references/conflict-resolution.md` for the resolved rows.

**If this is a page-level redesign** that also changes how data flows, also load `max-security` to review backend changes.

**If this involves motion mechanics or visual simulations**, reference `agent/docs/motion_site_mechanics_10/` HTML files directly — they are the canonical source for algorithm details, canvas sizes, and physics parameters. This project is called RHEO.

---

### COMMIT
**Trigger:** User says "commit", "stage", "push", "save changes"
**Goal:** Stage all files, write exhaustive commit message, update COMMITS.md

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `commit` | Pre-commit workflow: stage ALL, exhaustive message with sections, COMMITS.md update |
| RECOMMENDED | `maintain-context` | After commit, sync graphify + vault + state.md (if severity warrants) |

**Load order:** commit → maintain-context (if code changed)

---

### SECURITY REVIEW
**Trigger:** "review this code", "is this secure", "harden", "audit", "optimize", "before we ship", or any non-trivial code generation
**Goal:** Find and fix security, performance, and logic issues before code ships

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `max-security` | 4-step security review: Map surface → OWASP scan → Performance scan → Logic scan |
| MANDATORY | `humancentred-UIUX` | If the code includes UI, check human-comprehension of outputs |
| RECOMMENDED | `agent-reflect` | If a vulnerability was caused by a recurring pattern, encode the lesson |

**Load order:** max-security → humancentred-UIUX (if UI) → agent-reflect (if lesson learned)

---

### RESEARCH
**Trigger:** "research X", "investigate Y", "compare technologies", "analyze codebase", "feasibility study"
**Goal:** Structured research with clear findings, sources, and actionable output

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `deep-research` | Structured 5-phase research workflow with DSL inputs and report template |
| RECOMMENDED | `deep-research-prompt` | If you need to delegate research to an external CLI agent (Qwen) |
| RECOMMENDED | `research-digest-overhaul` | If the research targets an EXISTING system/surface that needs an overhaul (digest pipeline, capture, UI) |
| RECOMMENDED | `maintain-context` | If research findings should be persisted to vault or graphify |

**Load order:** deep-research → deep-research-prompt (if delegating) → research-digest-overhaul (if overhauling an existing system)

---

### TESTING
**Trigger:** "test this", "verify it works", "make sure the feature is working", "run the tests"
**Goal:** Validate that features work correctly in the real browser/app

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | Probe MCP (MCP server, not a skill) | Assertion-first runtime testing: `probe_open` (attach to the running app — NEVER launch manually) → `assert_*`/`wait_for`/`snapshot`/`read_console`. If no debug port, report NOT LAUNCHED. |
| RECOMMENDED | `recursive-playwright` | If you need an autonomous test-and-fix loop (test → fail → fix → retest) |

**Load order:** Probe MCP wiring → recursive-playwright (if loop needed)

**Important:** An IPC probe is NOT proof the UI works. Test the real UI layer. Read `[TERMINAL_DEBUG]` / `[FIT-DBG]` / `[RESUME-DBG]` logs in renderer + main console.

---

### PROMPT GENERATION
**Trigger:** "create a prompt", "write a prompt", "generate a prompt for external AI", "generate problem"
**Goal:** Produce high-fidelity prompts that equip the receiving AI with full context

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `generate-prompt` | High-fidelity prompt generation — copy user words verbatim, create CONTEXT_BUNDLE.md, apply RESULT.md rules |
| MANDATORY | `humancentred-UIUX` | The resulting UI (if any) must be human-comprehensible |
| RECOMMENDED | `generate-problem` | If generating a problem report for external AI (bug report format) |
| RECOMMENDED | `backandfourth-skill` | If the task is BACK-AND-FORTH collaboration with an external AI (INITIAL_PROMPT/CONTEXT_BUNDLE/CONTEXT_GAPS/CONVERSATION_PROTOCOL, rounds in `conversation/`) |

**Load order:** generate-prompt (+ generate-problem if applicable) → backandfourth-skill (if back-and-forth collaboration) → humancentred-UIUX

---

### LEARN / LYCEUM
**Trigger:** "create a lesson", "generate lesson", "edit lesson", "quiz", "flashcard", "curriculum", "knowledge intake", "learner profile", "mastery level", "learning node"
**Goal:** Generate, edit, or improve Learn (Lyceum) module content — lessons, quizzes, flashcards, curriculum, knowledge base, visual grounding

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `visual-grounding-authoring` | Every lesson MUST follow integrated-widget authoring patterns (not paired decoration blocks). Pattern catalog, @ref rules, self-check. |
| MANDATORY | `humancentred-UIUX` | Lesson UI must have empty/loading/error states, human-comprehensible labels, accessible interactions |
| RECOMMENDED | `frontend-external-infra` | If building new Learn UI components — use real MCP-served components (shadcn, Magic UI, Lucide) |
| RECOMMENDED | `generate-prompt` | If generating prompts for lesson creation or AI-powered features |

**Load order:** visual-grounding-authoring → humancentred-UIUX → frontend-external-infra (if UI work) → generate-prompt (if prompt generation)

---

### EXTERNAL AI BRIDGE
**Trigger:** "send to external AI", "paste into ChatGPT", "let my AI decide", format-only prompts, import from external AI, copy prompt for AI, browser-extension prompt panel, dynamic prompt field selection
**Goal:** Build features where the app generates a format instruction, user pastes into existing AI conversation, AI outputs structured JSON, user pastes back and app parses it

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `external-ai-bridge` | Core pattern — format-only prompts, parsing rules, series context, frame modes, anti-patterns |
| MANDATORY | `frontend-external-infra` | UI components: TemplateSelector, paste-back cards, "Send to External AI" buttons |
| RECOMMENDED | `humancentred-UIUX` | Ensure paste-back flow has clear empty/loading/error states |
| RECOMMENDED | `agent-forge` | If the feature also needs internal AI agents alongside the external bridge |

**Delivery surfaces (all use the same `/ai-prompts/build` + `/ai-prompts/import` contract):**
- **Desktop app** — Content Engine / Learn / AI Tools tabs with "Send to External AI" buttons.
- **Browser extension overlay** (`browser-extension/overlay.js`) — the AI Context Bridge panel's prompt selector is a TWO-STEP dynamic flow: (1) pick a prompt type, (2) `renderPromptConfig` shows selectable sections (content-engine), fields-to-fill (learn/ai-tools), frame-mode strict/loose, writing style, and an optional context box, then "Build & Inject" posts to `/ai-prompts/build` and injects the result into the chat input. The `fields` param is a key→value map (empty value = `[FILL THIS]` marker); `sections` controls which content-engine parts are built; `frameMode` and `style` shape the instruction.

**Load order:** external-ai-bridge → frontend-external-infra → humancentred-UIUX (if UI work) → agent-forge (if hybrid)

---

### TERMINAL DEBUG
**Trigger:** "text goes to shell", "agent:ready never fires", "system prompt not received", PTY/terminal/spawn failures
**Goal:** Diagnose and fix terminal-agent communication failures

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | AGENTS.md §7b Debugging Protocol + `agent/debugging.md` | Console logging standard (version-stamped entry logs), debug script generation, runtime verification checklist. The former `terminal-agent` skill was removed — these are its successors. |

**Load order:** terminal-agent only (single-skill scenario)

---

### APP DETECTION DEBUG
**Trigger:** Foreground app shows wrong name, Steam/Epic wrapper instead of real game, null during fullscreen
**Goal:** Fix the 5-layer resolution pipeline

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `app-detection` | 5-layer resolver: TITLE → MAP → INDEX → SCAN → KEEP. Never run layer 4 on normal poll. |

**Load order:** app-detection only (single-skill scenario)

---

### DOCUMENTATION
**Trigger:** "create a README", "improve README", "generate documentation", "write docs"
**Goal:** Professional documentation with badges, diagrams, API reference

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `readme-generator` | 7-step workflow: analysis → badges → diagrams → sections → writing |
| RECOMMENDED | `maintain-context` | If documentation reveals architecture that should be synced to vault |

**Load order:** readme-generator → maintain-context (if needed)

---

### CONTEXT MAINTENANCE
**Trigger:** After ANY code changes. Do NOT activate after read-only exploration.
**Goal:** Keep graphify, agent markdown, and Obsidian vault in sync

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `maintain-context` | Severity assessment (1-5), per-scale action matrix, graphify sync commands |

**Load order:** maintain-context only (single-skill scenario — always last after all other work)

---

### TUTORIAL
**Trigger:** "add a tutorial", "walkthrough", "onboarding", "tutorial steps"
**Goal:** Produce 3-5 step tutorial steps for a feature

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `tutorial-author` | 3-5 brief steps, bullet-only, verb-led, no paragraphs |
| MANDATORY | `add-tutorial` | If building the full tutorial system (hook, overlay, page, badges) |

**Load order:** tutorial-author → add-tutorial (if building full system)

---

### LICENSE
**Trigger:** "create a LICENSE", "add license", "choose a license", "fix GitHub license detection"
**Goal:** Generate or audit license files

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `license-generator` | License selection workflow, SPDX rules, official templates, validation |

**Load order:** license-generator only (single-skill scenario)

---

### SQLITE MIGRATION
**Trigger:** better-sqlite3 version mismatch, native rebuild fails, cross-version Node/Electron compat
**Goal:** Use sql.js fallback for database operations

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `sqlite-js-migration` | 8-step migration to sql.js when native modules fail |

**Load order:** sqlite-js-migration only (single-skill scenario)

---

### AGENT REFLECT
**Trigger:** User corrects behavior ("never do X", "always Y"), session boundary/context compaction, after complex tasks, after discovering non-obvious solutions
**Goal:** Permanently encode learnings into agent definitions and configuration files

| Priority | Skill | Why |
|----------|-------|-----|
| MANDATORY | `agent-reflect` | Signal detection, confidence levels, platform mapping, reflection logs, AGENTS.md updates |
| RECOMMENDED | `context-handoff` | When handing off in-flight context mid-session (state continuity between session boundaries) |

**Load order:** agent-reflect → context-handoff (if handing off mid-session)

---

### GENERAL DEVELOPMENT
**Trigger:** Any development task not covered by the categories above
**Goal:** Ensure all applicable skills are still considered

| Priority | Skill | Why |
|----------|-------|-----|
| RECOMMENDED | `humancentred-UIUX` | If any UI/UX is touched, even tangentially |
| RECOMMENDED | `max-security` | If code touches security-sensitive areas |
| RECOMMENDED | `maintain-context` | After any code change, assess severity |

## 4. Load Ordering Rules

0. **`multi-agent-coordination` loads FIRST, always, for any write.** It gates every
   other category: you cannot register, claim, or build until you know who else is live.
   Load it before FIX / DESIGN / COMMIT / TESTING.
1. **MANDATORY skills in specified order first.**
2. **RECOMMENDED skills after mandatory, in order listed.**
3. **`maintain-context` is ALWAYS last** — it syncs knowledge after all changes are done.
4. **`humancentred-UIUX` is almost NEVER optional** — if the task touches ANY UI (even a console.log or error message that a human reads), load it.
5. **`max-security` loads after design skills** — review the generated code, not the design decisions.
6. **When two categories overlap** (e.g., a fix that also changes UI), load skills from BOTH categories. MANDATORY skills from each apply.
7. **`paint` is a superseding entry point.** If the task is design-shaped, `paint` replaces the
   DESIGN category's skill list entirely — do not also load design sub-skills by hand.
8. **Conflict authority (design only):** `design/design.md` (LAMINAR) → live tokens in
   `src/index.css` → registry conventions → `paint` phase order → the sub-skills. When a
   sub-skill contradicts LAMINAR, LAMINAR wins and the sub-skill is noted as stale.

## 5. Anti-Patterns — what NOT to do

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| Start coding a UI without loading any design skills | Load `paint` — it loads the whole design stack in the correct order |
| Load design sub-skills directly, skipping `paint` | Load `paint`. It is the only skill that knows which of the other eleven to believe |
| Copy a hardcoded palette or radius out of a skill into code | Read the live tokens from `src/index.css`, then apply LAMINAR (`design/design.md`) |
| Write custom markup when a registry already has the component | Call the MCP (PAINT phase P3) — search, view source, then re-skin |
| Animate everything, or skip the Liveliness Level | Pick L1/L2/L3 first (`motion-alive` STEP 0), then stay inside its budget |
| Ship without empty/loading/error states | PAINT P5 + Gate D — five states per data-driven element |
| Fix a bug from PROBLEMS.md without loading `fix-problems` | Always load `fix-problems` for the workflow gates (user confirmation, status updates) |
| Commit code without loading `commit` | `commit` enforces `git add -A`, exhaustive messages, COMMITS.md |
| Ship code without loading `max-security` | Security review catches injection, crypto, auth, config issues |
| Write a prompt for external AI without loading `generate-prompt` | `generate-prompt` enforces verbatim copy, CONTEXT_BUNDLE.md, RESULT.md rules |
| Test UI with only IPC probes | Test the real rendered UI — button clicks, state changes, console logs |
| Make code changes and skip `maintain-context` | Graphify + vault + state.md go out of sync |
| Ignore a user correction without loading `agent-reflect` | The same mistake will repeat across sessions |
| Edit source, build, or commit without loading `multi-agent-coordination` | Register → `status` → `claim` first. An agent that skips this collides silently |
| Run `npm run build` / `npm start` bare | Use `run-exclusive.mjs` — concurrent builds corrupt `dist/` and cause black screens |
| `git add -A` in a shared repo | Stage explicit paths; `-A` swallows other agents' half-finished work under your message |
| "Fix" a file with uncommitted changes you didn't make | It belongs to a live agent. Report it; never `git checkout` / `git restore` it |
| Treat `coord.mjs` exit code 0 as proof it ran | Confirm it PRINTED (`status` → `AGENTS (n)`). Empty output = the tool is a no-op |
| Load ALL skills at once for every task | Only load what the category mandates — overloading wastes context |
| Assume a single skill is enough for a UI task | Design tasks need MULTIPLE skills working together (infra + tokens + UX + motion) |
| Use a visual mechanic without checking semantic fit | Every mechanic MUST map to the page's information type per DESIGN_SYSTEM_CONTEXT.md §3 |

## 6. Skill activation checklist (run mentally before ANY task)

- [ ] Identify task category from Decision Tree (§2)
- [ ] If the category is DESIGN — did you load `paint` (not the sub-skills)?
- [ ] Read the MANDATORY skills for that category (§3)
- [ ] Load them in the specified order
- [ ] Check if RECOMMENDED skills apply to task scope
- [ ] If `paint` is loaded — did its phases P0-P7 run in order, and did Gate A-Gate F pass?
- [ ] If `paint` is loaded — was at least one MCP called to source real components?
- [ ] Is `maintain-context` queued for after code changes?
- [ ] Is `max-security` loaded if the task touches auth/crypto/DB/IPC?
- [ ] If multiple categories overlap, are MANDATORY skills from EACH category loaded?

## 7. Self-Maintenance — the Router must never go stale

User rule (explicit): the skill router skill itself must be CONTINUOUSLY UPDATED when
there are new skills. A stale Router is the #1 cause of "why do you never use the
skills properly" rage.

1. **Same-cycle sync:** every time a NEW skill is added to `agent/skills/`, update
   this file in the SAME cycle — Decision Tree category, scenario table, load order.
   **If it is a DESIGN skill, also update `agent/skills/paint/SKILL.md`** (its `requires:`
   list, the pipeline table, and the phase that owns it) and the relevant row in
   `agent/skills/paint/references/skill-playbooks.md`. The Router points at `paint` for all
   design work, so a design skill added without updating `paint` is effectively invisible.
2. **Stale-detection:** if you know a skill exists on disk (glob
   `agent/skills/*/SKILL.md`) that this Router does not mention, update the Router
   IMMEDIATELY, then load it. Never work around a stale Router.
3. **Dead-reference check:** never keep a MANDATORY row pointing at a skill that was
   deleted — repoint it at the replacement (docs section, protocol, or MCP server).
4. Bump the version in the title on every sync.

**Sync checklist (run whenever you touch `agent/skills/`):**
- [ ] `glob agent/skills/*/SKILL.md` and diff against every skill name mentioned in §3
- [ ] Add missing skills with a one-line "Why" and correct priority (MANDATORY/RECOMMENDED)
- [ ] Update the category's **Load order** line
- [ ] Remove or repoint dead references (deleted skills, renamed skills)
- [ ] Bump version in the title; update AGENTS.md §1c only if the flow itself changed
- [ ] For any DESIGN skill change: `paint/SKILL.md` (requires + pipeline + phase owner) and
      `paint/references/skill-playbooks.md` updated in the same cycle
- [ ] For any MCP or `components.json` registry change: `paint/references/mcp-routing.md` updated
- [ ] For any LAMINAR version bump (`design/design.md`): the override notes in
      `paint/references/conflict-resolution.md` re-verified against the new sections

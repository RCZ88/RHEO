---
id: ai-collaboration-bridge
name: AI Collaboration Bridge
category: design
applicable_to: [ideas, features, architecture, planning, cross-ai-communication]
version: 1.0.0
created: 2026-07-21
updated: 2026-07-21
tags: [collaboration, cross-ai, ideation, context-bridge, multi-turn]
inputs:
  - name: User Idea
    type: textarea
    required: true
    description: The user's raw idea, concept, or feature request — copied verbatim
    source: user
    group: Content

  - name: Collaboration Mode
    type: enum
    choices: [idea-to-feature, problem-solving, architecture-design, refactor-plan, bug-investigation]
    default: idea-to-feature
    required: true
    description: What kind of collaboration this is
    source: user
    group: Basic

  - name: Target AI
    type: enum
    choices: [claude, gpt-4, gemini-2.5, deepseek, custom]
    default: claude
    description: Which AI model will receive the collaboration package
    source: user
    group: Basic

  - name: Existing Context
    type: file
    required: false
    description: Any existing context the user has already prepared (docs, notes, previous RESULT.md, etc.)
    source: user
    group: Content

  - name: Scope Boundary
    type: enum
    choices: [frontend-only, backend-only, fullstack, infrastructure, ui-ux-only, db-only]
    default: fullstack
    description: What parts of the stack this idea touches
    source: user
    group: Basic

  - name: Conversation Depth
    type: enum
    choices: [single-exchange, multi-turn-3, multi-turn-5, iterative-until-complete]
    default: multi-turn-3
    description: How many back-and-forth rounds expected
    source: user
    group: Advanced

  - name: Detail Level
    type: number
    min: 1
    max: 10
    step: 1
    default: 7
    widget: slider
    description: How detailed the collaboration should be
    source: user
    group: Advanced

  - name: Auto-Gather Context
    type: boolean
    default: true
    description: Automatically scan codebase for relevant files
    source: system
    group: Advanced

  - name: Max Context Tokens
    type: number
    min: 2000
    max: 16000
    step: 1000
    default: 8000
    widget: slider
    description: Maximum token budget for the context bundle
    source: user
    group: Advanced

  - name: Include Frontend Skills
    type: boolean
    default: true
    description: Include frontend design skill references in the prompt
    source: system
    group: Advanced

outputs:
  - name: Context Bundle
    type: file
    description: Self-contained codebase reference for the target AI
    preview: true
  - name: Initial Prompt
    type: markdown
    description: The first message sent to the target AI
    preview: true
  - name: Conversation Protocol
    type: markdown
    description: Rules for how the two AIs communicate back-and-forth
    preview: true
  - name: Context Gap Analysis
    type: markdown
    description: What context is missing and how to obtain it
    preview: false
  - name: Follow-up Plan
    type: list
    description: Anticipated questions from target AI and prepared responses
    preview: false

components:
  - name: Raw Idea Block
    description: User's verbatim idea section (always included)
    source: user
  - name: Context Bundle
    description: Gathered codebase context with exact source code
    source: system
  - name: Initial Prompt Template
    description: Structured first message with idea + context + gaps + protocol
    source: system
  - name: Conversation Protocol
    description: Back-and-forth rules, question formats, response patterns
    source: system
  - name: Gap Analyzer
    description: Identifies missing context and creates a fetch plan
    source: system
---

# 🤝 AI Collaboration Bridge — From Idea to Implementation

## Core Philosophy

**This is not a prompt. This is a conversation starter.**

The `generate-prompt` skill solves problems by packaging them into a one-way brief. The `ai-collaboration-bridge` skill establishes a **two-way communication channel** between three parties:

### 3-Party Roles (Real-World Setup)

| Role | Who | Responsibility |
|------|-----|----------------|
| **CZ (Human)** | The user | Relay messages between the two AIs. Copy-paste output from one into the other. Does NOT edit AI messages. |
| **Project Owner (opencode)** | The coding agent running in this codebase | Knows the codebase. Gathers context. Writes artifacts to `agent/docs/`. Answers REQUEST questions with CONTEXT responses containing actual source code. |
| **Specialist (External AI)** | Claude / GPT-4 / Gemini / etc. | Does NOT have codebase access. Debugs the problem or designs the solution. Asks REQUEST questions. Produces RESULT.md. |

### How Communication Works

```
1. CZ tells opencode: "collaborate with [external AI] on [bug/idea]"
2. opencode writes INITIAL_PROMPT.md (with full source code EMBEDDED — external AI has no file access)
3. CZ copies INITIAL_PROMPT.md content → pastes into external AI chat
4. External AI responds with REQUEST questions
5. CZ copies REQUEST → pastes into opencode chat
6. opencode answers with CONTEXT (actual source code)
7. CZ copies CONTEXT → pastes into external AI chat
8. Repeat 4-7 until external AI produces RESULT.md
9. CZ copies RESULT.md → pastes into opencode chat
10. opencode implements the fix
```

**Key principle:** The initial package must contain ALL relevant source code inline — the external AI has zero codebase access. The Specialist drives the conversation by requesting specific files or clarifications. The Project Owner fetches them. This iterative refinement produces a far better result than a single monolithic prompt.

## How This Differs from `generate-prompt`

| | `generate-prompt` | `ai-collaboration-bridge` |
|---|---|---|
| **Trigger** | AI coding agent hits a technical wall | User has a new idea or concept |
| **Direction** | One-way: problem → solution | Two-way: idea ↔ refinement ↔ solution |
| **Context** | Agent gathers everything upfront | Agent gathers source code inline; Specialist asks for rest |
| **Output** | Single RESULT.md | Conversation thread + final RESULT.md |
| **User role** | Passive (agent handles everything) | Active relay — copy-pastes between two AIs |
| **Best for** | Bug fixes, refactors, layout fixes | New features, architecture decisions, complex designs |
| **External AI access** | N/A (single AI) | Zero — all source code must be embedded in messages |

---

## MANDATORY: Two-Case Validation Framework

Before using this skill, determine which case applies:

### Case 1: Raw Idea → Collaboration
**You have an idea in your head. Nothing is written yet.**

Workflow:
1. User describes the idea verbally/raw
2. AI coding agent uses this skill to analyze the idea
3. Agent creates Context Bundle from scratch (scanning codebase)
4. Agent crafts Initial Prompt
5. Agent sends to Specialist AI
6. Back-and-forth begins

### Case 2: Existing Context → Collaboration Continuation
**You already have partial context, a previous RESULT.md, or an ongoing conversation.**

Workflow:
1. User references existing work ("continue from where we left off with the sidebar")
2. AI coding agent loads existing context
3. Agent performs **Context Gap Analysis** — what does the Specialist ALREADY know vs. what changed?
4. Agent creates a "delta context bundle" with only new/changed code
5. Agent crafts a "continuation prompt" that references previous work
6. Back-and-forth resumes from where it left off

**The skill MUST handle both cases. It must detect which case applies and adapt its behavior.**

---

## Phase 1: Idea Analysis & Context Gap Detection

### Step 1 — Parse the Raw Idea

Extract from the user's input:
- **Core concept**: What is the user trying to build? (1 sentence)
- **Motivation**: Why do they want this? What problem does it solve?
- **User-facing behavior**: What should the user see/do?
- **Technical hints**: Any technologies, patterns, or constraints mentioned?
- **Scope boundaries**: What is IN scope vs. OUT of scope?

### Step 2 — Map Idea to Codebase

Scan the codebase for:
1. **Existing similar features** — "We already have X, this is like X but with Y"
2. **Touch points** — Which files/modules will need modification?
3. **Dependencies** — What IPC channels, DB tables, services are involved?
4. **Design system impact** — New components? New tokens? New patterns?

### Step 3 — Context Gap Analysis

Create a table:

```
| Context Needed | Status | Location | How to Obtain |
|----------------|--------|----------|---------------|
| DB schema for sessions | ✅ Have | src/db/schema.sql | Already in bundle |
| IPC channel for new feature | ❌ Missing | Need to check preload.ts | Agent must fetch |
| Design tokens for new UI | ⚠️ Partial | tailwind.config.js | Include relevant section |
| User flow for similar feature | ✅ Have | src/pages/ExistingPage.tsx | Already in bundle |
```

**Rule:** If a gap exists, the Initial Prompt must explicitly say: *"We do not yet have [X]. If you need it, ask and we will fetch it."*

---

## Phase 2: Context Bundle Assembly

### Same Strict Requirements as `generate-prompt`

The Context Bundle MUST include actual source code, not descriptions. For every file the idea touches:

1. **Full TypeScript interfaces** — exact fields, types, defaults
2. **Full function implementations** — actual code with line numbers
3. **End-to-end IPC wiring** — one complete working channel example
4. **DB access patterns** — actual prepared statements, transactions
5. **Result/error wrapper types** — exact pattern used
6. **Current UI component source** — full JSX, props, states
7. **Design tokens** — actual hex codes, font stacks, spacing
8. **AI/provider call chain** — actual streaming/non-streaming code
9. **Database schema** — actual CREATE TABLE statements
10. **State management** — actual useState/useReducer declarations

### Case 2 Special Handling: Delta Bundles

If continuing from existing context:
- Include the **previous RESULT.md** or conversation summary
- Include only **changed files** since last exchange
- Include a "State Diff" section: "Since last conversation, these files changed: ..."
- Reference previous decisions: "In Round 2, we decided X. Here is the implementation."

---

## Phase 3: Initial Prompt Crafting

The Initial Prompt is the **first message** the Project Owner sends to the Specialist. It must be structured so the Specialist immediately understands:

1. **What the idea is**
2. **What context they have**
3. **What context is missing**
4. **How to ask for more context**
5. **What the expected output format is**

### Initial Prompt Structure

```markdown
# Collaboration Request: [Idea Title]

## Your Role
You are the Specialist AI. I am the Project Owner AI. I know the codebase; you know how to design and architect solutions. We will collaborate through a structured back-and-forth to refine this idea into an implementable specification.

## The Idea
[User's verbatim idea, cleaned up but preserving intent]

## Current Context (What I Have)
[Summary of attached Context Bundle]
- Project: [name, stack, architecture]
- Relevant files: [list with one-line descriptions]
- Existing patterns: [what conventions are already in use]

## Context Gaps (What I Don't Have Yet)
[List of missing context with labels]
- "If you need to see the IPC handler for X, ask and I will fetch it"
- "If you need the full DB schema, ask and I will include it"
- "If you need to see how Y component renders, ask and I will paste it"

## Conversation Protocol
**How we communicate:**

1. **You ask specific questions.** Format: `REQUEST: [specific file, schema, or clarification]`
2. **I fetch and respond.** Format: `CONTEXT: [file path]
[actual source code]`
3. **You refine your understanding.** Ask follow-ups or propose a design.
4. **When ready, you produce RESULT.md.** Format follows our standard specification.

**Rules:**
- Do NOT assume context you don't have. Ask for it.
- Do NOT design for features whose backend doesn't exist. Flag them.
- Do NOT produce a monolithic answer. Iterate with me.
- When you need to see code, ask for the EXACT file path.

## Scope
- IN: [what's included]
- OUT: [what's excluded]

## Expected Output
After our conversation converges, produce:
1. **RESULT.md** — The complete design specification
2. **Implementation Plan** — File-by-file changes
3. **Backend Audit** — Any missing IPC/services/DB schemas flagged

## First Question
[The Project Owner asks an opening question to start the conversation, OR leaves it open for the Specialist to begin]
```

---

## MANDATORY: Copy The Artifact To The Clipboard

**A prompt file CZ cannot paste is a prompt file CZ will not use.** The point of
this skill is that CZ copies the artifact into an external AI chat. Do not stop
at writing the file - put it on the clipboard in the same breath and say so.

### Single source of truth

The implementation lives at **`scripts/prompt-copy`** in the repo. Do NOT write
a private helper, do NOT re-implement the logic, and do NOT copy it into a skill.

```bash
prompt-copy <name>            # by folder PREFIX, from any directory
./scripts/prompt-copy <name>  # direct, if not on PATH
prompt-copy list [filter]     # discover targets; filter is a substring match
```

**Targets are DISCOVERED from `agent/docs/generate-prompt-docs/*/` AND
`agent/docs/backandfourth-docs/*/`, not declared in the script.** Each folder
contributes its `PROMPT.md` (or `INITIAL_PROMPT.md`), `CONTEXT_BUNDLE.md` and
`RESULT.md` when present.

> **Why the two trees.** A live back-and-forth folder names its ask
> `INITIAL_PROMPT.md` (see Output Artifacts below), which does NOT match the
> `prompt*.md` glob a single-tree discovery would use — so the folder listed but
> copied **nothing**, silently. The helper now matches both `prompt*.md` and
> `*_prompt.md`. If you ever add a third artifact filename here, it must be added
> to BOTH `discover()` and `files_for()` in `scripts/prompt-copy`: they are two
> separate globs and a folder that discovers but does not bundle is worse than one
> that never appeared.

```bash
prompt-copy life-habits   # -> life-habits-gold-dedup-13102026
```

An ambiguous prefix fails loudly and prints the candidates rather than guessing —
a wrong paste into an external AI costs more than a retyped word.

> This replaced an earlier `scripts/spec-copy` that carried five hard-coded target
> arrays while the docs tree held ~250 prompts, so the command could reach almost
> nothing and every new spec needed a code edit to become copyable. Discovery is
> why that coupling is gone: **writing a prompt folder is sufficient to make it
> copyable.** `scripts/spec-copy` and its `~/.local/bin` symlink were **deleted**
> on 2026-10-14 — `prompt-copy` is the only command. Do not recreate it.

Discovery matches the prompt filename **case-insensitively**. Most folders ship
lowercase `prompt.md`, and a case-sensitive `find` hid ~a third of the library
(164 of 241 folders) with no error to indicate it.

`RESULT.md` is deliberately **excluded** from the copy. It is the *reply* from a
previous run; pasting it beside the brief hands the AI finished work instead of
the question.

```bash
prompt-copy list [filter]   # numbered list, filter is a substring match
prompt-copy get <ID|slug>   # copy by number or exact folder name
prompt-copy <prefix>        # copy by unique prefix; ambiguous ones list candidates
prompt-copy pick            # interactive: shows the list, type a number
prompt-copy path/to/folder  # any folder or file, registered or not
```

### Rules for the helper (learned the hard way - do not simplify these away)

1. **Never name the helper after a binary it calls.** Naming it `wl-copy`
   shadowed `/usr/bin/wl-copy`, so `command -v wl-copy` resolved to the helper
   itself: infinite self-recursion until bash hit its level limit, ~15k lines of
   output. A helper that shares a name with its dependency is a trap.
2. **Resolve symlinks before computing the repo root.** Invoked via
   `~/.local/bin/`, `${BASH_SOURCE[0]}` is the symlink, so `dirname/..` yields
   `$HOME` and every path reports MISSING. Use `readlink -f` first.
3. **Never carry the payload through a pipeline.** `cmd | clip` reports the status
   of `cmd`, not of the clipboard writer, so a failed copy reported success for
   several minutes. Stage to a temp file, check status, *then* copy.
4. **Absolute paths for the clipboard binary**, never `command -v`.
5. **Run `wl-copy` in the FOREGROUND, with stdin attached, and WITHOUT
   `--paste-once`.** This rule was previously backwards and shipped a silent
   data-loss bug: `--paste-once` makes `wl-copy` exit before it takes ownership of
   the Wayland selection, so **nothing is ever pasted** — while the script
   discarded the tool's output, checked only its exit status, and cheerfully
   reported `copied N bytes` over an empty clipboard. Two related traps: `&` /
   `disown` backgrounds the daemon whose offer is never served (same symptom), and
   `</dev/null` feeds it an empty selection (same symptom). `wl-copy` daemonises by
   itself and the parent returns immediately, so running it in the foreground does
   NOT hang the caller — verified, not assumed. There was never a hang to prevent.
6. **Test the invocation CZ will actually use** - by bare name through the
   symlink, from `$HOME`. Testing `./scripts/prompt-copy` from the repo root passes
   while the real invocation fails. This is not hypothetical; it shipped broken.

### Verify before reporting

Run it with `timeout`, confirm it returns promptly and reports a **non-zero byte
count**. That is necessary but **NOT sufficient** — it only proves the script read
its files. Then **paste it back and compare real clipboard bytes**:

```bash
cd ~ && timeout 30 prompt-copy <target>     # must return promptly
sleep 1
GOT=$(timeout 10 /usr/bin/wl-paste --no-newline 2>/dev/null | wc -c)
# GOT must be non-zero AND match the byte count the script reported
**THE CLIPBOARD IS GLOBAL AND CONTENDED** — many agents share it. Do **not** run
`prompt-copy` speculatively: a copy nobody pastes is a prompt another agent loses.
Give CZ the command and let CZ run it, and copy/paste promptly — a long gap is a race.

```

**Never report success from the script's own exit status.** That is exactly how
the empty-clipboard bug survived: it exited 0 and printed a plausible byte count
while the clipboard held nothing, so CZ pasted nothing into the external AI.

**Stale `wl-copy` daemons corrupt the measurement.** Each owns the selection and
serves one paste, so a leftover daemon from an earlier run returns old content and
a fresh copy looks broken. Inspect, then kill only ones you started:

```bash
ps -eo pid,etimes,args | grep -E "[w]l-copy|[x]clip"
kill <those pids>
```

Zero bytes is a failure, not a success. If you cannot verify end to end,
report `NOT VERIFIED` - never `PASS` because the script compiled.


## Phase 4: Conversation Protocol Design

This is the "rules of engagement" document. All three parties follow it.

### Communication Flow

```
External AI ←→ CZ (Human) ←→ opencode (Coding Agent)
```

CZ relays messages **verbatim** between the two AIs. Do not summarize or edit.

### Specialist AI (External — has NO codebase access) Rules

1. **Start with questions, not answers.** Before proposing a design, identify 3-5 specific context gaps.
2. **Use REQUEST format:**
   ```
   REQUEST: src/services/SessionService.ts — I need to see how sessions are created to design the new flow.
   ```
3. **Ask one thing at a time.** Don't request 10 files at once. Iterate.
4. **Flag backend gaps immediately.** If you need an IPC channel that doesn't exist, say so.
5. **When converged, produce RESULT.md** following the exact format from `generate-prompt` skill.

### Project Owner AI (opencode — has full codebase access) Rules

1. **Embed ALL source code in INITIAL_PROMPT.md.** The external AI has zero file access — every relevant file must be pasted inline.
2. **Fetch exactly what was requested.** Don't send extra files "just in case."
3. **Use CONTEXT format:**
   ```
   CONTEXT: src/services/SessionService.ts (lines 45-89)
   [actual source code pasted here]
   ```
4. **If a file doesn't exist, say so.** Don't make up code.
5. **If the request is ambiguous, ask CZ to clarify with the Specialist.**
6. **Track the conversation state.** Write each round to `conversation/round-XX.md`.

### CZ (Human — relay) Rules

1. **Copy-paste verbatim.** Do not summarize, edit, or rephrase AI messages.
2. **Paste INITIAL_PROMPT.md** into the external AI chat to start.
3. **Paste each REQUEST** from external AI → into opencode chat.
4. **Paste each CONTEXT** from opencode → into external AI chat.
5. **When external AI produces RESULT.md**, paste it into opencode chat for implementation.

### Conversation State Tracker

opencode maintains this in `conversation/round-XX.md`:

```
Round 1:
- Specialist asked for: [X]
- We provided: [Y]
- Decisions made: [Z]

Round 2:
- Specialist asked for: [A]
- We provided: [B]
- Decisions made: [C]

Convergence status: [ongoing / ready for RESULT.md]
```

---

## Phase 5: Execution & Back-and-Forth Management

### When to Stop the Conversation

Stop when ANY of these are true:
1. The Specialist says: "I have enough context to produce RESULT.md"
2. The Specialist has asked for context 3 times and received it each time
3. The conversation has gone 5 rounds without new questions
4. The user explicitly says "that's enough, produce the result"

### How to Produce the Final Package

When converged, the Specialist produces:
1. **RESULT.md** — Complete design spec (same format as `generate-prompt`)
2. **Context Bundle Used** — List of all files referenced during conversation
3. **Backend Gaps** — Any missing backend that needs separate implementation

The Project Owner then:
1. Saves RESULT.md verbatim (per `generate-prompt` Rule 1)
2. Runs the three-phase post-result workflow (per `generate-prompt` Phase 1-3)
3. Implements or delegates implementation

---

## Terminal Workspace Integration Notes

This skill is designed to work WITHIN the DeskFlow terminal workspace. The 3-party relay model:

### How Context Flows

1. **opencode reads the codebase** — gathers relevant files, reads `src/`, `agent/`, etc.
2. **opencode writes INITIAL_PROMPT.md** — ALL source code embedded inline (external AI has no file access)
3. **CZ copy-pastes** INITIAL_PROMPT.md → external AI chat
4. **External AI responds** with REQUEST questions
5. **CZ copy-pastes** REQUEST → opencode chat
6. **opencode answers** with CONTEXT (actual source code from codebase)
7. **CZ copy-pastes** CONTEXT → external AI chat
8. **Repeat** until external AI produces RESULT.md
9. **CZ paste** RESULT.md → opencode chat
10. **opencode implements** the fix

### Skill Invocation

When the user says "collaborate with [AI] on [X]":

```
User: "collaborate with Claude on the sidebar bug"
→ Agent detects: this is a collaboration request
→ Agent invokes: ai-collaboration-bridge skill
→ Agent asks: "Which external AI? (Claude, GPT-4, Gemini, etc.)"
→ User selects target
→ Agent reads codebase, gathers context
→ Agent writes INITIAL_PROMPT.md with all source code embedded
→ Agent presents: "INITIAL_PROMPT.md is ready. Copy its content into your [external AI] chat."
→ CZ relays back-and-forth between the two AIs
→ External AI produces RESULT.md
→ CZ pastes RESULT.md into opencode
→ opencode implements
```

---

## Anti-Patterns (What NOT To Do)

1. **Don't send file paths without code.** The external AI has zero codebase access — embed ALL source code inline.
2. **Don't let the Specialist hallucinate APIs.** If it asks for a file, provide it. If the file doesn't exist, say so.
3. **Don't skip the Context Gap Analysis.** You must know what you DON'T have.
4. **Don't produce RESULT.md in Round 1.** The first output from the Specialist should be QUESTIONS, not answers.
5. **Don't lose conversation state.** Track what was decided in each round.
6. **Don't let CZ edit AI messages.** Relay must be verbatim — any rephrasing loses technical precision.
7. **Don't assume the Specialist remembers context.** Each message must be self-contained.

---

## Output Artifacts

After running this skill, the following files should exist:

```
agent/docs/backandfourth-docs/<idea-slug>/
├── CONTEXT_BUNDLE.md          # Gathered codebase context
├── INITIAL_PROMPT.md          # First message to Specialist
├── CONVERSATION_PROTOCOL.md   # Rules of engagement
├── CONTEXT_GAPS.md            # Gap analysis table
├── conversation/
│   ├── round-01.md            # Specialist questions + Owner responses
│   ├── round-02.md
│   └── ...
└── RESULT.md                  # Final converged specification
```

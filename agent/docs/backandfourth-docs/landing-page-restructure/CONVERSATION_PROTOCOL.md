# CONVERSATION PROTOCOL — RHEO Landing Page Restructure

> All three parties follow these rules. CZ relays **verbatim** — no summarising,
> no rephrasing. Any edit loses technical precision.

## Parties

| Role | Who | Responsibility |
|---|---|---|
| **CZ (Human)** | The user | Relays messages between the two AIs. Copy-paste only. Does NOT edit AI messages. |
| **Project Owner (opencode)** | Me, in the codebase | Knows the codebase. Gathers and pastes source inline. Answers `REQUEST` with real `CONTEXT`. |
| **Specialist (GLM)** | Your external chat | No file access. Reviews implemented work. Asks for what it needs. Produces `RESULT.md`. |

## Flow

```
1. CZ pastes INITIAL_PROMPT.md        → GLM
2. GLM replies with REQUEST questions  → CZ
3. CZ pastes REQUEST                   → opencode
4. opencode replies CONTEXT (source)   → CZ
5. CZ pastes CONTEXT                   → GLM
6. repeat 2-5 until GLM produces RESULT.md
7. CZ pastes RESULT.md                 → opencode
8. opencode implements
```

## Specialist (GLM) — Rules

1. **Start with questions, not answers.** Before proposing anything, list 3–5
   specific context gaps.
2. **Use `REQUEST:` format**, one at a time. Do not request 10 files at once.
   Ask for the **exact file path**.
3. **Flag unverified claims immediately.** If I assert something was "verified",
   ask what tool verified it and what its output was.
4. **Say when you are guessing.** Do not present inference as fact.
5. **Name deletions.** If something should be cut, name the file and say so.
6. **When converged, produce `RESULT.md`** in the format of
   `agent/skills/generate-prompt/SKILL.md`.

## Project Owner (opencode) — Rules

1. **Paste real source inline.** The Specialist has zero file access. A file
   path without the code is a wasted round trip.
2. **Fetch exactly what was requested.** No "just in case" files.
3. **Use `CONTEXT:` format:**
   ```
   CONTEXT: src/components/rheo/Gallery.tsx (lines 40-67)
   [actual source]
   ```
4. **If a file does not exist, say so.** Never invent code.
5. **Do not defend work I think is wrong.** If GLM is right that something is
   over-engineered or should be deleted, say so.
6. **Track state** in `conversation/round-XX.md`.

## CZ (Human) — Rules

1. **Copy-paste verbatim.** Do not summarise or edit AI messages.
2. **Paste INITIAL_PROMPT.md** to start.
3. **Paste each REQUEST** to opencode; **paste each CONTEXT** back to GLM.
4. **Paste RESULT.md** to opencode when it arrives.

## Voice

Both AIs write as **senior web developers reviewing work for a paying customer.**
Direct, specific, willing to disagree. No cheerleading. No filler. If a thing is
amateur, say it is amateur; if a thing is 1,200 lines solving nothing, say that.

## Convergence

Stop when the Specialist says it has enough, or after 5 rounds with no new
questions, or when CZ says stop.

## Artifacts

```
agent/docs/backandfourth-docs/landing-page-restructure/
├── INITIAL_PROMPT.md      Round 1 — pasted to GLM
├── CONTEXT_GAPS.md        What the Specialist does not know
├── CONVERSATION_PROTOCOL.md   this file
├── conversation/
│   ├── round-01.md        Specialist questions + Owner responses
│   └── ...
└── RESULT.md              final converged spec (from GLM)
```

## Post-Result Rules (inherited from `generate-prompt`)

1. **RESULT.md is RAW and UNTOUCHABLE.** Save it verbatim. Do not edit,
   summarise, or add commentary.
2. **Implement after analysis**, not during. Trace the codebase, identify gaps,
   plan, then implement.
3. **Removal MUST be confirmed.** If it proposes deleting anything, pause and
   ask CZ: *"RESULT.md proposes removing [X]. Can I proceed?"*
4. **Backup before every removal.** `cp file file.bak.<YYYYMMDD-HHMMSS>`.
5. **Never `git add -A`.** Other agents have uncommitted work in this tree.
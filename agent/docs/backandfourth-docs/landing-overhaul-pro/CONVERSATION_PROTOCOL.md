# Conversation Protocol — RHEO landing overhaul

The rules of engagement. All three parties follow these.

---

## 1. The flow

```
1. CZ tells opencode: "collaborate with [external AI] on the landing overhaul"
2. opencode writes INITIAL_PROMPT.md (source embedded inline — no file access)
3. CZ copies INITIAL_PROMPT.md → pastes into the external AI
4. External AI responds with REQUEST questions      ← expected, not a failure
5. CZ copies REQUEST → pastes into opencode
6. opencode answers with CONTEXT (real source)
7. CZ copies CONTEXT → pastes into the external AI
8. repeat 5–7
9. External AI produces RESULT.md
10. CZ pastes RESULT.md → opencode implements
```

**Key principle:** the external AI has **zero codebase access**. Every relevant file must
be pasted inline. The Specialist drives by requesting; the Project Owner fetches.

---

## 2. Specialist rules (external AI)

1. **Start with questions, not answers.** Before proposing a design, surface 3–5 specific
   context gaps.
2. **Use the `REQUEST:` format** — `REQUEST: <path> — <why you need it>`.
3. **Ask one thing at a time.** Do not request ten files at once.
4. **Flag backend gaps immediately.** If a spec claim needs an IPC channel, a CMS, or a
   feature that does not exist, say so before designing around it.
5. **Do not reopen closed decisions by accident.** The previous round closed a great deal
   deliberately — see `CONTEXT_BUNDLE.md` §7–§8. If you want to change one, name it and say
   why the original reasoning no longer holds.
6. **When converged, produce `RESULT.md`** in the format in `INITIAL_PROMPT.md`.

---

## 3. Project Owner rules (opencode)

1. **Answer with actual source, never description.** If the file exists, paste it. If it
   does not, say *"that file does not exist"* — never reconstruct it from memory.
2. **Fetch exactly what was requested.** No "just in case" bundles.
3. **Use the `CONTEXT:` format** — `CONTEXT: <path> (lines A–B)` then the code.
4. **Never fabricate a product fact.** If a claim needs a number or behaviour I cannot
   verify in the repo, say so and mark it as needing CZ.
5. **Track conversation state** in `conversation/round-XX.md` after each round.
6. **Respect §0-0 of the repo AGENTS.md: only CZ builds.** Every implementation claim is
   about `next dev`, never a production build.

---

## 4. CZ rules (relay)

1. **Copy-paste verbatim.** Do not summarise, edit or rephrase either side. Technical
   precision is destroyed by paraphrase.
2. Paste `INITIAL_PROMPT.md` to start.
3. Paste each `REQUEST` → opencode. Paste each `CONTEXT` → external AI.
4. Paste `RESULT.md` → opencode for implementation.

---

## 5. Conversation state

`opencode` maintains `conversation/round-XX.md`:

```
Round 1:
- Specialist asked for: [X]
- We provided: [Y]
- Decisions made: [Z]

Convergence status: [ongoing / ready for RESULT.md]
```

---

## 6. When to stop

Stop when **any** is true:

1. The Specialist says *"I have enough context to produce RESULT.md"*.
2. The Specialist has asked three times and received everything each time.
3. Five rounds pass without a new question.
4. CZ says *"that's enough, produce the result"*.

---

## 7. Anti-patterns

| Do NOT | Why |
|---|---|
| Send file paths without code | The Specialist has no access — embed inline |
| Let the Specialist hallucinate APIs | If it asks, provide it. If absent, say absent |
| Skip the gap analysis | You must know what you **don't** have |
| Accept `RESULT.md` in round 1 | The first output should be questions |
| Lose conversation state | Track every round |
| Let CZ paraphrase | Any rephrasing loses precision |
| Assume the Specialist remembers | Each message must be self-contained |

---

## 8. Output artifacts

```
agent/docs/backandfourth-docs/landing-overhaul-pro/
├── CONTEXT_BUNDLE.md          ✅ written
├── CONTEXT_GAPS.md            ✅ written
├── INITIAL_PROMPT.md          ✅ written — READY TO PASTE
├── CONVERSATION_PROTOCOL.md   ✅ this file
├── conversation/
│   └── round-01.md            ← created after the first REQUEST
└── RESULT.md                  ← the Specialist's converged output
```

**Status: awaiting CZ to paste `INITIAL_PROMPT.md` into the external AI.**
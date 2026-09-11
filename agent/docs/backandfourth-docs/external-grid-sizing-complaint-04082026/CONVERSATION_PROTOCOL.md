# Conversation Protocol — External Grid Sizing Complaint (Case 2)

## Roles

- **Project Owner (opencode / Hands & Eyes):** knows the repo, implements your RESULT.md, relays user feedback verbatim.
- **Specialist (Architect / Notion AI):** roots causes, designs the weight model + UI spec, writes RESULT.md v2.
- **CZ (human):** relays messages between the two AIs; the only human tester.

## Message format

| Direction | Format |
|---|---|
| Specialist → Owner | `REQUEST: [exact file path]` or `CLARIFY: [question]` — one per message |
| Owner → Specialist | `CONTEXT: [file path]` followed by the verbatim source; or `ANSWER: ...` |
| Either → User feedback | Always **Raw Idea Block** — verbatim quotes, never paraphrased |

## Ground rules

1. **No code in chat without context.** The Specialist has no repo access — every referenced function must be embedded verbatim in the message (see CONTEXT_BUNDLE.md for the full current grid files).
2. **Spec first, then diff.** RESULT.md v2 must be a DELTA against the previous RESULT.md (which is implemented and shipped).
3. **Implementation contract:** Owner implements exactly what RESULT.md v2 specifies. No owner-side "creative fixes" — if the Specialist wants a different approach, it goes in the spec.
4. **Verification contract:** Owner builds (vite PASS), runs dist gates, and — when the user has relaunched the app — verifies the grid visually. Until then, report NOT LAUNCHED rather than inventing results.
5. **User is the source of truth.** If the Specialist's design contradicts a verbatim user quote, the quote wins. Ask, don't assume.

## Decision: hierarchy control

The previous spec's `Subtle / Balanced / Dramatic` control was never built (grid.ts has no `hierarchy` option; ActivityMosaic has no control). The user's complaint is about proportionality, NOT about wanting drama presets. Proposed resolution to confirm with Specialist:
- Presets modulate a **proportional base model** (derived from `visualWeight` of real durations), not replace it with fixed fractions.
- If user feedback is negative again, the fallback is a plain `Range` slider ("Hierarchy") mapped onto the same proportional model.

## Escalation path

1. RESULT.md v2 implemented + build PASS → user visual check (needs CZ to relaunch the app).
2. If user still unhappy → new Raw Idea Block → new complaint package (fresh folder, new cycle).

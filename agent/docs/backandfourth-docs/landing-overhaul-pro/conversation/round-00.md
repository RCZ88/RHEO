# Round 0 — Package assembled

**Date:** 2026-10-14
**Status:** Awaiting CZ to paste `INITIAL_PROMPT.md` into the external AI.

---

## What was built

| File | Purpose | State |
|---|---|---|
| `CONTEXT_BUNDLE.md` | Every relevant source file embedded inline. Design contract, all five sections, the motion store, the rejected seam, the defect ledger, the two phantom defects already paid for. | ✅ |
| `CONTEXT_GAPS.md` | Have / don't-have table. 5 open gaps, 2 partial. | ✅ |
| `INITIAL_PROMPT.md` | The message CZ pastes into the external AI. Structured per the skill's Phase 3 template, with the verbatim idea, the honest diagnosis, 6 hard constraints, and an explicit "ask and I will fetch" gap list. | ✅ |
| `CONVERSATION_PROTOCOL.md` | Rules of engagement for all three parties. | ✅ |

---

## Decisions made in this round

1. **Case 2, not Case 1.** A previous GLM round already exists (`RESULT.md` v1.2, 46/48).
   This is a **delta bundle**: what changed, plus the raw source of every surface an
   overhaul would touch. Re-sending the previous round's framing would waste the
   Specialist's attention on closed decisions.

2. **The rejected seam is documented as a rejection, not an open question.** The prior
   verdict was *"perceptually unjudged… I decline to answer it."* The human answered it.
   Removal is the default; keeping it requires a named alternative that earns the slot.

3. **The six hard constraints are inlined into `INITIAL_PROMPT.md`, not referenced.**
   A Specialist who has never seen this repo will otherwise propose a colour-coded
   docs page with gradients, which violates the constitution on its first suggestion.

4. **The two phantom defects are carried forward as withdrawn.** `#act-record` "15px" and
   `#download` "310px" were static centring, not motion. If they are not explicitly marked
   withdrawn, the next round re-derives them and spends a cycle chasing a non-bug.

5. **The fabricated-readout history is included deliberately.** The `1,204,032 s` hero
   fixture and the placeholder SHA-256 are the reason the "no dead affordances" rule is
   stated as a constraint rather than a preference. It is a brand rule, not a style rule.

---

## Open gaps the Specialist will be asked about

| Gap | Owner |
|---|---|
| Which reference sites are the actual target | Specialist |
| Docs content: route vs. in-page section vs. hybrid | Specialist |
| CTA hierarchy for a no-download pre-launch product | Specialist |
| Layout token system (one width, one rhythm, one scale) | Specialist + me |
| Real numbers — section heights, LCP, bundle size | **CZ / probe** |
| Full source of `Nav`, `Ledger`, `FlowFieldCanvas`, `AsciiSurface` | Me, on REQUEST |

---

## Convergence status

**Ongoing.** Nothing has been sent to the Specialist yet.

**Next action:** CZ pastes `INITIAL_PROMPT.md` into Claude / GPT-4 / Gemini and pastes the
first `REQUEST:` back into opencode.
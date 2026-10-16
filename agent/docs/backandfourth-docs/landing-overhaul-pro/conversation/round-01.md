# Round 1 — Specialist's first reply

**Date:** 2026-10-14
**Convergence status:** ongoing — item 1 of 5 delivered, awaiting item 2.

---

## What the Specialist did

Opened with **questions and a reframe, not a design.** Correctly refused to answer
the brief as written. Five positions:

### 1. The reframe — "overhaul" may be avoidance

> *"when a page feels sloppy, 'add a huge feature' feels like progress, but it can also
> be a way to avoid the boring fixes. Do the boring fixes first, then add docs on a
> clean base."*

**This overrides my INITIAL_PROMPT ordering.** I proposed six deliverables with research
first and the docs feature as the centrepiece. The Specialist argues the three diagnosed
problems (no spacing system, unintelligible in ten seconds, one gimmick to cut) are
clarity and rhythm defects that a docs section does not fix. **Accept.** New sequencing:

```
1. plain-language hero + real screenshot      (cheapest, biggest win)
2. one spacing / rhythm / width system
3. remove the ASCII seam
4. THEN docs on the clean base
```

### 2. The hero does not say what the product is

Proposed replacement sentence, to be treated as a draft not a decision:

> *"RHEO is a private time tracker for your desktop. It records your day, keeps it in one
> file on your disk, and lets you ask questions about it."*

Plus a real screenshot beside it. **Accepted as direction.** I will not ship that exact
copy without a routing pass — "time tracker" is a commodity noun and the page's
differentiator is the reflection loop, so the sentence must carry both.

### 3. Docs are a good idea but only one kind

Docs for features that cannot be downloaded would be fabrication — banned by our own
rules. The truthful documentable surface is the differentiator:

- the SQLite file, what is stored in it
- what is never sent, and the mechanism that guarantees it
- how a "phase" is detected

**A spec of the data file is proof, and it is the best trust tool a local-first app has.**
Accepted — this is a better idea than the one I brought.

### 4. Reference picks (from memory, flagged as unverified)

| Pick | Attribute | Status |
|---|---|---|
| **Linear** | docs share the marketing shell, type and tone — one product | needs verification |
| **Obsidian help** | closest in philosophy (local files you own); starts with "what is stored where" | needs verification |
| **Vercel docs** | near-B/W, left nav, "on this page" rail, search | needs verification |

Explicitly **skipped:** Stripe, Notion, Figma, Raycast — "they lean on colour or
illustration, which breaks your monochrome rule." **Correct, and it is why I pre-flagged
the constraint in the prompt.**

### 5. Where docs live — hybrid

Keep the landing page as one scroll; add real `/docs/...` routes authored in-repo, no
CMS. Own URLs, own links, own search. A sticky-layer scrub section is the wrong host.

**Dependency flag raised, correctly:** MDX needs a new dependency and our rules require
a case. Proposal is **plain TSX content files**, which avoids it.

Scope for pre-launch: Docs (overview, privacy model, data file, phases), short FAQ,
changelog. **Skip pricing and roadmap** until something real is behind them. Accepted.

### 6. Defect flagged — and it is a real one

> *"your copy says 'join the waitlist.' Does that actually collect emails anywhere? If not,
> that is a dead affordance, the exact thing you cut elsewhere."*

**Verified. It is worse than asked.**

```
$ grep -rn "formspree|<form|onSubmit|type=\"email\"" src/
src/components/rheo/ActUnderstand.tsx:151   ← a COMMENT about a different deletion
(no matches)
```

- **No `<form>`, no `<input>`, no endpoint anywhere in the codebase.**
- `Download.tsx:100` promises *"Join the waitlist and we'll write once, the day it
  leaves preview."*
- The section's three buttons are `DOWNLOAD macOS / WINDOWS / LINUX` and they point at
  nothing.
- The heading is **OWN YOUR HOURS.**

So the final section of the page — the ask, the conversion — cannot collect an address
and cannot deliver a download. It survived every prior audit because it was audited for
*layout and motion*, never as an *affordance*. It is the same defect class as the
placeholder SHA-256 and the fake free-text input, both already cut.

**This is a release blocker independent of the redesign.** Recorded as ASSIGNED A3.

---

## What the Specialist needs, one at a time

1. ~~Full-page screenshots 1440 + 390, hero crops~~ ✅ **delivered this round**
2. `Ledger.tsx` — next
3. What the waitlist really does — **answered above; answer is: nothing**
4. Real product facts for the docs: DB schema, phase detection, what the AI cites
5. Real numbers: section heights, LCP, bundle size

---

## Ruling on sequencing

The Specialist's reframe is accepted and it **overrides the order I proposed.** The docs
feature does not move until items 1–3 of the new sequence are landed and verified. I
will say so explicitly in the next CONTEXT so the Specialist does not design docs against
a base that is about to move underneath it.
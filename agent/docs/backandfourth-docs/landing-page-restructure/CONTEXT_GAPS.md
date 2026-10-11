# CONTEXT_GAPS — What GLM Does Not Know

Case 2 (continuation): a `RESULT.md` already exists at
`agent/docs/generate-prompt-docs/landing-page-restructure-07102026/RESULT.md`
and has been implemented. GLM's starting point is **post-implementation review**,
not greenfield design.

## Gap Table

| Context Needed | Status | Location | How to Obtain |
|---|---|---|---|
| Full `Gallery.tsx` source | ⚠ Partial | `src/components/rheo/Gallery.tsx` | INITIAL_PROMPT §2 has the model + scroll logic only. **Ask for the rest.** |
| Full `AsciiSurface.tsx` source | ❌ Missing | `src/components/rheo/AsciiSurface.tsx` | Ask: `REQUEST: AsciiSurface.tsx full source` |
| `Ledger.tsx` full source | ❌ Missing | `src/components/rheo/Ledger.tsx` | Ask: `REQUEST: Ledger.tsx full source` |
| `RealFootage.tsx` current source | ❌ Missing | `src/components/rheo/RealFootage.tsx` | Ask — it grew 4 props (`plate`, `priority`, `pauseControl`, `width`/`height`) |
| `globals.css` gallery + ledger rules | ❌ Missing | `src/app/globals.css` | Ask — several hundred lines appended this session |
| Any rendered screenshot | ❌ **Critical** | — | **Cannot be provided by an agent.** §0-0 forbids building. CZ must run `npm run dev`. |
| The real RESULT.md | ⚠ Partial | `…/landing-page-restructure-07102026/RESULT.md` | Summarised in INITIAL_PROMPT §1–2. **Ask for any section.** |
| Design tokens | ⚠ Partial | `src/app/globals.css` lines 32–46 | Already in the earlier `CONTEXT_BUNDLE.md`. Ask if needed. |
| Per-section word counts, post-change | ❌ Missing | measured from curl | Ask: `REQUEST: word counts per section` |

## Rule

If a gap exists, the INITIAL_PROMPT must say so. It does — §8 asks GLM to
request anything, and §6 lists what is unverified.

## The Gap That Cannot Be Closed by Asking

**Nobody has seen this page render.** The single most valuable thing GLM can
receive is a screenshot, or the output of `curl -s localhost:3000/`. I cannot
produce the first; the second only works if CZ has `npm run dev` running.

GLM should treat every layout, spacing and visual judgement as **untested**, and
weight its response toward architecture, correctness, and what to delete — all of
which can be assessed from source alone.
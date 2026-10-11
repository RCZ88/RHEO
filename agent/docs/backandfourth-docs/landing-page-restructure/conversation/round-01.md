# Round 01

## Round 1: State at the time the bridge opened

**Specialist:** GLM (external chat, no codebase access)
**Project Owner:** opencode (in-repo)
**Relay:** CZ

### Opening brief

`INITIAL_PROMPT.md` pasted. It contained:

- §1 the measured before/after of the restructure (11 sections → 5, 43 `<img>` →
  17, ring deleted)
- §1.4 the full file change list
- §2 the carousel data model and scroll-position logic
- §3 **the direct answer to "is the ASCII there and what was it based on"**
- §4 the new trust Ledger
- §5 the γ0.6 measurement table, flagged do-not-undo
- §6 **seven self-declared concerns**, including the one nobody has closed:
  *the page has never been rendered*
- §8 five questions put to GLM

### Decisions already made (before this conversation)

| Decision | Rationale |
|---|---|
| 5 sections, not 6 or 11 | RESULT.md §1; the mount chain is the architecture |
| Gallery owns all 17 stills | §1.2 "a capture serves its section" |
| Orbit ring deleted (1,209 lines) | Duplicated the gallery; horizontal drag on a vertical page |
| 24 carousel rows → 17 screens | A recording is a *state*, not a row |
| No autoplay anywhere | WCAG 2.2.2 — >5s moving content needs a stop control |
| Native scroll-snap, no engine | `@kokonutui/carousel-cards` source confirmed it |
| γ = 0.6 | Measured across 17 captures; the only consistent value |
| Fake SHA-256 row removed | A verification affordance for an unverifiable number |
| 24h-timeline clip → `#act-record` only | Resolves a contradiction inside RESULT.md |

### Open questions put to GLM

1. Is the 5-section architecture right, or does it need a 6th?
2. Is the gallery too dominant at 1 of 5 sections?
3. Is the ASCII earning its place, or should it be cut?
4. Do the ledger's three facts convince, or read as fear-marketing?
5. **What should be deleted?**

### Convergence status

**Round 1 complete — awaiting GLM's REQUESTs.**

### Notes for the next round

- If GLM questions the γ0.6 value, paste
  `landing/scripts/probe-ascii-surface.mjs` and its output — do not argue.
- If GLM asks whether the ASCII is visible to users: it is the last block of
  `#gallery`, `mt-20`, so it is *below the fold* of a long section. That is a
  legitimate criticism and worth taking seriously.
- If GLM asks about the ring: the 21st.dev original is still on disk at
  `agent/docs/21st-dev-prompts/Orbit Flip Slider/PROMPT.md`. The deleted
  implementation is recoverable at commit **`e21b30f`** (or `7976272`):
  `git show e21b30f:landing/src/components/rheo/SurfaceOrbit.tsx`.
  It was removed in `4544604`.
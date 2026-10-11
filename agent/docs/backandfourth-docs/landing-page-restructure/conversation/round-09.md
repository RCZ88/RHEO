# ROUND 9 — 42/42 · your §2 bug was mine and is fixed · the lockfile was already clean

> **Paste to GLM.** You found a real precedence bug in CSS I shipped last round.
> It is fixed and red-tested. Two OWED lines closed, two remain, RESULT.md drafted
> with OWED populated — **not released, because OWED is not empty.**

---

## 1. Your attribution rule, applied — and the negative test now discriminates

You were right that my Round 8 experiment was the right test aimed at the wrong
assert. Pointed at the rest position:

```
PASS  tail settles at maxScroll - paddingRight at every width
      — 1280: 7213==7212.8 pad=51.2
        1440: 7206==7206.4 pad=57.6
        2048: 7200==7200.0 pad=64
```

Each width gets **its own context** — resizing the shared page mid-run would have
invalidated every assert measured before it. Input is neutral (`scrollTo(maxScroll)`,
never `goTo`'s target), the expectation is computed from live padding, and it settles
by polling until `scrollLeft` is stable across frames.

**Red-revert, mechanism only, compensation untouched:**

```
FAIL  1280: 7264==7212.8   1440: 7264==7206.4   2048: 7264==7200.0
```

It discriminates, and the three padding values were predicted live rather than
hardcoded — a hardcoded 7206 would have passed at 1440 and lied at the other two.

---

## 2. Your §2 bug was mine. It is fixed, and the matrix proves it.

The hole is closed in the two parts you specified.

**`writeMode` — checked before assuming, as you said.** It stamped `dataset.motion`
for **all three** modes including `auto`. Harmless *today* only because no rule
matched `"auto"`; once the `on` rule exists the semantics must be exact:

```ts
if (mode === "on" || mode === "off") document.documentElement.dataset.motion = mode;
else delete document.documentElement.dataset.motion;
```

**CSS** — `html[data-motion="on"] .hero-enter` restored, placed after the media query
so it wins on order *and* specificity.

### The matrix, three observers per row

```
auto + no OS reduce      : anim=hero-enter  (no stamp)  chip=rgb(244,244,245)
auto + OS reduce         : anim=none         (no stamp)  chip=rgb(138,138,148)
EXPLICIT on + OS reduce  : anim=hero-enter  stamp=on     chip=rgb(244,244,245)   <- was broken
EXPLICIT off             : anim=none         stamp=off    chip=rgb(138,138,148)
```

**4/4**, and in every row the framer path and the CSS path agree. That agreement is
the actual finding — before the fix, row 3 had framer animating while the media
query suppressed the hero, which is precisely the divergence you described.

**Red-revert** (the `on` rule removed):

```
EXPLICIT on + OS reduce  : anim=none  stamp=on  chip=rgb(244,244,245)
```

The framer consumer still says animate while CSS says none — the bug, caught.

`delete-on-auto` has its own assert and passes: auto rows carry **no attribute**.

**Two bugs in my own matrix check, both found by it being wrong first:** I compared
`null` to the string `"ABSENT"` (so the correct behaviour failed), and my
`MotionChip` selector matched nothing, so one of the two consumers was silently
absent for the whole matrix — an assert that quietly tests less than it claims.

---

## 3. REQUEST 4 — the tabs contract is complete, keyboard-verified

```
tab before="Deep work"  after ArrowRight="Learning"  focused=console-tab-learning
roving tabIndex per tab: -1,0,0  -> -1,0,-1  (one 0, rest -1)
panel aria-labelledby  : console-tab-learning
```

`id` + `aria-controls` on each tab, `role="tabpanel"` + `aria-labelledby` on the
panel, roving `tabIndex`, and ArrowLeft/ArrowRight that move selection **and**
focus. You were right that a half-written ARIA contract is the same defect class as
the inert motion row — the role asserted a behaviour the markup did not provide.

---

## 4. The lockfile: OWED line closed, and it was never broken

You listed it as a deploy blocker that had never been confirmed. **It is in sync.**

```
prisma / @prisma/client / embla-carousel-react
  package.json     : 0 occurrences
  package-lock.json: 0 occurrences
package-lock.json: 402 lines removed, 3 added (subtractive only)
```

The lockfile already carried the removal. I am closing that row rather than running
`npm install` to generate a no-op diff — but flagging that I checked the *content*,
not by running an install, so if you want the tool's own verdict, say so.

---

## 5. REQUEST 3 — NOT DONE, and it is the honest gap in this round

**The five-section sampler under two conditions was not run.** It is hero-only and
OS-reduce-only on the board. The store-off condition — which you correctly identified
as the least-tested path on the page, where the wrong-hook class lives — has **no
measurement at all**.

I stopped rather than half-build it, because a second unverified mechanism in the
same round is the Round 6 failure mode and you set one-in-flight as the limit. It is
OWED row 1 with its converting check written down.

---

## 6. REQUEST 5 — RESULT.md drafted, with OWED populated

`agent/docs/generate-prompt-docs/landing-page-restructure-07102026/RESULT.md`

**DRAFT. Not released** — your release condition is OWED empty, and four rows are
not. Two closed this round (R4 mechanism, lockfile), so it is two shorter than when
you wrote the spine, plus two I am adding:

- the **five-section sampler** (§5 above),
- **OWED row 3: the human read**, which I added deliberately because it *cannot* be
  converted by measurement. A ten-second hero read, the seam at the gallery foot, one
  full scroll. It sits on OWED precisely because no probe can close it.

Also carried, per your §7: the **release gates** section, and the **defect ledger**
in five lines — including entry 5, *"an assert on a shared outcome cannot attribute
cause."*

---

## 7. Two gate rows I could not close and did not fake

`.gitignore` media negation lines and `netlify.toml` publish path are marked
**unverified**. I ran out of budget to check them and marking them green without
looking would be exactly the behaviour this whole session has been built against.

---

## REQUEST

```
REQUEST 1: Approve closing OWED 1 (five-section sampler, both conditions) as the
next and only motion item, so nothing else lands in flight beside it.

REQUEST 2: OWED 3 (the human read) — confirm you want it on the document at all,
rather than tracked outside it. My argument for it being ON the document: a
gate that lives only in someone's head is not a gate.

REQUEST 3: RESULT.md — is DRAFT v1 the right state to circulate, or do you want the
OWED rows for gate verification (.gitignore / netlify.toml) closed first so the
release section has no blanks?

REQUEST 4: cmdk stays locked per your §6 unlock condition. Restated: rest-assert
green with red revert [DONE], matrix 4/4 with red revert [DONE], sampler
clean-or-fixed [NOT DONE]. So one of your three unlock conditions is outstanding
and I am not pulling.
```
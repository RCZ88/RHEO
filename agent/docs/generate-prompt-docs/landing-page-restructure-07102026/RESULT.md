# RESULT.md — DRAFT v1 · RHEO landing page

> **Status: DRAFT. OWED is not empty. Not released.**
> Verdicts are GLM's. Evidence lines are mine. Every OWED row carries the exact
> check that converts it to DONE — a document that names its gaps is a report; one
> that omits them is a guess.

---

> ## ⚠ ERRATUM (v1.2)
>
> **v1.1 reported that `#download` had 27 elements stuck invisible under reduced
> motion, carrying the availability line, the platform list and the version-history
> link. That was FALSE and is withdrawn.** The probe's `hidden` counter accumulated
> every frame, so it counted elements momentarily at 0 **during their entrance
> animation** as "stuck". Measured after settle: `#download` has **zero** elements
> below 0.05 and all content is visible.
>
> The tell was visible in v1.1's own table and was read past: `hidden` rose 36→62
> while `subjects` rose 3552→6068 — **the ratio pinned at 1.0%**. A count that
> scales with the frames sampled is measuring time, not state.
>
> **Two further phantom defects were withdrawn with it.** `#act-record` "15px" and
> `#download` "310px" were **static centring**, not motion: `top:50% +
> translateY(-50%)` is how you centre a box. 15 = 50% of a 30px readout; 310 = 50%
> of a 620px decorative glow. Both frame-traces were **flat across 1600ms** at
> constant scroll position. The assert was the defect, not the page.
>
> **What is actually open is much smaller: 20px of movement in `#download` under
> store-off.** See OWED.

## §0 — The spine

The product is **private, local-first time tracking that enables reflection**.
Five claims, each with a home and an observable.

| §0 claim | Where | Verdict | Evidence |
|---|---|---|---|
| private tracking, **stated** | hero | **DONE** | `Hero.tsx` — `0 bytes sent` in the bottom live line. Assert: `PASS hero states "0 bytes sent" (the privacy claim, R1)` |
| private tracking, **shown** | hero | **DONE** | `SessionClock.tsx` — mounted in `Hero.tsx`. Assert: `PASS clock="00:09" (9s) vs real 10s (lag 1s)`. Red-revert: pinned constant fails at `334:27:12` |
| private tracking, **checkable** | download | **DONE** | `Ledger.tsx` — three sourced facts, no marketing numbers. Probe reads them verbatim: `0 bytes that leave your machine no network call in the renderer` |
| ***seen*** | gallery | **DONE** | `Gallery.tsx` (17 screens, one home each) + `Hero.tsx` (primary CTA → gallery). Asserts: `PASS first CTA is #gallery and solid — #gallery/SOLID #download/ghost`; `PASS tail settles at maxScroll − paddingRight` |
| ***questioned*** | understand | **DONE** | `ActUnderstand.tsx` — Console mounted (hop-1 grep), three real `role="tab"` controls, receipts cited. Two-step: injected 4.2s auto-advance detected; correct code held for 10s |
| ***improved*** | understand + hero | **DONE** | `ActUnderstand.tsx:66` — *"Keep asking, and the record teaches back — your process, redrawn as your habits change."* Verified present in the rendered section; scenario 2 (`id: "learning"`) demonstrates it |

---

## OWED (ours)

| # | Owed | Converts to DONE when |
|---|---|---|
| 1 | **`#download` — 20px of real movement across 4 elements under `(off, no-preference)`.** Not 310px; that was static centring. Under `(auto, reduce)` the page is **completely clean — `movers=0` in all five sections.** | Attribute via ablation — one candidate disabled at a time until the delta zeroes. **Red-revert:** restore the candidate → `move >= 0.5` under store-off. |
| 2 | **The blink cursor is not suppressed under store-off.** `SPAN.blink-cursor "▍" anim=blink` sits at opacity < 0.05 during its dark phase. The reduce blocks kill `.blink-cursor` under the **media query** only, not under `html[data-motion="off"]`. GLM: suppression under store-off should be a *deliberate choice*, not an accident. | Either suppress it under `data-motion="off"` too, or record an explicit decision to let a liveness cursor blink for store-off users. **Red-revert:** remove the stamp rule → the element reappears. |
| 3 | **Palette a11y.** No focus trap, no background inertness, `Home`/`End` unhandled, dead `listRef`. | cmdk `CommandDialog` pasted **and audited** before any adoption edit, then Tab-containment / Esc / arrow / inertness asserts green with red reverts. |

**Closed this round:** `#act-record` (15px — never was motion) · `#download` (310px —
never was motion) · the `hidden` metric (now movement-based, not an accumulator).

## ASSIGNED (CZ) — convertible only by a named action outside us

These are not gaps in the report. They are the report's **deliverables**, and the
document is complete when it says them clearly. `BLOCKED-ON-CZ` is a verdict, not a
missing one — naming the blocker is a verdict; omitting the row is the guess.

| # | Assigned | Exact converting action | Blocks |
|---|---|---|---|
| A1 | **The human read.** Every probe on this board verifies the page *does what we intended*. This asks whether *what we intended is the right thing* — it runs in the opposite direction from measurement, which is exactly why it cannot be converted by measurement. | (a) ten-second hero read; (b) does the ASCII seam register at the foot of the gallery; (c) one full top-to-bottom scroll. | **release** |

> **A1 sequencing, re-derived (v1.2).** v1.1 gated this read on OWED 1–2 landing,
> because a read against a half-invisible download section would measure the defect.
> **That rationale is withdrawn with the invisibility claim.** Re-derived: the two
> open translates are **suppression failures** — they appear only under reduce/off.
> Under default settings (store auto, OS no-preference) the board has tested clean
> throughout, and the a11y gaps touch `⌘K`, not scroll. **So the read hands off to CZ
> the moment the spring replacement lands**, and attribution does not block it.
> *(Kept as a visible cross-reference rather than deleted: a rule invalidated by a
> retraction must be re-derived with its reason attached, or the next reader
> inherits it with no explanation.)*
| A2 | **Real binaries + SHA-256.** The `#download` CTAs point at nothing real. | Real or absent. Checksums are never invented. | **release** |

The *site* cannot ship while A1/A2 are open. That is the release gates' job, not
this document's — a different artifact.

## Closed, with receipts

| Was owed | Now |
|---|---|
| **R4 mechanism** | `PASS tail settles at maxScroll − paddingRight — 1280: 7213==7212.8 · 1440: 7206==7206.4 · 2048: 7200==7200.0`. Red-revert: `7264` at all three, FAIL. |
| **Motion store matrix** | `PASS 4/4`, three observers per row. Row 3 (explicit-on + OS reduce) was `anim=none` + `chip=rgb(244,244,245)` — the divergence. Now `anim=hero-enter` + same chip: both paths agree. Red-revert restores the divergence. |
| **Lockfile** | **In sync.** `prisma`, `@prisma/client`, `embla-carousel-react`: 0 occurrences in both files; diff is subtractive (402 removed / 3 added). *Content-verified; tool verification occurs at first deploy.* |
| **Store toggle, first direct test** | `PASS — palette row "Motion — full" -> data-motion null -> off, hero anim=none`. |

## Release gates

Both previously-unverified rows are closed, and one was closed by asking **git**,
not by grepping the lines that were supposed to make it true.

**`.gitignore` media negation — CLOSED.** The lines exist and git agrees:

```
.gitignore:151  !landing/public/media/
.gitignore:152  !landing/public/media/**

$ ls landing/public/media/ | wc -l          -> 25
$ git ls-files landing/public/media/ | wc -l -> 24
$ git check-ignore -v landing/public/media/app-dashboard.png
    -> (no output: NOT IGNORED, tracked-eligible)
$ git check-ignore -v landing/public/media/
    -> (no output: the directory itself is not excluded)
```

The 25-vs-24 gap is `_rejected`, a **directory**, not a capture. All 24 real media
files are tracked. Grepping the negation lines would have proved nothing — git does
not descend into an excluded parent, so the only real check is git's opinion.

**`netlify.toml` publish path — CLOSED.** There is **no `publish` key**, so Netlify
defaults to base-relative `.next`:

```toml
[build]
  base    = "landing"
  command = "npm run build"
```

The file's own comment warns against writing `publish = "landing/.next"`, which
would resolve to `/landing/landing/.next` and silently publish nothing. Absent the
key, `publish` = `landing/.next` — correct. Unchanged from the recorded baseline.

- [x] Lockfile synced with `package.json` — content-verified (see above)
- [x] `.gitignore` media negation intact **and verified against git**
- [x] `netlify.toml` publish path correct (no key ⇒ base-relative `.next`)
- [ ] ASSIGNED A1 + A2 — the site may not ship
- [ ] OWED 1, 2, 3

## Board

```
=== no-preference ===  22/24
=== reduce ===          22/24
46/48 asserts passed, 2 failed
```

**The board moved 42/42 → 44/48 → 46/48 without a single threshold being relaxed.**
The dip was the probe getting better: the two new conditions exposed two *phantom*
defects (above), which were then withdrawn when the metric was corrected. What
remains is one real 20px movement under store-off and the blink-cursor gap.

---

## The defect ledger — five lines, and the reason to trust the board

1. **22 green asserts were blind to composition.** Every section mounted, every id
   correct, every counter right — and two 69px headings sat on top of each other
   while a video lay across the phase list. Found by a screenshot. *Presence is not
   visibility.*
2. **A corpse reported itself clean.** The probe passed *"no reveal stuck at opacity
   0 — none across 0 sections"* on a page throwing `setHydrated is not defined`. The
   aliveness canary now voids absence-asserts on a dead page.
3. **A fixture read as a measurement.** `1,204,032 s observed` ticked up forever on
   a page whose brand is that its labels are true. Caught by comparing against
   **wall-clock time**, which a constant cannot satisfy.
4. **A fully-built reflection half, mounted by nothing.** `Console`, three scenarios,
   traces, receipts, bar chart — compile-clean, type-clean, zero usages. The
   signature defect, found by the hop-1 grep.
5. **A negative test that failed to discriminate.** Reverting end-align left
   `17 / 17` standing, because `sync` compensated. An assert on a shared outcome
   cannot attribute cause: **every mechanism needs its own observable, or its
   contribution is unverified forever.**

6. **An assert that passed while testing nothing.** The MotionChip selector in the
   motion matrix matched no element, so one of two consumers was silently absent for
   the entire matrix — and a companion comparison bug treated `null` as not equal to
   the string `"ABSENT"`. The canary's lesson turned inward: `none across 0
   sections` wearing a per-assert costume.

**The rule that earns:** *every property-assert prints its subject count, and
`count === 0` is a FAIL.* Absence-asserts stay the exception, gated by the page
canary. The good form — `5 headings, none overlapping` — becomes the universal form.

7. **Two phantom defects and a ratio that said so.** The assert above this one
   reported `#act-record` at 15px and `#download` at 310px under reduced motion.
   Both were **static centring** — `top:50% + translateY(-50%)` — read as movement
   because the assert compared an absolute `translateY` instead of a **delta**. The
   frame traces were flat across 1600ms at constant scroll. A measurement of
   *position* was being reported as a measurement of *motion*.

   Two rules earn here:
   - **Ablation or guess.** The red-revert run *before* a fix is attribution; run
     *after*, it is verification. Same operation, different time.
   - **No fix lands against a defect not re-confirmed at fix time.** The two wrong
     attributions were caught only because a gate changed nothing, forcing a deeper
     look. That was luck once; it is now a step.

   And the tell, which is the transferable part: **`hidden` 36→62 while `subjects`
   3552→6068 — the ratio pinned at 1.0%.** A count that scales with the frames
   sampled is measuring time, not state. Watch the ratio, not the count.

---

## What a reviewer should distrust

**Lead with this: `#download` and `#act-record` both carry a translate defect
under reduced motion — `max|ty|=310` and `15` respectively, measured in two
conditions. These are unfixed.** Note also that v1.1's claim of "27 elements stuck
invisible" was **withdrawn as a false report** — my probe's metric, not the page.

- **OWED 1 and OWED 2 are real and open.** Both are translates, not invisibility.
- **The dev server is not the deployed artefact.** No production build has run. Per
  `AGENTS.md` §0-0 that is CZ's job alone, so every verdict here is a claim about
  `next dev`.
- **The palette still has nine known a11y gaps** — now OWED **3**, renumbered in
  this revision. No focus trap, no background inertness, `Home`/`End` unhandled.
- **The seam is functionally verified and perceptually unjudged.** 138 × 132 glyphs,
  handle present, `ArrowRight` moves it 339px → 352.5px. Whether it *registers* at
  the foot of a long gallery is a human question and I decline to answer it.

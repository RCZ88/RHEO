# ROUND 7 — R1/R2/R3 landed · your priced cost is real and I measured it

> **Paste to GLM.** Three rulings implemented, four source pastes attached, and one
> finding that indicts my own mitigation: **the reduce flash you priced is real, and
> my CSS block only covers half of it.**

---

## 1. THE HEADLINE — your priced cost is real, and I under-mitigated it

You wrote: *"reduced-motion users get one post-hydration sync flip from the server
value — potentially one frame of an animated variant's initial state."*

You priced it as *"potentially."* **It is not potential. It is 12px, measured:**

```
FAIL  no hero element is EVER translated on the Y axis under reduced motion
      — max |ty| = 12px on H1.display-h1
      — max |ty| = 12px on P.mt-8 max-w-[640px]
```

And your mitigation precondition was met and works — **for the window I tested it
in, and only that window**:

```
[JS OFF, reduce]  h1.display-h1  computed transform: none    opacity: 1
                  inline style:    opacity:0; transform:translateY(12px)
```

So the `!important` block beats framer's inline style pre-hydration, exactly as
designed. But once **JS hydrates**, framer re-applies its own transform, and the
server snapshot (`shouldAnimate = true`, because `getServerSnapshot()` returns
`false` by design) means `initial` was rendered as `y: 12`. The element therefore
**moves 12px after the page has already promised it won't.**

**This is the honest shape of the trade:** your class fix deleted a fatal hydration
error across 13 components and cost one frame of motion that the reduce contract
forbids. I deleted the `ActRecord` mount-gate on your instruction and that gate was
*also* covering this — a local workaround masking a global symptom. Both cannot
exist. I am not quietly re-adding it; the choice is yours. Options as I see them:
(a) accept one 12px frame as the price of the class fix, and relax the assert to
`<= 12px` with the number recorded; (b) re-add a *narrow* gate on entrance motion
only; (c) drop the server-snapshot-`false` assumption for motion and accept a
different SSR shape.

---

## 2. That assert was VACUOUS TWICE before it worked — the fourth this project

Worth reporting because the pattern is now unmistakable. My first version read the
**settled** DOM. Second attempt sampled 2.5s **late in the run**, long after the
entrance had finished. Both reported `max |ty| = 0px` **with a 12px slide still in
the source**. Only the third — a **fresh page, sampling every frame from first
paint** — caught anything.

```
attempt 1  settled DOM        -> 0px   (defect present, passed)
attempt 2  late 2.5s sample   -> 0px   (defect present, passed)
attempt 3  fresh page, per-frame from first paint -> 12px  CAUGHT
```

**A polling probe measures the settled state by construction.** Every animation
assert in this suite needs a fresh load, and I did not know that until an assert
lied to me twice.

---

## 3. R1 / R2 / R3 — implemented, and each negative-tested

### R3 — the fabricated counter is dead

`SessionClock.tsx` (new, 55 lines). `▍ tracking · 00:09 on this page · 0 bytes sent`

State lives in the clock, not the Hero, so the tick re-renders four spans instead
of the whole section — your finding #3 is fixed by the same move. Ticks on the
**second boundary**, not 1000ms-after-mount, so it never runs a beat behind.

`field: laminar` removed as ruled.

**Your "honest zero IS the check" was also wrong, and I fixed it before shipping.**
At load the line does not read `00:00` for the probe — the probe navigates, waits
for `networkidle`, then reads, so a *working* clock reads `00:06` and the assert
failed on correct behaviour. Timing-independent version, which proves more:

```
PASS  hero clock reports REAL elapsed seconds since navigation
      — clock="00:09" (9s) vs real elapsed 10s
```

A fabricated constant cannot match wall time. **Negative test:**

```
FAIL  clock="334:27:12" (1204032s) vs real elapsed 7s
```

### R2 — CTA order

```
PASS  first CTA is #gallery and solid; download is ghost; 'See the method' gone (R2)
      — #gallery/SOLID  #download/ghost
```

"Solid/primary" is asserted **by computed background**, not by class name, so
restyling cannot silently demote it. Your reversal condition is recorded in the
source comment where the next person will read it, not only in this file.

### R1 — the privacy claim, measured in the hero DOM

```
PASS  hero states "0 bytes sent" (the privacy claim, R1) — present
```

---

## 4. GLM finding #2 — the gating inconsistency, fixed and proven

All **4** entrances that carry a `y` now read `shouldAnimate ? N : 0`. The 5th
`initial` object has no translate to gate.

I nearly shipped the fix unproven, because the assert was lying (see §2). With the
frame sampler and a real injected defect:

```
FAIL  max |ty| = 12px on H1.display-h1        <- defect injected, CAUGHT
```

**The remaining `12px` in §1 is not that defect** — that one is the server-snapshot
price, on elements that *are* gated. Two different causes, and I can tell them
apart because the assert names the element.

---

## 5. REQUEST 1 — your mechanism is right; your arithmetic is not

```
=== 1440 ===
paddingInlineStart / End : 0px / 57.6px
scrollPaddingInline S/E  : 80px / auto
scrollWidth / clientWidth: 8474 / 1210   maxScroll=7264
17x480 + 16x16 = 8416;  unaccounted in scrollWidth: 58
stop deltas: t1 want496 got416 Δ-80   t8 want3968 got3888 Δ-80   t16 want7936 got7264 Δ-672

=== 2048 ===
paddingInlineStart / End : 0px / 64px
scrollPaddingInline S/E  : 384px / auto
stop deltas: t1 want496 got608 Δ+112  t8 Δ+112   t16 Δ-672
```

**You were right that it is viewport-derived.** The source is a *second*
`.gallery-rail` rule at `globals.css:1717` that overrides the first:

```css
.gallery-rail {
  --rail-gap: 16px;                                   /* overrides the earlier gap:24px */
  --content: 1280px;
  gap: var(--rail-gap);
  scroll-padding-inline-start: max(24px, calc((100vw - var(--content)) / 2));
}
```

`(1440−1280)/2 = 80` ✓ · `(2048−1280)/2 = 384` ✓. And `scroll-padding-start` is
**80/384 against `padding-start: 0`** — your §2.3 edge-alignment invariant **is**
broken, exactly as you said. I also found why `padding-inline-left` read
`undefined`: I measured a property the engine does not expose in computed style.
Your correction was right on both counts.

**But your falsifiable test came out neither way you predicted** — the delta is
**−80 at 1440 and +112 at 2048**, not −384. Reason: snap points are
`N·step − scrollPad`, so once `scrollPad` exceeds half a step (248px) the
*nearest* snap point to `step·1` is `N=2`, not `N=1`.

**And here I nearly reported a bug that does not exist.** At 2048 the readout is
still correct:

```
width  scrollPad  step/2  goTo(1) lands on  readout
1280   24         248     1                02 / 17
1440   80         248     1                02 / 17
2048   384        248     1                02 / 17
```

`608/496 = 1.225 → 1`. **No wrong-slide bug at any width.** I state that because I
built the wrong-slide theory first and only measured afterwards — the third time
this session I asserted a mechanism before checking it.

**What does survive: your R4 tail finding.** `maxScroll = 7264`, and slide 17 wants
7936 — unreachable at both widths, so it is not a rounding edge case, it is
geometry. Your end-align ruling stands and I have **not** implemented it yet.

---

## 6. REQUESTS 2–4 — source attached, two findings answered without pasting

`paste-02-Preloader.tsx.md` · `paste-03b-DecryptedText.tsx.md` ·
`paste-04b-ActUnderstand.tsx.md`

**REQUEST 2 — Preloader: 700ms progress + 0.5s exit ≈ 1.2s of cover.** Your finding
#1 is confirmed and worse than "fossil": the entrance delays are 0.6 / 0.9 / 1.05s,
so **the kicker and manifesto play substantially behind the preloader and are
consumed unseen.** I deleted the dead `h1Revealed` rather than wiring it, because
wiring it would delay the headline by ~1.2s — a worse product. Flagging that as my
call, not yours.

**REQUEST 3 — DecryptedText is compliant.** Your finding #4 needed no paste:

```ts
// line 48
if (reduced || !inView) { setDisplay(text); return; }
```

The scramble does not run under reduce. **The one element that looked compliant
was compliant.**

---

## 7. Board

```
=== no-preference ===  17/18
=== reduce ===          17/18
34/36 asserts passed, 2 failed
```

Both failures are the **same** assert on the two motion modes: the 12px
post-hydration translate in §1. Everything else is green, including all three
composition classes that were 21/22 five rounds ago.

---

## REQUEST

```
REQUEST 1: the 12px post-hydration translate. Accept it as the price of the class
fix (relax the assert to <=12px, number recorded), re-add a narrow entrance-only
gate, or revisit the server-snapshot assumption? I will not choose between a
motion violation and a SSR-shape change on my own.

REQUEST 2: R4's end-align tail fix — implement now? It is the last known geometry
defect (slide 17 unreachable at every width, Δ−672).

REQUEST 3: R5 cmdk — pull the source and paste before adoption, per your sequence.
Not started; say the word.

REQUEST 4: R6 — wire the Motion row to the store, or does cmdk adoption supersede
it? I lean wire-it-first so the probe gets a direct store test either way.

REQUEST 5: ActUnderstand is now attached (paste-04b). Your pre-registered prior
needs its verdict from you before I touch the reflection half.
```

Still no RESULT.md — §0's second half is ActUnderstand's, and I am not writing the
verdict from the section that does not carry it.
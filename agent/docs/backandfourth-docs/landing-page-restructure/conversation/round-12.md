# ROUND 12 — your method ruling found both phantom defects in one trace, and the page is clean

> **Paste to GLM.** Frame-trace before source, exactly as ruled. It took one run and
> answered a question I had spent three rounds failing to answer by reading code.
> **Circulating v1.2.** One owed item landed, one did not.

---

## 1. REQUEST 1 — attribution by frame-trace. Both "defects" were my assert.

Read the curve first. Flat lines, constant scroll position, no animation:

```
=== act-record ===  max|ty| = 15   scrollY=844 CONSTANT   anim=none   t=3..1573
    element : DIV.(no class)   text: "00:00"
    inline  : position:absolute;left:14px;top:50%;transform:translateY(-50%);
              padding:2px 6px;background:#0a0a0c;border:1px solid rgba(...
    t=3 ty=15 | t=300 ty=15 | t=696 ty=15 | t=1073 ty=15 | t=1573 ty=15

=== download ===   max|ty| = 310  scrollY=6050 CONSTANT  anim=none   t=48..1548
    element : DIV.(no class)   text: ""
    parent  : SECTION.relative surface-page py-28 sm:py-36
    inline  : position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
              width:min(620px,90vw);height:min(620px,90vw);backgr...
    t=48 ty=310 | t=507 ty=310 | t=1123 ty=310 | t=1548 ty=310
```

**Neither is motion.** `top:50% + translateY(-50%)` is how you *centre* a box:

- the 15px is the **hh:mm playhead readout** — 50% of a 30px element;
- the 310px is a **620px decorative glow** — 50% of 620.

Both were reported as reduce-contract violations by an assert that compared an
**absolute `translateY`** instead of a **delta**. The page had no defect. The assert
was the defect, and it took a curve to see what three rounds of source-reading could
not.

Your prediction that 310px was "choreography that fails to suppress" was wrong, and
instructive: it was large enough to *look* like choreography. Magnitude was the thing
I used to justify the hypothesis, and it meant nothing.

**The metric now reports movement and prints the split:**

```
(auto, reduce)   hero move=0 movers=0/static=1   act-record move=0 movers=0/static=27
                 gallery move=0 movers=0/static=2  understand move=0 movers=0/static=0
                 download move=0 movers=0/static=2
(off, no-pref)   download move=20 movers=4/static=3     <-- the only real finding
```

**`(auto, reduce) is completely clean — `movers=0` in all five sections.** The
27 static-centred elements are now counted and labelled rather than flagged.

### And my fix was wrong the first time, which your rule predicted

First version computed the worst mover from its **final** `ty`. The probe then
reported `movers=4, move=0` — four moving elements scoring zero, because the value
returned toward its start. **A mover that ends where it began is still a mover.** Now
the DELTA across the window is what is reported. I caught it because the output
disagreed with itself, which is the count-discipline working in the direction it is
supposed to.

---

## 2. What is actually open is much smaller

| Was | Is |
|---|---|
| `#download` 310px, unattributed | **`#download` 20px across 4 elements, under store-off only** |
| `#act-record` 15px | **nothing — never was motion** |
| 27 invisible elements | **withdrawn** |

One real item, one condition, 20px. Attribution by ablation is still owed on it —
I have the trace, not the cause, and I am not repeating the mistake of guessing from
a mechanism that sounds right.

---

## 3. REQUEST 4 — the hero 3 are named, and you were right

```
opacity<0.05 in #hero under store-off: 1
  SPAN.blink-cursor "▍"  anim=blink
```

Your hypothesis exactly: the blink cursor caught at its dark phase. **And it is a
real gap, not a false positive:** the reduce blocks kill `.blink-cursor` under the
**media query** only — there is no `html[data-motion="off"]` counterpart, so a
store-off user keeps a running animation. Your framing is the ruling I have recorded:
a liveness cursor surviving constraint #4 is defensible; its survival under an
explicit MOTION OFF being an *accident* is not.

**On metric hardening — partially done, and I will not overstate it.** The `ty`
metric is now verified by frame-delta, which removes the magic-number problem
entirely. The `hidden` metric is **still** time-based (`t0 > 900ms`), so your
objection stands against that half: an entrance still running at 900ms re-creates
the withdrawn report as a false positive. Not fixed.

---

## 4. REQUEST 2 — you are right, and the replacement is still owed

What landed is the **gate**:

```ts
const springP = useSpring(raw, { stiffness: 120, damping: 25 });
const p = shouldAnimate ? springP : raw;
```

There is no house-curve replacement in my diff. Under no-preference the spring still
drives, and constraint #5 bans spring easing unconditionally. So:

- the gate is correct and stays — it is what made the trace possible to read;
- the **replacement is still owed, attribution-independent**, as you ruled in Round 11.

I did not land it this round. It is the last mechanical item before A1 hands to CZ,
and it is a real change to act-record's feel under default settings — which is
exactly why your §4 wants it *before* the human read, not after.

---

## 5. REQUEST 3 — v1.2, erratum first-class. Circulating.

`agent/docs/generate-prompt-docs/landing-page-restructure-07102026/RESULT.md`

- **Erratum block above the spine**, carrying the corrected claim *and the fact of
  the correction*, including that two further phantom defects were withdrawn with it.
- **Ledger entry 7**, with both earned rules: *ablation or guess* (the red-revert run
  before a fix is attribution, after it is verification) and *no fix lands against a
  defect not re-confirmed at fix time* — the second because the gate that changed
  nothing forced the look that found the error, and that was luck exactly once.
- **A1 re-derived, not deleted.** v1.1's gating rationale is marked withdrawn *with
  its reason attached*, per your point that a rule invalidated by a retraction must
  not be silently removed. The read hands off the moment the spring lands.
- **OWED is now three rows**, one of them 20px rather than 310.

You were right that the error history is not "only in chat" — the ledger is where it
lives, and a v1.3 that silently never contained the error would prove less.

---

## 6. Board

```
=== no-preference ===  23/24
=== reduce ===          23/24
46/48 asserts passed, 2 failed
```

42/42 → 44/48 → 46/48, **with no threshold relaxed at any point.** The dip was the
probe improving; the recovery is the probe being made correct. The two remaining
failures are one 20px movement under store-off, in both mode runs.

---

## REQUEST

```
REQUEST 1: Ablation on the 20px is the next and only motion item — four candidate
elements, disable one at a time, attribution is the removal that zeroes the delta.
I have the trace, not the cause, and I am not guessing again.

REQUEST 2: Should I land the house-curve spring replacement NOW, ahead of the
ablation? My lean is yes: it is attribution-independent, constraint #5 makes it
owed, and A1 is explicitly sequenced behind it — so it is the one item blocking a
human deliverable. Ablation can wait a round; CZ idling cannot.

REQUEST 3: The blink cursor — suppress under data-motion="off", or record an explicit
decision to let it blink for store-off users? You framed it; I have not ruled.

REQUEST 4: cmdk unlock — attribution of the 20px outstanding, so still locked.
```
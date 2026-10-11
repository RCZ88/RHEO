# ROUND 11 — I filed a false report last round, and my own probe caused it

> **Paste to GLM.** The headline is a retraction. Your severity ladder asked me to
> fix `#download` first; while doing so I found that **the defect I reported in
> Round 10 was not a defect at all.** It was my probe's metric.

---

## 1. THE RETRACTION

Round 10, me:

> **27 elements stuck at opacity 0 under reduced motion**, including real content:
> *"RHEO isn't on sale yet…"*, the platform list, *"Version history"* — a whole
> section failing for a class of user.

**That was wrong.** Measured after settle:

```
opacity<0.05 WITH text (content at risk): 0
opacity<0.05 NO text (decorative?)     : 0
"RHEO isn't on sale yet" -> visible=true
"Version history"       -> visible=true
"macOS"                 -> visible=true
```

**Cause.** The sampler's `hidden` counter incremented on *every frame* of a 1.4s
window, so it counted elements that were momentarily at 0 **during their entrance
animation** as "stuck". `maxTy` is legitimately a max over the window — a translate
either happens or it does not — but `hidden` was not a max, it was an accumulator.
I then reported its total as a count of stuck elements, and separately measured one
of those frames directly and attributed the number to content.

The tell was in my own Round 10 table and I read past it: `hidden` **rose** from 36
to 62 while `subjects` rose from 3552 to 6068 — the *ratio* stayed at 1.0%. A count
that scales with the number of frames sampled is measuring time, not state.

Fixed to settled-only (`performance.now() - t0 > 900` before counting). Both
conditions now read `download: hidden=0`, and `hero: hidden=0` under reduce.

**What survives:** `max|ty|=310` in `#download` and `15` in `#act-record`, both real,
both present in both conditions. **What does not:** the invisibility. Withdrawn.

---

## 2. REQUEST 2 — your prime suspect was right that it existed, and wrong that it mattered

```
ActRecord.tsx:82   const p = useSpring(raw, { stiffness: 120, damping: 25 });
```

Confirmed present, and the signature matched your reasoning: a spring is store-blind
and OS-blind, which is why it read identically in both conditions. Also found and
fixed while there: `ActRecord.tsx:12` still imported **`usePrefersReducedMotion`**
— the wrong-hook class, in the very file the hook class had been hunted in.

```ts
const springP = useSpring(raw, { stiffness: 120, damping: 25 });
const p = shouldAnimate ? springP : raw;   // hook runs; output bypassed under reduce
```

**And it changed nothing:**

```
act-record: max|ty|=15   (both conditions, before AND after)
```

So: the spring is real and owed under constraint #5 — your point that the
replacement is justified on either branch holds, and it is landed. But **it is not
what moves.** My attribution was wrong, the same way the `hidden` attribution was
wrong. Two wrong attributions in one round, both from a plausible mechanism rather
than a measurement.

---

## 3. REQUEST 1 — attribution, and the honest result

Your prediction was *"the fix may be one `initial`, not 27."* Correct, and then
some: `#download` had **eight** `initial={{ opacity: 0 }}` objects and **no
reduced-motion hook imported at all** — one missing concept, not 27 bugs. All eight
are now `rm ? 1 : 0` / `rm ? 0 : N`.

**It changed nothing:** `download: max|ty|=310` before and after. So the 310px is
also not an entrance reveal.

**Neither offender is attributed.** I ran out of budget before I could identify what
actually drives them, and I am not going to guess twice in one round. Both stay OWED,
with the attribution step named as the thing to do next — not the fix, because I
have now been wrong about the cause twice and a third guess is not evidence.

---

## 4. REQUEST 3 — worst-element output

Still truncated (`worst=DIV.`), and I did not fix it. Your objection stands: an
identifier that reads `DIV.` is not attribution. It is queued with the attribution
step rather than done separately, because the same output has to carry the answer.

**The hero `hidden` count is now `0` under the corrected settled metric** in both
conditions, so your blink-cursor/sheen hypothesis no longer needs adjudicating — the
number was measuring entrance frames. The one number that did survive is
`hero: hidden=8` under `(off, no-preference)`, and I have **not** explained it.
Naming it is not the same as fixing it, and it stays unexplained on the record.

---

## 5. REQUEST 4 — RESULT.md corrections made

- **Catch A:** board section was stale at `42/42`. Now `44/48` with the four failures
  named as OWED 1–2 × two conditions, and the *board went down because the probe got
  better* line **in the document**, where you said it belonged — it is currently only
  in correspondence.
- **Catch B:** distrust section re-pointed. OWED 1 is a *measured* 15px, not an
  "unmeasured motion path"; the a11y gaps are now **row 3**. It leads with the two
  open translate defects, and carries the withdrawal.
- **A1 sequencing line added:** run the human read **only after OWED 1–2 land**.
- **OWED 1 and 2 rewritten** to lead with *"attribution failed twice; the defect is
  the translate, not the invisibility."*

**I have not circulated it**, because v1.1 as it stands carried a false report as a
DONE-adjacent claim and I would rather ship a corrected draft than a circulated
error.

---

## 6. Board

```
=== no-preference ===  22/24
=== reduce ===          22/24
44/48 asserts passed, 4 failed
```

Unchanged in count, but **two of its inputs were wrong and are now fixed or
withdrawn.** A board at the same number with corrected metrics is worth more than
the same number with the previous ones.

---

## REQUEST

```
REQUEST 1: Do you want the attribution run before anything else? My position: yes.
I have now attributed two defects wrongly in one round by reasoning from a plausible
mechanism. The remaining unknowns are concrete — "what produces max|ty|=310 in
#download, and 15 in #act-record, under (auto,reduce)" — and they are answerable
with the worst-element output extended to tag + full class + id + text snippet.

REQUEST 2: Does OWED 2 stay open, given the invisibility claim was withdrawn? My
read: YES, but reframed — it is now a 310px translate with no attributed cause,
which is smaller than "a section failing" and still not something to close on a
guess.

REQUEST 3: cmdk stays locked. Unchanged, for the same reason: real open defects.

REQUEST 4: RESULT.md — I have NOT circulated. Your condition was met, but the draft
contained a false report I only found while fixing the thing it claimed. If you
want it circulated as v1.2 with the corrections and the withdrawal visible, say so;
I would rather not send a document whose ERROR HISTORY is only in our chat.
```
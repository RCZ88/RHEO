# ROUND 8 — the reflection half is mounted · 36/36 · one negative test that failed to discriminate

> **Paste to GLM.** Your prior was right about the shape and wrong about the
> mechanism — and the mechanism was worse. One negative test of mine is **invalid**
> and I am not claiming R4 as proven.

---

## 1. REQUEST 1 — ActUnderstand: the Console is mounted, five blockers cleared

The signature defect, caught by the hop-1 grep in one line: `Console` was fully
built and referenced by nothing. Verified mounted:

```
scenario tabs (real controls): 3
input/form elements        : 0   (the lie is gone)
EXAMPLE card present       : false
'teaches back' sentence    : true
```

| # | Blocker | What I did |
|---|---|---|
| 1 | 4.2s auto-advance (WCAG 2.2.2) | timer **deleted**; scenarios advance only on user action |
| 2 | The input was a lie | `onSubmit` + `<form>` **deleted**; three real `role="tab"` buttons that really select |
| 3 | `BarChart` animated `height` | wrapper holds final height; bar is a full-height child on `scaleY`, `transformOrigin: bottom`, `initial` gated on reduce |
| 4 | Ungated framer initials | every `initial` now `opacity: reduced ? 1 : 0, x: reduced ? 0 : -6` |
| 5 | Wrong hook | `usePrefersReducedMotion` → `useShouldAnimate` in **both** `ActUnderstand.tsx` and `DecryptedText.tsx` |

EXAMPLE card and `NodeGraph` both deleted (source kept in
`.bak-20261008-actunderstand/`). `reduced` is now derived as `!useShouldAnimate()`
in each component.

**One bug I introduced and caught:** `BarChart` is a separate component, so the
Console's `reduced` was not in scope — `reduced is not defined` took down the
entire reduced-motion render. Fixed by giving `BarChart` its own hook instance.
It is in the board history if you want to see the failure mode.

### Negative test — the WCAG one, two-step

```
injected 4200ms auto-advance -> 10s in view: "Deep work" -> "Sharpest"  DETECTED
correct code                  -> 10s in view: "Deep work" -> "Deep work"   HELD
```

Both steps, and the positive control matters: a negative test without one cannot
tell you the probe works at all.

---

## 2. REQUEST 2 — hero entrances are CSS now, and the reduce sample is **0px**

Framer is **off the hero entirely** — `grep -c "motion\." Hero.tsx` = **0**. Five
`hero-enter` classes, plus orphaned imports removed (`motion`, `Def`, `useEffect`,
`useState`, `useShouldAnimate` — all four imports were dead the moment the classes
landed).

```css
@keyframes hero-enter { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .hero-enter { animation:none; opacity:1; transform:none; } }
html[data-motion="off"] .hero-enter     { animation:none; opacity:1; transform:none; }
html[data-preload] .hero-enter          { animation-play-state: paused; }
```

`writeMode` stamps `document.documentElement.dataset.motion`; `Preloader` sets and
removes `data-preload`.

**The assert is not relaxed. It now passes:**

```
reduce         PASS  max |ty| = 0px over 2509ms of entrance
no-preference  PASS  (mode-conditioned — see below)
```

And your correction of my mislabelling is confirmed by direct measurement:

```
[reduce]        anim=none  transform=none     opacity=1
[no-preference] anim=hero-enter transform=matrix(1,0,0,1,0,12) opacity=0
```

**Two assert bugs of mine, both found because they failed on correct code:**

1. The translate assert ran in **both** modes, so in `no-preference` it flagged the
   legitimate 12px entrance as a defect. Now `mode !== "reduce" || heroMaxTy < 0.5`.
2. The clock bound was symmetric `±2s`. It false-failed by 4s once the probe began
   spending 2.5s sampling a second page first. The clock starts when its component
   **mounts**, so it can only ever **lag** real time — the bound is now asymmetric,
   `[real−15, real+1]`, which a constant still cannot satisfy.

---

## 3. REQUEST 3 — the rail: stops are Δ0 at three widths

`scroll-padding-inline-start` deleted; the duplicate `.gallery-rail` rule removed
entirely (tokens folded into the one at the top). Two `.gallery-rail` blocks remain
and they are **different concerns** — the token/box rule and the
`overscroll-behavior`/`touch-action` rule — not competing declarations.

```
--- 1280 ---  step=496  maxScroll=7264  tailSlidesAligned=2
    N=0  want 0     got 0     Δ0
    N=1  want 496   got 496   Δ0
    N=2  want 992   got 992   Δ0
    N=8  want 3968  got 3968  Δ0
    at end: readout=17 / 17  last.right - rail.right = 0  fullyVisible=true
--- 1440 ---  identical: Δ0 ×4, readout 17 / 17, flush
--- 2048 ---  identical: Δ0 ×4, readout 17 / 17, flush
```

**Was** −80 at 1440 and +112 at 2048. **Now** Δ0 everywhere. Your diagnosis — the
edge-bleed formula applied with the wrong tool — was right, and the 144px was the
container's inset as you said.

### The tail needed one more thing than end-align

End-align alone gave `16 / 17`. The end-aligned snap parks at **7206**, not
maxScroll **7264** — 58px short, which is exactly the rail's
`padding-right: clamp(20px,4vw,64px)` = 57.6px. So `atEnd` (tested against
maxScroll) never fired and the index rounded `7206/496 = 14.53 → 15`. `sync` and
`goTo` now model the padding-aware end stop, and `17 / 17` holds at all three
widths with the last slide flush.

### ⚠ MY R4 NEGATIVE TEST IS INVALID — I am not claiming it as proven

Reverting `scroll-snap-align: end` → `start`:

```
end-align REVERTED: readout=17 / 17   last.right-rail.right=-58   fullyVisible=true
-> NEGATIVE TEST INVALID
```

It does not discriminate, because **`17 / 17` now comes from the padding-aware
`sync` logic, not from snap alignment.** The end-align's real contribution is the
snap *rest position* (7206 vs 7264), which none of my checks assert. So:

- R4's **observable outcome** (readout `17 / 17`, last slide flush) — **proven**.
- R4's **mechanism** (end-align causes it) — **not isolated by any assert I have.**

Per your own rule that is an untrusted check, so I am flagging it rather than
counting it green. Either I write an assert on the rest position, or the mechanism
gets recorded as "unverified, outcome verified".

---

## 4. REQUEST 5 — the Motion row does what it says

```ts
label: `Motion — ${mode === "off" ? "reduced" : "full"}`,
hint:  "toggle",
run:   () => { setMode(mode === "off" ? "auto" : "off"); setOpen(false); },
```

`mode` added to the items `useMemo` deps, so the label cannot go stale — and
because `writeMode` stamps `html[data-motion]` in the same change, this row now
drives **both** the framer path and the CSS keyframes. The probe has no direct
store toggle yet; that assert is still owed.

---

## 5. REQUEST 4 — cmdk: **not started**, and I want to flag a sequencing problem

I have not pulled it. Two reasons, both procedural:

1. R4's mechanism is unverified (§3). R5 changes the palette, and I would rather not
   have two unverified mechanisms in flight when the first one is already flagged.
2. `components.json` reports `registries: {}` in this checkout — the four registries
   resolve through the shadcn MCP's configured list, not that file. So the pull may
   need an explicit registry argument rather than the default set.

Say the word and I pull `@shadcn/command` (`CommandDialog`) and paste it **before
any adoption edit**, per your sequence. I will not touch the palette until you have
audited it.

---

## 6. Board

```
=== no-preference ===  18/18
=== reduce ===          18/18
36/36 asserts passed, 0 failed
```

Up from 34/36, with the composition class (overlaps), the honesty class (clock,
privacy claim, CTA order), and the motion class (0px under reduce) all green.

---

## REQUEST

```
REQUEST 1: R4's mechanism. Write an assert on the tail snap REST POSITION
(scrollLeft at end === maxScroll - paddingRight), which is what the end-align
actually controls, or record the mechanism as unverified and keep the outcome
assert. I lean toward the assert — the outcome assert passing for the wrong reason
is the failure mode you named in Round 6.

REQUEST 2: The probe still has no direct test of the motion STORE. The obvious one:
open the palette, activate the Motion row, assert html[data-motion] flips AND
useShouldAnimate's consumers change. That is the first test the store has ever had.

REQUEST 3: Extend the frame sampler from hero-only to all five sections per your
§2 note — I have it on the hero only. The frozen-initial class is not hero-only and
I have not measured whether the other four are clean.

REQUEST 4: cmdk — pull now or after REQUEST 1–3? I am holding per (5).

REQUEST 5: RESULT.md — you said next round on the §0 spine, conditioned on the
board being green. It is. Say the word and I will write it, with the evidence table
per section and your ten-second human check as the one item I cannot close.
```

Two things I did **not** do, both deliberate: no cmdk pull (§5), and I did not
write RESULT.md because you conditioned it on a green board *and* your ruling on
R4's mechanism, and the first is true while the second is outstanding.
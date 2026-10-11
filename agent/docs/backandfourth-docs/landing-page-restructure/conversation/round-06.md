# ROUND 6 — §1 authorized and landed · §5 hypothesis refuted by numbers · §0 verdict

> **Paste to GLM.** Three of your six requests are answered with measurements that
> contradict one of your hypotheses. One is a scope gap, not a threshold. Your two
> new rules were both needed — the canary caught a vacuous pass in the same run I
> installed it.

---

## 0. YOUR TWO RULES, IMPLEMENTED — AND THE CANARY EARNED ITS PLACE IMMEDIATELY

### Rule 1 — aliveness preconditions

`probe-landing.mjs` now fires a canary **before any "none found" assert**:

```
----  aliveness canary
      sections=5 headings=5 rootChildren=6 bodyChars=2841 -> ALIVE
```

and every absence-phrased assert is **conditional on it**. A dead page voids them:

```js
const isAbsence = /none|no |not present|missing/i.test(name);
const gated = isAbsence && !alive;
```

**It paid for itself in the same run.** The first probe after the hook fix printed:

```
FAIL  pageerror count === 0  — setHydrated is not defined
PASS  no reveal stuck at opacity 0  — none across 0 sections
PASS  no two headings overlap  — 1 headings, none overlapping
```

Two green lines **from a page that was throwing and had rendered one heading.**
`none across 0 sections` was a corpse reporting itself clean. Under the canary that
is now a `FAIL … [VOID: page not alive]`.

The cause was mine and it is humbling: I deleted the `hydrated` state in one
command and its `useEffect` in the next. My own §0 rule — *"never leave orphaned
code behind when you undo your own work"* — violated by two tool calls apart.

### Rule 2 — two-step negative tests

Applied to the §2 fix, and it **failed its own first attempt**, which is the
third time this session and therefore worth stating as a pattern rather than an
incident: my first re-injection reused `scrollIntoViewIfNeeded`, which is a
different scroll position from the probe's, so step 1 reported `0 pair(s)` and the
negative test was **invalid**. Redone against the real checker:

```
STEP 1 (defect present):  FAIL detail = "Unbroken focus. Th" X "REST" 18x5
STEP 2 (checker catches): 27/28 asserts passed, 1 failed
re-apply                  -> 28/28
```

The defect was scroll-position dependent. **A negative test must run in the same
state the checker runs in**, or it proves nothing.

---

## 1. REQUEST 1 — applied exactly as authorized

`paste-01-use-motion-preference.ts.md` — the whole file, for your ambient-read audit.

Your shape, with **one rename you should know about**: the module already has a
module-level `subscribe` for the `mode` store, so yours is `subscribeSystemReduced`.
Colliding names in one module is a shadowing bug waiting to happen.

**On your "check for other ambient reads" instruction — there is a second one, and
it is inert.** Lines 64–79 hold a system listener that does:

```ts
const cur = readStoredMode();
if (!cur || cur !== "auto") return;     // <-- returns when NOTHING is stored
mode = mq.matches ? "off" : "on";
```

With no stored preference `cur` is `null`, so it returns immediately and never
writes. `mode` stays `"auto"` and **every read falls through to the ambient read**.
That is why the bug was universal rather than intermittent. I left it alone — it
is harmless and it is not what you authorized — but it means `mode` only ever
becomes `"on"`/`"off"` for users who explicitly chose `"auto"`.

**Also removed:** `getSystemReducedMotion()` is now dead. Its only caller was the
line I replaced.

### Your precondition was NOT met. Verified, not assumed.

You said the CSS block must own the initial paint, and *"paste it either way."*
Measured with **JavaScript disabled** — the genuine pre-hydration paint:

```
BEFORE  [JS OFF, reduce]  h1.display-h1  computed opacity: 0
        [JS OFF, reduce]  inline          opacity:0; transform:translateY(12px)
```

The server emits `opacity:0` on **10 nodes**, including `h1.display-h1`,
`p.mono-label`, `.ledger-cell`. So your priced cost was not a theoretical
one-frame risk — **the hero headline was invisible to a reduced-motion visitor
until the bundle ran.** Your mitigation was load-bearing, not precautionary.

`globals.css` already had five reduce blocks, but they only set
`animation: none` / `transition: none` — they cannot touch a JS-driven inline
style. Block added at the end of the file; scoped to content-bearing reveal classes
only, because in the gallery **opacity is the signal**, not an artefact:

```css
@media (prefers-reduced-motion: reduce) {
  .display-h1, .display-h2, .display-h3,
  .mono-label, .mono-label-strong,
  .ledger-cell, .mono, [data-reveal] {
    opacity: 1 !important;
    transform: none !important;
  }
}
```

`!important` is required, not stylistic. Measured after:

```
[JS OFF, reduce]        h1.display-h1  effectiveOpacity=1.00
                        h2.display-h2  effectiveOpacity=1.00
                        p.mono-label   effectiveOpacity=1.00
                        .ledger-cell   effectiveOpacity=1.00
[JS OFF, no-preference] h1.display-h1  effectiveOpacity=0.00   <- entrance intact
```

Effective = the product up the ancestor chain. And the no-preference column
proves the block is **scoped, not a blanket disable** — entrances still start hidden.

### The ActRecord mount-gate is deleted

A workaround that is no longer needed is debt. Gone: the `hydrated` state, the
`useIsomorphicLayoutEffect` alias, and the three `hydrated &&` branches. Those
three lines are the class fix's receipt:

```ts
const sectionHeight = reduced ? "auto" : "300vh";
const stickyHeight  = reduced ? undefined : "100dvh";
const showAnimated  = !reduced;
```

---

## 2. REQUEST 2 — full board, both modes, after the gate deletion

```
=== RUN no-preference ===  14/14 PASS
=== RUN reduce ===          14/14 PASS
28/28 asserts passed, 0 failed
```

`MotionChip`'s hydration warning is **gone** — it was never a MotionChip bug, it
was this class bug wearing a two-character symptom.

Negative test, both steps, as specified:

```
revert hook   -> pageerrors = 1  "Hydration failed because the server rendered
                                 HTML didn't match the client"   [checker CATCHES]
re-apply      -> 28/28
```

---

## 3. REQUEST 6 — it is a SCOPE GAP, not a threshold

Answering your question first, because you asked for it first:

> The standing overlap assert compares **`<video>` against text**. The 47×5 pair was
> **text against text**. It was never inside the assert and no tolerance was
> involved — the threshold you were half-suspecting does not exist. I wrote an
> assert that covered one class of overlap and named it as if it covered overlap.

### The fix is a deterministic boundary, as instructed

The invitation was `left: 14` off an **8×8 dot marker**, so a 194px nowrap phrase
started at x=1256 and ran to **x=1450 — 10px past the 1440 viewport**, straight
across the rail's own `MEETINGS` label. Not a 5px nudge; the element had no
boundary at all:

```ts
// right:100% + a fixed gap ⇒ the right edge is the dot's left edge minus 10px
// at every viewport, and it grows leftward into the empty gutter.
right: "100%",
marginRight: 10,
```

Swept, because you asked for a sweep rather than a promise:

```
w=1280  text-over-text=3  overflowing-viewport=0
w=1440  text-over-text=3  overflowing-viewport=0
w=1600  text-over-text=3  overflowing-viewport=0
w=1920  text-over-text=3  overflowing-viewport=0
w=2048  text-over-text=3  overflowing-viewport=0
```

### The new assert then found a SECOND instance, and my first version was noise

Generalized text-vs-text, folded in as you asked. First version matched **wrapper
containers**, so one rail container reported as a 443px-tall "text"
(`"0006121824RESTDEEPWORK…"`) overlapping the section label. Restricted to
**leaves** — your own argument from §4, applied to my own new assert:

```
no-preference  PASS  none
reduce         FAIL  "Unbroken focus. Th" X "REST" 18x5
```

Same root cause as the clip: the rail is `absolute right-4` over a stacked layout
whose content spans the full 1280px. Given the same position switch as the clip:

```ts
className={showAnimated ? "absolute right-4 lg:right-10" : "mx-auto"}
```

Now `none` in both modes, `overflowing-viewport=0` at five widths.

**Two corrections I owe you.** I twice claimed the remaining rail collision was
*intentional occlusion* by the playhead readout's opaque background — and both
times I checked, the background was `rgba(0, 0, 0, 0)`. I asserted a mechanism
before measuring it, twice. The colliding `DEEP WORK` was also not the one I
named: `find()` returned the left-column label at x=144 while the colliding one
sits in the rail at x=1254. **Two elements, same text, different rail** — which is
also why a text-based assertion needs coordinates, not labels.

---

## 4. REQUEST 5 — your hypothesis is REFUTED, here are the four numbers

```
1) resting scrollLeft at slide 1 : 0
2) computed padding-inline-left : undefined   (the property is not set)
   computed padding-inline-right: undefined
3) one slide offsetWidth         : 480.00   offsetLeft: 144
   columnGap                     : 16px
   scrollWidth / clientWidth      : 8474 / 1210
```

**Origin is 0, not 80.** There is no `padding-inline` on the rail. The 144 is the
`max-w-[1280px]` container's own padding, not the rail's. So `(scrollLeft − origin)`
is not the fix — the current arithmetic is already correct.

The 416-vs-496 gap is real but is **snap rounding, not an offset**:

```
target  expected  actual  derivedIndex  readout
0       0         0       0             01 / 17
1       496       416     1             02 / 17
2       992       912     2             03 / 17
8       3968      3888    8             09 / 17
16      7936      7264    15            16 / 17
```

A **uniform −80**, which is `(1440 − 1280) / 2` — the container's side margin. It
is `80 / 496 = 16%` of a step, so `Math.round` never crosses a boundary, and the
derived index matches the readout at **every** stop including both ends.

**One thing your hypothesis did surface, and it is not benign:** at `target 16` the
rail asks for 7936 but can only reach `8474 − 1210 = 7264`. The last slide is
unreachable by design of a scroll-snap rail, and the readout only agrees with the
derived index because `7264 / 496 = 14.65 → 15`. **That agreement is arithmetic
luck, not correctness.** At 16:9 ratios or a different gap it crosses 15.5 and the
readout goes to `16 / 17` while slide 17 is centred. That is a real latent bug in
`sync`, and I have not fixed it because the fix is a design decision (clamp to the
last reachable index, or reserve trailing space so slide 17 can reach its step).

### §5's width sweep, done

```
width  slideW  step   visible   in-band(2.4-2.6)?
1280   480     496    2.43      yes
1440   480     496    2.44      yes
1600   480     496    2.45      yes
2048   480     496    2.45      yes
```

In band at every width. Slide width is fixed, so the ratio barely moves — which is
why the single-viewport number was not in danger, but it is now four numbers.

---

## 5. REQUEST 3 — `Hero.tsx`, and the §0 verdict you were blocked on

`paste-03-Hero.tsx.md` — 240 lines, verbatim.

**The §0 verdict: the hero does NOT say "private".**

```
hero word count (rendered, incl. UI chrome): 60
privacy / local-first stated in hero?  NO
reflection stated in hero?              YES

"RHEO — ῥέω · GREEK: TO FLOW  TIME, MADE LEGIBLE.  Your hours are the only
 currency you can never earn back. RHEO records how they flow — so every phase
 of your life can be seen, questioned, and improved.  Download for Linux  See
 the method ↓  SEE ALL 17 SCREENS, UNTOUCHED ↓  tracking · 1,204,033 s
 observed · field: laminar"
```

The manifesto line is **verbatim and in the product's voice** (29 words), and it
carries reflection — *seen, questioned, improved*. It carries **no privacy claim**.
The first mention of privacy anywhere on the page is in `#download`: *"0 bytes that
leave your machine."* So a ten-second reader gets **reflection at the top and
privacy only if they scroll to the bottom** — which is the opposite of what §0.2
asks of it.

**Second finding, and it is about the CTA you asked me to check.** The gallery link
exists but it is the *third* link and visually the weakest:

```
[SOLID / PRIMARY] href=#download    "Download for Linux"
[ghost / tertiary] href=#act-record "See the method ↓"
[ghost / tertiary] href=#gallery    "SEE ALL 17 SCREENS, UNTOUCHED ↓"
```

Your criterion was "CTA → #gallery". **The primary CTA goes to `#download`.** The
gallery is reachable, labelled, and tertiary. I am not calling that a bug on my
own authority — a download-first page is a legitimate position — but it is a
deliberate-looking choice I did not make deliberately, and it is yours to rule on.

Also visible in the source and worth your eye: `seconds` starts at a hard-coded
`1204032` and increments `+1` per second forever. It is a **fake counter** — after
an hour it is more wrong than before. The Ledger carries the honest claims; this
does not.

---

## 6. REQUEST 4 — `CommandPalette.tsx`, and your prediction was right

`paste-04-CommandPalette.tsx.md` — 258 lines, verbatim.

**Yes, the keyboard and aria handling are hand-rolled, and cmdk should replace it.**
The gaps, from reading it against the `role`/`aria-*` actually present:

| Gap | Evidence |
|---|---|
| **No `aria-activedescendant`** | `role="combobox"` + `role="listbox"` + `role="option"` are all correct, but the input never points at the active option and the options have no `id`. A screen reader announces the list, never the selection. |
| **No focus trap** | `Escape` and `⌘K` are handled globally, but `Tab` walks straight out of the dialog into the page behind it. `aria-modal="true"` claims a containment the code does not enforce. |
| **Background not inert** | no `inert` / `aria-hidden` on the page behind an open modal. |
| **One inert action** | `"Reduce motion (open OS setting)"` — its `run` is `setOpen(false)` and a comment admitting it "can't toggle OS pref from JS". **The label promises a navigation that does not happen.** That is the Counter autopsy: a UI string asserting a capability the component does not have. |
| **Dead ref** | `listRef` is attached and never read. |

On your claim that cmdk *"animates nothing out of the box"* — I agree, and note
your audit rule applies here too: the palette's own `AnimatePresence` transitions
(0.25s / 0.3s) are **unconditional**, not gated on `useShouldAnimate`. If we adopt
cmdk we should keep our overlay and our tokens, not its motion.

I have **not** pulled `@shadcn/command` — you said "whenever convenient", and
REQUEST 6/A still have open rulings. Say the word and I will pull the source and
report what it actually does before changing anything.

---

## 7. YOUR §4 RULINGS, ACKNOWLEDGED

`@kokonutui` for the Download card — **rejected, and your reasoning is better than
what I would have written.** "Pull cost (re-skin + claim-audit) exceeds hand-roll
cost on a surface with no interaction" generalises: a pull is worth it when the
component carries *behaviour or accessibility*, never when it carries only pixels.
That is now the rule I will apply, and it is narrower and more useful than
"registry-first" from the original brief.

`CommandPalette` as the single pull candidate — agreed, pending your go-ahead.

---

## REQUEST

```
REQUEST 1: the §0 verdict is in — the hero says reflection and NOT privacy.
Options, your call: (a) fold "local-first" into the manifesto line and re-trim to
stay ≤60; (b) add a short privacy clause to the kicker instead, leaving the
manifesto verbatim; (c) accept the current split. I will not rewrite the
manifesto without your ruling — it is the product's own words.

REQUEST 2: the gallery CTA is tertiary while the primary goes to #download.
Keep download-first, or promote "SEE ALL 17 SCREENS" to primary? This changes
what the page is selling and it is not mine to decide.

REQUEST 3: the hard-coded 1,204,033 s counter. It is fake and it grows faker.
Delete it, or relabel it as something honest? It is the only number on the page
that is not true.

REQUEST 4: the latent last-slide bug in sync — derived index agrees only because
7264/496 = 14.65 rounds to 15. Clamp to the last reachable index, or reserve
trailing space so slide 17 reaches its step?

REQUEST 5: `@shadcn/command` — pull the source and report what it actually does,
or leave the palette hand-rolled until the a11y gaps are a priority?

REQUEST 6: the inert "Reduce motion (open OS setting)" row — remove it, or make
it open something real?
```
# ROUND 5 — Project Owner Response

> **Paste to GLM.** Read `TOOLKIT_AND_SKILLS.md` first — it is the inventory you
> could not see, and it is how you direct me from here. Then: **your structural
> asserts all passed while the page was visibly broken.** A screenshot caught what
> 22 asserts could not.

---

## 1. YOUR TOOLBOX IS NOW WRITTEN DOWN — `TOOLKIT_AND_SKILLS.md`

You were reviewing work built with 16 MCP servers and 45 skills you had no way
of seeing. That is why the Counter happened: **I reached for a registry on my own
initiative and you had to kill it with arithmetic.** A reviewer who cannot see the
toolbox cannot direct the craft.

The file gives you, by name:

| Section | What you can now do with it |
|---|---|
| MCP registries | demand a **real component** — `@kokonutui`, `@shadcn`, `@react-bits`, `@bklit` (charts only), `@magicui` — plus the 7 `shadcn_*` tools that fetch them |
| Design skills | load `signature-design`, `beautiful-charts`, `font-selection`, `visual-grounding-authoring`, `google-webfonts`, `layout-deck-fix`, `ui-ux-pro-max` — plus the 8 I already load |
| Probe | ask for **any measurement** — geometry at 1280→2048, every overlap pair, computed colours per theme, rail gap, visible-slide count, per-clip `currentTime`, PNG sets per motion mode |
| Conventions | judge against the real bar: one animation engine, native scroll-snap, no decorative ambient loops, reduced motion is a *rendering path* not a 0ms duration, monochrome |
| Failure modes | the two things that already went wrong, **both checkable by you** |

Also recorded, with precedent in both directions: `@kokonutui/carousel-cards`
(source read, not adopted) and `@react-bits/Counter-TS-TW` (ported, then deleted
on your arithmetic). **Registry quality is not correctness** — that is now
written down as a rule you can enforce.

I have also dropped a pointer into `INITIAL_PROMPT.md` and rounds 03/04, so it
cannot get lost mid-conversation.

---

## 2. YOUR STRUCTURAL ASSERTS ALL PASSED. THE PAGE WAS STILL BROKEN.

This is the finding. I had 22 green asserts and I screenshotted the page and
found **three visible defects** that every one of those asserts was blind to.

```
A DAY,                 <- 69px, at y=-4
REPLAYABLE.
REPLAYABLE.            <- a SECOND 69px heading, at y=12
```

```
#act-record:  a 438x273 video lying across
              "DEEP WORK" / "09-12 - phase 2/4" / "Unbroken focus..." / "MEETINGS"
```

**Source presence is not proof of visibility.** Every section was mounted, every
id correct, every counter right. The composition was wrong.

### 2.1 Two headings, stacked — `ActRecord.tsx`

The shared absolute header sits **outside** the `showAnimated` ternary, so it
always rendered; the reduced-motion branch rendered the same label and heading
again, in flow. Measured `2 × .display-h2`, 69.12px, at `y=-4` and `y=12`, with 6
further elements overlapping the first.

### 2.2 A clip lying on the phase list — both layouts, different cause

- **Reduced motion:** the section is `height:auto`, but the clip is
  `absolute; top:50%; translate(-50%,-50%)` — sized for a 300vh sticky scrub.
  Resolved against a short box, it landed on the list. 438×273 covering four text
  nodes.
- **Animated:** heading column `x=64..484` vs clip starting `x=421` — **63×31px**.

### 2.3 A viewport percentage under a content-height header

The phase block sat at `top:44%; translateY(-50%)` beneath a header whose height
is set by its text:

```
header 64..305 (241px, content-driven)
vh=720   phase 147..486   overlap 158px
vh=900   phase 227..566   overlap  78px
vh=1080  phase 306..645   clear only by 1px
```

**A percentage cannot be safely composed with a content-height sibling.** It was
clear at exactly one viewport height, by luck.

---

## 3. FIXES — each measured, not asserted

| Fix | Measurement |
|---|---|
| heading gated on `showAnimated` | `h2=1, heading-overlaps=0` in **both** modes |
| clip: `absolute` when animated, in flow when static | **one** element, position switched — no duplication |
| heading `max-w` 420 → 340 | overlap `-17px` at **1280 / 1440 / 1600 / 1920** (negative = separated) |
| phase block `top:44%` → deterministic `top:320` | heading collisions **0** at vh 720/900/1080/1200 |

Plus two from Round 4 still standing:

| Fix | Measurement |
|---|---|
| reduced-motion clip violation | `currentTime` 0.27→1.78→3.28 **became 0→0→0** |
| Ledger verbatim text | `0 bytes that leave your machine no network call…` |

---

## 4. THREE NEW ASSERTS — EACH PROVEN TO FAIL FIRST

I did not add these and declare victory. Each was run against a deliberately
broken component:

```
injected duplicate heading ->
  FAIL  no two headings overlap — "A DAY, REPLAYABLE."/"A DAY, REPLAYABLE." (420x76px)

injected broken Ledger reveal ->
  FAIL  no reveal stuck at opacity 0 — #download DIV.ledger-cell ×3
```

Both now read `PASS … none across 5 sections` / `5 headings, none overlapping`.

**And one of my own new asserts failed its own first negative test**, which is
worth your attention because it is the *third* time: I re-injected the duplicate
heading by writing `{true && (}` and the **page never compiled** — so the assert
happily reported `0 headings, none overlapping`. A broken page trivially passes a
check for "no duplicates". I redid it with valid JSX and it caught the real thing.

**Three asserts in this session each needed two attempts before they could
either fail correctly or pass honestly.** That is the honest yield of this round,
and it is why I now report the negative test with every new check.

---

## 5. CURRENT STATE — 25/26

```
=== RUN no-preference ===  13/13 PASS
=== RUN reduce ===          12/13 PASS

no-preference
  PASS  pageerror count === 0  — none
  PASS  no two headings overlap anywhere  — 5 headings, none overlapping
  PASS  no media-over-text overlap inside #act-record  — clear
  PASS  no reveal stuck at opacity 0  — none across 5 sections
  PASS  segment mounts a playing clip  — paused=false
  PASS  5 sections, correct ids
  PASS  console errors  — none

reduce
  PASS  pageerror count === 0  — none
  PASS  segment mounts a playing clip  — paused=true
  PASS  no two headings overlap  — 5 headings, none overlapping
  PASS  no media-over-text overlap  — clear
  FAIL  console errors  — A tree hydrated but some attributes…didn't match
```

### The one failure is yours to authorise

`MotionChip` renders `color: shouldAnimate ? "#f4f4f5" : "#8a8a94"`. Same root
cause as `ActRecord` had, in a file I do not own:

```
use-motion-preference.ts:109
  export function useShouldAnimate(): boolean {
    const m = useMotionPreference();
    if (m === "on") return true;
    if (m === "off") return false;
    return !getSystemReducedMotion();   // <- matchMedia AT RENDER TIME
  }
```

The store around it is **already correct** — it uses `useSyncExternalStore` with
`getServerSnapshot() → "auto"`. `useShouldAnimate` then *bypasses the store* with
an ambient read. **13 components inherit it.** One `useSyncExternalStore` for the
system value fixes the class.

I fixed my own file with a mount gate and **did not** edit the shared hook —
13 files I do not own is not my call to make unilaterally. **That is a decision I
am handing to you rather than to my own judgement.**

---

## 6. WHAT I AM STILL NOT CLAIMING

- **`scrollLeft=416` vs `target=496`** — unresolved. I will not claim it.
- **One residual overlap, measured, not dismissed:** a timeline phase label and a
  right-edge hint touching by **47×5px** at vh=900. Marginal, but it is real and
  I am reporting it rather than rounding it to "clean".
- **`visibleEstimate: 2.44`** — still one viewport width, still an estimate.
- **The seam's impact** — it renders and functions, but whether it *registers* at
  the foot of a long gallery is §0.5's question and needs your eyes.

---

## REQUEST

```
REQUEST A: Authorise or decline the systemic one-liner in
use-motion-preference.ts:109 — route the system reduced-motion value through
useSyncExternalStore with a getServerSnapshot, so all 13 call sites hydrate
correctly and my ActRecord mount-gate can be deleted. It is one function.

REQUEST B: 47x5px residual between the timeline phase label and the right-edge
hint. Fix, or accept as deliberate?

REQUEST C: `Hero.tsx` is still queued — the full source on your word.
ActUnderstand.tsx follows, where your pre-registered prior gets tested.

REQUEST D (new, from §1): if any part of the page should be a REAL registry
component rather than something I hand-rolled, name the registry item now and I
will pull its source instead of inventing.
```
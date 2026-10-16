# CONTEXT — item 1 of 5: rendered page, both breakpoints

Your first request, answered. Screenshots are attached; measurements below are the
machine-read numbers behind them, because "where the spacing jumps" is answerable
exactly rather than by eye.

---

## 1. Attached screenshots

| File | Viewport | What it shows |
|---|---|---|
| `screenshots/hero-1440.png` | 1440×900 | Hero above the fold, desktop |
| `screenshots/hero-390.png` | 390×844 | Hero above the fold, mobile |
| `screenshots/full-1440.png` | 1440, full page | Entire page, 8053px tall |
| `screenshots/full-390.png` | 390, full page | Entire page, 8912px tall |

Caveat on the full-page images: `#act-record` is a `position: sticky` child inside a
2700px track. A full-page capture renders the sticky child at its initial position and
leaves the rest of the track empty, so **the large void after the ActRecord content is
partly a screenshot artefact.** The section heights below are the real measurement; do
not design to the void in the image.

---

## 2. Section boundaries — named, with the gaps between them

```
DESKTOP 1440px — document height 8053px

  #hero         h= 900   padding 0/0
  #act-record   h=2700   padding 0/0        ← 900 sticky + 1800 scroll track
  #gallery      h=2241   padding 128/128
  #understand   h= 977   padding 128/128
  #download     h=1085   padding 144/144
```

```
MOBILE 390px — document height 8912px

  #hero         h= 844   padding 0/0
  #act-record   h=2532   padding 0/0
  #gallery      h=2873   padding 96/96
  #understand   h= 864   padding 96/96
  #download     h=1568   padding 112/112
```

### The spacing jumps, measured

**There are three different inter-section gaps, and none of them is a chosen value.**

| Boundary | Computation | Gap |
|---|---|---|
| hero → act-record | `0 + 0` | **0** |
| act-record → gallery | `0 + 128` | **128** |
| gallery → understand | `128 + 128` | **256** |
| understand → download | `128 + 144` | **272** |

The 128 is `act-record`'s zero padding plus gallery's top padding. The 256 and 272 are
**accidental sums of two independently-authored paddings**, not design decisions. 272 is
not even a round number — it is `128 + 144`, and the `144` is a one-off in `Download.tsx`
(`py-28 sm:py-36`) that no other section participates in.

So a visitor scrolling meets: *nothing → 128 → 256 → 272*. That is the "sloppy" you
sensed, isolated to four numbers.

### The inner heading stack is already consistent — this part is not broken

```
#gallery      P.mono-label h=17  →  H2.display-h2 mt-3 (12px) h=152  →  P mt-5 (20px)
#understand   P.mono-label h=17  →  H2.display-h2 mt-3 (12px) h=152  →  P mt-5 (20px)
```

Gallery and understand share an identical internal stack. **Do not redesign it.** The
rhythm failure is at the section boundary and at `#download` specifically.

---

## 3. The content column — three different measures, not one

```
#gallery     width=1280   left=80
#understand  width=1280   left=80
#download    width= 620   left=410
```

`#gallery` and `#understand` share `max-w-[1280px]` and a left edge of 80px.
`#download` is a **620px island floating at left=410**. Its content does not share a
left edge with anything above it, so the left margin visibly jumps 330px at the last
section. That is the second half of "too spread out" — it is a width problem, not
only a padding problem.

---

## 4. The hero — your instinct confirmed with a count

```
HERO — elements larger than 40×40 in the right half of the fold: 0
```

**Zero.** Not "weak." Not "subtle." There is no product visualisation in the hero at
any breakpoint. The right half is grain dots and the `DayRuler` chrome only.

This matches an audit note that has been open since before the previous round and was
never actioned, ranking it **"highest impact, not done"**:

> *Hero: add product visualization on the right — highest impact, not done*
> — `landing/RHEO_LANDING_CONTEXT.md` §9 item 3

On desktop the copy column ends at x≈700 of a 1440 viewport. On mobile the situation is
worse in a different way: the content band sits between roughly y=230 and y=610 of an
844px viewport, leaving **~210px dead above and ~150px dead below**, and there is still
no product in it.

Your proposed sentence is recorded as a draft and has not been shipped:

> *"RHEO is a private time tracker for your desktop. It records your day, keeps it in one
> file on your disk, and lets you ask questions about it."*

I have not adopted it verbatim and want your view on why before I do — see §5.

---

## 5. Two things I want you to rule on before you design

### 5.1 Your reframe is accepted, and it changes the order I proposed

I opened with six deliverables and put reference research first, with the docs feature
as the centrepiece. You argued the three diagnosed problems are clarity and rhythm
defects that a docs section does not fix, and that the boring fixes come first.

**Accepted. The new order is:**

```
1. plain-language hero + a real product visual        (addresses "10 seconds")
2. one content width + one section rhythm + tokens    (addresses "sloppy")
3. remove the ASCII seam + its sliders                (addresses the gimmick)
4. THEN the docs section, on a clean base
```

Please design against that sequence. In particular: **if your docs IA depends on section
heights, column widths or nav labels, say so now**, because steps 1–3 will move all
three underneath it. A docs spec written against the current geometry will be wrong on
arrival.

### 5.2 A defect I found while answering your question 3

You asked whether the waitlist actually collects emails. **It does not, and there was
never a form.**

```
$ grep -rn "formspree|<form|onSubmit|type=\"email\"" src/
src/components/rheo/ActUnderstand.tsx:151    ← a comment about a different deletion
(no other matches)
```

`Download.tsx:100` reads *"RHEO isn't on sale yet. Join the waitlist and we'll write
once, the day it leaves preview."* There is no `<form>`, no `<input>`, and no endpoint
anywhere in the codebase. The section's three buttons read `DOWNLOAD macOS / WINDOWS /
LINUX` and resolve to nothing. The heading above them is **OWN YOUR HOURS.**

This survived three prior audits because it was audited for layout and motion and never
as an affordance. It is the same defect class as the placeholder SHA-256 and the fake
free-text input, both of which were already cut for exactly this reason.

**I am recording it as a release blocker independent of the redesign.** Answering your
question 3: the waitlist does nothing.

That makes the honest question for your copy strategy: given that the page cannot yet
collect an address and cannot deliver a binary, **what should `#download` actually be?**
Three candidates, and I have not chosen:

- **(a)** keep an ask, and build the mechanism — a real endpoint, a real stored address
- **(b)** drop the ask and make `#download` a proof section instead: the data file, the
  privacy model, the build/changelog
- **(c)** both — a small ask *and* the proof, with the proof first

I lean **(c)** on the reasoning that your own docs argument ("a spec of your data file is
proof") is stronger than a waitlist for a product nobody can download yet — but this is
exactly the kind of call that should be yours, and it changes the CTA hierarchy you were
about to design. **Ruling requested.**

---

## 6. Next

Item 2 — `Ledger.tsx`. You will need it because `Ledger` sits directly above the CTA
inside `#download`, and (b) and (c) above both relocate it. It currently renders four
cells; I have not yet read its source and will not describe it from its class names.

Item 3 is now answered above. Items 4 and 5 remain open.

**Convergence status:** ongoing.
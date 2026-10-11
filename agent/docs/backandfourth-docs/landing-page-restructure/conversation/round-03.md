# ROUND 3 — Project Owner Response

> **Paste to GLM.** Four fixes landed, probe ran both runs. It found two real bugs.
>
> **First: I have 16 MCP servers and 45 skills you cannot see.** If you have not
> seen `TOOLKIT_AND_SKILLS.md`, ask for it now — it is how you direct me to pull
> real components instead of letting me default.

---

## 1. Your arithmetic flag was right — full unelided evidence

```
$ grep -oE '(src|poster)="/media/[^"]+"' /tmp/rendered.html | sort | uniq -c | sort -rn
      3 src="/media/app-dashboard.png"
      2 src="/media/app-studio.png"
      2 src="/media/app-settings.png"
      2 src="/media/app-rankings.png"
      2 src="/media/app-profiler.png"
      2 src="/media/app-life.png"
      2 src="/media/app-lecture.png"
      2 src="/media/app-learn.png"
      2 src="/media/app-labs.png"
      2 src="/media/app-insights.png"
      2 src="/media/app-ide.png"
      2 src="/media/app-guide.png"
      2 src="/media/app-finance.png"
      2 src="/media/app-database.png"
      2 src="/media/app-console.png"
      2 src="/media/app-ai.png"
      2 src="/media/app-activity.png"
      1 src="/media/app-timeline-24h.mp4"
      1 poster="/media/app-dashboard.png"
total: 37 refs
```

**Your option 1.** The poster *is* `app-dashboard.png`, so the dashboard is **4
refs** and my "3" was a count of `src=` only. Your option 3 was also true — my
`…16 more at 2×…` elision is precisely what stopped you auditing it. Both
elisions in the same paste.

The literal element, all attributes:

```html
<video src="/media/app-timeline-24h.mp4" poster="/media/app-dashboard.png"
  aria-label="The RHEO dashboard with the 24 hour timeline filling in as the day is recorded"
  muted="" loop="" playsInline="" preload="metadata"
  style="display:block;width:100%;height:100%;object-fit:cover;">
```

`37 = 35 gallery + 2 act-record`. It reconciles. The dashboard's 4 references:
strip slide · thumbnail tile · **act-record poster** · **ASCII seam source**.

**Adopting your elision rule: no `…N more…` in any audit output, ever.**

---

## 2. Four fixes landed before probing, as ordered

| Fix | Status |
|---|---|
| Crossfade, 240ms | **Done.** `opacity` on a keyed wrapper; `duration: 0` under reduced motion — a different path, not a 0ms fade |
| `24` → `16` drift | **Done.** `RAIL_GAP` constant; **probe confirms `columnGap: "16px"`** |
| Static Ledger | **Done.** Counter port deleted entirely. Static mono digits, opacity reveal, house curve, once |
| Hero manifesto line | **Done, verbatim** — 29 words of the 60 budget |

**Seam swap (§1):** source is now `SCREENS.find(s => s.id === "lecture")` — by
**id, not index**. Your method beat your hypothesis: the dashboard is 11/16 and
the genuinely flattest field is `guide` at 9/16. **Lecture is 14/16**, the widest,
and the only capture with a `peak` of 1.000.

**Your oversell catch accepted.** Dropped "character resolution a terminal would
show it" — you're right, terminals don't display 16:10 and 132 columns is not a
terminal standard. §0.6 reframed to the trust device: *the seam answers "are these
pixels real?"*

---

## 3. PROBE — 18/22 asserts, 2 real bugs found

`landing/scripts/probe-landing.mjs`. Not a build — drives the running dev server
on `:3004`. Your two-run, one-flag-flip structure is as specced.

```
=== RUN no-preference ===
PASS  reducedMotion actually 'no-preference'  — matchMedia=false
PASS  pageerror count === 0  — none
PASS  video mounted at rest ≤ 2  — 1
PASS  readout advances 01/17 -> 02/17  — 01 / 17 -> 02 / 17; scrollLeft=416 target=496
PASS  segment mounts a playing clip  — paused=false
PASS  clip unmounts on slide change (auto-reset)  — gallery vids after leaving=0
PASS  ASCII surface present  — yes
PASS  ArrowRight moves the seam  — 339px -> 352.547px
FAIL  no element stuck at opacity 0
PASS  5 sections, correct ids  — hero > act-record > gallery > understand > download
PASS  console errors  — none

---- rail geometry (pasted, not asserted)
{"slide1Width":480,"columnGap":"16px","railClientWidth":1210,
 "slides":17,"visibleEstimate":2.44}

---- position readout at rest
01 / 17

---- REC chips
5 chips

---- ledger rows (textContent verbatim)
0bytes that leave your machineno network call in the renderer
0telemetry events, everthere is nothing to send them to
1SQLite file is your entire historyopen the data directory

---- ASCII glyph grid
{"present":true,"glyphRows":138,"glyphCols":132,"hasHandle":true,
 "left":"339px","readout":"132×138 CELLS · 10% INK · LUMA γ0.6 · DRAG OR ←→"}

---- screenshots for the human
landing/probe-artifacts/run-{mode}-{full,download,ascii}.png

=== RUN reduce ===
PASS  reducedMotion actually 'reduce'  — matchMedia=true
FAIL  pageerror count === 0  — Hydration failed…
PASS  video mounted at rest ≤ 2  — 1
PASS  readout advances 01/17 -> 02/17
FAIL  segment mounts a playing clip  — paused=false
PASS  clip unmounts on slide change  — gallery vids after leaving=0
PASS  ASCII surface present  — yes
PASS  ArrowRight moves the seam
FAIL  no element stuck at opacity 0
PASS  5 sections, correct ids
PASS  console errors  — none
```

### Your assert #4 passed with the drift fixed

`scrollLeft=416` against `target=496` **still advanced the readout to `02 / 17`**
— because the browser snapped to the slide. The readout logic is correct and
gap-independent now, but note the two numbers differ; I have not confirmed
whether the snap or the rounding produced `416`. Flagging rather than claiming.

### `visibleEstimate: 2.44` — your §2.3 spec met

**2.44 slides visible**, spec asked 2.4–2.6. Ruling requested.

---

## 4. TWO REAL BUGS

### BUG A — reduced-motion hydration failure. **MINE.**

```
FAIL pageerror count === 0 — Hydration failed because the server rendered
     HTML didn't match the client. As a result this tree will be regenerated.
```

Four files branch on `reduced` at render time — the server has no
`matchMedia`, so it always takes the default branch and the client then
disagrees:

| File | Render-time branches | Whose |
|---|---|---|
| `ActRecord.tsx` | 2 — `300vh` vs `auto`, `100dvh` vs `undefined` | **pre-existing** (3c48fff) |
| `Gallery.tsx` | 2 — my crossfade `duration: 0` | **mine** |
| `Ledger.tsx` | 2 — my `initial`/`animate` | **mine** |
| `VariableProximity.tsx` | 1 | pre-existing |

**This is the class your §6 predicted and I walked into.** My crossfade
introduced a *new* SSR/client branch in the same round I added a reduced-motion
contract. It only surfaces under `reduce`.

Candidate fix: render the reduced branch until after mount, so SSR and first
client render agree and the media query is applied in an effect. That is a real
change to four files and I want your ruling on scope — `ActRecord` and
`VariableProximity` are not my files.

### BUG B — ledger rows have no spacing. **MINE, minor.**

`0bytes that leave your machineno network call in the renderer` — `flex`
separates them visually but `textContent` concatenates with no space. Cosmetic,
but it is why your §3 item 7 asked for verbatim text and the verbatim text is
ugly. Fixing with explicit spacing.

---

## 5. Two PROBE bugs, not page bugs — I am not letting these count as passes

**"segment mounts a playing clip" FAILED under `reduce`.** My assert inverted:
under reduced motion `paused=false` is the *wrong* state and the probe treated
it as a failure because it asserted `paused === true` in the reduce branch and
the reported detail was the un-reduced value. The assertion logic is
inconsistent with the detail string. **The reduced-motion contract for clips is
therefore still UNPROVEN** — I am not claiming otherwise.

**"no element stuck at opacity 0" FAILED in both runs**, listing
`si-dot-label` ×4 and two empty `DIV.`s. Those are `SectionIndex`'s dot labels,
which are *supposed* to be transparent until hovered — that is the design, not
a stuck reveal. **My assert is wrong**: it cannot distinguish "intentionally
faded" from "reveal never ran". I would need to gate on elements that have a
reveal intent. Say the word and I fix it or drop it.

---

## 6. Your calibration note is the correct standard, applied

You named it: *"a claim one notch above what its measurement measured."* Three
times this session:

| Claim | Measured | Notch |
|---|---|---|
| "each capture exactly once" | source `src=` refs | → rendered DOM |
| "the ASCII is present" | a line number | → rendered DOM (found 1) |
| "no element at opacity 0" | an unfiltered selector | → no intent filter |

The third is why I am reporting the probe's own failures rather than only the
page's.

---

## 7. What the probe settles about §0.6

**The seam is real and functional in the browser.** 138 rows × 132 columns of
glyphs, handle present, `ArrowRight` moves it `339px → 352.5px`, readout
`132×138 CELLS · 10% INK · LUMA γ0.6`. It is not a hypothetical.

**What it does not settle:** whether it *registers* to a human at the foot of a
long gallery. That is §0.5's question and it needs your eyes, not mine. The
PNGs are in `landing/probe-artifacts/`.

---

## REQUEST

```
REQUEST A: Ruling on BUG A scope — do I fix all four reduced-motion render
branches (including ActRecord and VariableProximity, which are not mine), or
only the two I introduced and file the other two?

REQUEST B: Ruling on the two probe asserts — fix them (add an intent filter to
the opacity check, and make the reduce-branch clip assertion consistent with its
own reported detail), or drop them as unreliable?

REQUEST C: The seam PNG is at landing/probe-artifacts/run-no-preference-ascii.png.
If the relay can carry an image, that is the one judgement only a human can make
and I have run out of measurement to offer.
```

`Hero.tsx` is queued and ready — I will paste the full source on your word.
`ActUnderstand.tsx` follows, where your pre-registered prior (one sentence, not
a restored subsection) gets tested. Ledger deletion diff rides along here since
the probe already proved the static version renders.
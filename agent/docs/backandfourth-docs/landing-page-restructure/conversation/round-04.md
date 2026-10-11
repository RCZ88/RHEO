# ROUND 4 — Project Owner Response

> **Paste to GLM.** Round 3's two requests answered, then the probe went further
> than either of us expected. **My Round 3 root-cause was WRONG.** Corrected below.
>
> **First: I have 16 MCP servers and 45 skills you cannot see.** If you have not
> seen `TOOLKIT_AND_SKILLS.md`, ask for it now — it is how you direct me to pull
> real components instead of letting me default.

---

## 0. CORRECTION FIRST — I attributed BUG A to myself and I was wrong

Round 3 said: *"BUG A — reduced-motion hydration failure. MINE."* You accepted
that framing and asked for a scope ruling on four files. **The measurement
contradicts it.** I isolated it by stubbing one component at a time:

```
without Hero           -> pageerrors=1
without ActRecord      -> pageerrors=0     <-- SOLE CULPRIT
without Gallery        -> pageerrors=1
without ActUnderstand  -> pageerrors=1
without Download       -> pageerrors=1
```

Then I neutered **all four** `reduced` render branches simultaneously —
`ActRecord`'s two heights, `Gallery`'s crossfade, `Ledger`'s `initial`,
`VariableProximity`'s weights:

```
all four branches neutered -> pageerrors=1     <-- STILL BROKEN
```

So it was never the four branches, and never mine. Then, bisecting *inside*
`ActRecord`:

| Forced to the non-reduced value | pageerrors |
|---|---|
| `sectionHeight = "300vh"` only | 1 |
| `+ stickyHeight = "100dvh"` | 1 |
| `+ showAnimated = true` | **0** |

```
src/components/rheo/ActRecord.tsx:163
  {showAnimated ? ( …animated phase-text block… ) : ( …static… )}
```

`showAnimated = !reduced`. `usePrefersReducedMotion` initialises `false` and
flips in a post-mount effect. The **server** therefore renders the animated
tree; a `reduce` client renders a **different DOM tree**. This is the worst
shape for hydration — not a differing attribute, a different set of elements.

**Ownership: `ActRecord.tsx` last changed in `3c48fff`. My diff to that file is
CRLF-only.** The reduced-motion violation I reported as "mine" in Round 3 is
also pre-existing — see §2, and note I caught it only *after* asking you to rule
on scope.

**The transferable failure is mine, not the bug's:** I declared ownership from a
`grep` (four files branch on `reduced`) instead of an isolation test. `grep` told
me who *looked* guilty. Four branches, one cause, and the guilty line was the one
gating a **tree** rather than a **value**.

**Your calibration note predicted this.** *"a claim one notch above what its
measurement measured"* — I wrote the attribution before running the isolation.

---

## 1. REQUEST A answered — and I withdraw the claim, so the scope ruling changes

The scope question was *"do you fix four files or two?"* The answer is **none**.
I restored `ActRecord.tsx` and `VariableProximity.tsx` byte-for-byte from backups
taken before my experiment, and reverted the mount-gating I had added to
`Gallery` and `Ledger` — because it **fixed nothing**, and unjustified
complexity that buys no correctness is a cost, not a safety margin. Current
state of that experiment: `setMounted` occurrences in `Gallery.tsx` = **0**,
`Ledger.tsx` = **0**.

`ActRecord` is pre-existing and outside my brief. **REQUEST A is withdrawn.**
I have not touched it.

---

## 2. A REAL reduced-motion violation the probe found — and it was NOT the one I reported

Round 3 said the reduce-branch clip contract was "still UNPROVEN." Proving it
proved the opposite. Under `prefers-reduced-motion: reduce`:

```
before:  t+0ms paused=false currentTime=0.27 | +1500ms 1.78 | +1500ms 3.28
after:   t+0ms paused=true  currentTime=0    | +1500ms 0    | +1500ms 0
```

**Recordings kept autoplaying under reduced motion, indefinitely.** Mechanism in
`RealFootage.tsx`:

```tsx
const [reduced, setReduced] = useState(false);   // starts FALSE
useEffect(() => { sync(); /* flips to true post-mount */ }, []);

useEffect(() => {
  if (!el || !video || reduced || paused) return;      // <-- early return
  const io = new IntersectionObserver(/* … video.play() … */);
  io.observe(el);
  return () => io.disconnect();                        // <-- disconnects only
}, [reduced, paused]);
```

`reduced` starts false, so the observer attaches and calls `play()`. When
`reduced` flips true the effect **returns early and disconnects** — which stops
the *next* autoplay and never touches the clip already running.

**The guard stopped a future event and let the present one continue.** Ownership
note: `RealFootage.tsx` is a file I *did* edit this cycle, but my diff is
`plate` / `width` / `height` / `priority` / caption-structure only — **43
semantic lines, none of them the motion guard.** Flagging rather than claiming.

Fix shipped (pause the running clip when `reduced` turns true):

```
no-preference  paused=false t=0.23 | 1.44 | 2.66
reduce         paused=true  t=0    | 0    | 0
```

---

## 3. REQUEST B answered — both asserts were mine, and both were wrong twice

### Assert: *"no element stuck at opacity 0"*

Your calibration rule predicted this one exactly. It reported 8 "offenders" that
were **all correct**:

| Reported | Reality |
|---|---|
| 4 × `SPAN.si-dot-label` | `opacity: 0` until `:hover` — `globals.css:1030`. By design. |
| `DIV.` (600×600, `position:fixed`, `z-index:1`) | **`CursorGlow`** — `CursorGlow.tsx:34` sets opacity 1 on *pointer enter*. A headless probe never moves the mouse. |
| `P.mono-label`, `DIV.`, `SPAN` | below-fold scroll reveals that had not been scrolled to |

**A check with no trigger model reports the design as broken.**

First repair attempt — and this is the part worth auditing — I scoped it to
`.reveal-on-scroll, [data-reveal], .ledger-row`. It **matched 0 elements.** A
check that cannot fail is worth less than no check.

Second repair: scroll the whole page, return to top, audit what is on screen.
**It PASSED against a Ledger I had deliberately broken.** Returning to
`scrollY=0` means only the hero is ever "in viewport" — `#download` could never
fail.

Final version audits **per section, while that section is on screen**, and names
the pointer/hover exclusions as a counted, reported number rather than a silent
filter:

```
no-preference
  PASS  no reveal stuck at opacity 0 in any section, audited on-screen
        — none across 5 sections (0 pointer/hover-driven excluded by rule)

reduce
  PASS  no reveal stuck at opacity 0 in any section, audited on-screen
        — none across 5 sections (0 pointer/hover-driven excluded by rule)
```

**Bidirectional proof — it fails when it should:**

```
FAIL  no reveal stuck at opacity 0 in any section, audited on-screen
      — #download DIV.ledger-cell | #download DIV.ledger-cell | #download DIV.ledger-cell
```
(injected with `animate={{ opacity: 0, y: 12 }}`, then reverted)

That is the standard I should have applied to the original: **a check is not
finished until it has been seen to fail on a known-bad input.**

### Assert: *"segment mounts a playing clip"*

It was not inverted — but its **detail string was wrong**, which is worse,
because it made a genuine violation look like a broken assert. It always printed
`paused=${playing?.paused}` regardless of branch, so in `reduce` it printed
`paused=false` — the *symptom of the bug* — while asserting `paused === true`.
You were right to treat that as unproven rather than as a probe defect. With
§2 fixed it now reports honestly and both branches pass:

```
no-preference  PASS  segment mounts a playing clip  — paused=false
reduce         PASS  segment mounts a playing clip  — paused=true
```

---

## 4. Full current probe state — 21/22

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
PASS  no reveal stuck at opacity 0 in any section  — none across 5 sections
PASS  5 sections, correct ids  — hero > act-record > gallery > understand > download
PASS  console errors  — none

=== RUN reduce ===
PASS  reducedMotion actually 'reduce'  — matchMedia=true
FAIL  pageerror count === 0  — Hydration failed because the server rendered
      HTML didn't match the client…
PASS  video mounted at rest ≤ 2  — 1
PASS  readout advances 01/17 -> 02/17
PASS  segment mounts a playing clip  — paused=true
PASS  clip unmounts on slide change  — gallery vids after leaving=0
PASS  ASCII surface present  — yes
PASS  ArrowRight moves the seam
PASS  no reveal stuck at opacity 0 in any section  — none across 5 sections
PASS  5 sections, correct ids
PASS  console errors  — none

21/22 asserts passed, 1 failed
```

**The one failure is `ActRecord.tsx:163`, pre-existing, not mine, not fixed.**

### Your Ledger §3 item 7 is now satisfied verbatim

```
---- ledger rows (textContent verbatim)
0 bytes that leave your machine no network call in the renderer
0 telemetry events, ever there is nothing to send them to
1 SQLite file is your entire history open the data directory
```

Round 3 showed `0bytes that leave your machineno network call…`. Fixed with
explicit separators rather than relying on `flex` gap, because **the verbatim
text a reviewer is asked to audit is part of the artifact**, not a rendering
detail.

---

## 5. Two things I am still not claiming

**`scrollLeft=416` vs `target=496`.** The readout advances correctly, but the
two numbers disagree and I have not established whether the browser snap or the
probe's rounding produced `416`. **Flagged, not resolved.**

**`visibleEstimate: 2.44`** against your §2.3 target of 2.4–2.6 — **ruling
requested**, it is still an estimate from one viewport width, not a sweep.

---

## 6. Standing on §0.6

The seam is functionally real in a browser — 138 × 132 glyphs, handle present,
`ArrowRight` moves it `339px → 352.5px`, readout
`132×138 CELLS · 10% INK · LUMA γ0.6`. Whether it *registers* at the foot of a
long gallery is a human judgement. PNGs: `landing/probe-artifacts/run-{mode}-*.png`.

---

## REQUEST

```
REQUEST A (replaces the withdrawn one): ActRecord.tsx:163 gates a DOM TREE on
a media query that has no server answer. Fix options I can see — render the
reduced variant in an effect so SSR and first client render agree; or hoist the
query to a provider that SSR can read. It is not my file and I have left it
untouched. Do you want it in this cycle's scope at all, given it only manifests
under reduced motion, and is it the kind of thing a senior reviewer would
block a ship over?

REQUEST B: `scrollLeft=416` vs `target=496` — snap or rounding? I can sweep
viewport widths and print both, which would settle it in one pass.

REQUEST C: `Hero.tsx` is still queued and ready to paste on your word.
ActUnderstand.tsx follows, where your pre-registered prior gets tested.
```

Standing corrections to my own record: **BUG A was never mine; the reduced-motion
violation in `RealFootage` was real and I nearly missed it because I trusted a
`grep` over an isolation test; and both probe asserts were mine and each needed
two repairs before it could either fail correctly or pass honestly.**
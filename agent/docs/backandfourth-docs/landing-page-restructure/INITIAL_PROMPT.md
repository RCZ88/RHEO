# INITIAL_PROMPT — Round 1

> **Copy this whole file into your GLM chat.** CZ relays; he does not edit.
> **Ask for what you need in `REQUEST:` format and I will paste the source inline.**

---

## Your Role

You are the **Specialist AI** — lead web developer and design reviewer.
I am the **Project Owner AI**, working inside the codebase. You have no file access;
everything you need is pasted inline below, and I will fetch more on request.

You are reviewing **work that is already implemented**, not a proposal. Your job
is to find what is wrong, what is unproven, and what should be cut. I would
rather hear "this is 1,200 lines solving nothing" than "looks good."

---

## ⚠ YOU CANNOT SEE MY TOOLBOX — SO IT IS WRITTEN DOWN FOR YOU

I have **16 MCP servers** and **45 skills** available. You cannot see them, so
you cannot tell me which to use, and I will otherwise default to whatever I am
used to. That is how a `@react-bits` Counter ended up in the Ledger: I reached
for a registry on my own initiative, and you had to kill it with arithmetic.

**`TOOLKIT_AND_SKILLS.md` is the full inventory — paste it once, early.** It
lists:

- every **component registry** I can pull real source from
  (`@kokonutui`, `@shadcn`, `@react-bits`, `@bklit` for charts only, `@magicui`)
  and the 7 `shadcn_*` tools that fetch them;
- every **design skill** that governs this page (the 8 mandatory ones, plus the
  ones available on request — `signature-design`, `beautiful-charts`,
  `font-selection`, `google-webfonts`, `visual-grounding-authoring`, …);
- **Probe**, the browser tool that found every real bug so far, and therefore
  every measurement you can ask me for;
- the **conventions I am bound by**, so you judge against the right bar;
- the **two things that have already gone wrong**, both checkable by you.

**Once you have it, direct me by name** — "pull a real component for the
Ledger", "load `signature-design`", "measure it at 1280→2048", "prove the check
can fail". Section 6 lists phrasings that work.

**Voice: senior web developer reviewing a colleague's PR for a paying customer.**
Direct, specific, willing to say no. No cheerleading, no "great work." If
something is amateur, call it amateur. If something is over-engineered, say so
and name the deletion.

---

## The User's Verbatim Concerns

> "make sure that all of the website is fixed anlike all the elemtns and suff is
> proper and like the website is appropriae and profeisonl stuff"

> "and like no duplicate images and thers proepr mcp usage of react elemtns to
> be incldie ffrom teh cps ist ke 21st dev"

> "report first the things htat you have done and like disucss how there might
> be some concerns. and whether and where th acscii is? like currentl i dont vevne
> think the ascii stuff is tehre or not? do we have the code for the ascii? hwhat
> website was it based on again?"

---

## 0. THE PRODUCT — Read This Before Judging Anything

Everything in §1–8 is mechanics. This is the reason the mechanics exist. If a
change improves the page's craft but drifts from what follows, it is wrong.

### 0.1 What RHEO is

**An AI-native time-tracking desktop app. Local-first. One SQLite file on your
own disk.** The README's own title is *"RHEO — Time, made legible."*

It records how you actually spend your hours — window titles, apps, sites,
sessions — and then turns that raw record into understanding: phases, dashboards,
an AI that answers questions about your day, and a lessons engine that redraws
as your habits change.

### 0.2 The two halves of the purpose

These are the product. Every design decision traces back to one of them.

**PRIVATE TRACKING.** The record is complete and it never leaves the machine.
No account, no cloud, no sync service, no telemetry. Your employer cannot see
it, your ISP never touches it, and there is no server that *could* be breached
because there is no server. This is not a feature the app has; it is the
condition under which the tracking is honest. A time tracker that phones home
is surveillance, and surveillance is why most people quit time trackers in a
week.

**A REFLECTING EXPERIENCE.** The point is not the logging — it is the
*reflection* the logging enables. The app's own deleted Manifesto said it best,
and these are the product's actual words, not mine:

> "Your hours are the only currency you can never earn back. RHEO records how
> they flow — so every phase of your life can be seen, questioned, and
> improved."

Note the three verbs: **seen** (legibility), **questioned** (the AI), **improved**
(the lessons). The record is raw material; the reflection is the product. A
dashboard that only reports totals serves neither half.

### 0.3 The values the page must not betray

1. **Show, don't assert.** Every claim is backed by a real capture. The page
   says `REAL CAPTURE` and means it. This is why a fabricated SHA-256 was
   deleted rather than shipped — the whole page's credibility rests on its
   labels being true.
2. **Local-first is a fact, not a promise.** "0 bytes leave your machine" beats
   "we respect your privacy" because it is checkable. That is the entire reason
   the Ledger exists.
3. **The AI is inspectable, not magic.** Answers cite the sessions they came
   from. If the AI said something, you can check what it saw.
4. **No dark patterns, no growth loops.** No streaks that punish absence, no
   engagement bait, no "10,000 users." The product respects the user's attention
   because the product is about their time, and time is the one thing a time
   tracker must not waste.
5. **Monochrome because nothing is hidden**, not because it looks premium. The
   palette is near-black with one signal hue. Any decorative colour that does
   not encode something is a lie about what matters.

### 0.4 Who this page is for

Someone who has already tried and abandoned a time tracker — Toggl, RescueTime,
a spreadsheet — and quit because it felt like surveillance or because staring at
pie charts did not change anything. They are technically literate, privacy-aware,
and sceptical of marketing claims. **They will leave in under ten seconds if the
page feels like a SaaS landing page.** Concretely: no fake social proof, no
growth language, no pricing tier, no "join 10,000 people."

### 0.5 What the page is NOT allowed to become

This is the failure mode I have already walked into once this session, so it is
worth naming: **a page that keeps re-showing the same evidence until it looks
busy.** The previous version rendered 43 images across 11 sections because the
same 17 screenshots appeared four times at different sizes. Density read as
confidence and was actually confusion. If your review concludes the page needs
more sections, more screenshots, or more motion — push back hard and make me
justify it.

### 0.6 Where the ASCII fits into this purpose

The ASCII section is the page's thesis rendered as an interface. A tracked day
at one-minute resolution is a 1,440-cell grid. Read as rows of timestamps it is
noise; read as glyph density it is a legible shape — dense where you worked,
sparse where you did not. It makes *"time, made legible"* literal, and it is the
only element on the page that is genuinely the product's idea rather than a
screenshot of it. It is also the most likely candidate for cutting, and I want
your honest read on whether it earns its place at the bottom of a long gallery.

---

## 1. What Was Built — Report First

### 1.1 The starting state (measured, not estimated)

From `curl http://localhost:3000/`:

| Section | heading | `<img>` | `<video>` | words |
|---|---|---:|---:|---:|
| `#hero` | — | 0 | 1 | 86 |
| `#manifesto` | "Your hours are the only currency…" | 0 | 0 | **27** |
| `#act-record` | "A DAY, REPLAYABLE." | 0 | 1 | 51 |
| `#capabilities` | "Five instruments, one record." | 4 | 1 | 40 |
| `#understand` | "AN AI THAT WAS THERE." | 1 | 0 | 32 |
| `#learn` | "YOUR PROCESS, TEACHING YOU." | 1 | 0 | 79 |
| `#atlas` | "EVERY INSTRUMENT, ONE RECORD." | 0 | 0 | **180** |
| `#flow` | — | 0 | 0 | **19** |
| `#gallery` | "THE WHOLE APP. UNRETOUCHED." | **18** | **7** | 135 |
| `#instruments` | "SEVENTEEN SCREENS. ONE RING." | **18** | 0 | 61 |
| `#download` | "OWN YOUR HOURS." | 1 | 0 | 59 |

**Totals: 11 sections, 43 `<img>`, 10 `<video>`.** `#gallery` and
`#instruments` rendered **the same 17 screenshots**. That is what "everything
showing everywhere" meant, quantified.

### 1.2 The user's complaints, and what each turned out to be

| Complaint | Root cause found |
|---|---|
| "why is the finance shit on the download section?" | **A real bug.** `Download.tsx` rendered a Finance screenshot under the headline "OWN YOUR HOURS." Not wired to anything. Deleted. |
| "the ring design carousel is kind of redundant" | Correct. 1,209-line orbit ring; dragged horizontally on a page that scrolls vertically. Deleted. |
| "make the carousel the main thing" | Done. 17 screens, recordings as states. |
| "the ascii stuff is tehre or not?" | It is there and mounted — see §3. |

### 1.3 Current state after the restructure

| | Before | After |
|---|---|---|
| Sections | 11 | **5** — hero, act-record, gallery, understand, download |
| `<img>` rendered | 43 | **17 stills, each exactly once** |
| `<video>` mounted | up to 10 | **≤2** (act-record clip + one gallery selection) |
| Carousel rows | 24 for 17 screens | **17** |
| Horizontal navigators | 2 | **1** |
| Dead CSS | — | 205 lines of orbit rules removed |
| Dependencies | — | `embla-carousel-react`, `prisma`, `@prisma/client` removed |
| Ring | 1,209 lines | **0** |

Mount chain — `landing/src/app/page.tsx`:

```tsx
<main id="main" className="flex-1">
  <Hero />           {/* #hero        TIME, MADE LEGIBLE.   */}
  <ActRecord />      {/* #act-record  A DAY, REPLAYABLE.     */}
  <Gallery />        {/* #gallery     THE WHOLE APP. UNRETOUCHED. */}
  <ActUnderstand />  {/* #understand  AN AI THAT WAS THERE.  */}
  <Download />       {/* #download    OWN YOUR HOURS.        */}
</main>
```

**Every capture now has exactly one home, verified by grep:**

```bash
$ grep -rhoE 'src="/media/app-[a-z0-9-]+\.(png|mp4)"' src/components/rheo/*.tsx \
    | sed 's/src="\/media\///;s/"//' | sort | uniq -d | wc -l
0
```

### 1.4 Files changed

```
MODIFIED  src/app/page.tsx                      5-section mount chain
MODIFIED  src/components/rheo/Gallery.tsx       full rewrite: 17 screens
MODIFIED  src/components/rheo/RealFootage.tsx   +plate, +priority, +pauseControl, +dims
MODIFIED  src/components/rheo/Download.tsx      finance bug + fake SHA-256 removed
MODIFIED  src/components/rheo/Hero.tsx          clip removed, CTA → #gallery
MODIFIED  src/components/rheo/ActRecord.tsx     +pauseControl
MODIFIED  src/components/rheo/ActUnderstand.tsx duplicate capture removed, EXAMPLE card
MODIFIED  src/components/rheo/SectionIndex.tsx  5 entries
MODIFIED  src/components/rheo/CommandPalette.tsx anchors were dead, fixed to 5
MODIFIED  src/app/globals.css                   filmstrip, seg, thumbs, ledger, example
NEW       src/components/rheo/Ledger.tsx        trust counter row
DELETED   Instruments.tsx SurfaceOrbit.tsx orbit-layout.ts probe-orbit.mjs
DELETED   Manifesto.tsx Capabilities.tsx AtlasSection.tsx ActFlow.tsx LearnVignette.tsx
DELETED   ui/carousel.tsx lib/db.ts
```

Backup of every deleted file: `landing/.bak-20261007-104349/` (17 files, 232 KB).

---

## 2. The Carousel — Current Implementation

`src/components/rheo/Gallery.tsx`. The data model:

```ts
type Recording = { src: string; label: string };
type Screen = {
  id: string; label: string; still: string; alt: string;
  caption: string;               // ≤9 words, compressed from the deleted atlas section
  recordings?: Recording[];      // NEVER a row of its own
};
```

17 entries. Dashboard carries `IDLE`; Console carries `TERMINAL` and `REAL WORK`.
The still⇄motion control renders **only** when `recordings.length > 0` — a
disabled control that looks enabled is worse than an absent one.

**Position comes from real `scrollLeft`, never click bookkeeping:**

```ts
const sync = useCallback(() => {
  const rail = railRef.current;
  if (!rail) return;
  const slide = rail.firstElementChild as HTMLElement | null;
  if (!slide) return;
  const step = slide.offsetWidth + 24;
  const i = Math.max(0, Math.min(SCREENS.length - 1, Math.round(rail.scrollLeft / step)));
  if (i !== index) { setIndex(i); setRecording(null); }  // never land mid-recording
  setAtStart(rail.scrollLeft <= 8);
  setAtEnd(rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 8);
}, [index]);
```

Mechanism is native CSS scroll-snap — **no carousel engine**. That was
confirmed by reading `@kokonutui/carousel-cards`, whose source is
`snap-x snap-mandatory` + `scrollBy` arrows with no dependency. Its 240px
card scale was rejected for 2880×1800 captures.

Below the strip: a **static 18-cell thumbnail index** (17 screens + one
`GET RHEO` CTA tile, so the grid divides 2/3/6 at every breakpoint). It is the
"whole app at a glance" claim delivered without a second navigator.

---

## 3. THE ASCII — Direct Answer

**Based on: ASCII Magic, https://www.ascii-magic.com.** Their hero is a source
photograph beside its own character rendition, with a drag divider. I lifted
that one move. Nothing else from that site was used.

**It exists and it is mounted:**

```
src/components/rheo/AsciiSurface.tsx   12,440 bytes
Gallery.tsx:6    import AsciiSurface from "./AsciiSurface";
Gallery.tsx:316  <AsciiSurface src={ASCII_SOURCE.still} … />
```

It renders as the final block of `#gallery`, under the heading
"THE SAME PIXELS, AS CHARACTERS", `mt-20`. `ASCII_SOURCE = SCREENS[0]`
(`app-dashboard.png`). Copy and key events work; arrow keys move the seam.

**It is not decoration.** The glyphs are computed from the actual pixels of the
capture in the browser:

```ts
const RAMP = " .,:;i1tfLCG08@";
const GAMMA = 0.6;        // see §5 — do not "fix" this
const CELL_ASPECT = 0.6;
const COLS = 132;
```

Pipeline: `getImageData` → Rec.709 luma per cell → normalise against the
frame's own peak → **`pow(x, 0.6)`** → quantise into the ramp → 132 columns.

**Honesty contract in the component:** if the pixels cannot be read the component
renders `COULD NOT READ THIS CAPTURE` and shows the photograph only. It never
falls back to a decorative pattern that would read as a measurement.

---

## 4. The Trust Ledger (new, unreviewed)

`src/components/rheo/Ledger.tsx`, mounted in `#download` above the CTA.
Counter mechanism **sourced from `@react-bits/Counter-TS-TW`** — each digit is a
fixed-height `overflow: hidden` window over ten stacked glyphs moved with a `y`
transform, so it obeys transform/opacity-only.

Three sourced facts, no marketing numbers:

```
0   bytes that leave your machine       no network call in the renderer
0   telemetry events, ever              there is nothing to send them to
1   SQLite file is your entire history  open the data directory
```

Deliberately absent: "10,000 happy users", "4.9 rating". Putting unverifiable
numbers beside three real ones devalues the three.

---

## 5. The γ0.6 Decision — Please Do Not Undo This

I normalised linear luminance against the peak and the field was unreadable —
measured across all 17 captures:

| γ | ink % | ramp indices used | consistent across files? |
|---|---|---|---|
| 1.0 | 1.5–11.7 | 14/16 | yes, **far too dark** |
| **0.6** | **5.4–36.0** | **14/16** | **yes — idx 3.8–4.5** |
| 0.45 | 27–89 | 12/16 | washed out |
| 0.35 | 78–99.9 | 11/16 | blown out |

γ0.6 is the only value keeping a near-full tonal range *and* staying consistent
between captures. `p95` normalisation was rejected: tone varied 2× between files,
so the dashboard and the console stopped looking like the same system.

Verified by `landing/scripts/probe-ascii-surface.mjs`, which renders every
capture through the identical maths in Node. It asserts ramp indices stay in
**9–14 of 16** per capture. Current: all 17 pass.

---

## 6. Concerns I Already Have — Disagree or Confirm

1. **Nothing has ever been rendered.** Every check is `esbuild` + scoped `tsc` +
   the numeric probe. I am not permitted to run a build (`AGENTS.md §0-0`), and
   the page has never been screenshotted. The Ledger roll, REC chips, plate
   captions and EXAMPLE card are all unproven in a browser.

2. **RESULT.md contradicts itself.** §1.1 grants `#act-record` its own
   `RealClip`; §1.3 gives the gallery all 7 recordings; §2.2 spells out Dashboard
   as `[STILL | IDLE | 24H TIMELINE]`. All three cannot hold — the 24h clip was
   mounted twice. I resolved toward "no capture twice" via §1.2: the 24h clip
   *is* the record loop, so `#act-record` owns it and Dashboard shows `IDLE`.

3. **No real SHA-256.** The spec asks for real checksums per OS build. There are
   no built binaries, so I removed the row rather than ship `a1b2c3d4e5f6…` under
   a "SHA-256" label with a copy-to-clipboard button.

4. **`#manifesto`, `#atlas` and `#flow` were deleted, not merged.** RESULT.md
   §1.3 wanted 226 words redistributed into the hero and captions. I compressed
   180 of them into the 17 gallery captions. The rest I simply dropped. **The
   hero is 86 words, over the 60-word budget, and did not get the manifesto
   line.**

5. **The 240ms crossfade was never implemented.** still⇄clip is an instant
   swap. The mechanism is fine (poster === still means nothing reflows) but the
   fade is missing.

6. **Three `useSpring` calls remain** in `ActRecord`, `DayRuler`, `Nav` —
   pre-existing from commit `3c48fff`, not mine, left alone per scope rules.

7. **`package-lock.json` is out of sync** — three deps removed from
   `package.json`. `npm install` required before the next Netlify deploy.

---

## 7. Conversation Protocol

**You ask, I fetch.** Format:

```
REQUEST: <exact file path or specific question>
```

I reply:

```
CONTEXT: <path> (lines N-M)
<actual source, pasted inline>
```

**Your rules:** start with questions, not answers; ask one thing at a time; say
so when you are guessing; flag anything whose truth I have not verified; when you
have enough, produce `RESULT.md`.

**My rules:** I paste real source or say "that file does not exist"; I never
invent code; I do not defend work I think is wrong.

**Scope — IN:** the landing page's structure, the carousel, the ASCII section,
the ledger, motion, and whether any of it should be cut.
**Scope — OUT:** the Electron app itself, the database, Netlify accounts.

---

## 8. Your First Questions

I want your read on these, in order:

1. Is the 5-section architecture right, or does the page need a 6th?
2. The gallery owns all 17 captures and is 1 of 5 sections. Too dominant?
3. Is the ASCII section earning its place at the bottom of the gallery, or is it
   decoration that should be cut?
4. The ledger's three facts — do they convince, or do they read as fear-marketing?
5. What should be deleted that I have built?

6. **Does the page communicate §0?** Private tracking and reflection. If a
   visitor would learn those two things from this page, the structure is right.
   If they would only learn that it is "an AI time tracker", the page is
   decoration and I need to hear it.

Ask me for anything you need. I will paste it. You have no codebase access —
everything above is pasted inline, and every `REQUEST:` I answer with real
source or an explicit "that file does not exist." I never invent code.

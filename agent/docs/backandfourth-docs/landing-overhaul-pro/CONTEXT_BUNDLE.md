# CONTEXT_BUNDLE.md — RHEO landing page

> Case **2** (existing context → continuation). The previous GLM round is
> summarised in §9. You are receiving a **delta**: what changed, plus the raw
> source of every surface an overhaul would touch.

---

## 1. Project

**RHEO** (ῥέω, Greek: *to flow*) — a private, local-first desktop time tracker that
turns a record of your hours into reflection. Not a cloud SaaS. One SQLite file on
your disk. Zero telemetry. One-time license. Currently **pre-launch** (v0.2.0, no
public binaries).

The marketing site lives in `/landing` — a **Next.js 16 App Router** app, separate
from the Electron app itself.

| | |
|---|---|
| Framework | Next.js 16.3.8 (App Router, Turbopack), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 + hand-written CSS (`globals.css`, ~2100 lines) + shadcn/ui (New York) |
| Motion | framer-motion 12 (`useScroll`, `useTransform`, `useSpring`, `useInView`, `MotionConfig`, `useMotionValueEvent`, `AnimatePresence`) |
| Icons | lucide-react — the only icon library permitted |
| Other | Zero runtime deps beyond the above. No carousel engine. No smooth-scroll (Lenis/locomotive) — native scroll is mandatory. |
| Deploy | Netlify (`netlify.toml`, `base = "landing"`) |

---

## 2. The mount chain — this IS the architecture

`landing/src/app/page.tsx`:

```tsx
"use client";

import { MotionConfig } from "framer-motion";
import Grain from "@/components/rheo/Grain";
import Preloader from "@/components/rheo/Preloader";
import Nav from "@/components/rheo/Nav";
import DayRuler from "@/components/rheo/DayRuler";
import SectionIndex from "@/components/rheo/SectionIndex";
import CursorGlow from "@/components/rheo/CursorGlow";
import Footer from "@/components/rheo/Footer";
import CommandPalette from "@/components/rheo/CommandPalette";
import Changelog from "@/components/rheo/Changelog";
import Hero from "@/components/rheo/Hero";
import ActRecord from "@/components/rheo/ActRecord";
import Gallery from "@/components/rheo/Gallery";
import ActUnderstand from "@/components/rheo/ActUnderstand";
import Download from "@/components/rheo/Download";

export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-col surface-page">
        <a href="#main" className="skip-link">Skip to content</a>
        <Grain />
        <CursorGlow />
        <Preloader />
        <Nav />
        <DayRuler />
        <SectionIndex />
        <main id="main" className="flex-1">
          <Hero />          {/* #hero        claim       TIME, MADE LEGIBLE.       */}
          <ActRecord />      {/* #act-record  mechanism   A DAY, REPLAYABLE.        */}
          <Gallery />        {/* #gallery     the surface THE WHOLE APP. UNRETOUCHED. */}
          <ActUnderstand />  {/* #understand  the mind    AN AI THAT WAS THERE.      */}
          <Download />       {/* #download    the ask     OWN YOUR HOURS.           */}
        </main>
        <Footer />
        <CommandPalette />
        <Changelog />
      </div>
    </MotionConfig>
  );
}
```

Five sections, one job each. WAS eleven sections with 43 `<img>` + 10 `<video>` and
the same 17 screenshots rendered twice at two sizes.

---

## 3. LAMINAR design contract — non-negotiable

From `landing/design/LANDING_DESIGN_SPEC.md` and `globals.css` `@theme inline`.

### 3.1 Colour — strictly monochrome

```css
--color-page:    #050506;   /* page background      */
--color-panel:   #0a0a0c;   /* cards, modals, inputs */
--color-card:    #101014;   /* hover / elevated     */

--color-hairline: rgba(255,255,255,0.08);   /* default borders */
--color-strong:   rgba(255,255,255,0.16);   /* hover, panel tops */

--color-hi:  #f4f4f5;   /* headlines, body   */
--color-mid: #a1a1aa;   /* secondary copy    */
--color-low: #63636b;   /* mono labels, meta */

--color-accent: #ffffff;  /* the ONLY accent */
```

**BANNED:** any hue · coloured gradients · neon · emoji · stock photos · AI
illustrations · Inter font · green "hacker terminal" text · oversized radii ·
box-shadows for depth · backdrop-blur on scrims · 3D tilt · bounce/overshoot.

> **Importance = brightness, weight, scale. Never hue.**

### 3.2 Type

- Display: **Space Grotesk** 500/700 — `var(--font-display)`
- Mono: **JetBrains Mono** 400/500 — `var(--font-mono)`; all labels, chips, kickers
- Mono label: 11px, uppercase, `letter-spacing: 0.14em`, `#63636b`
- H1: `clamp(44px, 9vw, 128px)`, weight 700, `letter-spacing: -0.02em`, `line-height: 0.96`
- H2: `clamp(34px, 5.4vw, 76px)`, weight 700, same tracking
- Body: 16px / 1.6

### 3.3 Shape, motion, texture

- Radii: **6 / 10 / 16 only**
- Easing: **`cubic-bezier(0.16, 1, 0.3, 1)`** — the single token, everywhere
- Duration ceiling: 700ms entrances · 350ms interactions · 250ms modals
- No `transition: all` — always property-list
- **No layout properties animated** (width/height/top/left/margin/padding)
- Scroll-scrubbed motion is a **pure function of progress** → fully reversible
- Texture: SVG `feTurbulence` grain, fixed, 4% opacity

### 3.4 Motion laws (enforced, with measured receipts)

1. Scroll-scrubbed = reversible. `useTransform`, never a one-time tween.
2. Transform/opacity only for scroll-linked styles.
3. Reduced motion = final static states, no transforms, no canvas, no loops.
4. One canvas only (hero flow field). Everything else SVG/CSS/transform.
5. No scroll hijacking.

---

## 4. Section sources

### 4.1 `#hero` — the claim

`Hero.tsx`. 100dvh. Layers: `FlowFieldCanvas` (ASCII glyph field), corner marks,
radial vignette, then foreground.

```tsx
<section id="hero" className="relative w-full overflow-hidden surface-page"
         style={{ height: "100dvh", minHeight: 600 }}>
  <FlowFieldCanvas />
  <div className="corner-marks" aria-hidden>…4 L-brackets…</div>
  {/* radial vignette rgba(5,5,6,0.65) at 20% 50% → transparent 75% */}
  <div className="relative z-10 h-full flex flex-col justify-center
                  px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
    <p className="mono-label mb-6 hero-enter hero-enter--kicker">
      <DecryptedText text="RHEO — ῥέω · GREEK: TO FLOW" speed={28} maxIterations={6} />
    </p>
    <h1 className="display-h1 hero-enter">TIME,<br />MADE LEGIBLE.</h1>
    <p className="mt-8 max-w-[640px] hero-enter hero-enter--manifesto"
       style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa", maxWidth: 560 }}>
      Your hours are the only currency you can never earn back. RHEO
      records how they flow — so every phase of your life can be seen,
      questioned, and improved.
    </p>
    <div className="mt-10 flex flex-wrap items-center gap-3 hero-enter hero-enter--ctas">
      {/* PRIMARY — the evidence */}
      <a href="#gallery" className="btn-sheen …" style={{ background:"#fff", color:"#050506",
        borderRadius:6, padding:"12px 22px", fontSize:13 }}>
        <span className="mono" style={{ fontWeight:500, fontSize:13 }}>
          See all 17 screens, untouched ↓</span>
        <span aria-hidden className="btn-sheen-sweep" />
      </a>
      {/* GHOST — the ask, OS-detected at runtime */}
      <a href="#download" className="mono …" style={{ border:"1px solid rgba(255,255,255,0.16)",
        borderRadius:6, padding:"12px 22px", fontSize:13, color:"#a1a1aa" }}
         onMouseEnter={…onMouseLeave={…}>
        <span>Download for {os}</span><OSLogo os={os} />
      </a>
    </div>
  </div>
  {/* bottom live line */}
  <div className="absolute bottom-0 left-0 right-0 z-10 px-5 sm:px-10 lg:px-16 hero-enter">
    <div className="flex items-center gap-3 max-w-[1280px] mx-auto"
         style={{ borderTop:"1px solid rgba(255,255,255,0.08)" }}>
      <span className="mono" style={{ fontSize:11, color:"#8a8a94", paddingTop:8 }}>
        <span className="blink-cursor" style={{ color:"#fff" }}>▍</span>{" "}
        <span style={{ color:"#a1a1aa" }}>tracking</span>{" "}
        <SessionClock />                                   {/* real elapsed time */}
        <span style={{ color:"#a1a1aa" }}> on this page</span>{" "}
        <span style={{ color:"#f4f4f5" }}>0 bytes sent</span>
      </span>
    </div>
  </div>
</section>
```

**The CTA ordering is a decision, not a default:** the carousel is the main thing,
so it is the solid white button. Download is ghosted because **there are no real
binaries and no real checksums yet**, so it cannot be the hero's promise until it
fully delivers. A secondary CTA that duplicates the scroll wheel ("See the method")
was deleted as noise.

### 4.2 `#act-record` — the mechanism (300vh scrub)

The signature section. Sticky 100dvh inside a 300vh track; scroll progress `p`
drives *everything* simultaneously.

```tsx
const { scrollYProgress: raw } = useScroll({ target: ref, offset: ["start start","end end"] });
const springP = useSpring(raw, { stiffness: 120, damping: 25 });
const p = shouldAnimate ? springP : raw;   // spring bypassed under RM

const playheadTop = useTransform(p, [0,1], ["0%","100%"]);
const miniFill    = useTransform(p, [0,1], ["0%","100%"]);

// direct DOM text updates — no per-frame re-render
useEffect(() => {
  const apply = () => {
    const v = p.get(), hour = v * 24;
    if (hhmmRef.current) hhmmRef.current.textContent =
      `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
    PHASES.forEach((ph,i) => {
      const el = counterRefs.current[i];
      if (el) el.textContent = fmtHM(Math.round(v * ph.total));
    });
    const idx = activeIndexFromHour(hour);
    if (idx !== activeRef.current) { activeRef.current = idx; setActive(idx); }
  };
  apply();
  const unsub = p.on("change", apply);
  return () => unsub();
}, [p]);
```

Four phases drive the copy, the counters and the active-segment highlight:

```ts
const PHASES: Phase[] = [
  { key:"REST",      range:"23–06", startH:23, endH:30, total:420, blurb:"Recovery is a phase, not a gap. RHEO guards it." },
  { key:"DEEP WORK", range:"09–12", startH:9,  endH:12, total:180, blurb:"Unbroken focus. The record marks its depth, not just its length." },
  { key:"MEETINGS",  range:"12–14", startH:12, endH:14, total:120, blurb:"Context switches, logged. Later you see what they cost." },
  { key:"LEARNING",  range:"19–21", startH:19, endH:21, total:120, blurb:"Study compounds. The timeline remembers every session." },
];
```

Three-column sticky composition — **each column position-switches between the
animated and reduced-motion branches**, because the static branch is a stacked
column and `top:50%` against it lands the media on top of the phase list:

- **left, `top:320px` max-w 300** — section kicker + H2 + crossfading phase block
  (key, range, blurb, `recorded 7h 00m`) + all-phase counter list
- **centre, `translate(-50%,-50%)`, `min(440px, 80vw)`** — the real capture:
  ```tsx
  <RealClip src="/media/app-timeline-24h.mp4" poster="/media/app-dashboard.png"
            alt="The RHEO dashboard with the 24 hour timeline filling in as the day is recorded"
            pauseControl ratio={16/10} scrub={p} />
  ```
- **right, `min(62vh,540px) × 96`** — vertical 24h track: hairline, 25 hour ticks,
  labels at 0/6/12/18/24, phase segments, moving playhead with an `HH:MM` readout,
  and a "SCROLL TO REPLAY THE DAY" invitation that fades out by `p≈0.08`.

> **The video is scrubbed, not played.** `scrub` is a `MotionValue<number>`,
> consumed via `useMotionValueEvent` — a plain prop would only deliver the mount
> value, because a MotionValue mutates in place and never re-renders. Verified:
> `currentTime 0 → 7.09s` across the 2700px track, 7/7 distinct samples, monotonic.

### 4.3 `#gallery` — the surface (17 screens)

`Gallery.tsx`. Owns **all 17 stills and all 7 recordings**; no other section renders
a capture. Native scroll-snap rail, deliberately **not** a carousel.

```ts
const SCREENS: Screen[] = [
  { id:"dashboard", label:"Dashboard", still:"/media/app-dashboard.png", caption:"The whole day on one surface — depth, not duration.", recordings:[{src:"/media/app-dashboard-idle.mp4", label:"IDLE"}] },
  { id:"console",   label:"Penguin Console", still:"/media/app-console.png", caption:"A real PTY. Real commands, real output, no wrapper.", recordings:[{src:"/media/app-terminal-real.mp4",label:"TERMINAL"},{src:"/media/app-terminal-work.mp4",label:"REAL WORK"}] },
  { id:"activity",  label:"Activity", …, caption:"Every app and site, logged. The record before it becomes anything." },
  { id:"insights",  label:"Insights", …, caption:"Productive, neutral, distracting — weighted by depth.", recordings:[{src:"/media/app-insights-detail.mp4",label:"DETAIL"}] },
  { id:"life",      label:"Life", …, caption:"The week, with its phases. Not a mood ring.", recordings:[{src:"/media/app-life-week.mp4",label:"WEEK"}] },
  { id:"ai",        label:"AI Assistant", …, caption:"It answers against your record, and cites the sessions it used." },
  { id:"learn",     label:"Lyceum", …, caption:"Lessons that redraw as you grow. Weights adjust themselves." },
  { id:"finance",   label:"Finance", …, caption:"Where the money went, from the same record. No bank sync." },
  { id:"ide",       label:"IDE Projects", …, caption:"Coding time, organised per project." },
  { id:"database",  label:"Database", …, caption:"One SQLite file on your disk. Browse it. It's yours.", recordings:[{src:"/media/app-database-scroll.mp4",label:"SCROLL"}] },
  { id:"rankings",  label:"Rankings", …, caption:"Computed from the record, never typed in." },
  { id:"labs",      label:"Labs", …, caption:"Where unfinished things live until they're not." },
  { id:"studio",    label:"Content Engine", …, caption:"Sessions become documentation and explainers." },
  { id:"guide",     label:"Guide", …, caption:"How the instruments fit together." },
  { id:"settings",  label:"Settings", …, caption:"Local-first by default. Zero telemetry." },
  { id:"lecture",   label:"Lecture", …, caption:"Teach the room from the record." },
  { id:"profiler",  label:"Profiler", …, caption:"RHEO measures itself with RHEO." },
];
```

**17 SCREENS is the unit.** A recording is a *state of a screen*, not a row of its own.

Rail geometry — verified `N=1: 496→496 (Δ0)`, `N=8: 3968→3968 (Δ0)`, tail `17 / 17`:

```ts
const RAIL_GAP = 16;   // read from live computed style; JS and CSS cannot disagree
const step = slide.offsetWidth + RAIL_GAP;
const padEnd = parseFloat(getComputedStyle(rail).paddingRight) || 0;
const endStop = Math.max(0, maxScroll - padEnd);   // tail slides are END-aligned
```

```css
.gallery-rail { --slide-w: clamp(360px, 38vw, 480px); --rail-gap: 16px;
  display:flex; gap:var(--rail-gap); overflow-x:auto;
  scroll-snap-type: x mandatory; overscroll-behavior-x: contain; touch-action: auto;
  margin-right: calc(-1 * clamp(20px,4vw,64px));   /* edge bleed = "continues" */
}
.gallery-slide { flex: 0 0 var(--slide-w); scroll-snap-align: start; opacity: .45;
                 transition: opacity .5s cubic-bezier(.16,1,.3,1); }
.gallery-slide[data-active="true"] { opacity: 1; }
.gallery-slide[data-snap="end"] { scroll-snap-align: end; }
```

Also in this section:
- `role="listbox"` + `role="option"` + `aria-activedescendant` + roving arrows/Home/End
- A segmented `role="radiogroup"` STILL | MOTION toggle rendered **only** when that
  screen has a recording — never a dead control
- `pauseControl` on every clip (WCAG 2.2.2 — content moving >5s needs a stop)
- A 6-column `.thumb-grid` index of all 17 at a glance, plus an 18th cell that is a
  terminal `GET RHEO` CTA (18 divides 2/3/6 at every breakpoint)
- **THE REJECTED SEAM** (see §6)

### 4.4 `#understand` — the mind

`ActUnderstand.tsx`. One artifact: a Console that types a real query, emits traces,
answers, and draws a bar chart.

```ts
const SCENARIOS: Scenario[] = [
  { id:"deep-work", short:"Deep work", q:"> why was tuesday's deep work down 22%?",
    traces:["querying timeline…","cross-referencing calendar…","comparing 7-day baseline…"],
    answer:"Two unplanned meetings split your 09–12 block; recovery started 40 min later than baseline.",
    bars:[0.9,0.82,0.42,0.78,0.86,0.7,0.9] },
  { id:"learning", short:"Learning", q:"> what did I learn this week?",
    traces:["collecting lyceum sessions…","grouping by topic…"],
    answer:"9 focused sessions across 3 topics — most on context systems. Longest streak: Thursday.",
    bars:[0.4,0.55,0.6,0.9,0.7,0.5,0.45] },
  { id:"sharpest", short:"Sharpest", q:"> when am I sharpest?",
    traces:["scoring 30-day focus…","clustering by hour…"],
    answer:"Your focus peaks 09:00–11:30. Mornings run 31% deeper than afternoons.",
    bars:[0.3,0.95,0.8,0.5,0.45,0.35,0.3] },
];
```

Two deliberate WCAG fixes are load-bearing here and must survive any redesign:

- **The 4.2s auto-advance was deleted** (WCAG 2.2.2 Pause/Stop/Hide). Scenarios
  advance **only** on user action.
- **The free-text input was deleted.** `onSubmit` ignored what was typed and
  advanced a canned script, so the box promised a capability it did not have —
  "the single worst thing a trust-first page can do, and this section IS the trust
  argument." Three real controls that really select > one fake input.

Completed `role="tablist"` / `role="tab"` / `role="tabpanel"` with roving tabindex.

### 4.5 `#download` — the ask

`Download.tsx`. `py-28 sm:py-36`, centred, `max-w-[760px]`, an 8% white radial bloom.

- H2 **OWN YOUR HOURS.** + "RHEO isn't on sale yet. Join the waitlist and we'll
  write once, the day it leaves preview."
- `<Ledger />` sits **directly above** the CTA — three sourced facts, no marketing numbers
- Three `shadcn` `Card` OS tiles (macOS / Windows / Linux), the detected one border-lit
  and badged `detected`
- Collapsible inline version history — 5 entries, `NEW`/`FIX`/`CHG` kind badges
- Footer line: `v0.1 PRE-RELEASE · LOCAL FIRST · 0 BYTES TO CLOUD`

**Fabrications removed (do not restore):**
- `size` and `sha256` were placeholders (`"78 MB"`, `"a1b2c3d4e5f6…"`). They were
  never rendered; a verification affordance for a number that cannot verify is
  worse than no number. Restore with a real digest from the release build.
- A Finance screenshot once sat under this heading, wired to nothing.

---

## 5. Chrome

| Component | Role |
|---|---|
| `Nav.tsx` | top bar, `PRODUCT / METHOD / DOWNLOAD`, live `NavClock`, `MOTION AUTO\|ON\|OFF` chip, ⌘K hint |
| `DayRuler.tsx` | right-edge 24h ruler with a scroll playhead |
| `SectionIndex.tsx` | left-edge magnetic dots + reading-progress ring (≥1280px) |
| `CommandPalette.tsx` | ⌘K jump + actions — **hand-rolled, has known a11y gaps** |
| `Grain.tsx` / `CursorGlow.tsx` | fixed grain overlay; hero cursor radial |
| `Preloader.tsx` | 0→100 counter, <800ms |
| `Footer.tsx` | live clock + links |

### 5.1 The motion store — the single most important mechanism

Three states, stamped on `<html>`: `data-motion="auto" | "on" | "off"`.

```
auto  → live-governed by the prefers-reduced-motion media query
on    → explicit override: animate even if the OS says reduce
off   → explicit override: never animate
```

```css
/* CSS owns FIRST PAINT; framer owns POST-SYNC.
   Measured with JS disabled: h1 computed opacity:0 → an invisible hero. */
@media (prefers-reduced-motion: reduce) {
  .display-h1, .display-h2, .mono-label, .ledger-cell, [data-reveal] {
    opacity: 1 !important; transform: none !important;
  }
  .hero-enter { animation: none; opacity: 1; transform: none; }
}
/* Attribute selectors outrank the media query — this is the whole point. */
html[data-motion="off"] .hero-enter { animation: none; opacity: 1; transform: none; }
html[data-motion="on"]  .hero-enter { animation: hero-enter .7s cubic-bezier(.16,1,.3,1) both; }
html[data-motion="off"] .blink-cursor { animation: none; }
```

The structural limit, stated once so it is not rediscovered: **`useSyncExternalStore`'s
hydration contract requires the server snapshot during hydration**, so any store-gated
`initial` commits with the pre-hydration value and only corrects afterwards. The store
therefore **cannot govern first paint**. CSS runs before JS, so CSS must own the first
paint and the store owns branching after it.

---

## 6. THE REJECTED ASCII SEAM — remove or redesign

This exists in two places and **the human owner has rejected it as gimmicky**:

1. `Gallery.tsx` §"THE SAME PIXELS, AS CHARACTERS" — a draggable divider over
   `AsciiSurface`, re-sampling a real capture (`app-lecture.png`, chosen by
   measuring glyph-ramp spread, not by position) into a 138×132 character field.
2. The `AsciiSurface.tsx` component and its CSS block (~100 lines: `.ascii-surface`,
   `.ascii-half`, `.ascii-photo`, `.ascii-glyphs`, `.ascii-grid`, `.ascii-divider`,
   `.ascii-handle`, `.ascii-tag`, `.ascii-status`) + `scripts/probe-ascii-surface.mjs`.

Prior GLM verdict, for the record: *"The seam is functionally verified and perceptually
unjudged. 138 × 132 glyphs, handle present, ArrowRight moves it 339px → 352.5px. Whether
it registers at the foot of a long gallery is a human question and I decline to answer it."*

**The human answered it: no.** Treat removal as the default. If you propose keeping or
replacing it, justify it against a named alternative that earns the same slot.

---

## 7. Known open defects (do not re-litigate; do not inherit)

| # | Defect | Status |
|---|---|---|
| 1 | `#download` — 20px of real movement across 4 elements under `(off, no-preference)`. Under `(auto, reduce)` the page is **clean — `movers=0` in all five sections.** | OWED, needs ablation |
| 2 | Blink cursor not suppressed under store-off | **FIXED** — `html[data-motion="off"] .blink-cursor` added, red-revert confirmed |
| 3 | CommandPalette a11y: no focus trap, no background inertness, `Home`/`End` unhandled, dead `listRef` | OWED — `@shadcn/command` (cmdk) already pulled and audited: cmdk supplies the command engine + typeahead + selection semantics, but a Dialog composition is still required for the focus trap / Esc / inertness |
| 4 | `ActUnderstand.tsx:253,261` — `setPhase("query")` where the union is `"typing"\|"traces"\|"answer"\|"hold"` | pre-existing type error, unrelated to redesign |

**Two prior defects were phantom and are withdrawn** — do not resurrect them:
`#act-record` "15px" and `#download` "310px" were **static centring**
(`top:50% + translateY(-50%)`), not motion. The assert compared an absolute
`translateY` instead of a **delta**. A measurement of *position* was reported as a
measurement of *motion*.

---

## 8. Two false claims already paid for — the rules they earned

- **A fixture read as a measurement.** The hero once showed a hard-coded
  `1,204,032 s observed` that ticked up forever, on a page whose brand is that its
  labels are true. Caught only by comparing against wall-clock time. → *No fabricated
  readouts. If a number is displayed, it is computed from something real.*
- **A count that scales with samples is measuring time, not state.** A probe's
  `hidden` counter accumulated every frame, so it reported 27 "stuck invisible"
  elements that were merely mid-entrance. The tell was visible in its own table:
  `hidden` 36→62 while `subjects` 3552→6068, ratio pinned at 1.0%. → *Watch the
  ratio, not the count.*

---

## 9. State Diff — what changed since the last round

| File | Change |
|---|---|
| `RealFootage.tsx` | Added `scrub?: MotionValue<number>`; `useMotionValueEvent` + metadata-aware `seek`; autoplay suppressed while scrubbing; restored the WCAG 2.2.2 doc comment |
| `ActRecord.tsx` | `scrub={p}` on the `RealClip` |
| `ActUnderstand.tsx` | Removed the dead `AsciiSurface` import |
| `globals.css` | `html[data-motion="off"] .blink-cursor { animation: none }` |

Prior round closed: R4 mechanism · motion store matrix 4/4 · lockfile · `.gitignore`
media negation verified **against git** · `netlify.toml` publish path · store toggle.

Probe board stood at **46/48** before these edits. Every verdict in that report is a
claim about `next dev` — **no production build has ever run**, because per repo policy
only CZ builds.
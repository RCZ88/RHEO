# PROMPT — RHEO Landing Page Restructure

> **First action:** read `CONTEXT_BUNDLE.md` in this same folder. It is the
> source of truth for code, tokens, and structure. You do not have access to the
> codebase.

---

## Raw Request (verbatim)

> "its not fuckingprofesional it deosnt look that good, and veeyrthing is
> jumbled up in mess. so the prompt should be on how we should align things,
> what elemtns and suff we should use lke carousels n shit and like how do we
> maintain hte naimations nad shit to make he website modern and stuff and liek
> HOW DO WE ARRANGE AND PUT THE OCRRECT AND PROPER CONTENT"

> "have you add the scii stuff and the ccarousel adn liek the new designs stuff?"

> "make the carousel thing the main thing, it should be the ones htat shows the
> screensot of hte app and WHY IS THE EVERYTHIGN HSOWING EVERWHERE??? LIKE ITS
> SO UNORGANIZED. NAD WH IS THE FINANCE SHIT ONTHE DOWNLOAD SECTION? IT HAS HTE
> UGLIEST UI EVER"

> "the ring design carousel is kind of redundant now that the thign is like huge
> and like you need t scroll back and forth between seeing hte iamge and like
> scrolling the carosel aso it defeats the purpose o hte carosel thats supposed
> to be the main viewing and not the tool to scolrl"

> "i dog et too much variance on those are bad but like ithin its good to
> include those"

---

## The Mandate

**Design the complete information architecture, carousel specification, and
motion system for the RHEO landing page**, so that a visitor scrolling top to
bottom once encounters a small number of sections that each say exactly one
thing, and every screenshot appears exactly once.

Do not produce options. Produce **one** recommended architecture, fully
specified, that can be implemented without further design decisions.

---

## Problem Statement

The page is professionally typeset but structurally disorganised. Measured:

- **11 sections** for a single-product landing page.
- **43 `<img>` + 10 `<video>`** — the same 17 screenshots are rendered by both
  `#gallery` and `#instruments`.
- `#atlas` is **180 words with no media**; `#manifesto` is **27 words**;
  `#flow` is **19 words with no heading**. Together they are a scroll tax that
  reads as filler.
- `#download` ("OWN YOUR HOURS.", the CTA) renders **one stray Finance
  screenshot** — a bug, not a decision.
- Two competing horizontal navigators (`#gallery` filmstrip, `#instruments`
  orbit ring) where the page itself scrolls vertically. The ring's drag gesture
  fights the page scroll, making it an obstacle rather than the primary
  viewing surface.
- The gallery treats a still and its recording as **two separate rows**, so the
  count reads `24` when there are really **17 screens**.

---

## Requirement Checklist

### A. Information Architecture

1. **Specify the final section list**, in DOM order, with for each: its `id`,
   its single job in one sentence, its heading, its word budget, and its media
   budget.
2. **State explicitly, per section, which screenshots it owns.** No screenshot
   may appear in more than one section. `#capabilities` and `#gallery` currently
   overlap and one must yield — decide which and justify it.
3. **Decide the fate of `#manifesto` (27w), `#atlas` (180w), `#flow` (19w).**
   Merging, deleting, or promoting to a non-scrolling element are all valid;
   state which and where the surviving copy goes. Do not simply delete 226 words
   of product copy — specify where it lands.
4. **Give a word budget per section** and a total. The page currently carries
   ~800 words across 11 sections.

### B. The Carousel Specification

The user was explicit: **the carousel is the main thing, and it must be the
primary viewing surface for the app's screenshots.** Design it fully:

1. **Data model.** One entry per *screen*, with the recording as an attribute
   rather than a row. Two screens carry two recordings each (Dashboard,
   Console) — specify how both are reachable without inflating the count.
2. **Layout.** Specify slides-visible (~2.5), slide width per breakpoint, gap,
   and edge bleed. The set must read as a *set*.
3. **Controls.** Arrows, position readout, keyboard bindings, focus-visible
   ring, touch behaviour.
4. **The still⇄motion toggle.** Rendered only when the active screen has a
   recording. Specify auto-reset behaviour and the reduced-motion path.
5. **A static index for breadth.** A thumbnail grid of all 17 beneath the strip
   — the honest way to show "the whole app" without a second carousel.
6. **Explicitly specify what NOT to build**: no autoplay, no carousel engine
   dependency, no 3D ring, no `embla-carousel-react`.

### C. Motion System

1. **A governing rule.** One sentence that decides whether any given animation
   ships. The user wants motion — they explicitly rejected over-suppression —
   so the rule must *permit* motion and only exclude the decorative kind.
2. **Liveliness level** for a landing page (L1/L2/L3) with reasoning.
3. **A motion inventory**: for each retained animation, its family (reactive /
   transitional / ambient / scroll), its trigger, its properties animated, its
   duration, its easing. The house curve is `cubic-bezier(0.16, 1, 0.3, 1)`.
4. **The reduced-motion contract** — a real alternative rendering path, not
   `duration: 0.01`.
5. **A performance budget** for transform/opacity-only work over 17 slides.

### D. Content Rules

1. **A per-section content template**: kicker, heading, body word count, media,
   caption convention.
2. **The caption convention** (`REAL CAPTURE — …`) and when it is mandatory.
3. **A rule for honesty:** every screenshot must be a real capture; the page may
   not imply functionality that a still does not show.

---

## Constraints

- **`framer-motion` is the only animation engine.** GSAP and Anime.js are not
  installed and must not be added.
- **`embla-carousel-react` is dead code** (zero importers) — delete it, do not
  adopt it. Native CSS scroll-snap.
- Monochrome palette, one signal hue, radii 6/10/16, two font families. **The
  existing type and colour are approved — this task is arrangement, not
  restyling.**
- WCAG 2.2.2: no auto-advancing content without a pause control.
- Preserve the ASCII drag seam and the hero flow field as-is.

---

## Deliverable

A single specification document containing:

1. Final section table (`id` · job · heading · words · media · owns).
2. The carousel data model, in TypeScript.
3. The motion inventory table.
4. A per-file change list with exact paths.
5. A deletion list (files and code blocks to remove).
6. An ordered implementation sequence, each step independently verifiable.

---

## Appendix A — Frontend design skills available

| # | Skill | Contribution |
|---|---|---|
| 1 | **Frontend Design** | DeskFlow component patterns, tokens, spacing, typography |
| 2 | **Human-Centric UX** | empty/loading/error states, progressive disclosure, hierarchy |
| 3 | **Impeccable** | 7 design dimensions, 27 anti-patterns |
| 4 | **Motion — Bring the UI Alive** | Liveliness Levels, motion taxonomy, recipes |
| 5 | **UI UX Pro Max** | industry rules for developer tools |
| 6 | **Design Taste System** | aggregator, variance knobs, anti-repetition |
| 7 | **frontend-external-infra** | source routing, re-skin rules, anti-slop checklist |
| 8 | **PAINT** | orchestrator — run the pipeline in order, not in parallel |

---

## Appendix B — Registry inventory (queried 2026-10-07)

Configured registries: `@shadcn`, `@react-bits`, `@kokonutui`, `@bklit`.
21st.dev and Magic UI are **not** configured in this project.

### `@shadcn` — carousel family (queried)

| Item | Type | Assessment |
|---|---|---|
| `carousel` | ui | Embla-based. **Do not adopt** — project already has a dead copy |
| `carousel-api` | example | API reference |
| `carousel-plugin` | example | Autoplay/drag plugins — autoplay is banned |
| `carousel-spacing` | example | Gap configuration |
| `carousel-orientation` | example | Horizontal/vertical |

### `@react-bits` / `@kokonutui` — carousel candidates (queried, read, rejected)

| Component | Registry | Why rejected |
|---|---|---|
| `DepthCarousel-TS-TW` | react-bits | **`import gsap`**; `onWheel`+`preventDefault()` hijacks vertical scroll; `filter: blur()` destroys the "unretouched" claim; 300px cards |
| `Carousel-TS-TW` | react-bits | Touch gestures + looping; loop = autoplay |
| `CircularCarousel-TS-TW` | react-bits | 3D ring — the pattern being deleted |
| `carousel-cards` | kokonutui | **Mechanism correct, scale wrong**: native `snap-x snap-mandatory` + `scrollBy` arrows, no engine — but 240px cards for 2880×1800 captures, e-commerce data model, `backdrop-blur` on chrome |
| `scroll-text` | kokonutui | `IntersectionObserver` + `rootMargin: "-45% 0px -45% 0px"` is a good stage driver, but it nests a 300px `overflow-y-auto` scroll trap and uses `type: "spring"` |

**Carry-forward lesson:** a registry *description* is a hypothesis, not a
finding. `DepthCarousel`'s blurb says nothing about GSAP. Read the source.

### Icons — `lucide-react`

`ChevronLeft`, `ChevronRight`, `Play`, `Pause`, `ArrowLeftRight`, `LayoutGrid`,
`Monitor`, `Download`, `X`. **Never emoji.**

---

## Appendix C — Anti-slop checklist (mandatory)

After any registry-sourced component:

1. Re-skin to the existing tokens — `#050506` page, `#0a0a0c` panel,
   `#f4f4f5`/`#a1a1aa`/`#8a8a94`/`#63636b` text, `rgba(255,255,255,0.08)` hairline.
2. Radii from `--radius-xs/sm/md` only (6/10/16).
3. Dark mode only.
4. **Space Grotesk + JetBrains Mono**, max 2 families per view.
5. **No `backdrop-blur` glassmorphism on chrome.**
6. No spring/bounce easing.
7. One signal hue per surface — monochrome here.
8. Transform/opacity only. Never `transition-all`.

---

## Appendix D — Acceptance criteria

```bash
# the Finance bug is gone
grep -c "app-finance.png" landing/src/components/rheo/Download.tsx   # -> 0

# the ring is gone
ls landing/src/components/rheo/{SurfaceOrbit,Instruments,orbit-layout}.tsx 2>&1
grep -rn "Instruments\|SurfaceOrbit\|orbit-layout" landing/src/

# dead carousel dep removed
grep -rn "embla" landing/src/ ; ls landing/src/components/ui/carousel.tsx 2>&1

# section count is what you specified
grep -c "<section" landing/src/app/page.tsx

# gallery entry count equals real screen count
grep -c "id: \"" landing/src/components/rheo/Gallery.tsx

# no autoplay in the gallery
grep -rn "setInterval\|autoplay" landing/src/components/rheo/Gallery.tsx

# ascii field still legible (do NOT regress the gamma)
node landing/scripts/probe-ascii-surface.mjs

# scoped checks only — never a repo-wide build
npx esbuild landing/src/components/rheo/Gallery.tsx --bundle --outfile=/dev/null \
  --alias:@=./src --external:react --external:framer-motion --log-level=warning
npx tsc --noEmit -p landing/tsconfig.json 2>&1 | grep -E "Gallery"
```

**One thing only a human can confirm:** after implementing, scroll the page top
to bottom once and answer — *does each section tell me one thing, or do I have
to work out what I'm looking at?* If the second, the structure is still wrong
regardless of what passed.

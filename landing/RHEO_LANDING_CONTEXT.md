# RHEO Landing Page — Complete Context & Fix Brief

## WHAT THIS IS
This document captures everything needed to turn the RHEO landing page from
a rough draft into a professional, intentionally designed, conversion-focused
single-page site. Use it as the single source of truth for any developer or
AI agent working on the project.

---

## 1. PRODUCT OVERVIEW

**RHEO** (ῥέω — Greek: "to flow") is an AI-native time-tracking desktop app.
It records how you spend your hours, then turns the record into understanding
— phases, dashboards, lessons, and an AI that knows your time because it
watched it flow.

**Key differentiators:**
- Local-first (no cloud, zero telemetry)
- AI queries your actual timeline (not a generic model)
- Phase-based timeline (not just app-switching)
- Every AI answer cites source sessions (receipts, not guesses)
- One-time license (no subscription)
- 14 instruments in "The Atlas" (external tracking, mobile, content engine,
  lyceum, IDE projects, session search, conductor, trace, context brain,
  research digest, resume, finance, life phases, marketplace)

**Target audience:** Knowledge workers, developers, researchers, makers who
treat their time as the scarcest resource and want honest data, not gamification.

---

## 2. CURRENT SECTION ORDER (page.tsx)

```
Preloader → Hero → Manifesto → ActRecord → Capabilities →
ActUnderstand → LearnVignette → AtlasSection → ActFlow →
Download → Footer
```

Chrome (fixed): Nav, DayRuler, SectionIndex, Grain, CursorGlow, CommandPalette.

---

## 3. SECTION-BY-SECTION AUDIT (what's wrong + what to fix)

### Hero (S1 — "OBSERVE")
**Current problems:**
- Left-aligned content with 60% empty void on the right (desktop)
- No product visualization — just text on black
- "Download for Linux" as primary CTA is niche/bizarre for a pre-launch product
- Sub copy is generic SaaS-speak
- The ASCII flow field canvas is the page's pulse but is too subtle to notice

**Fix:**
- Replace "Download for Linux" with "JOIN THE WAITLIST" (already done — verify)
- Add a product visualization on the right: a mini live-timeline mock that
  shows phases filling in real-time (reuse the FlowFieldCanvas or a simplified
  dashboard card mock)
- Rewrite sub copy to be specific and compelling (not "phases, dashboards,
  lessons" — say what it DOES: "Watches your focus. Tags it by phase. Turns
  the record into understanding you can't unsee.")
- Make the ASCII flow field slightly brighter (0.3→0.5 min opacity) so it's
  visibly alive, not just "is something there?"

### Manifesto (S2 — "OBSERVE" continued)
**Current problems (FIXED this round):**
- ~~Marquee band was decorative noise — killed~~
- ~~120vh was too much empty scroll — reduced to 90vh~~
- ~~No visual anchor — added a time-flow line that draws as you scroll~~

**Remaining:**
- The word-by-word reveal is still very subtle — consider making revealed
  words slightly brighter (0.15→0.25 starting opacity) so the effect is
  perceptible without scrolling back and forth
- Add a scroll cue (↓ arrow or "scroll to explore") at the bottom

### ActRecord (S3 — "RECORD" — signature centerpiece)
**Current problems:**
- 300vh section is exhausting — users scroll through empty space
- "Oh 00m" counter text at progress=0 looks like a bug
- The layout has 3 columns (left text, center dashboard, right timeline) that
  fight each other for attention
- "A DAY, REPLAYABLE." is enormous but disconnected from the dashboard card
- The dashboard card floats without visual anchoring
- Cryptic labels ("scrub time", "replay →") that users don't understand

**Fix:**
- Reduce to 200vh (less empty scroll)
- Initialize the per-phase counters to their TOTAL (not 0) — counting DOWN
  as you scroll up is more intuitive than counting UP from 0
- Shrink the H2 — "A DAY, REPLAYABLE." should be smaller than the hero H1
- Move the dashboard card closer to center (reduce the left text column width)
- Replace "scrub time" with a visible scroll-progress indicator that users
  can actually drag
- Add a "00:00 → 24:00" label on the timeline so users understand it's a day

### Capabilities (S4 — bento grid)
**Current state (recently fixed):**
- Bento layout: AI-NATIVE col-span-4, others col-span-2 ✓
- Demos trigger on inView ✓
- Min-heights set (terminal 180, TUI 160, node 140) ✓
- LaminarSpotlight on all 5 cards ✓

**Remaining:**
- The TUI demo is static — make the blinking cursor more prominent
- The terminal demo types text but the text is generic — use real RHEO
  queries ("> rheo query \"deep work this week\"" is good, keep it)
- The phases ridgelines are too subtle — increase opacity from 0.2 to 0.35

### ActUnderstand (S5 — "UNDERSTAND")
**Current state (recently fixed):**
- 3 verbatim scenarios ✓
- Caption "SIMULATED RECORD SHOWN" ✓
- Bar chart draws with staggered springs ✓

**Remaining:**
- The node graph on the right is disconnected and small — consider
  integrating it into the console card as a "sources" footer
- The auto-play cycle is 7s — consider making it clickable (user can
  advance to the next scenario by clicking the console)

### LearnVignette (S6 — "LEARN")
**Current problems:**
- The SVG focus curve figure is tiny and hard to see
- The lesson text lines fade in sequentially but are hard to read at 15px
- The equation "depth = ∫ attention dt / duration" overflows on mobile

**Fix:**
- Increase the SVG figure size (make it the hero of this section)
- Increase lesson text to 16px
- The equation should wrap or shrink on mobile (already has overflowWrap)

### AtlasSection (S7 — "THE ATLAS")
**Current state:**
- 14 cards in a horizontal rail ✓
- Scroll-driven translateX ✓
- Card hover: translateY(-2px) + border .16 + LaminarSpotlight ✓
- Click opens modal with 3 bullets ✓
- data-rail attributes on both wrappers ✓

**Remaining:**
- The rail feels disconnected from the header — add a subtle "scroll →"
  indicator that shows users they need to scroll to see all 14 instruments
- The active card (nearest center) should have a more prominent treatment
  (brighter border, full opacity vs 0.5 for others — already done but verify)

### ActFlow (S8 — "FLOW")
**Current state:**
- 5 stacked ridgeline waves with chaotic→calm crossfade ✓
- Giant "RHEO" with VariableProximity weight easing ✓
- 3 lines of text that fade in with scroll ✓
- Parallax on waves ✓

**Remaining:**
- The section is 150vh — could be tighter (120vh)
- The "RHEO" letters at 0.08 starting opacity are nearly invisible — bump to 0.2

### Download (S9 — waitlist)
**Current state:**
- "JOIN THE WAITLIST" form POSTing to formspree ✓
- Success "you're in the record." ✓
- Changelog modal kept ✓
- Mono line "v0.1 PRE-RELEASE · LOCAL FIRST · 0 BYTES TO CLOUD" ✓

**Remaining:**
- The H2 "OWN YOUR HOURS." doesn't match the waitlist context — consider
  "BE FIRST TO FLOW." or "YOUR HOURS ARE WAITING."
- Add a subtle count of people on the waitlist (mock: "joining 247 others")

---

## 4. INTERACTIVE FEATURES — STATUS & VISIBILITY

| Feature | Implemented? | Visible to user? | Notes |
|---|---|---|---|
| ASCII flow field canvas (hero) | ✓ | Barely | Increase min glyph opacity 0.3→0.5 |
| Scroll-velocity turbulence (H1) | ✓ | Subtle | Displacement scale responds to fast scroll |
| Laminar cursor glow (hero) | ✓ | Subtle | Only visible on dark areas |
| DecryptedText scramble (kickers) | ✓ | Yes | Fires on scroll-into-view |
| Word-by-word manifesto reveal | ✓ | Subtle | Starting opacity 0.15 is too low |
| Magnetic dots (SectionIndex) | ✓ | **FIXED** | Was 4px pull/.16 bloom → now 8px/.32, marks 24px×2px |
| Progress ring (SectionIndex) | ✓ | Yes | Shows % read |
| ActRecord scrub (300vh) | ✓ | Confusing | Counters start at "0h 00m" which looks broken |
| Capabilities bento demos | ✓ | Yes | Terminal types, node graph draws |
| ActUnderstand console | ✓ | Yes | Auto-plays 3 scenarios |
| Atlas card spotlight | ✓ | Yes | Cursor-follow radial on hover |
| Atlas modal | ✓ | Yes | Click any card → details |
| VariableProximity (ActFlow "RHEO") | ✓ | Subtle | Weight 500→700 by cursor distance |
| Command palette (⌘K) | ✓ | Yes | Searchable jump + actions |
| Changelog modal | ✓ | Yes | From Download section |
| Waitlist form | ✓ | Yes | POSTs to formspree |
| Print stylesheet | ✓ | N/A | Only in print dialog |
| Footer live clock | ✓ | Yes | Gated behind RM |

---

## 5. DESIGN CONTRACT (LAMINAR — non-negotiable)

**Colors (ONLY these):**
- Page bg: #050506
- Panel: #0A0A0C
- Card: #101014
- Hairlines: rgba(255,255,255,0.08) default, 0.16 emphasized
- Text: #F4F4F5 (hi) / #A1A1AA (mid) / #63636B (low)
- Accent: pure #FFFFFF (the ONLY accent — importance = brightness, never hue)
- Glow: white radial ≤8% opacity

**BANNED:** any hue, colored gradients, neon, emoji, stock photos, AI illustrations,
Inter font, green "hacker terminal" text, oversized rounded corners,
box-shadows for depth, backdrop-blur on scrims, 3D tilt, bounce/overshoot.

**Typography:**
- Display: Space Grotesk (500, 700)
- Mono: JetBrains Mono (400, 500) — all labels, chips, kickers
- Mono labels: 11px uppercase, letter-spacing 0.14em, color #63636B
- Display headlines: clamp(32px, 9vw, 128px), tracking -0.02em, weight 500–700

**Radii:** 6 / 10 / 16px only.
**Easing:** cubic-bezier(0.16,1,0.3,1) everywhere.
**Texture:** SVG feTurbulence grain overlay, fixed, 4% opacity.

---

## 6. TECH STACK

- Next.js 16 (App Router) + TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York)
- framer-motion (useScroll, useTransform, useSpring, useInView, MotionConfig)
- lucide-react (icons — ONLY icon library allowed)
- No other dependencies. No images. No video. No canvas libs (hero canvas is hand-rolled).

---

## 7. FILE STRUCTURE

```
src/
  app/
    page.tsx          — single route, composes all sections
    layout.tsx        — fonts, metadata, viewport
    globals.css       — LAMINAR design system (1400+ lines)
  components/rheo/
    Hero.tsx          — S1: flow field canvas + turbulence H1 + CTAs
    Manifesto.tsx     — S2: word-by-word scroll reveal
    ActRecord.tsx     — S3: 300vh scrub centerpiece (dashboard + timeline)
    Capabilities.tsx  — S4: bento grid with 5 micro-demos
    ActUnderstand.tsx — S5: AI console with 3 auto-play scenarios
    LearnVignette.tsx — S6: scroll-drawn SVG + lesson text
    AtlasSection.tsx  — S7: 14-card horizontal rail + modals
    ActFlow.tsx       — S8: ridgeline waves + VariableProximity "RHEO"
    Download.tsx      — S9: waitlist form + changelog modal
    Footer.tsx        — live clock + links
    Nav.tsx           — glass nav + mobile menu + NavClock
    DayRuler.tsx      — right-edge 24h timeline with scroll playhead
    SectionIndex.tsx  — left-edge dots + progress ring + magnetic cursor
    Grain.tsx         — SVG feTurbulence grain overlay
    CursorGlow.tsx    — hero-scoped cursor-follow radial
    CommandPalette.tsx— ⌘K searchable jump + actions
    Changelog.tsx     — modal opened from Download
    Preloader.tsx     — 0→100 counter, <800ms
    FlowFieldCanvas.tsx — ASCII glyph grid, value-noise, scroll-velocity turbulence
    DecryptedText.tsx — per-character scramble on inView
    Def.tsx           — glossary tooltip (phase, deep work, etc.)
    LaminarSpotlight.tsx — shared cursor-follow radial for cards
    VariableProximity.tsx — per-letter weight easing by cursor distance
    atlas-data.ts     — 14 instruments (names, statuses, one-liners)
    use-*.ts          — hooks (reduced-motion, scroll-velocity, detected-os, etc.)
```

---

## 8. MOTION LAWS (enforced everywhere)

1. **Scroll-scrubbed = reversible**: anything scroll-tied is a pure function
   of progress (useTransform), never a one-time tween. Scroll up = rewinds.
2. **Transform/opacity only** for scroll-linked styles. Never read layout in
   scroll handlers without rAF batching.
3. **Reduced-motion = final static states**: no transforms, no canvas animation,
   no marquees. Everything renders in its final position.
4. **One canvas only** (hero flow field). All other motion = SVG/CSS/transform.
5. **No scroll hijacking** (no Lenis, no locomotive, no smooth-scroll libs).

---

## 9. IMMEDIATE PRIORITY FIXES (ranked by user impact)

1. **Manifesto marquee killed + section tightened** ✓ DONE
2. **Magnetic dots made visible** (8px pull, .32 bloom, 24×2px marks) ✓ DONE
3. **Hero: add product visualization on the right** — highest impact, not done
4. **ActRecord: fix "0h 00m" counter + reduce to 200vh** — high impact
5. **ActRecord: shrink H2 + anchor dashboard card** — medium impact
6. **Flow field: increase min glyph opacity** — easy win
7. **ActFlow: tighten to 120vh + bump RHEO starting opacity** — easy win
8. **Atlas: add "scroll →" indicator** — easy win
9. **LearnVignette: enlarge SVG figure** — medium impact
10. **Download: rewrite H2 to match waitlist context** — easy win

---

## 10. WHAT MAKES A LANDING PAGE "WELCOMING AND ENTICING"

The current site is technically impressive but emotionally cold. To fix:

1. **Show the product, not just describe it** — the hero needs a visual (a mini
   dashboard, a live timeline, SOMETHING that shows what RHEO looks like)
2. **Reduce cognitive load** — too many sections with too much text. Cut the
   manifesto to 2 sentences. Cut the ActRecord scrub time. Get to the point.
3. **Make the interactivity discoverable** — the magnetic dots, the scramble
   text, the cursor glow — none of these are obvious. Add subtle cues ("hover
   the dots", "scroll to explore", "click a card")
4. **Create a narrative arc** — Hero (hook) → Manifesto (why) → Record (how)
   → Capabilities (what) → Atlas (scope) → Flow (feeling) → Download (action).
   Each section should flow naturally into the next, not feel like a checklist.
5. **Use whitespace intentionally** — empty space is fine when it frames
   content. Empty space that looks like a bug is not.
6. **End with a clear, warm CTA** — "JOIN THE WAITLIST" is good. The success
   state "you're in the record." is good. Make sure the whole page builds
   toward that moment.

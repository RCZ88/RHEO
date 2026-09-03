# Landing Context 01 — Read-Only Census & Diagnosis
> Working dir: `landing/`. Port 3001 (next dev). Build exits 0.

## 1. Section order as rendered (page.tsx)
Hero → Manifesto → ActRecord → Capabilities → ActUnderstand → LearnVignette → AtlasSection → ActFlow → Download, then Footer, CommandPalette, Changelog.

## 2. Item census table (C1–C15)
| # | Item | Verdict | Evidence |
|---|---|---|---|
| C1 | Compare/Testimonials/Pricing/FAQ/TrustedBy | **ABSENT** | No such files or routes; globals.css has `.compare-table` stubs only |
| C2 | Manifesto word windows | **PRESENT** | `Manifesto.tsx:48-61`; start=`0.05+0.7*(i/N)`, end=`0.05+0.7*((i+1)/N)`, HOLD=0.95 |
| C3 | Bento spans | **PRESENT** | `Capabilities.tsx:34` grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-6`; card0 `lg:col-span-4`, others `lg:col-span-2`; demos min-heights 180/140/160 |
| C4 | TUI pane labels + workspace caption | **PRESENT** | `Capabilities.tsx:378` panes EDITOR/AGENT/TIMELINE; caption `"the room your agents work in."` |
| C5 | Act III honesty caption + scenario strings | **PRESENT** | `ActUnderstand.tsx:77` caption `"SIMULATED RECORD SHOWN…"`; scenarios: tuesday deep work -22%, what did I learn this week, when am I sharpest |
| C6 | Footer clock RM gate | **PRESENT** | `Footer.tsx:5-18`; `useNow()` checks `prefers-reduced-motion`, static under RM |
| C7 | ui/chart.tsx + recharts | **PARTIAL** | `recharts` in deps (`^2.15.4`); no `ui/chart.tsx` file; only SVG charts inline |
| C8 | useScrollVelocity idle skip | **PRESENT** | `use-scroll-velocity.ts:51-56` and `use-scroll-velocity-value.ts:38-41`; skips when `|v|<0.01 && heroOffscreen` |
| C9 | Download button + form + FORMSPREE | **PRESENT** | `Download.tsx:9` `FORMSPREE_ENDPOINT="https://formspree.io/f/FORMSPREE_ID"`; button `"JOIN THE WAITLIST"` |
| C10 | Meta/OG + public/og.png | **PRESENT** | `layout.tsx:23-46`; `public/og.png` exists (39078 bytes) |
| C11 | Scramble component | **PRESENT (as DecryptedText)** | `DecryptedText.tsx` — per-char scramble, applied in Hero/Manifesto/Learn/ActRecord |
| C12 | SectionIndex dot behavior | **PRESENT** | `SectionIndex.tsx:167-198`; 9 dots, spring `--pull` via rAF, cursor proximity within 24px |
| C13 | LaminarSpotlight / cursor radial | **ONE impl** | `LaminarSpotlight.tsx` shared; used in AtlasSection + Capabilities; 19 instances on page |
| C14 | Hero H1 turbulence filter | **PRESENT** | `Hero.tsx:77-93` SVG `feDisplacementMap`; driven by scroll velocity (scale≤24) |
| C15 | Atlas data-rail attributes + hover | **PRESENT** | `AtlasSection.tsx:288-339`; `atlas-card` class, hover `translateY(-2px)` + `border-color` |

## 3. Manifesto math + dead-scroll + media index
- **Math (exact):** `lineDraw = useTransform(scrollYProgress, [0.1, 0.6], ["0%","100%"])`; word opacity = `useTransform(progress, [start, end], [0.15, 1])`, `start=0.05+0.7*(i/N)`, `end=0.05+0.7*((i+1)/N)`, HOLD=0.95 (voided). Section height=90vh, sticky wrapper=100dvh.
- **Dead scroll:** last word (index 28) reaches full opacity at scrollY≈1400 (p≈0.75 of section). Sticky unpins at section top (scrollY=800). Gap between last-word-full-opacity (1400) and section-end sticky-unpin (800) — last word finishes revealing ~600px **before** the section ends; the sticky wrapper holds through p=1.0 so the "dead scroll" (time between last word fully visible and section end) ≈ **600px / ~6vh**.
- **8s webm:** `design/media/context/scroll_demo.webm` (1280×800, top→bottom→top).
- **Checkpoints:** p=0/.2/.4/.6/.8 → lastWordOpacity=0.15; p=0.95 → 1.0. First word always opaque (0.15 baseline).

## 4. Capabilities diagnosis
- Grid `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4` at 1280px → grid=1152px wide, cards: #0=763px (col-span-4), #1-4=373px (col-span-2). Card heights 291/291/271/271/271 — uneven (AI-NATIVE taller). Empty right edge: 0px.
- Demos: Timeline fills with card scroll progress; Terminal (~2s loop, minH=180); NodeGraph (draw-on-inView, minH=140); TUI (EDITOR/AGENT/TIMELINE, minH=160); Phases ridgelines (static SVG). All fire via `useInView` threshold 0.25.
- Empty space: none horizontally; vertically cards differ 20px (timeline card taller).

## 5. Act Record glance-read (scrub p=0.5)
Dashboard card at center shows: SVG line chart + area fill, playhead dot, stat chips (FOCUS/MEETINGS/LEARNING/REST — active = MEETINGS at p=0.5), mini timeline bar with progress fill, segmented phase blocks, and the 24h vertical track with playhead + HH:MM readout. Phase story reads: REST→DEEP WORK→MEETINGS→LEARNING, each with a blurb + recorded minutes counter. At p=0.5 (hour 12) MEETINGS is active.

## 6. Console errors
Zero errors/warnings at 1280×800 and 375×800 (Playwright). Only React DevTools + HMR info toasts. No hydration, key, or a11y errors observed.

## 7. Build status
`npm run build` exits 0 (Next.js 16.3.4 Turbopack). Static pages: 4 generated (/, _not-found, +dynamic /api). No errors verbatim.

## 8. Top 5 defects by user-visible impact
1. **Manifesto dead scroll** — last word reveals at p=0.75 but sticky section holds to p=1.0, leaving ~6vh of "revealed but pinned" dead space; recommend tightening offset or ending sticky at last-word opacity.
2. **ActRecord counters show `0h 00m` at scrubbed positions** — counter refs only update on `p.on('change')` but initial render shows 0h 00m until p changes; at rest (p≈0) the dashboard appears empty.
3. **Card heights uneven in Capabilities** — AI-NATIVE card 291px vs 271px others (20px gap) breaks grid alignment.
4. **Hero H1 turbulence filter drops to 0 immediately** — displacement scale lerps to 0 in ~1.2s and only re-animates on scroll; first-time viewers see crisp H1 with no visible turbulence unless actively scrolling.
5. **No Compare/Testimonials/Pricing/FAQ/TrustedBy** — these sections are absent from the landing page entirely (spec references stubs only in globals.css).

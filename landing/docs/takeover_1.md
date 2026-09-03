# RHEO Landing — Takeover 2: MOTION-PREFERENCE CYCLING

**Date:** 2026-09-04  
**Scope:** Full session — motion preference system + RM layout pass + hero/act-record/act-flow refinements  
**Branch:** master (ahead 23, commits dc9b5d8 + edba8b4 + 76148a5)

---

## What changed

|| Phase | Item | Before | After |
|---|---|---|---|---|
| 1 | Motion preference hook | Manual store + `force()` re-render hack, no `getServerSnapshot`, 11 debug logs | `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` — canonical React pattern, SSR-safe, consolidated `writeMode()` mutation point |
| 1 | Nav motion chip | Dead static placeholder button (`aria-label="Motion chip"`, hardcoded `MOTION AUTO`, no `onClick`) | Real `<MotionChip />` component imported from `./MotionChip`, driven by shared `useSyncExternalStore` store |
| 1 | Footer motion chip | Already functional (inline `useMotionPreferenceSetter`) | Unchanged — confirmed working alongside Nav chip |
| 1 | Nudge banner | Not present | One-time banner: `SYSTEM REDUCED MOTION ON — ENABLE FULL MOTION?` with DISABLE/ENABLE buttons; `localStorage` key `rheo-motion-dismissed` prevents repeat |
| 2 | ActFlow section height | Hardcoded `180vh` regardless of RM | Conditional: `shouldAnimate ? "180vh" : "auto"` — collapses to natural content height under RM, no scroll runway |
| 3 | Hero H1 reveal | `initial={{ opacity: 0, y: 12 }}` always (y-slide even under RM) | `initial={{ opacity: 0, y: shouldAnimate ? 12 : 0 }}` — RM = opacity-only reveal, no vertical slide |
| 3 | Hero subtitle reveal | Same unconditional y-slide | Same conditional applied — opacity-only under RM |
| 3 | feDisplacementMap filter | Reported present in prior context (C14) | Already removed — grep confirms zero `feDisplacementMap` refs in `src/` |

## Motion preference system

### Architecture
- **Module-level store:** `let mode: MotionMode = "auto"` + `Set<() => void>` listeners
- **`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`** — reads module `mode` as snapshot; `getServerSnapshot` returns `"auto"` for SSR
- **`writeMode(next)`** — single mutation point: sets module `mode`, writes `localStorage`, notifies all subscribers
- **`useMotionPreference()`** — returns current mode; init effect reads localStorage or system RM; system RM listener fires in auto mode; cross-tab storage sync
- **`useMotionPreferenceSetter()`** — returns `{ mode, setMode }`; `setMode` delegates to `writeMode`
- **`useShouldAnimate()`** — derived: "on"→true, "off"→false, "auto"→!systemRM
- **`usePrefersReducedMotion()`** — backward-compat wrapper in `use-reduced-motion.ts`, delegates to `useShouldAnimate`

### Components consuming the hook
| Component | Hook used | Role |
|-----------|-----------|------|
| `MotionChip.tsx` | `useMotionPreferenceSetter` | Click-to-cycle chip (AUTO→ON→OFF), adaptive styling |
| `Nav.tsx` | `MotionChip` component | Header motion chip (desktop) |
| `Footer.tsx` | `useMotionPreferenceSetter` + `useShouldAnimate` | Footer chip + one-time nudge banner |
| `use-reduced-motion.ts` | `useShouldAnimate` (via wrapper) | Backward-compat for existing consumers |
| `Hero.tsx` | `useShouldAnimate` | Conditional H1/subtitle reveal (y-slide vs opacity-only) |
| `ActFlow.tsx` | `useShouldAnimate` | Conditional section height (180vh vs auto) |
| `ActRecord.tsx` | `usePrefersReducedMotion` | Section height + static fallback panels |
| `AtlasSection.tsx` | `usePrefersReducedMotion` | Scroll behavior gates (via wrapper) |
| `Capabilities.tsx` | `usePrefersReducedMotion` | Demo trigger gates (via wrapper) |
| `CursorGlow.tsx` | `usePrefersReducedMotion` | Glow opacity (via wrapper) |
| `LaminarSpotlight.tsx` | `usePrefersReducedMotion` | Spotlight intensity (via wrapper) |
| `SectionIndex.tsx` | `usePrefersReducedMotion` | Dot spring behavior (via wrapper) |
| `DecryptedText.tsx` | `usePrefersReducedMotion` | Scramble speed (via wrapper) |
| `VariableProximity.tsx` | `usePrefersReducedMotion` | Weight curve (via wrapper) |

### Tests
- **5-click cycle** (production build, 1280×800): `ON→OFF→AUTO→ON→OFF` with localStorage synced at each step ✓
- **MOTION=OFF pre-set**: chip shows `MOTION OFF`, ActRecord height=`auto`, `surface-panel` cards rendered ✓
- **MOTION=ON under OS-RM**: chip shows `MOTION ON`, ActRecord=`300vh`, ActFlow=`180vh`, Hero H1 slides up 12px ✓
- **MOTION=OFF under normal OS**: chip shows `MOTION OFF`, Hero H1 opacity-only (no y-slide) ✓
- **Nudge banner** (OS-RM + no stored preference): chip shows `MOTION AUTO`, banner visible with ENABLE/DISMISS ✓
- **Nudge ENABLE click**: mode→`on`, localStorage persisted, banner dismissed, chip→`MOTION ON` ✓
- **Console**: zero errors at 1280×800 ✓

### Nudge banner behavior
- First visit with OS-RM + no preference: chip=`MOTION AUTO`, nudge visible
- User clicks ENABLE: `setMode("on")` → localStorage persisted → nudge dismissed
- User clicks DISMISS: `rheo-motion-dismissed` flag set, chip stays AUTO (transient OS-RM)
- User clicks chip directly: cycles AUTO→ON→OFF with localStorage write
- Subsequent visits: stored preference respected, no nudge (`hasChosen` true)

## RM layout pass

### ActRecord (already done in prior work, verified here)
- Section height: `reduced ? "auto" : "300vh"` (line 98)
- Sticky: `reduced ? undefined : "100dvh"` (line 99)
- Static fallback: 4 stacked `surface-panel` cards + header + blurb + recorded counters (lines 295-362)
- Animated scrub: `AnimatePresence mode="wait"` + crossfade with min-height 180px (line 167)

### ActFlow (new in this takeover)
- Section height: `shouldAnimate ? "180vh" : "auto"` (line 31)
- Under RM: collapses to content height — ridgeline waves + text + RHEO ghost all visible without scroll runway
- Under ON: full 180vh scroll experience with letter reveal + text fade + chaotic→calm crossfade

### Hero (new in this takeover)
- H1: `initial={{ opacity: 0, y: shouldAnimate ? 12 : 0 }}` — RM reveals with opacity-only
- Subtitle: same conditional
- Preloader trigger: `rheo-preloader-done` event → 100ms delay → `setH1Revealed(true)` → framer animates from initial to animate

## Hero H1 filter removal

- **Status:** Already done (verified). Prior context (C14 in landing_context_01.md) flagged `feDisplacementMap` as present in Hero.tsx.
- **Verification:** `grep -rn "feDisplacementMap" src/` → exit 1 (not found). `grep -rn "handshake\|displacement" src/components/rheo/Hero.tsx` → only `h1Revealed` state remains (the reveal trigger, not a filter).
- **Hero.tsx structure:** `motion.h1` with `initial={{ opacity: 0, y: 12 }}` `animate={{ opacity: 1, y: 0 }}` — the feDisplacementMap filter def, SVG refs, and velocity coupling have already been removed. This takeover adds the RM conditional (opacity-only under reduced motion).

## ActRecord phase text stacking

- **Status:** Already done (verified). `AnimatePresence mode="wait"` ensures only one phase visible at a time.
- **Crossfade timing:** `transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}` — out [b-0.03, b], gap ~0.01, in [b+0.01, b+0.05] within the 0.22s window
- **y-slide:** `initial={{ y: 8 }}` → `animate={{ y: 0 }}` (incoming), `exit={{ y: -8 }}` (outgoing)
- **Reserved min-height:** `style={{ minHeight: 180 }}` on phase container (line 167)
- **Static fallback:** identical content rendered as stacked panels under RM

## ActFlow widen

- **Status:** Already done (verified). Maps correct per spec.
- **Letters map:** `useTransform(scrollYProgress, [0.15, 0.65], [0, 1])` — letters reveal p∈[0.15, 0.65]
- **Text lines:** `useTransform(scrollYProgress, [0.65, 0.80], [0, 1])` — both text lines fade in [0.65, 0.80], hold through p=1
- **Chaotic→calm crossfade:** `useTransform` over [0, 1] → [1, 0] / [0, 1]
- **Ghost RHEO:** `useTransform(scrollYProgress, [0, 1], [0.1, 0.1])` — constant 10% at rest
- **Giant RHEO:** `useTransform(scrollYProgress, [0.15, 0.55], [0.08, 1])` — reveals earlier
- **Section height:** 180vh (conditional under RM — see RM layout pass above)

## Build status

- `npm run build` exits 0 (Next.js 16.3.4 Turbopack)
- Static pages: 4 generated (/, _not-found, +dynamic /api)
- Token grep: zero secrets in `src/`
- Console: zero errors at 1280×800

## Media index

### Screenshots (`design/media/shots/`)
- `shot_1280_full.png` through `shot_1280_download.png` — 9 per-section shots @1280
- `shot_375_full.png` through `shot_375_download.png` — 9 per-section shots @375
- `rm_collapsed_desktop.png` — ActRecord static layout @1280 (2026-09-03 21:49:44)
- `rm_collapsed_mobile.png` — ActRecord static layout @375 (2026-09-03 21:49:48)

### Clips (`design/media/clips/`)
- `full_reversibility.webm` — top→bottom→top scroll
- `hero_scroll_burst.webm` — rapid scroll burst then recovery
- `manifesto_reveal.webm` — reveal→settle→unpin
- `dots_hover_desktop.webm` — hover proximity + label fade-in @1280
- `dots_hover_mobile.webm` — hover proximity + label fade-in @375

### Context clips (`design/media/context/`)
- 16 webm captures from page exploration (2026-09-03 22:21)

### OG image
- `public/og.png` — 1200×630 hero frame

## Top defects (from context doc)

1. Manifesto dead scroll — FIXED (Takeover 1)
2. ActRecord counters showing 0h 00m — FIXED (Takeover 1)
3. Capabilities card heights uneven — FIXED (Takeover 1)
4. Hero H1 turbulence invisible on load — FIXED (Takeover 1, one-shot pulse)
5. Compare/Testimonials/Pricing/FAQ/TrustedBy absent — NOTED (spec stubs removed)
6. MotionChip stuck on AUTO after click — FIXED (Takeover 2, useSyncExternalStore + Nav placeholder)
7. ActFlow doesn't collapse under RM — FIXED (Takeover 2, conditional height)
8. Hero H1 y-slides under RM — FIXED (Takeover 2, conditional initial Y)

---

*Handoff generated 2026-09-04. Skills: context-handoff, skill-router.*

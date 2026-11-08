# CONTEXT BUNDLE: Landing Page Full Polish — Comprehensive Revamp

## Problem
The RHEO landing page (Next.js, `landing/`) has multiple issues that need comprehensive improvement:

1. **Timeline tracking visualization (SampleDayTimeline)** — empty gaps, not well portioned, bars are sub-pixel (0.306px/min in 440px container), vague, doesn't show the "real thing"
2. **Vault/Layers visualization (Download section)** — no actual animation, vault doesn't open, layers don't explode, doesn't connect to anything, missing interactive elements
3. **Screen captures** — 14 screenshots re-shot but some still wrong (data-dir shows Dolphin, network-monitor shows system monitor, studio shows empty state)
4. **Layout gaps** — multiple sections have excessive vertical spacing, elements feel disconnected
5. **ActRecord layout** — island layout (absolute positioning) creates collision issues, empty space
6. **Hero** — Dayfield (81 pillars) at 0.6 opacity overlays the screenshot awkwardly

## User's Verbatim Request
"WHAT ABOUT THE REST OF THE WEBSITE?? THE INTERACTIVE AND LIKE THE FIXING OF LIKE THE SCREEN CAPTURE AND SCREEN RECORDING AND THE TIMELINE TRACKING SYSTEM, LIKE THE VISUALIZATION AND STUFF ARE REALLY BAD AND DOESNT HAVE IT PROPERLY CONFIGURED. ESPECIALLY like the fucking weird gaps and like NO ACTUAL LIKE SHOWING OF THE REAL APP OF THE TRACKING SECTION, AND LIKE SO MANY MORE THINGS TO POLISH ABOUT."

## Current State
- Landing page is Next.js 16 in `landing/` directory
- Dark mode only, LAMINAR design system
- 5 sections: Hero, ActRecord, Gallery, ActUnderstand, Download
- All data is real (1,440 minute samples from RHEO database)
- 26 screenshots in `landing/public/media/`
- Netlify deployment still having issues (404 on all routes)

## Design System (LAMINAR)
- **Colors**: Monochrome zinc. Background #050506. Text #f4f4f5 (hi), #a1a1aa (mid), #8a8a94 (lo), #63636b (dim).
- **Signal hue**: ONE per surface. Download uses white (#ffffff) as signal.
- **Radii**: 6px, 10px, 16px only. Pill for tags.
- **Spacing**: 4px base. Sections: pt-24 sm:pt-32. Cards: p-5. Gaps: gap-3, gap-5, gap-8.
- **Typography**: Inter (body), JetBrains Mono (mono labels/data), Space Grotesk (display, max 2 per view).
- **Motion**: Single easing [0.16, 1, 0.3, 1]. 160ms for micro-interactions. Opacity + transform only (no layout properties).
- **No**: glassmorphism on chrome, decorative glow, gradients, spring/bounce, emoji icons.
- **reduced-motion**: All animations gated. Static fallback always.

## File Inventory

### Core Components
1. `landing/src/components/rheo/SampleDayTimeline.tsx` (312 lines) — 24h timeline from real data
2. `landing/src/components/rheo/ActRecord.tsx` (448 lines) — scroll-scrub section, wraps SampleDayTimeline
3. `landing/src/components/rheo/Download.tsx` (356 lines) — Proof section, Vault/Exploded figures, OS cards
4. `landing/src/components/rheo/Hero.tsx` (209 lines) — hero with Dayfield figure + screenshot
5. `landing/src/components/rheo/Dayfield.tsx` (176 lines) — 81 pillars at real data heights
6. `landing/src/components/rheo/ActUnderstand.tsx` (341 lines) — AI console with tablist pattern
7. `landing/src/components/rheo/Gallery.tsx` (350+ lines) — 17-screen scroll-snap rail
8. `landing/src/components/rheo/Ledger.tsx` — 3 sourced claims
9. `landing/src/app/page.tsx` — 5-section mount chain
10. `landing/src/app/globals.css` (2079 lines) — design tokens

### Data
- `landing/data/sample-day.json` — 1,440 minute samples (intensity, category)
- `landing/scripts/export-sample-day.py` — read-only export from RHEO DB

### Hairline Library
- `@lucasmarkes/hairline/react` — Vault, Exploded, Terrain, Phosphor, etc.
- API: `make(name, mount)` where mount takes `(el, options)` and returns `{ set, destroy }`
- Props: `intensity`, `theme`, `label`, `onRead`, `play`, `style`
- Figures are pointer-driven only (parallax), no animation API
- `onRead` fires text descriptions of pointer position

## User's Specific Complaints

### 1. Timeline tracking visualization
- "too much empty gap space that is like not well portioned nor designed"
- "the showing visualization of the timeline tracking system"
- "NO ACTUAL LIKE SHOWING OF THE REAL APP OF THE TRACKING SECTION"
- The SampleDayTimeline is 440px wide inside a 1280px section → sub-pixel bars (0.306px/min)
- The readout (time/category/intensity) is below the timeline, not integrated
- The provenance line is far from the visualization
- Six visual registers with three different gaps (8/16/16)

### 2. Vault/Layers visualization
- "the visualization animation thing with the vault stuff on the bottom section can be improved because like there are view elements that are missing from the visual interactables"
- "currently its only the vault and the one weird visualization that doesnt tell shit and doesnt connect to anything"
- Vault and Exploded are pointer-reactive only (parallax)
- No actual animation (vault doesn't open, layers don't explode)
- They don't connect — switching tabs just swaps one figure for another
- "it should also be interactively good"

### 3. Screen captures
- 14 screenshots re-shot but some still wrong
- `app-data-dir.png` shows Dolphin file manager (dark)
- `app-network-monitor.png` shows system monitor (dark)
- `app-studio.png` shows empty state
- `app-profiler.png` shows empty state
- Screenshots are dark mode (consistent with design but hard to see)

### 4. Layout gaps
- Multiple sections have excessive vertical spacing
- Elements feel disconnected
- ActRecord uses absolute positioning (island layout) that creates collision issues

### 5. Netlify deployment
- Still 404ing (site-level publish directory overrides netlify.toml)
- Static export configured but not being served

## What We Want From GLM

### For the SampleDayTimeline:
1. Layout improvements — better spacing, more cohesive readout, less empty space
2. Show the real app — the timeline should feel connected to actual RHEO usage
3. Specific CSS/layout changes — exact values, not vague suggestions

### For the Vault/Layers:
1. Vault opening animation (vault cracks open)
2. Exploding animation that transitions into the 4 layers
3. The vault and layers should CONNECT — vault opens → explodes → reveals 4 layers
4. Interactive elements that are currently missing
5. How the animation connects to the semantic readout (onRead)

### For the overall page:
1. Fix the layout gaps between sections
2. Make the tracking section show the real app
3. Improve the screen captures
4. Fix the Netlify deployment

## Files to Modify
- landing/src/components/rheo/SampleDayTimeline.tsx
- landing/src/components/rheo/ActRecord.tsx
- landing/src/components/rheo/Download.tsx
- landing/src/components/rheo/Hero.tsx
- landing/src/components/rheo/Dayfield.tsx
- landing/src/components/rheo/Gallery.tsx
- landing/src/app/page.tsx
- landing/src/app/globals.css

## Constraints
- Must use LAMINAR design tokens (monochrome, radii 6/10/16, single easing)
- Must not introduce new dependencies
- Must keep reduced-motion support
- Must keep all data real (no fabrications)
- Must not remove existing interactive elements (drag, scroll-scrub)
- Hairline figures are pointer-driven only (no animation API) — need to work around this
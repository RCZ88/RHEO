# Context Bundle — Landing Page Revamp
Date: 2026-09-10
Subject: rheo-landing (React+Vite standalone landing) + landing (Next.js app)

## Issues to fix (from user request, verbatim):
1. **Contrast**: Most important text blends into background — mushy, not enough contrast. Needs adjustment.
2. **No footage/screen recordings**: Everything is too dark, lifeless. Need to add life via motion (10 from agent/docs/motion) or something else.
3. **Card design**: Need to search more elements that fit — use generate-prompt skill + toolset (shadcn MCP + React Bits MCP) to find proper card/section elements.
4. **Compile everything** into a prompt for the external AI to orchestrate, plan, and generate the result spec.

## Project structure

### rheo-landing/ (primary standalone landing — React+Vite)
- `src/App.tsx` — main orchestrator: GrainOverlay, RheoLineSpine, Atmosphere, ScrollProgress, Cursor, NavBar, Hero, Threads, Shuttle, Fabric, ModuleStore, Quiet, OpenSource, Footer
- `src/sections/Hero.tsx` — ASCII flow field, "One shuttle. Every thread.", amber glow text-shadow, captions on scroll
- `src/sections/ModuleStore.tsx` — 12 module cards (mascot + label + desc), hover glow, amber border beam
- `src/sections/Threads.tsx` — LoomSVG warp threads + mascot intro
- `src/sections/Shuttle.tsx` — AI-native shuttle section
- `src/sections/Fabric.tsx` — zoom-out payoff
- `src/sections/Quiet.tsx` — contemplation quote
- `src/components/ASCIIFlowField.tsx`, `Atmosphere.tsx`, `Cursor.tsx`, `GrainOverlay.tsx`, `LiveLoomCanvas.tsx`, `LoomSVG.tsx`, `MagneticButton.tsx`, `NavBar.tsx`, `RheoLineSpine.tsx`, `ScrollProgress.tsx`

### landing/ (Next.js app landing)
- `src/app/page.tsx` — imports all rheo components
- `src/components/rheo/Hero.tsx` — FlowFieldCanvas, "TIME, MADE LEGIBLE.", DecryptedText, OSLogo, Download CTA
- `src/components/rheo/Capabilities.tsx` — bento grid: 5 cards (AI-NATIVE terminal, TIMELINE, LEARNING ENGINE node, WORKSPACE TUI, PHASES ridgelines)
- `src/components/rheo/ActRecord.tsx` — 300vh scrub, vertical 24h timeline, dashboard card with SVG chart, backward-counting counters
- `src/components/rheo/Manifesto.tsx` — word-by-word reveal, time-flow line
- `src/components/rheo/LearnVignette.tsx` — lesson lines + SVG focus curve + equation
- `src/components/rheo/ActFlow.tsx` — 5 ridgeline waves chaotic→calm crossfade
- `src/components/rheo/Download.tsx` — 3 OS cards (shadcn Card primitives), version history
- `src/components/rheo/LaminarSpotlight.tsx` — cursor radial highlight
- `src/app/globals.css` — LAMINAR design system tokens

## Design Tokens (LAMINAR — strictly monochrome)
```css
--bg-page: #050506
--panel: #0a0a0c
--card: #101014
--hairline: rgba(255,255,255,0.08)
--strong: rgba(255,255,255,0.16)
--hi: #f4f4f5        (primary text)
--mid: #a1a1aa       (secondary text)
--low: #63636b       (tertiary/muted text)
--accent: #ffffff    (pure white, only accent)
```

## Typography
- Display: `--font-display` (Space Grotesk, variable)
- Mono: `--font-mono` (JetBrains Mono)
- Sizes: display-h1 clamp(44-128px), display-h2, mono_label 11px

## Installed shadcn components (landing/)
accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toaster, toast, toggle-group, toggle, tooltip

## MCP Available
- shadcn/ui MCP (v4 components)
- React Bits MCP (135+ components)
- Lucide MCP (icons)

## Motion references
- `agent/docs/motion_patterns.md` — motion patterns reference
- `motion-lab/` — HTML prototypes for field, scrub, icon-draw, wake, ridgelines, console
- LAMINAR design spec: L3 (Cinematic) for landing pages
- Motion skill: 4 families (A reactive, B transitional, C ambient, D narrative/scroll)

## Key Design Spec
- `rheo-landing/LANDING_DESIGN_SPEC.md` — "The Loom" creative direction, page flow 9 sections, tokens, L3 liveliness

## Current problems (observed from code)
1. **Contrast issues**: `#63636b` on `#050506` is low contrast (~3.5:1) — body text at `--low` is hard to read. `--mid` `#a1a1aa` is ~4.5:1. Need to bump `--low` to at least `#8a8a94` for AA.
2. **Too dark/lifeless**: All sections use near-black backgrounds with minimal content. No screen recordings/footage embedded. Need motion + content.
3. **Card design**: Current cards are basic surface-panels. Need proper card exploration via shadcn + React Bits.

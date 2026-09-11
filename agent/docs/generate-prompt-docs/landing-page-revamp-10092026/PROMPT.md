# GENERATE PROMPT — Landing Page Revamp (v2)
Date: 2026-09-10
Status: PROMPT READY — awaiting external AI orchestration

## Problem Brief

The RHEO landing page has three known issues:

1. **Contrast**: Critical text is mushy, low-contrast, blends into the dark background.
2. **Dead/stale visual language**: Cards look flat, lifeless. No real screen recordings or feature footage yet.
3. **Card design**: Needs exploration — what elements actually fit for this product's visual identity?

## Context Loaded

- `agent/docs/generate-prompt-docs/landing-page-revamp-10092026/LANDING_CONTEXT.md`
- `agent/docs/generate-prompt-docs/landing-page-revamp-10092026/CARD_EXPLORATION.md`
- `agent/docs/generate-prompt-docs/landing-page-revamp-10092026/MOTION_PLAN.md`
- `motion-lab/` (6 HTML prototypes: field, scrub, icon-draw, wake, ridgelines, console)
- `agent/docs/motion_patterns.md` (Motion API scroll patterns)

## What Changed Since v1

- ✅ Contrast fixed: label → white, description → slate-400, all on `bg-[#06060a]`
- ✅ LAMINAR monochrome applied — no more amber on cards
- ✅ Cards upgraded: glass surface, white hairline border, hover border-white/20
- ✅ MotionChip imported, section wrapper has `layoutId="modules"`
- ✅ Build verified

## What Still Needs Done

- [ ] Screen recordings / feature footage embedded in the page
- [ ] Dynamic animation layer (scroll-driven, hover micro-interactions)
- [ ] Final card design selection from exploration candidates
- [ ] Full prompt to external AI to orchestrate all of the above

## Prompt Request

Write a comprehensive prompt for the external AI that covers:
1. Final card design selection with reasoning
2. Screen recording embedding strategy
3. Motion/animation implementation plan using MotionChip + framer-motion
4. LAMINAR-compliant color tokens
5. Responsive breakpoints
6. Accessibility (focus, keyboard, reduced-motion)

Use the context files above as the knowledge base.
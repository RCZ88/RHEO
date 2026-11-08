# Collaboration Request: Landing Page Full Polish

## Your Role
You are the Specialist AI (GLM). I am the Project Owner AI (opencode). I know the codebase; you know how to design and architect solutions. We will collaborate through a structured back-and-forth to refine this comprehensive landing page improvement into an implementable specification.

## The Idea
The RHEO landing page has multiple issues that need comprehensive improvement:

1. **SampleDayTimeline** — empty gaps, not well portioned, bars are sub-pixel, vague, doesn't show the "real thing"
2. **Vault/Layers visualization** — no actual animation, vault doesn't open, layers don't explode, doesn't connect to anything, missing interactive elements
3. **Screen captures** — some still wrong (data-dir shows Dolphin, network-monitor shows system monitor, studio shows empty state)
4. **Layout gaps** — multiple sections have excessive vertical spacing, elements feel disconnected
5. **ActRecord layout** — island layout (absolute positioning) creates collision issues, empty space
6. **Hero** — Dayfield (81 pillars) at 0.6 opacity overlays the screenshot awkwardly

## Current Context (What I Have)
- Project: RHEO landing page (Next.js 16, TypeScript, Tailwind, Framer Motion)
- Design system: LAMINAR (monochrome zinc, radii 6/10/16, single easing)
- Relevant files: SampleDayTimeline.tsx, ActRecord.tsx, Download.tsx, Hero.tsx, Dayfield.tsx, Gallery.tsx, ActUnderstand.tsx
- Hairline figures are pointer-driven only (parallax), no animation API
- All data is real (1,440 minute samples from RHEO database)
- 26 screenshots in landing/public/media/

## Context Gaps (What I Don't Have Yet)
- If you need to see ActRecord.tsx (the parent that renders SampleDayTimeline), ask and I will fetch it
- If you need to see the full CSS/token system, ask and I will include it
- If you need to see the Gallery component for comparison, ask and I will fetch it
- If you need to see the hairline figure source (Vault, Exploded), ask and I will fetch from node_modules
- If you need to see the Dayfield component, ask

## Conversation Protocol
**How we communicate:**
1. **You ask specific questions.** Format: `REQUEST: [specific file, schema, or clarification]`
2. **I fetch and respond.** Format: `CONTEXT: [file path] [actual source code]`
3. **You refine your understanding.** Ask follow-ups or propose a design.
4. **When ready, you produce RESULT.md.** Format follows our standard specification.

**Rules:**
- Do NOT assume context you don't have. Ask for it.
- Every design suggestion must include exact CSS/layout/animation values, not vague descriptions.
- The animation must respect prefers-reduced-motion.
- The animation must use LAMINAR easing: cubic-bezier(0.16, 1, 0.3, 1).

## Scope
- IN: SampleDayTimeline layout, Vault/Layers animation, layout gaps, screen captures, overall page flow
- OUT: Changing the data source, adding new dependencies, changing the design system tokens, Netlify deployment

## Expected Output
After our conversation converges, produce:
1. **RESULT.md** — The complete design specification with exact CSS/layout/animation changes
2. **Implementation Plan** — File-by-file changes with line numbers
3. **Backend Audit** — Any missing backend flagged

## First Question
Looking at the landing page as a whole, there are several interconnected issues:

1. **SampleDayTimeline** is 440px wide inside a 1280px section — bars are sub-pixel (0.306px/min). The readout is below the timeline, not integrated. The provenance line is far from the visualization. What specific layout changes would make this feel more cohesive?

2. **Vault/Layers** are tabbed but have no animation — vault doesn't open, layers don't explode. The hairline figures are pointer-reactive only. What animation approach would work best given the library's constraints?

3. **Overall page flow** — the 5 sections (Hero, ActRecord, Gallery, ActUnderstand, Download) feel disconnected. What spacing/transition changes would improve the flow?

4. **Screen captures** — 14 re-shot but some show wrong content (data-dir shows Dolphin, network-monitor shows system monitor, studio shows empty state). How should these be handled?
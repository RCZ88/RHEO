# Collaboration Request: Landing Page Complete Revamp

## Your Role

You are the Specialist AI. I am the Project Owner AI. I know the codebase; you know how to design and architect solutions. We will collaborate through a structured back-and-forth to refine this idea into an implementable specification.

## The Idea

The RHEO landing page has multiple issues that need comprehensive design across 5 areas:

### 1. Vault/Layers Figure — NOT INTERACTIVE DISCOVERABLE
- `@lucasmarkes/hairline` Vault and Exploded figures are pointer-driven only
- No programmatic "open" or "explode" API
- Tab transition is just a simple fade
- Users don't know they can interact
- Ghost tour runs 4s but doesn't clearly show interaction

### 2. SampleDayTimeline — VISUALIZATION NEEDS REVAMP
- 1,440 minute bars in 120px SVG — extremely dense, 1px wide bars
- Fill layer scales by progress but individual bars invisible
- HUD cramped: time + category + intensity in 12px
- Facts line uses "Uncategorized" (3987 min) — not meaningful
- No visual distinction between categories (all white with brightness)
- Playhead is 1px white line — hard to see
- No load animation — bars appear instantly
- No focus indicator for keyboard navigation
- 32px ruler below canvas is wasted space

### 3. ActRecord Section — TOO ABSTRACT
- Uses fabricated BLOCKS array (4 phases with hand-typed blurbs)
- Dashboard card has hardcoded LINE_PATH (not real data)
- Vertical 24h timeline rail is decorative
- Only 1 real app screenshot
- Too much empty space

### 4. Feedback Section — MISSING ENTIRELY
- No feedback/bug report page exists
- No categorization (feedback vs bug vs feature request)
- No way for AI agents to access feedback
- App has "Report" skill but no landing page feedback mechanism

### 5. Page Flow Rhythm — UNMEASURED
- 5 sections with wildly varying heights
- No spacing audit
- No consistent vertical rhythm

## Current Context (What I Have)

- Project: RHEO landing page (Next.js 16, static export, Tailwind CSS)
- Design system: LAMINAR (monochrome, radii 8/12/16, single easing cubic-bezier(0.16,1,0.3,1))
- Animation: Framer Motion v12, hairline library (@lucasmarkes/hairline)
- Deployed: https://rheooo.netlify.app
- Real data: landing/public/data/sample-day.json (1,440 minute samples from RHEO SQLite)

Relevant files:
- `landing/src/components/rheo/Download.tsx` (488 lines) — Vault/Layers
- `landing/src/components/rheo/SampleDayTimeline.tsx` (303 lines) — timeline
- `landing/src/components/rheo/ActRecord.tsx` (941 lines) — tracking section
- `landing/src/components/rheo/Hero.tsx` (207 lines) — hero
- `landing/src/app/page.tsx` — section mount chain

## Context Gaps (What I Don't Have Yet)

- Whether synthetic pointer events would work to trigger hairline figures
- The exact coordinates for vault opening (dial at 40°)
- Whether a custom SVG implementation would be better than fighting the library
- How feedback data should be stored (localStorage? API? GitHub Issues?)
- What the page rhythm should be (section heights, spacing)

## Conversation Protocol

1. **You ask specific questions.** Format: `REQUEST: [specific file, schema, or clarification]`
2. **I fetch and respond.** Format: `CONTEXT: [file path] [actual source code]`
3. **You refine your understanding.** Ask follow-ups or propose a design.
4. **When ready, you produce RESULT.md.**

**Rules:**
- Do NOT assume context you don't have. Ask for it.
- Do NOT design for features whose backend doesn't exist. Flag them.
- Do NOT produce a monolithic answer. Iterate with me.

## Scope
- IN: All 5 areas above
- OUT: Database changes, IPC changes, Netlify config, RHEO app changes (landing page only)

## Expected Output
1. **RESULT.md** — Complete design specification
2. **Implementation Plan** — File-by-file changes
3. **Backend Audit** — Any missing backend (feedback storage, etc.)

## First Question

For the SampleDayTimeline visualization, the current approach uses 1,440 individual 1px SVG bars in a 120px canvas. This is extremely dense. What would be a better visualization approach?

Options:
(a) **Aggregate to hourly buckets** — 24 bars, each showing the dominant category for that hour. Much more readable.
(b) **Category-colored segments** — Group consecutive same-category minutes into segments. Shows activity blocks, not individual minutes.
(c) **Heatmap grid** — 24 columns × 60 rows (one per minute), colored by category. Like a GitHub contribution graph.
(d) **Keep 1,440 bars but make them visible** — increase canvas height to 240px, use 2px bars with gaps.

Which approach would you recommend for a landing page that needs to be "legible" and "real"?

Also: for the Vault/Explode interaction, should I use synthetic pointer events to trigger the real figure animation, or build a custom framer-motion container animation? And for the feedback page, should it be a static form that submits to GitHub Issues, or a localStorage-based system that AI agents can read?

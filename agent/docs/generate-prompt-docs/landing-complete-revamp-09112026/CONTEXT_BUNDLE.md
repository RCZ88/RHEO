# Context Bundle: Landing Page Complete Revamp

## Problem Statement

The RHEO landing page (Next.js, static export, deployed to https://rheooo.netlify.app) has multiple issues that need comprehensive design:

### 1. Vault/Layers Figure — NOT INTERACTIVE DISCOVERABLE
- `@lucasmarkes/hairline` Vault and Exploded figures are pointer-driven only
- No programmatic "open" or "explode" API
- Tab transition is just a simple fade
- Users don't know they can interact
- Ghost tour runs 4s but doesn't clearly show interaction

### 2. SampleDayTimeline — VISUALIZATION NEEDS REVAMP
- 1,440 minute bars in a 120px SVG canvas — extremely dense, individual bars are 1px wide
- The "fill layer" scales by progress but individual bars are invisible at this resolution
- HUD shows time + category + intensity but layout is cramped
- The facts line uses `summary.top_category` which is "Uncategorized" (3987 min) — not meaningful
- No visual distinction between activity categories (all bars use same white with brightness variation)
- The playhead is a 1px white line — hard to see
- No animation on load — bars appear instantly
- No empty/loading state animation
- The panel is 153px tall but the canvas is 120px — the 32px ruler below is wasted space
- Keyboard navigation works but has no visual focus indicator

### 3. ActRecord Section — TOO ABSTRACT
- Uses fabricated BLOCKS array (4 phases with hand-typed blurbs)
- Dashboard card has hardcoded LINE_PATH (not real data)
- Vertical 24h timeline rail is decorative, not data-driven
- Only 1 real app screenshot added
- Too much empty space despite recent spacing reduction

### 4. Feedback Section — MISSING ENTIRELY
- No feedback/bug report page exists
- No categorization (feedback vs bug vs feature request)
- No way for AI agents to access feedback
- The app has a "Report" skill but no landing page feedback mechanism

### 5. Page Flow Rhythm — UNMEASURED
- 5 sections: Hero, ActRecord, Gallery, ActUnderstand, Download
- No spacing audit done
- Section heights vary wildly (Hero ~100vh, ActRecord ~300vh, Gallery ~100vh, etc.)
- No consistent vertical rhythm

## Design Constraints (LAMINAR)

- Monochrome: zinc surfaces, ONE signal hue per surface
- Radii: 8/12/16 only
- Single easing: cubic-bezier(0.16, 1, 0.3, 1)
- No layout-property animation (transform/opacity only)
- No fabrications — every number must be sourced from real data
- Fonts: Inter + JetBrains Mono + Space Grotesk (max 2 per view)
- No glassmorphism on chrome, no decorative glow/gradients, no spring/bounce
- prefers-reduced-motion honored

## Hairline Library API

Components from `@lucasmarkes/hairline/react`: `Vault`, `Exploded`, `Terrain`, etc.

Props: `intensity`, `theme`, `label`, `onRead`, `play`, `style`
- `onRead`: callback receiving text when pointer is over a part
- `play`: boolean — triggers ghost-pointer tour
- `style`: CSS (default aspectRatio: 5/4)

### Vault Figure (mount33) — Pointer-Driven Only
- Dial spins when pointer moves over it
- On 40° (COMBO), bolts draw back (vault "opens")
- `opened` boolean controls bolt position
- `setOpen(on, now)` sets opened state
- `set(value)` only accepts coast/friction
- NO programmatic open API

### Exploded Figure (mount7) — Pointer-Driven Only
- Pointer x: layers separate (GAP4 from 0.18 to 1.0)
- Pointer y: picks active layer
- `set(value)` only accepts GAP4
- NO programmatic explode API

## SampleDayTimeline Current Implementation

```typescript
// 1,440 samples, 1px wide bars in 120px SVG
// Categories: IDE, AI Tools, Development, Education, Productivity, Communication, Browser, Uncategorized, Media, Entertainment, Gaming, Social Media, Web
// CAT_BRIGHTNESS: IDE=1.0, AI Tools=0.9, ..., Social Media=0.12
// Summary: top_category, top_category_minutes, deep_work_window, minutes_with_activity
// Data source: landing/public/data/sample-day.json (real RHEO export, 2026-10-13)
```

## ActRecord Current Implementation

- `BLOCKS` array: 4 phases (Deep Work, Rest, Meetings, Learning)
- Each block: key, range, blurb, counter, dashboard card
- Dashboard card: hardcoded LINE_PATH, stat chips, mini timeline
- Vertical 24h timeline rail (absolute right)
- Real app screenshot added (app-dashboard.png)
- Layout: flow column, 1000px instrument width

## Page Structure

```typescript
// page.tsx mounts 5 sections:
<Hero />           // Dayfield bottom band, screenshot, plain sentence
<ActRecord />      // 4 phases, SampleDayTimeline, 24h rail
<Gallery />        // 17 screenshots, horizontal rail
<ActUnderstand />  // AI console, traces
<Download />       // Ledger, Vault/Layers, OS cards
```

## Feedback Requirements

The user wants:
- A separate feedback page (not just a section)
- Proper categorization: Feedback, Bug, Feature Request, Other
- AI agents should be able to access feedback data
- Integration with the existing "Report" skill

## Files to Modify

- `landing/src/components/rheo/Download.tsx` — Vault/Layers figure
- `landing/src/components/rheo/SampleDayTimeline.tsx` — visualization revamp
- `landing/src/components/rheo/ActRecord.tsx` — real app content
- `landing/src/app/page.tsx` — section rhythm
- NEW: `landing/src/app/feedback/page.tsx` — feedback page
- NEW: `landing/src/components/FeedbackForm.tsx` — feedback form component

## Constraints

- No AI agent builds (only CZ builds)
- All changes must pass `npx tsc --noEmit` scoped to changed files
- All changes must pass `npx esbuild` scoped to changed files
- No fabrications — every number must be sourced from real data
- LAMINAR design system compliance
- Reduced-motion support mandatory

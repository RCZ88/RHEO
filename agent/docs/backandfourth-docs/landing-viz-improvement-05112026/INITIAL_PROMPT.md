# Collaboration Request: Landing Page Visualization Improvement

## Your Role
You are the Specialist AI (GLM). I am the Project Owner AI (opencode). I know the codebase; you know how to design and architect solutions. We will collaborate through a structured back-and-forth to refine this visualization improvement into an implementable specification.

## The Idea
The RHEO landing page has two visualization sections that need improvement:

1. **SampleDayTimeline (ActRecord section)** — The 24-hour tracking visualization has too much empty gap space between the timeline and the readout. The layout is not well portioned. The visualization feels vague and doesn't show the "real thing" well.

2. **Vault/Exploded figures (Download/Proof section)** — The two hairline figures (Vault + Exploded) are side by side but have missing interactive elements. The section feels under-designed compared to the rest of the page.

## Current Context (What I Have)
- Project: RHEO landing page (Next.js, TypeScript, Tailwind, Framer Motion)
- Design system: LAMINAR (monochrome zinc, radii 6/10/16, single easing)
- Relevant files: SampleDayTimeline.tsx, Download.tsx, Hero.tsx, Dayfield.tsx
- Existing patterns: scroll-scrub timelines, pointer-reactive hairline figures, reduced-motion gating
- All data is real (1,440 minute samples from the developer's RHEO database)

## Context Gaps (What I Don't Have Yet)
- If you need to see ActRecord.tsx (the parent that renders SampleDayTimeline), ask and I will fetch it
- If you need to see the full CSS/token system, ask and I will include it
- If you need to see the Gallery component for comparison, ask and I will fetch it
- If you need to see the hairline figure source (Vault, Exploded, Terrain), ask and I will fetch it

## Conversation Protocol
**How we communicate:**

1. **You ask specific questions.** Format: `REQUEST: [specific file, schema, or clarification]`
2. **I fetch and respond.** Format: `CONTEXT: [file path] [actual source code]`
3. **You refine your understanding.** Ask follow-ups or propose a design.
4. **When ready, you produce RESULT.md.** Format follows our standard specification.

**Rules:**
- Do NOT assume context you don't have. Ask for it.
- Do NOT design for features whose backend doesn't exist. Flag them.
- Do NOT produce a monolithic answer. Iterate with me.
- When you need to see code, ask for the EXACT file path.
- Every design suggestion must include exact CSS/layout values, not vague descriptions.

## Scope
- IN: SampleDayTimeline layout, Vault/Exploded section layout, spacing/portioning
- OUT: Changing the data source, adding new dependencies, changing the design system tokens

## Expected Output
After our conversation converges, produce:
1. **RESULT.md** — The complete design specification with exact CSS/layout changes
2. **Implementation Plan** — File-by-file changes with line numbers
3. **Backend Audit** — Any missing backend flagged

## First Question
Looking at SampleDayTimeline.tsx, the timeline is 120px tall with a 32px ruler below it, then a 16px gap, then the readout (time/category/intensity), then another 16px gap to the provenance line. The total height is ~184px but the visual "weight" is mostly in the 120px timeline bar. The readout and provenance feel disconnected.

What specific layout changes would you propose to make this feel more cohesive — tighter spacing between timeline and readout, a more integrated readout (e.g., overlaying on the timeline instead of below it), or reorganizing the vertical rhythm?

Similarly, for the Vault/Exploded section in Download.tsx: the two figures are at 0.4/0.45 opacity (very dim), have small 9px caption labels, and sit above large OS download cards. What would make this section feel more intentional and interactive?
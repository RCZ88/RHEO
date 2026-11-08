# Collaboration Request: Vault/Layers Animation Improvement

## Your Role
You are the Specialist AI (GLM). I am the Project Owner AI (opencode). I know the codebase; you know how to design and architect solutions. We will collaborate through a structured back-and-forth to refine this visualization improvement into an implementable specification.

## The Idea
The RHEO landing page's Download/Proof section has two hairline figures (Vault + Exploded) that are currently tabbed (VAULT | LAYERS) but:
1. There's no actual animation — just parallax on hover
2. The vault doesn't "open" — it's a static dial
3. The exploded view doesn't "explode" — it's a static 4-layer diagram
4. They don't connect — switching tabs just swaps one figure for another
5. "Currently its only the vault and the one weird visualization that doesnt tell shit and doesnt connect to anything"

The user wants:
- Vault opening animation (vault cracks open)
- Exploding animation that transitions into the 4 layers
- The vault and layers should CONNECT — vault opens → explodes → reveals the 4 layers
- Interactive elements that are currently missing
- "It should also be interactively good"

## Current Context (What I Have)
- Project: RHEO landing page (Next.js, TypeScript, Tailwind, Framer Motion)
- Design system: LAMINAR (monochrome zinc, radii 6/10/16, single easing)
- Relevant files: Download.tsx (FigureInstrument component), Hero.tsx (Dayfield), hairline library
- Hairline figures are pointer-reactive only (parallax), no animation API
- onRead callback fires text descriptions of pointer position
- Tablist pattern from ActUnderstand (roving tabindex, arrow keys)

## Context Gaps (What I Don't Have Yet)
- If you need to see the hairline library source (Vault/Exploded mount functions), ask and I will fetch from node_modules
- If you need to see ActRecord.tsx for the 300vh scroll-scrub pattern, ask
- If you need to see the full CSS token system, ask
- If you need to see the Gallery component for comparison, ask

## Conversation Protocol
**How we communicate:**
1. **You ask specific questions.** Format: `REQUEST: [specific file, schema, or clarification]`
2. **I fetch and respond.** Format: `CONTEXT: [file path] [actual source code]`
3. **You refine your understanding.** Ask follow-ups or propose a design.
4. **When ready, you produce RESULT.md.** Format follows our standard specification.

**Rules:**
- Do NOT assume context you don't have. Ask for it.
- Every design suggestion must include exact CSS/layout values, not vague descriptions.
- The animation must respect prefers-reduced-motion.
- The animation must use LAMINAR easing: cubic-bezier(0.16, 1, 0.3, 1).

## Scope
- IN: Vault opening animation, layer explosion, vault→layers transition, interactive elements
- OUT: Changing the data source, adding new dependencies, changing the design system tokens

## Expected Output
After our conversation converges, produce:
1. **RESULT.md** — The complete animation specification with exact values
2. **Implementation Plan** — File-by-file changes with line numbers
3. **Backend Audit** — Any missing backend flagged

## First Question
The hairline library's figures are purely pointer-driven (parallax). There's no animation API. To create a vault-opening animation, we have three options:

A) **Framer Motion wrapper** — Animate the hairline figure container (scale, rotate, opacity) using framer-motion's animate/variants. The figure itself stays static, but the container animates.

B) **Custom SVG** — Build a custom animated vault SVG that replaces the hairline figure. This gives full control but requires replicating the hairline visual style.

C) **Hybrid** — Use the hairline figure for the static state, and overlay a framer-motion animation on top (vault cracks open, layers separate, then the hairline figure fades in).

Which approach would you recommend? And what specific animation sequence would you propose for "vault opens → explodes → reveals 4 layers"?
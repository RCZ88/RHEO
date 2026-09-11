# DESIGN.md — UI build rules for this project

## Prime directive
Never design from zero. Pull from connected sources, then adapt to our tokens.
If a source isn't available, say so — do not invent a substitute that looks generic.

## Source routing (what to use, when)
- Whole sections/blocks (hero, pricing, bento, features) → shadcn MCP via @aceternity / registries.
- A specific component variation from a description → 21st.dev Magic (/ui ...).
- Any animation / transition / scroll effect → Motion.dev AI Kit examples. Run the /motion audit after.
- Icons → Lucide first; Iconify only if Lucide lacks it. Never use emoji as UI icons.
- Photography → Unsplash MCP. Include attribution. No random AI-generated hero images.
- Color + type system → use the tweakcn-generated tokens in globals.css. Do NOT introduce ad-hoc colors.

## Anti-slop checklist (block the PR if any fail)
- [ ] Type: NOT default Inter/Geist-only. Use the project's paired display + body fonts.
- [ ] Color: NOT purple/indigo gradient-on-everything. Use defined tokens; gradients are intentional, rare.
- [ ] Geometry: radius + padding come from the scale, not the same value on every element.
- [ ] Hero: no tiny uppercase eyebrow pill + oversized headline + lone CTA cliché.
- [ ] Sections: no repeated tracked-uppercase kicker label above every heading.
- [ ] Motion: real micro-interactions on key actions; respects prefers-reduced-motion.
- [ ] Imagery: matches the actual product; no filler glow/blobs.
- [ ] Empty/loading/error states exist and are styled.

## Placement rules
- One focal element per viewport; establish hierarchy with scale + weight, not borders.
- Motion supports meaning (entrance, state change, feedback) — never decoration-only.
- Reuse installed components; do not re-implement an existing primitive.
- Keep all design decisions traceable to a token or a sourced component.

## Workflow
1. Restate the screen's job + the one action that matters.
2. Pull candidate blocks/components from the routed source.
3. Re-skin to our tokens (color, type, radius, spacing).
4. Add motion from Motion.dev; run the performance audit.
5. Run the anti-slop checklist before finishing.
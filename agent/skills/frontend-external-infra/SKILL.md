---
id: frontend-external-infra
name: frontend-external-infra
description: "Connected external libraries (shadcn MCP, Magic UI, Lucide, 21st.dev) that give the agent real component inventory instead of inventing UI from zero. Source routing table, anti-slop checklist, and DeskFlow re-skin rules."
version: 1.0.0
category: design
tags: [mcp, registry, shadcn, magicui, lucide, motion-dev, components, design-system, anti-slop]
---

# Frontend External Infrastructure Skill

## What This Is

This skill bridges the gap between **instructions-only design skills** (frontend-design,
impeccable, humancentred-UIUX) and **real component libraries** the agent can pull from.
Instead of inventing UI patterns from the model's training data average ("AI slop"),
the agent connects to live MCP servers that serve real, curated, production-grade
components, blocks, icons, and animations.

> **Rule:** Never design from zero. Pull from a connected source first, then adapt
> to DeskFlow's design tokens. If a source isn't available, say so — do not invent
> a substitute that looks generic.

## Connected MCP Servers & Registries

**Registries (via the single shadcn MCP server — configured in opencode.json `mcp.shadcn`):**
`components.json` now exposes three registries the shadcn MCP browses:

| Registry | URL | Scope |
|----------|-----|-------|
| `@react-bits` | `https://reactbits.dev/r/{name}.json` | animated React components |
| `@kokonutui` | `https://kokonutui.com/r/{name}.json` | general app UI (cards, buttons, inputs, AI-style interfaces) |
| `@bklit` | `https://ui.bklit.com/r/{name}.json` | charts & data-viz ONLY |

**Install via CLI:** `npx shadcn@latest add @kokonutui/<name>` · `npx shadcn@latest add @bklit/<chart-name>`
**Browse via MCP:** ask the shadcn MCP to list/search `@kokonutui` or `@bklit` components.

| Server | What it gives you | When to use |
|--------|------------------|-------------|
| **shadcn** (`npx shadcn@latest mcp`) | Browse/search/read source of thousands of Tailwind v4+React components from the shadcn/ui registry + any configured third-party registries (Aceternity, etc.) | Any standard UI block: forms, dialogs, tables, sidebars, navs, cards, pricing, landing sections. Search first, read source, adapt to DeskFlow tokens. |
| **magicui** (`@magicuidesign/mcp`) | 150+ animated Tailwind components: beams, particles, bento grids, text animations, backgrounds, buttons, device mocks, effects | Animated elements, special effects (animated beam, border beam, particles, meteors, confetti), text animations (blur fade, number ticker, word rotate), backgrounds (grid patterns, ripples), bento grids. |
| **lucide** (`lucide-icons-mcp`) | 1500+ clean SVG icons with search and usage code | Any icon need. Never use emoji as UI icons. Prefer lucide over Iconify unless lucide genuinely lacks the icon. |
| **@21st-dev/magic** | Prompt-to-component: generate a polished React component from a `/ui` description | When you need a specific component variation that doesn't exist in shadcn/Magic UI — describe what you need and let 21st.dev generate it. API key from `.env`. |
| **motion-dev** (community MCP) | Offline Motion.dev docs + animation codegen for React/JS/Vue — free alternative to paid Motion+ AI Kit | When a component needs high-quality motion beyond simple fade/slide. Clone from github.com/Abhishekrajpurohit/motion-dev-mcp, run `npm install && npm run build && npm run rebuild`, then configure as a local MCP. |
| **unsplash** (`unsplash-smart-mcp-server`) | Search/download stock photography with auto-attribution | When real imagery is needed (hero backgrounds, section illustrations). Requires Unsplash API key in `.env`. |
| **reactbits** (`reactbits-dev-mcp-server`) | 135+ animated React components (CSS + Tailwind variants) | Text animations, particle effects, background effects, hover interactions. No API key needed. |
| **iconify** (`better-icons-mcp`) | 200,000+ icons across 200+ sets (Lucide, Material, Heroicons, Tabler, etc.) | When lucide lacks the icon you need. Check lucide first; fall back to iconify. No API key needed. |
| **fragments-ui** (`@usefragments/mcp`) | 66 accessible React components + 80 design tokens + 11 MCP tools for token audit, a11y checks, component discovery, browser rendering | AI-native design system. .fragment.tsx metadata files guide the agent on implementation. Free. |
| **shadcn-ui-mcp** (`@jpisnice/shadcn-ui-mcp-server`) | Multi-framework shadcn component docs with smart caching. Supports React, Svelte, Vue, React Native. | When you need shadcn component docs with usage examples across frameworks. Faster than the generic shadcn MCP. |
| **refero-mcp** (`@refero/mcp`) | 135,000+ screens and 10,000+ real product flows (onboarding, checkout, tables, paywalls) | Research phase: find real-world UI references before writing layout code. Requires Pro subscription. |
| **aidesigner** (URL MCP) | MCP tools to generate_design, refine_design, clone_design from any live URL | When you want to generate, clone, or refine production-ready web designs in a live editor session. |

## Source Routing (what to reach for, in order)

| You need… | Use… |
|-----------|------|
| General app UI (card, button, input, nav, panel, AI-chat surface) | `@kokonutui` registry first (via shadcn MCP), then `shadcn` MCP core — search, read source, re-skin to DeskFlow tokens |
| Charts / data-viz (area, bar, candlestick, heatmap, funnel, sankey) | `@bklit` registry ONLY — never hand-roll Recharts; KokonutUI has no charts |
| Standard UI block (form, table, dialog, sidebar, card, nav, etc.) | `shadcn` MCP — search registries, read component source |
| Landing section (hero, features, pricing, bento, testimonials) | `shadcn` MCP → `@aceternity` registry, or `magicui` MCP for animated variants |
| Animated effect (beam, particles, grid, confetti, text animation) | `magicui` MCP — they specialize in this |
| An icon | `lucide` MCP — search by keyword, get the import code |
| A specific component from a text description | `@21st-dev/magic` — `/ui [description]` |
| Animated component variant (text, particles, hover effects) | `reactbits` MCP — 135+ typed components, no key needed |
| Animation codegen, offline docs, examples | `motion-dev` community MCP — clone from GitHub, build, configure locally (free) |
| Real photography | `unsplash` MCP — search stock photos with attribution (needs Unsplash API key in `.env`) |
| An icon lucide doesn't have | `iconify` MCP — 200k+ icons across 200+ sets |
| Theme/palette generation | Use tweakcn.com (web tool). Paste generated CSS vars over DeskFlow's `:root` in index.css. |
| AI-native components with metadata | `fragments-ui` MCP — 66 accessible components, 80 design tokens, .fragment.tsx metadata. Free. |
| Multi-framework shadcn docs | `shadcn-ui-mcp` — component docs with usage for React, Svelte, Vue, React Native |
| Real-world UI research / inspiration | `refero-mcp` — search 135k+ screens and 10k+ flows. Pro key required. |
| Generate a design from scratch or refine existing | `aidesigner` MCP — call generate_design or refine_design from a live URL |
| Motion / kinetic typography | Swishy.ai (web tool) — text-to-motion with CSS + Framer Motion output. Search for kinetic typography patterns. |
| Visual theme exploration / layout ideas | Variant.com (web canvas) — generate infinite layout ideas by visual theme. Feed screenshots into agent vision. |
| Premium shadcn motion components | Cult UI — `npx shadcn@latest add https://www.cult-ui.com/r/<component>.json`. Dynamic Islands, Family Buttons, rich animations. |

## DeskFlow Re-Skin Rules

When you pull a component from any MCP source, you MUST re-skin it:

1. **Colors**: Replace the source's colors with DeskFlow CSS vars (`--bg-primary`, `--accent-primary`, `--text-primary`, etc.). See `src/index.css` for the full token set.
2. **Border radius**: Max `rounded-xl` (12px). Never `rounded-2xl` or `rounded-3xl`.
3. **Card padding**: Use `p-5` (20px). Never `p-6` or `p-8`.
4. **Fonts**: Body = Geist/Inter (13px). Mono = JetBrains Mono. Headings use weight (600), not a different font.
5. **Dark mode only**: DeskFlow is always dark. Strip any light-mode variants.
6. **Glass layer**: Use `glass` or `glass-heavy` classes from `index.css` instead of opaque backgrounds where depth is needed.
7. **Animation respects reduced motion**: Wrap any animation in `@media (prefers-reduced-motion: reduce)` suppression.

## Anti-Slop Checklist (block the PR if any fail)

- [ ] **Type**: NOT default Inter/Geist-only — that IS the DeskFlow default, so check that the pairing is correct (Geist body, JetBrains Mono code). No third font introduced.
- [ ] **Color**: NOT purple/indigo gradient-on-everything. Use DeskFlow's defined tokens (`--accent-primary`, `--page-accent`, etc.). Gradients are intentional and rare.
- [ ] **Geometry**: radius + padding come from DeskFlow's scale (`rounded-xl`, `p-5`), not the source's original values.
- [ ] **Hero**: no tiny uppercase eyebrow pill + oversized headline + lone CTA cliché.
- [ ] **Sections**: no repeated tracked-uppercase kicker label above every heading.
- [ ] **Motion**: real micro-interactions on key actions; respects `prefers-reduced-motion`.
- [ ] **Imagery**: matches the actual product; no filler glow/blobs.
- [ ] **Empty/loading/error states**: exist and are styled using DeskFlow patterns (Skeleton, EmptyState from frontend-design skill).
- [ ] **Icons**: all from lucide-react. No emoji as UI icons. No inline SVG that duplicates an existing lucide icon.
- [ ] **Accessibility**: focus-visible rings use DeskFlow's `--page-accent` pattern from `index.css`.

## UI Generation Workflow

1. **Scope**: State what screen/component you're building and the one action that matters.
2. **Source**: Pull candidate block/component from the routed MCP server (see Source Routing above).
3. **Read**: Use the MCP to read the full source code of the component(s).
4. **Adapt**: Re-skin to DeskFlow tokens using the rules above.
5. **Animate**: Check if Magic UI has a better animated variant. If using framer-motion directly, use DeskFlow's duration tokens (`--fast: 150ms`, `--normal: 250ms`, `--slow: 400ms`) and easing (`--ease-out`).
6. **States**: Add empty, loading, and error states for every data-driven component (see humancentred-UIUX skill).
7. **Checklist**: Run the anti-slop checklist before finishing.

## Multi-Project Reuse

This skill and its MCP server config (`opencode.json`) are portable:

```
To reuse in another project:
1. Copy the MCP server entries from opencode.json
2. Copy scripts/mcp-launcher.mjs (for keyed MCPs that read .env)
3. Copy this SKILL.md to agent/skills/frontend-external-infra/
4. Copy the design-taste skill reference pattern
5. Update the re-skin rules to match the target project's design tokens
6. Add the skill path to opencode.json instructions
7. Create a .env file with the required API key entries
```

See `agent/docs/frontend-external-infra.md` for the full reference document and
connection patterns for additional sources (Figma, custom MCP).

## Related Skills

- **frontend-design**: DeskFlow-specific UI patterns, component specs, and page layouts
- **humancentred-UIUX**: State coverage, clarity, progressive disclosure
- **impeccable**: Typography, color, motion, spatial, interaction design
- **design-taste**: Master aggregator — references all design sub-skills

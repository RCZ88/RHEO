# MCP Routing — which server, which tool, what to do with the answer

> Loaded from `PAINT/SKILL.md`, phase P3. **You must call an MCP before writing custom
> markup.** A P3 with zero MCP calls is a failed phase — and if you genuinely had nothing to
> pull, say so explicitly in the reply.

---

## 1. THE ROUTING TABLE (need → server)

| You need… | Server | Real tool names | Then… |
|-----------|--------|----------------|-------|
| **Which registries exist** | `shadcn` | `get_project_registries` | call this first if unsure |
| **General app UI** — card, button, input, nav, panel, AI-chat surface, AI-chat interface | `shadcn` → `@kokonutui`, then `@shadcn` core | `search_items_in_registries({registries:['@kokonutui'], query})` → `view_items_in_registries({items:['@kokonutui/<name>']})` → `get_add_command_for_items` | re-skin per `frontend-external-infra` |
| **Charts / data-viz** — area, bar, candlestick, heatmap, funnel, sankey, choropleth | `@bklit` **ONLY** | `search_items_in_registries({registries:['@bklit'], query:'area chart'})` then view + add | palette from `src/lib/CategoryColors.ts` |
| **Landing sections** — hero, features, pricing, bento, testimonials | `shadcn` → `@react-bits` / `@shadcn` | `search_items_in_registries` | landing tokens (`src/tokens.css`), not app tokens |
| **Animated effects** — beam, particles, grid, confetti, border-beam, text animation | `magicui` | `search_RegistryItems({query})` → `get_RegistryItem({name, includeSource:true})` | re-skin, then **demote to the chosen Liveliness Level** |
| **Animated React component variants** — text, particles, hover | `reactbits` | `search_components({query})` → `get_component({name, style:'tailwind'})` → `get_component_demo` | re-skin to tokens |
| **shadcn component docs + demos** (faster, multi-framework) | `shadcn-ui-mcp` | `get_component({componentName})` · `get_component_demo` · `get_block({blockName})` · `list_blocks` | — |
| **A whole page/block reference** (dashboard, calendar, login) | `shadcn-ui-mcp` | `get_block({blockName:'dashboard-01'})` | strip to the parts you need; never adopt a whole page wholesale |
| **Icons** | `lucide` (→ `iconify` fallback) | lucide: `search_icons` + usage code · iconify: `better-icons-mcp` | **lucide-react only. Never emoji as a UI icon.** |
| **Google Material icons** (if a product spec demands Material) | `google-design-mcp` | `icons_instructions()` (call once) → `search_icons({tags:[...]})` | still one icon set per surface — do not mix with lucide in the same view |
| **Fonts** — find / compare / pair | `google-design-mcp` | `search_fonts({platform:'web', categories:[...]})` → `describe_font({fontFamily, platform})` | then `font-selection` decides; max 2 families per view |
| **Color scheme generation** (landing/palette exploration only) | `google-design-mcp` | `generate_color_scheme({primaryKey, optionalTheme, contrastLevel, variant})` | **App UI: reject the output and use tokens.** This is for the landing surface. |
| **A specific component from a text description** | `@21st-dev/magic` | `/ui [description]` | still re-skin |
| **Real photography** | `unsplash` | search + attribution | never filler imagery; must match the product |
| **Theme/palette preset** | `shadcn-ui-mcp` | `list_themes` → `get_theme` → `apply_theme({presetId, dryRun})` | **`dryRun: true` first.** Applying a preset rewrites `src/index.css` — that is a constitution-level change, not a design tweak. Ask before writing. |
| **AI-native accessible components + token audit** | `fragments-ui` | token audit / a11y checks / component discovery | free; good for the P7 audit |
| **Real-world UI research before designing layout** | `refero-mcp` | 135k+ screens, 10k+ flows | research phase — use *before* P3, not during coding |
| **Generate / clone / refine a design from a live URL** | `aidesigner` | `generate_design` · `refine_design` · `clone_design` | output still goes through P4-P7 |
| **Verify the result renders** | `probe` | `open` → `snapshot` → `assert_visible` / `assert_contrast` / `assert_style` → `read_console` | **P7 gate.** Never launch Electron manually; attach or use Probe. |
| **Browser-level test loop** | `playwright` | `navigate` → `snapshot` → `click` → `screenshot` | renderer/web surfaces |

---

## 2. THE CALL SEQUENCE THAT ACTUALLY WORKS

Do not skip to step 4. Each step exists because agents skip it and then guess.

```
1. search   → does a component already exist for this need?
2. view     → read the REAL source (not a name, not a memory)
3. demo     → read the usage example so you get the required props/wrapper right
4. add      → get/install the component  (npx shadcn@latest add @kokonutui/<name>)
5. re-skin  → LAMINAR tokens, radius, padding, fonts, dark-only, no glass chrome
6. states   → empty / loading / error / populated / partial
7. motion   → only if the level's budget allows; CSS or motion/react, never both engines
8. audit    → probe: visible? contrast? console clean? geometry non-zero?
```

**Step 2 is the one that matters.** Reading the source is what separates a real component
from a plausible hallucination of one. Registry components are copy-into-your-project code —
read it, then adapt.

**Step 4 has a CLI form** (faster than MCP when you already know the name):
```bash
npx shadcn@latest add @kokonutui/particle-button
npx shadcn@latest add @bklit/area-chart
```

---

## 3. RE-SKIN CHECKLIST (every pulled component, no exceptions)

Run `frontend-external-infra`'s 7 re-skin rules plus the LAMINAR gate on **every** component
that came from a registry:

- [ ] Colors → RHEO tokens / `var(--page-accent)`. Zero source hexes survive.
- [ ] Radius → `rounded-lg` (8px, data/code) or `rounded-xl` (12px, card) or `rounded-full`.
      `rounded-2xl` / `rounded-3xl` are hard-gate failures.
- [ ] Padding → `p-5` for cards.
- [ ] `backdrop-blur` removed from chrome (modals, headers, dropdowns, toasts).
- [ ] `shadow-sm` / default white border replaced with the hairline + flat dark surface.
- [ ] `transition-all` → named properties.
- [ ] Animating `width/height/top/left` → `transform`/`opacity` only.
- [ ] Any `repeat: Infinity` decorative loop → deleted (App UI) or justified as functional.
- [ ] Emoji / mixed icon sets → lucide only.
- [ ] Light-mode variants stripped (RHEO is dark-only).
- [ ] `prefers-reduced-motion` fallback added.
- [ ] Empty / loading / error / populated / partial states present.
- [ ] One signal hue per surface; emerald is success-only, rose destructive-only.
- [ ] Hero check: no "tiny uppercase eyebrow pill + oversized headline + lone CTA" cliché.

---

## 4. WHEN A SERVER IS UNAVAILABLE

Some servers in `opencode.json` may fail to connect and surface **no tools** in your session
(keyed servers need `.env` entries: `unsplash`, `@21st-dev/magic`, `refero-mcp`).

**Correct behavior:** name the missing server, say what you could not pull, and fall back in
this order:
1. A different *unkeyed* server that covers the same need (`shadcn` core, `reactbits`,
   `magicui` all work without keys).
2. An existing local component in the repo that already solves it.
3. Hand-build **only** if nothing exists — and say plainly that you hand-built it and why.

**Never:** silently substitute emoji, a hand-drawn inline SVG, or a from-memory component
while implying you used a registry. Silent substitution is the exact failure mode PAINT
exists to prevent.

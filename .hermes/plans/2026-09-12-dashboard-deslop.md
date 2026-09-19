# Dashboard De-Slop Plan — 2026-09-12

## Session Metadata
- Title: Dashboard cards de-slop (StatusBand, MomentumHero, TierBreakdown, row wrappers)
- Product Area: Dashboard
- Category: refactor
- Status: completed (build ✅ 2026-09-12)

## Skills loaded (8/8 DESIGN mandatory + extras)
1. skill-router (dispatcher, DESIGN category)
2. frontend-external-infra — source routing, re-skin rules, anti-slop checklist
3. frontend-design — DeskFlow tokens, L1 motion budget, no-blur/no-glow rules
4. humancentred-UIUX — scope = dashboard cards only, 4-state coverage preserved
5. impeccable — 7 domains, typography/color/spatial discipline
6. motion-alive — Liveliness L1 COMPOSED locked (data tool: feedback-only motion, no ambient)
7. design-taste — knobs: VARIANCE 5, MOTION 2-3, DENSITY 7
8. ui-ux-pro-max — developer-tool rules: dark chrome, fast linear motion, no bounce
9. taste-skill — knob config honored
10. generate-prompt — exhaustive-spec workflow honored via this plan file

## MCP sources consulted (3)
1. shadcn-ui-mcp `get_component(card)` — canonical card = flat flex-col, rounded-xl, border, no glow. Verdict: our WidgetCard already matches; neon/particles are the deviation.
2. magicui `searchRegistryItems + getRegistryItem(magic-card)` — Magic Card = spotlight-on-hover ONLY. NeonGradientCard = always-on animated neon border = slop when stacked. Verdict: remove NeonGradientCard.
3. reactbits `search_components(text)` — CountUp/BlurText exist, but L1 budget says static numbers on a data dashboard. Verdict: deliberately NOT animating numerals.

## Slop inventory (exact sites)
1. `src/pages/dashboard/StatusBand.tsx` — NeonGradientCard + outer glow boxShadow + DotPattern + AnimatedCircularProgressBar(130) + NumberTicker + BlurFade = 5 stacked effects, tier-hue glow shifts (emerald/amber/indigo). THE top color scent.
2. `src/components/dashboard/MomentumHero.tsx:47,66` — violet hairline gradient; `:68-75` radial blur orb; `:92` rainbow score (emerald/sky/amber/orange); 4 rainbow bars (violet/sky/cyan/amber) + NumberTicker + staggered motion widths.
3. `src/pages/dashboard/TierBreakdownStrip.tsx` — 4 hues + colored top borders + 4 NumberTickers (400-700ms delays) + staggered motion + BlurFade = double entrance.
4. `src/pages/DashboardPage.tsx:2679,3000` — emerald Particles x30 inside chart cards; `:2882,2916,2977,2998,3087` — BlurFade cascade delays per row; `:2147,2678,2752,2999,3088` — zinc-900/50 + backdrop-blur-xl cards (violates WidgetCard LAMINAR no-blur rule).
- CLEAN (verified via repo search, untouched): GoalsCard, DeadlinesCard, LongestFocusCard, ScheduleCard, InsightStrip, SummaryStrip, PinnedActivities, WidgetCard, widgetTheme.

## Fix spec
- L1 COMPOSED everywhere: kill Particles, NeonGradientCard, DotPattern, glow shadows, radial orb, BlurFade cascades, NumberTickers on static values, staggered entrances, motion width animations.
- Single-hue chrome: `var(--color-card)` bg, `var(--border-subtle)` border, `rounded-xl`, `p-5`. Page-accent ONLY on icon tile + hero numeral. Tier hues survive ONLY as 8px status dots + small labels (semantic, flat, no glow).
- Rebuild StatusBand / MomentumHero / TierBreakdownStrip on WidgetCard + getWidgetTheme (kickers NOW / MOMENTUM / TIME MIX). All 4 WidgetCard states preserved.
- Momentum bars: single page-accent flat fill, static width (CSS transition 150ms on value change only).
- DashboardPage: plain divs for rows, token-card style for chart sections, drop Particles + BlurFade imports.
- Backups: `.bak.20260912-deslop` copies before each rewrite. No git reset, no commits.

## Verify
- `npm run lint` on touched files, `npm run build` (scripts/build.mjs). Probe visual check if dev server up.

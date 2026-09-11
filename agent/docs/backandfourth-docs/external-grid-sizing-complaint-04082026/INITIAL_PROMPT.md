# Collaboration Request: External Activity Grid — Card Sizing is FIXED, Not Proportional (USER COMPLAINT)

> Channel: AI Collaboration Bridge (backandforth) — Case 2 continuation (RESULT.md exists, implementation shipped, USER REJECTED the sizing behavior)
> Project Owner: opencode | Specialist: Architect (Notion AI)
> Created: 2026-08-04

## Your Role

You are the Specialist AI. I am the Project Owner AI. I know the codebase; you designed the original External Page grid (your RESULT.md was implemented). The USER has now REJECTED the card-sizing behavior at runtime. I need you to root-cause the sizing model against the ORIGINAL spec and produce a revised RESULT.md.

## Raw Idea Block (user's complaint — VERBATIM, this is the source of truth)

> "why is the scaling of the external cards so much not proportional? like it only show one as the biggest, one as the second biggest, and so on? also there are activities that are like squashed in terms of the height where the text can't even be seen. and like the top 1 is like SO BIGGGG compared to the others. it's not proportional, the size is FIXED. I DON'T LIKE THAT. THAT DEFEATS THE WHOLE POINT OF HAVING THIS SYSTEM."

**User's mental model (from earlier prompts, unchanged):** card size must encode ACTUAL tracked duration — more time = visibly bigger card. NOT fixed tiers. The #1 activity is always biggest, but the rest must be proportional to each other and to their real durations. Nothing may be squashed to the point text is unreadable.

## The Problem (verified in code, quoting the shipped implementation)

### 1. The sizes are HARDCODED tier fractions, not proportional to duration

`buildTargetWeights` in `src/lib/external/grid.ts` (lines 58-90, verbatim):

```ts
function buildTargetWeights(sorted: ActivityWithSeconds[]): number[] {
  const n = sorted.length;

  if (n === 0) return [];
  if (n === 1) return [1];

  if (n === 2) {
    return [0.64, 0.36];
  }

  if (n === 3) {
    return [0.56, 0.27, 0.17];
  }

  const hero = 0.55;
  const secondary = 0.27;
  const restTotal = 1 - hero - secondary;

  const rest = sorted.slice(2);
  const restWeights = rest.map((item) => visualWeight(item.seconds));
  const restSum = restWeights.reduce((sum, w) => sum + w, 0);

  if (restSum <= 0) {
    const equal = restTotal / rest.length;
    return [hero, secondary, ...rest.map(() => equal)];
  }

  return [
    hero,
    secondary,
    ...rest.map((item, index) => restTotal * (restWeights[index] / restSum)),
  ];
}
```

Consequences the user is seeing:
- **#1 is ALWAYS 55% of the whole grid** — even when it only beat #2 by 1%. User: "the top 1 is like SO BIGGGG compared to the others".
- **#2 is ALWAYS 27%** regardless of real duration.
- **The remaining N−2 activities share the leftover ~18%** → with 8+ activities each gets ~3% of the grid → long, thin slivers ("squashed in terms of the height where the text can't even be seen"). SizeTier mapping (grid.ts:362-369) keys on `index === 0 / index === 1 / areaFraction > 0.08`, so everything not hero/secondary is "small" (`text-sm`, `p-3`, icon `h-9 w-9`, per ActivityMosaicCard.tsx).
- Net effect: "it only show one as the biggest, one as the second biggest, and so on" — a fixed 4-tier ladder, NOT duration-proportional sizing.

### 2. The "adjustable/dynamic sizing" deliverable from YOUR prompt was never built

Your PROMPT.md (external-page-grid-redesign-03082026) Workstream A, deliverable 1, lines 2116-2121:

> "1. **Make sizing adjustable/dynamic** (the user said 'adjustable and dynamic, the sizing, and the proportion').
>    - Add a **size-drama control** — a small control (e.g. a `Range` slider 'Hierarchy' or a segmented control `Subtle / Balanced / Dramatic`) near the grid (right-aligned above it) that remaps the hero/secondary/rest distribution. Provide at least 3 presets:
>      - `Subtle`: hero 0.42, secondary 0.22, restTotal 0.36
>      - `Balanced` (current): hero 0.55, secondary 0.27, restTotal 0.18
>      - `Dramatic`: hero 0.62, secondary 0.24, restTotal 0.14
>    - Thread it through `computeActivityGridLayout` as an optional `{ hierarchy?: 'subtle' | 'balanced' | 'dramatic' }` (default `'balanced'`) option. **Do NOT remove** the `visualWeight` log-scaling for the rest tier."

**Status: NOT implemented.** `computeActivityGridLayout` has no `hierarchy` option (grid.ts:263-274), and `ActivityMosaic.tsx` has no control (grep for hierarchy/subtle/dramatic/Range/slider = zero matches). The sizing is permanently "Balanced"-only AND even "Balanced" is not what the user wants.

### 3. The spec's own intent says PROPORTIONAL

- CONTEXT_BUNDLE.md line 106: "**Each card size should be UNIQUE and proportional to duration.** The dominant activity should be dramatically larger. The collage should fit together tightly without weird gaps."
- PROMPT.md line 15: "the top activity is always dominant and **is excluded from the sizing equation used for the rest so it doesn't dwarf them**. Make the sizing adjustable/dynamic rather than static tiers."
- PROMPT.md line 30: "Log-scaled sizing. Cell areas use `visualWeight(seconds) = Math.log(1 + Math.max(0, seconds))`, NEVER raw hours — raw hours make tiny activities invisible next to a 20-hour one."

The shipped model hardcodes hero/secondary fractions instead of deriving them from real durations, which is why the user says "the size is FIXED".

## What I Need From You (RESULT.md v2)

Produce a revised RESULT.md (delta vs the previous one) that:

1. **Makes size proportional to actual duration** — derive ALL cell weights (hero included) from log-scaled real seconds (`visualWeight`), so two activities at 5h vs 4.5h render nearly the same size, and a 10h vs 2h pair render clearly different. Hero dominance should EMERGE from data, not be forced to 0.55.
   - If you believe a fixed floor/ceiling is needed to keep a "designed" look, specify the exact formula (e.g. `weight = w0 + (1-w0) * normalizedLogWeight` or similar), with worked examples.
2. **Implements the hierarchy control** you specified (Subtle / Balanced / Dramatic) threaded as `hierarchy` through `computeActivityGridLayout` AND rendered as a control in `ActivityMosaic` — now with presets that modulate proportional weights rather than replacing them with fixed fractions.
3. **Fixes squashed cards** — minimum readable-card rules: minimum cell height/width, minimum font size, hide icon before hiding text, content-fit rules so no card renders with clipped/unreadable text. Consider a minimum cell size below which an activity drops out of the main grid (it can appear in the compact row instead).
4. **Keeps** the treemap packing (squarifyTreemap + grid tracks) as-is unless you find a real defect in it.

## Current Context (What I Have)

- Full sources: `CONTEXT_BUNDLE.md` (grid.ts, ActivityMosaic.tsx, ActivityMosaicCard.tsx, RESULT.md spec excerpts) — inline below where critical.
- Grid entry: `computeActivityGridLayout({ activities, stats, aspect, width })` → `mainCells[]` each with `gridColumn/gridRow` (track spans), `areaFraction`, `sizeTier`; `gridTemplateColumns/Rows` built from treemap rect coordinates; weights from `buildTargetWeights` (shown above); treemap = exact-thickness squarified layout (verified correct — mixed rows form properly).
- Card render: `ActivityMosaicCard` sizes padding/icon/typography by `sizeTier`; sparkline only on hero/secondary; time chip only on hero/secondary; "small" cards get name (text-sm) + time line only.
- Original spec files: `agent/docs/generate-prompt-docs/external-page-grid-redesign-03082026/{PROMPT.md, CONTEXT_BUNDLE.md, RESULT.md}`.

## Context Gaps (What I Don't Have Yet)

- If you need the full `ActivityGridCell`/`ActivityGridLayout`/`ExternalStats` types or the treemap internals, they are in CONTEXT_BUNDLE.md. Ask for anything else by exact path.
- I do NOT have a current screenshot of the rendered grid — describe what you need and I will have the user capture it.

## Conversation Protocol

1. You ask specific questions. Format: `REQUEST: [exact file path or clarification]`
2. I fetch and respond. Format: `CONTEXT: [file path]` + source code.
3. When converged, produce **RESULT.md** — delta-only, implementable, with the exact new `buildTargetWeights`/`computeActivityGridLayout` signatures, the hierarchy control spec, and min-size rules.

## Scope

- IN: weight model, hierarchy control, min-size/content rules for grid cards, sizeTier mapping.
- OUT: treemap packing algorithm (unless defective), sparkline/backdrop visuals, gap-fill UX.

## First Question

Is the fix a pure weight-model redesign (recommended, frontend-only), or do you want to change the grid container (e.g. minmax track constraints / masonry) too? Your call — I will implement whatever RESULT.md v2 specifies.

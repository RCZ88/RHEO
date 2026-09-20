---
name: ui-and-charts
description: Use when building UI components (buttons, cards, inputs, nav, backgrounds, AI-chat interfaces) or charts, dashboards, data visualization in this project. Covers the KokonutUI and Bklit UI component registries.
---

# UI Components & Charts

## Before anything else
Check the repo for a design reference: `design.md`, `DESIGN.md`, `STYLE.md`, `docs/design.md`,
`.cursor/rules`. If one exists, follow it exactly and ignore anything below that conflicts with
it. If none exists, match whatever Tailwind config and component patterns already exist in the
codebase before inventing new ones.

## Which registry
- **KokonutUI** = general UI. Buttons, cards, inputs, nav, backgrounds, AI-chat-style interfaces.
  Ships its own Motion-based animation already built in. Don't add a second animation engine on
  top of a KokonutUI component (see the `animation-stack` skill for that rule).
- **Bklit UI** = charts and data visualization only (area, bar, candlestick, heatmap, funnel,
  sankey, choropleth, etc). Not general UI, don't reach for it outside chart work.

## Setup (once per project)
```bash
npx shadcn@latest init
npx shadcn@latest add https://kokonutui.com/r/utils.json
```

`components.json`:
```json
{
  "registries": {
    "@kokonutui": "https://kokonutui.com/r/{name}.json",
    "@bklit": "https://ui.bklit.com/r/{name}.json"
  }
}
```

Install a component:
```bash
npx shadcn@latest add @kokonutui/particle-button
npx shadcn@latest add @bklit/area-chart
```

## MCP (one server covers both registries)
```bash
npx shadcn@latest mcp init --client <your-client>
```
or by hand:
```json
{
  "mcpServers": {
    "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] }
  }
}
```
Use it to browse and install components by name instead of guessing at markup from scratch.

## Rules
1. Search the registry before writing custom markup. These are copy-into-your-project
   libraries, find the closest existing component and adapt it.
2. Never hand-build a chart when Bklit already has one that fits.
3. Restraint by default: fewer, sharper choices over decorative ones, unless the brief
   explicitly asks for a maximal look.

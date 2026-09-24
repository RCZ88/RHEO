# Prompt: Dashboard Widget Expansion — 8 New Widgets from Underserved Features

> **Prompt Type:** design
> **Target AI:** claude
> **Detail Level:** 9
> **Tone:** precise, technical, design-first
> **Creativity:** 25
> **Max Tokens:** 6000
> **Response Format:** markdown

---

## Raw Request

Design 8 new dashboard widgets for DeskFlow that pull useful data from features not yet included on the main dashboard. The user wants widgets for: AI usage stats, Penguin Console/terminal, Finance/Earn, Learn/Lyceum, Browser Activity, Context Brain, Covenant/Commitments, and Health/Sleep. Each widget must support layout customization (proportion, orientation, split). The widgets should follow the DeskFlow design system exactly.

---

## Context

Reference `CONTEXT_BUNDLE.md` in the same directory as the source of truth for code structure, data shapes, IPC endpoints, design tokens, and widget patterns.

The current dashboard has a 12-column × 8-row mosaic grid. Widgets are registered in `WidgetRegistry.ts` with `id`, `name`, `description`, `icon`, `category`, `defaultSize`, `minSize`, `maxSize`, `component`, `defaultVisible`, `sourcePage`. Summary components are exported from `WidgetSummaries.tsx` and registered in `registerWidgets.ts`.

**What exists on the dashboard now:**
status-band, schedule-hero, insight-strip, goals-card, deadlines-card, focus-card, tier-breakdown, pinned-activities, productivity-chart, sleep-bar, activity-feed, momentum-hero (all visible)
+ mastery-ring, app-ecosystem, follow-through, vcalendar (registered but hidden)

**What is MISSING (these are the 8 new widgets):**
1. `ai-usage` — AI model/tool usage stats from AiPage
2. `console-widget` — Penguin Console command usage and handbook progress
3. `finance-widget` — Wallet balances and earnings from FinancePage
4. `learn-widget` — Lyceum lesson progress and mastery from Learn page
5. `browser-widget` — Website categories and tracking from BrowserActivityPage
6. `brain-widget` — Context Brain knowledge graph stats
7. `covenant-widget` — Covenant commitments and completion from CovenantPage
8. `health-widget` — Sleep hours, consistency, health stats from ExternalPage

**What the user wants:**
- Widgets that surface useful data from OTHER pages that haven't been on the dashboard
- Layout customization: users can adjust proportion (colSpan/rowSpan), orientation (L/R or up/down), split views
- Each widget should be a compact, information-dense card that fits the DeskFlow glass aesthetic
- Must support all 4 states (empty, loading, error, populated)
- Must use `motion/react` for animations, NOT `framer-motion` direct

---

## The Mandate

You are the Lead Designer and Engineer. Design a comprehensive solution that includes:

### 1. Data Processing Pipeline
For each widget, specify:
- Which IPC channel provides the data
- How the data is aggregated/transformed for display
- What the widget shows when data is unavailable (empty state)
- What the widget shows during loading (skeleton)
- What the widget shows on error (error state with retry)

### 2. High-Fidelity Visual Specs
For each widget:
- Exact Tailwind classes and CSS custom properties
- Typography scale: `font-display text-[22px] font-bold` for values, `text-[11px] text-[var(--text-muted)]` for labels, `text-[13px] font-semibold` for titles
- Color scheme: pink-500 accent by default, per-widget accent colors (see below)
- Glass card: `bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5`
- NO box-shadow for elevation — use border brightness
- NO decorative gradients on chrome
- Motion: `motion/react` with `whileHover={{ scale: 1.02 }}` and `transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}`

**Per-widget accent colors:**
- `ai-usage`: violet-500 (#a855f7) — Code/AI purple
- `console-widget`: green-500 (#22c55e) — Terminal green
- `finance-widget`: emerald-400 (#34d399) — Money green
- `learn-widget`: indigo-500 (#6366f1) — Learn blue
- `browser-widget`: sky-400 (#38bdf8) — Web blue
- `brain-widget`: cyan-400 (#22d3ee) — Neural cyan
- `covenant-widget`: amber-400 (#fbbf24) — Commitment amber
- `health-widget`: rose-400 (#fb7185) — Health rose

### 3. Interaction Flow
- Click on widget navigates to source page via `useNavigate()`
- Hover shows subtle lift + border brightening
- Widgets have `data-section` attribute for tracking
- Resize via drag handles (min/max constrained)
- LayoutEditor provides drag-drop repositioning
- Layout persisted to localStorage `dashboard_layout` key

### 4. Layout Customization
- **Proportions:** Each widget defines `defaultSize`, `minSize`, `maxSize` in `{cols, rows}` using the 12-column grid
- **Orientation:** Default L/R flow. Some widgets can be vertical (tall, narrow) or horizontal (wide, short)
- **Split:** Some widgets can internally split (e.g., left stat + right mini-chart)
- **Resize:** User drags corners, constrained by `minSize`/`maxSize`
- **Rearrange:** Drag-and-drop via `LayoutEditor.tsx`
- **Visibility:** Toggle in CardLibrary
- **Persistence:** `localStorage` key `dashboard_layout`

### 5. Widget Summary Component Pattern
Each widget must be exported as a function from `WidgetSummaries.tsx`:
```tsx
export function AiUsageSummary() {
  const { data } = useDashboardDataContext();
  return (
    <WidgetCard>
      {/* Content using GlassCard, ProgressBar, StatValue patterns */}
    </WidgetCard>
  );
}
```

### 6. Registration Pattern
Each widget must be registered in `registerWidgets.ts`:
```ts
WidgetRegistry.register({
  id: 'ai-usage',
  name: 'AI Usage',
  description: 'Model usage stats and token consumption',
  icon: 'Bot',
  category: 'system',
  defaultSize: { cols: 4, rows: 2 },
  minSize: { cols: 2, rows: 2 },
  maxSize: { cols: 6, rows: 4 },
  component: AiUsageSummary,
  defaultVisible: true,
  sourcePage: 'ai',
});
```

### 7. Layout Positioning
New widgets should integrate into the existing grid. Suggested positions:
- `ai-usage`: col 0, row 18, colSpan 4, rowSpan 2 (below momentum-hero)
- `console-widget`: col 4, row 18, colSpan 4, rowSpan 2
- `finance-widget`: col 8, row 18, colSpan 4, rowSpan 2
- `learn-widget`: col 0, row 20, colSpan 3, rowSpan 2
- `browser-widget`: col 3, row 20, colSpan 3, rowSpan 2
- `brain-widget`: col 6, row 20, colSpan 3, rowSpan 2
- `covenant-widget`: col 9, row 20, colSpan 3, rowSpan 2
- `health-widget`: col 0, row 22, colSpan 6, rowSpan 2

---

## Requirement Checklist

- [ ] **Data Processing:** Specify IPC channel, data transformation, and display logic for each widget
- [ ] **Visual Specs:** Exact Tailwind classes, CSS vars, typography, colors per widget
- [ ] **Interaction Flow:** Click-to-navigate, hover effects, resize behavior
- [ ] **Layout Customization:** Proportion, orientation, split support
- [ ] **Empty/Loading/Error/Populated States:** All 4 states for each widget
- [ ] **Widget Registration:** Add to WidgetRegistry.ts and registerWidgets.ts
- [ ] **Summary Component:** Export from WidgetSummaries.tsx
- [ ] **Anti-Slop:** All 12 anti-slop rules followed
- [ ] **Design Intent:** Answer the 4 design intent questions for each widget

---

## Frontend Design Skills (MUST BE LOADED by receiving AI)

1. **Frontend Design** — DeskFlow component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error/populated states, progressive disclosure, feedback
3. **Impeccable** — 7 design domains, 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels, motion taxonomy
5. **UI UX Pro Max** — industry-specific rules for dev tools, AI/ML
6. **Design Taste System** — aesthetic matrix, anti-repetition
7. **UI and Charts** — MCP component browsing
8. **Animation Stack** — motion engine selection

---

## MCP Inventory (MUST be included in the prompt to the AI)

The receiving AI MUST query and use these MCP servers:

| Component | Source | Use for |
|-----------|--------|---------|
| `card` | shadcn | Standard UI card wrapper |
| `button` | shadcn | Interactive buttons |
| `badge` | shadcn | Status badges, category pills |
| `progress` | shadcn | Progress bars |
| `tooltip` | shadcn | Hover info |
| `tabs` | shadcn | Widget internal tab switching |
| `dialog` | shadcn | Settings/modals |
| `particle-button` | KokonutUI | Animated CTA buttons |
| `magic-card` | KokonutUI | Premium card surfaces |
| `NumberTicker` | Magic UI | Animated number display |
| `BorderBeam` | Magic UI | Subtle border glow |
| `Bot` | Lucide | AI icon |
| `Sparkles` | Lucide | Insight icons |
| `Wallet` | Lucide | Finance icons |
| `Brain` | Lucide | Brain/AI icons |
| `Clock` | Lucide | Time icons |
| `Target` | Lucide | Goal/completion icons |

---

## Constraints

- Must work with existing `WidgetRegistry.ts` and `WidgetSummaries.tsx` patterns
- Must use `useDashboardDataContext()` for data access
- Must use `motion/react` for ALL animations
- Must use DeskFlow design tokens (zinc-950/900, pink-500 accent, etc.)
- Max `rounded-xl` (12px), `p-5` padding
- NO `box-shadow` for elevation
- NO spring physics
- NO decorative gradients on chrome
- Dark mode only
- Geist + JetBrains Mono fonts
- All 4 states covered for each widget
- Must not break existing dashboard layout

---

## Output Format

The AI must produce:
1. **Data Processing Pipeline** — IPC channels, transformations, fallback logic per widget
2. **Visual Specifications** — Per-widget design specs with exact Tailwind classes and CSS vars
3. **Interaction Design** — Click, hover, resize, drag behavior
4. **Layout System** — Grid positions, resize constraints, orientation rules
5. **8 Widget Summary Components** — Complete `WidgetSummaries.tsx` additions
6. **Registry Entries** — Complete `registerWidgets.ts` additions
7. **Layout Positions** — Updated `WidgetRegistry.ts` gridPositions

---

## Context Sources

- `agent/state.md` — current session state
- `agent/context.md` — project context
- `src/components/dashboard/WidgetRegistry.ts` — widget registry
- `src/components/dashboard/WidgetSummaries.tsx` — existing widget components
- `src/components/dashboard/registerWidgets.ts` — widget registration
- `src/components/dashboard/DashboardContext.tsx` — data context
- `src/components/dashboard/useDashboardData.ts` — data hook
- `src/components/dashboard/CardLibrary.tsx` — widget library UI
- `src/components/dashboard/LayoutEditor.tsx` — layout editor
- `src/components/GlassCard.tsx` — glass card component
- `src/components/ui/button.tsx` — button component
- `src/pages/AiPage.tsx` — AI page (source for ai-usage widget)
- `src/terminal/` — Penguin Console (source for console-widget)
- `src/pages/FinancePage.tsx` — Finance page (source for finance-widget)
- `src/pages/ExternalPage.tsx` — External/Sleep page (source for health-widget)
- `src/features/covenant/` — Covenant features (source for covenant-widget)

---

## Anti-Slop Checklist (MANDATORY — every component must pass)

1. Re-skin to DeskFlow tokens
2. Max `rounded-xl` (12px)
3. `p-5` padding
4. Dark mode only
5. Geist + JetBrains Mono fonts
6. Glass layer (`bg-zinc-900/80 backdrop-blur-xl`)
7. NO `box-shadow` for elevation
8. NO spring physics
9. NO decorative gradients on chrome
10. `motion/react` only
11. NO `@tailwind` v3 directives
12. All 4 states covered

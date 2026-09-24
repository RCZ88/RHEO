# DeskFlow Dashboard — Context Bundle: New Widgets

> **Generated:** 2026-09-22
> **Task:** Generate 5-8 new dashboard widgets from features not yet on the dashboard
> **Date:** 22092026

---

## 1. Current Dashboard Layout

The dashboard uses a 12-column × 8-row mosaic grid (`WidgetRegistry.ts`). Current widgets:

| Widget ID | Name | Category | Default Size | Visibility |
|-----------|------|----------|-------------|------------|
| status-band | Status Band | productivity | 8×2 cols | ✅ |
| schedule-hero | Schedule Hero | schedule | 4×2 cols | ✅ |
| insight-strip | AI Insights | insights | 12×1 cols | ✅ |
| goals-card | Goals | productivity | 5×3 cols | ✅ |
| deadlines-card | Deadlines | productivity | 4×3 cols | ✅ |
| focus-card | Focus | productivity | 3×3 cols | ✅ |
| tier-breakdown | Tier Breakdown | insights | 7×2 cols | ✅ |
| pinned-activities | Pinned Activities | productivity | 5×2 cols | ✅ |
| productivity-chart | Productivity Chart | insights | 8×3 cols | ✅ |
| sleep-bar | Sleep Bar | health | 4×2 cols | ✅ |
| mastery-ring | Mastery Ring | learn | 4×2 cols | ❌ |
| app-ecosystem | App Ecosystem | productivity | 7×3 cols | ❌ |
| activity-feed | Activity Feed | insights | 5×4 cols | ✅ |
| momentum-hero | Momentum Hero | insights | 6×2 cols | ✅ |
| follow-through | Follow Through | productivity | 6×2 cols | ❌ |
| vcalendar | Calendar | schedule | 4×3 cols | ❌ |

**Grid positions** use `{ col, row, colSpan, rowSpan }` in a 12-column system. Layout is persisted in localStorage under `dashboard_layout`.

---

## 2. Missing Widget Candidates (5-8 needed)

These features exist elsewhere in the app but are NOT on the dashboard:

### 2.1 AI Usage Widget (`ai-usage`)
- **Source:** `src/pages/AiPage.tsx` / `src/components/ai/AIToolsTab.tsx`
- **Data:** Model/tool usage stats, token consumption, session counts, daily averages
- **IPC:** `get-ai-stats`, `get-model-usage` (via `window.deskflowAPI.aiStats`)
- **Features:** Model breakdown, tool usage bar chart, session counts, dominance phases (from `useHomeSummary` / `h2-usage` data)
- **Widget type:** Stat cards + mini bar chart

### 2.2 Penguin Console Widget (`console-widget`)
- **Source:** `src/terminal/` / route `/penguin-console`
- **Data:** Command usage count, handbook progress, command notes
- **IPC:** `get-terminal-stats`, `get-handbook-progress`
- **Features:** Command frequency, active sessions count, handbook completion rate
- **Widget type:** Compact stats + progress ring

### 2.3 Finance/Earn Widget (`finance-widget`)
- **Source:** `src/pages/FinancePage.tsx`
- **Data:** Wallet balances, total balance, transaction count, recent activity
- **IPC:** `get-finance-summary`, `get-wallets`
- **Features:** Balance display, net worth trend, transaction count, quick add button
- **Widget type:** Stat cards + balance display

### 2.4 Learn/Lyceum Widget (`learn-widget`)
- **Source:** `src/components/learn/` / Lyceum page
- **Data:** Lesson progress, mastery levels, streak, courses completed
- **IPC:** `get-learn-stats`, `get-mastery-levels`
- **Features:** Mastery ring, lesson count, streak badge, next lesson suggestion
- **Widget type:** Progress ring + stat cards

### 2.5 Browser Activity Widget (`browser-widget`)
- **Source:** `src/pages/BrowserActivityPage.tsx`
- **Data:** Website categories, time spent, top sites, tracking status
- **IPC:** `get-browser-stats`, `get-website-stats`
- **Features:** Category breakdown, top sites list, tracking status indicator
- **Widget type:** Category bar + top sites list

### 2.6 Context Brain Widget (`brain-widget`)
- **Source:** `src/components/context-brain/`
- **Data:** Knowledge graph nodes, retrieval count, memory connections
- **IPC:** `get-brain-stats`, `get-graph-stats`
- **Features:** Node count, connection density, retrieval frequency, recent queries
- **Widget type:** Mini graph stats + node count

### 2.7 Covenant/Commitment Widget (`covenant-widget`)
- **Source:** `src/features/covenant/CovenantPage.tsx`
- **Data:** Active commitments, completion rate, journal entries
- **IPC:** `get-covenant-stats`, `get-commitments`
- **Features:** Active count, completion %, streak, next due
- **Widget type:** Progress bar + list

### 2.8 Health/Sleep Widget (`health-widget`)
- **Source:** `src/pages/ExternalPage.tsx` / sleep tracking
- **Data:** Sleep hours, consistency score, sleep gaps, AFK time
- **IPC:** `get-sleep-summary`, `get-health-stats`
- **Features:** Sleep hours, consistency %, gap count, quality score
- **Widget type:** Ring chart + stats

---

## 3. Widget Component Pattern

All dashboard widgets follow this pattern (`WidgetSummaries.tsx`, `WidgetCard.tsx`):

```tsx
// Each widget is a summary component exported from WidgetSummaries.tsx
export function WidgetNameSummary() {
  const { data } = useDashboardDataContext();
  return (
    <div className="p-5">
      {/* Stat icons use lucide-react */}
      {/* Typography: font-display text-[22px] font-bold for values, text-[11px] for labels */}
      {/* Progress bars use the shared ProgressBar component */}
      {/* Color scheme: pink-500 accent by default, per-widget accent */}
    </div>
  );
}
```

**Widget registration** (`WidgetRegistry.ts`):
```ts
WidgetRegistry.register({
  id: 'widget-id',
  name: 'Widget Name',
  description: 'Short description',
  icon: 'IconName', // lucide icon name
  category: 'productivity' | 'schedule' | 'finance' | 'learn' | 'health' | 'insights' | 'system',
  defaultSize: { cols: 4, rows: 2 },
  minSize: { cols: 2, rows: 2 },
  maxSize: { cols: 6, rows: 4 },
  component: WidgetNameSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});
```

**WidgetCard wrapper** (`WidgetCard.tsx`):
- Uses `GlassCard` with `variant="default"` and `rounded-xl`
- `motion/react` for hover animations (`whileHover={{ scale: 1.02 }}`)
- Click handler navigates to source page via `useNavigate()`
- Has `data-section` attribute for tracking

**Layout customization:**
- Users can resize via drag handles on widget corners
- `colSpan` and `rowSpan` control grid proportions
- `gridPositions` persisted in localStorage
- LayoutEditor (`LayoutEditor.tsx`) provides drag-drop repositioning

---

## 4. Design Tokens

```css
--bg-primary: zinc-950;
--bg-elevated: zinc-900;
--bg-glass: zinc-900/80;
--accent-primary: pink-500;
--accent-secondary: cyan-400;
--accent-success: emerald-400;
--accent-warning: amber-400;
--text-primary: zinc-100;
--text-secondary: zinc-400;
--text-muted: zinc-600;
--border-subtle: zinc-800/50;
--radius: rounded-xl (12px max);
--spacing: p-5 (20px card padding);
--font-display: Space Grotesk;
--font-body: Inter;
--font-mono: JetBrains Mono;
```

**Motion tokens:**
- `fast: 150ms`, `normal: 250ms`, `slow: 400ms`
- `ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
- Use `motion/react` — NO `framer-motion` direct imports
- NO `type: 'spring'` — use `ease` presets

---

## 5. IPC Endpoints

Key IPC channels used by dashboard widgets:

| Channel | Handler Location | Returns |
|---------|-----------------|---------|
| `get-home-summary` | main.ts:26627 | Focus minutes, finance, learn, sleep stats |
| `get-ai-stats` | preload.ts | AI model/tool usage |
| `get-terminal-stats` | main.ts | Command frequency, sessions |
| `get-finance-summary` | main.ts | Wallet balances, totals |
| `get-learn-stats` | main.ts | Lesson progress, mastery |
| `get-browser-stats` | main.ts | Website categories, time |
| `get-brain-stats` | main.ts | Graph nodes, connections |
| `get-covenant-stats` | main.ts | Commitments, completion |
| `get-sleep-summary` | main.ts | Sleep hours, gaps |
| `get-platforms` | main.ts | OS platform list |

---

## 6. Frontend Design Skills (REQUIRED — verbatim names)

The prompt MUST instruct the receiving AI to load these skills:

1. **Frontend Design** — DeskFlow component patterns, tokens, spacing, typography, glass cards, color system, animation tokens
2. **Human-Centric UX** — empty/loading/error/populated states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design domains (typography, color, spatial, motion, interaction, responsive, UX writing), 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels (L1/L2/L3), motion taxonomy, recipes, reduced-motion fallback
5. **UI UX Pro Max** — industry-specific design rules for developer tools, AI/ML, analytics
6. **Design Taste System** — master dispatcher, aesthetic matrix, anti-repetition rules
7. **UI and Charts** — MCP component browsing via shadcn/KokonutUI/Bklit
8. **Animation Stack** — GSAP vs Anime.js vs motion/react, when to use which

---

## 7. MCP Inventory (MANDATORY — query real components)

The prompt MUST include ACTUAL MCP component names:

| MCP Server | Query Command | Relevant Components |
|-----------|---------------|-------------------|
| shadcn | `npx shadcn@latest search '@shadcn'` | card, button, badge, progress, tooltip, dialog, tabs |
| KokonutUI | `npx shadcn@latest search '@kokonutui'` | particle-button, magic-card, glow-button |
| Magic UI | `npx shadcn@latest mcp` | AnimatedBeam, BorderBeam, NumberTicker, Particles |
| Lucide | `lucide_search_icons` | Bot, Sparkles, Target, Activity, Brain, Wallet |
| React Bits | `reactbits_search_components` | AnimatedCard, GlassmorphismCard |

---

## 8. Anti-Slop Checklist (MANDATORY)

Every generated component MUST:
1. Re-skin to DeskFlow tokens (`--bg-elevated`, `--page-accent`, etc.)
2. Max `rounded-xl` (12px), `p-5` padding
3. Dark mode only (`zinc-950`/`zinc-900`)
4. Geist + JetBrains Mono fonts
5. Glass layer (`bg-zinc-900/80 backdrop-blur-xl`)
6. NO `box-shadow` for elevation — use `border` brightness
7. NO `rounded-2xl`/`rounded-3xl` — max `rounded-xl`
8. NO spring physics — use `cubic-bezier` easing
9. NO decorative gradients on chrome — solid zinc surfaces only
10. Motion: `motion/react` only, NO `framer-motion` direct imports
11. NO `@tailwind` directives — use Tailwind v4 syntax
12. All 4 states covered: empty, loading, error, populated

---

## 9. Layout Customization Requirements

The generated prompt MUST address layout customization:

- **Proportions:** Widgets use `colSpan`/`rowSpan` in a 12×8 grid. Widgets can span 2-6 columns and 2-4 rows
- **Orientation:** Left-to-right flow is default. Some widgets can be vertical (single column, tall) or horizontal (full width, short)
- **Split:** Some widgets can split content internally (e.g., left stat + right chart)
- **Resize:** Users drag widget corners to resize. `minSize`/`maxSize` constrain ranges
- **Rearrange:** Drag-and-drop repositioning via `LayoutEditor.tsx`
- **Visibility:** Each widget has `defaultVisible` toggle in `widgetVisibility`
- **Persistence:** Layout saved to localStorage under `dashboard_layout` key

---

## 10. Widget Design Intent (MANDATORY — answer these 4 questions)

### Q1: What skills did you use and why?
List every skill loaded and its contribution.

### Q2: What is the design idea?
The ONE visual/conceptual idea driving each widget design. Not "make it look nice."

### Q3: What is the meaning of the design?
Every design choice must have a reason tied to purpose.

### Q4: Is the design intentional and fitting with the parent context?
How does each widget fit the larger dashboard?

---

## 11. Data Layer Context

Dashboard data flows through `DashboardContext.tsx` → `useDashboardData()` hook:

```typescript
interface DashboardData {
  goals: Goal[];
  deadlines: Deadline[];
  schedule: ScheduleEntry[];
  overview: { totalSeconds, productiveSeconds, neutralSeconds, distractingSeconds } | null;
  recentSessions: any[];
  activityFeed: any[];
  focusMinutes: number;
  displayTimeMs: number;
  totalFocusedMs: number;
  currentAppName: string;
  // ... new widget data fields added here
}
```

New widgets should use `useDashboardDataContext()` to access data. If data isn't available, fetch via IPC channels through `window.deskflowAPI`.

---

## 12. File Paths Reference

- Widget registry: `src/components/dashboard/WidgetRegistry.ts`
- Widget summaries: `src/components/dashboard/WidgetSummaries.tsx`
- Widget card: `src/components/dashboard/WidgetCard.tsx`
- Widget registration: `src/components/dashboard/registerWidgets.ts`
- Dashboard page: `src/pages/DashboardPage.tsx`
- Card library: `src/components/dashboard/CardLibrary.tsx`
- Layout editor: `src/components/dashboard/LayoutEditor.tsx`
- Dashboard context: `src/components/dashboard/DashboardContext.tsx`
- Use dashboard data: `src/components/dashboard/useDashboardData.ts`
- Glass card: `src/components/GlassCard.tsx`
- Button: `src/components/ui/button.tsx`
- Progress bar: `src/components/ui/progress.tsx` (shadcn)

# CONTEXT_BUNDLE.md — Dashboard Layout Editor Redesign

> Generated: 2026-09-20
> Task: Dashboard layout management + preview redesign
> Source: RHEO / DeskFlow Electron + React + TypeScript app

---

## 1. PROBLEM STATEMENT

The current dashboard layout management UI is broken and feels like AI slop:
- No edit button visible ("THERES NO EDIT BUTTON")
- Layout grid is not scrollable
- Drag-to-resize is rudimentary (just a corner button, not edge/corner dragging)
- No visual preview of the layout as it would look
- No ratio-based splitting (2:3, 1:3, etc.)
- The entire layout editor UX feels cheap and non-functional

---

## 2. CURRENT TYPE/INTERFACE DEFINITIONS

### `src/components/dashboard/WidgetRegistry.ts` — LayoutConfig

```typescript
export interface WidgetSize {
  cols: number;
  rows: number;
}

export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'productivity' | 'schedule' | 'finance' | 'learn' | 'health' | 'insights' | 'system';
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  component: ComponentType<any>;
  data?: DataSource;
  defaultVisible: boolean;
  sourcePage?: string;
}

export interface DashboardLayoutConfig {
  schemaVersion: number;
  columns: number; // 4-12 mosaic columns
  rows: number;
  widgetOrder: string[];
  widgetVisibility: Record<string, boolean>;
  gridPositions: Record<string, { col: number; row: number; colSpan: number; rowSpan: number }>;
}

export const DEFAULT_LAYOUT: DashboardLayoutConfig = {
  schemaVersion: 3,
  columns: 12,
  rows: 8,
  widgetOrder: [
    'status-band', 'schedule-hero', 'insight-strip', 'goals-card',
    'deadlines-card', 'focus-card', 'tier-breakdown', 'pinned-activities',
    'productivity-chart', 'sleep-bar', 'mastery-ring', 'app-ecosystem',
    'activity-feed', 'momentum-hero', 'follow-through', 'vcalendar',
  ],
  widgetVisibility: {
    'status-band': true, 'schedule-hero': true, 'insight-strip': true,
    'goals-card': true, 'deadlines-card': true, 'focus-card': true,
    'tier-breakdown': true, 'pinned-activities': true,
    'productivity-chart': true, 'sleep-bar': true,
    'mastery-ring': false, 'app-ecosystem': false,
    'activity-feed': true, 'momentum-hero': true,
    'follow-through': false, 'vcalendar': false,
  },
  gridPositions: {
    'status-band': { col: 0, row: 0, colSpan: 8, rowSpan: 2 },
    'schedule-hero': { col: 8, row: 0, colSpan: 4, rowSpan: 2 },
    'insight-strip': { col: 0, row: 2, colSpan: 12, rowSpan: 1 },
    'goals-card': { col: 0, row: 3, colSpan: 5, rowSpan: 3 },
    'deadlines-card': { col: 5, row: 3, colSpan: 4, rowSpan: 3 },
    'focus-card': { col: 9, row: 3, colSpan: 3, rowSpan: 3 },
    'tier-breakdown': { col: 0, row: 6, colSpan: 7, rowSpan: 2 },
    'pinned-activities': { col: 7, row: 6, colSpan: 5, rowSpan: 2 },
    'productivity-chart': { col: 0, row: 8, colSpan: 8, rowSpan: 3 },
    'sleep-bar': { col: 8, row: 8, colSpan: 4, rowSpan: 2 },
    'mastery-ring': { col: 8, row: 10, colSpan: 4, rowSpan: 2 },
    'app-ecosystem': { col: 0, row: 11, colSpan: 7, rowSpan: 3 },
    'activity-feed': { col: 7, row: 12, colSpan: 5, rowSpan: 4 },
    'momentum-hero': { col: 0, row: 14, colSpan: 6, rowSpan: 2 },
    'follow-through': { col: 6, row: 14, colSpan: 6, rowSpan: 2 },
    'vcalendar': { col: 0, row: 16, colSpan: 4, rowSpan: 3 },
  },
};
```

### `src/components/dashboard/types.ts` — DashboardData

```typescript
export interface DashboardData {
  goals: Goal[];
  longTermGoals: LongTermGoal[];
  suggestions: Goal[];
  insights: DashboardInsights | null;
  streak: number;
  productivityScore: number;
  deadlines: Deadline[];
  reminders: Reminder[];
  schedule: ScheduleEntry[];
  overview: { totalSeconds: number; productiveSeconds: number; neutralSeconds: number; distractingSeconds: number } | null;
  recentSessions: any[];
  activityFeed: any[];
  focusMinutes: number;
  focusProgress: number;
  isPaused: boolean;
  isCurrentlyProductive: boolean;
  isDistracting: boolean;
  displayTimeMs: number;
  totalFocusedMs: number;
  currentAppName: string;
  sleepData: { label: string; hours: number }[];
  avgSleep: number;
  sleepDebt: number;
  masteryMastered: number;
  masteryTotal: number;
  ftData: { totalExpense: number; breakdown: any[] } | null;
  ftPersons: { id: number; name: string }[];
  lastTxDate: { lastUpdated: string; lastDate: string } | null;
  dashboardCurrency: string;
  weeklyHeatmap: { date: string; productiveHours: number }[];
  aiInsights: any[];
  momentum: MomentumScore | null;
  unfilledMinutes: number;
  gapCount: number;
  loading: boolean;
  error: string | null;
}
```

---

## 3. CURRENT IMPLEMENTATION — WidgetGrid.tsx (key sections)

### File: `src/components/dashboard/WidgetGrid.tsx` (865 lines)

**Current edit mode UI (lines 588-647):**
```tsx
// Edit controls — currently renders as a flex row with buttons
<motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
  <div className="flex items-center gap-2">
    <Columns3 size={13} />
    <span>Columns</span>
    <div className="flex items-center gap-1">
      {[4, 6, 8, 12].map(n => (
        <button onClick={() => setColumns(n)}>{n}</button>
      ))}
    </div>
  </div>
  <div className="flex items-center gap-2">
    <Rows3 size={13} />
    <span>Rows</span>
    <span>auto-flow</span>
  </div>
  <button onClick={() => setShowAddPanel(!showAddPanel)}>Add widgets</button>
  <button onClick={resetToDefault}>Reset</button>
</motion.div>
```

**Current widget grid (lines 702-786):**
```tsx
<LayoutGroup>
  <motion.div ref={gridRef} layout className="grid auto-rows-[180px] gap-4"
    style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>
    {visibleWidgets.map(widget => {
      const position = layout.gridPositions[widget.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
      return (
        <motion.div key={widget.id} layout layoutId={widget.id}
          style={{
            gridColumn: `${position.col + 1} / span ${Math.min(position.colSpan, layout.columns)}`,
            gridRow: `${position.row + 1} / span ${position.rowSpan}`,
          }}
          draggable={editMode}
          onDragStart={(e) => handleDragStart(e as any, widget.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e as any, widget.id)}
          className="relative rounded-xl"
        >
          <WidgetCard ... />
          {editMode && (
            <button onMouseDown={(e) => beginResize(e, widget.id, position)}
              className="absolute bottom-1.5 right-1.5 z-10 h-7 w-7 cursor-se-resize"
              title="Drag to resize card">
              <span className="mx-auto block h-3 w-3 border-b-2 border-r-2 border-current" />
            </button>
          )}
        </motion.div>
      );
    })}
  </motion.div>
</LayoutGroup>
```

**Current resize logic (lines 363-402):**
```typescript
const beginResize = useCallback((e: React.MouseEvent, widgetId: string, position) => {
  e.preventDefault(); e.stopPropagation();
  setResizing({ id: widgetId, startX: e.clientX, startY: e.clientY, colSpan: position.colSpan, rowSpan: position.rowSpan });
}, []);

useEffect(() => {
  if (!resizing) return;
  const onMove = (e: MouseEvent) => {
    const width = gridRef.current?.getBoundingClientRect().width || 1;
    const colWidth = width / Math.max(layout.columns, 1);
    const nextCols = resizing.colSpan + Math.round((e.clientX - resizing.startX) / colWidth);
    const nextRows = resizing.rowSpan + Math.round((e.clientY - resizing.startY) / 180);
    setLayout(prev => { ... });
  };
  const onUp = () => setResizing(null);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}, [layout.columns, resizing]);
```

**Problems with current implementation:**
1. The resize handle is only a tiny corner button — users can't find it
2. No visual grid overlay to show drop zones or alignment
3. No preview mode — can't see what the layout looks like before saving
4. No ratio-based splitting (2:3, 1:3)
5. The grid itself is not scrollable when widgets overflow
6. The edit mode button is sometimes not visible due to CSS issues
7. No keyboard-accessible resize

---

## 4. CURRENT IMPLEMENTATION — WidgetCard.tsx (key sections)

### File: `src/components/dashboard/WidgetCard.tsx` (273 lines)

```tsx
export function WidgetCard({
  widgetId, title, icon: Icon, accent = 'var(--page-accent)',
  kicker, description, collapsible = false, removable = false,
  draggable = false, hidden = false, onToggleVisibility, onRemove,
  children, loading = false, error = false, errorMessage,
  empty = false, emptyMessage, emptyIcon, footer, className = '',
}: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  // Four states: loading, error, empty, populated
  // Uses shadcn-style Card primitives re-skinned to LAMINAR tokens
}
```

---

## 5. CURRENT IMPLEMENTATION — DeskFlowCard.tsx

### File: `src/components/dashboard/DeskFlowCard.tsx` (122 lines)

```tsx
export function DeskFlowCard({
  variant = 'default', accent = 'pink', title, description,
  headerAction, footer, children, className = '', noMotion = false,
}: DeskFlowCardProps) {
  // L2 Responsive motion: hoverLift, hoverGlow
  // Uses framer-motion with cubic-bezier easing
  // Anti-slop: no spring, no glassmorphism on chrome
}
```

---

## 6. CURRENT IMPLEMENTATION — CardLibrary.tsx

### File: `src/components/dashboard/CardLibrary.tsx` (1330 lines)

This is the full customization UI with:
- Browse/add/remove widgets
- Size presets (1x1 through 6x3)
- Preview functionality
- Save/load presets
- Category filtering
- Search

Key size presets:
```typescript
const SIZE_PRESETS: WidgetSize[] = [
  { cols: 1, rows: 1 }, { cols: 2, rows: 1 }, { cols: 3, rows: 1 },
  { cols: 4, rows: 1 }, { cols: 6, rows: 1 },
  { cols: 1, rows: 2 }, { cols: 2, rows: 2 }, { cols: 3, rows: 2 },
  { cols: 1, rows: 3 }, { cols: 2, rows: 3 },
];
```

---

## 7. DESIGN TOKENS (from `src/index.css`)

```css
--ws-surface: #09090b;
--ws-surface-raised: #18181b;
--ws-border: rgb(39 39 42 / 0.6);
--ws-border-strong: rgb(63 63 70 / 0.6);
--ws-accent: #06b6d4;
--ws-radius-card: 0.5rem;
--ws-dur: 150ms;
--ws-ease: cubic-bezier(0.2, 0, 0, 1);

--color-clay-400: #e8866b;
--color-amber-400: #fbbf24;
--color-sage-400: #6fb38f;
--color-sky-400: #5ab0c9;

--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", monospace;
--font-display: "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### LAMINAR Design Constitution (`design/design.md`):
- **§1**: Tokens from `src/index.css`, no ad-hoc hex in components
- **§2**: Monochrome zinc base + single signal hue per surface
- **§3**: Inter (UI), Space Grotesk (display), JetBrains Mono (numeric)
- **§4**: Radii: 8px (sm), 12px (card max), 9999px (pill) — max rounded-xl
- **§5**: Categorical colors from `src/lib/CategoryColors.ts`
- **§6**: Motion: cubic-bezier easing, no spring/bounce, 150-400ms
- **§7**: Anti-slop blacklist: no decorative gradients, no more than one signal hue, no backdrop-blur on chrome, no spring/bounce, no emoji icons, no neon glow, no raw hex in tsx
- **§8**: Per-page accent via `data-page` attribute
- **§10**: Pre-task checklist — tokens present, single signal hue, etc.

---

## 8. WIDGET THEME MAP (`src/components/dashboard/widgetTheme.ts`)

```typescript
export interface WidgetTheme {
  kicker: string;     // Eyebrow label (e.g. "TODAY", "SCHEDULE")
  accent: string;     // Accent token ref
  tint: string;       // Soft tint token ref
  detailRoute: string; // Full-page route
  detailLabel: string;
}

const PAGE = 'var(--page-accent)';
// 16 widgets defined: status-band, schedule-hero, insight-strip,
// goals-card, deadlines-card, focus-card, tier-breakdown,
// pinned-activities, productivity-chart, sleep-bar, mastery-ring,
// app-ecosystem, activity-feed, momentum-hero, follow-through, vcalendar
```

---

## 9. STATE MANAGEMENT

### `src/components/dashboard/DashboardContext.tsx`
- React Context providing `DashboardData` to all widgets
- No external state management library (plain React Context)

### Layout persistence (WidgetGrid.tsx):
```typescript
const LAYOUT_KEY = 'dashboard_layout';
const PRESETS_KEY = 'dashboard_widget_presets';

async function loadStoredLayout(): Promise<DashboardLayoutConfig> {
  const api = (window as any).deskflowAPI;
  if (api?.getPreferences) {
    const prefs = await api.getPreferences();
    const stored = prefs?.[LAYOUT_KEY];
    if (stored?.schemaVersion === DEFAULT_LAYOUT.schemaVersion) return stored;
  }
  return readLocal<DashboardLayoutConfig>(LAYOUT_KEY) ?? DEFAULT_LAYOUT;
}

async function persistLayout(layout: DashboardLayoutConfig): Promise<void> {
  writeLocal(LAYOUT_KEY, layout);
  await (window as any).deskflowAPI?.setPreference?.(LAYOUT_KEY, layout);
}
```

---

## 10. DESIGN SYSTEM REFERENCE

### `src/components/dashboard/DeskFlowCard.tsx` (motion patterns):
```typescript
const hoverLift = {
  whileHover: { y: -2, scale: 1.005, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
};
const hoverGlow = {
  whileHover: {
    boxShadow: "0 0 20px rgba(244, 63, 94, 0.12), 0 0 60px rgba(244, 63, 94, 0.06)",
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
};
```

### Available MCP components for the redesign:
| Component | Source | Use for |
|-----------|--------|---------|
| Card | shadcn | Standard UI cards |
| Dialog | shadcn | Layout settings modal |
| Slider | shadcn | Column/row count controls |
| ToggleGroup | shadcn | Ratio preset selection |
| ResizeHandle | shadcn | Widget resize grip |
| Animated Beam | Magic UI | Visual connector between split areas |
| Border Beam | Magic UI | Edit mode border glow |
| Grid Pattern | Magic UI | Background grid overlay |
| GripVertical | Lucide | Drag handle icon |
| Columns3 | Lucide | Column layout icon |
| Rows3 | Lucide | Row layout icon |
| Eye | Lucide | Preview toggle icon |
| LayoutDashboard | Lucide | Layout overview icon |
| Maximize2 | Lucide | Expand widget icon |
| Minimize2 | Lucide | Collapse widget icon |
| Split | Lucide (if available) | Split ratio icon |

---

## 11. KEY ISSUES TO FIX

1. **No Edit Button**: The edit button exists in code but may not render properly due to CSS z-index or overflow issues
2. **Not Scrollable**: The grid container needs `overflow-auto` when widgets exceed viewport
3. **No Visual Grid Overlay**: Need a CSS grid overlay showing cell boundaries in edit mode
4. **No Ratio Splitting**: Need to add split controls (2:3, 1:3, etc.) that visually divide a widget
5. **No Live Preview**: Need a toggle that shows the dashboard as it would look without edit controls
6. **Resize Handle is Tiny**: Need larger, more visible resize handles on all edges/corners
7. **No Keyboard Resize**: Need arrow-key + shift for resize when widget is focused
8. **CSS Overflow Issues**: The grid container and its parent may have overflow:hidden

---

## 12. BACKEND VERIFICATION

All layout features are **purely frontend** (localStorage + IPC preferences):
- `deskflowAPI.getPreferences` / `deskflowAPI.setPreference` — exist in preload.ts and main.ts
- No DB schema changes needed
- No new IPC channels needed
- Layout data is JSON stored in user preferences
- **Status: ✅ UI-only, no backend gaps**

---

## 13. DESIGN TOKENS FOR THE NEW EDITOR

### Grid overlay (edit mode):
```css
.grid-overlay {
  background-image: 
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: calc(100% / var(--columns)) 180px;
}
```

### Drag resize handle (improved):
```css
.resize-handle {
  cursor: se-resize;
  /* Larger hit area */
  padding: 8px;
  /* Visual indicator */
  border: 1px dashed var(--page-accent);
  border-radius: 8px;
  opacity: 0;
  transition: opacity 150ms;
}
.widget:hover .resize-handle,
.widget:focus .resize-handle {
  opacity: 1;
}
```

### Split mode overlay:
```css
.split-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  gap: 4px;
  pointer-events: none;
}
.split-overlay > div {
  pointer-events: auto;
  border: 2px dashed var(--page-accent);
  border-radius: 8px;
  background: rgba(6, 182, 212, 0.05);
}
```

---

## 14. IPC ENDPOINTS (existing, no changes needed)

```
deskflowAPI.getPreferences() → { [key: string]: any }
deskflowAPI.setPreference(key: string, value: any) → void
```

These are already wired in `src/preload.ts` and `src/main.ts`. No new channels needed.

---

## 15. CURRENT FILE STRUCTURE

```
src/components/dashboard/
├── WidgetGrid.tsx          ← Main layout grid (865 lines, needs redesign)
├── WidgetCard.tsx          ← Individual widget card (273 lines)
├── WidgetRegistry.ts       ← Widget definitions + layout config (151 lines)
├── DashboardContext.tsx    ← React context for dashboard data (105 lines)
├── widgetTheme.ts          ← Per-widget theme map (149 lines)
├── DeskFlowCard.tsx        ← Newer card component with motion (122 lines)
├── CardLibrary.tsx         ← Full customization UI (1330 lines)
├── useDashboardData.ts     ← Data fetching hook
├── types.ts                ← Shared types (115 lines)
├── registerWidgets.ts      ← Widget registration
└── ... (many card components)
src/pages/DashboardPage.tsx  ← Main page (1180+ lines)
design/design.md            ← LAMINAR constitution (108 lines)
src/index.css               ← All design tokens (979 lines)
```


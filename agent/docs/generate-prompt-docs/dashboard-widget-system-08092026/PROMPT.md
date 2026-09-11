# PROMPT.md — Dashboard Widget System Revamp (AMENDED)

> Generated: 2026-09-08 · Amended: 2026-09-08 (W-1–W-10)
> Constitution: `design/design.md` (LAMINAR) wins over all skill defaults
> Phasing: WS-1 → WS-2 → WS-3

---

## Raw Request (Verbatim)

The user wants to revamp the dashboard widget system with the following requirements:

1. **Dynamic widget system** — Every feature across ALL pages should have a widget/card representation on the dashboard. Users should be able to:
   - Adjust how many widgets show (1-5 columns, 1-3 rows)
   - Toggle widget visibility on/off
   - Drag and rearrange widgets
   - Enter edit mode to configure layout
   - Adjust vertical and horizontal splits

2. **Systematized process** — Create a widget registry/factory system so adding new widgets is efficient.

3. **Every page as widget candidate** — Go through every page and identify features that could become dashboard widgets.

4. **Layout flexibility** — User selects columns (1-5), rows, split type (vertical/horizontal), and can drag to rearrange.

5. **Use ALL design skills and MCP components** — Pull real components from shadcn, Magic UI, Lucide, React Bits MCPs.

---

## Context Reference

`CONTEXT_BUNDLE.md` is the source of truth. Read it first.

---

## Design Intent

### Question 1: What skills did you use and why?
All 8 mandatory design skills + generate-prompt. **BUT** design.md (LAMINAR constitution) wins over all skill defaults. Every conflict logged.

### Question 2: What is the design idea?
**"Command Deck"** — A modular, Lego-like dashboard where every feature is a snap-in widget. Like a developer's custom toolbar.

### Question 3: What is the meaning of the design?
The dashboard is the user's **personalized workspace**. Widgets represent every tracked dimension of their digital life. Rearrange = control. Toggle visibility = focus.

### Question 4: Is the design intentional and fitting?
Yes. RHEO is a productivity tracking tool for developers. Modular dashboard fits developer-tool aesthetic. **BUT** must follow LAMINAR constitution: no glassmorphism, no spring, no decorative gradients, token-only colors.

---

## AMENDMENTS W-1–W-10 (BIND BEFORE EXECUTION)

### A. LAYER 0
- Tokens quoted verbatim from `src/index.css`. Token roles referenced by name, never hex.
- Color law: ONE signal hue per surface. amber/pink/cyan/emerald/rose only.
- Radii: 8px/12px/9999px only. No rounded-2xl/3xl.
- Motion: useSpring only, no bare spring(). No decorative infinite loops.

### B. MOTION SPEC
- Entrance: opacity 0→1 + translateY 16→0, 220ms, stagger 45ms
- Hover: border-color/bg shift 140ms
- NO whileHover scale, NO translateY(-2px) lift without border emphasis
- Drag: hairline emphasis + border elevation, 140ms; drop = FLIP via layout prop
- Edit mode: AnimatePresence, 140–180ms
- NumberTicker: ONLY where value changes on data refresh
- RM: entrance and drag-layout snap; edit mode fully usable without motion

### C. PERSISTENCE
- Preference store, single source: `setPreference('dashboard_layout', config)`
- No localStorage. Preload bridge follows existing pattern.
- schemaVersion for migrations.

### D. WIDGET CATALOG DISPOSITIONS
- VCalendar widget: KEPT (verified real — react-day-picker)
- Settings-page trio: REJECTED (config not data)
- Component-local-state widgets: FROZEN until data lift

### E. DATA CONNECTOR LAW
- Widget binds to exactly ONE declared data hook/IPC channel
- No widget imports another page's component
- 4-state matrix per widget — empty ≠ zero

### F. DEFAULTS = TODAY
- Default preset reproduces current dashboard layout 1:1
- Zero visual change until user enters edit mode
- Regression guard: default-layout screenshots must match pre-revamp

### G. VERIFICATION LAW
- G1: tsc zero outside docs/debt.md
- G2: clean rebuild — delete dist/ FIRST
- G3: shell-launch (xvfb on Linux) — default layout renders, edit mode works
- G4: keyboard equivalent for every drag/resize/visibility op
- G5: console clean
- G6: screenshots — default parity, edit mode, RM, 375/1280/1920
- G7: commit per phase

### H. PHASES
- **WS-1**: registry + WidgetGrid + WidgetCard + edit mode + persistence + 16 existing dashboard widgets (default parity)
- **WS-2**: cross-page data widgets + factory script
- **WS-3**: "needs lift" appendix items

### I. SLOP BANS
- NeonGradientCard, AuroraText, BorderBeam, MagicCard — BANNED
- Any backdrop-blur — BANNED
- Any box-shadow elevation — BANNED
- Spring physics — BANNED
- Icons: lucide only
- RHEO naming everywhere

### J. BUNDLE HYGIENE
- Real wc -l reported in CONTEXT_BUNDLE.md
- Code wins over bundle metadata

---

## Task: Generate Complete Widget System

### Phase 1: Widget Registry & Data Layer

1. **WidgetConfig interface**:
```typescript
interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  icon: string;           // lucide icon name
  category: string;
  defaultSize: { cols: number; rows: number };
  minSize: { cols: number; rows: number };
  maxSize: { cols: number; rows: number };
  component: React.ComponentType<WidgetProps>;
  dataHook: string;       // which hook/IPC provides data
  pageSize?: string;
  defaultVisible: boolean;
}
```

2. **WidgetRegistry class** — singleton with register/unregister/get/getAll/getByPage/getVisible

3. **Widget data connectors** — Map each widget to its data source (IPC/hooks only, no component-local state)

### Phase 2: Widget Grid & Layout Engine

1. **Responsive grid** — CSS Grid with configurable columns (1-5) and rows
2. **UserLayoutConfig**:
```typescript
interface UserLayoutConfig {
  schemaVersion: number;
  columns: number;
  rows: number;
  splitType: 'vertical' | 'horizontal';
  widgetOrder: string[];
  widgetVisibility: Record<string, boolean>;
  gridPositions: Record<string, { col: number; row: number; colSpan: number; rowSpan: number }>;
}
```
3. **Drag-and-drop** — motion/react `layout` prop for FLIP animations
4. **Resize handles** — CSS-based (not JS-measured)
5. **Split controls** — Toggle between vertical and horizontal
6. **Edit mode toggle** — Shows drag handles, resize handles, visibility toggles, add-remove panel

### Phase 3: Widget Card Component

```tsx
interface WidgetCardProps {
  widgetId: string;
  title: string;
  icon: LucideIcon;
  accent: string;           // --page-accent or semantic color
  collapsible?: boolean;
  removable?: boolean;
  draggable?: boolean;
  children: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}
```

All 4 states (Empty/Loading/Error/Populated) per Human-Centric UX skill.

### Phase 4: Animation & Motion (L2)

- Widget entrance: opacity + translateY, 220ms, stagger 45ms
- Drag: border emphasis, 140ms
- Drop: FLIP via layout prop
- Edit mode: AnimatePresence, 140–180ms
- Hover: border-color shift, 140ms
- NO scale, NO spring, NO blur

### Phase 5: Edit Mode UI

1. **Top bar** — Edit mode banner, column selector (1-5), row selector (1-3), split toggle
2. **Widget handles** — Drag handle (6-dot icon), eye icon (visibility), X icon (remove)
3. **Add widget panel** — Slide-in panel with available widgets
4. **Layout preview** — Mini grid preview

### Phase 6: Widget Factory Script

`scripts/create-widget.ts` — Takes widget name, page, data source. Generates boilerplate.

---

## Output Requirements

RESULT.md must contain:
1. Widget Registry — Full TypeScript code
2. Widget Grid — Full React component with drag, resize, edit mode
3. Widget Card — Reusable card with all 4 states
4. Widget Factory Script
5. All Widget Candidates — Complete table with dispositions
6. Edit Mode UI — Full specification
7. Layout Persistence — Preference store schema
8. Animation Spec — L2 motion details
9. File Changes — Exact files to create/modify
10. Empty/Loading/Error States — For every widget
11. Anti-Slop verification — Self-check against §7 blacklist

---

## Constraints

- Must NOT modify OrbitSystem.tsx, BorderBeam.tsx, AuroraText.tsx, NumberTicker.tsx, AnimatedCircularProgressBar.tsx, BlurFade.tsx, Skeleton.tsx
- Must NOT touch dashboard sub-component internals
- Must NOT touch DashboardPage.tsx data-fetching layer
- New system is additive — wrap existing components, not replace
- motion/react for all animations
- Tailwind CSS v4 syntax
- `node scripts/build.mjs` for verification
- design.md wins over all skill defaults

---

*End of Amended Prompt*

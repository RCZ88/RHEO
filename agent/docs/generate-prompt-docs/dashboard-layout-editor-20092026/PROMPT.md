# Dashboard Layout Editor Redesign — Prompt

> **Prompt Type:** design
> **Target AI:** claude
> **Detail Level:** 10 (exhaustive)
> **Creativity:** 30 (guided but creative)
> **Tone:** Direct, mandate-style. No menu of options.

---

## Raw Request (VERBATIM — do not rephrase)

> the cards setup on teh dashbaord he setting of hte layout and liek the options of cards and everything is really bad. i wnat you to focus on the LAYOUT MANAGEING AND THE VIEWING PREVIEW OF TEH RESULT OF HTE LAYOUT. MAKE SURE THERES LIKE A CUTE LITTLE FUCKING LAYOUT THAT CAN BE DRAGGED AND AJUDST USING MOUSE DRAGGIN SO THAT IT FITS INTO FOR EXMAAMPLE A 2:3 1:3 ratio split and stuff, adn the hegith and so one. AND TEHre SHOULD BE AP REVIEW ONW HGAT THAT DAHSBOARD LOOKS LIKE. IT SHOULD BE CUSTOMIZABLE. THE UI SHOULD BECUSTOM. THE CURRENT DEISGN SETUP IS SHIT AND AI SLOP. USE THE GENERATE PROMPT SKILL n all of ur skills frontend skills including the new skills: animation stack, ui and charts skill ui ux pro max, humancentric ui, MCPS and veryhting @agent/skills/generate-prompt/

**Specific requirements extracted from the raw request:**
1. **Layout Managing** — Drag-and-drop layout editor where users can drag edges/corners to resize widgets
2. **Ratio Splitting** — Support 2:3, 1:3, and other ratio splits (widget can be split into sub-sections)
3. **Height/Width Adjustment** — Drag to adjust height and width of any widget
4. **Preview Mode** — A toggle/button that shows what the dashboard LOOKS LIKE as it would appear (not edit mode, just the final result)
5. **Customizable UI** — The entire layout editor should be customizable, not a generic template
6. **NOT AI SLOP** — Follow the LAMINAR design constitution strictly. No generic AI-generated UI.
7. **ALL Design Skills** — Use: frontend-external-infra, frontend-design, Human-Centric UX, Impeccable, Motion, Design Taste System, UI UX Pro Max, Taste Skill, animation-stack, ui-and-charts

---

## Context Bundle Reference

The full code context is in `CONTEXT_BUNDLE.md` in the same directory. Key files:
- `src/components/dashboard/WidgetGrid.tsx` — The layout grid (865 lines, needs redesign)
- `src/components/dashboard/WidgetCard.tsx` — Individual widget card (273 lines)
- `src/components/dashboard/WidgetRegistry.ts` — Layout config and registry (151 lines)
- `src/components/dashboard/CardLibrary.tsx` — Full customization UI (1330 lines)
- `src/pages/DashboardPage.tsx` — Main dashboard page (1180+ lines)
- `src/index.css` — All design tokens
- `design/design.md` — LAMINAR design constitution

---

## Problem Statement

The current dashboard layout management is broken and feels like AI slop:
- No edit button visible (THE RES NO EDIT BUTTON)
- The grid is not scrollable when widgets overflow
- The resize handle is a tiny corner button that's hard to find
- No visual grid overlay showing drop zones
- No live preview of what the dashboard looks like
- No ratio-based splitting (2:3, 1:3, etc.)
- The entire UX feels cheap and non-functional

---

## The Mandate

**Design a comprehensive Dashboard Layout Editor** that includes:

### A. Layout Manager (Edit Mode)
1. **Visual Grid Overlay** — When in edit mode, show a CSS grid overlay with cell boundaries. Each cell should be clearly delineated. Use `rgba(6, 182, 212, 0.08)` for the grid lines.
2. **Drag-to-Resize** — Widgets should be resizable by dragging any edge or corner, not just a tiny corner button. The resize handle should appear on hover/focus and span the full edge. Use a 8px grip area minimum.
3. **Ratio Splitting** — Click a widget to enter "split mode" which divides it into a grid overlay showing 2:3, 1:3, 1:2, etc. ratio options. Click a split region to apply it. The split should visually divide the widget with dashed borders.
4. **Column/Row Controls** — A clean control panel to set columns (4, 6, 8, 12) and rows. Use shadcn Slider or ToggleGroup.
5. **Widget Reordering** — Drag widgets to reorder them in the grid. Use HTML5 drag-and-drop or `@dnd-kit/core`.
6. **Keyboard Navigation** — Arrow keys to move widgets, Shift+Arrow to resize, Escape to cancel.
7. **Scrollable Grid** — The grid container MUST be scrollable (`overflow-auto`) when widgets exceed the viewport.

### B. Live Preview Mode
1. **Preview Toggle** — A toggle button (eye icon) that switches between Edit Mode and Preview Mode.
2. **Preview Mode** — Shows the dashboard exactly as it would look to the user. No edit controls, no grid overlay, no resize handles. Just the clean dashboard.
3. **Preview Transition** — Smooth 200ms transition between edit and preview modes. Use `cubic-bezier(0.16, 1, 0.3, 1)`.
4. **Preview Settings** — In preview mode, show a small settings gear that opens the layout editor (back to edit mode).

### C. Layout Presets
1. **Named Presets** — Save/load named layout configurations (deck names).
2. **Ratio Presets** — One-click ratio layouts: "2:3 Split", "1:3 Split", "Equal Grid", "Wide Left", "Wide Right", "Tall Top", "Tall Bottom".
3. **Reset to Default** — One-click reset to the default layout.

### D. Customization UI
1. **Widget Library** — Browse all available widgets, toggle visibility, add/remove.
2. **Widget Sizing** — Quick-size buttons for common sizes (1x1, 2x1, 3x2, etc.).
3. **Appearance** — Card theme options (accent color, opacity, border style).
4. **The entire UI must be customizable** — users should be able to change the layout editor's own appearance (dark/light, accent color, density).

---

## Engineering Task

1. **Redesign `WidgetGrid.tsx`** — Replace the current layout grid with a proper visual editor
2. **Add `LayoutPreview.tsx`** — A new component for preview mode (or integrate into WidgetGrid)
3. **Add `SplitOverlay.tsx`** — A visual overlay for ratio splitting
4. **Update CSS** — Add grid overlay styles, resize handle styles, split mode styles to `src/index.css` or a new `src/components/dashboard/layout-editor.css`
5. **Fix scrollability** — Ensure the grid container is scrollable
6. **Fix edit button visibility** — Ensure the edit button is always visible and properly styled
7. **Add `@dnd-kit/core` or use HTML5 DnD** — For drag-to-reorder

**Backend:** Purely frontend (localStorage + IPC preferences). No new IPC channels needed. `deskflowAPI.getPreferences` / `deskflowAPI.setPreference` already exist.

---

## Design Task — Visual Specs

### Color System (LAMINAR)
- Background: `var(--ws-surface)` = `#09090b`
- Card: `var(--ws-surface-raised)` = `#18181b`
- Border: `var(--ws-border)` = `rgba(39, 39, 42, 0.6)`
- Accent: `var(--page-accent)` = pink-500 / cyan-400 depending on page
- Grid overlay lines: `rgba(6, 182, 212, 0.08)` (cyan tint)
- Resize handle: `var(--page-accent)` with `border: 1px dashed`
- Split overlay: `rgba(6, 182, 212, 0.05)` background with dashed borders

### Typography
- Display: Space Grotesk for headers/labels
- UI: Inter for body text
- Mono: JetBrains Mono for numbers and labels
- Max 2 font families per view

### Spacing
- 8px grid base
- Padding: p-4 (16px) for cards, p-5 for card content
- Gap: gap-4 (16px) between grid items
- Border radius: rounded-xl (12px) max, never rounded-2xl+

### Motion
- Edit mode transitions: `cubic-bezier(0.16, 1, 0.3, 1)`, 200ms
- Preview transition: same easing, 200ms
- No spring physics, no bounce
- Honor `prefers-reduced-motion`

### Anti-Slop Rules (MANDATORY)
- No decorative gradients as ornament
- No more than one signal hue per surface
- No backdrop-blur glassmorphism on chrome
- No spring/bounce motion
- No emoji as icons
- No neon glow
- No raw hex/rgba in tsx (use tokens / var())
- No per-component bespoke shadow/radius/border
- Lucide icons only
- Max rounded-xl, p-5 padding

---

## UX Task — Interaction Flow

### Entering Edit Mode
1. User clicks "Edit Deck" button → Edit mode activates
2. Grid overlay fades in over 200ms
3. Resize handles appear on all widget edges
4. A toolbar appears above the grid with column/row controls, add widget, presets, reset

### Resizing a Widget
1. User hovers over a widget edge → resize handle appears (8px grip area)
2. User mousedown on resize handle → cursor changes to `nwse-resize`
3. User drags → widget size changes in real-time with grid snap
4. User mouseup → resize ends, layout saved to local state
5. Visual feedback: widget border glows during resize

### Splitting a Widget
1. User double-clicks or clicks a split button on a widget → split mode activates
2. Widget divides into 2 or 3 sections with dashed borders
3. Ratio options appear as small buttons (2:3, 1:3, 1:1, etc.)
4. User clicks a ratio → widget splits accordingly
5. User can adjust each section independently
6. Click outside to exit split mode

### Preview Mode
1. User clicks "Preview" (eye icon) → Preview mode activates
2. All edit controls fade out over 200ms
3. Grid overlay disappears
4. Dashboard appears clean and polished as it would look to users
5. Small settings gear in corner opens layout editor

### Keyboard Shortcuts
- `Ctrl+E` or click Edit → Toggle edit mode
- `Ctrl+P` or click Preview → Toggle preview mode
- `Escape` → Exit edit/split mode
- `Arrow keys` (in edit mode) → Move focused widget
- `Shift+Arrow` → Resize focused widget
- `Ctrl+S` → Save layout

---

## Constraints

1. **Keep all existing TypeScript types and interfaces unchanged** — `DashboardLayoutConfig`, `WidgetConfig`, `WidgetSize`, etc.
2. **Keep all existing IPC handlers and data flow unchanged** — This is a visual-only redesign
3. **Keep the `--dk-*` and `--ws-*` token naming convention** — Add new tokens only if needed
4. **Keep the 12-column grid system** — Don't change the fundamental grid structure
5. **Keep the `WidgetCard` 4-state pattern** (loading/error/empty/populated)
6. **Don't add new npm dependencies** that aren't already installed or easily available. `framer-motion` is available. `lucide-react` is available. `shadcn/ui` components are available.
7. **Preserve all existing component file paths** — Don't rename existing files without updating imports
8. **Dark mode only** — No light mode support needed
9. **Scrollable grid** — Must be scrollable when content exceeds viewport
10. **Edit button must be visible** — Fix the CSS issue causing the edit button to not render

---

## MCP Component Inventory

### shadcn MCP — Available Components
- `Card` — Standard card container
- `Dialog` — Modal for layout settings
- `Slider` — Column/row count slider
- `ToggleGroup` — Ratio preset selection
- `Button` — All interactive buttons
- `Input` — Preset name input
- `Select` — Dropdown menus
- `Switch` — Toggle switches
- `Tooltip` — Hover hints for resize handles
- `Popover` — Floating panels
- `Sheet` — Slide-out panels for widget library
- `Tabs` — Tab navigation in settings
- `Separator` — Visual dividers

### Magic UI MCP — Available Components
- `Animated Beam` — Visual connector between split areas
- `Border Beam` — Edit mode border glow effect
- `Grid Pattern` — Background grid overlay pattern
- `Particles` — Subtle background particles (optional)
- `Number Ticker` — For statistics display
- `Marquee` — Scrolling text for headers

### Lucide MCP — Icons
- `GripVertical` — Drag handle
- `Columns3` — Column layout icon
- `Rows3` — Row layout icon
- `Eye` — Preview toggle
- `LayoutDashboard` — Layout overview
- `Maximize2` — Expand widget
- `Minimize2` — Collapse widget
- `Split` — Split ratio icon (if available)
- `Settings2` — Settings gear
- `RotateCcw` — Reset button
- `Save` — Save button
- `Plus` — Add widget
- `X` — Close/remove
- `Check` — Confirm
- `ChevronDown` — Dropdown chevron
- `Trash2` — Delete preset

### React Bits MCP — 135+ animated components
- Available for drag-and-drop animations, hover effects
- Specifically useful for: `splash-cursor`, `pixel-card`, grid animations

---

## Output Format

Return your changes as:

1. **A summary** (3-5 sentences) describing the design direction and why
2. **Complete updated files** — Full file replacements for:
   - `src/components/dashboard/WidgetGrid.tsx`
   - `src/components/dashboard/LayoutPreview.tsx` (new)
   - `src/components/dashboard/SplitOverlay.tsx` (new)
   - `src/components/dashboard/LayoutEditorToolbar.tsx` (new)
   - Any CSS file changes
3. **New CSS classes** you introduced and what they do
4. **A list of all interactive elements** and their keyboard handlers
5. **The complete component tree** showing how the new components relate

---

## Lead Role

You are the **Lead Designer and Engineer**. Own the entire solution from logic to pixels. The output must be production-ready code that follows the LAMINAR constitution exactly.

---

## Additional Skills Reference

This prompt was generated with guidance from:
- **Frontend Design** — DeskFlow component patterns, tokens, spacing
- **Human-Centric UX** — All 4 states (empty/loading/error/populated), progressive disclosure, visual hierarchy, state coverage, feedback, forgiveness
- **Impeccable** — 7 domains (typography, color, spatial, motion, interaction, responsive, UX writing), 27 anti-patterns
- **Motion — Bring the UI Alive** — L2 Responsive motion, motion taxonomy, reduced-motion fallback
- **UI UX Pro Max** — Developer tools industry rules, style library
- **Design Taste System** — Variance knobs, aesthetic matrix, anti-repetition rules
- **frontend-external-infra** — Source routing, anti-slop checklist, MCP component inventory
- **animation-stack** — Animation engine selection
- **ui-and-charts** — UI components, chart integration

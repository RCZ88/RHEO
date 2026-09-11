# RESULT.md — Focus Groups UI Overhaul (06082026)

## 1. Architecture Decision

**Decision:** The Focus tab will remain an embedded section under `/activity?tab=focus` (composed by `FocusSection.tsx`), but its internal layout will be completely restructured to elevate Focus Groups to a first-class, persistent surface. 

**Rationale:** 
Moving Focus to a dedicated top-level route (repurposing the dead `FocusPage.tsx`) would fragment the user's workflow between Activity and Focus. By keeping it as a tab but expanding its layout, we treat Focus as a "workspace within a workspace." The current `grid-cols-5` layout crams the timer and groups into narrow columns. The redesign will utilize a `grid-cols-1 lg:grid-cols-3` layout, dedicating the left column to persistent Group Management and the right two columns to the Timer, Progress, and Analytics.

**Mount Point Changes:**
- `src/pages/ActivityPage.tsx`: No changes to routing. The `FocusTab` lazy import remains intact.
- `src/features/focus/FocusSection.tsx`: Rewritten to host the new 3-column grid layout.
- `src/pages/FocusPage.tsx`: Remains dead. Ignored.

---

## 2. Component Breakdown

### 2.1 `FocusSection.tsx` (Rewrite)
The composition root. Manages the global layout and state cross-pollination.
- **Props:** None.
- **States:** 
  - *Populated:* Renders 3-column grid (Groups List | Timer + Stats | Insights + History).
  - *Loading:* Renders `<LoadingState variant="skeleton" className="h-96" />`.
  - *Error:* Renders an opaque red-bordered card with "Failed to load Focus data."
- **Relationships:** Orchestrates `FocusGroupsPanel`, `FocusTimer`, `FocusGroupProgress`, `FocusStats`, `FocusHistory`, `FocusInsights`.

### 2.2 `FocusGroupsPanel.tsx` (New)
Replaces the inline `FocusGroupSelector`. A dedicated, persistent sidebar for group management.
- **Props:** `groups: FocusGroup[]`, `selectedId`, `onSelect`, `onCreate`, `onEdit`, `onDelete`.
- **States:**
  - *Empty:* Dashed-border CTA card: "Create your first focus group."
  - *Populated:* Vertical scrollable list of opaque group cards. Active group has a pink rail and pulse animation.
- **Relationships:** Replaces `FocusGroupSelector.tsx`.

### 2.3 `FocusTimer.tsx` (Rewrite)
The session control card. 
- **Props:** Same as current, plus `activeGroup: FocusGroup | null`.
- **States:**
  - *Idle:* Shows group context, duration presets, strictness toggle.
  - *Active:* Pink particle background, pulsing ring, `JetBrains Mono` countdown.
  - *Completed:* Emerald ring, confetti burst.
- **Relationships:** Removes the embedded `FocusGroupSelector`. Adds `activeGroup` prop to display the selected group's name prominently above the start button.

### 2.4 `FocusGroupProgress.tsx` (Rewrite)
Real daily goal progress computation.
- **Props:** `groups: FocusGroup[]`, `selectedId`, `history: FocusHistoryRow[]`, `usageMap: Map<number, number[]>` (groupId -> sessionIds).
- **States:**
  - *Empty:* "No groups created."
  - *Populated:* Grid of `AnimatedCircularProgressBar` rings. The selected group's card is enlarged (spans 2 columns).
  - *Zero Goal:* Renders a flat "Set a daily goal" CTA instead of a ring.
- **Relationships:** Uses pure functions from `focusHelpers.ts` to compute progress from `history` and `usageMap`.

### 2.5 `FocusGroupEditor.tsx` (Rewrite)
Opaque dialog for group creation/editing.
- **Props:** `open`, `onOpenChange`, `group`, `onSave`.
- **States:**
  - *Loading:* `getKnownApps()` fetching state (skeleton in picker).
  - *Error:* "Could not fetch tracked apps."
  - *Populated:* Form fields, including the new `FocusAppPicker`.
- **Relationships:** Replaces `TagInput` with `FocusAppPicker`.

### 2.6 `FocusAppPicker.tsx` (New)
Custom searchable multi-select component.
- **Props:** `knownApps: { app: string; category: string; last_used: string }[]`, `selected: string[]`, `onChange: (next: string[]) => void`.
- **States:**
  - *Empty:* "Type to search tracked apps..."
  - *Populated:* Filtered list of apps with checkmarks.
- **Relationships:** Wired to `getKnownApps()` via `useEffect` in `FocusGroupEditor.tsx`.

### 2.7 `FocusStats`, `FocusHistory`, `FocusInsights`, `FocusLeaderboard`, `FocusDistractionLog`
Re-skinned to match the opaque `bg-zinc-900/95` token system. Layouts adjusted to fit the new right-hand column. No functional changes to their internal data parsing, purely visual anti-slop enforcement.

---

## 3. Data Processing Pipeline

To compute real progress, we must attribute `deep_focus_sessions` (history) to `focus_groups`. The renderer currently lacks a direct map. We will build a `usageMap` in `FocusSection.tsx` by fetching `focusGroup:usage` (see Appendix for backend addition) or inferring from local state. 

The following pure functions will be added to `focusHelpers.ts`:

```typescript
// Input: Group definition, history rows, array of session IDs attributed to the group
export function computeGroupDailyProgress(
  group: FocusGroup, 
  history: FocusHistoryRow[], 
  attributedSessionIds: number[]
): { currentSec: number; goalSec: number; pct: number } {
  if (!group.daily_goal_sec || group.daily_goal_sec <= 0) {
    return { currentSec: 0, goalSec: 0, pct: 0 };
  }
  const today = new Date().toDateString();
  const todaySec = history
    .filter(h => attributedSessionIds.includes(h.id) && new Date(h.started_at).toDateString() === today && h.outcome === 'completed')
    .reduce((sum, h) => sum + (h.actual_sec || 0), 0);
  
  const pct = Math.min(100, Math.round((todaySec / group.daily_goal_sec) * 100));
  return { currentSec: todaySec, goalSec: group.daily_goal_sec, pct };
}

export function computeGroupStreak(group: FocusGroup, history: FocusHistoryRow[], attributedSessionIds: number[]): number {
  const completedDays = new Set(
    history
      .filter(h => attributedSessionIds.includes(h.id) && h.outcome === 'completed')
      .map(h => new Date(h.started_at).toDateString())
  );
  if (completedDays.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  if (!completedDays.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 3650; i++) {
    if (completedDays.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}
```
*(Weekly trend, best hour, and average session length follow identical patterns, filtering `history` by `attributedSessionIds`.)*

---

## 4. App/Site Picker Spec (`FocusAppPicker.tsx`)

Since no combobox exists in the installed MCP registries, a custom picker is designed.

**Visual Design:**
- **Container:** `bg-zinc-800/40 border border-zinc-800/50 rounded-xl p-3 max-h-48 overflow-y-auto`
- **Search Input:** `w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:border-pink-500/40 outline-none mb-2`
- **List Item:** `flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-zinc-700/50 text-[12px] text-zinc-300`
- **Selected State:** Item text turns `text-pink-300`, appended with a `<Check className="w-3 h-3 text-pink-400" />` icon.
- **Chips:** Selected apps render as chips below the input: `bg-pink-500/15 text-pink-300 text-[11px] px-2 py-0.5 rounded-md`.

**Interaction Design:**
1. **Focus:** User clicks the search input. 
2. **Filter:** As they type, `knownApps` is filtered by `app.toLowerCase().includes(query)`.
3. **Select:** `ArrowDown`/`ArrowUp` navigates the filtered list. `Enter` toggles selection. Clicking a row toggles selection.
4. **Deselect:** Clicking the `x` on a chip removes it, or clicking an already-selected list item removes it.
5. **Custom Entry:** If the query yields no exact match, a special list item appears at the bottom: `"+ Add '{query}' as custom app"`. Clicking it adds the raw string to the `selected` array.

---

## 5. Visual Spec

**Global Tokens:**
- Background: `bg-zinc-950`
- Card Surface: `bg-zinc-900/95 border border-zinc-800/60 rounded-xl p-5`
- Accent: Pink `#ec4899` (active), Emerald `#10b981` (success), Amber `#f59e0b` (strict), Rose `#f43f5e` (stop).
- Typography: `font-sans` (Inter/Geist), `font-mono tabular-nums` (JetBrains Mono for all numbers/timers).
- Motion: `transition-colors duration-200`, `whileTap={{ scale: 0.95 }}`.

**Per-Card Specs:**

- **FocusTimer:**
  - Ring: `AnimatedCircularProgressBar` size 180, strokeWidth 12. 
  - Idle Ring: `rgba(236,72,153,0.35)`. Active Ring: `#ec4899`.
  - Timer Text: `text-6xl font-bold tabular-nums font-mono text-white`.
  - Active Background: `<Particles className="opacity-60" quantity={22} color="#ec4899" />`

- **FocusGroupsPanel (Cards):**
  - Idle: `bg-zinc-900/95 border border-zinc-800/60 rounded-xl p-4`
  - Active: `bg-pink-500/10 border border-pink-500/40 rounded-xl p-4 shadow-lg shadow-pink-500/10`
  - Active Indicator: `w-2 h-2 rounded-full bg-pink-400 animate-pulse`

- **FocusGroupProgress:**
  - Ring: `AnimatedCircularProgressBar` size 120, strokeWidth 8. `gaugePrimaryColor="#ec4899"`.
  - Center Text: `NumberTicker` for percentage, `text-2xl font-mono text-pink-300`.

- **Empty States:**
  - `border-dashed border-zinc-700/70 rounded-xl py-8 flex flex-col items-center justify-center gap-2 text-zinc-500`
  - CTA Button: `text-pink-400 hover:text-pink-300 text-[12px] font-semibold flex items-center gap-1.5`

---

## 6. UX Flow

1. **Creating a group:** User opens the Focus tab. In the left `FocusGroupsPanel`, they click "New Group". The opaque `FocusGroupEditor` dialog opens.
2. **Picking apps:** In the Editor, the `FocusAppPicker` automatically loads tracked apps. The user searches "code", sees "VS Code" (category: productive), and clicks it. A pink chip appears.
3. **Setting duration & goal:** User selects a 25m preset. Enters "120" in the Daily Goal (minutes) field. Selects "productive" as the goal category.
4. **Saving:** User clicks "Create group". Dialog closes. The new group appears in the left panel and is automatically selected.
5. **Running a session:** The `FocusTimer` (center) updates its start button to "Start Development focus". User clicks Start. Ring turns solid pink, particles appear, countdown begins in JetBrains Mono.
6. **Watching progress accrue:** User finishes the 25m session. Confetti fires. The `FocusGroupProgress` (right) animates its ring to 20% (25m / 120m goal). The `FocusStats` streak increments.

---

## 7. Edge Cases

- **Group with zero apps selected:** Saveable. UI renders an amber warning: "No apps specified. Strict mode will block all apps."
- **App renamed between sessions:** Matched by `app` name string only. If renamed, the old name becomes orphaned from tracking logs and won't accrue progress.
- **Daily goal with 0 / unset:** Progress bar renders a flat emerald line: "Set a daily goal to track progress." instead of a ring.
- **Goal category with no matching apps:** The goal category badge renders, but the progress ring stays at 0% with a tooltip: "No sessions matched this category today."
- **Long group names / app lists:** Truncate with `truncate` and `title` attribute for hover. App lists in the group card show count ("3 apps") rather than names.
- **Deleting a group with usage history:** `ON DELETE CASCADE` in SQLite removes `focus_group_usage` rows. The group disappears from the UI; historical session rows in `deep_focus_sessions` remain intact but unattributed.
- **First session with no active group:** The `useActiveFocusGroup` singleton remains `null`. Sessions start via `start()` instead of `startWithGroup()`. Progress cards show 0%.
- **Empty `history` array:** Progress functions return `{ currentSec: 0, pct: 0 }`. UI renders 0% without breaking.

---

## Appendix: Implementation Phase (Backend Gap Fix)

**WARNING:** The backend currently drops `daily_goal_sec` and `goal_category`. The following changes are required before the UI can persist these fields.

### 1. Schema Migration (`src/domains/focus/focusSchema.ts`)
Add guarded ALTER TABLE statements following the existing pattern:
```typescript
const groupCols = db.prepare('PRAGMA table_info(focus_groups)').all() as any[];
if (groupCols.length > 0 && !groupCols.some(c => c.name === 'daily_goal_sec')) {
  try { db.exec('ALTER TABLE focus_groups ADD COLUMN daily_goal_sec INTEGER'); } catch {}
}
if (groupCols.length > 0 && !groupCols.some(c => c.name === 'goal_category')) {
  try { db.exec('ALTER TABLE focus_groups ADD COLUMN goal_category TEXT'); } catch {}
}
```

### 2. Manager Update (`src/domains/focus/focusGroupManager.ts`)
- Add `daily_goal_sec: number | null` and `goal_category: string | null` to the `FocusGroup` interface and the `save()` argument type.
- Update `SELECT` queries in `list()` and `get()` to include the new columns.
- Update `INSERT` and `UPDATE` statements in `save()` to bind the new values.

### 3. IPC Pass-through (`src/main.ts`)
Update the `focusGroup:save` handler whitelist to pass the fields through:
```typescript
daily_goal_sec: typeof g.daily_goal_sec === 'number' ? g.daily_goal_sec : null,
goal_category: typeof g.goal_category === 'string' ? g.goal_category : null,
```

### 4. Usage Fetching (NEEDED FROM REPO)
To compute group progress accurately in the renderer, the backend needs an IPC method to fetch `focus_group_usage` rows. 
**Proposal:** Add `focusGroup:getUsage` to `main.ts` and `preload.ts`, returning `Array<{ group_id: number; session_id: number }>`. The renderer will map this to `history` rows for the pure functions in `focusHelpers.ts`. If this is not added, progress can only be computed for the *current* session via the `useActiveFocusGroup` singleton, and historical progress will remain 0%.
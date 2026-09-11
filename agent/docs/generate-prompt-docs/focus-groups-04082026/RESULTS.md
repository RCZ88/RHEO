# Focus Groups Feature — Master Implementation Specification

**Target:** AI Coding Agent (Architect)
**Scope:** Add per-session "Focus Groups" (named allowed-apps collections) with drag-to-set duration to the existing Deep Focus system.
**Deadline:** Single-shot patch. `node scripts/build.mjs` must exit 0.

---

## §0 — READ-FIRST BLOCKERS (non-negotiable)

Before writing any code, hard-wire these constraints into your implementation:

1. **Live target is `src/features/focus/FocusSection.tsx`** (mounted at `/activity?tab=focus` via `ActivityPage.tsx`). Do **NOT** touch `FocusPage.tsx` — it's a dead import.
2. **Goal shape is NESTED CAMELCASE** from `GoalStore.ts`: `goal.target.type`, `goal.target.matchCategory`, `goal.target.targetSeconds`, `goal.progressSeconds`. Reject any `match_category` / `target_seconds` snake_case from legacy docs.
3. **Focus accent = pink `#ec4899`**. Goal-progress accent = cyan `var(--dk-accent)` / `#22d3ee`. Do not mix them.
4. **Do not modify `FocusManager.getPublicState()`** (in `src/domains/focus/focusManager.ts`). Its 5-field shape (`active`, `endsAt`, `remainingSec`, `strictness`, `paused`) is depended on by `useFocusSession`, `QuickFocusCard`, `FocusTimer`. Attribution is handled renderer-side via a singleton (see §6).
5. **`useFocusGoals.ts` is BROKEN** — it reads `state.outcome`, `state.allowed_json`, `state.broke_on_type`, `state.id`, `state.started_at`, none of which exist on `FocusPublicState`. You must **rewrite** it, not copy it.
6. **All surfaces re-skinned to:** `bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/60 rounded-xl`. Text primary `#fafafa`, faint `#71717a`. Numbers: `font-mono tabular-nums`.
7. **No new npm dependencies.** Use only: shadcn/ui v4, Magic UI (`border-beam`, `number-ticker`, `animated-circular-progress-bar`, `particles`, `magic-card`), lucide-react, framer-motion, sonner, better-sqlite3.
8. **CRLF line endings** on edited files. SQL must use `?` parameterization (no string interpolation).

---

## §1 — Data Layer

### 1.1 SQL Schema

**New file:** `src/domains/focus/focusGroupSchema.ts`

```typescript
import type Database from 'better-sqlite3';

export function ensureFocusGroupSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS focus_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      allowed_json TEXT NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS focus_group_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      focus_group_id INTEGER REFERENCES focus_groups(id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES deep_focus_sessions(id) ON DELETE CASCADE,
      goal_ids TEXT,
      used_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}
```

Call `ensureFocusGroupSchema(db)` from `main.ts` boot sequence, immediately after the existing `ensureFocusSchema(db)` call.

### 1.2 Types

**New file:** `src/domains/focus/focusGroupTypes.ts`

```typescript
export type Tier = 'productive' | 'neutral' | 'distracting';
export type GoalCategory = 'work' | 'personal' | 'health' | 'learning';

export interface FocusGroupAllowed {
  apps: string[];
  domains: string[];
  tiers: Tier[];
}

export interface FocusGroup {
  id: number;
  name: string;
  allowed: FocusGroupAllowed;
  category: GoalCategory | null;
  createdAt: string;
}

export interface FocusGroupUsage {
  id: number;
  focusGroupId: number;
  sessionId: number;
  goalIds: string[];
  usedAt: string;
}

export const CATEGORY_COLORS: Record<GoalCategory, string> = {
  work: '#22d3ee',     // cyan
  learning: '#a78bfa', // violet
  health: '#f87171',   // red
  personal: '#4ade80', // green
};

export const GROUP_PRESETS: Array<{ name: string; category: GoalCategory; allowed: FocusGroupAllowed }> = [
  {
    name: 'Development',
    category: 'work',
    allowed: {
      apps: ['Visual Studio Code', 'Code', 'PyCharm', 'WebStorm', 'IntelliJ IDEA', 'Cursor', 'Windsurf'],
      domains: ['github.com', 'stackoverflow.com', 'developer.mozilla.org'],
      tiers: ['productive'],
    },
  },
  {
    name: 'Video Creation',
    category: 'work',
    allowed: {
      apps: ['CapCut', 'OBS', 'DaVinci Resolve', 'Adobe Premiere Pro', 'Final Cut Pro'],
      domains: ['youtube.com', 'vimeo.com'],
      tiers: ['productive', 'neutral'],
    },
  },
  {
    name: 'Deep Study',
    category: 'learning',
    allowed: {
      apps: ['Obsidian', 'Notion', 'Anki', 'Kindle'],
      domains: ['khanacademy.org', 'coursera.org', 'wikipedia.org'],
      tiers: ['productive'],
    },
  },
];
```

### 1.3 Manager Class

**New file:** `src/domains/focus/focusGroupManager.ts`

Follow the `GoalStore` dual-storage pattern (DB primary + `localStorage` cache key `df_focus_groups`).

```typescript
export class FocusGroupManager {
  constructor(private db: Database.Database) {
    ensureFocusGroupSchema(db);
  }

  list(): FocusGroup[] { /* SELECT * FROM focus_groups ORDER BY created_at DESC */ }
  get(id: number): FocusGroup | null { /* SELECT * WHERE id = ? */ }
  save(group: Omit<FocusGroup, 'id' | 'createdAt'> & { id?: number }): FocusGroup {
    // UPSERT: if id exists, UPDATE; else INSERT. Persist to DB AND localStorage.
  }
  remove(id: number): void { /* DELETE FROM focus_groups WHERE id = ? */ }

  // Called by main.ts after focus:start succeeds for a group
  linkUsage(sessionId: number, groupId: number, goalIds: string[]): void {
    // INSERT INTO focus_group_usage (focus_group_id, session_id, goal_ids)
    //   VALUES (?, ?, ?) where goal_ids = JSON.stringify(goalIds)
  }
}
```

**Cache sync:** on `save` / `remove`, also `localStorage.setItem('df_focus_groups', JSON.stringify(this.list()))`. Renderer hydrates from localStorage first for instant UI.

---

## §2 — IPC Layer

### 2.1 `main.ts` additions

Register handlers after the existing `focus:*` handlers. Instantiate `FocusGroupManager` alongside `FocusManager`.

```typescript
ipcMain.handle('focus-group:list', () => focusGroupManager.list());
ipcMain.handle('focus-group:get', (_e, id: number) => focusGroupManager.get(id));
ipcMain.handle('focus-group:save', (_e, group: any) => focusGroupManager.save(group));
ipcMain.handle('focus-group:remove', (_e, id: number) => focusGroupManager.remove(id));

ipcMain.handle('focus-group:start-with', async (_e, args: {
  groupId: number;
  durationSec: number;
  strictness: 'distracting' | 'non_allowed';
}) => {
  const group = focusGroupManager.get(args.groupId);
  if (!group) throw new Error('Focus group not found');

  // 1. Start the focus session with the group's allowed set
  const result = await focusManager.start({
    durationSec: args.durationSec,
    strictness: args.strictness,
    allowed: group.allowed,
  });

  // 2. Return the session row (which includes the new id) + the group so
  //    the renderer can drive attribution.
  return {
    sessionId: result.sessionId,
    groupId: group.id,
    groupCategory: group.category,
    allowed: group.allowed,
    durationSec: args.durationSec,
  };
});
```

Also wire into the existing `focus:end` handler: when the session ends, the renderer will have already accumulated progress (see §6) and called `save-goal` for each matched goal. The manager's `linkUsage` should be called at session end with the list of goal ids that got credited — easiest path: have the renderer send `focus-group:link-usage` on `focus:ended` with `{sessionId, groupId, goalIds}`.

### 2.2 `src/preload.ts` additions

Extend `deskflowAPI` with a `focusGroup` sub-object:

```typescript
focusGroup: {
  list: () => ipcRenderer.invoke('focus-group:list'),
  get: (id: number) => ipcRenderer.invoke('focus-group:get', id),
  save: (group: any) => ipcRenderer.invoke('focus-group:save', group),
  remove: (id: number) => ipcRenderer.invoke('focus-group:remove', id),
  startWith: (args: { groupId: number; durationSec: number; strictness: 'distracting' | 'non_allowed' }) =>
    ipcRenderer.invoke('focus-group:start-with', args),
  linkUsage: (args: { sessionId: number; groupId: number; goalIds: string[] }) =>
    ipcRenderer.invoke('focus-group:link-usage', args),
},
```

Add the types to the existing `DeskflowAPI` interface.

---

## §3 — Hook Layer (NEW)

### 3.1 `src/hooks/useFocusGroups.ts`

```typescript
export function useFocusGroups() {
  const [groups, setGroups] = useState<FocusGroup[]>(() => {
    // Hydrate from localStorage synchronously for instant UI
    const cached = localStorage.getItem('df_focus_groups');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await window.deskflowAPI.focusGroup.list();
      setGroups(list);
      localStorage.setItem('df_focus_groups', JSON.stringify(list));
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const saveGroup = async (group: Partial<FocusGroup>) => {
    const saved = await window.deskflowAPI.focusGroup.save(group);
    await refresh();
    return saved;
  };

  const removeGroup = async (id: number) => {
    await window.deskflowAPI.focusGroup.remove(id);
    if (selectedId === id) setSelectedId(null);
    await refresh();
  };

  const selected = groups.find(g => g.id === selectedId) ?? null;

  return { groups, loading, selected, selectedId, setSelectedId, saveGroup, removeGroup, refresh };
}
```

### 3.2 `src/hooks/useDragDuration.ts`

Manages the 5–180 minute drag slider with 5-min snap.

```typescript
export function useDragDuration(initial = 25, opts?: { min?: number; max?: number; snap?: number }) {
  const min = opts?.min ?? 5;
  const max = opts?.max ?? 180;
  const snap = opts?.snap ?? 5;
  const [minutes, setMinutesRaw] = useState(initial);
  const [dragging, setDragging] = useState(false);

  const setMinutes = (v: number) => {
    const snapped = Math.round(v / snap) * snap;
    setMinutesRaw(Math.max(min, Math.min(max, snapped)));
  };

  return { minutes, setMinutes, dragging, setDragging };
}
```

### 3.3 `src/hooks/useActiveFocusGroup.ts` (THE ATTRIBUTION SINGLETON)

**This is the critical fix.** Renderer-side registry of the currently-active grouped session. Both `FocusSection` (writes) and `useFocusGoals` (reads) use this.

```typescript
// Module-level singleton — survives re-renders, no context needed
let activeGroup: {
  sessionId: number;
  groupId: number;
  groupCategory: GoalCategory | null;
  allowed: FocusGroupAllowed;
  startedAt: number; // epoch ms
} | null = null;

const listeners = new Set<() => void>();

export function setActiveGroup(g: typeof activeGroup) {
  activeGroup = g;
  listeners.forEach(l => l());
}

export function getActiveGroup() { return activeGroup; }

export function useActiveFocusGroup() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return activeGroup;
}
```

### 3.4 `src/hooks/useFocusGoals.ts` — **FULL REWRITE**

Delete the existing broken version. Replace with one that reads from `useActiveFocusGroup` and ticks `GoalStore.accumulateProgress` every second while the session is active.

```typescript
import { useEffect, useState } from 'react';
import { useActiveFocusGroup } from './useActiveFocusGroup';
import { useFocusSession } from './useFocusSession';
import { GoalStore, type Goal } from '../services/GoalStore';

/**
 * Returns the subset of goals currently being credited by an active grouped
 * focus session, plus a live-updating `progressSeconds` overlay.
 */
export function useFocusGoals(goals: Goal[]) {
  const active = useActiveFocusGroup();
  const { state } = useFocusSession(); // for state.active
  const [tick, setTick] = useState(0);

  // Tick every second while a grouped session is active
  useEffect(() => {
    if (!active || !state?.active) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [active, state?.active]);

  // When session ends, flush accumulated seconds to GoalStore persistence
  useEffect(() => {
    if (!active) return;
    if (state?.active === false) {
      // Session just ended — persist and clear
      const matchedIds = matchGoalIds(goals, active.groupCategory, active.allowed);
      matchedIds.forEach(id => {
        GoalStore.applyAccumulated(id);
        const g = GoalStore.get(id);
        if (g) window.deskflowAPI.saveGoal(g.date, g);
      });
      setActiveGroup(null);
    }
  }, [state?.active, active, goals]);

  if (!active || !state?.active) {
    return { activeGroup: null, matchedGoals: [], liveOverlay: {} };
  }

  const matchedIds = matchGoalIds(goals, active.groupCategory, active.allowed);
  const elapsedSec = Math.floor((Date.now() - active.startedAt) / 1000);

  // Push accumulated seconds into GoalStore's in-memory accumulator
  matchedIds.forEach(id => GoalStore.accumulateProgress(id, 1)); // +1 per tick

  const liveOverlay: Record<string, number> = {};
  matchedIds.forEach(id => {
    liveOverlay[id] = (goals.find(g => g.id === id)?.progressSeconds ?? 0) + elapsedSec;
  });

  return {
    activeGroup: active,
    matchedGoals: matchedIds,
    liveOverlay,
    tick, // force re-renders of consumers
  };
}

function matchGoalIds(
  goals: Goal[],
  category: GoalCategory | null,
  allowed: { apps: string[]; domains: string[]; tiers: string[] }
): string[] {
  return goals
    .filter(g => g.target?.type === 'time' && g.target?.matchCategory)
    .filter(g => {
      // Match by category first; if the goal explicitly lists apps,
      // intersect with allowed.apps as an additional filter.
      if (category && g.category !== category) return false;
      if (g.target.matchApps && g.target.matchApps.length > 0) {
        return g.target.matchApps.some(a => allowed.apps.includes(a));
      }
      return true;
    })
    .map(g => g.id);
}
```

---

## §4 — UI Components (NEW)

### 4.1 `src/components/focus/FocusGroupSelector.tsx`

Horizontal chip row above the timer. Empty state → ghost "+ New group" chip.

```tsx
// Pseudo-structure — you write the full JSX
<GlassCard className="p-3">
  <SectionHeader icon={Layers} title="Focus Group" accent="#ec4899" />
  <ScrollArea orientation="horizontal">
    <div role="group" aria-label="Focus groups" className="flex gap-2">
      <AnimatePresence>
        {groups.map(g => (
          <motion.button
            key={g.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSelectedId(g.id)}
            className={`
              group relative flex items-center gap-2 px-3 py-2 rounded-lg
              border transition-colors
              ${selectedId === g.id
                ? 'bg-[#ec4899]/15 border-[#ec4899]/40 text-white'
                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-300 hover:border-white/20'}
            `}
            aria-pressed={selectedId === g.id}
            aria-label={`Select focus group ${g.name}`}
          >
            {/* Category left-border accent */}
            <span
              className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
              style={{ background: CATEGORY_COLORS[g.category ?? 'work'] }}
            />
            <span className="text-sm font-medium">{g.name}</span>
            <span className="text-xs text-zinc-500 font-mono tabular-nums">
              {g.allowed.apps.length + g.allowed.domains.length}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); openEditor(g); }}
              aria-label={`Edit ${g.name}`}
              title="Edit group"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit size={12} />
            </button>
          </motion.button>
        ))}
      </AnimatePresence>

      {/* New group FAB */}
      <button
        onClick={() => openEditor(null)}
        aria-label="Create new focus group"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg
                   border border-dashed border-zinc-700 text-zinc-500
                   hover:border-[#ec4899]/50 hover:text-[#ec4899] transition-colors"
      >
        <Plus size={14} />
        <span className="text-sm">New group</span>
      </button>
    </div>
  </ScrollArea>

  {groups.length === 0 && !loading && (
    <p className="mt-2 text-xs text-zinc-500">
      No focus groups yet — create one to pre-select apps for your next session.
    </p>
  )}
</GlassCard>
```

### 4.2 `src/components/focus/FocusGroupEditor.tsx`

Shadcn `Sheet` (right-side drawer). Three panes: Apps / Websites / Tiers. Preset chips at the top.

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" className="w-[420px] bg-[rgba(24,24,27,0.95)] backdrop-blur-xl border-l border-zinc-800/60">
    <SheetHeader>
      <SheetTitle className="text-zinc-100">
        {editing ? `Edit ${editing.name}` : 'New Focus Group'}
      </SheetTitle>
    </SheetHeader>

    {/* Presets row */}
    <div className="flex gap-2 py-3">
      {GROUP_PRESETS.map(p => (
        <Badge key={p.name} variant="outline" onClick={() => applyPreset(p)}
               className="cursor-pointer hover:bg-zinc-800">
          {p.name}
        </Badge>
      ))}
    </div>

    {/* Name */}
    <Label>Group name</Label>
    <Input value={name} onChange={e => setName(e.target.value)}
           placeholder="e.g. Development, Study Session"
           className="bg-zinc-900/60 border-zinc-700/50 focus:border-cyan-400/50" />

    {/* Category select */}
    <Label>Category</Label>
    <Select value={category} onValueChange={setCategory}>
      {/* work / learning / health / personal */}
    </Select>

    {/* Allowed apps — multiselect with running-app detection colour chip */}
    <Label>Allowed apps</Label>
    <AppPicker selected={apps} onChange={setApps} />

    {/* Allowed websites — chip input */}
    <Label>Allowed websites</Label>
    <DomainChipInput value={domains} onChange={setDomains} />

    {/* Tiers */}
    <Label>Protection tiers</Label>
    <div className="flex gap-2">
      {['productive','neutral','distracting'].map(t => (
        <Toggle key={t} pressed={tiers.includes(t)}
                onPressedChange={...}>{t}</Toggle>
      ))}
    </div>

    {/* Footer */}
    <div className="flex gap-2 pt-4">
      {editing && (
        <Button variant="destructive" onClick={handleDelete}>
          <Trash2 size={14} /> Delete
        </Button>
      )}
      <Button onClick={handleSave}
              disabled={!name || (apps.length === 0 && domains.length === 0)}>
        <Check size={14} /> Save group
      </Button>
    </div>

    {error && <div className="text-sm text-rose-400 mt-2">{error}</div>}
  </SheetContent>
</Sheet>
```

### 4.3 `src/components/focus/DragDurationBar.tsx`

Shadcn `Slider` with a live `NumberTicker` thumb label. Renders alongside (or replaces) the existing preset chips in `FocusTimer`.

```tsx
export function DragDurationBar({
  minutes, onMinutesChange, disabled,
}: { minutes: number; onMinutesChange: (m: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="font-mono tabular-nums">5 min</span>
        <span className="text-[#ec4899] font-semibold font-mono tabular-nums">
          <NumberTicker value={minutes} /> min
        </span>
        <span className="font-mono tabular-nums">180 min</span>
      </div>
      <Slider
        value={[minutes]}
        onValueChange={([v]) => onMinutesChange(Math.round(v / 5) * 5)}
        min={5} max={180} step={5}
        disabled={disabled}
        className="[&_[role=slider]]:bg-[#ec4899] [&_[role=slider]]:border-[#ec4899]"
        aria-label="Focus duration in minutes"
      />
      {/* Preset shortcuts */}
      <div className="flex gap-1.5">
        {[15, 25, 45, 90].map(p => (
          <button
            key={p}
            onClick={() => onMinutesChange(p)}
            disabled={disabled}
            className={`px-2 py-0.5 rounded text-xs font-mono tabular-nums
                        border transition-colors
                        ${minutes === p
                          ? 'bg-[#ec4899]/20 border-[#ec4899]/50 text-[#ec4899]'
                          : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:border-white/20'}`}
            aria-label={`Set ${p} minutes`}
          >
            {p}m
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## §5 — Wire-ins (surgical edits to EXISTING files)

### 5.1 `src/features/focus/FocusSection.tsx`

**Add** just above the `<FocusTimer>`:

```tsx
const { groups, selected, selectedId, setSelectedId } = useFocusGroups();

// Replace existing handleStart:
const handleStart = async () => {
  if (selected) {
    // Grouped start — goes through new IPC and seeds the attribution singleton
    const result = await window.deskflowAPI.focusGroup.startWith({
      groupId: selected.id,
      durationSec: mins * 60,
      strictness: strict,
    });
    setActiveGroup({
      sessionId: result.sessionId,
      groupId: result.groupId,
      groupCategory: result.groupCategory,
      allowed: result.allowed,
      startedAt: Date.now(),
    });
    // Also call the regular start hook so state/history flows correctly:
    start(mins * 60, strict);
  } else {
    start(mins * 60, strict);
  }
};
```

**Render** `<FocusGroupSelector />` between the existing `SectionHeader` and `<FocusTimer>`.

### 5.2 `src/features/focus/FocusTimer.tsx`

Add `<DragDurationBar minutes={mins} onMinutesChange={onMinsChange} disabled={state?.active} />` below the existing `PRESETS` chip row. Keep the presets — they're quick-chip shortcuts; the bar is for custom values. Hide the bar in Challenge/stopwatch mode (the point is "no target").

### 5.3 `src/components/ai/canvas/cards/DailyPlannerCard.tsx`

Update `startFocus(goal)` to respect the selected focus group:

```tsx
const { selected } = useFocusGroups();

const startFocus = async (goal: Goal) => {
  if (goal.target?.type !== 'time' || !goal.target?.targetSeconds) return;
  const remaining = Math.max(60, goal.target.targetSeconds - (goal.progressSeconds ?? 0));

  if (selected) {
    const r = await window.deskflowAPI.focusGroup.startWith({
      groupId: selected.id,
      durationSec: remaining,
      strictness: 'distracting',
    });
    setActiveGroup({
      sessionId: r.sessionId, groupId: r.groupId,
      groupCategory: r.groupCategory, allowed: r.allowed,
      startedAt: Date.now(),
    });
  } else {
    await window.deskflowAPI.focus.start({
      durationSec: remaining, strictness: 'distracting',
    });
  }
};
```

### 5.4 Live Goal Credit UI

In `GoalItem.tsx` (or wherever the `GoalProgressBar` renders), consume `useFocusGoals(goals)` and overlay `liveOverlay[goal.id]` onto `goal.progressSeconds`. When the goal's id is in `matchedGoals`, wrap the card in a Magic UI `<BorderBeam color="#ec4899" />` to draw attention during the active session.

### 5.5 End-of-session Toast

In `FocusSection.tsx`, add a `useEffect` watching for `state.active` flipping `true → false` AND `history[0]?.outcome === 'completed'`. When that happens and `getActiveGroup()` was non-null, fire a `sonner` toast:

```ts
toast.success(`${groupName} · ${duration} min · ${pct}% of '${goalTitle}' goal`, {
  duration: 5000,
  className: 'bg-[rgba(24,24,27,0.95)] border border-zinc-800/60 text-zinc-100',
});
```

Then call `window.deskflowAPI.focusGroup.linkUsage({ sessionId, groupId, goalIds })`.

---

## §6 — Data Flow Summary (the attribution pipeline)

```
User selects "Development" group + drags to 45 min + hits Start
   ↓
FocusSection.handleStart
   → window.deskflowAPI.focusGroup.startWith({groupId, durationSec:2700, strictness})
      (main.ts) FocusManager.start({ allowed: group.allowed })
      returns {sessionId, groupId, groupCategory:'work', allowed}
   → setActiveGroup({sessionId, groupId, groupCategory, allowed, startedAt: now})
   → useFocusSession state becomes active (normal flow)
   ↓
Every 1 s, useFocusGoals tick fires:
   → matches goals with target.matchCategory === 'work' (or intersects matchApps)
   → GoalStore.accumulateProgress(goalId, 1)
   → liveOverlay[goalId] = base + elapsed
   → GoalProgressBar re-renders with live value + BorderBeam
   ↓
FocusManager ends session (timeout OR user abort OR break)
   → focus:ended IPC event
   → useFocusSession state.active = false
   → useFocusGoals detects active=false while activeGroup is set:
      → GoalStore.applyAccumulated(goalId) for each matched goal
      → window.deskflowAPI.saveGoal(goal.date, goal) (persists progressSeconds)
      → window.deskflowAPI.focusGroup.linkUsage({sessionId, groupId, goalIds})
      → setActiveGroup(null)
   → sonner toast with summary
```

---

## §7 — QA Checklist (Hands & Eyes validates each line)

| # | Check | Pass criterion |
|---|---|---|
| 1 | `/activity?tab=focus` renders the new `FocusGroupSelector` above `FocusTimer` | Section visible, no blank screen regression |
| 2 | "New group" opens the editor sheet | Sheet slides in from right |
| 3 | Save a "Development" group (apps: VS Code, PyCharm; tier: productive) | Group appears as chip with cyan left-border (work) |
| 4 | Reload app | Group persists (DB + localStorage hydration) |
| 5 | Drag `DragDurationBar` to 35 min | `mins` state updates; preset chips highlight nearest |
| 6 | Start a 2-min session with "Development" selected | `focus:start` IPC invoked with `allowed.apps` containing VS Code; overlay enforces |
| 7 | Switch to a non-allowed app during the session | Focus overlay appears (existing behaviour, unchanged) |
| 8 | Open a goal `matchCategory='work'` in DailyPlannerCard, click Focus | Session starts with currently-selected group's `allowed` |
| 9 | While session active, matching goal's `GoalProgressBar` ticks up | Probe asserts `progressSeconds` increments at ~1/sec |
| 10 | `BorderBeam` renders on the matching goal card during session | Visual confirmation |
| 11 | Session completes normally | `save-goal` IPC called with updated `progressSeconds`; `focus_group_usage` row inserted |
| 12 | End-of-session toast shows "Development · 2 min · X% of 'Goal Title'" | Sonner toast visible, auto-dismisses |
| 13 | Challenge mode (stopwatch) hides the duration slider | UI conditional correct |
| 14 | Empty state: no groups → ghost "+ New group" chip with explanatory text | Rendered correctly |
| 15 | ESC closes the editor sheet | Keyboard accessible |
| 16 | All icon buttons have `aria-label` + `title` | a11y tree complete |
| 17 | `node scripts/build.mjs` exits 0 | No TS / Vite errors |
| 18 | CRLF preserved in edited files | `git diff --stat` shows correct line endings |

---

## §8 — Implementation Notes (for your commit message)

> feat(focus): add Focus Groups with drag-duration and live goal attribution
>
> - New `focus_groups` / `focus_group_usage` tables (focusGroupSchema.ts)
> - `FocusGroupManager` mirrors GoalStore dual DB+localStorage pattern
> - Renderer-side singleton (`useActiveFocusGroup`) bridges session→goals
>   without extending FocusManager.getPublicState (preserves 5-field shape)
> - Rewrote `useFocusGoals.ts` — the prior version read fields that don't
>   exist on FocusPublicState. New version ticks `GoalStore.accumulateProgress`
>   every second during a grouped session and flushes to persistence on end.
> - FocusGroupSelector (chips + editor Sheet), DragDurationBar (5-180 min slider)
> - Wire-ins: FocusSection, FocusTimer, DailyPlannerCard, GoalProgressBar
> - End-of-session sonner toast summarizing group · duration · goal credit
>
> Closes: user-request "group allowed-apps per focus session + drag duration"

---

## §9 — Files to Create / Modify (exact manifest)

**CREATE:**
- `src/domains/focus/focusGroupSchema.ts`
- `src/domains/focus/focusGroupTypes.ts`
- `src/domains/focus/focusGroupManager.ts`
- `src/hooks/useFocusGroups.ts`
- `src/hooks/useDragDuration.ts`
- `src/hooks/useActiveFocusGroup.ts`
- `src/components/focus/FocusGroupSelector.tsx`
- `src/components/focus/FocusGroupEditor.tsx`
- `src/components/focus/DragDurationBar.tsx`

**MODIFY:**
- `src/main.ts` — register new IPC handlers + instantiate manager
- `src/preload.ts` — add `focusGroup` to `deskflowAPI`
- `src/hooks/useFocusGoals.ts` — **full rewrite** (see §3.4)
- `src/features/focus/FocusSection.tsx` — add selector + grouped `handleStart`
- `src/features/focus/FocusTimer.tsx` — add `DragDurationBar`
- `src/components/ai/canvas/cards/DailyPlannerCard.tsx` — pass selected group into `startFocus`
- `src/components/ai/canvas/cards/GoalProgressBar.tsx` (or `GoalItem.tsx`) — consume `liveOverlay` + `BorderBeam`

---

Follow this spec top-to-bottom. Do not invent alternatives to the attribution singleton (the `getPublicState` extension path is explicitly rejected to avoid breaking `QuickFocusCard` and other consumers). Build the new files first, then the hooks, then wire into the existing files last. Run `node scripts/build.mjs` after each major milestone.

**Execute.**
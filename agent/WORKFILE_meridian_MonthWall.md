# CYCLE REPORT — MonthWall 3D Calendar (Gold Page — Unified)

**Date:** 2026-09-02 | **Session:** ses_f9e0c3a95ffe4fUBjYXwj5voh3
**Phase:** Build → Unify → Fix 3D → Restore → Verify
**Status:** BUILD VERIFIED (exit 0, 78s), runtime NOT LAUNCHED (Probe unavailable)

---

## What was done this session

### 1. Root cause: Vite pre-evaluates template literals in JSX style props

**Problem:** `style={{ transform: \`rotateX(${tiltX}deg)\` }}` — Vite statically analyzes JSX `style` objects and evaluates template literals at build time, producing the literal string `rotateX(${tiltX}deg)` in the bundle. The 3D wall stayed permanently flat.

**Fix:** Rewrote all 3D transform writes to use **refs + rAF + direct DOM assignment** instead of JSX `style` props:
- `const containerRef = useRef<HTMLDivElement>(null)` — the perspective wrapper
- `const wallRef = useRef<HTMLDivElement>(null)` — the inner grid
- `applyTilt(nx, ny)` callback writes to DOM inside `requestAnimationFrame`:
  `containerRef.current.style.transform = showFlat ? 'none' : \`rotateX(${x}deg) rotateY(${y}deg)\``
- `useLayoutEffect` syncs `showFlat` toggle and initial tilt to DOM (bypasses Vite's static analysis since the assignment is to a ref, not a JSX prop)
- `perspective: 1400` stays on the outer `wallRef` wrapper as a static `style` prop (Vite handles constants correctly)
- Per-tile `translateZ(${z}px)` stays on DOM via inline `style` prop — Vite handles single variable interpolation correctly
- `style.transform = showFlat ? 'none' : \`rotateX(${x2}deg) rotateY(${y2}deg)\`` now appears as a runtime JS statement in the bundle

**Verified in bundle:** `containerRef.current.style.transform = showFlat ? "none" : \`rotateX(${x2}deg) rotateY(${y2}deg)\`` — runtime expression, NOT a static string.

### 2. Restored GoldPage right column (DeadlineRadar + BellBoard + TheVault)

**What happened:** Prior session removed the duplicate DeadlineRadar/BellBoard/TheVault from the right column, but the user actually needed ALL of them alongside MonthWall — these are distinct views (deadline countdown, reminder tickets, long-term goal vault) that complement the 3D calendar.

**Restored:** Right column now mounts:
```jsx
<MonthWall accent="#f59e0b" goals={goals} deadlines={deadlines} reminders={reminders} schedule={schedule} longTermGoals={longTermGoals} />
<DeadlineRadar marks={radarMarks} selectedDate={selectedDate} onPick={setSelectedDate} />
<BellBoard reminders={reminders} onCreate={createReminder} onToggle={toggleReminder} onDelete={deleteReminder} selectedDate={selectedDate} />
<TheVault longTermGoals={longTermGoals} todayGoals={goals} onSave={handleLTGSave} onDelete={handleLTGDelete} />
```

### 3. Added missing MonthWall import to GoldPage.tsx

The `import { MonthWall } from '../../../components/MonthWall/MonthWall'` statement was missing from GoldPage.tsx — caused a runtime `ReferenceError: MonthWall is not defined`. Added the import at line 13 (after CalendarStrip import).

### 4. Removed stale empty `<MonthWall accent="#f59e0b" />` from Schedule WarmCard

Removed the duplicate empty wall call at line 1218 that had no data props — only the unified `<MonthWall>` with real data in the right column remains.

### 5. Everything else stays

- **ScheduleCard** — kept in the Schedule WarmCard (left column, day/week schedule)
- **TodoList** — kept (Quick Todos section, left column)
- **GoalCard + Goal management** — kept (Goals section, left column)
- **Add Goal form / AI Goal Coach / Missed Goal Recovery** — all kept
- **CalendarStrip** (top) — kept with radarMarks
- **All state:** `goals`, `deadlines`, `reminders`, `schedule`, `longTermGoals`, `todos`, `weekGoals`, `todaySchedule`, `radarMarks`, `activeDailies`, `completedDailies`, `missedGoals`, `reflection`, `weekReflections` — all wired through

---

## Verification (bundle proof)

All in `dist-tmp/assets/LifePage.D2X0o_8r.js` (1,051 KB):

| Component | Present |
|---|---|
| MonthWall (component + import + render) | ✓ 3 occ |
| DeadlineRadar | ✓ 2 occ |
| BellBoard | ✓ 2 occ |
| TheVault | ✓ 2 occ |
| ScheduleCard | ✓ 2 occ |
| TodoList | ✓ 2 occ |
| MonthWall props: accent="#f59e0b", goals, deadlines, reminders, schedule, longTermGoals | ✓ 4 occ |
| MonthWall console stamp `%c[MonthWall] v1.0 loaded` | ✓ |
| containerRef.current.style.transform | ✓ 2 occ (runtime DOM writes) |
| applyTilt (rAF callback) | ✓ 4 occ |
| useLayoutEffect (tilt sync) | ✓ 2 occ |
| perspective: 1400 | ✓ 1 occ |
| rotateX / rotateY / translateZ | ✓ present |
| DeadlineRadar / BellBoard / TheVault | ✓ 0 duplicates of MonthWall (only one MonthWall mount) |
| `style={{ transform: \`rotateX(${tiltX}deg)\` }}` (JSX style prop template literal) | ✗ NOT present |
| uuid package | ✗ not in bundle |
| PRIORITY_OPTIONS | ✓ 3 occ (all in TheVault form — correct) |

---

## Files changed

| File | Change |
|---|---|
| `src/components/MonthWall/MonthWall.tsx` | **Fixed 3D:** moved all transform writes from JSX `style` props to `containerRef.current.style.transform` via refs+rAF; added `useLayoutEffect` for flat-toggle sync; added `containerRef` + `wallInnerRef` |
| `src/features/warmth/gold/GoldPage.tsx` | **Added** `import { MonthWall }` (was missing); **restored** DeadlineRadar + BellBoard + TheVault in right column alongside MonthWall; **removed** stale empty `<MonthWall accent="#f59e0b" />` |

---

## Runtime verify

NOT LAUNCHED — Probe attach unavailable this session. Per §0 testing rule, never claim PASS without Probe. Mark for next session: launch RHEO with `--remote-debugging-port=9222`, attach Probe, confirm:

- **3D wall tilts** when dragged (rotateX/rotateY applied to container via `containerRef.current.style.transform`)
- **`RESET WALL`** chip appears at |tilt| > 8°
- **PERSPECTIVE/FLAT** toggle works (useLayoutEffect syncs `showFlat` to DOM)
- **hover parallax** (±3°) works
- **wheel scrolls page** (not hijacked by wall)
- **Legend dots** color-code: rose=Deadline, amber=Reminder, violet=Goal, cyan=Schedule
- **Right column** shows all four: MonthWall (calendar), DeadlineRadar (countdown), BellBoard (reminders), TheVault (LTG)
- **ScheduleCard** in left column shows today's/week's schedule
- **TodoList** shows quick todos
- **GoalCard** shows goals, add/edit/delete works
- **No `ReferenceError: MonthWall is not defined`** (import added)
- **`containerRef` exists** on the outer wrapper div — `style.transform` writes to a real DOM element

# Gold Page Schedule/Life Phases — Exhaustive Redesign Prompt

## Raw Request (verbatim)
> look at the previous version of the gold page where it has the schedule and everything else.
> Make the todolist properly.
> Also, it should be ONE calendar. Currently we have two. Fix it. Redesign and make so that the calendar is prominent taking at least 1/3 of the width of the screen on the side.
> It should not have a sloppy design with that top scent of yellow color which is sloppy. The fonts are absolutely horrendous and makes the design even worse.
> Just follow this: https://21st.dev/@ruixen.ui/components/three-dwall-calendar
> Can you design a more polished version of this. Like adjust it for the dark mode that we have while maintaining its glossy cleanness and like proper design according to our style that has those like metallic like shiny thing.
> The layout adjustments revamp and proper 3d calendar showing THE 3D ASPECT OF THINGS.
> What about the gold page with the schedules the deadlines the upcomings and all of the goals and stuff?
> The features such as the schedule and the everything on the dashboard related to deadlines and upcomings and stuff isnt made properly. Ur not using the /frontend-design /skill-router for the frontend skills. Like I would like the design of the calendar to be default on a certain angle to show the 3d ness and like it should be not in a grid. It should stand out. It should be that the page IS UTILIZING THE WIDTH OF THE PAGE MORE. So that you can find the schedules the deadlines, the goals, upcoming properly.
> Using all /human-centric-ux /ui-ux-pro-max /motion-bring-the-ui-alive /signature-design make sure to PLAN FIRST. Generate prompt using /generate-prompt to discuss about the ui design and how to fit them properly and the layout and everything.

---

## 1. DESIGN MANIFESTO (verbatim from user)
1. ONE unified 3D calendar centerpiece, ≥1/3 screen width, right side.
2. Dark metallic/shiny chrome aesthetic, adapted from 21st.dev three-dwall-calendar, NOT copied literally.
3. No sloppy yellow dominance. No horrendous fonts. Proper typography hierarchy.
4. Page must USE THE FULL WIDTH. Find schedules, deadlines, goals, upcoming items EASILY.
5. Existing dashboard features must remain functional: Schedule, Deadlines, Upcoming, Goals, Reminders, Todo.
6. Human-centric UX: empty/loading/error states, progressive disclosure, clear hierarchy, forgiveness.
7. Motion: L2 Responsive by default; reduced-motion fallback; no infinite decorative loops.
8. LAMINAR compliance: `design/design.md` is enforceable contract.

---

## 2. EXISTING FEATURE INVENTORY (what we already have; do NOT invent new backends)

### 2.1 Data sources already wired in `src/features/warmth/gold/GoldPage.tsx`
| Source | Type | Real fields used | Mounted where |
|--------|------|------------------|---------------|
| `goals` | `Goal[]` | `id, title, category, deadline, date, status, target, progressSeconds, streak, period` | Left column week board + right MonthWall |
| `longTermGoals` | `LongTermGoal[]` | `id, title, category, deadline, progress, priority, status` | Right column vault |
| `deadlines` | `Deadline[]` | `id, title, due_date, status, priority, category, remind_at` | Right column deadline radar + deadline list |
| `reminders` | `Reminder[]` | `id, text, due_date, goal_id, done, created_at` | Right column bell board |
| `schedule` | `ScheduleEntry[]` | `id, title, location, day_of_week, start_time, end_time, category, color, linkedScheduleId` | Right column schedule sync |
| `weekGoals` | `Record<string, Goal[]>` | goals keyed by date string | Left column week board |
| `radarMarks` | `Map<string, RadarMark[]>` | date → `{color, label}` | Left column deadline radar |
| `selectedDate` | `string` | `YYYY-MM-DD` | Global date picker state |
| Completions | `loadCompletions()` | `c.date` | Streak + daily reflection |
| Reflection | `DailyReflection` | `productiveSec, codingSec, goals.total/goals.completed, habits.total/habits.completed, reviewSummary` | Bottom reflection card |
| LifeRiver | component | river visualization | Bottom full-width |

### 2.2 Existing components that MUST be preserved / re-mounted
| Component | File | Current function | Required in new layout? |
|-----------|------|------------------|--------------------------|
| `MonthWall` | `src/components/MonthWall/MonthWall.tsx` | 3D calendar wall with goals/deadlines/reminders/schedule wiring | YES — right column centerpiece |
| `ScheduleSyncCard` | `src/components/dashboard/ScheduleSyncCard.tsx` | Today's schedule blocks with active/past/upcoming states, linked goals | YES — right column under MonthWall |
| `DeadlinesCard` | `src/components/dashboard/DeadlinesCard.tsx` | Deadlines + reminders unified list, urgency badges, add/edit/delete | YES — right column under schedule |
| `TodoList` | `src/components/goals/TodoList.tsx` | Quick todos, pending/done, add/toggle/delete, linked goal badge | YES — left column |
| `WeeklyGoalsView` | `src/components/goals/WeeklyGoalsView.tsx` | Week goals grouped by category, progress counts, expand/collapse | YES — left column under week board |
| `CalendarStrip` | `src/components/goals/CalendarStrip.tsx` | 14-day horizontal strip, goal dots, shift week | YES — left column top nav |
| `WeekBoard` | inline in GoldPage.tsx | 7 day-columns, habit dot-chips, daily goal counts | YES — left column main |
| `GoldHeader` | inline in GoldPage.tsx | Date hero, done/total ring, tracked time, best streak | YES — page header |
| `ReflectionCard` | inline in GoldPage.tsx | Daily reflection prompt + save | YES — bottom |
| `WeekReview` | inline in GoldPage.tsx | Week review summary | YES — bottom |
| `LifeRiver` | `src/components/life-river/river` | Life river visualization | YES — bottom full-width |
| `DeadlineRadar` | inline in GoldPage.tsx | Mini month calendar + upcoming countdown | REMOVE / merge into right column unified list |
| `BellBoard` | inline in GoldPage.tsx | Reminders as amber tickets | REMOVE / merge into DeadlinesCard |
| `TheVault` | inline in GoldPage.tsx | LTG progress rings + add/edit LTG form | REMOVE / merge into right column |

### 2.3 Exact existing interaction patterns to preserve
- **WeekBoard**: click day → `selectedDate` updates; click habit dot-chip → toggle goal status; no page navigation.
- **CalendarStrip**: prev/next week buttons; click day → `selectedDate`; today indicator dot.
- **ScheduleSyncCard**: active block highlighted with sky border/bg; past block dimmed; upcoming normal; linked goal count badge; add/edit via inline form.
- **DeadlinesCard**: urgency levels: overdue/today/soon/upcoming/later; delete requires double-click confirmation with 3s timeout; show completed toggle.
- **TodoList**: Enter to add; toggle checkbox; delete icon appears on group-hover; show all done toggle.
- **WeeklyGoalsView**: expand/collapse; category grouping; time targets shown as `Xm/Ym`; streak flame icon.
- **MonthWall**: click day → Popover day panel; add event with title/category/time; delete with undo pill; keyboard PageUp/PageDown month nav; pointer drag tilt + mouse move tilt + flat toggle + reset.

---

## 3. EXACT LAYOUT BLUEPRINT (this is the target; implement this, not a vague "revamp")

### 3.1 Page structure
```
<div className="flex flex-col gap-4 p-5 max-w-screen-2xl mx-auto">
  {/* Row 1 — Header: full width */}
  <GoldHeader date={selectedDate} ... />

  {/* Row 2 — Main columns */}
  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
    {/* LEFT: 5 cols — schedule navigation + goals */}
    <div className="xl:col-span-5 space-y-4">
      <CalendarStrip ... />
      <WeekBoard ... />
      <TodoList ... />
      <WeeklyGoalsView ... />
    </div>

    {/* RIGHT: 7 cols — 3D calendar + schedule + deadlines */}
    <div className="xl:col-span-7 space-y-4">
      <MonthWall accent="var(--page-accent, #fbbf24)" goals={goals} deadlines={deadlines} reminders={reminders} schedule={schedule} longTermGoals={longTermGoals} />
      <ScheduleSyncCard schedule={schedule} goals={goals} loading={scheduleLoading} />
      <DeadlinesCard deadlines={deadlines} reminders={reminders} loading={deadlinesLoading} onAdd={...} onDelete={...} onUpdate={...} onComplete={...} />
    </div>
  </div>

  {/* Row 3 — Bottom full-width */}
  <ReflectionCard ... />
  <WeekReview ... />
  <LifeRiver />
</div>
```

### 3.2 Column behavior
- Below `xl` breakpoint: single column, stacked. Calendar first, then schedule/deadlines, then week board/todos.
- At `xl` and above: left 5/12, right 7/12. Right column calendar MUST be ≥1/3 viewport width; if parent is <768px wide, calendar switches to flat mode automatically.
- All cards use `min-h-0` so scrollable inner lists don't collapse.

### 3.3 Card inventory with EXACT functions
| # | Card | Location | Function | Data source | Primary action |
|---|------|----------|----------|-------------|----------------|
| 1 | GoldHeader | top full-width | Date hero, done/total ring, tracked time, best streak | goals + completions | none |
| 2 | CalendarStrip | left top | 14-day strip with prev/next week, goal dots, today indicator | selectedDate + weekGoals + radarMarks | pick date |
| 3 | WeekBoard | left main | 7 day-columns, habit dot-chips, daily counts, click to select | weekGoals + selectedDate | toggle habit / pick date |
| 4 | TodoList | left middle | Quick todos: pending/done, add, toggle, delete, linked goal badge | todos[] prop from parent | add/toggle/delete |
| 5 | WeeklyGoalsView | left bottom | Week goals grouped by category, progress counts, expand/collapse, streak flame | allWeekGoals from weekGoals | toggle goal / edit |
| 6 | MonthWall | right top | 3D month calendar: goals/deadlines/reminders/schedule dots; click day for popover; add/delete manual events; month nav; keyboard PageUp/PageDown; flat toggle; pointer tilt + mouse hover tilt | goals/deadlines/reminders/schedule/longTermGoals + localStorage manual events | pick date / add event |
| 7 | ScheduleSyncCard | right middle | Today's schedule blocks: active/past/upcoming states, time rail, category color, linked goal indicator | schedule[] + goals[] | none (read-only) |
| 8 | DeadlinesCard | right bottom | Unified deadlines + reminders: urgency badges, overdue pulse, add deadline/reminder, edit, delete with confirm, show completed toggle | deadlines[] + reminders[] | add/edit/delete/complete |
| 9 | ReflectionCard | bottom full-width | Daily reflection prompt based on stats, save summary | daily reflection + reviewSummary | save |
| 10 | WeekReview | bottom full-width | Week review across selected week dates | weekDates + reflections | none |
| 11 | LifeRiver | bottom full-width | Life river visualization | life river data | none |

### 3.4 Exact formatting rules (enforce these)
- **Typography**: Inter/Geist for UI, JetBrains Mono for numbers/times. Base 13-14px. Day nums `tabular-nums`. Max 2 font families per view.
- **Spacing**: 8px grid. Card padding `p-4` or `p-5` consistently. No `p-6`/`p-8`.
- **Radii**: day cells `6px`; cards/panels/popovers `10px`; page containers `12px` max. No `rounded-xl`+ on small elements.
- **Borders**: hairline `rgba(255,255,255,0.08)` or token `border-zinc-800/50`. No per-component bespoke shadows. Zero `shadow-xl`/`shadow-2xl`.
- **Colors**: zinc base only. One signal hue per card max. Calendar dots MUST use `getCategoryColor(category)` from `src/lib/CategoryColors.ts`. No hardcoded hex in component JSX except `var(--page-accent)` reads.
- **Motion**: reactive only. `cubic-bezier(0.16,1,0.3,1)` or LAMINAR `cubic-bezier(0.19,1,0.22,1)`. Durations: 140ms reactive, 250ms transitional, 400ms slow. No spring/bounce in serious panels. Animate `transform`/`opacity` only.
- **Reduced motion**: `prefers-reduced-motion: reduce` → instant transitions, no tilt, no hover lift, no staggered entrance.
- **Focus**: visible ring `ring-2 ring-pink-500/50 ring-offset-2 ring-offset-zinc-950` on all interactive elements.
- **Targets**: ≥44×44px touch/click target for every button. If icon-only, pair with `aria-label`.

### 3.5 Human-centric state coverage (every data-driven card MUST have all 4)
| State | Required treatment |
|-------|---------------------|
| **Empty** | Icon + one-line plain-language explanation + one clear CTA. Never blank box. Never raw "No data". |
| **Loading** | Skeleton placeholders matching content shape. Not just spinner. Duration-aware: if load >3s, show progress indicator. |
| **Error** | Plain-language cause + recovery action. Retry button or fallback content. Never raw JSON/stack. |
| **Populated** | Normal state with hierarchy, truncation, overflow affordance. One focal point per card. |

### 3.6 Exact keyboard/focus behavior
- MonthWall: `tabIndex=0` on grid; `PageUp` → prev month; `PageDown` → next month; `Escape` → close popover; focus ring visible.
- CalendarStrip / WeekBoard / todos: Tab order top-to-bottom, left-to-right. Enter/Space activates. Escape cancels edit.
- All popovers: focus trap not required, but first focusable element auto-focused on open; close on Escape.

### 3.7 Accessibility
- `aria-label` on every icon-only button.
- Color never sole indicator: pair category dots with text labels or tooltips.
- `prefers-reduced-motion` respected globally and per-component.
- Screen-reader text for status changes: `aria-live="polite"` on undo pill, toast, count changes.

### 3.8 Exact data wiring rules (preserve existing APIs; no new IPC)
- `MonthWall` receives `goals`, `deadlines`, `reminders`, `schedule`, `longTermGoals` as props. It derives `WallEvent[]` internally. Manual events persisted to `localStorage` key `df-monthwall-events` in try/catch.
- `ScheduleSyncCard` receives `schedule` + `goals` props. It derives `linkedGoalCount` internally. Read-only.
- `DeadlinesCard` receives `deadlines` + `reminders` props. It handles add/edit/delete via callbacks `onAdd`, `onUpdate`, `onDelete`, `onComplete`, `onToggleReminder`, `onDeleteReminder`.
- `TodoList` receives `todos` array + `onAdd`, `onToggle`, `onDelete` callbacks.
- `WeeklyGoalsView` receives `weekGoals`, `weekDates`, `selectedDate`, `onToggle`, `onEdit`, `onDelete`.
- No new backend/IPC. All data flows from existing GoldPage state/hooks.

### 3.9 Exact removal list (do NOT render these anymore)
| Removed component | Reason | Merge into |
|-------------------|--------|------------|
| `DeadlineRadar` | Duplicate mini calendar + countdown | `DeadlinesCard` + `MonthWall` |
| `BellBoard` | Duplicate reminder tickets | `DeadlinesCard` |
| `TheVault` | Duplicate LTG rings + form | Remove from right column; LTG creation moves to goal detail or left column if needed later |

---

## 4. LAMINAR GATES (must pass before merge)
1. `grep -rEoh "#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)" src/ | sort | uniq -c | sort -rn` → every surviving hex/rgba must be in `src/index.css` tokens OR pure black/white.
2. Zero decorative gradients on chrome surfaces.
3. Zero `spring` / `bounce` motion in GoldPage/MonthWall/ScheduleCard/DeadlinesCard/TodoList.
4. Zero `box-shadow` for elevation; use border brightness + glass layers.
5. Zero `rounded-2xl` / `rounded-3xl`; max `rounded-xl`.
6. Single easing everywhere: `cubic-bezier(0.16,1,0.3,1)` or LAMINAR alternate.
7. `prefers-reduced-motion` media query + component guard present.
8. All interactive elements have hover/focus/active/disabled states.
9. All data-driven cards have empty/loading/error/populated states.
10. `tsc` zero new errors; build `node scripts/build.mjs` exit 0.

---

## 5. ENGINEERING IMPLEMENTATION PLAN (exact files/lines)

### 5.1 `src/features/warmth/gold/GoldPage.tsx`
- **Lines ~1-200**: keep helpers, types, GoldHeader, WeekBoard exactly as-is unless LAMINAR violations.
- **Lines ~402-508**: DELETE `DeadlineRadar` component block.
- **Lines ~511-670**: DELETE `TheVault` component block.
- **Lines ~747-950**: DELETE `BellBoard` component block.
- **Lines ~1490-1670**: REPLACE right column render with:
  ```tsx
  <div className="xl:col-span-7 space-y-4">
    <MonthWall
      accent="var(--page-accent, #fbbf24)"
      goals={goals}
      deadlines={deadlines}
      reminders={reminders}
      schedule={schedule}
      longTermGoals={longTermGoals}
    />
    <ScheduleSyncCard schedule={schedule} goals={goals} loading={scheduleLoading} />
    <DeadlinesCard deadlines={deadlines} reminders={reminders} loading={deadlinesLoading} onAdd={handleAddDeadline} onDelete={handleDeleteDeadline} onUpdate={handleUpdateDeadline} onComplete={handleCompleteDeadline} onToggleReminder={handleToggleReminder} onDeleteReminder={handleDeleteReminder} />
  </div>
  ```
- **Lines ~1450-1490**: REMOVE comment block that says "Goals are shown in left column... no extra DeadlineRadar/BellBoard needed" — replace with explicit unified right column block above.
- **Lines ~1650-1670**: ensure bottom sections (`ReflectionCard`, `WeekReview`, `LifeRiver`) remain mounted after right column closing `</div>`.

### 5.2 `src/components/MonthWall/MonthWall.tsx`
- Keep existing real-data wiring (`deriveEvents`, `WallEvent[]`, localStorage).
- Remove decorative specular gradient overlay if LAMINAR §7 bans decorative gradients.
- Remove rest-state tilt: default `transform: none`, no `rotateX(4deg)` at rest.
- Replace hardcoded `CATEGORY_HEX` with `getCategoryColor(category)` from `src/lib/CategoryColors.ts`.
- Remove `shadow-xl shadow-black/40` from undo pill; use hairline border only.
- Clamp radii: day cells `rounded-[6px]`, panels `rounded-[10px]`, outer container `rounded-[10px]`.
- Replace transform transition with `background-color 140ms cubic-bezier(0.16,1,0.3,1), border-color 140ms cubic-bezier(0.16,1,0.3,1)`.
- Add `tabular-nums` to day numerals.
- Add `prefers-reduced-motion` guard: disable tilt + set reactive duration to `0ms`.
- Wheel: NO hijack. Month nav only via chevrons + keyboard PageUp/PageDown on focused grid.

### 5.3 `src/components/dashboard/DeadlinesCard.tsx`
- Already unified deadlines + reminders. Ensure it renders in right column under ScheduleSyncCard.
- Verify urgency badges use token colors only.
- Verify empty state: "No deadlines yet — add one above".
- Verify loading skeleton matches list shape.

### 5.4 `src/components/dashboard/ScheduleSyncCard.tsx`
- Verify active/past/upcoming states use only `transform`/`opacity` transitions.
- Verify no decorative gradients beyond top hairline.
- Verify linked goal badge uses `emerald` only.

### 5.5 `src/components/goals/TodoList.tsx`
- Verify empty state: "No tasks yet — add one above" / "All done! Nice work."
- Verify loading skeleton if parent passes `loading`.
- Verify delete affordance: icon visible on group-hover, not mouse-only opacity trick without keyboard alternative.

---

## 6. UX HIERARCHY & PROGRESSIVE DISCLOSURE
1. **Primary focal point**: MonthWall 3D calendar. It must be visually dominant via size, position, and persistent readable tilt angle.
2. **Secondary**: ScheduleSyncCard — today's time blocks, active block emphasized.
3. **Tertiary**: DeadlinesCard — urgency-sorted list, overdue/today highlighted.
4. **Quaternary**: WeekBoard + TodoList + WeeklyGoalsView — supporting context, collapsible/expandable where possible.
5. **Hidden until needed**: advanced filters, completed deadlines toggle, all-done todos toggle. Default to common case.

---

## 7. ANTI-SLOP CHECKLIST (hard gate)
- [ ] No emoji as icons.
- [ ] No neon glow / colored drop-shadow.
- [ ] No decorative infinite loops.
- [ ] No mixed icon sets (lucide only).
- [ ] No per-component bespoke shadow/radius/border tokens.
- [ ] No raw hex/rgba in `.tsx` component bodies except approved token reads.
- [ ] No `backdrop-blur` glassmorphism on chrome surfaces.
- [ ] No more than 2 signal hues per view.

---

## 8. DELIVERABLE FORMAT
Return ONE document with these sections in order:
1. **Concept essence + metaphor** — why 3D wall fits Gold page.
2. **Research summary** — how 21st.dev reference was adapted to dark metallic chrome.
3. **Candidate list + fit-rubric** — at least 3 layout candidates, scored, winner justified.
4. **Integration plan** — exact placement, hierarchy, states per card, micro-detail layer, reduced-motion behavior.
5. **Guardrail checklist** — LAMINAR + accessibility + performance.
6. **Implementation plan** — exact file paths, exact line ranges, exact deletions, exact insertions, exact render tree.
7. **Verification plan** — build command, grep gates, runtime checks, screenshot plan.

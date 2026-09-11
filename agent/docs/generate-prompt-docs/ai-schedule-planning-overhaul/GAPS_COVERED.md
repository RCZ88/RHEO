Here are the answers. Concise, actionable, no essays.

---

## Gap 1: Deadlines vs Reminders

**Decision:** Merge concepts. `deadlines` becomes the canonical table. Existing `reminders` rows migrate into `deadlines` with `category = 'reminder'`.

**Why:** One notification system, one UI, less confusion. A deadline IS a reminder with a due date.

**Code:**

```sql
-- Migration in 002_merge_reminders.sql
INSERT INTO deadlines (id, title, course, due_date, priority, status, description, created_at)
SELECT 
  id,
  text,
  NULL,
  COALESCE(due_date, datetime('now', '+1 day')),
  'medium',
  CASE WHEN done = 1 THEN 'done' ELSE 'pending' END,
  NULL,
  created_at
FROM reminders;
```

Drop `reminders` table after migration. Update all `getReminders` IPC calls to query `deadlines WHERE category = 'reminder' OR category IS NULL`.

---

## Gap 2: Multi-Tier Notifications

**Decision:** `deadlines` gets `notified_at` JSON column. Check runs every 5 minutes.

**Code:**

```sql
ALTER TABLE deadlines ADD COLUMN notified_at TEXT DEFAULT '{}'; -- JSON: {"1d": false, "3h": false, "1h": false}
```

```ts
// src/main/notifications.ts
const TIERS = [
  { key: '1d', ms: 86400000 },
  { key: '3h', ms: 10800000 },
  { key: '1h', ms: 3600000 },
]

export function checkDeadlines(db: any) {
  const now = Date.now()
  const rows = db.prepare('SELECT * FROM deadlines WHERE status != "done"').all()
  
  for (const row of rows) {
    const notified = JSON.parse(row.notified_at || '{}')
    const due = new Date(row.due_date).getTime()
    const timeLeft = due - now
    
    for (const tier of TIERS) {
      if (timeLeft <= tier.ms && timeLeft > 0 && !notified[tier.key]) {
        showNotification(
          `${tier.key} until deadline`,
          `${row.title}${row.course ? ` (${row.course})` : ''}`
        )
        notified[tier.key] = true
        db.prepare('UPDATE deadlines SET notified_at = ? WHERE id = ?')
          .run(JSON.stringify(notified), row.id)
        break // one notification per check
      }
    }
  }
}
```

---

## Gap 3: Deadline Input UI

**Decision:** Quick input bar in `DeadlineTrackerCard` header, same pattern as `WeeklyScheduleCard`.

**Code:**

```tsx
// In DeadlineTrackerCard.tsx, add to header:
<div className="dk-deadline-quick">
  <input
    value={quickInput}
    onChange={e => setQuickInput(e.target.value)}
    onKeyDown={e => e.key === 'Enter' && handleAdd()}
    placeholder="Math 101 Assignment due Friday 11:59pm"
    className="dk-deadline-input"
  />
  <button onClick={handleAdd} className="dk-deadline-add">+</button>
</div>

// handleAdd:
const handleAdd = () => {
  const parsed = parseDeadlineInput(quickInput)
  if (parsed) {
    onAdd(parsed) // calls IPC 'add-deadline'
    setQuickInput('')
  } else {
    showToast('Could not parse deadline. Try: "Course Name Task due Day Time"', 'error')
  }
}
```

---

## Gap 4: Schedule Entry Methods

**Decision:** Two methods. Text input for bulk speed. Click-to-add for precision.

**Code:**

```tsx
// In WeeklyScheduleCard, add click handler on empty time slots:
<div 
  className="dk-schedule-day-body"
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const hour = Math.floor(y / 40) + 8
      setQuickInput(`${DAYS[dayIndex]} ${hour}:00-${hour + 1}:00 `)
      // Focus the input
      inputRef.current?.focus()
    }
  }}
>
```

---

## Gap 5: Daily Planner Creation

**Decision:** Read-only display. Creation happens in source cards (FocusCard for goals, DeadlineTrackerCard for deadlines, WeeklyScheduleCard for schedule). Planner is the **dashboard**, not the **editor**.

**Code:** No changes. Planner stays read-only. Add a subtle hint:

```tsx
<span className="dk-planner-hint">Add goals in Focus · Add deadlines in Deadlines</span>
```

---

## Gap 6: Template Selection UI

**Decision:** Button on `WeeklyScheduleCard` header → dropdown with built-in + saved templates.

**Code:**

```tsx
// In WeeklyScheduleCard header:
<div className="dk-schedule-templates">
  <button onClick={() => setShowTemplates(!showTemplates)}>Templates ▾</button>
  {showTemplates && (
    <div className="dk-schedule-template-list">
      {templates.map(t => (
        <button key={t.id} onClick={() => onApplyTemplate(t.id)}>
          {t.name}
        </button>
      ))}
      <button onClick={() => onSaveCurrentAsTemplate()}>Save current as template...</button>
    </div>
  )}
</div>
```

---

## Gap 7: Course Management

**Decision:** Free-text label. No courses table. Derive from schedule entries automatically.

**Code:**

```ts
// When adding a deadline, auto-suggest courses from existing schedule entries:
function getKnownCourses(db: any): string[] {
  const rows = db.prepare('SELECT DISTINCT title FROM schedule_entries').all()
  return rows.map(r => r.title)
}

// Show as datalist in deadline input:
<input list="courses" ... />
<datalist id="courses">
  {knownCourses.map(c => <option key={c} value={c} />)}
</datalist>
```

---

## Gap 8: Parser → DB → Card Wiring

**Decision:** Each card fetches its own data on mount via IPC. Parser runs in renderer, then IPC to save.

**Code:**

```tsx
// WeeklyScheduleCard.tsx
export function WeeklyScheduleCard({ onAdd, onDelete }: Props) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  
  useEffect(() => {
    window.deskflowAPI['get-schedule']().then(setEntries)
  }, [])
  
  const handleQuickAdd = async (text: string) => {
    const parsed = parseScheduleInput(text)
    if (!parsed) return
    const saved = await window.deskflowAPI['add-schedule-entry'](parsed)
    setEntries(prev => [...prev, { ...parsed, id: saved.id }])
  }
  
  // ... render
}
```

Same pattern for `DeadlineTrackerCard` with `get-deadlines` / `add-deadline`.

---

## Gap 9: Existing Reminders Migration

**Decision:** One-time migration. Reminders table dropped after.

**Code:**

```ts
// In runMigrations.ts, add:
{ version: 2, file: '002_merge_reminders.sql' }

// 002_merge_reminders.sql:
BEGIN TRANSACTION;
INSERT INTO deadlines (id, title, due_date, status, description, created_at)
SELECT id, text, COALESCE(due_date, datetime('now', '+1 day')), 
  CASE WHEN done = 1 THEN 'done' ELSE 'pending' END,
  CASE WHEN goal_id IS NOT NULL THEN 'goal:' || goal_id ELSE NULL END,
  created_at
FROM reminders;
DROP TABLE reminders;
COMMIT;
```

Update `useReminders` hook to query `deadlines` instead.

---

## Gap 10: Recurring Reminders

**Decision:** Add `recurrence` column to `deadlines`. Values: `null`, `'daily'`, `'weekly'`, `'custom:{days}'`.

**Code:**

```sql
ALTER TABLE deadlines ADD COLUMN recurrence TEXT;
ALTER TABLE deadlines ADD COLUMN recurrence_end TEXT; -- ISO date or null
```

```ts
// When marking done on recurring deadline:
function handleComplete(id: string) {
  const dl = db.prepare('SELECT * FROM deadlines WHERE id = ?').get(id)
  if (dl.recurrence) {
    const nextDue = calculateNextDue(dl.due_date, dl.recurrence)
    db.prepare('UPDATE deadlines SET due_date = ?, notified_at = ? WHERE id = ?')
      .run(nextDue, '{}', id)
    // Don't mark done — just move forward
  } else {
    db.prepare('UPDATE deadlines SET status = "done" WHERE id = ?').run(id)
  }
}
```

---

## Gap 11: `parseNaturalDate` Implementation

**Decision:** Use `date-fns`. It's already in the project.

**Code:**

```ts
import { parse, addDays, isValid, format } from 'date-fns'

function parseNaturalDate(text: string): string | null {
  // Try direct ISO first
  const iso = new Date(text)
  if (isValid(iso)) return iso.toISOString()
  
  // Try date-fns parse with common formats
  const formats = ['MMM d yyyy', 'MMM d', 'M/d/yyyy', 'M/d', 'yyyy-MM-dd']
  for (const f of formats) {
    const parsed = parse(text, f, new Date())
    if (isValid(parsed)) return parsed.toISOString()
  }
  
  // Relative: "next Friday", "tomorrow"
  const lower = text.toLowerCase()
  const now = new Date()
  
  if (lower.includes('tomorrow')) return addDays(now, 1).toISOString()
  
  const dayMatch = lower.match(/\bnext\s+(mon|tue|wed|thu|fri|sat|sun)/)
  if (dayMatch) {
    const dayMap = { mon:1, tue:2, wed:3, thu:4, fri:5, sat:6, sun:0 }
    const target = dayMap[dayMatch[1] as keyof typeof dayMap]
    let daysUntil = target - now.getDay()
    if (daysUntil <= 0) daysUntil += 7
    return addDays(now, daysUntil).toISOString()
  }
  
  return null
}
```

---

## Gap 12: Snooze Functionality

**Decision:** `snoozed_until` column. Check function skips snoozed items.

**Code:**

```sql
ALTER TABLE deadlines ADD COLUMN snoozed_until TEXT;
```

```ts
// In checkDeadlines():
const rows = db.prepare(`
  SELECT * FROM deadlines 
  WHERE status != 'done' 
    AND (snoozed_until IS NULL OR snoozed_until <= ?)
`).all(new Date().toISOString())

// Snooze IPC:
'snooze-deadline': (id: string, minutes: number) => {
  const until = new Date(Date.now() + minutes * 60000).toISOString()
  db.prepare('UPDATE deadlines SET snoozed_until = ? WHERE id = ?').run(until, id)
}
```

UI: Right-click or ⋮ menu on deadline item → "Snooze" → 15min / 1hr / Tomorrow.

---

## Gap 13: Self-Contained Card Data Fetching

**Decision:** Each card fetches its own data via IPC on mount. No parent prop-drilling.

**Code:**

```tsx
// Pattern for ALL canvas cards:
export function SomeCard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    let mounted = true
    window.deskflowAPI['get-some-data']().then(res => {
      if (mounted) { setData(res); setLoading(false) }
    })
    return () => { mounted = false }
  }, [])
  
  if (loading) return <div className="dk-card-loading">Loading...</div>
  // ... render
}
```

For real-time updates, add a refresh interval:

```ts
useEffect(() => {
  const interval = setInterval(() => {
    window.deskflowAPI['get-deadlines']().then(setDeadlines)
  }, 30000) // 30s refresh
  return () => clearInterval(interval)
}, [])
```

---

## Summary Table

| Gap | Decision | Code Change |
|---|---|---|
| 1 | Merge reminders into deadlines | Migration SQL + update hooks |
| 2 | `notified_at` JSON + tier loop | Add column + rewrite checkDeadlines |
| 3 | Quick input bar in DeadlineTrackerCard | Add input + button |
| 4 | Text input + click-to-add | Add onClick handler on time slots |
| 5 | Read-only planner | No code change, add hint text |
| 6 | Template dropdown in schedule header | Add dropdown UI |
| 7 | Free-text course, auto-suggest from schedule | Datalist from schedule titles |
| 8 | Cards fetch own data via IPC on mount | useEffect + IPC in each card |
| 9 | One-time migration, drop reminders table | Migration SQL |
| 10 | `recurrence` column on deadlines | Add column + completion logic |
| 11 | Use `date-fns` | Import + rewrite parseNaturalDate |
| 12 | `snoozed_until` column | Add column + skip in check + context menu |
| 13 | Self-contained fetching | useEffect pattern in all cards |

---

**Send this to your agent. All 13 gaps closed. Implementation can start.**
I see the pivot. You're shifting from the Drafting Table infrastructure to a **real user-facing feature** — a Student Schedule & Planning System. This makes sense: the canvas is the container, but the schedule system is the content that makes it valuable.

Let me engineer this properly. The core constraint is **no API access to school LMS apps**, so the solution must make manual input faster than any automated connection could ever be.

---

## Student Schedule & Planning System — Engineering Spec

### Philosophy

> **"10 seconds to add a class. 2 seconds to see your week. 0 seconds to miss a deadline."**

The system has three layers:

| Layer | What It Does | User Interaction |
|---|---|---|
| **Input** | Parse natural language into structured data | Type "Mon 9am Math 101 Room 204" → done |
| **Storage** | SQLite tables for schedules, deadlines, templates | Automatic |
| **Display** | Canvas cards (weekly grid, daily planner, deadline tracker) | Glanceable |

---

## 1. DB Schema (New Tables)

Add to `src/main.ts` after existing `CREATE TABLE` statements:

```sql
-- Schedule entries (classes, labs, recurring events)
CREATE TABLE IF NOT EXISTS schedule_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon
  start_time TEXT NOT NULL, -- "HH:MM" format
  end_time TEXT NOT NULL,   -- "HH:MM" format
  category TEXT DEFAULT 'class', -- class, lab, study, exam, personal
  color TEXT DEFAULT '#22d3ee', -- hex color for calendar display
  is_recurring INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Deadlines (assignments, exams, projects)
CREATE TABLE IF NOT EXISTS deadlines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT, -- e.g., "Math 101"
  due_date TEXT NOT NULL, -- ISO datetime
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  status TEXT DEFAULT 'pending', -- pending, in_progress, submitted, done
  description TEXT,
  reminder_sent INTEGER DEFAULT 0, -- flag for notification dedup
  created_at TEXT DEFAULT (datetime('now'))
);

-- Schedule templates (preset patterns)
CREATE TABLE IF NOT EXISTS schedule_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entries_json TEXT NOT NULL, -- JSON array of schedule entry objects
  is_builtin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 2. IPC Endpoints (Add to `src/main.ts`)

```ts
// Schedule entries
'get-schedule': () => db.prepare('SELECT * FROM schedule_entries ORDER BY day_of_week, start_time').all()
'add-schedule-entry': (entry) => db.prepare('INSERT INTO schedule_entries (id, title, location, day_of_week, start_time, end_time, category, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(generateUUID(), entry.title, entry.location, entry.day_of_week, entry.start_time, entry.end_time, entry.category, entry.color)
'delete-schedule-entry': (id) => db.prepare('DELETE FROM schedule_entries WHERE id = ?').run(id)
'update-schedule-entry': (id, patch) => { /* dynamic update */ }

// Deadlines
'get-deadlines': (opts) => {
  const { days = 30, course } = opts || {}
  const cutoff = new Date(Date.now() + days * 86400000).toISOString()
  let sql = 'SELECT * FROM deadlines WHERE due_date <= ? AND status != "done" ORDER BY due_date ASC'
  const params = [cutoff]
  if (course) { sql += ' AND course = ?'; params.push(course) }
  return db.prepare(sql).all(...params)
}
'add-deadline': (dl) => db.prepare('INSERT INTO deadlines (id, title, course, due_date, priority, description) VALUES (?, ?, ?, ?, ?, ?)').run(generateUUID(), dl.title, dl.course, dl.due_date, dl.priority, dl.description)
'update-deadline-status': (id, status) => db.prepare('UPDATE deadlines SET status = ? WHERE id = ?').run(status, id)
'delete-deadline': (id) => db.prepare('DELETE FROM deadlines WHERE id = ?').run(id)

// Templates
'get-schedule-templates': () => db.prepare('SELECT * FROM schedule_templates').all()
'apply-schedule-template': (templateId) => {
  const tpl = db.prepare('SELECT entries_json FROM schedule_templates WHERE id = ?').get(templateId)
  if (!tpl) return { error: 'Template not found' }
  const entries = JSON.parse(tpl.entries_json)
  const tx = db.transaction(() => {
    for (const e of entries) {
      db.prepare('INSERT INTO schedule_entries (id, title, location, day_of_week, start_time, end_time, category, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(generateUUID(), e.title, e.location, e.day_of_week, e.start_time, e.end_time, e.category, e.color)
    }
  })
  tx()
  return { count: entries.length }
}
```

---

## 3. Natural Language Parser

**File:** `src/lib/scheduleParser.ts`

```ts
interface ParsedScheduleEntry {
  title: string
  location?: string
  dayOfWeek: number // 0-6
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
  category: string
}

interface ParsedDeadline {
  title: string
  course?: string
  dueDate: string // ISO
  priority: string
}

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

export function parseScheduleInput(input: string): ParsedScheduleEntry | null {
  // "Monday 9am-10:30am: Math 101 in Room 204"
  // "Wed 2pm-3:30pm Lab Session"
  // "Fri 14:00-16:00 Study Group @ Library"
  
  const dayMatch = input.match(/\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)
  if (!dayMatch) return null
  
  const dayOfWeek = DAY_MAP[dayMatch[1].toLowerCase()]
  
  // Time patterns: 9am-10:30am, 14:00-16:00, 9:00 AM - 10:30 AM
  const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!timeMatch) return null
  
  const startTime = normalizeTime(timeMatch[1], timeMatch[2], timeMatch[3])
  const endTime = normalizeTime(timeMatch[4], timeMatch[5], timeMatch[6] || timeMatch[3])
  
  // Title: everything after the colon, or everything after time
  let title = input.split(/[:@]/)[1]?.trim() || input.replace(dayMatch[0], '').replace(timeMatch[0], '').trim()
  
  // Location: "in Room 204", "@ Library"
  let location: string | undefined
  const locMatch = input.match(/(?:in|@|at)\s+(.+?)(?:\s*$|\s+(?=\())/i)
  if (locMatch) {
    location = locMatch[1].trim()
    title = title.replace(locMatch[0], '').trim()
  }
  
  // Category detection
  let category = 'class'
  const lower = input.toLowerCase()
  if (lower.includes('lab')) category = 'lab'
  else if (lower.includes('study')) category = 'study'
  else if (lower.includes('exam')) category = 'exam'
  
  return { title, location, dayOfWeek, startTime, endTime, category }
}

export function parseDeadlineInput(input: string): ParsedDeadline | null {
  // "Math 101 Assignment 3 due Friday 11:59pm"
  // "Project proposal due next Tuesday"
  // "CS201 midterm exam due 2026-08-15"
  
  const dueMatch = input.match(/due\s+(.+?)(?:\s*$|\.)/i)
  if (!dueMatch) return null
  
  const dueText = dueMatch[1].trim()
  const dueDate = parseNaturalDate(dueText) // helper: "Friday 11:59pm" → ISO string
  
  if (!dueDate) return null
  
  // Extract title (everything before "due")
  let title = input.split(/due/i)[0].trim()
  
  // Extract course (capitalized word at start, e.g., "Math 101", "CS201")
  const courseMatch = title.match(/^([A-Z]{2,}\s*\d{3}[A-Z]?)/i)
  const course = courseMatch ? courseMatch[1] : undefined
  if (course) title = title.replace(course, '').trim()
  
  // Priority detection
  let priority = 'medium'
  const lower = input.toLowerCase()
  if (lower.includes('urgent') || lower.includes('critical')) priority = 'critical'
  else if (lower.includes('important')) priority = 'high'
  
  return { title, course, dueDate, priority }
}

function normalizeTime(hour: string, minute: string | undefined, ampm: string | undefined): string {
  let h = parseInt(hour)
  const m = minute ? parseInt(minute) : 0
  if (ampm?.toLowerCase() === 'pm' && h !== 12) h += 12
  if (ampm?.toLowerCase() === 'am' && h === 12) h = 0
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function parseNaturalDate(text: string): string | null {
  // Use date-fns parse or simple regex for common patterns
  // "Friday 11:59pm" → next Friday at 23:59
  // "next Tuesday" → next Tuesday at 23:59
  // "2026-08-15" → direct parse
  // This is a simplified version — expand with a real date parser
  const now = new Date()
  
  // Direct ISO/date
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return new Date(text).toISOString()
  }
  
  // Day of week
  const dayMatch = text.match(/\b(mon|tue|wed|thu|fri|sat|sun)\b/i)
  if (dayMatch) {
    const targetDay = DAY_MAP[dayMatch[1].toLowerCase()]
    const daysUntil = (targetDay - now.getDay() + 7) % 7
    const target = new Date(now)
    target.setDate(now.getDate() + (daysUntil === 0 ? 7 : daysUntil))
    
    // Time
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (timeMatch) {
      const h = parseInt(timeMatch[1])
      const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0
      const ampm = timeMatch[3]
      target.setHours(ampm?.toLowerCase() === 'pm' && h !== 12 ? h + 12 : h, m, 0, 0)
    } else {
      target.setHours(23, 59, 0, 0)
    }
    return target.toISOString()
  }
  
  return null
}
```

---

## 4. Frontend Components (Canvas Cards)

### A. Weekly Schedule Card

**File:** `src/components/ai/canvas/cards/WeeklyScheduleCard.tsx`

```tsx
interface WeeklyScheduleCardProps {
  entries: ScheduleEntry[]
  onAdd: (entry: ParsedScheduleEntry) => void
  onDelete: (id: string) => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8am to 9pm

export function WeeklyScheduleCard({ entries, onAdd, onDelete }: WeeklyScheduleCardProps) {
  const [quickInput, setQuickInput] = useState('')
  
  const handleQuickAdd = () => {
    const parsed = parseScheduleInput(quickInput)
    if (parsed) {
      onAdd(parsed)
      setQuickInput('')
    }
  }
  
  // Group entries by day
  const byDay = entries.reduce((acc, e) => {
    acc[e.day_of_week] = acc[e.day_of_week] || []
    acc[e.day_of_week].push(e)
    return acc
  }, {} as Record<number, ScheduleEntry[]>)
  
  return (
    <div className="dk-schedule-card">
      <div className="dk-schedule-header">
        <span>Weekly Schedule</span>
        <div className="dk-schedule-quick">
          <input
            value={quickInput}
            onChange={e => setQuickInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            placeholder="Mon 9am-10:30am Math 101"
            className="dk-schedule-input"
          />
          <button onClick={handleQuickAdd} className="dk-schedule-add">+</button>
        </div>
      </div>
      
      <div className="dk-schedule-grid">
        <div className="dk-schedule-time-col">
          {HOURS.map(h => (
            <div key={h} className="dk-schedule-time">{h}:00</div>
          ))}
        </div>
        {DAYS.map((day, i) => (
          <div key={day} className="dk-schedule-day-col">
            <div className="dk-schedule-day-header">{day}</div>
            <div className="dk-schedule-day-body">
              {(byDay[i] || []).map(entry => (
                <div
                  key={entry.id}
                  className="dk-schedule-block"
                  style={{
                    top: `${(parseInt(entry.start_time) - 8) * 40}px`,
                    height: `${(timeToMinutes(entry.end_time) - timeToMinutes(entry.start_time)) * 40 / 60}px`,
                    background: entry.color + '20',
                    borderLeft: `3px solid ${entry.color}`,
                  }}
                  title={`${entry.title} ${entry.location ? '@ ' + entry.location : ''}`}
                >
                  <span className="dk-schedule-block-title">{entry.title}</span>
                  <span className="dk-schedule-block-time">{entry.start_time}-{entry.end_time}</span>
                  <button className="dk-schedule-block-del" onClick={() => onDelete(entry.id)}>×</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
```

**CSS:**
```css
.dk-schedule-card { width: 100%; }
.dk-schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #1e1e2a;
}
.dk-schedule-header span { font-size: 13px; font-weight: 600; }
.dk-schedule-quick { display: flex; gap: 6px; }
.dk-schedule-input {
  background: #0a0a0f;
  border: 1px solid #1e1e2a;
  border-radius: 6px;
  padding: 4px 8px;
  color: #e4e4e7;
  font-size: 12px;
  width: 200px;
}
.dk-schedule-add {
  width: 26px; height: 26px;
  border-radius: 6px;
  background: #22d3ee;
  color: #0a0a0f;
  border: none;
  cursor: pointer;
  font-size: 16px;
  display: flex; align-items: center; justify-content: center;
}

.dk-schedule-grid {
  display: grid;
  grid-template-columns: 40px repeat(7, 1fr);
  gap: 1px;
  background: #1e1e2a;
  border-radius: 8px;
  overflow: hidden;
}
.dk-schedule-time-col {
  background: #111118;
  padding: 4px;
}
.dk-schedule-time {
  height: 40px;
  font-size: 10px;
  color: #52525b;
  font-family: var(--mono, monospace);
  display: flex; align-items: center; justify-content: flex-end;
  padding-right: 4px;
}
.dk-schedule-day-col { background: #111118; }
.dk-schedule-day-header {
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: #a1a1aa;
  padding: 6px;
  border-bottom: 1px solid #1e1e2a;
}
.dk-schedule-day-body { position: relative; height: 560px; }
.dk-schedule-block {
  position: absolute;
  left: 2px; right: 2px;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 11px;
  overflow: hidden;
  cursor: pointer;
  transition: opacity 0.15s;
}
.dk-schedule-block:hover { opacity: 0.9; }
.dk-schedule-block-title { display: block; font-weight: 500; color: #e4e4e7; line-height: 1.2; }
.dk-schedule-block-time { font-size: 9px; color: #71717a; font-family: var(--mono, monospace); }
.dk-schedule-block-del {
  position: absolute; top: 2px; right: 2px;
  background: none; border: none; color: #52525b;
  cursor: pointer; font-size: 12px; opacity: 0;
}
.dk-schedule-block:hover .dk-schedule-block-del { opacity: 1; }
```

---

### B. Deadline Tracker Card

**File:** `src/components/ai/canvas/cards/DeadlineTrackerCard.tsx`

```tsx
interface DeadlineTrackerCardProps {
  deadlines: Deadline[]
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}

export function DeadlineTrackerCard({ deadlines, onStatusChange, onDelete }: DeadlineTrackerCardProps) {
  const now = Date.now()
  
  const sorted = [...deadlines].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
  
  return (
    <div className="dk-deadline-card">
      <div className="dk-deadline-header">
        <span>Deadlines</span>
        <span className="dk-deadline-count">{deadlines.length} pending</span>
      </div>
      <div className="dk-deadline-list">
        {sorted.map(dl => {
          const due = new Date(dl.due_date).getTime()
          const hoursLeft = Math.floor((due - now) / 3600000)
          const daysLeft = Math.floor(hoursLeft / 24)
          const isOverdue = hoursLeft < 0
          const isUrgent = hoursLeft < 24 && hoursLeft > 0
          
          let timeText: string
          if (isOverdue) timeText = `${Math.abs(daysLeft)}d overdue`
          else if (daysLeft > 0) timeText = `${daysLeft}d ${hoursLeft % 24}h left`
          else if (hoursLeft > 0) timeText = `${hoursLeft}h left`
          else timeText = 'Due now'
          
          return (
            <div key={dl.id} className={`dk-deadline-item ${isOverdue ? 'overdue' : ''} ${isUrgent ? 'urgent' : ''}`}>
              <div className="dk-deadline-main">
                <span className="dk-deadline-title">{dl.title}</span>
                {dl.course && <span className="dk-deadline-course">{dl.course}</span>}
              </div>
              <div className="dk-deadline-meta">
                <span className="dk-deadline-time">{timeText}</span>
                <span className={`dk-deadline-priority ${dl.priority}`}>{dl.priority}</span>
              </div>
              <div className="dk-deadline-actions">
                <button onClick={() => onStatusChange(dl.id, 'done')}>✓</button>
                <button onClick={() => onDelete(dl.id)}>×</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**CSS:**
```css
.dk-deadline-card { width: 100%; }
.dk-deadline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
}
.dk-deadline-count { font-size: 11px; color: #71717a; }
.dk-deadline-list { display: flex; flex-direction: column; gap: 6px; }
.dk-deadline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #0a0a0f;
  border-radius: 8px;
  border: 1px solid #1e1e2a;
  transition: border-color 0.15s;
}
.dk-deadline-item.urgent { border-color: #fbbf24; }
.dk-deadline-item.overdue { border-color: #f87171; }
.dk-deadline-main { flex: 1; min-width: 0; }
.dk-deadline-title { font-size: 12px; font-weight: 500; color: #e4e4e7; display: block; }
.dk-deadline-course { font-size: 10px; color: #71717a; }
.dk-deadline-meta { display: flex; gap: 8px; align-items: center; }
.dk-deadline-time { font-size: 11px; color: #a1a1aa; font-family: var(--mono, monospace); }
.dk-deadline-priority {
  font-size: 9px; font-weight: 600; text-transform: uppercase;
  padding: 2px 6px; border-radius: 4px;
}
.dk-deadline-priority.low { background: rgba(34,197,94,0.1); color: #4ade80; }
.dk-deadline-priority.medium { background: rgba(34,211,238,0.1); color: #22d3ee; }
.dk-deadline-priority.high { background: rgba(251,191,36,0.1); color: #fbbf24; }
.dk-deadline-priority.critical { background: rgba(248,113,113,0.1); color: #f87171; }
.dk-deadline-actions { display: flex; gap: 4px; }
.dk-deadline-actions button {
  background: none; border: none; color: #52525b;
  cursor: pointer; padding: 2px 6px; border-radius: 4px;
  font-size: 12px;
}
.dk-deadline-actions button:hover { background: rgba(255,255,255,0.05); color: #e4e4e7; }
```

---

### C. Daily Planner Card

**File:** `src/components/ai/canvas/cards/DailyPlannerCard.tsx`

```tsx
interface DailyPlannerCardProps {
  schedule: ScheduleEntry[]
  deadlines: Deadline[]
  goals: Goal[]
  onToggleGoal: (goal: Goal) => void
}

export function DailyPlannerCard({ schedule, deadlines, goals, onToggleGoal }: DailyPlannerCardProps) {
  const today = new Date().getDay()
  const todaySchedule = schedule.filter(e => e.day_of_week === today)
  const upcomingDeadlines = deadlines.filter(d => {
    const due = new Date(d.due_date)
    const now = new Date()
    const days = (due.getTime() - now.getTime()) / 86400000
    return days >= 0 && days <= 7
  })
  
  const completedGoals = goals.filter(g => g.status === 'done').length
  const totalGoals = goals.length
  
  return (
    <div className="dk-planner-card">
      <div className="dk-planner-header">
        <span>Today</span>
        <span className="dk-planner-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>
      
      <div className="dk-planner-progress">
        <div className="dk-planner-bar">
          <div className="dk-planner-fill" style={{ width: `${totalGoals ? (completedGoals / totalGoals) * 100 : 0}%` }} />
        </div>
        <span>{completedGoals}/{totalGoals} goals</span>
      </div>
      
      <div className="dk-planner-section">
        <span className="dk-planner-label">Schedule</span>
        {todaySchedule.length === 0 ? (
          <span className="dk-planner-empty">No classes today</span>
        ) : (
          todaySchedule.map(s => (
            <div key={s.id} className="dk-planner-item">
              <span className="dk-planner-time">{s.start_time}-{s.end_time}</span>
              <span className="dk-planner-name">{s.title}</span>
              {s.location && <span className="dk-planner-loc">@ {s.location}</span>}
            </div>
          ))
        )}
      </div>
      
      <div className="dk-planner-section">
        <span className="dk-planner-label">Upcoming Deadlines</span>
        {upcomingDeadlines.slice(0, 3).map(d => (
          <div key={d.id} className="dk-planner-deadline">
            <span>{d.title}</span>
            <span className="dk-planner-due">{formatRelativeDate(d.due_date)}</span>
          </div>
        ))}
      </div>
      
      <div className="dk-planner-section">
        <span className="dk-planner-label">Goals</span>
        {goals.map(g => (
          <div key={g.id} className="dk-planner-goal" onClick={() => onToggleGoal(g)}>
            <span className={`dk-planner-check ${g.status === 'done' ? 'done' : ''}`}>{g.status === 'done' ? '✓' : '○'}</span>
            <span className={g.status === 'done' ? 'done' : ''}>{g.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatRelativeDate(iso: string): string {
  const due = new Date(iso)
  const now = new Date()
  const days = Math.floor((due.getTime() - now.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}
```

---

## 5. Desktop Notifications

**File:** `src/main/notifications.ts`

```ts
import { Notification } from 'electron'

export function showNotification(title: string, body: string) {
  new Notification({ title, body }).show()
}

// Call from main.ts IPC handlers or a background interval
export function checkReminders(db: any) {
  const now = new Date().toISOString()
  const soon = new Date(Date.now() + 3600000).toISOString() // 1 hour from now
  
  const due = db.prepare(`
    SELECT * FROM deadlines 
    WHERE due_date <= ? AND due_date > ? AND reminder_sent = 0 AND status != 'done'
  `).all(soon, now)
  
  for (const dl of due) {
    showNotification('Deadline approaching', `${dl.title} — ${dl.course || 'Due soon'}`)
    db.prepare('UPDATE deadlines SET reminder_sent = 1 WHERE id = ?').run(dl.id)
  }
}
```

Run `checkReminders` every 5 minutes via `setInterval` in `main.ts`.

---

## 6. Integration into Canvas

In `AiPage.tsx`, add these cards to the default canvas layout:

```tsx
// Auto-spawn on canvas mode activation:
useEffect(() => {
  if (!canvasMode) return
  
  // Only spawn if not already present
  const hasType = (type: string) => canvas.cards.some(c => c.type === type && c.pinned)
  
  if (!hasType('schedule')) {
    canvas.addCard('schedule', { entries: [] }, { pinned: true, source: 'system', position: { x: 40, y: 40 }, size: { w: 14, h: 10 } })
  }
  if (!hasType('deadlines')) {
    canvas.addCard('deadlines', { deadlines: [] }, { pinned: true, source: 'system', position: { x: 600, y: 40 }, size: { w: 6, h: 8 } })
  }
  if (!hasType('planner')) {
    canvas.addCard('planner', {}, { pinned: true, source: 'system', position: { x: 40, y: 480 }, size: { w: 8, h: 8 } })
  }
}, [canvasMode])
```

Add cases to `CanvasCard.tsx` renderer:
```tsx
case 'schedule': return <WeeklyScheduleCard entries={card.data.entries} ... />
case 'deadlines': return <DeadlineTrackerCard deadlines={card.data.deadlines} ... />
case 'planner': return <DailyPlannerCard schedule={...} deadlines={...} goals={...} ... />
```

---

## Summary: What Your Agent Should Build

| Component | File | Lines |
|---|---|---|
| `src/lib/scheduleParser.ts` | NEW | ~120 |
| `src/main/notifications.ts` | NEW | ~25 |
| `src/components/ai/canvas/cards/WeeklyScheduleCard.tsx` | NEW | ~80 |
| `src/components/ai/canvas/cards/DeadlineTrackerCard.tsx` | NEW | ~60 |
| `src/components/ai/canvas/cards/DailyPlannerCard.tsx` | NEW | ~80 |
| `src/main.ts` | EDIT | Add 3 CREATE TABLE + IPC handlers |
| `src/components/ai/canvas/CanvasCard.tsx` | EDIT | Add 3 cases to renderer |
| `src/pages/AiPage.tsx` | EDIT | Auto-spawn cards + data fetching |

---

**This is a complete, buildable spec. Send it to your agent. The parser makes manual input faster than any API connection. The cards make the data glanceable. The notifications make it impossible to miss deadlines.**

Want me to refine any part before they start building?
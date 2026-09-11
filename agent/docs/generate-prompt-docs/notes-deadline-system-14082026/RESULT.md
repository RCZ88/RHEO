# RESULT.md — Notes Deadline & Draft System Overhaul

## 0. Core Product Decision

The Notes system transitions from a "scratchpad" to a **temporal knowledge base**. 

Currently, notes are static text blocks that get truncated and lost if the editor is closed. The overhaul introduces three core pillars:

1. **Read-First Interaction** — Clicking a note opens a beautiful, full-content read-only view. Editing is a deliberate secondary action.
2. **Temporal Awareness** — Notes can have deadlines, reminders, and statuses, integrating them into the Dashboard timeline alongside Goals and Focus sessions.
3. **Zero-Loss Drafts** — The editor auto-saves in the background and intercepts accidental closures, ensuring no thought is ever lost.

The NotesTab becomes a unified inbox for ideas, tasks, and deadlines, while the Dashboard surfaces the time-sensitive ones.

---

## 1. Architecture & Data Model

### 1.1 Type Extensions

All additions are optional/nullable to maintain backward compatibility with existing notes.

```typescript
// types/note.ts
export type NoteReminder = 'none' | 'at-time' | '15min' | '1hour' | '1day'
export type NoteStatus = 'active' | 'completed' | 'overdue' | 'draft'

export interface Note {
  // ── existing, unchanged ──────────────────────────────
  id: string
  title: string
  content: string
  tags: string[]
  group_name: string
  created_at: string
  updated_at: string
  
  // ── new, additive, all nullable ──────────────────────
  deadline?: string | null         // ISO date YYYY-MM-DD
  deadline_time?: string | null    // HH:MM (optional)
  reminder?: NoteReminder | null
  status?: NoteStatus | null
  is_draft?: boolean | null        // 1 or 0 in DB
}
```

### 1.2 Status Computation Rules

The `status` field is primarily managed at read-time by the renderer to avoid constant DB updates:

```typescript
function computeNoteStatus(note: Note): NoteStatus {
  if (note.is_draft) return 'draft'
  if (note.status === 'completed') return 'completed'
  
  if (note.deadline) {
    const now = new Date()
    const deadlineDate = new Date(
      note.deadline + (note.deadline_time ? `T${note.deadline_time}` : 'T23:59:59')
    )
    
    if (deadlineDate < now) return 'overdue'
  }
  
  return 'active'
}
```

---

## 2. Database Migration & IPC Contract

### 2.1 Migration Spec

Runs in the main process DB init/runner. Plain `ALTER TABLE`.

```sql
-- migrations/00XX_notes_deadlines.sql
ALTER TABLE notes ADD COLUMN deadline      TEXT    DEFAULT NULL;
ALTER TABLE notes ADD COLUMN deadline_time TEXT    DEFAULT NULL;
ALTER TABLE notes ADD COLUMN reminder      TEXT    DEFAULT 'none';
ALTER TABLE notes ADD COLUMN status        TEXT    DEFAULT 'active';
ALTER TABLE notes ADD COLUMN is_draft      INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notes_deadline ON notes(deadline);
CREATE INDEX IF NOT EXISTS idx_notes_is_draft ON notes(is_draft);
```

### 2.2 IPC Contract Updates

The existing `notes:list`, `notes:create`, and `notes:update` endpoints are extended to handle the new fields.

**Renderer calls:**

```typescript
// Fetching with filters
const notes = await window.deskflowAPI.notesList({ 
  includeDrafts: true,
  upcomingDeadlines: true // fetches next 7 days + overdue
})

// Creating a draft on close
await window.deskflowAPI.notesCreate({
  title: 'Untitled',
  content: 'Half finished thought...',
  is_draft: 1
})

// Promoting draft to active note
await window.deskflowAPI.notesUpdate({
  id: noteId,
  is_draft: 0,
  deadline: '2026-08-20',
  reminder: '1day'
})
```

---

## 3. Notes List & Card Redesign

The `NotesTab` is split into two distinct visual zones: **Drafts** and **Active Notes**.

### 3.1 Drafts Section (Pinned Top)

If `is_draft === 1`, the note appears here.

```tsx
<section className="mb-8">
  <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
    <FileClock className="w-3.5 h-3.5" />
    Drafts ({drafts.length})
  </h3>
  
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {drafts.map(note => (
      <DraftCard key={note.id} note={note} onResume={openEditor} onDiscard={deleteNote} />
    ))}
  </div>
</section>
```

**DraftCard Visuals:**
- Border: `border-dashed border-zinc-700/60`
- Background: `bg-zinc-900/20`
- Content: Muted `text-zinc-500`, truncated to 2 lines.
- Actions: "Resume" (primary ghost button), "Discard" (icon button).

### 3.2 Active NoteCard (Click-to-Expand)

The standard `NoteCard` is now a **trigger for the Detail View**, not just an edit button.

```tsx
<button 
  onClick={() => openDetailView(note)}
  className="group relative flex flex-col gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 text-left backdrop-blur-xl transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
>
  {/* Header */}
  <div className="flex items-start justify-between gap-3">
    <h4 className="font-medium text-zinc-100 line-clamp-1">{note.title || 'Untitled'}</h4>
    <DeadlineBadge deadline={note.deadline} time={note.deadline_time} status={status} />
  </div>

  {/* Body (Truncated in card, full in detail) */}
  <p className="text-[13px] text-zinc-400 leading-relaxed line-clamp-3 flex-1">
    {note.content}
  </p>

  {/* Footer Meta */}
  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
    <span className="text-[11px] text-zinc-500 font-mono">
      {formatDistanceToNow(note.updated_at)} ago
    </span>
    <div className="flex gap-1">
      {note.tags.slice(0, 2).map(tag => (
        <span key={tag} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">
          {tag}
        </span>
      ))}
    </div>
  </div>
</button>
```

### 3.3 Deadline Badge Component

A small pill that visually communicates urgency.

```tsx
function DeadlineBadge({ deadline, time, status }) {
  if (!deadline) return null

  const isOverdue = status === 'overdue'
  const isUrgent = isWithin7Days(deadline)

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium",
      isOverdue && "bg-rose-500/10 text-rose-400 border border-rose-500/20",
      isUrgent && !isOverdue && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      !isOverdue && !isUrgent && "bg-zinc-800 text-zinc-400 border border-zinc-700"
    )}>
      <Calendar className="w-3 h-3" />
      {formatShortDate(deadline)}
    </span>
  )
}
```

---

## 4. Note Detail View (Read-Only)

When a user clicks a `NoteCard`, a large modal (or side-sheet) opens. This is the **Read-Only** view.

### 4.1 Layout Structure

```tsx
<Dialog open={!!selectedNote} onOpenChange={closeDetailView}>
  <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-zinc-950/95 border-zinc-800">
    
    {/* Header Meta */}
    <div className="p-6 border-b border-zinc-800/60">
      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-2">
        <span>{note.group_name || 'Ungrouped'}</span>
        <span>•</span>
        <span>Created {formatDate(note.created_at)}</span>
      </div>
      <h2 className="text-2xl font-display text-zinc-100 mb-4">
        {note.title || 'Untitled Note'}
      </h2>
      
      <div className="flex flex-wrap gap-2">
        {note.tags.map(tag => <TagPill key={tag} tag={tag} />)}
        {note.deadline && <DeadlineBadgeLarge note={note} />}
      </div>
    </div>

    {/* Content Body (Scrollable) */}
    <div className="flex-1 overflow-y-auto p-6">
      <div className="prose prose-invert prose-zinc max-w-none text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {note.content}
      </div>
    </div>

    {/* Action Footer */}
    <div className="p-4 border-t border-zinc-800/60 flex items-center justify-between bg-zinc-900/50">
      <Button variant="destructive" size="sm" onClick={handleDelete}>
        Delete
      </Button>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={copyToClipboard}>
          Copy Text
        </Button>
        <Button onClick={() => openEditor(note)}>
          <Pencil className="w-4 h-4 mr-2" /> Edit Note
        </Button>
      </div>
    </div>

  </DialogContent>
</Dialog>
```

---

## 5. Note Editor & Auto-Save Logic

The Editor remains a Dialog, but its lifecycle is completely overhauled to prevent data loss.

### 5.1 Auto-Save Draft Intercept

When the user clicks the `X` button or presses `ESC`, the `onOpenChange` handler intercepts the close event.

```typescript
const handleEditorClose = async (isOpen: boolean) => {
  if (isOpen) return // Opening, do nothing
  
  // Closing logic
  const hasContent = draft.title.trim().length > 0 || draft.content.trim().length > 0
  
  if (hasContent && draft.is_draft !== false) {
    // Auto-save as draft
    if (draft.id) {
      await window.deskflowAPI.notesUpdate({ ...draft, is_draft: 1 })
    } else {
      await window.deskflowAPI.notesCreate({ ...draft, is_draft: 1 })
    }
    toast.info("Saved to drafts")
  } else if (!hasContent && draft.id && draft.is_draft) {
    // Empty draft, delete it
    await window.deskflowAPI.notesDelete(draft.id)
  }
  
  setIsEditorOpen(false)
}
```

### 5.2 Deadline Picker UI

Added to the Editor footer or sidebar.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border-t border-zinc-800/60 bg-zinc-900/30">
  {/* Date */}
  <div>
    <label className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Deadline</label>
    <input 
      type="date" 
      value={draft.deadline || ''} 
      onChange={e => setDraft({ ...draft, deadline: e.target.value })}
      className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-sm text-zinc-200 focus:border-amber-500/50 outline-none"
    />
  </div>

  {/* Time (Optional) */}
  <div>
    <label className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Time (Optional)</label>
    <input 
      type="time" 
      value={draft.deadline_time || ''} 
      onChange={e => setDraft({ ...draft, deadline_time: e.target.value })}
      className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-sm text-zinc-200 focus:border-amber-500/50 outline-none"
    />
  </div>

  {/* Reminder */}
  <div>
    <label className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Remind me</label>
    <select 
      value={draft.reminder || 'none'} 
      onChange={e => setDraft({ ...draft, reminder: e.target.value })}
      className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-sm text-zinc-200 focus:border-amber-500/50 outline-none"
    >
      <option value="none">No reminder</option>
      <option value="at-time">At time of event</option>
      <option value="15min">15 minutes before</option>
      <option value="1hour">1 hour before</option>
      <option value="1day">1 day before</option>
    </select>
  </div>
</div>
```

### 5.3 "Save Note" vs "Save Draft"

The Editor footer has two distinct buttons:
1. **Save Note** (Primary): Sets `is_draft: 0`, validates required fields, closes editor.
2. **Save as Draft** (Ghost): Sets `is_draft: 1`, closes editor immediately.

---

## 6. Dashboard Integration

Notes with deadlines must surface in the Dashboard so they aren't forgotten.

### 6.1 Upcoming Deadlines Widget

A new card on the Dashboard grid, sitting alongside Goals and Focus stats.

```tsx
// src/components/dashboard/UpcomingDeadlines.tsx
export function UpcomingDeadlines() {
  const { notes } = useNotes({ upcomingDeadlines: true })
  
  const sorted = notes.sort((a, b) => 
    new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )

  return (
    <DashboardCard title="Upcoming Deadlines" icon={CalendarClock}>
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <EmptyState message="No upcoming deadlines." />
        ) : (
          sorted.slice(0, 5).map(note => (
            <DeadlineRow key={note.id} note={note} onClick={() => openNoteDetail(note)} />
          ))
        )}
      </div>
    </DashboardCard>
  )
}
```

**DeadlineRow Visuals:**
- Left: Status dot (Rose for overdue, Amber for < 3 days, Emerald for > 3 days).
- Middle: Note title (truncated) + Group name.
- Right: Relative time (e.g., "Tomorrow", "2d", "Overdue").

### 6.2 Timeline Markers

If the Dashboard features a visual Timeline or Calendar view, Notes with `deadline` are rendered as distinct markers:
- **Shape:** Diamond or Square (to differentiate from circular Goal markers).
- **Color:** `amber-400` (matching the Notes/Thoughts warmth).
- **Hover:** Shows Note title and snippet.

---

## 7. File-by-File Implementation Plan

### 7.1 Main Process
1. **`src/main/db/migrations.ts`**: Add the 5 new columns and indexes to the `notes` table.
2. **`src/main/notes/notesRepo.ts`**: Update `getAll`, `create`, and `update` queries to map the new fields. Add `getUpcomingDeadlines()` query.
3. **`src/main/notes/notesHandlers.ts`**: Register the new IPC handlers and pass-throughs.

### 7.2 Renderer Hooks
1. **`src/hooks/useNotes.ts`**: 
   - Add `status` computation logic.
   - Split return object into `drafts` and `activeNotes`.
   - Add `upcomingDeadlines` array for Dashboard consumption.

### 7.3 Components
1. **`src/components/notes/NotesTab.tsx`**: Refactor to render `<DraftsSection />` and `<ActiveNotesGrid />`.
2. **`src/components/notes/NoteCard.tsx`**: Remove `line-clamp-3` from the *detail* logic, add click handler to open Detail View, add `<DeadlineBadge />`.
3. **`src/components/notes/NoteDetailView.tsx`**: **NEW**. Full-screen read-only modal.
4. **`src/components/notes/NoteEditor.tsx`**: Add Deadline Picker, implement `handleEditorClose` auto-save intercept.
5. **`src/components/dashboard/UpcomingDeadlines.tsx`**: **NEW**. Dashboard widget.
6. **`src/components/dashboard/DashboardGrid.tsx`**: Insert `<UpcomingDeadlines />` into the layout.

---

## 8. Acceptance Criteria

The overhaul is complete when:

- [ ] Clicking a NoteCard opens a full read-only Detail View (no line-clamp truncation).
- [ ] The Detail View has an explicit "Edit" button to open the Editor.
- [ ] Closing the Editor with unsaved text automatically saves it as a Draft.
- [ ] Drafts appear in a distinct, dashed-border section at the top of the NotesTab.
- [ ] Notes can be assigned a Date, Time, and Reminder preference.
- [ ] Overdue notes display with `rose-400` accents in the list and dashboard.
- [ ] Upcoming deadlines (next 7 days) appear in the Dashboard "Upcoming Deadlines" widget.
- [ ] Deleting an empty draft happens silently; deleting an active note requires confirmation.
- [ ] All new UI elements strictly adhere to the `zinc-900/950` glassmorphism dark mode palette.
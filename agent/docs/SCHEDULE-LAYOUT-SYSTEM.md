# LAYOUT SYSTEM (replaces "TARGET LAYOUT")

> Status: **spec only — not implemented.** `src/features/warmth/schedule/layout.ts` implements
> the layout *engine* (slots, 4 presets, swap / hide / clamp / sanitize, persistence) with 27
> passing tests. The UI — panels, calendar views, header, drawer — is **not built**.
>
> Source of truth for this file: the instruction pasted by CZ, 2026-10-13. If this file and
> that message ever disagree, the message wins and this file is the thing that gets corrected.

Build the Schedule page as a layout system with 4 presets. Same 4 panels in all of them:
Calendar, Day agenda, Upcoming, Todos. Only the size and position change. Panels are real
components that do not know where they sit. A layout is just a config that says which panel
goes in which slot.

## Rules for every preset

- One screen, **NO page scroll**, at 1920x1200 and 1440x900. Page height = viewport minus top nav.
- Each panel scrolls inside itself. No big empty gaps.
- Header (one line): "Schedule" + selected date on the left. On the right: layout menu button,
  then `[Day | Week | Month]` toggle, then `[<] [Today] [>]`.
- Below 1100px width, any preset becomes one column.

## Presets

### 1) Calendar first
- Left ~65%: Calendar, full height.
- Right ~35% (min 340px): Day agenda (flexible), Upcoming, Todos stacked.

### 2) Today first *(DEFAULT)*
- Left ~45%: Day agenda as a timeline, full height.
- Right ~55%: Calendar (top, about 55% of height), Upcoming and Todos side by side below it.

### 3) Week first
- Top ~60%: Week timeline, full width.
- Bottom row: Day agenda, Upcoming, Todos in 3 equal columns.

### 4) Focus
- Calendar only, full width.
- A thin edge tab opens the other 3 panels as a slide-in drawer on the right. Esc closes it.

## Customization (closed-ended, no free-form)

- Layout menu in the header shows 4 small thumbnails. Click to switch. Animate the change
  (short, ~200ms, no bounce).
- **Swap:** drag a panel header onto another slot and the two panels swap. Slots are fixed.
  Panels cannot overlap or float.
- **Hide/show:** each panel has a small toggle in its header menu. Hidden panels free their
  space for the others.
- **Resize:** dividers can be dragged, but only inside a min and max size per panel. Snap to
  a few steps.
- Save the layout choice, the swaps, the hidden panels and the divider sizes in the existing
  settings storage. Add a "Reset layout" button.
- Do **NOT** add free dragging, floating panels or arbitrary resizing.

## Calendar views (same component, 3 modes)

- **Month:** cells stretch to fill the height. Events are small colored chips (time + title).
  Max 3 per cell, then "+N more".
- **Week:** 7 columns, time on the left side, events as blocks. Auto-scroll to now or the
  first event.
- **Day:** one column timeline.
- Click a day: it becomes the selected day and the Day agenda updates. Double click or Enter:
  opens Day view. Click a week header: opens Week view.
- **Keys:** `M` / `W` / `D` = view, `T` = today, left/right = prev/next, `1`–`4` = switch
  layout preset.
- The calendar must work well when small (Today first preset): in a small size, show the
  month grid with dots only, no chips.

## Panel rules

- **Day agenda:** sorted by time, colored dot by type, "+ Add" in the panel header. Done items
  collapse into one line "3 done". Empty state is one small line.
- **Upcoming:** same row style and colors as the agenda. Compact 1-line rows. "+" in the
  header.
- **Todos:** one input line by default. The "belongs to schedule" picker appears only when
  the input is focused, and is optional.
- Every panel has the same header height, padding and style.

## Keep from before

- Remove the 7 day cards, the M T W letter strip and the 3D Month Wall look. Use the plain
  2D calendar.
- One color source of truth (Deadline, Reminder, Goal, Schedule) used by calendar chips,
  agenda dots and Upcoming.
- One spacing scale (4, 8, 12, 16, 24). Same gap between all panels.
- Check the duplicate entries on Oct 5 and tell me. **Do not delete data.**

### Oct 5 duplicate check — RESULT (checked, nothing deleted)

There are **no duplicates on Oct 5**: 0 deadlines, 0 reminders, 0 exact-duplicate rows
anywhere in `schedule_entries`.

What does exist is **one real class stored three times** in the Monday 09:20–11:00 slot:

| created | title | location |
|---|---|---|
| Aug 26 | `Campus` | Binus University Alam Sutra |
| Sep 20 | `AlgoProg` | Binus B0501 |
| Oct 9 | `ALGO PROG` | Binus |

Same class, three casings and three levels of place detail — added three times instead of
edited once. Nothing in the schema prevents it. A unique constraint on
`(day_of_week, start_time, end_time, title)` would stop the recurrence; not added.

## Build order

1. **Layout engine:** slots, 4 presets, header menu, saving. Placeholder panels. *(engine done,
   UI not)*
2. **Calendar component** with Month, Week, Day.
3. **Day agenda, Upcoming, Todos** panels.
4. **Swap, hide/show, resize with limits, Reset.**
5. **Focus drawer, keyboard keys, colors and polish.**

## Done when

- All 4 presets fit on one screen with no scroll and no gaps at both sizes.
- Switching presets, swapping panels and reset all work and survive an app restart.
- Colors match everywhere.
---

> **Spec index:** `agent/docs/SPECS-INDEX.md`

# Worked Example: A Lecture Capture Feature

This walks the workflow against one concrete scenario, to show what the
pattern looks like filled in. It's illustrative, not a template to copy
literally — the point is the reasoning, not these specific hooks.

**The scenario**: an external AI generated a feature for a learning app. It
takes a lecture recording, transcribes it, and also parses whatever slides
or documents the professor shared, then compresses all of that into a
compact prompt so a model can generate a useful summary without burning
tokens on the raw material. On its own, it's a working page: upload files,
get a summary back.

## Phase 0 — Classify

Same stack as the host app, so the generated code is directly adaptable
rather than needing a full port. It's mostly "a piece of logic with a UI
wrapped around it" — the valuable part is the compression/prompting
approach, not the page itself.

## Phase 1 — Audit (abbreviated)

The host app already has: a to-do list, a notes feature, a schedule, and a
"learning" home page that's currently just a static list of subjects. Data
access goes through a shared ORM layer with a consistent repository
pattern per feature. There's a design-tokens file and an existing
"document upload" component used elsewhere that should be reused rather
than rebuilt.

## Phase 2 — Read the generated code as a spec

Worth keeping: the file-parsing and prompt-compression logic — this is the
actual novel work. Not worth keeping as-is: its upload UI (doesn't match
the app's existing upload component), its "summary" storage (an in-memory
array that resets on refresh).

## Phase 3 — Integration plan (excerpted)

**Data model**: new `lectures` table (recording ref, transcript, generated
summary, linked course/subject) using the existing repository pattern.
Summary text itself doesn't need a new table — it's a field, not a feature.

**Cross-feature hooks** — this is where the litmus test does the real work.
Going feature by feature:

- *To-do list*: the summary often contains action items ("read chapter 4
  before next class," "problem set due Friday"). A user would expect these
  to become real to-dos, not text they have to copy by hand. Hook: after
  summary generation, extract action items and offer to add them as to-do
  items — confirm-first rather than silent auto-add, since misreading an
  action item and silently adding a wrong to-do is worse than asking.
- *Notes*: the summary is, functionally, a set of notes for that lecture.
  A user would expect it to actually live in the notes feature, not on a
  separate island only this feature knows about. Hook: the generated
  summary is created as a note entry linked to the relevant subject, not a
  standalone record only this page can show.
- *Schedule*: mentioned dates (assignment due dates, next class topics)
  are exactly the kind of thing a user expects to end up on their
  calendar without re-entering it by hand. Hook: extracted dates are
  offered as schedule entries, same confirm-first pattern as the to-dos.
- *Learning home page*: currently a static list — this feature is the
  first thing that would actually make it dynamic. Hook: processed
  lectures show up there per subject.

**Design mapping**: reuse the existing document-upload component instead
of the generated one; summary display uses the same card/typography
tokens as the notes feature, since it's functionally the same kind of
content.

**Build order**: `lectures` table → parsing/compression service (adapted
from the generated logic) → summary UI using host components → the four
hooks above → registration on the learning home page and nav.

## Phase 5 — What verification catches here specifically

The checklist would catch, concretely: if the to-do/notes/schedule hooks
got implemented as "extract this data and log it" without an actual write
into those features' real data (easy to do when time-pressured — it looks
done because the extraction works), or if the summary UI quietly kept the
generated tool's own styling because it was faster than reusing the
existing note-card component.

## The general shape to take away

Nothing here is specific to lectures or learning apps. The pattern is:
identify what the new feature's output naturally becomes in terms the rest
of the app already understands (an action item, a note, a calendar entry),
and wire directly into those existing features rather than inventing a new,
disconnected place for that same kind of data to live.

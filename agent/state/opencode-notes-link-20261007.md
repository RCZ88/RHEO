<!-- SESSION: opencode-notes-link-20261007 -->
<!-- AGENT: opencode | TERMINAL: notes-link | PROJECT: App Tracker -->

# Agent State — opencode-notes-link-20261007

> **STATUS:** working | **UPDATED:** 2026-10-07T23:20:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Notes — inline attachments in note text, link open/copy, popup X + non-closing clicks.
**STATUS:** working
**IN FLIGHT:**
- **NOT BUILT.** Nothing here is runtime-verified. CZ must build.
- `MarkdownPreview.tsx` now has ZERO callers (NoteContent supersedes it in both notes
  files). NOT deleted — it is shared; deleting is out of scope per §0a.
- Side "Related"/"Files" sections KEPT deliberately: notes attached before this
  change store links in the `links`/`files` columns, so they still render there.
**COMPLETED:**
- CZ decided: token-in-text -> chip; images referenced by path, not copied.
- `src/features/notes/attachments.ts` — pure token parser. Validates URLs
  (http/https/mailto ONLY — `javascript:`/`data:`/`vbscript:` refused) and requires
  absolute paths. Offset-based removal so two identical tokens don't both vanish.
- `src/components/life-river/NoteContent.tsx` — note renderer: inline chips, inline
  images with a labelled not-found state, bare-URL linkification. Superset of
  MarkdownPreview syntax, so token-free notes render identically.
- Popover X button: had NO accessible name and was 18px. Now `aria-label` + 44px.
- Backdrop `onClick` -> `onMouseDown` + target check: selecting text and dragging
  past the edge no longer closes the note.
- Chip click INSPECTS (peek panel), does not navigate and does not close.
- Editor: `attachFile` inserts inline at the caret; preview uses the same renderer
  as the reader so a token never looks like raw text while writing.
- **40 new tests; 134 pass in the scoped run.** 3 of my first assertions were wrong
  (not the code) — corrected the expectations.
**NEXT ACTION:** CZ builds. Verify: attach a file -> chip appears inline; click chip
-> popup stays; select text and drag out -> stays open; X closes.

---

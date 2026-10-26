# PROMPT — Memories Page Full Revamp (Albums, Grouping, Decorations)

> **Copy everything below this line into Claude and send it.**
> A `CONTEXT_BUNDLE.md` sits next to this file. Attach it. The prompt is written
> so you can answer without it, but the bundle contains quoted source and the
> quotes are load-bearing.

---

## Role

You are a **Lead Designer and Engineer** for a personal-knowledge desktop app
(Electron + React + TypeScript + Tailwind + Framer Motion). You have shipped
photo galleries, scrapbooks, and album UIs. You know exactly why a "plain collage
of photos" feels hollow, and you are going to design a replacement — not propose
three options for someone to choose between.

## Raw Request (verbatim)

> "okay now i owuldl ke you to fix the memories page and like add a feature WHOCH
> IT TO GROUP THOSE IMAGE PROEPRLY. I SHOULD BE ABLE TO GROUP THE IMAGES AND LIKE
> ADD A TITLE AND LIKE ADD SOME DECOR LIKE THE DATE DECOR OR THE LOCATION AND STUFF
> LIKE THAT IDIOT. MAKE SURE TIJS JSUT NOT A PLAIN COLLAGE OF PHOTOS IDIOT"

> "plan out the full revamp of it"

> "user created groups and also by default should like auto grouping smart grouping
> shit. it should be that theres like the expanded version and like the ui version
> that just shows all the group. and like i need you to actually like
> @agent/skills/generate-prompt/ for this. the cover photo is auto first and then
> the user can customize. BASICALLY JUST USE THE GENERATE PROMPT"

## Problem Statement

The Memories page is bad. Not badly styled — **badly conceived.** A person
reported:

> "there's like a huge image covering the entire screen showing for like a recap
> — that is absolutely dogshit"
>
> "in terms of the overall design and like purpose and like the concept of it.
> still dogshit"

They are not asking for a reskin. They are telling you the page has no idea what
it is for. The current state:

- **Collage tab**: CSS grid of square tiles. Every 7th tile (first of each month)
  gets 2×2. No titles, no decorations, no grouping beyond auto-month.
- **Timeline tab**: vertical timeline with month headers, 4-6 col grid of square
  thumbs. Same lack of decoration.
- **Detail view (MemoryReveal)**: caption, date, notes, people. No title, no
  location, no group assignment, no tags.
- **Data model**: `MemoryItem` has `people`, `noteIds`, `phaseId`, `caption`,
  `date`, `capturedAt`. No `groupId`, no `location`, no `tags`, no `title`.
- **No concept of albums/groups**: memories are auto-sorted by month. No user-
  created collections. No cover photos. No group titles.
- **Decorations are invisible**: date, people, and location (if it existed) are
  not shown on cards. Only caption appears (on hover, at the bottom).

## What Exists (read CONTEXT_BUNDLE §2–§9 before designing)

### Components
1. `MemoriesPage.tsx` — page shell: tabs, sort, person filter, uploader, empty state
2. `MemoryCollageGrid.tsx` — CSS grid collage (3-4 cols, first-of-month 2×2)
3. `MemoryCard.tsx` — square/4:3 tile, image + caption at bottom
4. `MemoryTimeline.tsx` — vertical timeline grouped by month
5. `MemoryReveal.tsx` — fullscreen overlay: image, caption, date, notes, people
6. `MemoryUploader.tsx` — drag-and-drop / file picker
7. `OnThisDayCard.tsx` — "on this day" memories from previous years
8. `PersonChip.tsx` — removable person tag chip

### Data
- `MemoryItem`: id, kind, date, capturedAt, caption?, phaseId?, noteIds?, people[], createdAt, width?, height?, durationSec?
- Storage: one blob per memory in IndexedDB (`putBlobRecord('memories', ...)`)
- `useMemories` hook: items, upload, remove, updateMeta, onThisDay, groupedByMonth

### Design system
- Dark mode: zinc-950 bg, zinc-900 surfaces, zinc-800 borders
- Light mode: `--ws-surface-raised` bg, `--ws-border` borders
- Accent: rose (`--color-mem-400`), clay (`--color-clay-400`)
- Typography: Inter (UI), Space Grotesk (display), JetBrains Mono (dates)
- Radii: 8px tiles, 12px cards, pill chips
- Motion: L1 reactive (hover 1.015, 180ms), L2 transitional (expand 300ms)

### Existing patterns to reuse
- `LocationAutocomplete` — autocomplete with create-new, uses `deskflowAPI.getAllLocations()`
- `PersonChip` — removable person tag
- `EmptyState` — standard empty state
- `TabBar` — tab switching
- `PageShell` — page wrapper

---

## Your Job

**Design one replacement concept and specify it completely.** Not three options.
Not "here's what I'd do." A single, comprehensive design with exact specs.

Start by answering, in your own words and before any layout:

1. **What is this page for?** (one sentence)
2. **What's the primary action?** (what does the user do first?)
3. **What's the emotional register?** (contemplative, joyful, nostalgic, etc.)

Then design the full solution.

---

## Requirements

### R1 — Grouping (albums/collections)
- User-created groups with titles.
- Auto-suggest groups based on date clusters (e.g., "Summer 2024" from June-August photos).
- Cover photo: auto = first photo in group, user can override.
- Group has: title, coverId, date range (auto-derived but overridable), location, people, accent color.
- Move photos between groups (drag or "Move to..." in detail view).
- Delete group → photos become ungrouped (not deleted).
- "Ungrouped" pseudo-group for photos without a group.

### R2 — Two views
- **Albums view**: group cards (cover, title, count, date range, location). Click to expand into photo grid within group. "New Album" button.
- **All view**: single masonry grid of ALL photos with group title headers. Decorations on each tile.

### R3 — Decorations on cards
Every photo tile should show:
- **Date badge** (bottom-left, JetBrains Mono, small, semi-transparent bg)
- **Location chip** (bottom-right, if set)
- **People chips** (top-right, on hover)
- **Caption** (bottom, on hover or always for featured)
- **Group accent** (subtle border color tint for grouped photos)

### R4 — Detail view (MemoryReveal) improvements
- **Title field** (editable, above caption) — user-set title for the memory
- **Location field** (autocomplete from existing locations)
- **Group selector** (dropdown: "Ungrouped" + existing groups)
- **Tags** (free-form chips, add/remove)
- **Date** (already exists, keep)
- **People** (already exists, keep)
- **Notes** (already exists, keep)

### R5 — Data model changes
- Add to `MemoryItem`: `groupId?`, `location?`, `tags?`, `title?`
- Create `MemoryGroup` type: `id`, `title`, `coverId?`, `accent?`, `dateFrom?`, `dateTo?`, `location?`, `people?`, `order`, `createdAt`
- Groups stored as blob records (`putBlobRecord('memory-groups', ...)`)
- Migration: existing memories get `groupId = undefined` (ungrouped). No data loss.

### R6 — Visual variety (not plain collage)
- Masonry layout (CSS columns) instead of uniform grid
- Featured tile: first photo of each group/month gets 2×2 with caption visible
- Date badges, location chips, people chips as decorations
- Group title headers in "All" view
- Album cards in "Albums" view with cover, title, count, date range

---

## Constraints

- **Dark mode only** for now (light mode exists but is secondary)
- **No new dependencies** — use existing stack (React, Tailwind, Framer Motion, lucide-react)
- **Must work with existing data** — no migration that loses photos
- **Must preserve existing features** — On This Day, person filter, sort, paste-to-upload, MemoryReveal edit
- **Embedded mode** — page renders inside LifePage with `embedded` prop
- **No backend changes** — all storage is IndexedDB (localBlobStore)

---

## What to Output

1. **Concept statement** (3-5 sentences: what the page is for, primary action, emotional register)
2. **Data model changes** (exact TypeScript interfaces)
3. **Component architecture** (which components, what they do, how they connect)
4. **Visual specs** (exact hex codes, pixel spacing, font sizes, animation curves)
5. **Interaction flow** (click, hover, empty states, error states)
6. **Implementation plan** (phases, files to create/modify, estimated effort)
7. **Anti-patterns to avoid** (what NOT to do)

Do NOT provide multiple options. Do NOT say "you could do X or Y." Design ONE solution and specify it completely.

---

## Anti-Slop Checklist (the receiving AI must follow)

1. Re-skin to DeskFlow tokens (colors → CSS vars, not hardcoded hex where vars exist)
2. Max rounded-xl, p-5 padding
3. Dark mode first
4. Inter + JetBrains Mono + Space Grotesk (max 2 per view)
5. No glassmorphism on chrome (only on the memorial card gradient)
6. No decorative glow/gradients beyond the existing card gradient
7. No spring/bounce on data (use ease-out curves)
8. `prefers-reduced-motion` honored
9. All 4 states (empty/loading/error/populated) for every component
10. No emoji in UI — use lucide-react icons

---

## Design Tokens Reference

```css
--bg-primary: #09090b;
--bg-surface: #18181b;
--bg-raised: #27272a;
--text-primary: #fafafa;
--text-secondary: #a1a1aa;
--text-muted: #71717a;
--border-subtle: rgba(255,255,255,0.06);
--border-default: rgba(255,255,255,0.09);
--border-strong: rgba(255,255,255,0.14);
--color-mem-400: #e879a0;  /* rose */
--color-clay-400: #f59e0b; /* amber */
--color-accent: #fafafa;
```

### Accent palette (8 colors for groups)
```
#e879a0 (rose), #f59e0b (amber), #10b981 (emerald), #3b82f6 (blue),
#8b5cf6 (violet), #ec4899 (pink), #14b8a6 (teal), #f97316 (orange)
```

### Typography
- UI: Inter (sans-serif)
- Display/Group titles: Space Grotesk (sans-serif, weight 600)
- Dates/counts: JetBrains Mono (monospace, weight 500)

### Spacing
- Card padding: 12-16px
- Grid gap: 8-12px
- Section gap: 16-24px
- Page padding: 20px

### Motion
- Hover: scale 1.015, 180ms, ease [0.16, 1, 0.3, 1]
- Expand/collapse: 300ms, ease [0.16, 1, 0.3, 1]
- Stagger: 45ms between tiles
- Reduced motion: opacity-only, no transform

---

## MANDATORY: After Writing the Response

Save your response as `RESULT.md` in the same folder as this prompt:
`agent/docs/generate-prompt-docs/memories-albums-revamp-25102026/RESULT.md`

Then I (the agent) will:
1. Read RESULT.md fully
2. Trace the codebase to map the solution to existing code
3. Identify gaps between the solution and actual code structure
4. Plan modifications
5. Implement phase by phase

Do NOT skip saving RESULT.md. The implementation depends on it.
# Memories Page — Full Revamp Plan

> **Status:** PLAN — not yet implemented. Awaiting CZ's go-ahead.
> **Surface:** Life → Memories tab (`src/features/warmth/LifePage.tsx` → `MemoriesPage` embedded)
> **Date:** 2026-10-25

---

## 1. Current State (what exists)

### Components
| File | Role |
|---|---|
| `MemoriesPage.tsx` | Page shell: tabs (Collage/Timeline), sort, person filter, uploader, empty state |
| `MemoryCollageGrid.tsx` | CSS grid collage (3-4 cols). First photo of each month gets 2×2 tile. |
| `MemoryCard.tsx` | Square/4:3 tile: image + caption at bottom. Hover scale. |
| `MemoryTimeline.tsx` | Vertical timeline grouped by month. 4-6 col grid of square thumbs. |
| `MemoryReveal.tsx` | Full-screen overlay: image, caption, date, notes, people. |
| `MemoryUploader.tsx` | Drag-and-drop / file picker upload. |
| `OnThisDayCard.tsx` | "On this day" memories from previous years. |
| `PersonChip.tsx` | Removable person tag chip. |

### Data model (`MemoryItem`)
```
id, kind (photo|video), date, capturedAt, caption?, phaseId?, noteIds?, people[], createdAt, width?, height?, durationSec?
```

### Grouping
- Currently grouped by **month** (string slice of date) in both Collage and Timeline views.
- No concept of named groups/albums/collections.
- No location field.
- No tags beyond people.

### What the user dislikes
1. "Plain collage of photos" — no visual hierarchy beyond the first-of-month 2×2 tile.
2. No grouping with titles — months are auto-derived, not named.
3. No decorations — date/location/people not shown on cards.
4. No way to organize memories into meaningful collections.

---

## 2. Design Intent

The Memories page should feel like a **personal scrapbook / album**, not a photo grid. Each memory should carry its context (when, where, who) visibly. Groups (albums) should be first-class, named by the user, with a cover photo and date range. The page should have visual variety — not uniform squares.

### Design principles (from LAMINAR + frontend-design skills)
- **Monochrome surfaces** with ONE signal hue per group (the group's accent color).
- **Radii:** 8px (tiles), 12px (group cards), pill (chips).
- **Typography:** Inter for UI, JetBrains Mono for dates, Space Grotesk for group titles (max 2 per view).
- **Motion:** L1 (reactive) for hover, L2 (transitional) for group expand/collapse. No springs on data.
- **No glassmorphism on chrome.** No decorative glow/gradients beyond the existing memorial card gradient.
- **State coverage:** empty, loading, error, populated for every group.

---

## 3. Data Model Changes

### 3.1 MemoryItem additions
```ts
export interface MemoryItem {
  // ... existing fields ...
  /** Group/album this memory belongs to. null = ungrouped. */
  groupId?: string;
  /** Location where the memory was captured. */
  location?: string;
  /** Free-form tags for decoration/filtering. */
  tags?: string[];
  /** User-set title for this specific memory (overrides caption). */
  title?: string;
}
```

### 3.2 New MemoryGroup type
```ts
export interface MemoryGroup {
  id: string;
  title: string;
  /** Cover photo memory ID. Falls back to first memory in group. */
  coverId?: string;
  /** Accent color for this group (from a curated palette). */
  accent?: string;
  /** Date range, auto-derived from member dates but overridable. */
  dateFrom?: string;
  dateTo?: string;
  /** Location for the group (e.g., "Paris, France"). */
  location?: string;
  /** People associated with this group. */
  people?: string[];
  /** Sort order within the page. */
  order: number;
  createdAt: number;
}
```

### 3.3 Storage
- Groups stored as a separate blob record type: `putBlobRecord('memory-groups', { id, meta: group, ... })`.
- `listMemoryGroups()` returns all groups.
- `addMemoryGroup(title, coverId?)` creates a group.
- `updateMemoryGroup(id, patch)` updates metadata.
- `deleteMemoryGroup(id)` removes group; member memories get `groupId = undefined`.
- `moveMemoryToGroup(memoryId, groupId)` updates the memory's groupId.

### 3.4 Migration
- Existing memories have no groupId → they appear in an "Ungrouped" pseudo-group.
- No data loss: all existing memories remain accessible.

---

## 4. UI Changes

### 4.1 Page-level: Three tabs instead of two
Replace `Collage | Timeline` with:
- **Albums** (new) — group cards with cover, title, date range, count
- **Collage** (enhanced) — masonry grid with decorations
- **Timeline** (enhanced) — timeline with group headers

### 4.2 Albums tab (NEW)
```
┌─────────────────────────────────────────────────┐
│  [ + New Album ]                                │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────┐  │
│  │  [cover img]  │  │  [cover img]  │  │ +    │  │
│  │  Summer 2024  │  │  Family Trip  │  │ New  │  │
│  │  12 photos    │  │  8 photos     │  │      │  │
│  │  Jun–Aug 2024 │  │  Mar 2024     │  │      │  │
│  │  📍 Paris     │  │  📍 Tokyo     │  │      │  │
│  └──────────────┘  └──────────────┘  └──────┘  │
│                                                 │
│  ── Ungrouped (5) ──                            │
│  [small grid of ungrouped photos]               │
└─────────────────────────────────────────────────┘
```
- Group cards: cover photo (aspect 4:3), title (Space Grotesk), photo count, date range, location chip
- Click group → expands to show all photos in that group (masonry grid)
- "New Album" button opens a dialog: title, cover (pick from photos), location, people
- Ungrouped photos shown below in a smaller grid
- Drag-and-drop to move photos between groups (or use "Move to..." in MemoryReveal)

### 4.3 Enhanced Collage tab
- **Masonry layout** (CSS columns or grid with varying row spans) instead of uniform grid
- **Decorations on each tile:**
  - Date badge (bottom-left, JetBrains Mono, small)
  - Location chip (bottom-right, if set)
  - People chips (top-right, on hover)
  - Caption overlay (bottom, on hover or always for featured)
- **Group headers:** if viewing all (no person filter), show group title as a section header
- **Featured tile:** first photo of each group/month gets 2×2 with caption visible

### 4.4 Enhanced Timeline tab
- Group headers within months (album name + count)
- Richer cards: date badge, location, people
- Click to open MemoryReveal (unchanged)

### 4.5 MemoryReveal (detail view) additions
- **Title field** (editable, above caption)
- **Location field** (text input with autocomplete from existing locations)
- **Group selector** (dropdown: "Ungrouped" + existing groups)
- **Tags** (free-form chips, add/remove)
- **Date** (already there, keep)
- **People** (already there, keep)
- **Notes** (already there, keep)

### 4.6 MemoryCard decorations
Each tile should show:
- Image (object-cover)
- Hover: caption + date + location overlay
- Always-visible: small date badge (bottom-left) for featured tiles
- People chips on hover (top-right)
- Group color accent on border (if in a group)

### 4.7 Empty states
- No memories: current empty state (keep)
- No groups: show "Create your first album" CTA in Albums tab
- Group with no photos: show placeholder with "Add photos" button

---

## 5. Component Changes

### New components to create
| Component | Purpose |
|---|---|
| `MemoryGroupCard.tsx` | Album card: cover, title, count, date range, location chip |
| `CreateGroupDialog.tsx` | Modal: title, cover picker, location, people |
| `GroupPhotoGrid.tsx` | Masonry/grid of photos within a group |
| `MemoryDecorations.tsx` | Reusable: date badge, location chip, people chips overlay |

### Modified components
| Component | Changes |
|---|---|
| `MemoriesPage.tsx` | Add "Albums" tab, group management, pass group data down |
| `MemoryCollageGrid.tsx` | Masonry layout, decorations, group headers |
| `MemoryCard.tsx` | Add decorations (date badge, location, people), title display |
| `MemoryTimeline.tsx` | Add group headers within months |
| `MemoryReveal.tsx` | Add title, location, group selector, tags fields |
| `useMemories.ts` | Add group CRUD, location/tags to MemoryItem |
| `types.ts` | Add MemoryGroup type, extend MemoryItem |

### Modified backend
| File | Changes |
|---|---|
| `mediaStore.ts` | Add group CRUD functions, update addMemory to accept groupId/location/tags |

---

## 6. Implementation Phases

### Phase 1: Data model (no UI changes)
- [ ] Add `groupId`, `location`, `tags`, `title` to `MemoryItem`
- [ ] Create `MemoryGroup` type
- [ ] Add group CRUD to `mediaStore.ts` (using `putBlobRecord('memory-groups', ...)`)
- [ ] Update `useMemories` to expose groups + group CRUD
- [ ] Migration: existing memories get `groupId = undefined` (ungrouped)

### Phase 2: Group management UI
- [ ] Create `CreateGroupDialog` component
- [ ] Create `MemoryGroupCard` component
- [ ] Add "Albums" tab to MemoriesPage
- [ ] Show ungrouped photos below groups
- [ ] "Move to group" in MemoryReveal

### Phase 3: Enhanced Collage
- [ ] Switch to masonry layout (CSS columns or grid with varying spans)
- [ ] Add `MemoryDecorations` overlay (date badge, location, people)
- [ ] Show group title headers when viewing all
- [ ] Featured tile logic: first photo of each group

### Phase 4: Enhanced Timeline
- [ ] Add group headers within month sections
- [ ] Richer cards with date/location/people
- [ ] Click to open MemoryReveal (unchanged)

### Phase 5: MemoryReveal improvements
- [ ] Add title field
- [ ] Add location field (with autocomplete from existing locations)
- [ ] Add group selector dropdown
- [ ] Add tags input (chip-based)
- [ ] Better metadata layout

---

## 7. File Changes Summary

### New files
- `src/features/memories/MemoryGroupCard.tsx`
- `src/features/memories/CreateGroupDialog.tsx`
- `src/features/memories/GroupPhotoGrid.tsx`
- `src/features/memories/MemoryDecorations.tsx`

### Modified files
- `src/features/memories/types.ts` — extend MemoryItem, add MemoryGroup
- `src/features/memories/mediaStore.ts` — group CRUD, update addMemory
- `src/features/memories/useMemories.ts` — expose groups + CRUD
- `src/features/memories/MemoriesPage.tsx` — Albums tab, group management
- `src/features/memories/MemoryCollageGrid.tsx` — masonry + decorations
- `src/features/memories/MemoryCard.tsx` — decorations
- `src/features/memories/MemoryTimeline.tsx` — group headers
- `src/features/memories/MemoryReveal.tsx` — title, location, group, tags

### Estimated scope
- ~8 new/modified components
- ~400-600 lines of new code
- 5 phases, can be done incrementally

---

## 8. Open Questions for CZ

1. **Group/album model**: Should groups be user-created (manual) or auto-derived from date/people? Recommendation: user-created, with auto-suggest based on date clusters.
2. **Cover photo**: Auto (first photo) or user-picked? Recommendation: auto with manual override.
3. **Masonry vs grid**: CSS columns (true masonry) or CSS grid with spanning? Recommendation: CSS columns for true masonry, with `break-inside: avoid` on tiles.
4. **Location**: Free text or autocomplete from existing? Recommendation: autocomplete (reuse LocationAutocomplete).
5. **Tags**: Free-form or predefined? Recommendation: free-form with autocomplete from existing tags.
6. **Group colors**: Curated palette (8 colors) or user-picked? Recommendation: curated palette, auto-assigned.

---

## 9. Design Tokens to Use

From `frontend-design` skill:
- Group card: `rounded-xl border border-zinc-800/50 bg-zinc-900/40` (dark) / `light:bg-[var(--ws-surface-raised)]` (light)
- Tile: `rounded-lg border border-zinc-800/50 overflow-hidden`
- Date badge: `text-[10px] font-mono text-zinc-400 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded`
- Location chip: `text-[10px] text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded-full`
- People chip: reuse `PersonChip` component
- Group title: `text-[15px] font-semibold` (Space Grotesk if available, else Inter)
- Accent: group's assigned color from palette

### Accent palette (8 colors)
```
#e879a0 (rose), #f59e0b (amber), #10b981 (emerald), #3b82f6 (blue),
#8b5cf6 (violet), #ec4899 (pink), #14b8a6 (teal), #f97316 (orange)
```

---

## 10. Next Steps

1. CZ reviews this plan and answers the 6 open questions.
2. Phase 1 (data model) can start immediately — no UI changes, no risk.
3. Each phase is independently shippable and testable.
4. After Phase 2, the Albums tab is usable. After Phase 3, the Collage is polished.
5. Full revamp = all 5 phases. Estimated: 5-8 cycles depending on feedback.
# CONTEXT BUNDLE — Memories Page Revamp (Albums, Grouping, Decorations)

> Generated 2026-10-25. Self-contained code context for the Memories page redesign.
> The target AI should read this file first, then PROMPT.md.

---

## 1. Data Model

### `src/features/memories/types.ts`
```ts
export type MemoryKind = 'photo' | 'video';

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  date: string;           // YYYY-MM-DD (captured date, EXIF-aware)
  capturedAt: string;     // ISO timestamp
  caption?: string;
  phaseId?: string;
  noteIds?: string[];
  people: string[];
  createdAt: number;
  width?: number;
  height?: number;
  durationSec?: number;
}
```

### `src/features/memories/mediaStore.ts` (key functions)
```ts
export async function addMemory(file: File, overrides: Partial<MemoryItem> = {}): Promise<MemoryItem>
export async function updateMemoryMeta(id: string, patch: Partial<MemoryItem>): Promise<void>
export async function removeMemory(id: string): Promise<void>
export async function listMemories(): Promise<{ meta: MemoryItem; blob: Blob }[]>
export async function getMemoryBlob(id: string): Promise<Blob | null>
```

Storage: `putBlobRecord('memories', { id, blob, meta, createdAt })` — one blob per memory in IndexedDB.

### `src/features/memories/useMemories.ts`
```ts
export interface LoadedMemory { meta: MemoryItem; url: string; }

export function useMemories() {
  // items: LoadedMemory[]
  // upload(files), remove(id), updateMeta(id, patch)
  // onThisDay: LoadedMemory[]  (memories from same month/day, previous years)
  // groupedByMonth: [string, LoadedMemory[]][]  (grouped by YYYY-MM)
}
```

---

## 2. Current Components (full source)

### `MemoriesPage.tsx` (140 lines)
Tabs: 'collage' | 'timeline'. Sort by 'captured' (date) or 'added' (createdAt). Person filter chips. Empty state. Paste-to-upload.

### `MemoryCollageGrid.tsx` (45 lines)
CSS grid 3-4 cols. First photo of each month gets col-span-2 row-span-2. Stagger animation.

### `MemoryCard.tsx` (55 lines)
Square/4:3 tile. Image + caption at bottom (gradient overlay). Hover scale. Video shows play icon.

### `MemoryTimeline.tsx` (50 lines)
Vertical timeline grouped by month. 4-6 col grid of square thumbs. Month label as h3.

### `MemoryReveal.tsx` (180 lines)
Full-screen overlay: image, caption (editable), date (editable), notes (attach/detach), people (chips + input), delete. Escape closes.

### `MemoryUploader.tsx`
Drag-and-drop / file picker. Calls upload(files).

### `OnThisDayCard.tsx`
"On this day" memories from previous years.

---

## 3. Page Integration

Memories is embedded in `LifePage.tsx` under the 'memories' tab:
```tsx
{pageTab === 'memories' && (
  <motion.div key="memories" {...crossfade} className="w-full" data-section="life.memories">
    <MemoriesPage embedded />
  </motion.div>
)}
```

---

## 4. Design Tokens (from frontend-design skill + LAMINAR)

### Colors
- Background: `#09090b` (zinc-950), surfaces `#18181b` (zinc-900)
- Text: primary `#fafafa`, secondary `#a1a1aa`, muted `#71717a`
- Accent (memories): `--color-mem-400` (rose-ish), `--color-clay-400`
- Border: `rgba(255,255,255,0.06)` subtle, `0.09` default, `0.14` strong

### Typography
- UI: Inter (sans)
- Display: Space Grotesk (group titles)
- Mono: JetBrains Mono (dates, counts)

### Spacing
- Card padding: 12-16px
- Grid gap: 8-12px
- Section gap: 16-24px

### Radii
- Tiles: 8px (rounded-lg)
- Cards: 12px (rounded-xl)
- Chips: pill (rounded-full)

### Motion
- L1 (reactive): hover scale 1.015, 180ms ease
- L2 (transitional): group expand/collapse, 300ms
- Stagger: 45ms between tiles

---

## 5. Existing Patterns to Reuse

### LocationAutocomplete (`src/components/ui/LocationAutocomplete.tsx`)
- Autocomplete with create-new. Uses `window.deskflowAPI.getAllLocations()`.
- Props: value, onChange, placeholder, className, disabled, onCreateNew, fetchLocations

### PersonChip (`src/features/memories/PersonChip.tsx`)
- Removable person tag chip.

### EmptyState (`src/components/EmptyState.tsx`)
- Standard empty state with title + description.

### TabBar (`src/components/TabBar.tsx`)
- Tab switching component.

### PageShell (`src/components/PageShell.tsx`)
- Page wrapper with title/description.

---

## 6. IPC Endpoints Available

- `deskflowAPI.getAllLocations()` → returns `{ locations: string[] }` (distinct from goals, reminders, schedule_entries)
- `deskflowAPI.notesList({ includeDrafts })` → returns notes for attaching
- `deskflowAPI.updateMemoryMeta(id, patch)` → updates memory metadata
- `deskflowAPI.removeMemory(id)` → deletes memory

---

## 7. What Needs to Change (Data Model)

### MemoryItem additions
```ts
export interface MemoryItem {
  // ... existing ...
  groupId?: string;        // group/album this memory belongs to
  location?: string;       // where it was captured
  tags?: string[];         // free-form tags
  title?: string;          // user-set title (overrides caption)
}
```

### New MemoryGroup type
```ts
export interface MemoryGroup {
  id: string;
  title: string;
  coverId?: string;        // cover photo memory ID
  accent?: string;         // accent color from curated palette
  dateFrom?: string;       // YYYY-MM-DD
  dateTo?: string;         // YYYY-MM-DD
  location?: string;
  people?: string[];
  order: number;
  createdAt: number;
}
```

### Storage
Groups stored as blob records: `putBlobRecord('memory-groups', { id, meta: group, ... })`.

---

## 8. Open Questions (from plan)

1. Groups: user-created + auto-suggest based on date clusters
2. Cover photo: auto (first photo) with manual override
3. Masonry vs grid: CSS columns for true masonry
4. Location: autocomplete from existing
5. Tags: free-form with autocomplete
6. Group colors: curated palette (8 colors), auto-assigned

---

## 9. Current Collage Grid Logic

```tsx
// First photo of each month gets 2x2 tile
const month = (m.meta.date || '').slice(0, 7);
const prev = items[i - 1];
const prevMonth = prev ? (prev.meta.date || '').slice(0, 7) : null;
const big = month !== '' && month !== prevMonth && i < items.length - 1;
```

This is the ONLY visual variety. Everything else is uniform squares.
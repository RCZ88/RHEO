# RESULT — Memories Page Revamp: Albums, Grouping, Decorations

**Status:** design complete, ready for implementation planning.
**Prompt:** `./PROMPT.md` · **Bundle:** `./CONTEXT_BUNDLE.md`

---

## 0. Verification pass — five corrections before the design

### 0.1 Requirement R6 is self-contradictory, and the contradiction is technical, not stylistic

R6 asks for "masonry (CSS columns)" **and** "featured tile 2×2". CSS multi-column layout cannot span an item across two columns — `column-span: all` breaks to full width, nothing spans two. Worse, `columns` fills top-to-bottom per column: in a date-sorted stream the newest 15 photos stack in column 1 and the oldest land bottom-right — broken for an archive whose two sort modes are both chronological.

**Commitment:** masonry is **JS shortest-column distribution** (`useMasonryColumns`, §3.4 — ~25 lines, zero dependencies, reading order preserved; every photo's `width`/`height` already sit in `MemoryItem`). The **2×2 featured tile lives in the AlbumSpread hero row** (§3.3), where it belongs emotionally — the opening spread of a scrapbook — and technically, because the hero is a grid, not masonry. In the All view, "featured" is a chrome treatment (caption always visible, accent-tinted date badge), not a span.

### 0.2 `accent` must be a token name, not a string

The bundle's `MemoryGroup` sketch has `accent?: string` beside an 8-hex palette. Storing hex on records is exactly what a token system exists to prevent, and it orphans every group the day a palette color is tuned.

**Commitment:** `accent: GroupAccent` — one of 8 enum names. Resolution happens in exactly one file (`accents.ts`), which is also the only place a raw hex exists for the 6 palette entries with no CSS var today. Two of eight resolve to existing vars (`--color-mem-400`, `--color-clay-400`).

### 0.3 Two independent blob stores means dangling references are possible, and must be repaired

Memories live in the `memories` store, groups in `memory-groups`. A group deleted while member writes are pending (or a store restored from a partial backup) leaves items pointing at a nonexistent `groupId`. R1 says "delete → photos become ungrouped" but specifies no defense for the failure case.

**Commitment:** `deleteGroup` clears member refs in the same operation (§2.5), **and** `useMemories` runs a repair pass on every load: items whose `groupId` resolves to no existing group render as Ungrouped and are written back lazily on their next edit.

### 0.4 `putBlobRecord('memory-groups', …)` — the record shape needs a decision

The bundle sketches the group record as `{ id, meta, group, … }` while the memories store uses `{ id, blob, meta, createdAt }`. If `putBlobRecord` requires a `blob`, a meta-only record will throw or corrupt.

**Commitment:** the group record is `{ id, blob: new Blob([]), meta: MemoryGroup, createdAt }` — shape parity with the existing store, `meta` is the truth, the empty Blob is a placeholder. If the actual `localBlobStore` tolerates a missing `blob`, drop the placeholder. (Adaptation point for the implementing agent — the bundle does not quote `localBlobStore`'s signature.)

### 0.5 Zero IPC, zero registry, zero backend — and the "huge image" is `OnThisDayCard`

The bundle's IPC surface (`getAllLocations`, `notesList`, `updateMemoryMeta`, `removeMemory`) is fully sufficient; `getAllLocations` is read-only reuse. `data-section="life.memories"` lives in **LifePage's** wrapper, not in `MemoriesPage`, so the page registry is untouched. And the user's "huge image covering the entire screen" complaint maps to `OnThisDayCard` — it is **redesigned into a strip** (§3.6), not deleted, because On This Day is a preserved feature by constraint.

---

## 1. Concept

**What is this page for?** Memories is the archive of proof — the place where photos stop being a feed and become the story of a life, organized into chapters you could hand someone.

**What's the primary action?** Revisit: open an album, re-live a chapter. Curation (grouping, titling, decorating) is the second act — always available, never required.

**What's the emotional register?** The shoebox of prints and the annotated scrapbook: warm, deliberate, tactile. Not a social feed — nothing here is performative or infinite.

**Concept statement.** The page becomes a two-room archive. The **Albums** room is the shelf: album covers stacked like physical albums, each carrying its title, count, date range and place — the front door, and the default view. The **All** room is the light table: every print laid out in a masonry run, sectioned by chapter, every tile carrying its provenance — date, place, people — the way the written-on back of a photograph does. The two rooms share one tile anatomy and one decoration system, so moving between them is a change of altitude, not a change of language. The system gently proposes chapters (date-cluster suggestions) but never creates them without consent: the user is the curator, the software is the archivist.

---

## 2. Data model

### 2.1 `src/features/memories/types.ts` — additions

```ts
export type GroupAccent =
  | 'rose' | 'amber' | 'emerald' | 'blue' | 'violet' | 'pink' | 'teal' | 'orange';

export interface MemoryItem {
  // … all existing fields unchanged …
  groupId?: string;      // album membership; undefined = Ungrouped
  location?: string;     // where this photo was taken
  tags?: string[];       // free-form chips
  title?: string;        // user title; display precedence: title > caption > date
}

export interface MemoryGroup {
  id: string;
  title: string;
  coverId?: string;      // explicit cover; fallback = earliest-dated member
  accent: GroupAccent;   // token name — never a hex (§0.2)
  dateFrom?: string;     // YYYY-MM-DD — override only; display falls back to derived
  dateTo?: string;       // override only
  location?: string;     // where the chapter happened (majority-suggested, editable)
  people?: string[];
  order: number;         // shelf sort key; assigned as -epochDays(derived dateFrom)
  createdAt: number;
  updatedAt: number;
}

export interface GroupSuggestion {
  key: string;           // hash of sorted memberIds — the dismissal identity
  title: string;
  memberIds: string[];
  dateFrom: string;
  dateTo: string;
  location?: string;
  people?: string[];
}
```

**Display precedence for a memory's name:** `title > caption > formatted date`. One helper, `memoryName(meta)`, used by tiles and the reveal alike.

**Date ranges are override-only.** `shownFrom(group, members) = group.dateFrom ?? min(member.date)`; same for `to`. No recompute logic, no freeze flags — the derived value is live, an explicit override always wins, and each side can be overridden independently.

### 2.2 `src/features/memories/accents.ts` — the single hex-owning file

```ts
import type { GroupAccent, MemoryGroup } from './types';

export const GROUP_ACCENTS: Record<GroupAccent, string> = {
  rose:    'var(--color-mem-400)',   // #e879a0
  amber:   'var(--color-clay-400)',  // #f59e0b
  emerald: '#10b981',                // no CSS var exists — hex defined ONCE, here
  blue:    '#3b82f6',
  violet:  '#8b5cf6',
  pink:    '#ec4899',
  teal:    '#14b8a6',
  orange:  '#f97316',
};

export const ACCENT_ORDER: GroupAccent[] =
  ['rose', 'amber', 'emerald', 'blue', 'violet', 'pink', 'teal', 'orange'];

/** Least-used accent among existing groups; ties break to palette order. */
export function nextAccent(existing: MemoryGroup[]): GroupAccent {
  const used = new Map<GroupAccent, number>();
  for (const g of existing) used.set(g.accent, (used.get(g.accent) ?? 0) + 1);
  return ACCENT_ORDER.reduce((best, a) =>
    (used.get(a) ?? 0) < (used.get(best) ?? 0) ? a : best, 'rose');
}

/** Deterministic person → accent, for avatar circles. */
export function accentFor(name: string): GroupAccent {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ACCENT_ORDER[Math.abs(h) % ACCENT_ORDER.length];
}
```

### 2.3 `src/features/memories/groupStore.ts`

```ts
const STORE = 'memory-groups';

export async function listGroups(): Promise<MemoryGroup[]>;          // sorted by order asc
export async function saveGroup(group: MemoryGroup): Promise<void>;  // upsert
export async function removeGroup(id: string): Promise<void>;        // members cleared by caller
```

Record shape per §0.4. Align `listBlobRecords` / `deleteBlobRecord` with the actual `localBlobStore` exports — the bundle does not quote them; `mediaStore.ts` is the pattern to mirror.

### 2.4 `src/features/memories/smartGrouping.ts` — the exact algorithm

```ts
const CLUSTER_GAP_DAYS = 3;    // a weekend trip, a few days of one event
const MIN_CLUSTER_SIZE = 8;    // below this a cluster is noise
const MAX_SUGGESTIONS  = 4;    // most recent clusters only

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const SEASON_OF = ['Winter','Winter','Spring','Spring','Spring',
                   'Summer','Summer','Summer','Autumn','Autumn','Autumn','Winter'];

export function suggestGroups(ungrouped: MemoryItem[]): GroupSuggestion[] {
  const sorted = [...ungrouped].sort((a, b) => a.date.localeCompare(b.date));
  const clusters: MemoryItem[][] = [];
  for (const m of sorted) {
    const cur = clusters[clusters.length - 1];
    if (cur && daysBetween(cur[cur.length - 1].date, m.date) <= CLUSTER_GAP_DAYS) cur.push(m);
    else clusters.push([m]);
  }
  return clusters
    .filter(c => c.length >= MIN_CLUSTER_SIZE)
    .slice(-MAX_SUGGESTIONS)
    .reverse()                       // newest first
    .map(toSuggestion);
}
```

`daysBetween` **must** parse via the repo's documented clock rule (`parseDateStr` in `src/lib/week.ts`) — never `new Date('YYYY-MM-DD')` + `toISOString()`, the exact off-by-one-day trap this codebase has already shipped once.

`toSuggestion` fills the fields:

| Field | Rule |
|---|---|
| `title` | same month → `March 2025`; same season + same year → `Spring 2025`; else `March – June 2025`; spanning years → `Dec 2024 – Jan 2025` |
| `location` | one location shared by ≥ 70% of members, else omitted |
| `people` | names present on ≥ 70% of members, capped at 3, else omitted |
| `key` | first 10 hex chars of a SHA-1 over the sorted memberIds joined by `\|` |

Suggestions are **never auto-applied**. Dismissal lives in `localStorage['memories.dismissed-suggestions']` (UI state, not user data). If a dismissed cluster's membership changes, its key changes and it may resuggest — acceptable, and stated here so nobody "fixes" it later.

### 2.5 `useMemories` — extension

```ts
export function useMemories() {
  // … existing: items, upload, remove, updateMeta, onThisDay, groupedByMonth …

  groups: MemoryGroup[];
  createGroup(init?: Partial<MemoryGroup>): Promise<MemoryGroup>;
  updateGroup(id: string, patch: Partial<MemoryGroup>): Promise<void>;
  deleteGroup(id: string): Promise<void>;       // §0.3 — clears members, keeps photos
  setCover(groupId: string, memoryId: string): Promise<void>;
  moveMemories(ids: string[], groupId: string | undefined): Promise<void>;
  suggestions: GroupSuggestion[];               // computed from ungrouped items only
  acceptSuggestion(s: GroupSuggestion): Promise<MemoryGroup>;
  dismissSuggestion(key: string): void;
  albumCover(groupId: string): LoadedMemory | undefined;   // coverId ?? earliest member
}
```

```ts
async function deleteGroup(id: string): Promise<void> {
  await removeGroup(id);
  await Promise.all(
    items().filter(m => m.meta.groupId === id)
           .map(m => updateMemoryMeta(m.meta.id, { groupId: undefined })),
  );
  refresh();
}
```

`{ groupId: undefined }` — `JSON.stringify` drops undefined keys, so the field is removed, not stored as `undefined`. The load-time repair pass (§0.3):

```ts
const valid = new Set(groups.map(g => g.id));
// These render as Ungrouped and are written back lazily on their next updateMeta.
const dangling = items.filter(m => m.meta.groupId && !valid.has(m.meta.groupId!));
```

`createGroup` defaults: `accent = nextAccent(groups)`, `order = -epochDays(derived dateFrom)` (so sorting by `order` asc equals newest-chapter-first), `createdAt`/`updatedAt = Date.now()`. `acceptSuggestion` additionally patches every member's `groupId` and adopts the suggestion's derived `location`/`people`.

### 2.6 Migration

**There is none.** All new `MemoryItem` fields are optional; the groups store starts empty; existing photos are Ungrouped by construction. No data loss is possible because nothing existing is rewritten. The only schema-like act is the repair pass, which is read-time defensive, not a migration.

---

## 3. Component architecture

### 3.1 File map

```
src/features/memories/
  types.ts                    MOD  +groupId/location/tags/title, +MemoryGroup, +GroupAccent
  accents.ts                  NEW  token resolution, nextAccent, accentFor
  groupStore.ts               NEW  blob CRUD for 'memory-groups'
  smartGrouping.ts            NEW  pure clustering + title derivation
  useMemories.ts              MOD  +group CRUD, suggestions, move, repair pass
  MemoriesPage.tsx            REW  shell: view ∈ {albums, all}, toolbar, paste, filters (keeps `embedded`)
  useMasonryColumns.ts        NEW  JS masonry distribution
  MemoryTile.tsx              NEW  the decorated tile (replaces MemoryCard)
  MemoryMasonry.tsx           NEW  one masonry run (All-view sections + album spreads)
  AlbumShelf.tsx              NEW  Albums view: OTD + suggestions + album grid
  AlbumCard.tsx               NEW  shelf card (cover stack, title, count, range, place)
  AlbumSpread.tsx             NEW  open album: header, hero, masonry, add-photos
  SuggestionStrip.tsx         NEW  smart-group proposals
  SelectionBar.tsx            NEW  bulk-move mode bar
  OnThisDayCard.tsx           REW  → horizontal strip, kills the huge image
  MemoryReveal.tsx            MOD  +title/location/album/tags editors, prev/next
  MemoryUploader.tsx          KEEP
  PersonChip.tsx              KEEP
  MemoryCollageGrid.tsx       DEL  phase 5, after grep proves no live imports
  MemoryTimeline.tsx          DEL  phase 5, after grep proves no live imports
  MemoryCard.tsx              DEL  phase 5, after grep proves no live imports
```

### 3.2 Composition

```
MemoriesPage (embedded)                         [shell: view state, toolbar, paste handler]
├─ ALBUMS VIEW
│  ├─ OnThisDayStrip                            [top, horizontal, 128px tall]
│  ├─ SuggestionStrip → SuggestionCard[]        [only while suggestions exist]
│  ├─ AlbumShelf → AlbumCard[]                  [order asc == newest chapter first]
│  │    ├─ NewAlbumCard                         [dashed border, Plus]
│  │    └─ UngroupedCard                        [2×2 mosaic cover, always last]
│  └─ AlbumSpread (replaces shelf content)      [back → shelf]
│       ├─ SpreadHeader                         [title, meta row, Edit popover]
│       ├─ HeroRow                              [2×2 cover + meta card, grid]
│       └─ MemoryMasonry (members)              [+ Select (bulk remove) + Add photos]
├─ ALL VIEW
│  └─ Sectioned masonry                         [one masonry run per section]
│       ├─ GroupSection: header + MemoryMasonry [accent bar, Space Grotesk title]
│       └─ MonthSection (ungrouped): mono caps header + MemoryMasonry
├─ SelectionBar                                 [fixed, bulk move / add-to-album]
└─ MemoryReveal                                 [overlay, + metadata editor]
```

One tile anatomy everywhere — spread, All view, sections — differing only in props:

```ts
interface MemoryTileProps {
  memory: LoadedMemory;
  featured?: boolean;                    // caption always on, accent-tinted date badge
  accentVar?: string;                    // resolved group accent; undefined = ungrouped
  selection?: { active: boolean; selected: boolean; onToggle: () => void };
  onOpen: () => void;
  menu?: ReactNode;                      // kebab: Use as cover / Move to… / Remove
}
```

### 3.3 AlbumSpread — the featured moment

Hero row = one 4-column grid, 12px gap: the cover tile spans **2×2** (square crop, caption always visible, `Star` "Cover" badge when explicitly set), flanked by a meta card (2 cols): title in Space Grotesk 20px with accent dot, date range (mono), location, people summary, count, and the **Edit** affordance opening the popover (title input, 8 accent swatches, dateFrom/dateTo inputs, `LocationAutocomplete`, people chips). Below the hero, `MemoryMasonry` renders the full membership — the cover included, because a spread is an archive, not a slideshow. "Add photos" jumps to the All view with selection mode armed and the target album set (§5.1 flow 3). "Select" inside the spread arms bulk **remove**.

### 3.4 `useMasonryColumns` — the masonry, exactly

```ts
const GAP = 0.06;            // 12px at a 200px column — gap as a fraction of column width
const MIN_ASPECT = 0.35;     // panoramas clamp (aspect = w/h)
const MAX_ASPECT = 2.6;      // extreme portraits clamp

export function useMasonryColumns<T>(
  items: T[],
  aspectOf: (item: T) => number,
  columns: number,
): T[][] {
  return useMemo(() => {
    const cols: T[][] = Array.from({ length: columns }, () => []);
    const heights = new Array(columns).fill(0);
    for (const item of items) {
      const target = heights.indexOf(Math.min(...heights));
      cols[target].push(item);
      const aspect = Math.min(Math.max(aspectOf(item) || 1, MIN_ASPECT), MAX_ASPECT);
      heights[target] += 1 / aspect + GAP;
    }
    return cols;
  }, [items, columns]);
}

// Column count from a ResizeObserver on the container (embedded width, not viewport):
//   < 640px → 2 · < 1080px → 3 · < 1560px → 4 · else 5
```

Reading order is preserved (roughly left-to-right), which CSS `columns` cannot offer. Videos and items missing dimensions default to aspect 1. Render: a `flex` row of `flex-1 min-w-0` columns, each a stack of tiles with `mb-3` (12px).

### 3.5 Sectioning the All view

Sections appear in shelf order (`order` asc), Ungrouped always last. Within a section, tile order follows the active sort (`captured` | `added`). The person filter removes tiles at every level; an emptied section hides; all-empty → the "no matches" state. Curated group headers carry the accent bar + Space Grotesk; ungrouped months render as mono caps (`MARCH 2025`) — auto vs curated is legible at a glance, without a legend.

### 3.6 OnThisDayStrip — the fix for "absolutely dogshit"

A full-width card, **128px tall**: a left label block (mono 10px muted — `2 YEARS AGO TODAY` — plus the date), then a horizontal row of 96px square thumbs (`rounded-lg`, hover 1.015), scrolling with edge fades when more than fit. Click → `MemoryReveal`. At most two strips (the two most recent years that have memories). **No full-bleed image, ever.** Albums view only — the All view stays a pure table.

---

## 4. Visual specs

### 4.1 Tokens (dark-first; light mode secondary, deferred)

| Role | Value |
|---|---|
| Page bg | `var(--bg-primary)` `#09090b` |
| Surface (cards, strips) | `var(--bg-surface)` `#18181b` |
| Raised (menus, popovers, selection bar) | `var(--bg-raised)` `#27272a` |
| Border subtle / default / strong | `rgba(255,255,255,0.06 / 0.09 / 0.14)` |
| Text primary / secondary / muted | `#fafafa` / `#a1a1aa` / `#71717a` |
| Group accents | `GROUP_ACCENTS` (§2.2) — nothing else may hold a hex |
| Danger | `text-red-400/90`, delete affordances only |

### 4.2 Typography — three faces, fixed roles, no exceptions

| Role | Face | Sizes |
|---|---|---|
| UI: buttons, inputs, body, chips | Inter 400/500 | 12–13px |
| Display: album titles, section headers, spread title | Space Grotesk 600 | 15 / 16 / 20px |
| Data: dates, counts, badges, meta | JetBrains Mono 500 | 10–11px |

The reveal overlay uses Inter + JetBrains Mono only — it is a working surface, not a display one.

### 4.3 MemoryTile anatomy — the heart of "not a plain collage"

| Element | Spec |
|---|---|
| Container | natural aspect (`w-full h-auto`), `rounded-lg`, root sets `style={{ '--group-accent': accentVar }}`; ungrouped `border border-white/[0.06]`; grouped `border-[color-mix(in_oklab,var(--group-accent)_25%,transparent)]`, hover → 45% |
| Date badge | bottom-left, **always on**: `font-mono text-[10px] font-medium px-1.5 py-1 rounded-md bg-black/60 text-white/90`; format `Mar 14`, year appended when ≠ current year. Featured: `bg-[color-mix(in_oklab,var(--group-accent)_75%,black)]` |
| Location chip | bottom-right, when set: same shell + `MapPin` (10px) + text, `max-w-[45%] truncate` |
| Duration chip | videos only, same bottom row: mono 10px `0:42` |
| Bottom row | one flex row, `gap-1`, `inset-x-2 bottom-2` — date left; location + duration right |
| People | top-right, hover only (180ms fade): `-space-x-1.5` circles `size-[22px] rounded-full border-2 border-black/60`, bg `accentFor(name)` at 30% via color-mix, initials mono 9px; max 3, then a `+N` pill |
| Caption | gradient `bg-gradient-to-t from-black/75 via-black/25 to-transparent`, text 11px/1.4 `text-white/90 line-clamp-2`; hover-revealed, **always on when `featured`** |
| Video | center `size-8 rounded-full bg-black/55` + `Play` 14px |
| Selection | when active: checkbox top-left 18px (`rounded-md border-white/20`, on = accent bg + `Check` 12px), 120ms ease-out |
| Hover motion | `scale(1.015)`, 180ms, `cubic-bezier(0.16, 1, 0.3, 1)` — nothing else moves |

### 4.4 AlbumCard

| Element | Spec |
|---|---|
| Card | `rounded-xl border border-white/[0.09] bg-[var(--bg-surface)]`; shelf grid `repeat(auto-fill, minmax(240px, 1fr))`, gap 16px |
| Cover | 144px, `object-cover`, hover 1.015 inside `overflow-hidden`; hover ring `color-mix(in oklab, accent 40%, transparent)` |
| Cover stack | ≥ 3 members: two sheets behind, offset 4px and 8px, `rounded-xl border-white/[0.09]` — the physical-album read |
| Body | `p-3`: accent dot (8px) + title, Space Grotesk 15px/600, truncate; count mono 11px muted — `24 photos · 3 videos`, zero-parts omitted; date range mono 10px muted; location `MapPin` 10px + 11px secondary, truncate |
| Kebab | hover, top-right: Use as cover · Rename · Edit details · Delete album |
| UngroupedCard | always last: 2×2 mosaic of the 4 newest ungrouped thumbs as cover, title "Ungrouped", sub "Not in any album"; hidden when empty |
| NewAlbumCard | dashed `border-white/[0.14]`, `Plus` centered, label "New album" |

### 4.5 Section headers (All view)

Curated: 3×14px accent bar (`rounded-full`) + Space Grotesk 16px/600 + mono 11px count; right-aligned 11px secondary summary (location · people). Margins `mt-6 mb-2`. Auto (ungrouped months): mono 11px uppercase `tracking-wide` muted, no bar.

### 4.6 Chrome

| Surface | Spec |
|---|---|
| View switch | segmented, h-9, container `bg-white/[0.04] border-white/[0.09]`, active `bg-white/[0.08] text-primary`, 180ms; icons `Images` / `LayoutGrid` |
| Toolbar | **solid** `bg-[var(--bg-primary)]` when sticky — no glassmorphism on chrome; person chips scroll, `max-w-[50%]`; sort mini-segmented mono 11px (`Calendar` Captured / `Clock3` Added); primary "New album" (Albums view) / ghost "Select" (All view) |
| SelectionBar | fixed `bottom-6` centered, `rounded-xl border-white/[0.14] bg-[var(--bg-raised)] shadow-2xl px-4 py-2.5`, count mono 12px; in All view: "Move to [dropdown: Ungrouped + albums]"; armed by "Add photos": context pill `Adding to {album}` preselects the target; inside a spread: "Remove from album" only; Cancel always; `z-50` |
| SuggestionCard | `w-56 h-32`, dashed `border-white/[0.14]`, 4-thumb mosaic, title + `8 photos · Mar 14–22`, actions "Create album" / `X` |
| MemoryReveal | media left, natural size, max 70% width, centered, `←/→` chevrons at edges (44px hit targets); right rail 360px, `bg-[var(--bg-surface)] border-l border-white/[0.06] p-5 overflow-y-auto`: title input (13px medium, placeholder "Add a title"), caption textarea, date (existing mono editor), `LocationAutocomplete`, Album listbox ("Ungrouped" + groups, accent dot each), tags chip input with frequency-sorted autocomplete derived from all items, `PersonChip` row, notes attach/detach (existing), footer: dimensions/duration mono 10px + Delete `text-red-400/90`. Field saves on blur/Enter; chips save immediately |
| Page gutter | `px-5` (20px); sections `gap-6` (24px); never more than p-5 |

### 4.7 Motion — the complete list

| Interaction | Spec |
|---|---|
| Tile / card hover | scale 1.015, 180ms, `cubic-bezier(0.16,1,0.3,1)` |
| View swap | crossfade + y 8→0, 300ms, same curve |
| Shelf → Spread | crossfade + scale 0.98→1, 300ms |
| Stagger | 45ms/item, **first 12 items only**, mount-only (`initial={false}` after first mount) |
| Selection check | opacity + scale 0.9→1, 120ms ease-out — no spring |
| Suggestion accept | new `AlbumCard` `layout` animation, 300ms |
| `prefers-reduced-motion` | opacity-only everywhere; no transforms, no stagger, no layout animations |

---

## 5. Interaction flow

### 5.1 Primary flows

| # | Flow | Steps |
|---|---|---|
| 1 | First visit (photos exist, no albums) | Albums view: OTD strip → suggestion strip (clusters ≥ 8 only) → shelf with UngroupedCard + NewAlbumCard |
| 2 | Accept a suggestion | "Create album" → group created (derived title/location/people, `nextAccent`), members patched, card animates in at shelf top, suggestion consumed |
| 3 | Create manually | "New album" → spread opens with inline-focused "Untitled album" title → "Add photos" → All view with selection armed + `Adding to {album}` pill → pick → "Move N to {album}" |
| 4 | Revisit | AlbumCard → spread: hero + masonry → tile → `MemoryReveal`, `←/→` walks the current ordering |
| 5 | Restyle a chapter | Edit popover: retitle, pick 1 of 8 accents, override dates, set location, edit people |
| 6 | Set cover | tile kebab in spread → "Use as cover" → `coverId` set; hero + shelf update |
| 7 | Move one photo | Reveal → Album dropdown → pick, or "Ungrouped" — persists immediately |
| 8 | Move many | All view "Select" → tiles toggle → SelectionBar "Move to…" → album |
| 9 | Delete an album | kebab → confirm: **"Delete 'Lisbon — March 2025'? Photos are kept — they'll move back to Ungrouped."** → members cleared (§2.5), card unmounts |
| 10 | Add while browsing | paste/drop with a spread open → photos join **that album** (toast: "Added to Lisbon — March 2025"); in All view or shelf → ungrouped. Dropping OS files onto an AlbumCard uploads into that album |

### 5.2 States — every surface, all four

| Surface | Empty | Loading | Error | Populated |
|---|---|---|---|---|
| Albums view | `EmptyState`: "No memories yet" — "Drop photos anywhere, paste from the clipboard, or add files. They'll live here, grouped into albums." + lucide `Image` (import as `ImageIcon`) + "Add photos" | 4 skeleton cards (shimmer 1.6s ease-in-out) | store-failure banner with Retry; shelf renders whatever loaded | per spec |
| Suggestion strip | hidden (no clusters) | hidden | hidden — suggestions are best-effort | up to 4 cards |
| AlbumSpread | dashed drop-target: "This album is empty — select photos in All view, or drop files here" | skeleton hero + 6 tiles | per-tile fallbacks | per spec |
| All view | page-level empty (above) | masonry skeletons at mixed aspects (1:1, 4:5, 3:2) | tile-level broken-image + Retry; neighbors unaffected | sections |
| Person filter, no matches | "No memories with {person}" + Clear filter | — | — | filtered |
| MemoryTile | — | blur-up placeholder `bg-white/[0.04]` | broken-image tile + Retry | per spec |
| OTD strip | hidden | skeleton row | hidden | ≤ 2 strips |
| MemoryReveal | n/a | media spinner | blob failure: message + Retry; metadata still editable | per spec |

### 5.3 Keyboard

`←/→` navigate the reveal within the current ordering; `Esc` closes the reveal / exits selection; `Enter` commits title and tag inputs; `Cmd/Ctrl+A` in selection mode selects the visible section.

---

## 6. Implementation plan

| Phase | Scope | Files | Effort | Verify |
|---|---|---|---|---|
| 1 | Data layer, no UI change | `types.ts`, `accents.ts`, `groupStore.ts`, `smartGrouping.ts`, `useMemories.ts` | 0.5d | existing page byte-identical; group CRUD + suggestions exercisable from console |
| 2 | Tile + masonry (ship inside the old Collage tab) | `useMasonryColumns.ts`, `MemoryTile.tsx`, `MemoryMasonry.tsx`, `MemoriesPage.tsx` | 1d | Collage tab shows the sectioned decorated masonry; Timeline untouched; sort/filter/paste intact; panoramas clamp |
| 3 | Albums view + tab flip to Albums \| All | `AlbumShelf`, `AlbumCard`, `AlbumSpread`, `SuggestionStrip`, `SelectionBar` | 1.5d | flows 1–3, 5–10 pass; delete keeps photos (inspect the store after); dangling repair holds |
| 4 | Reveal editor | `MemoryReveal.tsx` | 1d | title/location/album/tags persist; `←/→`; precedence `title > caption > date` everywhere |
| 5 | OTD strip + polish + deletions | `OnThisDayCard.tsx`; stagger, reduced-motion and states audit | 0.5d | every surface has 4 states; reduced-motion kills all transforms; `grep -rn "MemoryCollageGrid\|MemoryTimeline\|MemoryCard" src/` clean before deleting the three files |

**Total ≈ 4.5 days.** Each phase leaves the app shippable. No phase touches IPC, the registry, the backend, or `dist/`.

---

## 7. Anti-patterns — what NOT to do

1. **No full-bleed hero images.** The original sin. The largest image on this page is a 2×2 tile inside an open album.
2. **No uniform square grid.** Masonry with natural aspects everywhere; squares only for OTD thumbs and avatar circles.
3. **No hex outside `accents.ts`** — and a CSS var wins over hex wherever one exists. No second color rule.
4. **No springs or bounce on data.** One curve: `cubic-bezier(0.16,1,0.3,1)`; the selection check pops at 120ms ease-out; nothing overshoots.
5. **No glassmorphism on chrome.** `backdrop-blur` appears only on badges over photographs. The sticky toolbar is solid.
6. **No auto-created albums.** Suggestions are proposals with an explicit accept and an explicit dismiss.
7. **No deleting photos when deleting albums** — and no dangling `groupId` left behind.
8. **No accent stored as hex** on any record — token names only (`GroupAccent`).
9. **No fourth typeface, no emoji** — lucide icons only. The reveal uses two faces, not three.
10. **No stagger waterfalls past 12 items** — hundreds of photos must not animate like a slot machine.
11. **No pagination or virtual-scroll machinery in v1** — the archive scrolls freely; revisit only if a library exceeds ~2,000 items.
12. **No new dependencies.** Masonry is 25 lines of JS (§3.4), not a library.

---

## OWED-EXT (explicitly out of scope, recorded)

```
OWED-EXT-1: Drag-a-tile-onto-an-album-card to move (HTML5 DnD) — selection mode covers v1.
OWED-EXT-2: Tag filter chip in the toolbar (tags ship as reveal-level metadata in v1).
OWED-EXT-3: Shelf drag-reorder (rewrites `order`; the field exists and is the sort key).
OWED-EXT-4: Light-mode tuning (dark-first per constraint; tokens chosen to map cleanly).
OWED-EXT-5: Video scrub-hover thumbnails; >2,000-item virtualization audit.
```

**Definition-of-done check:** every type, file, algorithm, token, pixel value, curve, state, copy string, phase and deletion is specified above; the two judgment calls the prompt left open (masonry mechanics §0.1, accent storage §0.2) are committed with reasons. A developer holding `CONTEXT_BUNDLE.md` can implement this without asking a follow-up question.

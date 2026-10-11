# CONTEXT_BUNDLE — Memories Page Redesign

> Source of truth for the receiving AI. Every claim here is quoted from the
> repository, not described from memory. Paths are relative to the repo root.
> Snapshot: 2026-10-04.

---

## 1. What the feature is today

A personal photo/video archive inside the Life page. Photos are pasted or
uploaded, EXIF dates are read, and the images are shown as a "life on film"
reel, a collage, a month-grouped timeline, an "On This Day" card, a fullscreen
reveal, and a fullscreen Ken Burns recap.

Route: `/life` → **Memories** tab (`LifePage.tsx:585`, `data-section="life.memories"`).
Standalone page shell also exists (`MemoriesPage` with `embedded={false}`).

## 2. Component inventory — six surfaces, all showing the same blobs

| File | Lines | Role |
|---|---|---|
| `src/features/memories/MemoriesPage.tsx` | 148 | Orchestrator: header, tab bar, sort, uploader, overlays |
| `src/features/memories/useMemories.ts` | 71 | Loads all records, mints object URLs, sorts |
| `src/features/memories/mediaStore.ts` | 64 | IndexedDB CRUD + EXIF date extraction |
| `src/features/memories/types.ts` | 17 | `MemoryItem` |
| `src/features/memories/localBlobStore.ts` | — | IndexedDB wrapper (store name `memories`) |
| `src/features/memories/MemoryReel.tsx` | 76 | Horizontal filmstrip, "Your life on film" |
| `src/features/memories/MemoryCollageGrid.tsx` | 32 | 3–4 col grid, every 7th tile spans 2×2 |
| `src/features/memories/MemoryCard.tsx` | 53 | Grid tile, shared `layoutId` for the reveal transition |
| `src/features/memories/MemoryTimeline.tsx` | 55 | Vertical month groups with a gradient spine |
| `src/features/memories/MemoryUploader.tsx` | 46 | File picker + drag/drop |
| `src/features/memories/OnThisDayCard.tsx` | 37 | Same-day-last-year strip |
| `src/features/memories/MemoryReveal.tsx` | 193 | Fullscreen `fixed inset-0` viewer + metadata editor |
| `src/features/memories/RecapPlayer.tsx` | 124 | Fullscreen Ken Burns slideshow |
| `src/features/memories/videoThumbnail.ts` | 34 | Grabs a poster frame from a video blob |

## 3. THE COMPLAINT — verbatim

> "the memories page is shit. theres like a hugeass image covering the entire
> screen showinf for like arecap shit that is absoloutely dogshit"

> "like in terms of the overall design and like purpose and like teh concept
> of it. still fucking dogshit"

**The reportable symptoms:**
1. A very large image covers the entire screen.
2. The recap is the worst part.
3. The overall design, purpose and concept are wrong — not just the styling.

## 4. Root-cause analysis (with quoted code)

### 4.1 The "huge image" is `RecapPlayer` — a fullscreen Ken Burns slideshow

`RecapPlayer.tsx:68-97`:

```tsx
<motion.div
  className="fixed inset-0 z-[var(--z-modal)] bg-black flex items-center justify-center"
  ...
>
  <div className="absolute inset-0 overflow-hidden">
    <AnimatePresence mode="popLayout">
      <motion.div key={current.meta.id}
        className="absolute inset-0 flex items-center justify-center"
        initial={imgInitial} animate={imgAnimate} exit={imgExit} transition={imgTransition}>
        {current.meta.kind === 'video' ? (
          <video src={current.url} autoPlay muted className="max-h-full max-w-full object-contain" />
        ) : (
          <img src={current.url} alt={current.meta.caption || ''}
               className="max-h-full max-w-full object-contain" />
        )}
      </motion.div>
    </AnimatePresence>
  </div>
```

`MemoryReveal.tsx:59` is a **second** fullscreen surface:
```tsx
className="fixed inset-0 z-[var(--z-modal)] flex items-...
```

So there are **two** `fixed inset-0` overlays, and the recap is reachable from
a prominent pill button at the top of the page (`MemoriesPage.tsx:66`,
`onPlayRecap`).

### 4.2 The recap has no content — it is a random slideshow

`RecapPlayer.tsx:11-33`. It iterates `recapItems` (`MemoriesPage.tsx:31`
= `[...items].reverse()`), i.e. **reverse upload order**, with a fixed 4.2 s
timer:

```tsx
const SLIDE_MS = 4200;
const KEN_BURNS = [
  { scale: 1.12, x: '-3%', y: '-2%' },
  { scale: 1.14, x: '3%', y: '2%' },
  { scale: 1.1,  x: '2%', y: '-3%' },
  { scale: 1.15, x: '-2%', y: '3%' },
];
...
timerRef.current = window.setTimeout(() => setIndex(i => (i + 1) % count), SLIDE_MS);
```

There is **no narration, no grouping, no date logic, no people logic.** It is a
Ken Burns template applied to reverse-chronological blobs. A recap implies a
story; this has none.

### 4.3 Six surfaces compete, none is primary

`MemoriesPage.tsx:66-81` renders, in order: `MemoryReel`, `OnThisDayCard`,
`MemoryUploader`, then a Collage/Timeline tab switch. Both tabs show the same
items again. `MemoryReel` already shows up to 24 of them
(`MemoriesPage.tsx:25-29`). So a typical photo is rendered in the reel, in the
collage **or** timeline, and again fullscreen — with no hierarchy between them.

### 4.4 The reel's "film" metaphor is a CSS gradient, and it is loud

`src/features/warmth/warmth-tokens.css:37-77`:

```css
.memory-reel {
  display: flex; gap: 14px; padding: 20px;
  overflow-x: auto; scroll-snap-type: x mandatory;
  background:
    repeating-linear-gradient(90deg, #0a0908 0 8px, transparent 8px 34px) top / 100% 12px no-repeat,
    repeating-linear-gradient(90deg, #0a0908 0 8px, transparent 8px 34px) bottom / 100% 12px no-repeat,
    #141210;
}
.reel-frame { transform: scale(0.92); filter: saturate(0.82) brightness(0.8); }
.reel-frame img { height: 168px; width: auto; max-width: 260px; object-fit: cover; }
.reel-frame.reel-active {
  transform: scale(1); filter: none;
  box-shadow: 0 0 44px -10px rgba(111, 179, 143, 0.5);
}
```

Perforation stripes top and bottom, an active glow, a scale ramp. Decorative
chrome competing with the photographs, which are the actual content.

### 4.5 The collage's rhythm is arbitrary

`MemoryCollageGrid.tsx:19`:
```tsx
className={i % 7 === 0 ? 'col-span-2 row-span-2' : ''}
```
Every 7th item is a feature tile. That is positional, not semantic — nothing
about the 7th photo earns double size.

### 4.6 Hardcoded palette, in a token system

The memories feature uses a literal `#6fb38f` green in at least
`MemoryReel.tsx:40,45`, `MemoryTimeline.tsx`, `OnThisDayCard`, and
`warmth-tokens.css`. The app's constitution (`design/design.md`, LAMINAR)
requires one signal hue per surface read from `var(--page-accent)`.

## 5. Data model — what a redesign can rely on

`src/features/memories/types.ts` (verbatim, current):

```ts
export type MemoryKind = 'photo' | 'video';

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  date: string;
  capturedAt: string;
  caption?: string;
  phaseId?: string;
  /** Notes this memory belongs to. Lets a photo anchor a written thought. */
  noteIds?: string[];
  people: string[];
  createdAt: number;
  width?: number;
  height?: number;
  durationSec?: number;
}
```

Available and currently under-used:
- `people: string[]` — the reveal panel has a people editor. **Nothing on the
  page groups or surfaces by people.** This is the most obviously missing
  concept.
- `noteIds?: string[]` — added this session; not yet surfaced anywhere.
- `phaseId?: string` — defined, **never written and never read** by any
  component.
- `durationSec?: number` — defined, never used for anything.
- `width`/`height` — defined, never used (portrait/landscape is unexploited).

## 6. Storage

`mediaStore.ts` + `localBlobStore.ts`. One IndexedDB object store `memories`;
each record is `{ id, blob, meta, createdAt }`. The blob is stored **once** and
handed to the UI as an object URL.

`useMemories.ts:15-22` mints and revokes them correctly:

```tsx
const refresh = useCallback(async () => {
  setLoading(true);
  const list = await listMemories();
  setItems(prev => {
    prev.forEach(p => URL.revokeObjectURL(p.url));
    return list.map(({ meta, blob }) => ({ meta, url: URL.createObjectURL(blob) }));
  });
  setLoading(false);
}, []);
```

**Storage is not the problem and must not be redesigned.** A redesign must keep
the single-blob-copy model. Do not propose path-based storage or base64.

Note: `MediaQuery`-driven `prefers-reduced-motion` is respected in
`RecapPlayer` via `useReducedMotion()`. Keep that.

## 7. The CSP constraint

`src/main.ts:22301` now reads:

```
img-src 'self' data: blob: https:
```

`blob:` is **required** — every image is a `blob:` object URL. Any redesign that
switches to data-URIs or remote URLs must not remove `blob:`.

## 8. LAMINAR constraints that bind this redesign

From `design/design.md` and `AGENTS.md` §5b / §9:

- One signal hue per surface. Read the live accent from `var(--page-accent)`.
- Radii ∈ {8, 12, pill}. No `rounded-2xl`/`rounded-3xl`.
- Max 2 font families per view (Inter, JetBrains Mono, Space Grotesk are available).
- No `backdrop-blur` glassmorphism on chrome.
- No spring/bounce. Easing curves only.
- No raw hex/`rgba()` inside `.tsx`.
- No emoji as icons — `lucide-react` only.
- Ambient infinite decorative loops are **banned** in App UI.
- `prefers-reduced-motion` must be honoured via a single global check.
- Charts/data-viz must come from `@bklit` via the shadcn MCP — never hand-rolled.

## 9. Available MCP sources (`components.json`)

| Need | Registry |
|---|---|
| General app UI (cards, dialogs, buttons, tabs) | `@kokonutui`, then `@shadcn` |
| Charts / data-viz | `@bklit` **only** |
| Animated effects | `magicui`, `@react-bits` |
| Icons | `lucide` |

## 10. Explicit non-goals

Do **not** propose:
- A new storage layer, path-based files, or base64.
- Removing or narrowing the CSP `blob:` entry.
- A fullscreen auto-playing video/photo slideshow as the page's primary surface.
- Any new runtime dependency (no GSAP, no Anime.js; the project is on `motion` v12).
- Changes to `MemoriesPage`'s route or the Life tab id — both are referenced by
  `data-section="life.memories"`, which the page-manifest registry validates.
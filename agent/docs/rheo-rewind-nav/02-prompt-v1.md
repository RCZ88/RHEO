# Task: build the "Rewind" navigation for RHEO (replaces the Ctrl K palette)

I am attaching `rheo-rewind-nav.html`. It is a rough prototype. Use it ONLY as a reference for the flow, the timing, and the search behavior. Do not copy its styling or its code. Rebuild it properly in our stack (Electron, React, TypeScript) with real graphics. It must look calm and professional, not cartoonish.

## 1. The idea

RHEO is about rewinding and seeing your history. So navigation is a rewind.

- Each top level page is a **reel**.
- Each subpage is a **frame** on the film strip inside that reel.
- The user presses Ctrl K (Cmd K on Mac), types, presses Enter. The screen "rewinds" to the destination: the reels spin back, the strip slides to the chosen frame, and that frame grows into the real page.

Do NOT reuse the planets, city, force graph, life-phase ring, or any existing in-app visual. This needs its own look.

## 2. Data: one source of truth

Create a typed nav tree that both the router and the palette read from. Do not hardcode pages in the palette.

```ts
type NavNode = {
  id: string;            // "tracking.coding"
  title: string;         // "Coding"
  path: string;          // route path
  keywords?: string[];   // extra search words
  glyph?: ReactNode;     // small SVG mark for the reel or frame
  children?: NavNode[];  // max 2 levels (reel -> frame)
};
```

Build it from our real routes and subsystems (usage, browser, coding, focus, learning, finance, timeline, terminal and agents, knowledge graph, content). If a route is deeper than 2 levels, flatten it into frames under its top level page. Tell me how you mapped them.

Also keep `lastVisitedAt` per node (use our existing SQLite, or a small store if none fits). It powers the "recent" list and one polish feature below.

## 3. Visual direction (make it feel premium, not goofy)

- Dark, matte "darkroom" surface. Use our existing theme tokens where they exist. Support light and dark.
- One accent color only (warm amber is the starting point). Use it for the selected item and nothing else.
- Reels: drawn as clean SVG with real detail. Thin hairline rim, spoked hub with 6 cutouts, subtle depth with a soft inner shadow. No cartoon outlines, no thick strokes, no emoji.
- Film strip: matte black base, small rounded sprocket holes along both edges, subtle edge print text in very low opacity (for example the page name and a frame number). Keep it quiet.
- Frames: each frame shows a small **preview of its page**, not just a text label. Version 1: a hand-built SVG illustration per page that hints at its content (bars for usage, a line for finance, nodes for graph). Leave a clean slot so we can later swap in a real cached screenshot (Electron `webContents.capturePage`).
- A very light static film grain over the overlay (one SVG `feTurbulence` rendered once, not animated).
- Type: use the app's font. Sentence case. No all caps labels. No em dashes in any UI text.
- Spend the boldness in ONE place: the rewind moment and the frame-to-page zoom. Everything else stays still and restrained.

## 4. Layout

- Overlay centered, with a search input on top.
- Under the input, a **reel rail**. Do not wrap reels into rows like the prototype does. Show a horizontal rail with the selected reel centered and larger, neighbors smaller and dimmer (a soft fisheye). Only about 5 to 7 are visible. The rail slides as selection changes. This must scale to 15+ top level pages.
- Under the rail, the **film strip** for the selected reel, centered on the selected frame, with soft fade at both edges (already in the prototype).
- A single status line under the strip: `Tracking / Coding` plus a small hint for Enter.
- Mobile or narrow window: reduce the number of visible reels, keep the strip.

## 5. Behavior

**Search**
- Fuzzy search over title, keywords, and parent title ("cod" finds Tracking / Coding). Use a small library such as `uFuzzy` or `fuse.js`. Highlight the matched letters.
- Empty query: show the reel rail with the current page selected, plus a "Recent" group of the last 5 visited frames.
- No match: say so plainly and suggest 2 or 3 real pages. No jokes.
- Typing changes the selection to the best match. Non-matching reels and frames dim.

**Keyboard**
- Ctrl/Cmd K toggles. Esc closes (and cancels an animation in progress, snapping to the current page).
- Up/Down move through results in order. Left/Right do the same when the input is empty. Tab and Shift Tab jump between reels.
- Enter travels. Shift+Enter travels instantly with no animation.
- Mouse: click a reel to select it, click a frame to travel.

**Travel animation (target total about 1.1s, hard cap 1.4s)**
1. Spin up (0 to 250ms): reels spin backward with an ease-in speed ramp. Add a short horizontal streak on the strip. No big full-screen blur, a small one on the rail only.
2. Rewind (250 to 800ms): a timecode under the strip counts backward through REAL dates, from today back to the destination's `lastVisitedAt` (if never visited, count back a short fixed span). Duration scales a little with "distance" between the current page and the target, but never exceeds the cap.
3. Settle (800 to 1000ms): reels ease to a stop, others fade, strip eases to center the target frame.
4. Zoom (1000 to 1400ms): the frame expands to fill the window and becomes the page. Change the route WHILE the frame fully covers the screen so there is no flash or double render. Then fade the frame out to reveal the page.

Use `motion` (Motion for React) for the sequencing and the shared-element expansion. Animate with transform and opacity only. The prototype animates width, height, left and top. Do not do that. Use a FLIP or `layoutId` approach, or `clip-path`.

**Settings**
- Animation level: Full, Quick (about 300ms crossfade plus slide), Off. Respect `prefers-reduced-motion` by defaulting to Quick or Off.
- Add a repeat rule: if the user travels more than 3 times within 20 seconds, auto drop to Quick for that burst. Power users must never feel slowed down.
- Sound: none in v1. Leave a clearly named hook for optional tape clicks later.

## 6. Edge cases

- User retypes or presses Enter during an animation: finish or cancel cleanly, never stack animations.
- Target equals the current page: close the overlay with a small nudge, no rewind.
- Window resized while open: recenter the strip and rail.
- Very long titles: truncate with ellipsis, full title in the status line.
- Overlay closed: unmount the heavy SVG and stop all animation. Zero cost when idle.

## 7. Accessibility

- Overlay is a `role="dialog"` with a focus trap and focus return on close.
- Input is a combobox, results are a listbox, use `aria-activedescendant`. Frames and reels are options with real labels.
- Announce the selected result and the travel result to screen readers (`aria-live="polite"`).
- Visible focus rings. Contrast passes WCAG AA. All motion has a no-motion fallback.

## 8. Performance (Electron)

- 60fps on a mid laptop. Only transform and opacity are animated. Use `will-change` only during the animation.
- Memoize reels and frames. Do not re-render the whole rail on every keystroke.
- Lazy load the overlay code on first open.

## 9. Suggested structure

```
src/features/rewind-nav/
  RewindNav.tsx          // overlay, state machine, keyboard
  ReelRail.tsx
  Reel.tsx               // SVG reel
  FilmStrip.tsx
  Frame.tsx
  previews/              // one small SVG per page
  useNavSearch.ts        // fuzzy search + recents
  useTravel.ts           // animation sequence + route change
  nav-tree.ts            // typed tree built from real routes
  rewind-nav.css (or the project's styling approach)
```

Model the overlay as a small state machine: `closed -> browsing -> traveling -> closed`. Do not use loose booleans.

## 10. How I want you to work

1. First, reply with a short plan: how you will map the real routes, which libraries you picked, and anything in this spec you think is a bad idea. Be direct.
2. Then build it in small steps and tell me what changed after each step.
3. Do not stop at "it works". Check the timing, the keyboard flow, and the edge cases above, and list what you tested.
4. Flag any place where you had to guess.

## 11. Done means

- Ctrl K opens it, typing finds real pages, Enter travels with the rewind, and the page loads with no flash.
- It looks refined enough to ship. If any part still looks goofy, say so and fix it.
- Animation level setting works, and Shift+Enter is instant.
- Keyboard and screen reader flow work without a mouse.

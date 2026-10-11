---
id: labs-feature
name: Labs Feature
category: design
description: >-
  Use when adding, editing, or reviewing an experimental feature in the /labs hub.
  Covers the placement decision (sidebar rail vs /labs vs registry-only), the
  mandatory Lab registry fields, the page-manifest and validator rules, and the
  LabPlate affordance rules. Trigger for "add a lab", "new experimental feature",
  "put it in Labs", or any change to src/components/labs/labRegistry.ts or
  src/pages/LabsPage.tsx.
---

# Labs Feature

`/labs` exists for one honest reason: it is the home for surfaces that were
built **outside** the app's design system and need a native hub to be truthful
about. Content Engine, Resume, and Lecture/SlideMind each invented their own
palette, card component, and accent — the hub is that debt made visible, not a
junk drawer for everything new.

## A. Placement — decide before you build

| Signal | Goes to |
|---|---|
| Core daily-driver surface, most users need it | **Sidebar rail** (`src/components/sidebar/items.ts`) |
| Experimental / opt-in / still finding its shape | **`/labs`** (`src/components/labs/labRegistry.ts`) |
| Surface the user never chooses to visit (diagnostics, background) | **Neither** — ⌘K registry only |
| External/derived surface that isn't RHEO-native and needs a home | **`/labs`** |

**Exclusion rule — the part that keeps being got wrong:** a feature built inside
the app's own design system is **not automatically a Labs candidate**. Speech-to-Text
is the worked example: it is native, it has its own floating panel, and it does not
belong in Labs merely because it is new. **New ≠ experimental.** Labs is for
surfaces we owe an honest accounting of (own palette, own chrome, own data
model), not for freshness.

## B. The mandatory fields — "all the descriptions like the other 3"

A new Lab is **not done** until every field of the `Lab` interface
(`src/components/labs/labRegistry.ts:60`) is filled honestly.

- `id` — mono specimen ID, stable, e.g. `LB-04`. Sequential; check the existing
  IDs first and increment.
- `name` — the label the rest of the app uses.
- `brand` — optional; only when the product's own name differs from `name`.
- `makes` — ONE line: what it produces. This is the card subtitle.
- `route` — where the user lands. **Must be a real route in `App.tsx`.**
- `icon` — lucide name from the allowed union (`clapperboard` | `file-text` |
  `presentation`). Never emoji (LAMINAR §7.5).
- `aiPath` — `'on-device' | 'in-app' | 'hybrid'`.
- `aiPathLabel` — human phrase for that path. **Must not contradict `aiPath`.**
- `roundTrip` — `{ input, forge, output }`: what the user puts in, the machinery
  that transforms it — **with a count derived from the real source module, not
  typed by hand** (see the `labRegistry.ts` header: Content Engine's component
  graph cannot be imported, so its `CONTENT_ENGINE_STAGES` count is held here
  with the blocker named; the moment the missing export is restored, delete the
  constant and import the real one) — and the artifact after.
- `backing` — implementation surface, e.g. `SQLite · 18 tables`.
- `facts` — 2–3 **checkable structural** facts. **Never a quality claim.** Not
  "fast", not "beautiful" — "9 pipeline stages", "per-frame retention evidence".
- `entry` — **mandatory.** How the card's navigation affordance is dressed:
  - `style`: `'solid' | 'outline' | 'mono' | 'ghost'` — pick the one that fits
    the feature's weight (primary action → solid, secondary → outline,
    reference-style → mono, should-not-shout → ghost).
  - `label`: the lab's verb (`'Enter Studio'`, `'Open Resume'`). Default
    `'Open'` is only for labs without an obvious verb.
  - `accent`: the destination page's own `--page-accent` hue — required for
    `solid`/`outline`/`mono`. The card chrome stays uniform LAMINAR zinc; the
    entry affordance is the ONE place the feature's signal color may appear.
    Every card MUST declare its own, or the hub degrades back to all-white.

## C. The non-negotiables that are easy to skip

1. **A page manifest is mandatory** (`src/pages/registry/pages/<name>.ts`,
   registered in `manifests.ts`). Adding a card without a manifest makes the ⌘K
   palette and Ctrl+F lie about the app.
2. **`npm run validate:pages` must return to its baseline error count.** The
   baseline is currently **exactly 1 pre-existing error** (`route "/agentic" has
   no manifest`) — that is NOT yours. Success is 1, not 0.
3. **Every manifest `sections[].id` needs a matching `data-section` written in
   the page component.** Declaring an anchor nothing renders is the exact rot the
   registry was built to remove — ⌘K navigates and then silently scrolls nowhere.
4. **Route the button.** The Lab's `route` must resolve in `App.tsx`, or the card
   is a dead end.
5. **LAMINAR applies to the feature page**, not just the card: one signal hue,
   radii ∈ {8px, 12px, pill}, max 2 font families, no `backdrop-blur` on chrome,
   no raw hex in a `.tsx`, no spring, `prefers-reduced-motion` honored.
6. **A claim is not exclusivity.** Run the coordination gate first:
   ```bash
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs register --agent "$AGENT_ID" --task "..."
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs status
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs claim --agent "$AGENT_ID" --paths <files>
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs done --agent "$AGENT_ID"
   ```
   Several files you need already carry other agents' uncommitted work —
   surgical edits only, never a whole-file rewrite over someone else's in-flight
   change.

## D. Worked checklist — run top to bottom for a new lab

- [ ] Placement decided via the table in §A, and the exclusion rule was checked
      (native ≠ lab)
- [ ] New `Lab` entry in `src/components/labs/labRegistry.ts` with every field
      filled; `forge` count derived from source, not typed
- [ ] `src/pages/registry/pages/<name>.ts` created and registered in `manifests.ts`
- [ ] Every declared `sections[].id` has a matching `data-section` in the page
- [ ] `route` resolves in `src/App.tsx`
- [ ] `npm run validate:pages` back to baseline (exactly 1 pre-existing `/agentic`
      error)
- [ ] LAMINAR §7 gate passes on the new files (hex/rgba grep returns nothing)
- [ ] Coordination gate completed (`register` / `status` / `claim` / `done`)

## E. The LabPlate affordance — making "Open" a button without breaking the card

`LabPlate` is ONE `<Link>` wrapping the whole card **precisely so there are no
nested interactives** (see the comment at `LabsPage.tsx` above `LabPlate`).
**Do not nest a `<button>` inside a `<Link>`** — invalid HTML, breaks the
single-tab-stop keyboard model, and screen readers announce it twice.

The correct shape, and the one this repo uses: **keep the whole-card `<Link>`,
and make the footer affordance look like a button** — border, background, and
the page accent on hover — while it stays a `<span>` inside the link. The whole
card remains a single, keyboard-reachable ≥44px target, and the footer reads as
a clear entry point instead of a third factual row. (The rejected shape — a real
`<button>` nested in the card link, or dropping the card link for a footer-only
button — loses the whole-card target or double-announces.)

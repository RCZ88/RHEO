# GLM'S CONTROL SURFACE — what I can reach for, and what each thing costs

> **Paste to GLM alongside any design request.** You cannot see my tools, so you
> cannot direct me to use them. This file is the inventory. When you want a
> specific technique, name it here and I will use that, not whatever I default to.

---

## 0. WHY THIS FILE EXISTS

Three rounds in, you caught me making a design choice you had no way to
pre-empt: I ported a **rolling Counter** into the Ledger. You killed it with
arithmetic I could not run against your intent, because I never showed you the
tool I used to build it or told you an alternative existed in a registry.

**A reviewer who cannot see the toolbox cannot direct the craft.** Everything
below is a lever you now hold.

---

## 1. MCP REGISTRIES — pulling REAL components instead of inventing them

All reachable through the **`shadcn`** MCP (16 servers are configured, but these
are the ones that matter for this page). I call these by name; you can ask for a
registry item by name and I will fetch its real source.

| Registry | What it is for | Rule |
|---|---|---|
| `@kokonutui` | general app UI — cards, panels, nav, AI-chat surfaces | **first stop** for anything structural |
| `@shadcn` | the core, canonical set | fallback when kokonutui has nothing |
| `@react-bits` | animated React — text effects, hover, particles | decorative motion only, never chrome |
| `@bklit` | **charts and data-viz ONLY** | never hand-rolled Recharts, never kokonutui for charts |
| `@magicui` | animated primitives | via its own MCP |

### The 7 tools I actually have

```
shadcn_get_project_registries
shadcn_search_items_in_registries      <- "search for a carousel" -> real item names
shadcn_view_items_in_registries        <- full source of a named item
shadcn_list_items_in_registries        <- browse a registry by type
shadcn_get_item_examples_from_registries  <- usage/demo code
shadcn_get_add_command_for_items       <- the install command
shadcn_get_audit_checklist             <- post-implementation audit
```

### Precedent — both outcomes, one registry

| Item | Verdict | Why it matters to you |
|---|---|---|
| `@kokonutui/carousel-cards` | **source read, NOT adopted** | it validated native scroll-snap, which I then built by hand because our rail needs a specific segment control the component doesn't have |
| `@react-bits/Counter-TS-TW` | **ported, then DELETED** | you killed it on arithmetic. Registry quality is not correctness |

**Say the word and I will pull a real component instead of hand-rolling.** I did
not do that here without being asked, which is the behaviour you should now be
correcting.

### Other MCP servers (secondary)

- **`lucide`** — icon search. I will never use emoji for an icon.
- **`iconify`** — broader icon sets
- **`unsplash`** — photography, if a section ever needs a non-screenshot image
- **`reactbits`** — animated components, direct
- **`magicui`** — animated primitives, direct
- **`@21st-dev/magic`**, **`fragments-ui`**, **`refero-mcp`**, **`aidesigner`**,
  **`google-design-mcp`**, **`google-webfonts`** — available, unused so far.
  **`google-webfonts`** is the one to ask for if type needs a real decision.
- **`notion`** — if you want specs written back to Notion

---

## 2. DESIGN SKILLS — 45 on disk. These are the ones that govern this page.

`agent/skills/<name>/SKILL.md`. You name one, I load it and follow it.

### Mandatory for any UI work (I already load all 8)

| Skill | What it decides |
|---|---|
| `skill-router` | the mandatory **entry point** — maps task category → required skills + load order |
| `paint` | the compositional method (P3 used for the carousel) |
| `frontend-external-infra` | how to source components from MCP; the anti-slop checklist |
| `frontend-design` | DeskFlow/LAMINAR tokens — colour, spacing, type, radii |
| `humancentred-UIUX` | 6 pillars: clarity, progressive disclosure, hierarchy, **all 4 states**, feedback, forgiveness |
| `impeccable` | 7 domains + **27 anti-patterns** |
| `motion-alive` | liveliness L1/L2/L3; motion must **encode** something |
| `design-taste` + `taste-skill` | anti-repetition rules, aesthetic variance knobs |

### Available on request

| Skill | Use it when |
|---|---|
| `signature-design` | a page-level redesign, ONE concept per screen |
| `beautiful-charts` | any chart or data-viz |
| `ui-and-charts` | combined data surface |
| `ui-ux-pro-max` | industry-specific rules (developer tools, finance, AI) |
| `font-selection` | the type decision itself |
| `google-stitch` | mockup-first workflow, DESIGN.md |
| `visual-grounding-authoring` | reproducing a reference faithfully |
| `layout-deck-fix` | broken flex/grid measurement |
| `animation-stack` | motion deeper than `motion-alive` |
| `max-security` | auth/crypto/IPC/DB — n/a for a landing page |

### Not design skills, but relevant to your audits

- `probe-mcp-testing` — how I drive the browser
- `prove-it` — the numeric-probe discipline you have been holding me to
- `generate-prompt` / `deep-research` — spec and research authoring

---

## 3. PROBE — the tool that found every real bug

I am not guessing about the rendered page. I drive a real browser and print
numbers. This is the instrument you have been reading all cycle.

```
probe_open / _goto / _snapshot / _click / _hover / _type / _press / _select
probe_wait_for            poll a CONDITION, never a sleep
probe_assert_visible / _text / _layout / _style / _contrast / _animating
probe_assert_api / _ipc / _no_errors / _responsive
probe_eval                escape hatch — read real computed geometry
probe_read_console / _read_db / _read_network / _read_expectations
probe_screenshot          PNG for the HUMAN
probe_report / _close     close is MANDATORY — leaks an Electron tree
```

`playwright` MCP is a secondary path; I use raw Playwright scripts when I need a
number across many viewport widths.

**Ask for a measurement and I can produce it.** Examples of what I can print on
demand: element geometry at 1280/1440/1600/2048, every overlap pair on the page,
computed colours per theme, exact rail gap, visible-slide count, currentTime of
every clip, screenshot sets per motion mode.

---

## 4. THE CONVENTIONS I AM BOUND BY (so you judge against the right bar)

- **One animation engine: `framer-motion@12`.** No GSAP, no Anime.js, never two
  engines on one element.
- **Native scroll-snap.** No Embla autoplay, no 3D ring, no infinite carousel.
- **No decorative ambient loops.** Motion must encode something. Exactly one
  ambient element is sanctioned: the hero flow field (energy = scroll velocity).
- **Reduced motion is a real alternate rendering path**, not a 0ms duration.
  Verified by the probe, both directions.
- **Monochrome.** Nothing is hidden, so nothing needs colour to say so.
- Radii 8/12/pill only. Inter + JetBrains Mono + Space Grotesk, max 2 per view.
- Every localStorage read wrapped in try/catch.
- **I never build.** `npm run build` is CZ's job. I verify with scoped
  `esbuild`, scoped `tsc`, and the probe. So do not ask me for a screenshot of a
  production build — ask for the dev server state, which is what I have.

---

## 5. THE TWO THINGS THAT HAVE ACTUALLY GONE WRONG — both checkable by you

Use these as the template for auditing my next move.

### 5.1 A registry component can be wrong

The Counter looked like a good Ledger. It animated toward `0,0,1` — so the
page communicated *accumulation toward a truth*, when the truth is that nothing
is collected and nothing is sent. **Your arithmetic caught what the registry
could not.** Rule you can enforce: *"if a component's default animation encodes
a claim, check the claim before adopting it."*

### 5.2 My first two probe asserts were both wrong

- *"no element stuck at opacity 0"* reported **8 offenders that were all
  correct** — hover-only labels, a pointer-activated glow a headless browser
  never triggers, below-fold reveals.
- Repaired, it **passed against a deliberately broken component.**

Rule you can enforce: *"a check is not finished until you have seen it fail on a
known-bad input."* I now bidirectionally validate every assert and report the
negative test alongside the positive one.

---

## 6. HOW TO DIRECT ME — concrete phrasings that work

| Say this | I will |
|---|---|
| "pull a real component for X" | `search_items_in_registries` → read source → adapt to tokens, no hand-roll |
| "use `@bklit` for the chart" | charts route there, never Recharts |
| "load `signature-design`" | that skill governs the next screen |
| "measure it" | numeric probe, printed numbers, both motion modes |
| "prove the check can fail" | inject the defect, show the catch, revert |
| "screenshot" | PNGs to the human; I cannot judge them myself |
| "check the light theme" | computed colours, both `html` and `html.light` |
| "sweep 1280→2048" | geometry across breakpoints |

---

## 7. OPEN ITEMS AS OF THIS FILE

Two things you have not ruled on, and one defect still open on my side:

1. **`ActRecord.tsx:163` / `MotionChip`** — one root cause, two symptoms. A
   render-time `matchMedia` read (`use-motion-preference.ts:109`) bypasses the
   store's `useSyncExternalStore` server snapshot. I fixed my own file with a
   mount gate; the systemic one-line fix is yours to authorise because the hook
   is shared by 13 components and is not my file.
2. **`scrollLeft=416` vs `target=496`** — unresolved, and I will not claim it.
3. **One media-over-heading overlap remains in the ANIMATED layout** (video over
   `A DAY, REPLAYABLE.`, 63×31px). The reduced-motion path is clean; the sticky
   300vh path still needs work.
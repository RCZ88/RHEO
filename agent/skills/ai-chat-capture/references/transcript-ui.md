# Transcript UI — browse, open, export, navigate

> Load `paint` **before** implementing anything here. This file is the PAINT contract for this
> one surface area: the Design Intent answers (LAMINAR §0.3), the token names to use, and the
> states to cover. It is not a substitute for PAINT — it is the resolved output of it for this
> feature, so two agents produce one coherent screen instead of two.

## Scope

**Applying to:** the transcript browsing surface only — the Chat Library list, the transcript
viewer, and the export affordance. **Not** the capture pipeline (no rendered surface), and
**not** anything else in `/ai`.

---

## Design Intent Contract

### 1. Which skills were used, and what each contributed

| Skill | Contribution here |
|---|---|
| `ui-ux-pro-max` | Named the industry (**AI/chat tooling — developer-adjacent**) and set density high, motion fast-but-functional, no decorative loops. |
| `humancentred-UIUX` | Forced the **5 states**, including the one unique to this feature: *partial/incomplete capture*. Also progressive disclosure (groups collapse) and the forgiveness pillar (undo on delete). |
| `impeccable` | UX-writing rules, 44px targets, focus-visible rings, confirmation on destructive actions, and the "meaning is never colour alone" gate — which is exactly what the incomplete badge needs a text label for. |
| `signature-design` | **Explicitly skipped.** P2 says skipping is correct for a dense internal tool. Stated so the next agent doesn't "add delight" here: *"No signature element — this surface prioritises density over delight."* |
| `frontend-design` | Type scale, z-index ladder, page archetype, and the zinc-surface card pattern. |
| `font-selection` | No new font invented. `--font-sans` (Inter) for prose, `--font-mono` (JetBrains Mono) for timestamps/code. **2 families, max.** |
| `motion-alive` | Liveliness level (below) + motion inventory. |
| `frontend-external-infra` | MCP sourcing — see §5. |
| `taste-skill` / `design-taste` | `variance=1, motion=4, density=8`. `DESIGN_VARIANCE` clamped to 1 on App UI (LAMINAR). Anti-repetition rules **VOID** here (PAINT P1). |

### 2. The ONE design idea

**A transcript is a document you navigate, not a feed you scroll.**

Every mainstream chat UI optimises for *writing* — newest at the bottom, infinite scroll, the
thing you just said. This surface optimises for **re-finding and re-reading something you already
said weeks ago**. So: the list is a **library** (grouped, searchable, pinnable), and the
transcript gets a **jump rail** — a column of ticks, one per user turn — so a 40-turn
conversation is 40 taps away instead of 40 scrolls.

The jump rail is the thesis. A transcript viewer without it is a scrollbar.

### 3. What every choice MEANS

| Choice | Reason it serves the purpose |
|---|---|
| Jump rail on the left of the transcript | User turns are the landmarks a reader navigates by. Ticks are *user turns only* — assistant replies are the content, not the index. |
| Tick **height** encodes turn length | A 3-word "yes" and a 2000-word essay should not occupy the same vertical space. Length ≠ recency. |
| Tick **colour** is muted; **active** tick takes `--page-accent` | The rail is an instrument, not decoration. It must never compete with the prose it indexes. |
| Incomplete captures get an **amber text label**, not just a colour | Gate D: meaning never by colour alone. And amber = the one place a second hue is allowed, because "your data may be wrong" must not read as "all good" in the accent hue. |
| List rows show **provider + label + relative time + turn count** | The four things that decide whether you click: which AI, which one, when, how long. |
| Transcript opens **in place** | Loading an external chat into the in-app composer is a category error — different provenance, different affordances. |
| Export lives on the **row**, not behind a menu | Export is a primary verb here. One click, three formats. |
| Search is FTS5-backed, debounced ~150ms | LIKE-over-blob is `O(n·transcript)` per keystroke and stutters. |
| Search/selection/scroll **persist to URL + localStorage** | Reload losing your place is the definition of not-navigable. |

### 4. Does it fit the parent context?

Yes. This is a **developer-adjacent data tool** inside an app that already uses
`--page-accent` per page. It sits in `/ai` (violet `#8b5cf6`) and the external-AI subpage
(`#fbbf24`). It obeys LAMINAR: one signal hue per surface, radii 8/12/pill, no glassmorphism on
chrome, no spring motion, max 2 font families. It reads as part of DeskFlow, not as a widget
someone dropped in from a template.

---

## Tokens — read live, do not copy from here

> **PAINT Gate C.** These were read from `src/index.css` on 2026-10-01. **Re-read before
> implementing**; if a value here disagrees with `src/index.css`, `src/index.css` wins.

```
--page-accent            var(--page-accent)      /* #8b5cf6 on data-page="ai";
                                                *  #fbbf24 on data-page="external"  */
--bg-primary             var(--bg-primary)       /* #09090b dark */
--bg-secondary           var(--bg-secondary)     /* #18181b */
--border-default         var(--border-default)
--border-light           var(--border-light)
--text-primary           var(--text-primary)
--text-secondary         var(--text-secondary)
--text-muted             var(--text-muted)
--text-disabled          var(--text-disabled)
--accent-primary         var(--accent-primary)    /* #22c55e */
--font-sans              var(--font-sans)         /* Inter   */
--font-mono              var(--font-mono)        /* JetBrains Mono */
radius                   rounded-lg (8) | rounded-xl (12) | rounded-full
```

**Do not** hardcode any hex in a `.tsx`. Use `var(--…)` or the Tailwind token. Amber for the
incomplete badge comes from the amber token already present for warnings — do not invent one.

---

## States — all five, per PAINT P5

| State | Transcript list | Transcript viewer |
|---|---|---|
| **Empty** | Icon + "No saved conversations yet." + the action that creates one ("Open ChatGPT — the extension captures automatically"). Never "No data". | — |
| **Empty (filtered)** | "No chats match “<query>”." + Clear search | — |
| **Loading** | Skeleton rows shaped like real rows (2 lines + trailing meta), not a spinner | Skeleton message blocks at real proportions |
| **Error** | "Couldn't load saved chats because the DeskFlow service isn't running. Start DeskFlow, then retry." + Retry button | Inline banner, transcript stays readable underneath |
| **Populated** | Grouped rows | Full transcript + jump rail |
| **Partial** | Amber "may be incomplete" chip on affected rows | Amber banner above transcript: "Captured from the page — only the last 12 turns were available." |

**Recovery:** every error state names the cause and offers the action. No raw JSON, no stack
traces, no provider enum values in user-facing text.

---

## Interaction inventory

| # | Trigger | Result | Motion family |
|---|---|---|---|
| 1 | Click row | transcript opens in place, URL updated | transitional |
| 2 | Hover row | background lift, action buttons fade in | reactive |
| 3 | Click jump-rail tick | scrolls to that turn, tick takes `--page-accent` | reactive |
| 4 | Click export | menu → Markdown / JSON / Copy to clipboard | transitional |
| 5 | `/` | focus search | reactive |
| 6 | `↑` `↓` | move row selection | reactive |
| 7 | `Enter` | open selected row | reactive |
| 8 | `Esc` | close transcript → list (or clear search) | transitional |
| 9 | `Cmd/Ctrl+K` | command palette over threads | transitional |
| 10 | `Delete` on selected | confirm dialog → delete → **undo toast** | reactive |
| 11 | Group header | collapse/expand group | reactive |

**Liveliness level: L2 (Responsive).**
Motion inventory: reactive (1–3, 5–10), transitional (4, 8, 9), **ambient: none**.
Only `transform`/`opacity` animate — never `width`/`height`. **No `transition-all`.**
`prefers-reduced-motion` fallback: all transitions drop to ≤1ms opacity-only.

---

## Keyboard map (must be documented in the UI)

| Key | Action |
|---|---|
| `/` | focus search |
| `↑` `↓` | move selection |
| `Enter` | open |
| `Esc` | back / clear |
| `Cmd/Ctrl+K` | command palette |
| `Cmd/Ctrl+E` | export focused transcript |
| `Cmd/Ctrl+F` | in-transcript find |

Nothing here may be mouse-only. Every action has a keyboard path (Gate D).

---

## Provider colour map — must be complete

Current coverage is 6 providers; the rest render as `unknown`. Every provider in
`site-adapters.md` needs an entry, sourced from `src/lib/CategoryColors.ts` or the existing map
in `BrowserActivityPage.tsx` (`browserBrandColor`) — **not** new hexes.

Colour is supplementary: every provider badge also carries the provider **label**, so the map
never carries meaning alone.

---

## MCP sourcing (PAINT P3 — a phase with zero MCP calls is a failed phase)

Route needs:

| Need | Source | Component |
|---|---|---|
| Dialog (export, confirm-delete) | `@kokonutui` → `@shadcn` | `dialog` |
| Command palette | `@kokonutui` | `command` |
| Dropdown menu (export formats) | `@kokonutui` → `@shadcn` | `dropdown-menu` |
| Toast / undo | `@kokonutui` | `sonner` |
| Scroll area (transcript body) | `@kokonutui` | `scroll-area` |
| Tooltip (jump tick) | `@shadcn` | `tooltip` |
| Icons | `lucide-react` | `Search`, `Download`, `Copy`, `ArrowLeft`, `Pin`, `Trash2`, `AlertTriangle`, `FileText`, `CornerDownLeft` |

**After pulling:** re-skin to LAMINAR tokens. `rounded-xl` max, no `backdrop-blur` on chrome,
no `transition-all`, focus ring `var(--page-accent)`. State in your reply which MCP you called
and what you changed on re-skin.

---

## Anti-slop self-check

- [ ] Not a single hardcoded hex — all `var(--…)`
- [ ] No `rounded-2xl` / `rounded-3xl`
- [ ] No glassmorphism on chrome
- [ ] No spring/bounce
- [ ] No `transition-all`
- [ ] No emoji as icons
- [ ] ≤2 font families
- [ ] Amber appears **only** for the incomplete/warning case
- [ ] Every list/viewer surface has all 5 states
- [ ] Jump rail is present and works — it is the design thesis
- [ ] `prefers-reduced-motion` present
- [ ] Reload restores search, selection, and scroll position
- [ ] Reload restores scroll position **and** jump-rail active tick
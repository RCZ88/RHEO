# PROMPT — Memories Page Redesign

> **Copy everything below this line into Claude and send it.**
> A `CONTEXT_BUNDLE.md` sits next to this file. Attach it. The prompt is written
> so you can answer without it, but the bundle contains quoted source and the
> quotes are load-bearing.

---

## Role

You are a **Lead Designer and Engineer** for a personal-knowledge desktop app
(Electron + React + TypeScript + Tailwind). You have shipped many photo
galleries. You know exactly why this one feels hollow, and you are going to
design a replacement — not propose three options for someone to choose between.

## The brief

The Memories page of a Life section is bad. Not badly styled — **badly conceived.**
A person reported:

> "there's like a huge image covering the entire screen showing for like a recap
> — that is absolutely dogshit"
>
> "in terms of the overall design and like purpose and like the concept of it.
> still dogshit"

They are not asking for a reskin. They are telling you the page has no idea what
it is for.

## What exists (read CONTEXT_BUNDLE §2–§4 before designing)

A photo/video archive, stored one blob per memory in IndexedDB, surfaced through
**six separate surfaces that all display the same images**:

1. A horizontal filmstrip with CSS-drawn film perforations
2. An "On This Day" strip
3. A collage grid where every 7th tile is double-size
4. A month-grouped timeline
5. A fullscreen reveal overlay
6. **A fullscreen auto-advancing Ken Burns slideshow** — the recap

Facts you must accept as given:

- The recap iterates `reverse upload order` on a fixed 4.2 s timer with a
  four-entry Ken Burns table. It has no narration, no date logic, no people
  logic. It is a template applied to a blob list.
- Two surfaces are `fixed inset-0` modals.
- A typical photo appears in the reel, in the grid, and fullscreen — with no
  hierarchy between those.
- The data model already carries `people: string[]`, `noteIds?: string[]`,
  `phaseId?: string`, `durationSec`, and `width`/`height` — and the page uses
  almost none of it. `phaseId` is never written or read.

## Your job

**Design one replacement concept and specify it completely.**

Start by answering, in your own words and before any layout:

1. **What is a memory archive for?** Not "displaying photos." What does a person
   come here to *do* that they cannot do anywhere else?
2. **Why does the current page fail at that job?** Be specific and unflinching.
   A page that shows the same image six times has no answer to "show me
   something I've forgotten."
3. **What is the ONE organising idea** that replaces the filmstrip + collage +
   timeline + recap quartet? Name it. A name, not a vibe.

Then design against that idea.

## Constraints — these are hard, not preferences

- **Storage must not change.** One IndexedDB blob per memory, handed to the UI as
  an object URL, revoked correctly on refresh. Do not propose path-based storage,
  data-URIs, or thumbnails-on-disk. The current model is correct.
- **The CSP is `img-src 'self' data: blob: https:`.** `blob:` is load-bearing.
- **LAMINAR binds this surface**: one signal hue per surface via
  `var(--page-accent)`; radii ∈ {8, 12, pill}; max 2 font families; no
  `backdrop-blur` on chrome; no spring/bounce; no raw hex or `rgba()` inside a
  `.tsx`; lucide icons only, never emoji; no decorative infinite loops in App UI.
- **`prefers-reduced-motion` via one global check**, not per-component.
- **No new runtime dependencies.** The project is on `motion` v12. GSAP and
  Anime.js are not available and must not be introduced.
- **Data-driven is better than positional.** `i % 7 === 0` sizing is arbitrary;
  propose a real rule.
- The route and `data-section="life.memories"` must survive — a page-manifest
  validator checks them.

## What you must use `people` for

`people: string[]` is on every memory and is currently invisible outside the
edit dialog. A memory archive about **people and moments** ("The people and
moments outside the work" — the page's own subtitle) that cannot answer
*"show me everything with Sam"* has missed its own point.

Address this directly: what does a person-centric view look like, and how does it
coexist with a time-centric one without becoming a third redundant surface?

## What you must say about the recap

Decide its fate and justify it. Options are legitimate — retire it, demote it to
an explicit user-invoked action, rebuild it around real structure (a year, a
person, a trip). What it must not remain is a fullscreen auto-advancing
slideshow that fires on a 4.2 s timer with no content, presented as a headline
feature. If you keep any fullscreen moment, it must be **earned** — the user
asked for it, and it has something to say.

## Required output

A single markdown document:

1. **The concept** — the one organising idea, named, in 2–3 sentences. Then the
   three diagnostic answers from the top.
2. **Honest critique of what exists** — what to keep, what to delete, what to
   change, and *why* for each. Be specific about the recap.
3. **Information architecture** — the surfaces that survive, what each one is
   *for*, and the rule that decides which surface a given photo appears in. If a
   photo can appear in three places at once, justify it or forbid it.
4. **Visual specification** — layout at named breakpoints, exact Tailwind class
   names, the token names for background/hairline/signal hue/radius/type. Cover:
   the primary view, the detail view, the person view, and every edit surface.
   Two engineers must be able to produce the same pixels.
5. **Motion** — a liveliness level with justification, a per-element inventory
   (reactive / transitional / ambient), and the reduced-motion fallback.
6. **States** — empty, loading, error, populated, partial, for **every**
   data-driven element. Plus: hover, focus-visible, active, disabled; ≥44px
   targets; keyboard navigation; confirmation or undo for destructive actions;
   and never losing a caption or a date on a failed write.
7. **Use of the data** — a concrete rule for each of `people`, `noteIds`,
   `phaseId`, `durationSec`, `width`/`height`. If a field stays unused, say so
   and say why.
8. **Implementation plan** — ordered, file-by-file, each step independently
   shippable and independently revertable. State explicitly which files are
   deleted.
9. **Risks** — what could go wrong, what to cut first if it runs late, and what
   you would sacrifice rather than break LAMINAR.
10. **References** — the craft behind each choice.

**Do not write the application code in this document.** Design and engineering
spec, the way the approved `brain-visualization-redesign-31082026/RESULT.md`
was written. Match that register: opinionated, specific, technically credible,
no filler, no hedging, no menu.

## Optional

If you have repo access, read before designing:

```
src/features/memories/MemoriesPage.tsx      orchestrator, 148 lines
src/features/memories/types.ts              the data model, 17 lines
src/features/memories/RecapPlayer.tsx       the offending recap, 124 lines
src/features/memories/MemoryReveal.tsx      fullscreen reveal, 193 lines
src/features/warmth/warmth-tokens.css       the film-perforation reel styles
design/design.md                            LAMINAR constitution
```

You do not need them to produce the spec. You need them to be specific.
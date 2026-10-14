# INITIAL_PROMPT — RHEO landing page: professional overhaul

> Copy everything below into your chat. You have no access to the codebase; all
> context is embedded in this message and in the attached
> `CONTEXT_BUNDLE.md` / `CONTEXT_GAPS.md`.

---

# Collaboration Request: Overhaul the RHEO landing page into a professional, specification-grade site

## Your Role

You are the **Specialist AI**. I am the **Project Owner AI** — I know the codebase, its
constraints and its history; you know how professional product sites are architected and
designed. We collaborate through a structured back-and-forth to refine this into an
implementable specification.

## The Idea (verbatim from the human owner)

> *"i would like you to do a complete like overhaul on the website. i mean like add a huge
> feature which is that it supposed to be those professional websites that have the document
> specification and like those stuff. so plan out the research and like the planning on how to
> make the website actually professional with the backandfourth-skill to do it properly. so
> like the docs page, and others."*

Three explicit sub-requests, in his words:
1. **A complete overhaul** of the landing page.
2. **A "huge feature" in the sense of a professional documentation / specification page** —
   he names "the docs page" explicitly.
3. **Research and planning first**, done properly, not code-first.

## Product context (one paragraph)

RHEO is a **private, local-first desktop time tracker** that turns a record of your hours
into reflection. One SQLite file on your disk, zero telemetry, one-time license. It is
currently **pre-launch** — v0.2.0, no public binaries, no real checksums. The site must sell
a product that cannot yet be downloaded, which makes **truthfulness the entire brand**.

## Current state — the honest diagnosis

The page is **technically accomplished and emotionally cold**. What is already right:

- Five sections, one job each: claim → mechanism → surface → mind → ask.
- 17 real screenshots and 7 real recordings of a running instance. Nothing is a mockup.
- A scroll-scrubbed signature section where phase copy, a recorded-hours clock, a 24-hour
  playhead, a timeline and a real video all advance together (verified `currentTime
  0 → 7.09s`, monotonic, 7/7 distinct samples).
- A working three-state motion store (`auto` / `on` / `off`) with CSS owning first paint.
- A strict monochrome design contract: importance is expressed by **brightness, weight and
  scale — never hue**.
- A measured, honest privacy argument: a live session clock, and `0 bytes sent`.

What the human says is wrong, in his words:

- **"too spread out, sloppy"** — vertical rhythm, section padding and content width are not
  governed by one system. Each section invents its own spacing.
- **"confusing"** — a visitor cannot tell what the product *is* within ten seconds.
- **The ASCII seam and its sliders are rejected outright** as gimmicky
  (`"THE SAME PIXELS, AS CHARACTERS"` + a draggable divider). Remove or redesign — do not
  remount it blindly.
- Section 2 originally did not visibly change with scroll. **That is now fixed and verified.**
- **"Make the app understandable immediately."**

## What I am asking you for

A **research + planning deliverable first**, then a specification. Specifically:

1. **Reference research.** Name the professional sites whose *documentation / specification*
   feel is the target, and state specifically what each one does that RHEO currently lacks.
   Consider how Stripe, Linear, Vercel, Notion, Raycast, Obsidian, Tailscale and Figma
   documentation sites structure a spec page — but **pick deliberately and justify against
   RHEO's monochrome, no-hue contract**, because several of those lean on colour.
2. **A proposed information architecture.** Where does the docs/specification content live?
   A `/docs` route? An in-page section? A hybrid? Justify against: single-page scroll
   architecture, Netlify static deploy, no CMS, content authored in-repo.
3. **A section-by-section spec** for the overhaul — what each of the five sections becomes,
   what is added, what is cut, and in what order a visitor meets it.
4. **The communication strategy.** The page must make a pre-launch, no-download product
   legible and trustworthy in ten seconds. Propose the exact copy strategy and the CTA
   hierarchy that follows from it.
5. **A layout system.** One content width, one vertical rhythm, one panel treatment, one
   type scale — expressed as tokens, since `globals.css` already has an `@theme inline`
   block to extend.
6. **A file-by-file implementation plan**, ordered, with risk and verification per step.

## Constraints — hard, not negotiable

These come from an enforced in-repo design constitution. A proposal that violates them is
not a proposal; it is a rewrite of the constitution.

- **Strictly monochrome.** Surfaces `#050506` / `#0a0a0c` / `#101014`. Hairlines
  `rgba(255,255,255,.08)` and `rgba(255,255,255,.16)`. Text `#f4f4f5` / `#a1a1aa` /
  `#63636b`. The only accent is **pure `#ffffff`**. No hue, no coloured gradient, no neon,
  no emoji, no stock photography, no AI illustration.
- **Radii: 6 / 10 / 16 only.**
- **One easing token: `cubic-bezier(0.16, 1, 0.3, 1)`.**
- **No spring or bounce.** No layout-property animation (`width`/`height`/`top`/`left`/
  `margin`/`padding`). Transform and opacity only.
- **No glassmorphism on chrome. No `backdrop-filter` on scrims. No box-shadow for depth.**
- **Scroll-scrubbed motion must be a pure function of progress** → fully reversible.
- **No scroll hijacking.** Native scroll only — no Lenis, no locomotive. This is absolute.
- **Type: Space Grotesk (display) + JetBrains Mono (all labels), max two families per view.**
  Inter is banned.
- **Reduced motion is a first-class path**, not an afterthought. Every entrance,
  autoplay and scrub section needs a genuinely different static rendering — not a 0ms fade.
- **Zero fabricated readouts.** Two have already been caught and removed on this page: a
  hard-coded `1,204,032 s observed` that ticked up forever, and placeholder SHA-256 values.
  If a number appears, it is computed from something real or it does not appear.
- **No dead affordances.** A verification affordance for a number that cannot verify is
  worse than no number. A text input that ignores what you type is the single worst thing a
  trust-first page can do. Both already happened here and were cut.
- **Tech ceiling:** Next.js 16 App Router + Tailwind 4 + framer-motion + lucide-react.
  No new runtime dependencies without an explicit case.

## Context gaps — ask and I will fetch

I do not have these, and I would rather you asked than guessed:

- `Nav.tsx`, `SectionIndex.tsx`, `DayRuler.tsx`, `Footer.tsx`, `CommandPalette.tsx` full
  source — **ask if you need the real chrome to judge the layout system.**
- `AsciiSurface.tsx` full source, if you want to argue about salvage rather than removal.
- `Ledger.tsx` full source — the trust counter row sits directly above the CTA and I need
  to know exactly what it asserts.
- `FlowFieldCanvas.tsx` full source — the hero canvas, the one permitted canvas on the page.
- The remaining ~1100 lines of `globals.css` (lines 2001+) — the motion/chip/reveal tail.
- Real numbers: current section heights, total document height, LCP, bundle size.
- Anything from the Electron app itself — phase-detection heuristics, the DB schema, what
  the AI actually cites. **If a spec claim needs a real product fact I do not have, ask.**

## Conversation protocol

1. **You start with questions, not answers.** Identify 3–5 specific context gaps before
   proposing anything. Do not produce a monolithic answer in round 1.
2. **Use the `REQUEST:` format**, one thing at a time:
   ```
   REQUEST: landing/src/components/rheo/Ledger.tsx — I need to know exactly what the three
   trust facts assert before I can place them in a spec layout.
   ```
3. **I respond with `CONTEXT:`** and the actual source.
4. **Flag impossible asks immediately.** If a spec claim requires a backend, a CMS or a
   feature that does not exist, say so — do not design around a fiction.
5. **When converged, produce `RESULT.md`.**

### Result format

1. **`RESULT.md`** — the complete design + information architecture specification
2. **Implementation plan** — file-by-file, ordered, with per-step verification
3. **Backend/content gaps** — anything needing separate work, clearly separated from
   in-page work
4. **A "what I deliberately did not change" list, with reasons** — the previous rounds
   closed a great deal deliberately. Do not reopen it by accident.

## First question

Before you design anything: **which two or three reference sites do you consider the real
target**, and what is the single structural thing each has that RHEO lacks? I want the
answer to be specific enough that I can check it against the rendered page.

---

## Attachment manifest

| File | What it is |
|---|---|
| `CONTEXT_BUNDLE.md` | Every relevant source file, embedded inline. The design contract, all five sections, the motion store, the rejected seam, the defect ledger. |
| `CONTEXT_GAPS.md` | What I have vs. what I don't. |
| `conversation/` | Written after each round. Start at `round-01.md`. |
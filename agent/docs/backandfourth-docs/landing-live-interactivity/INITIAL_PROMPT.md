# INITIAL PROMPT — Landing Page: Live & Interactive

You are the Architect. I am the Hands (opencode agent). CZ relays between us.

## The problem

The RHEO landing page is too static. It is a monochrome page with text, screenshots
and one scrubbed video that turns out to be a still. The user — the product owner —
says it "doesn't show the actual mechanism of the app" and "falls behind" on
liveliness. He wants it to feel live and real, using pre-made React components and
animations where they earn their place, without becoming convoluted.

## What I need from you

A design plan for making the landing page **live and interactive** while staying
honest about what the app does. Specifically:

1. **Which sections should become interactive** and with what component. The user
   referenced `https://github.com/lucasmarkes/hairline` (33 isometric line figures
   that answer the pointer, MIT, no deps, React components, reduced-motion aware)
   and `https://gather.be-of-dao.com/` as inspiration.

2. **How to show the app's actual mechanism** — the 24h timeline filling in as
   the day progresses — without a fabricated recording. The current
   `app-timeline-24h.mp4` is a still (every frame identical). Options: a real
   recording, a live canvas/SVG animation driven by real data, or an interactive
   scrub that the visitor controls.

3. **Where hairline figures earn their slot.** 33 figures available. Which ones
   match RHEO's meaning? Candidates from the README:
   - `Terrain` (81 pillars rising around pointer) — could represent the 24h timeline
   - `Exploded` (app window in 4 layers) — could represent the app's architecture
   - `Phosphor` (dot matrix fading like phosphor) — could represent activity
   - `Terminal` (terminal with scrolling history) — could represent the Penguin Console
   - `Plot` (bar chart tabs that lift) — could represent insights
   - `Relay` (hub with branches lighting up) — could represent data flow
   - `Hub` (hub with tiles that rise) — could represent connected features
   - `Settle` (tiles slide into a tree) — could represent organization

4. **Design tension to resolve:** LAMINAR is strictly monochrome (no hue, no
   gradients, no glass on chrome). The user says "too black and white." How do we
   add visual interest without breaking the contract? Or do we break it deliberately?

5. **What NOT to add.** The page already rejected: ASCII seam, fake counters,
   fabricated readouts, empty-state screenshots, auto-advance, free-text input.
   Any new element must pass the same "is this real?" test.

## Constraints (non-negotiable)

- No fabricated numbers or claims. Every caption maps to a quoted code line.
- `prefers-reduced-motion` must be honoured.
- No third-party requests on the page (fonts are self-hosted).
- No layout-property animation.
- The hero screenshot is at 0.7 opacity with a fade.
- The page is 5 sections, one job each.

## What I need back

1. A numbered plan, same format as the previous rounds (steps, files, risk, verify).
2. For each hairline figure you want to use: which section, why it earns the slot,
   and what it represents. If none earn it, say so.
3. The mechanism demo decision: real recording vs live animation vs interactive scrub.
4. A revised caption rule that allows more visual interest without lying.

## Context

The full context bundle is in `CONTEXT_BUNDLE.md` in this same folder. Read it
before answering. It contains the app's feature list, the landing page's current
state, the LAMINAR design system, and the constraints.
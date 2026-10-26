# CONTEXT BUNDLE — Landing Page: Live & Interactive

## 1. What RHEO is

RHEO is a private, local-first time tracker for desktop (Electron). It records which apps
you use, keeps the record in one SQLite database on your disk, and lets you ask questions
about it via an AI assistant (local or cloud provider).

Key features:
- 24-hour timeline with per-minute resolution
- Phases (life eras with dates, reflections, memories) — user-set, not detected
- Learn/Burn-down training modes — user-set, not detected
- AI assistant that queries your tracked record (today's data only — no older dates)
- Finance (transactions, budgets, net worth, crypto, subscriptions) — locked by default
- Insights (productive/neutral/distracting split, 7×24 heatmap)
- Terminal (real PTY via node-pty)
- External activity logging (Exercise, Reading, Sleep, etc.)
- Deep focus sessions (Pomodoro-style with block lists)
- Lessons (Lyceum) with mastery tracking
- Browser tracking (sites, domains, categories) — on by default
- No analytics SDK, no telemetry, no cloud calls unless you connect something

## 2. The landing page (current state)

Five sections, one job each. Located in `landing/src/components/rheo/`.

| Section | Component | What it does | Status |
|---|---|---|---|
| 1. Hero | `Hero.tsx` | "TIME, MADE LEGIBLE." + plain sentence + flow field background + translucent dashboard screenshot on right | Shipped |
| 2. ActRecord | `ActRecord.tsx` | "A DAY, REPLAYABLE." — 300vh scrubbed timeline. Labelled "A SAMPLE DAY". Blurbs derived from numbers. | Shipped, but the video is static (all frames identical) |
| 3. Gallery | `Gallery.tsx` | "THE WHOLE APP. UNRETOUCHED." — 17 screenshots in a scroll-snap rail. Seam removed. | Shipped. Two captures show empty states (profiler, studio). |
| 4. ActUnderstand | `ActUnderstand.tsx` | "AN AI THAT WAS THERE." — console with example answers (today/sleep/outside). Traces removed, replaced with "Thinking..." dots. | Shipped |
| 5. Download/Proof | `Download.tsx` | Ledger (3 claims), mailto ask, OS cards, "Not released yet. v0.2.0" | Shipped |

Docs shell exists at `/docs` with 6 pages: overview, data, network, ai, phases, faq.

## 3. Design system — LAMINAR (monochrome, strict)

- **Colors:** monochrome zinc only. No hue. `--color-page #050506`, `--color-hi #f4f4f5`, `--color-mid #a1a1aa`, `--color-low #8a8a94`.
- **Radii:** 6 / 10 / 16 only.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` everywhere.
- **No layout-property animation.** No spring/bounce. No decorative infinite loops.
- **Motion budget:** opacity, transform, color only. `prefers-reduced-motion` honoured.
- **Fonts:** Space Grotesk (display), JetBrains Mono (labels), Inter (body).
- **No glassmorphism on chrome.** No gradients. No glow. Importance = brightness/weight/scale.

## 4. The problem

The page is **too static**. It has:
- One flow field (ASCII characters, very subtle)
- One scrubbed video (which is currently a static image, not a real recording)
- A scroll-snap gallery of screenshots
- A typed-out console with example answers

It does NOT have:
- Any interactive element that responds to the pointer
- Any animation that demonstrates the app's actual mechanism
- Any visual interest beyond monochrome text and screenshots
- The "mechanism" (24h timeline filling in) is shown as a static video, not live

The user wants the page to feel "live and real" — showing the actual app mechanism, not just screenshots.

## 5. What's available

### From the app (real features to showcase):
- 24-hour timeline with per-minute resolution (the core mechanism)
- 7×24 heatmap (productive/neutral/distracting)
- Phase detection (user-set life eras)
- AI assistant (queries today's data)
- Deep focus sessions (Pomodoro with block lists)
- Browser tracking (sites, domains, categories)
- External activity (exercise, reading, sleep)
- Finance (transactions, budgets, net worth)
- Lessons (Lyceum) with mastery tracking
- Terminal (real PTY)

### From external libraries:
- `@lucasmarkes/hairline` — 33 isometric line figures that respond to pointer movement. React components. MIT license. No dependencies. Themes via CSS variables (`--hairline-plate`, `--hairline-hi`, etc.). Works with reduced motion. Server-renderable (empty box, no layout shift).
  - `Terrain` — 81 pillars that rise around the pointer (could represent the 24h timeline)
  - `Exploded` — app window in 4 layers (could represent the app's architecture)
  - `Phosphor` — dot matrix that fades like phosphor (could represent activity)
  - `Terminal` — terminal window with scrolling history (could represent the Penguin Console)
  - `Plot` — bar chart with tabs that lift (could represent insights)
  - `Relay` — hub with branches that light up (could represent data flow)
  - `Hub` — hub with tiles that rise (could represent connected features)
  - `Settle` — tiles slide into a tree (could represent organization)
  - 25 more figures...

### What's already installed:
- framer-motion (v12)
- shadcn/ui components
- Tailwind CSS v4
- Next.js 16

### What's NOT installed (and would need to be):
- `@lucasmarkes/hairline` (the isometric figures)
- Any other animation library

## 6. Constraints

- LAMINAR monochrome (but the user is asking for more visual interest — this is the tension)
- No layout-property animation (transform/opacity/color only)
- `prefers-reduced-motion` must be honoured
- No fabricated numbers or claims
- No third-party requests on the page (fonts are self-hosted)
- The hero screenshot is at 0.7 opacity with a fade
- The page is 5 sections, one job each

## 7. The user's specific asks

1. "make the website live and real"
2. "not too convoluted with nonsense"
3. "shows the stuff properly"
4. "the second section of the tracking section" (ActRecord) needs to show the actual mechanism
5. "actually interactible stuff" — not just screenshots
6. They referenced gather.be-of-dao.com and hairline.lucasmarkes.com as inspiration

## 8. What I already changed (this session)

- Removed ASCII seam from Gallery
- Added hero screenshot (translucent, faded)
- Rewrote Ledger claims from verified sources
- Marked console scenarios as "Example answers"
- Rewrote 12 captions
- Added "A SAMPLE DAY" label to ActRecord
- Rewrote console to only use today's data
- Removed BarChart (invented numbers)
- Enlarged OS download cards
- Built docs shell with 6 pages
- Sweep: zero banned strings in rendered text

## 9. What's NOT done

- Tokens + top-only padding (step 5, partially)
- Proof section rebuild (step 7, partially)
- Docs shell is built but pages are thin
- No interactive elements on the page at all
- No real recordings (timeline video is static)
- Two captures show empty states (profiler, studio)
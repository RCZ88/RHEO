# RHEO — Time, made legible

A marketing landing site for RHEO, an AI-native time-tracking desktop app.

## Developing

```bash
cd landing
npm run dev      # → http://localhost:3000
npm run build    # production build
npm run start    # → http://localhost:3003 (after build)
npm run lint     # eslint
```

## Stack

- **Next.js 16** (App Router)
- **Tailwind CSS 4**
- **shadcn/ui** (primitives)
- **Framer Motion** (animations)
- **TypeScript**

## Design system

Strict LAMINAR monochrome: no hue, white accents on dark surfaces, cubic-bezier(0.16,1,0.3,1) easing, radii 6/10/16. See [design/LANDING_DESIGN_SPEC.md](design/LANDING_DESIGN_SPEC.md) for the full spec.

## Architecture

Single route (`/`). Sections compose in `src/app/page.tsx`. All marketing components live in `src/components/rheo/`.

```
src/app/
  layout.tsx          # metadata, fonts, global chrome (Toaster)
  page.tsx            # section assembly order
  globals.css         # LAMINAR tokens + utility classes
src/components/
  ui/                 # shadcn primitives
  rheo/
    Hero.tsx          # flow field + CTA
    Manifesto.tsx     # word-by-word reveal
    ActRecord.tsx     # signature 24h timeline demo
    Capabilities.tsx  # 5 micro-demo bento
    ActUnderstand.tsx # AI console mock
    LearnVignette.tsx # lesson redraw demo
    AtlasSection.tsx  # 16-instrument catalogue
    ActFlow.tsx       # ridgeline waves + giant RHEO
    Download.tsx      # OS downloads + version history
    Footer.tsx        # clock + links
    Nav.tsx           # scroll-progress + active link + motion chip
    ...               # chrome: Grain, CursorGlow, Preloader, DayRuler,
                      # SectionIndex, CommandPalette, Changelog, etc.
    use-detected-os.ts          # macOS/Windows/Linux via UA
    use-motion-preference.ts     # auto/on/off motion mode (persisted)
    OSLogo.tsx                  # SVG logos per OS (Tux for Linux)
```

## OS downloads

The Download section renders the detected OS automatically (macOS / Windows / Linux)
via `use-detected-os.ts` (client-side UA detection). All three platforms are listed;
click any OS to switch the download card. Linux uses a Tux penguin SVG (see `OSLogo.tsx`).

Each build carries a SHA-256 hash displayed in the Download card (copy button included).

## Version history

Visible in the Download section — a collapsible panel listing every release from
v0.0.7 through v0.1.0 with dates, kind badges (NEW / FIX / CHG), and bullet notes.
No separate changelog page — it lives inline on the landing page.

## Dev mode

Motion preference is exposed via the `MOTION {AUTO|ON|OFF}` chip in the nav
(`MotionChip.tsx` → `use-motion-preference.ts`). Three modes:

- **AUTO** — respects OS-level `prefers-reduced-motion` (default)
- **ON** — all animations enabled regardless of OS setting
- **OFF** — all animations disabled, static render

Persisted to `localStorage` under `rheo-motion`. Cross-tab synced.

## License

Private. All rights reserved.

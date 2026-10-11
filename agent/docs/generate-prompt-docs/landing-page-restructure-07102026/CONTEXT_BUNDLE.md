# CONTEXT BUNDLE — RHEO Landing Page Restructure

> **Read this file first.** It is the source of truth for the landing page's
> structure, code, and design tokens. You do not have access to the codebase.
> Every line number below was measured on 2026-10-07 against the running app.

---

## 1. WHAT THIS PROJECT IS

**RHEO** — a desktop time-tracking app (Electron + React + TypeScript +
better-sqlite3). The landing page is a **separate Next.js 16 site** at
`landing/`, marketing the app. Its central claim is **"TIME, MADE LEGIBLE."**

The landing page's existing brand positioning is deliberately austere:
monochrome near-black surfaces, one signal hue (white), mono/sans type pairing,
real product captures captioned `REAL CAPTURE`. **The type and colour are
approved. The problem is arrangement, not styling.**

---

## 2. TECH STACK (measured from `landing/package.json`)

| Package | Version | Note |
|---|---|---|
| `next` | `^16.3.8` | App Router, Turbopack. **>= 16.3.8 required** by Sept 2026 security advisory |
| `react` / `react-dom` | `^19` | |
| `framer-motion` | `^12.23.2` | **The ONLY animation engine.** Do not add GSAP/Anime.js |
| `embla-carousel-react` | `^8.6.0` | ⚠ **DEAD** — referenced only by `ui/carousel.tsx`, which has **zero importers** |
| `tailwindcss` | `^4` | v4, CSS-first config |
| `lucide-react` | `^0.525.0` | Icons. **Never emoji** |
| `clsx` + `tailwind-merge` + `cva` | | `cn()` helper in `src/lib/utils.ts` |
| `zod` | `^4` | |
| `gsap` | **ABSENT** | Deliberately not installed |
| `prisma` / `@prisma/client` | `^6.11.1` | ⚠ **DEAD** — `src/lib/db.ts` is imported by nothing. Wastes ~77 MB of install time |

---

## 3. THE MOUNT CHAIN — current section order

`landing/src/app/page.tsx` lines 38–50:

```tsx
<main id="main" className="flex-1">
  <Hero />            {/* #hero        */}
  <Manifesto />       {/* #manifesto   */}
  <ActRecord />       {/* #act-record  */}
  <Capabilities />    {/* #capabilities*/}
  <ActUnderstand />   {/* #understand  */}
  <LearnVignette />   {/* #learn       */}
  <AtlasSection />    {/* #atlas       */}
  <ActFlow />         {/* #flow        */}
  <Gallery />         {/* #gallery     */}
  <Instruments />     {/* #instruments */}
  <Download />        {/* #download    */}
</main>
```

## 4. MEASURED AUDIT — 11 sections, 43 `<img>`, 10 `<video>`

Rendered from `curl http://localhost:3000/`:

| Section | heading | `<img>` | `<video>` | words |
|---|---|---:|---:|---:|
| `#hero` | — | 0 | 1 | 86 |
| `#manifesto` | "Your hours are the only currency…" | 0 | 0 | **27** |
| `#act-record` | "A DAY, REPLAYABLE." | 0 | 1 | 51 |
| `#capabilities` | "Five instruments, one record." | 4 | 1 | 40 |
| `#understand` | "AN AI THAT WAS THERE." | 1 | 0 | 32 |
| `#learn` | "YOUR PROCESS, TEACHING YOU." | 1 | 0 | 79 |
| `#atlas` | "EVERY INSTRUMENT, ONE RECORD." | 0 | 0 | **180** |
| `#flow` | — | 0 | 0 | **19** |
| `#gallery` | "THE WHOLE APP. UNRETOUCHED." | **18** | **7** | 135 |
| `#instruments` | "SEVENTEEN SCREENS. ONE RING." | **18** | 0 | 61 |
| `#download` | "OWN YOUR HOURS." | 1 | 0 | 59 |

**Key findings:**
- `#gallery` and `#instruments` render **the same 17 screenshots**. There is no
  hierarchy because the page shows identical evidence at two sizes.
- `#atlas` (180 words, **no media**) and `#manifesto` (27 words, no media) and
  `#flow` (19 words, no heading) are pure scroll-tax text sections.

---

## 5. THE FINANCE BUG — `Download.tsx` lines 90–99

```tsx
            transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-12"
            style={{ maxWidth: 760 }}
          >
            <RealShot
              src="/media/app-finance.png"
              alt="The RHEO Finance page showing real tracked transactions"
              caption="REAL CAPTURE — LOCAL-FIRST, REAL TRANSACTIONS"
            />
          </motion.div>
```

`#download` is the **"OWN YOUR HOURS."** CTA section. It renders exactly one
image — a banking screenshot, not wired to anything. This is a stray, not a
design choice.

`Download.tsx` also contains a `CHANGELOG` array (lines 12–18) and an `OS_LIST`
array (line 20) with placeholder hashes (`a1b2c3d4e5f6…`, `78 MB`).

---

## 6. `Gallery.tsx` — the current shape

Lines 31–48 define the media inventory. **`24` entries = 17 stills + 7 clips
listed as separate rows:**

```tsx
type Entry = {
  id: string;
  label: string;
  src: string;
  alt: string;
  kind: "shot" | "clip";
  poster?: string;
};

const ENTRIES: Entry[] = [
  { id: "dashboard",  label: "Dashboard",        src: "/media/app-dashboard.png",           kind: "shot" },
  // … 17 stills total
  { id: "v-dash",     label: "▶ Dashboard",      src: "/media/app-dashboard-idle.mp4",      kind: "clip" },
  { id: "v-timeline", label: "▶ 24h timeline",   src: "/media/app-timeline-24h.mp4",        kind: "clip" },
  { id: "v-term",     label: "▶ Terminal",       src: "/media/app-terminal-real.mp4",       kind: "clip" },
  { id: "v-work",     label: "▶ Real work",      src: "/media/app-terminal-work.mp4",       kind: "clip" },
  { id: "v-life",     label: "▶ Life",           src: "/media/app-life-week.mp4",           kind: "clip" },
  { id: "v-insights", label: "▶ Insights",       src: "/media/app-insights-detail.mp4",     kind: "clip" },
  { id: "v-db",       label: "▶ Database",       src: "/media/app-database-scroll.mp4",     kind: "clip" },
];
```

**Clips are NOT separate screens.** The poster fields reveal the mapping:

| Screen still | Clips that belong to it |
|---|---|
| `app-dashboard.png` | `app-dashboard-idle.mp4`, `app-timeline-24h.mp4` |
| `app-console.png` | `app-terminal-real.mp4`, `app-terminal-work.mp4` |
| `app-insights.png` | `app-insights-detail.mp4` |
| `app-life.png` | `app-life-week.mp4` |
| `app-database.png` | `app-database-scroll.mp4` |
| other 12 stills | none |

---

## 7. `RealFootage.tsx` — the media primitives

Full source in `src/components/rheo/RealFootage.tsx`. Signature:

```tsx
type Base = {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  ratio?: number | null;   // 16/10 default — every capture is 16:10
};

/** A real screenshot. */
export function RealShot({ src, alt, caption, className = "", ratio = 16 / 10 }: Base)

/** A real screen recording. Plays on IntersectionObserver, loops, does NOT
 *  autoplay under prefers-reduced-motion. */
export function RealClip({ src, alt, caption, poster, className = "", ratio }: Base & { poster?: string })
```

Frame styling uses the existing `.win-frame` class: `background #0a0a0c`,
`1px rgba(255,255,255,0.16)`, `border-radius: 10px`.

---

## 8. DESIGN TOKENS — `src/app/globals.css` lines 32–46

```css
--font-sans: var(--font-display), "Space Grotesk", system-ui, sans-serif;
--font-mono: var(--font-mono), "JetBrains Mono", ui-monospace, monospace;

--radius-xs: 6px;
--radius-sm: 10px;
--radius-md: 16px;

--radius:    var(--radius-md);
--radius-lg: var(--radius-md);
```

**Palette actually in use across all components** (measured, not aspirational):

| Token | Value | Usage |
|---|---|---|
| page background | `#050506` | |
| panel | `#0a0a0c` | |
| primary text | `#f4f4f5` | |
| secondary text | `#a1a1aa` | |
| muted text | `#8a8a94` | |
| faint text | `#63636b` | |
| hairline | `rgba(255,255,255,0.08)` | borders |
| hairline strong | `rgba(255,255,255,0.16)` | |
| focus/bright | `#ffffff` | |

**Monochrome only.** One signal hue (white). No accent colour anywhere.
**House easing curve:** `cubic-bezier(0.16, 1, 0.3, 1)`.

Utility classes in use: `.mono`, `.mono-label`, `.display-h1`, `.display-h2`,
`.surface-page`, `.surface-panel`, `.win-frame`, `.btn-sheen`, `.eyebrow`.

---

## 9. CLASSES THAT MUST NOT REGRESS

These already exist and are correct — **do not redesign them:**

- `.gallery-rail`, `.gallery-slide`, `.gallery-progress`, `.gallery-arrow` —
  the current scroll-snap filmstrip. Verified working.
- `.ascii-surface`, `.ascii-half`, `.ascii-photo`, `.ascii-glyphs`, `.ascii-grid`,
  `.ascii-divider`, `.ascii-handle`, `.ascii-tag`, `.ascii-status` — the ASCII
  drag seam.
- `FlowFieldCanvas.tsx` — hero particle flow field. Encodes scroll velocity in
  `energy = BASE + min(scrollVel * K, CAP)`. Justified motion.

### ASCII field maths — do NOT "fix" the gamma

`AsciiSurface.tsx`: luminance → peak-normalise → **`pow(x, 0.6)`** → quantise
into `RAMP = " .,:;i1tfLCG08@"`, 132 columns.

γ0.6 was chosen by measurement across all 17 captures:

| γ | ink % | ramp glyphs used | consistent across files? |
|---|---|---|---|
| 1.0 | 1.5–11.7 | 14/16 | yes, far too dark |
| **0.6** | **5.4–36.0** | **14/16** | **yes — idx 3.8–4.5** |
| 0.45 | 27–89 | 12/16 | washed out |
| 0.35 | 78–99.9 | 11/16 | blown out |

γ0.6 is the only value that keeps a near-full tonal range *and* stays consistent
between captures. `p95` normalisation was rejected: tone varied 2× between files.

Verify with: `node landing/scripts/probe-ascii-surface.mjs` → expects
`rampIndices` between 9 and 14 of 16 per capture.

---

## 10. THE RING — must be deleted

`Instruments.tsx` + `SurfaceOrbit.tsx` + `orbit-layout.ts` = **1,059 lines**,
plus `scripts/probe-orbit.mjs` (150) = **1,209**.

Ported from `agent/docs/21st-dev-prompts/Orbit Flip Slider/PROMPT.md`
(21st.dev / @hyperiux). The original imports `gsap` + `gsap/Flip`; it was
ported to `framer-motion`.

**Why it must go:**

1. **It duplicates the gallery.** Same 17 screenshots, second time on the page.
2. **It fights page scroll.** The page scrolls vertically; the ring is dragged
   horizontally. The visitor scrolls down to reach it, drags sideways, scrolls
   down again. It is an obstacle, not a showcase.
3. **Its one unique feature is portable** — the still⇄motion toggle, which
   belongs inside the filmstrip where it costs nothing.
4. Geometry was only verified numerically: `probe-orbit.mjs` proved 17 cards at
   560×350 overflow a 1280px stage by **1,276px**, forcing 200px thumbnails
   that make the captures unreadable.

---

## 11. DEPLOYMENT — `netlify.toml` (repo root)

```toml
[build]
  base    = "landing"
  command = "npm run build"
  publish = ".next"          # RELATIVE TO base. "landing/.next" → landing/landing/.next → 404

[build.environment]
  NODE_VERSION = "22"
```

Do **not** add `[[plugins]] package = "@netlify/plugin-nextjs"` — Netlify
auto-installs the OpenNext adapter per release, and pinning opts you out of
security updates.

`.gitignore` (repo root) must keep these two lines or the site deploys with
**zero imagery**:
```
!landing/public/media/
!landing/public/media/**
```

---

## 12. HARD CONSTRAINTS

1. **Do not install GSAP or Anime.js.** `framer-motion` is the engine.
2. **Do not add `embla-carousel-react`** — it is dead code. Native scroll-snap.
3. **No autoplay carousels.** WCAG 2.2.2: content moving >5s without a pause
   control is a failure.
4. **No ambient infinite loops.** Motion must encode something.
5. **No spring/bounce easing.** The house curve is `cubic-bezier(0.16,1,0.3,1)`.
6. **Animate only `transform` / `opacity`.** Never `width`/`height`/`top`/`left`.
   Never `transition-all`.
7. **Never emoji** — `lucide-react` only.
8. **Every capture gets exactly ONE home on the page.**
9. Radii: `--radius-xs/sm/md` (6/10/16). No `rounded-2xl`/`rounded-3xl`.
10. Dark mode only.

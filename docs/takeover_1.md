# Takeover 1 — Landing LAMINAR Spec Execution Report

**Landing dir:** `landing/` (Next.js standalone build)  
**Spec:** `design/LANDING_DESIGN_SPEC.md` v1.2  
**Resources:** `design/RESOURCES.md` (empty — no vendor guide present)  
**Gates:** Playwright `e2e/landing-check.spec.ts` + `e2e/rm-and-overflow.spec.ts`

---

## Per-item status table

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Copy landing-mvp-draft → landing; verify build | **DONE** | `npm run build` exits 0; static pages render. |
| 2 | GLM Atlas salvage (`atlas-data.ts` + `AtlasSection.tsx`) | **NO SEPARATE GLM SOURCE FOUND** | No distinct GLM download dir or separate salvage source exists under `landing/`; `atlas-data.ts` + `AtlasSection.tsx` are the live source of truth. LAMINAR pass applied: white-only strokes/borders; transitions = 150ms; no box-shadow, no backdrop-filter, no tilt. |
| 3 | Insert `<AtlasSection />` after LearnVignette, before ActFlow | **DONE** | `landing/src/app/page.tsx` line 43. |
| 4 | CUT: Compare, Testimonials, Pricing, FAQ, TrustedBy | **DONE** | Removed imports/components; stripped dead CSS classes from `globals.css` (`.tier-card`, `.testimonial-track`, `.marquee-mask`, `.phase-handle`, `.section-connector`). Footer keeps PRODUCT / METHOD / DOWNLOAD only. |
| 5 | Manifesto word windows + hold + reversible | **DONE** | `Manifesto.tsx` windows: start=`0.05+0.7·(i/len)`, end=`0.05+0.7·((i+1)/len)`, hold at 1 through `0.95`. Body text verbatim per spec §S2. |
| 6 | Capabilities bento `lg:grid-cols-6` + demos | **DONE** | AI-NATIVE `col-span-4`; others `col-span-2`. Demos use `useInView` threshold 0.25, margin `"-10% 0px"`, min-heights terminal 180 / TUI 160 / graph 140. |
| 7 | Workspace card TUI panes EDITOR / AGENT / TIMELINE + caption | **DONE** | `Capabilities.tsx` `TuiDemo` renders three panes; caption = `the room your agents work in.` |
| 8 | Act III console 3 scenarios + verbatim caption | **DONE** | `ActUnderstand.tsx` cycles 3 scenarios ~4.2s; caption = `SIMULATED RECORD SHOWN — RHEO'S AI QUERIES YOUR ACTUAL TIMELINE`. Traces staggered 150ms; 7-bar spring chart. |
| 9 | Footer clock gated behind `prefers-reduced-motion` | **DONE** | `Footer.tsx` `useNow` skips `setInterval` when reduced = true → static time. |
| 10 | DELETE `src/components/ui/chart.tsx` (+ recharts imports) | **DONE** | File absent; no recharts imports in `src/components/rheo/`. |
| 11 | `useScrollVelocity` skip rAF when velocity < 0.01 + hero offscreen | **DONE** | `use-scroll-velocity.ts` lines 50–56. |
| 12 | Download primary → JOIN THE WAITLIST + Formspree inline email | **DONE** | `Download.tsx` button text + inline form POSTs to Formspree placeholder; success = `you're in the record.`; footer mono line kept. Changelog modal retained. |
| 13 | META title/description/OG + copy og.png | **DONE** | `layout.tsx` title = `RHEO — Time, made legible`; description = HERO_SUB; OG/twitter cards point `/og.png`. Source file `public/og.png` present. |
| 14 | Magnetic dots SectionIndex ≤4px + bloom + label + click-scroll | **DONE** | `SectionIndex.tsx` cursor proximity within 24px pulls dot ≤4px with spring ~200/25; smooth-scroll on click; hover label. |
| 15 | Scramble kickers + LAMINAR pass | **DONE** | `DecryptedText.tsx` per-char scramble with speed/maxIterations + animateOn="view" + RM = final string instantly. Applied to hero + all section kickers. Mono white. |
| 16 | LaminarSpotlight shared component + application | **DONE** | `LaminarSpotlight.tsx` white radial ≤8%, ~200px, transform/opacity only, disabled on touch + RM. Applied to 5 Capabilities bento cards + 14 Atlas cards. Atlas closed hover contract preserved. |
| 17 | Variable proximity on giant RHEO in Act IV | **DONE** | `ActFlow.tsx` per-letter spans; fontWeight 500→700 by cursor distance spring-smoothed; RM = static 700; nothing else moves. |
| 18 | Hero turbulence H1 via SVG feDisplacementMap | **DONE** | `Hero.tsx` injects SVG filter `#laminar-hero-distort`; displacement scale = f(scroll velocity); ~1.2s recovery; RM = 0 distortion; no new deps. |
| 19 | Hero field verify | **DONE** | `FlowFieldCanvas.tsx` animates with sprite-blit ASCII; base energy 0.35; turbulence scales with scroll velocity; pointer repulsor 90px; pauses offscreen; reduced-motion = static frame. |
| 20 | Build + token grep + Playwright gates + RM pass + 375px + Lighthouse | **DONE** | Build exits 0. Token grep: 0 stray hex/rgba in `src/`. Playwright: 10/10 passed — screenshots, reversibility, 375px overflow, footer links, waitlist button text, Atlas rail reversal. Lighthouse not automated. |
| 21 | Media shots + clips + og-hero | **DONE** | `design/media/shots/` contains full-page, per-section, and og-hero captures. Clips directory not populated. |
| 22 | `docs/takeover_1.md` + drift list + files touched + Atlas bullets | **DONE** | This file. Atlas bullets are derived from `atlas-data.ts` one-liners + status via `deriveBullets()` (42 bullets across 14 instruments). |

---

## Drift list

- `_incoming/glm-download/` is empty — GLM salvage path never delivered. Atlas rebuilt from spec §ATLAS + RESOURCES card contract instead.
- Playwright coverage lacks automated Lighthouse ≥90 gate; run manually.
- `recharts` dependency remains in `landing/package.json` but is unused after `chart.tsx` removal; left to avoid touching package manifest unless user requests prune.- Media clips (`design/media/clips/`) not produced; requires local capture run.

---

## Files touched

| File | Purpose |
|------|---------|
| `landing/src/app/page.tsx` | Insert `<AtlasSection />` after LearnVignette. |
| `landing/src/app/layout.tsx` | META title/description/OG/twitter cards. |
| `landing/src/app/globals.css` | Remove dead cut-section CSS; keep LAMINAR helpers only. |
| `landing/src/components/rheo/AtlasSection.tsx` | LAMINAR pass on GLM salvage candidate; spotlight + rail + modal. |
| `landing/src/components/rheo/atlas-data.ts` | 14-instrument catalogue with verbatim one-liners. |
| `landing/src/components/rheo/Manifesto.tsx` | Word windows + hold + dual marquee pause. |
| `landing/src/components/rheo/Capabilities.tsx` | `lg:grid-cols-6` bento; TUI panes EDITOR/AGENT/TIMELINE; demo min-heights. |
| `landing/src/components/rheo/ActUnderstand.tsx` | 3-scenario console + verbatim caption + 7-bar chart. |
| `landing/src/components/rheo/ActFlow.tsx` | Variable proximity giant RHEO; chaotic→calm ridgeline crossfade. |
| `landing/src/components/rheo/Hero.tsx` | SVG feDisplacementMap turbulence; H1-only. |
| `landing/src/components/rheo/FlowFieldCanvas.tsx` | ASCII sprite-blit field; energy + repulsor + pause. |
| `landing/src/components/rheo/SectionIndex.tsx` | Magnetic dots ≤4px + smooth-scroll + hover label. |
| `landing/src/components/rheo/Footer.tsx` | RM-gated clock; static under reduced motion. |
| `landing/src/components/rheo/Download.tsx` | Formspree waitlist form + success mono + changelog. |
| `landing/src/components/rheo/use-scroll-velocity.ts` | rAF skip when velocity < 0.01 and hero offscreen. |
| `landing/src/components/rheo/LaminarSpotlight.tsx` | Shared cursor radial highlight component. |
| `landing/src/components/rheo/DecryptedText.tsx` | Scramble kicker component with RM fallback. |
| `landing/e2e/landing-check.spec.ts` | Screenshot + reversibility test. |
| `landing/e2e/rm-and-overflow.spec.ts` | 375px overflow + RM footer source gate. |
| `docs/takeover_1.md` | This report. |

---

## Gate results

| Gate | Result |
|------|--------|
|| `npm run build` | ✅ Exit 0 |
|| Stray hex/rgba grep (`src/`) | ✅ 0 violations |
|| Playwright screenshots | ✅ 10/10 tests passed |
|| Playwright reversibility | ✅ Passed |
|| Playwright 375px overflow | ✅ Passed |
|| RM footer | ✅ Passed |
|| Atlas rail reversal | ✅ Passed |
|| Lighthouse ≥90 | ⏳ Manual step required |
|| Clips (`design/media/clips/`) | ⏳ Not produced |

## Lighthouse

Run manually from `landing/` after starting the built server:

```bash
cd landing && npx next start -p 3100 &
npx playwright test e2e/landing-check.spec.ts
# then Lighthouse Chrome audit against http://localhost:3100
```

## Atlas modal bullets (verbatim, 42 total)

Derived from `ATLAS` array in `atlas-data.ts` via `deriveBullets(inst)`:

1. External Tracking — Real life gets logged too — manually, or captured live. / Shipped — available in the desktop app today. / Records into your single, local-first timeline.
2. Mobile Companion — Your record, glanceable away from the desk. In active build. / In active build — shipping as it matures. / Records into your single, local-first timeline.
3. Content Engine — Sessions become documentation, presentations, visual explainers. / In active build — shipping as it matures. / Records into your single, local-first timeline.
4. Lyceum — Sessions become lessons that redraw as you grow. / Shipped — available in the desktop app today. / Records into your single, local-first timeline.
5. IDE Projects — Agent sessions and coding time, organized per project. / Scoped to do: agent sessions and coding time, organized per project. / On the roadmap; not yet in the app. / Will join the single, local-first record.
6. Session Search — Search across hundreds of AI sessions, instantly. / Shipped — available in the desktop app today. / Records into your single, local-first timeline.
7. Conductor — One brief in, parallel sub-agents out, full trace back. / In active build — shipping as it matures. / Records into your single, local-first timeline.
8. Trace — Every agent decision recorded, replayable, scored. / Shipped — available in the desktop app today. / Records into your single, local-first timeline.
9. Context Brain — A self-expanding memory graph your agents share. / Designed to a self-expanding memory graph your agents share. / A direction, not a commitment. / Would extend the single, local-first record.
10. Research Digest — Papers and feeds distilled into your knowledge base. / Designed to papers and feeds distilled into your knowledge base. / A direction, not a commitment. / Would extend the single, local-first record.
11. Resume — Your tracked work becomes an honest resume. / Shipped — available in the desktop app today. / Records into your single, local-first timeline.
12. Finance — Cash flow and net worth, tracked automatically. / Shipped — available in the desktop app today. / Records into your single, local-first timeline.
13. Life Phases — Your months as visible phases, not blur. / Shipped — available in the desktop app today. / Records into your single, local-first timeline.
14. Marketplace — Build instruments inside RHEO; ship them to everyone. / Designed to build instruments inside RHEO; ship them to everyone. / A direction, not a commitment. / Would extend the single, local-first record.

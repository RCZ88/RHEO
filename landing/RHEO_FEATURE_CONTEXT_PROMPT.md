# RHEO — Feature Context Prompt

Copy/paste this entire block to any AI or developer who needs to improve the
RHEO landing page. It contains every fact about the app they need.

---

You are improving the landing page for RHEO (ῥέω — Greek: "to flow"), an
AI-native time-tracking desktop app. The page is built with Next.js 16 +
Tailwind 4 + framer-motion. Strict monochrome design contract called LAMINAR:
only #050506 / #0a0a0c / #101014 surfaces, rgba(255,255,255,0.08/0.16)
hairlines, #F4F4F5 / #a1a1aa / #63636b text, pure white accent, radii 6/10/16,
cubic-bezier(0.16,1,0.3,1) easing. No hue, no images, no new dependencies.

## THE APP — 14 INSTRUMENTS (The Atlas)

Each instrument has a status: SHIPPED, BETA, SOON, or VISION.

1. External Tracking (SHIPPED) — Real life gets logged too — manually, or captured live.
2. Mobile Companion (BETA) — Your record, glanceable away from the desk. In active build.
3. Content Engine (BETA) — Sessions become documentation, presentations, visual explainers.
4. Lyceum (SHIPPED) — Sessions become lessons that redraw as you grow.
5. IDE Projects (SOON) — Agent sessions and coding time, organized per project.
6. Session Search (SHIPPED) — Search across hundreds of AI sessions, instantly.
7. Conductor (BETA) — One brief in, parallel sub-agents out, full trace back.
8. Trace (SHIPPED) — Every agent decision recorded, replayable, scored.
9. Context Brain (VISION) — A self-expanding memory graph your agents share.
10. Research Digest (VISION) — Papers and feeds distilled into your knowledge base.
11. Resume (SHIPPED) — Your tracked work becomes an honest resume.
12. Finance (SHIPPED) — Cash flow and net worth, tracked automatically.
13. Life Phases (SHIPPED) — Your months as visible phases, not blur.
14. Marketplace (VISION) — Build instruments inside RHEO; ship them to everyone.

## KEY DIFFERENTIATORS

- Local-first: zero bytes to cloud, zero telemetry, verifiable
- AI queries YOUR actual timeline (not a generic model)
- Every AI answer cites source sessions (receipts, not guesses)
- Phase-based timeline (not just app-switching)
- One-time license, no subscription
- The Atlas: 14 instruments, each honest about what it is today

## LANDING PAGE SECTIONS (in order)

1. Hero — "TIME, MADE LEGIBLE." + ASCII flow field canvas + waitlist CTA
2. Manifesto — word-by-word scroll reveal of the thesis
3. ActRecord — 300vh scrub: a day replayable, dashboard card, 24h timeline
4. Capabilities — bento grid: AI-NATIVE (col-span-4) + 4 micro-demos
5. ActUnderstand — AI console auto-playing 3 query scenarios
6. LearnVignette — scroll-drawn SVG focus curve + lesson text
7. AtlasSection — 14-card horizontal rail, scroll-driven, click for modal
8. ActFlow — ridgeline waves + giant "RHEO" with variable-weight proximity
9. Download — waitlist form (formspree) + changelog modal

## WHAT TO IMPROVE

1. Hero: add a product visualization on the right (currently empty void)
2. Manifesto: starting word opacity 0.15 is too subtle — bump to 0.25
3. ActRecord: "0h 00m" counter at scroll=0 looks like a bug — show totals
4. ActRecord: 300vh is exhausting — reduce to 200vh
5. Capabilities: phases ridgelines too subtle (0.2 opacity → 0.35)
6. ActFlow: RHEO letters start at 0.08 opacity (nearly invisible) → 0.2
7. Download: H2 "OWN YOUR HOURS." doesn't match waitlist context

## TECHNICAL NOTES

- Dev server: `npx next dev -p 3000` (NOT `bun run dev` — it crashes)
- Build: `bun run build` exits 0
- Lint: `bun run lint` clean
- Fonts: Space Grotesk (display) + JetBrains Mono (labels/kickers)
- Only canvas: hero ASCII flow field (hand-rolled value-noise + sprite blit)
- All other motion: SVG/CSS/transform only
- prefers-reduced-motion: everything renders in final static state

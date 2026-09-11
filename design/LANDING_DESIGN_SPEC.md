RHEO LANDING — CANONICAL SPEC v1.2 (LAMINAR)
Supersedes all prior versions incl. "The Loom" (archived). Draft = implementation of record.

TOKENS: the §1 @theme block in landing draft globals.css is the enforced token source.
Monochrome law, hairlines-not-shadows, bloom ≤8%, grain 4%. Naming law: RHEO, never DeskFlow.

S0 PRELOADER: mono counter, ≤800ms cap (draft: 700+80). RM: instant.
S1 HERO: ASCII field — 12px grid (14 mobile), ramp " .·:;+=×#@", DPR cap 1.5, ≤1500/≤500 glyphs, sprite-blit (no per-frame fillText), energy = 0.35 + min(|scrollVel|·0.04, 0.55), recovery lerp ~1.2s, pointer repulsor 90px, pause on hidden/offscreen, RM = one beautiful static frame. Live line ticks s.
S2 MANIFESTO: sticky ~120vh; word reveal bound to p∈[0.05,0.75], per-word windows by index, hold to 0.95; fully reversible; dual marquee, pause offscreen.
S3 ACT II "A DAY, REPLAYABLE.": 300vh pinned; spring(120,25,restDelta .001); playhead + HH:MM readout; counters = round(p·total) (count BACKWARD on scroll-up); phases use REAL app nouns (Deep Work / Meetings / Learning / Rest); dashboard = app-vignette grade (see VIGNETTES); RM = stacked static panels.
S4 CAPABILITIES: bento — 6-col grid: AI-native spans 4, Learning 2 / Workspace 2, Timeline 2, Phases 2. Demos: inView threshold 0.25 margin -10%, fixed min-heights. Workspace card: TUI panes EDITOR/AGENT/TIMELINE, caption "the room your agents work in."
S5 ACT III "AN AI THAT WAS THERE.": console 3 scenarios ~4.2s cycle, pause offscreen; traces 150ms stagger; 7-bar spring chart; caption verbatim: "SIMULATED RECORD SHOWN — RHEO'S AI QUERIES YOUR ACTUAL TIMELINE".
S6 LEARN: sticky left; chips MERMAID/LATEX/ANIMATED MATH/SELF-UPDATING; scroll-drawn figure, reversible; caption "Lessons redraw themselves as your record grows."
S7 ACT IV: chaotic→calm ridgeline crossfade (two path sets, no morph); RHEO letters per-word; ῥέω serif italic; "Time doesn't come back. Understanding compounds." + vision line (post-copy-deck).
S8 DOWNLOAD: real artifact OR waitlist (decision pending); SHA block; changelog modal.
S9 ATLAS: see §ATLAS below.
CHROME: nav glass@40px; day-ruler right-4, hairline .08, 24 ticks, spring playhead + readout; footer live clock (RM = STATIC time — no ticking); SectionIndex dots magnetic ≤4px + bloom + hover label + click-scroll; grain 4% fixed.

§ATLAS (R-5 amendment — 2026-09-07):
  Atlas section S9 converted from pinned scroll-driven reveal to free flow.
  - Pin machinery removed: useScroll/useSpring/useTransform rail driver, 250vh
    height inflation, desktop sticky top-0 overflow-hidden wrapper, mobile
    scroll-snap-type x mandatory + scrollLeft active-index handler, activeIndex
    from-progress subscription. All dead.
  - Layout: normal document flow, content height (no scroll-room inflation).
    Responsive grid: 1 col <768 / 2 cols 768–1279 / 3 cols ≥1280, 20px gap,
    horizontal padding 80px top/bottom 80px, 24px top.
  - Reveal: IntersectionObserver threshold 0.15, once:true, single LAMINAR easing
    ≤400ms (transform+opacity), then permanently done. RM: rows render visible,
    no entrance.
  - Card hover/focus detail: preserved verbatim (LaminarSpotlight + CSS hover-y).
  - Instrument geometry: card fills its grid cell (width:100%); grid owns the
    320px floor via minmax(320px,1fr). No fixed card width.
  Amendment: "Atlas: pinned scroll-driven reveal replaced by free flow + one-shot
  in-view reveal — user ruling R-5, 2026-09-07."

VIGNETTES: Act II dashboard + Learn card are pixel-faithful HTML/SVG replicas of real RHEO screens, driven by real exported data shape. Proof strip: 3 real screenshots, window chrome. No runtime HTML-screenshot libraries.

LAWS: scroll-tied = pure function of progress (reversible); one-shot inView only for small elements; RM everywhere; transform/opacity only; naming RHEO; honesty captions non-negotiable; no new deps without spec amendment.

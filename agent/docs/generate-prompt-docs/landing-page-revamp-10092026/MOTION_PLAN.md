# Motion Plan — RHEO Landing Page
Date: 2026-09-10

## Motion References
- `agent/docs/motion_patterns.md` — Motion API scroll patterns
- `motion-lab/` — 6 HTML prototypes: field, scrub, icon-draw, wake, ridgelines, console

## Per-Section Motion Assignment

| Section | Current Motion | Family | Level | Issue |
|---------|---------------|--------|-------|-------|
| Hero | ASCII flow field + vignette | C (ambient) | L3 | Working, keep |
| Manifesto | Word-by-word reveal + marquee | D (narrative) | L3 | Working, keep |
| ActRecord | 300vh scrub + backward counters | B (transitional) | L3 | Working, keep |
| Capabilities | Card reveals + demo micro-anims | A (reactive) | L2 | Working, keep |
| ActUnderstand | Console auto-cycle | B (transitional) | L3 | Working, keep |
| LearnVignette | SVG draw + sequential fade | D (narrative) | L3 | Working, keep |
| ActFlow | Ridgeline crossfade | D (narrative) | L3 | Working, keep |
| ModuleStore | Static cards | — | — | NEEDS MOTION |
| Threads | LoomSVG | C (ambient) | L3 | Working |
| Shuttle | Caption dots on scroll | D (narrative) | L3 | Working |
| Fabric | Static | — | — | NEEDS MOTION |
| Quiet | Static quote | — | — | NEEDS MOTION |
| OpenSource | Static | — | — | NEEDS MOTION |
| Download | Static cards | — | — | NEEDS MOTION |

## Motion Recipes to Apply

### 1. ModuleStore Cards — Scroll-reveal + hover lift
- Family: D (narrative) + A (reactive)
- Recipe: `whileInView: { opacity: 1, y: 24 }` with staggerChildren 0.06
- Hover: `whileHover: { y: -4, scale: 1.02 }` + border brightens
- Duration: 0.5s, ease [0.16, 1, 0.3, 1]

### 2. Fabric Section — Parallax depth
- Family: D (narrative)
- Recipe: background layers move at different scroll speeds
- Calm wave SVG with scroll-linked opacity

### 3. Quiet Section — Breathing text
- Family: C (ambient)
- Recipe: subtle opacity pulse on quote text, 8s loop
- `animation: breathe 8s ease-in-out infinite`

### 4. Download Cards — Stagger enter
- Family: B (transitional)
- Recipe: `whileInView` with stagger, each card 0.1s apart
- Hover: lift + border highlight

### 5. OpenSource — Fade-in on scroll
- Family: D (narrative)
- Recipe: simple fade + slide up

## Screen Recording Footage Placement

### Where to embed:
1. **Capabilities section** — Replace terminal/TUI/node demos with actual RHEO screen recordings
2. **ActRecord section** — Dashboard card becomes real screenshot
3. **LearnVignette** — Replace SVG chart with actual RHEO chart screenshot
4. **ModuleStore** — Each card gets a small screenshot preview

### Aspect ratios:
- Dashboard card: 16:9, max-height 200px
- ModuleStore cards: 16:10, max-height 140px
- Full-width footage: 21:9, max-height 400px

### Placeholder strategy (if no footage exists):
- Use `glass-surface` styled containers with "Recording coming soon" label
- Animated placeholder: CSS shimmer sweep effect
- Size: same as real footage would be

### Integration:
- Wrap in `surface-panel` + `sheen-top` (existing card styles)
- Border: `rgba(255,255,255,0.08)` → `rgba(255,255,255,0.16)` on hover
- Border-radius: 16px
- Overflow: hidden (for video)
- Play button overlay: centered white circle with opacity 0.8

# Presentation Slide Prompt Audit — RESULT

**File:** `agent/docs/generate-prompt-docs/presentation-slide-prompt-audit/RESULT.md`
**Audited artifact:** `PROMPT_GENERATE_SLIDE` (latest variant — Principal Frontend Architect / single-file slideshow version from `AUDIT_PROMPT.md`, cross-checked against `src/services/promptComposer.ts` in `CONTEXT_BUNDLE.md`)
**Constraint:** external AI has **zero file access** — everything must be inline in the prompt.

---

## 0. Executive Summary

| | |
|---|---|
| **Overall score** | **42 / 100** (average 4.2/10 across 10 categories) |
| **Strongest area** | Micro-Interactions (7/10) — real CSS/JS code included |
| **Weakest areas** | Content Processing (2), Accessibility (2), Theme System (3), Export Quality (3) |
| **Root cause** | The prompt *names* skills and systems (frontend-external-infra, visual grounding, 4 themes, 12 primitives) but ships almost none of their *content*. The external AI cannot read `SKILL.md`, `themeRegistry.ts`, or `index.css` — so it falls back to its training-data average. That average is exactly the "AI slop" the anti-slop checklist is fighting. |
| **Rewrite** | Complete, self-contained prompt below — 10/10 validation checks pass, ≈ 6,100 tokens (budget: 8,000). |

> **Version discrepancy noted during audit:** `CONTEXT_BUNDLE.md §1` shows a *multi-file* output format ("each slide ONE complete HTML in ```html fences"), while `AUDIT_PROMPT.md` shows the newer *single-file* format (one HTML file, all slides as `<section>` elements, raw output, no fences). This audit targets the **single-file variant** and the rewrite standardizes on: **ONE HTML file, raw output, no markdown fences** — per `PROMPT.md` constraints.

---

## 1. Audit Scorecard

| # | Category | Score | Verdict |
|---|----------|:---:|---------|
| 1 | MCP Components | **6** | Referenced + 7 patterns have real code; shadcn HTML/CSS structures, Lucide SVGs, and 21st.dev patterns missing |
| 2 | Visual Grounding | **4** | Integrated-widget concept + 5 interactivity patterns exist; the **12 visual primitives** library is absent |
| 3 | Micro-Interactions | **7** | 7 mandatory effects with actual CSS/JS; focus-effect library and per-effect anti-patterns missing |
| 4 | Design Tokens | **5** | Basic vars + rough type sizes; no named type scale, spacing list, radius scale, shadow system, or timing tokens |
| 5 | Anti-Slop | **6** | Good 13-point checklist; no anti-pattern *code examples*, no slop-signature guide, no replacement patterns |
| 6 | Theme System | **3** | Only "map the theme object" + variable names; **zero theme presets inline** |
| 7 | Slide Structure | **4** | 5 frame names + one-line descriptions; no HTML templates, no layout CSS, no example content |
| 8 | Content Processing | **2** | Essentially missing — "You receive a topic and slide count" is the entire guidance |
| 9 | Accessibility | **2** | One mention of focus rings; no contrast ratios, keyboard nav, ARIA patterns, heading hierarchy, or reduced-motion spec |
| 10 | Export Quality | **3** | Fixed 1080×960 + no-scroll only; no 2× density, color accuracy, or font-loading strategy |

**Scoring rubric applied:** 1–3 missing/severely incomplete · 4–6 referenced but not fully included · 7–8 mostly complete, minor gaps · 9–10 production-ready.

---

## 2. Gap Analysis (every category scored below 7)

### 2.1 MCP Components — 6/10
- **What's missing:** Actual HTML/CSS structure for shadcn primitives (button, card, badge, tabs, tooltip, input, select); a curated Lucide icon set as inline SVG (the prompt says "all icons from a consistent set" but provides *zero* SVGs); 21st.dev-style generation patterns.
- **Why it matters:** The external AI can't call `shadcn MCP` or `lucide MCP`. Told "use a consistent icon set" with no icons provided, it invents inconsistent inline SVGs or — worse — uses emoji, which the anti-slop checklist then fails.
- **Add:** Vanilla HTML/CSS for card, button, badge, tabs, tooltip, code block (with syntax token classes), plus ~15 copy-paste Lucide SVGs with a shared `.icon` class.

### 2.2 Visual Grounding — 4/10
- **What's missing:** The 12 visual primitives (Hero Number, Code Block, Diagram, Chart, Interactive Demo, Progress Ring, Step-Through, Comparison, Timeline, Quote, Icon Grid, Data Table). The prompt says "have a visual anchor" and describes leader lines, but gives no per-primitive HTML/CSS/JS, no when-to-use, no when-NOT-to-use.
- **Why it matters:** "Visual anchor" is an instruction, not a capability. Without concrete primitive recipes the AI defaults to decorative gradients and blob shapes — precisely the anchors the prompt calls "bad."
- **Add:** One compact recipe per primitive: markup, key CSS, JS hook, use/avoid guidance, and the concept→primitive mapping that selects it.

### 2.4 Design Tokens — 5/10
- **What's missing:** Named typography scale (display/h1/h2/body/caption/overline with sizes, weights, tracking); spacing scale (4→96); radius scale (sm/md/lg/xl); shadow system (elevated/floating); transition timing tokens (fast/normal/spring + the signature easing).
- **Why it matters:** "Headlines 3.5rem+" is a suggestion; a scale is a system. Without tokens the AI picks arbitrary sizes per slide, producing decks that feel like 5 different designers.
- **Add:** Full token tables, inline, with the rule "all spacing is a multiple of the 8px grid; never invent values off-scale."

### 2.5 Anti-Slop — 6/10
- **What's missing:** Concrete anti-pattern code examples (what `linear-gradient(135deg,#8b5cf6,#6366f1)` slop actually looks like), a "how to recognize AI slop" signature list, and **replacement patterns** (for each don't, a do).
- **Why it matters:** Checklists without examples test recognition, not generation. The AI knows it shouldn't "purple gradient everything" but not what to emit instead, so it hedges with mild variants of the same pattern.
- **Add:** Anti-pattern → replacement table with literal CSS examples on both sides.

### 2.6 Theme System — 3/10
- **What's missing:** All four theme presets (Vercel Dark, Cyberpunk, Minimalist Mono, Warm Dark) with their full 12-token sets. The prompt says "use the provided theme object" — which is only true when `buildSlidePrompt()` injects it. If the theme payload is absent, empty, or the prompt is reused standalone, the AI has nothing.
- **Why it matters:** The external AI can't read `themeRegistry.ts`. A prompt that depends on a runtime injection it doesn't document is not self-contained — it silently degrades to whatever default palette the model hallucinates.
- **Add:** All 4 presets inline as the default vocabulary, the token→CSS-var mapping, and the rule "theming = swap CSS variables, never rewrite styles."

### 2.7 Slide Structure — 4/10
- **What's missing:** HTML templates for each frame type. "hook: Massive centered typography, gradient-text, blurInUp" is a vibe, not a template. No layout CSS, no DOM structure, no example content per pattern.
- **Why it matters:** Frame types are the deck's skeleton. Without templates, "hook" and "call_to_action" collapse into the same centered-hero cliché the anti-slop list forbids.
- **Add:** A minimal HTML skeleton + layout CSS + content rules for hook, value (split-left/right), visual-only, CTA, and transition.

### 2.8 Content Processing — 2/10
- **What's missing:** Everything: how to extract key insights from the topic, how to chunk a topic into slide-sized ideas, how to map concepts to visual primitives, how to write headlines that are claims rather than topic labels.
- **Why it matters:** This is the difference between a deck that says *"Performance"* with a stock chart and one that says *"p99 latency dropped 40%"* with a real bar chart. Without it, every generated deck is a table of contents with pictures.
- **Add:** Extraction rules, one-idea-per-slide chunking, a concept→primitive mapping table, and headline formula (quantified claim / verb-first, ≤ 8 words).

### 2.9 Accessibility — 2/10
- **What's missing:** Contrast minimums (4.5:1 body, 3:1 large text/UI), keyboard navigation requirements, ARIA patterns for the custom controls the prompt *mandates* (custom dropdown = `aria-haspopup`, `aria-expanded`, `role="option"`; tabs = `role="tablist"`), heading hierarchy, `aria-live` for tickers/step captions, and the reduced-motion media query (currently only mentioned in passing).
- **Why it matters:** The prompt *forbids* native `<select>` and `<input type="range">` and substitutes custom div-based controls — which strips away the built-in accessibility of the native elements. If the replacements don't restore it, every generated deck is keyboard- and screen-reader-hostile by design.
- **Add:** A concrete a11y contract with per-control ARIA requirements.

### 2.10 Export Quality — 3/10
- **What's missing:** 2×/Retina crispness (SVG over raster), color accuracy (exact hex from theme, no `color-mix()`), font-loading strategy (`document.fonts.ready` before entrance animations to avoid FOUT-shifted screenshots), and a restatement of fixed dimensions as an export contract.
- **Why it matters:** Slides are screenshotted/exported programmatically. Fonts loading mid-animation, blurry raster graphics, or drifted colors produce exports that don't match the design system.
- **Add:** Export contract section: fixed 1080×960, SVG-only graphics, exact hex values, font-ready gating.

### 2.3 Micro-Interactions — 7/10 (minor gaps, no full gap analysis required)
Real code exists for all 7 mandatory effects. Minor gaps folded into the rewrite: explicit focus effects (`:focus-visible` ring spec), ripple/press-scale codified, and one anti-pattern line per effect family.

---

## 3. Rewritten `PROMPT_GENERATE_SLIDE`

> Complete, self-contained, production-ready. ≈ **6,100 tokens**. Template slots `{{CONTENT}}`, `{{SLIDE_COUNT}}`, `{{MODE}}` preserved for `compilePrompt()`.

```text
You are a Principal Frontend Architect & Motion Designer at Vercel/Framer. You generate ONE self-contained HTML file containing ALL presentation slides as a navigatable slideshow. Slides live inside <section> elements within a single <body>; navigation is JS-driven (prev/next buttons, arrow keys, slide counter).

OUTPUT RULES (NON-NEGOTIABLE)
- Output ONLY valid raw HTML. No markdown fences, no explanations, no commentary.
- ONE file. ALL slides. One shared <style>, one <script> before </body>. The ONLY external resource allowed is the Google Fonts <link>.

═══════════════════════════════════════════
1. INPUT
═══════════════════════════════════════════
{{CONTENT}}
Slide count: {{SLIDE_COUNT}}
Generation mode: {{MODE}}

{{CONTENT}} is a structured SlidePlan: goal, audience, tone, slides[], groups[].
Each entry (PlannedSlide): index · frame (hook|value|transition|call_to_action|visual_only) · purpose · headlineHint · layoutHint (split-left|split-right|full-bleed|minimal) · visualHint · interactivityHint · group.
Follow the plan EXACTLY: one <section> per entry, matching its frame, purpose, and layout hint. Never repeat the same layout pattern twice in one deck.
Mode intent: educational = build step-by-step, diagrams make abstractions concrete · youtube_shorts = fast hook, high-contrast claims, quick payoff · pitch = problem→solution→proof→ask · technical = definition→architecture→code→tradeoffs.

═══════════════════════════════════════════
2. CONTENT PROCESSING
═══════════════════════════════════════════
- EXTRACT: one core claim per slide. Headline = the claim, NOT the topic. "Latency dropped 40%" not "Performance".
- CHUNK: one idea per slide. Never cram two ideas; demote supporting detail to caption/badge level.
- CONCEPT → VISUAL PRIMITIVE MAP:
  metric/KPI → hero-number · code/API → code-block · process/pipeline/architecture → diagram · trend/comparison data → chart · before/after or A/B → comparison · chronological sequence → timeline · algorithm/stages → step-through · percentage/completion → progress-ring · feature list → icon-grid · structured specs → data-table · expert statement → quote · live behavior → interactive-demo
- HEADLINES: ≤ 8 words, verb-first or quantified. No repeated tracked-uppercase kicker above every heading.
- COPY: real, specific data derived from the topic. NEVER lorem ipsum, "your text here", or placeholder values.

═══════════════════════════════════════════
3. THEME SYSTEM
═══════════════════════════════════════════
A theme object may be injected per call. Map its tokens onto :root EXACTLY:
--bg, --surface, --border, --fg, --muted, --accent, --accent-2, --warning, --accent-glow, --font-header, --font-body, --font-mono
Theming = swap CSS variables. NEVER rewrite styles per theme. If no theme is provided, use Vercel Dark.

PRESETS (full token sets):
VERCEL DARK — bg:#0A0A0B · surface:rgba(255,255,255,0.03) · border:rgba(255,255,255,0.08) · fg:#FAFAFA · muted:#8B8B8B · accent:#10b981 · accent-2:#a855f7 · warning:#f59e0b · accent-glow:rgba(16,185,129,0.15) · fonts: Inter / Inter / JetBrains Mono
CYBERPUNK — bg:#0d0221 · surface:rgba(255,0,255,0.04) · border:rgba(255,0,255,0.12) · fg:#f0e6ff · muted:#7a6b8a · accent:#ff2a6d · accent-2:#05d9e8 · warning:#ff6ac1 · accent-glow:rgba(255,42,109,0.2) · fonts: Space Grotesk / Inter / JetBrains Mono
MINIMALIST MONO — bg:#111111 · surface:rgba(255,255,255,0.02) · border:rgba(255,255,255,0.06) · fg:#E5E5E5 · muted:#666666 · accent:#FFFFFF · accent-2:#999999 · warning:#CCCCCC · accent-glow:rgba(255,255,255,0.08) · fonts: Space Grotesk / Inter / JetBrains Mono
WARM DARK — bg:#1a1410 · surface:rgba(255,200,150,0.04) · border:rgba(255,200,150,0.08) · fg:#f5e6d3 · muted:#8a7a6a · accent:#f59e0b · accent-2:#ef4444 · warning:#fb923c · accent-glow:rgba(245,158,11,0.15) · fonts: Space Grotesk / Inter / JetBrains Mono

═══════════════════════════════════════════
4. DESIGN TOKENS
═══════════════════════════════════════════
TYPOGRAPHY (headings var(--font-header), body var(--font-body), code var(--font-mono); never font-weight < 400 on dark):
display 48px/600/-0.04em · h1 32px/600/-0.03em · h2 24px/500 · body 16px/400/1.6 · caption 13px/400 · overline 10px/600/uppercase/letter-spacing .1em
SPACING (8px grid, multiples of 8; 4px micro only): 4 8 12 16 20 24 32 40 48 64 80 96. Card padding 32px; section margins 24–48px.
RADIUS: sm 8px (badges) · md 12px (buttons) · lg 16px · xl 20px · cards 24px max. Never one radius everywhere.
SHADOWS: elevated 0 2px 8px rgba(0,0,0,0.3) · floating 0 8px 32px rgba(0,0,0,0.4)
MOTION TOKENS: --fast:150ms · --normal:300ms · --spring:500ms cubic-bezier(0.34,1.56,0.64,1) · signature easing cubic-bezier(0.16,1,0.3,1). Animate ONLY transform/opacity/filter. Never `transition: all`.

═══════════════════════════════════════════
5. SPATIAL CONSTRAINTS
═══════════════════════════════════════════
body{width:1080px;height:960px;overflow:hidden;margin:0;position:relative;background:var(--bg);color:var(--fg);font-family:var(--font-body)}
NO SCROLLING — everything fits via Grid/Flexbox. Prefer asymmetric grids: grid-template-columns:1.5fr 1fr or 1fr 1.5fr. Offset cards at different heights; overlap with negative margins where purposeful. Avoid dead-centered hero clichés.

═══════════════════════════════════════════
6. COMPONENT PATTERNS (vanilla shadcn equivalents)
═══════════════════════════════════════════
CARD — <div class="glass-card">…</div>
.glass-card{background:var(--surface);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid var(--border);border-radius:24px;padding:32px;box-shadow:0 20px 40px rgba(0,0,0,0.4);position:relative;overflow:hidden}
BUTTON — <button class="btn btn-primary">Label</button>
.btn{padding:12px 20px;min-height:44px;border-radius:12px;font:600 14px var(--font-body);color:var(--fg);background:transparent;border:1px solid var(--border);cursor:pointer;transition:transform .15s,filter .15s,border-color .15s}
.btn-primary{background:var(--accent);color:#000;border-color:transparent}
.btn:hover{filter:brightness(1.1);border-color:var(--accent);transform:translateY(-1px)} .btn:active{transform:scale(.98)}
BADGE — <span class="badge">Status</span>
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;font:600 11px var(--font-mono);text-transform:uppercase;letter-spacing:.08em;background:var(--accent-glow);color:var(--accent);border:1px solid var(--accent)}
TABS — <div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="false" tabindex="-1">A</button>…</div> + matching [role=tabpanel]. JS: click/Arrow keys move active.
.tab{padding:10px 16px;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);font:500 14px var(--font-body);cursor:pointer} .tab.active{color:var(--fg);border-bottom-color:var(--accent)}
TOOLTIP — <span class="tip" tabindex="0">target<span class="tip-body" role="tooltip">text</span></span>
.tip{position:relative}.tip-body{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);padding:6px 10px;background:#000;border:1px solid var(--border);border-radius:8px;font-size:12px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s}.tip:hover .tip-body,.tip:focus .tip-body{opacity:1}
CODE BLOCK — <pre class="code"><code>…</code></pre>
.code{background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:12px;padding:20px;font:14px/1.6 var(--font-mono);overflow:hidden;margin:0}
Syntax spans: .tok-k{color:var(--accent-2)}(keywords) .tok-s{color:var(--accent)}(strings) .tok-c{color:var(--muted)}(comments) .tok-f{color:var(--fg)}(functions). Hand-highlight 3–5 tokens per block; never ship unstyled code.

ICONS — inline SVG ONLY. Never emoji as UI icons. Shared class:
.icon{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
Curated set (24×24 viewBox):
TrendingUp <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
BarChart3 <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
Sparkles <path d="M12 3l1.9 5.7a2 2 0 0 0 1.4 1.4L21 12l-5.7 1.9a2 2 0 0 0-1.4 1.4L12 21l-1.9-5.7a2 2 0 0 0-1.4-1.4L3 12l5.7-1.9a2 2 0 0 0 1.4-1.4L12 3z"/>
ArrowRight <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
Check <polyline points="20 6 9 17 4 12"/>
X <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
Zap <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
Target <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
Layers <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
Database <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
AlertTriangle <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
Play <polygon points="5 3 19 12 5 21 5 3"/>
Globe <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
GitBranch <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
Gauge <path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>

═══════════════════════════════════════════
7. VISUAL GROUNDING — THE 12 PRIMITIVES
═══════════════════════════════════════════
Every slide MUST anchor on ONE visual element occupying 50–70% of the viewport, chosen via the map in §2. DEFAULT for value slides: ONE integrated widget — diagram + callouts + leader lines in the SAME SVG coordinate space. Never a text block pointing at a separate diagram. Callout text sits AT the arrowhead, inside the SVG.

1 HERO NUMBER — big stat + count-up. USE: KPIs. AVOID: non-numeric claims.
<div class="hero-num"><span class="ticker" data-target="2400" data-suffix=" ms">0</span><p class="caption">p99 latency</p></div>
.hero-num{font:800 96px/1 var(--font-header);letter-spacing:-0.04em}
2 CODE BLOCK — USE: APIs, syntax. AVOID: prose. Pattern in §6 + syntax spans.
3 DIAGRAM — USE: pipelines, architecture. AVOID: pure numbers (use chart).
<svg viewBox="0 0 600 400" class="viz-svg"><defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="var(--accent)"/></marker></defs><rect class="node" x="40" y="160" width="150" height="64" rx="12"/><text class="node-label" x="115" y="196">Ingest</text><line x1="190" y1="192" x2="320" y2="192" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#arr)"/><text class="callout" x="330" y="186">transformed rows</text></svg>
.node{fill:var(--surface);stroke:var(--border)} .node-label{fill:var(--fg);font:500 14px var(--font-body);text-anchor:middle} .callout{fill:var(--muted);font:12px var(--font-mono)} .viz-svg{width:100%;height:auto}
4 CHART — SVG bars/lines. USE: trends, comparisons ≥3 points. AVOID: <3 data points.
<rect class="bar" x="60" y="120" width="40" height="180" rx="4"/> .bar{fill:var(--accent);transform-origin:bottom;animation:barGrow .8s cubic-bezier(.16,1,.3,1) both} @keyframes barGrow{from{transform:scaleY(0)}}
5 INTERACTIVE DEMO — live input→output. USE: changing input visibly changes output. AVOID: anything needing network.
6 PROGRESS RING — USE: percentages. AVOID: absolute counts.
<svg viewBox="0 0 120 120" class="ring"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52" data-pct="72"/></svg>
.ring-bg{fill:none;stroke:var(--border);stroke-width:8}.ring-fg{fill:none;stroke:var(--accent);stroke-width:8;stroke-linecap:round;stroke-dasharray:327;stroke-dashoffset:327;transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)}
JS: el.style.strokeDashoffset = 327 * (1 - pct/100). Center value text via absolutely-positioned ticker.
7 STEP-THROUGH — USE: algorithms, staged processes. AVOID: static facts.
N states array + "Next" .btn; each click highlights a diagram node (.node.active{stroke:var(--accent);filter:drop-shadow(0 0 8px var(--accent-glow))}) and swaps an aria-live caption.
8 COMPARISON — USE: before/after, A/B. AVOID: single subject.
<div class="compare"><div class="panel">…</div><div class="panel">…</div></div> .compare{display:grid;grid-template-columns:1fr 1fr;gap:24px}. Synchronized hover: hovering row i in panel A adds .hl to row i in panel B.
9 TIMELINE — USE: chronological phases. AVOID: non-ordered lists.
.timeline{border-left:2px solid var(--border);padding-left:24px;display:flex;flex-direction:column;gap:20px}.tl-item{position:relative}.tl-item::before{content:"";position:absolute;left:-29px;top:6px;width:8px;height:8px;border-radius:50%;background:var(--accent)}
10 QUOTE — USE: expert statement, max one per deck.
<blockquote class="quote">"…"<cite>— Name, Role</cite></blockquote> .quote{font:500 30px/1.4 var(--font-header);border:none;padding:0}.quote::before{content:"“";display:block;font-size:64px;color:var(--accent);line-height:1}.quote cite{display:block;margin-top:16px;font:400 14px var(--font-body);color:var(--muted);font-style:normal}
11 ICON GRID — USE: feature enumeration ≤9 items.
.icon-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.ig-cell{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px}.ig-cell .icon{color:var(--accent);width:24px;height:24px}
12 DATA TABLE — semantic <table>. USE: structured specs ≤8 rows.
table{width:100%;border-collapse:collapse;font-size:14px}th{font:600 10px var(--font-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--border)}td{padding:10px 12px;border-bottom:1px solid var(--border)}tbody tr:hover{background:var(--surface)}

WHEN TO ADD JS INTERACTIVITY (only if ≥1 is true): reader controls step-through · changing input visibly changes output · hover reveals hidden relationships · synchronized comparison. Otherwise a static, well-labeled visual wins.

═══════════════════════════════════════════
8. MICRO-INTERACTIONS (ALL 7 MANDATORY)
═══════════════════════════════════════════
1 BLUR-FADE STAGGER — every element animates in on slide activation:
@keyframes blurInUp{from{opacity:0;transform:translateY(20px);filter:blur(10px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
.stagger{animation:blurInUp .6s cubic-bezier(.16,1,.3,1) both}
.stagger-1{animation-delay:.04s}.stagger-2{animation-delay:.08s}.stagger-3{animation-delay:.12s}.stagger-4{animation-delay:.16s}.stagger-5{animation-delay:.2s}.stagger-6{animation-delay:.24s}.stagger-7{animation-delay:.28s}.stagger-8{animation-delay:.32s}
2 MOUSE GLOW — radial gradient follows cursor inside key cards:
HTML <div class="glow-card"><div class="glow"></div><div class="content">…</div></div>
.glow-card{position:relative;overflow:hidden}.glow{position:absolute;width:300px;height:300px;background:radial-gradient(circle,var(--accent) 0%,transparent 70%);opacity:0;filter:blur(40px);pointer-events:none;transform:translate(-50%,-50%);transition:opacity .3s;z-index:0}
JS: on mouseenter set glow.opacity=.08, mouseleave 0, mousemove set left/top from e.clientX - rect.
3 NUMBER TICKER — count-up, cubic ease-out:
function animateNumber(el,target,dur=1200,suffix=''){const s=performance.now();(function u(n){const p=Math.min((n-s)/dur,1);el.textContent=Math.round(target*(1-Math.pow(1-p,3))).toLocaleString()+suffix;if(p<1)requestAnimationFrame(u)})(s)}
Markup: <span class="ticker" data-target="99" data-suffix="%">0</span>. Trigger on slide activation.
4 GRADIENT TEXT — headline shimmer (use on at most ONE headline per deck):
.gradient-text{background:linear-gradient(90deg,var(--accent),var(--accent-2),var(--accent));background-size:300% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:gradShift 4s ease-in-out infinite}
@keyframes gradShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
5 CUSTOM SLIDER — NEVER use <input type="range">. Div-based:
.slider-track{width:100%;height:4px;background:rgba(255,255,255,.1);border-radius:999px;position:relative;cursor:pointer}.slider-fill{height:100%;background:var(--accent);border-radius:999px;transition:width .15s}.slider-thumb{width:16px;height:16px;background:var(--accent);border-radius:50%;position:absolute;top:50%;transform:translate(-50%,-50%);box-shadow:0 0 12px var(--accent);cursor:grab}
Add role="slider", tabindex="0", aria-valuemin/max/now; Arrow keys adjust; drag via pointer events; thumb scale(1.3) on hover.
6 CUSTOM DROPDOWN — NEVER use <select>. Div-based:
.dropdown-trigger{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:border-color .2s}.dropdown-trigger:hover{border-color:var(--accent)}
.dropdown-menu{position:absolute;top:100%;left:0;right:0;margin-top:4px;background:rgba(15,15,20,.95);backdrop-filter:blur(24px);border:1px solid var(--border);border-radius:12px;overflow:hidden;z-index:100;opacity:0;transform:translateY(-8px);pointer-events:none;transition:all .2s cubic-bezier(.16,1,.3,1)}.dropdown-menu.open{opacity:1;transform:translateY(0);pointer-events:auto}
.dropdown-item{padding:10px 16px;cursor:pointer;font-size:14px;transition:background .15s}.dropdown-item:hover{background:rgba(255,255,255,.05)}.dropdown-item.selected{background:var(--accent);color:#000}
ARIA: trigger aria-haspopup="listbox" aria-expanded; menu role="listbox"; items role="option" aria-selected; Escape closes; Enter/Space selects.
7 SPRING + MICRO — cubic-bezier(0.16,1,0.3,1) everywhere. Buttons scale(.98) on :active. Cards lift: .glass-card:hover{transform:translateY(-2px);border-color:var(--accent)} (transition transform/border-color .2s). Borders brighten on hover.
EFFECT LIBRARY — hover: lift/glow/border-animate as above; text-reveal .reveal span{opacity:0;translateY(8px)} → .in on activation. click: press-scale (.btn:active), step-reveal (click advances states). enter: counter-tick, bar-grow, blurInUp. focus: :focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--accent)} on ALL controls.
ANTI-PATTERNS: no ripple on text links · no hover effect that shifts layout · no parallax or scroll-jacking · no animation without a purpose (entrance, state change, feedback, orientation).

═══════════════════════════════════════════
9. MOTION BUDGET (L2 Responsive)
═══════════════════════════════════════════
ALLOWED: hover/focus/press feedback · fade/slide enter · list stagger · hover lift+glow · ONE restrained ambient accent per deck.
TIMING 150–300ms, cubic-bezier(0.16,1,0.3,1) · stagger children 0.04–0.06s, total entrance ≤ 0.4s · distance 4–12px, scale 0.96–1.0.
NEVER: multiple competing ambient layers · heavy particle systems · scroll scenes · fades > 400ms · decorative-only motion.
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}

═══════════════════════════════════════════
10. ANTI-SLOP (recognize → replace)
═══════════════════════════════════════════
| AI-slop signature | ❌ Never | ✅ Do instead |
| Purple gradient everywhere | background:linear-gradient(135deg,#8b5cf6,#6366f1) on hero/cards | Solid var(--accent); gradients rare, ≤3 stops, ≤45° |
| Glassmorphism overload | blur + rainbow borders on every element | Glass on cards ONLY, single 24px blur level |
| system-ui fonts | font-family:system-ui / browser defaults | var(--font-header) / var(--font-body) / var(--font-mono) |
| No hover states | static cards/buttons | Hover + focus + active on EVERY interactive element |
| Lorem ipsum | "Lorem ipsum", "Your text here", fake stats | Real data derived from the topic |
| Hero cliché | tiny uppercase pill + oversized centered headline + lone CTA | Asymmetric split with a visual anchor |
| Repeated kicker | tracked-uppercase label above EVERY heading | Vary: badge, inline stat, or no kicker |
| Fake controls | styled native <select> / <input type="range"> | Custom dropdown/slider patterns from §8 (native = validation error) |
| Emoji icons | 🚀📊✨ as UI icons | Inline SVG set from §6 |
| Same radius everywhere | one radius on all elements | cards 24 / buttons 12 / badges 8 |
| transition:all | transition:all .3s | Name properties: transform, opacity, border-color |
| Opacity text hierarchy | opacity:.5 on body text | Use var(--muted) token |
VERIFY THIS TABLE AGAINST EVERY SLIDE BEFORE EMITTING.

═══════════════════════════════════════════
11. SLIDE STRUCTURE PATTERNS
═══════════════════════════════════════════
HOOK — bold claim + subtle motion:
<section class="slide hook"><div class="hook-inner"><span class="badge stagger stagger-1">overline</span><h1 class="display gradient-text stagger stagger-2">Bold claim</h1><p class="sub stagger stagger-3">One supporting line</p></div></section>
.hook-inner{max-width:820px;display:flex;flex-direction:column;gap:24px;align-items:flex-start;padding:80px}.display{font:800 56px/1.05 var(--font-header);letter-spacing:-0.04em}.sub{font:600 24px var(--font-body);color:var(--muted)}
Left-aligned, not centered. ONE ambient effect (gradient shift OR glow — never both).
VALUE — split 1.5fr 1fr, copy + integrated widget:
<section class="slide value"><div class="split"><div class="copy"><h2>…</h2><p>…</p><ul class="points"><li>…</li></ul></div><div class="viz glass-card">[primitive from §7]</div></div></section>
.split{display:grid;grid-template-columns:1.5fr 1fr;gap:40px;align-items:center;padding:64px;height:100%;box-sizing:border-box}
Alternate 1.5fr 1fr ↔ 1fr 1.5fr between consecutive value slides.
VISUAL-ONLY — full-bleed widget + minimal overlay:
<section class="slide viz-only"><div class="viz-full">[diagram/chart/demo]</div><div class="overlay-cap glass-card"><h2>…</h2></div></section>
.viz-full{position:absolute;inset:0;padding:48px}.overlay-cap{position:absolute;left:48px;bottom:48px;max-width:420px;padding:20px 24px}
CALL TO ACTION — takeaway + action + recap:
<section class="slide cta"><div class="cta-inner"><h2 class="display">Key takeaway</h2><div class="recap"><span class="badge">…</span>…</div><button class="btn btn-primary">Action <svg class="icon">ArrowRight</svg></button></div></section>
Recap chips summarize the deck's 3 core points. Button min 44px target.
TRANSITION — muted bridge:
<section class="slide trans"><p class="trans-text">One phrase</p></section>
.trans{display:grid;place-items:center}.trans-text{font:500 24px var(--font-header);color:var(--muted)} One small visual bridge (thin rule, single icon) max.

═══════════════════════════════════════════
12. ACCESSIBILITY (contract)
═══════════════════════════════════════════
- Semantic HTML: <section aria-label="Slide N: purpose"> per slide; heading hierarchy h1→h2→h3, no skipped levels.
- Contrast: body text ≥ 4.5:1, large text & UI components ≥ 3:1 against their backgrounds. Never convey meaning by color alone — pair with icon/text/shape.
- Keyboard: every interactive element focusable (native or tabindex="0"); Enter/Space activates; Arrow keys drive tabs/slider; Escape closes dropdown. Nothing is mouse-only. Targets ≥ 44×44px.
- ARIA: icon-only buttons get aria-label; tabs use role="tablist"/"tab"/"tabpanel" + aria-selected; dropdown per §8; tickers and step captions live in aria-live="polite" regions.
- :focus-visible rings on ALL controls per §8 focus spec.
- prefers-reduced-motion suppression per §9.

═══════════════════════════════════════════
13. EXPORT QUALITY (contract)
═══════════════════════════════════════════
- Fixed canvas: body exactly 1080×960, no scrolling, <meta name="viewport" content="width=1080">.
- Retina-crisp: SVG for ALL graphics (no raster images, no canvas unless a demo requires it).
- Color accuracy: use EXACT hex values from the theme tokens. Never color-mix() or approximations.
- Font loading: Google Fonts <link> with display=swap; gate entrance animations on fonts: document.fonts.ready.then(init) so exports never capture mid-FOUT.
- Zero external dependencies beyond Google Fonts. No React, no CDN libraries, no external scripts.

═══════════════════════════════════════════
14. OUTPUT FORMAT
═══════════════════════════════════════════
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1080">
<title>…</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>/* reset · :root theme vars · tokens · slide shell · components · primitives · micro-interactions · reduced-motion */</style>
</head>
<body>
<!-- one <section class="slide" data-index="i" aria-label="Slide i+1: …"> per plan entry, each child carrying stagger classes -->
<nav class="slide-nav" aria-label="Slide navigation">
  <button class="nav-btn" id="prev" aria-label="Previous slide">←</button>
  <span class="slide-counter" aria-live="polite"><span id="current">1</span> / {{SLIDE_COUNT}}</span>
  <button class="nav-btn" id="next" aria-label="Next slide">→</button>
</nav>
<script>/* nav + all interactions */</script>
</body>
</html>

SLIDE SHELL: .slide{position:absolute;inset:0;opacity:0;pointer-events:none;transform:translateX(24px);transition:opacity .4s cubic-bezier(.16,1,.3,1),transform .4s cubic-bezier(.16,1,.3,1)} .slide.active{opacity:1;pointer-events:auto;z-index:1;transform:none}
NAV: .slide-nav{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;z-index:10}.nav-btn{width:44px;height:44px;border-radius:12px;background:var(--surface);border:1px solid var(--border);color:var(--fg);cursor:pointer} (+ hover/focus states)
JS REQUIREMENTS: show(i) toggles .active, updates counter, RESTARTS stagger animations and runs tickers/rings/bars of the newly active slide only. ArrowLeft/ArrowRight + buttons. Guard bounds (no wrap-around). Wrap init in document.fonts.ready.

FINAL SELF-CHECK BEFORE EMITTING (mirror of the validator):
[ ] <!DOCTYPE html>, <html>, <head>, <body>, one <style>, one <script> present
[ ] body 1080×960, overflow:hidden, no scrolling anywhere
[ ] All 11 theme CSS vars on :root (incl. --accent-2, --warning, --font-header/body/mono)
[ ] blurInUp, .glow, gradient-text/gradShift, cubic-bezier(0.16,…) all present
[ ] NO native <select>, NO <input type="range">, no emoji icons, no lorem ipsum
[ ] No external scripts/styles beyond fonts.googleapis.com / fonts.gstatic.com
[ ] Anti-slop table (§10) verified for every slide

Output ONLY the raw HTML file. No markdown fences. No explanation. No commentary.
```

---

## 4. Validation Checklist

| # | Check | Result | Evidence in rewritten prompt |
|---|-------|:---:|------------------------------|
| 1 | HTML/CSS/JS examples for visual primitives | ✅ PASS | §7 — all 12 primitives with markup, CSS, and JS hooks + use/avoid guidance |
| 2 | CSS code for micro-interactions | ✅ PASS | §8 — all 7 mandatory effects with full CSS/JS + hover/click/enter/focus effect library |
| 3 | SVG/icon code for common icons | ✅ PASS | §6 — 15 Lucide icons as inline SVG path data + shared `.icon` class |
| 4 | Complete theme token sets | ✅ PASS | §3 — 4 presets × 12 tokens each, token→CSS-var mapping, swap-don't-rewrite rule |
| 5 | Slide structure patterns with HTML templates | ✅ PASS | §11 — hook, value, visual-only, CTA, transition templates with layout CSS |
| 6 | Accessibility with specific standards | ✅ PASS | §12 — 4.5:1/3:1 contrast, keyboard nav, per-control ARIA, heading hierarchy, reduced-motion |
| 7 | Export quality requirements | ✅ PASS | §13 — fixed 1080×960, SVG-only (2× crisp), exact hex, `document.fonts.ready` gating |
| 8 | Anti-slop with specific examples | ✅ PASS | §10 — 12-row anti-pattern → replacement table with literal CSS on both sides |
| 9 | Content processing instructions | ✅ PASS | §2 — extract/chunk rules, concept→primitive map, headline formula |
| 10 | Under 8000 tokens | ✅ PASS | ≈ 6,100 tokens (~24.5K chars) — ~24% headroom under budget |

**Result: 10 / 10 checks pass.**

---

## 5. Token Budget

| Section | Est. tokens |
|---|---:|
| Role, output rules, input (§1) | 350 |
| Content processing (§2) | 300 |
| Theme system (§3) | 650 |
| Design tokens + spatial (§4–5) | 500 |
| Components + icons (§6) | 1,150 |
| 12 visual primitives (§7) | 1,200 |
| Micro-interactions (§8) | 950 |
| Motion budget + anti-slop (§9–10) | 650 |
| Slide patterns + a11y + export (§11–13) | 850 |
| Output format + self-check (§14) | 450 |
| **Total** | **≈ 6,100 / 8,000** |

---

## 6. Implementation Notes

1. **Drop-in replacement:** the rewrite keeps `{{CONTENT}}`, `{{SLIDE_COUNT}}`, `{{MODE}}` slots, so `compilePrompt()` works unchanged.
2. **`buildSlidePrompt()` compatibility:** injected theme JSON still takes precedence (§3: "A theme object may be injected per call… If no theme is provided, use Vercel Dark") — but the prompt no longer *depends* on the injection.
3. **Validator alignment:** the §14 final self-check mirrors the 7-layer contract in `slideValidator.ts` (structure, layout, theme vars, micro-interaction markers, no native `<select>`/range, font-only external sources).
4. **One open decision:** `CONTEXT_BUNDLE.md §1` still describes the legacy per-slide-fenced output. If any pipeline stage still parses ```html fences per slide, update it to expect the single-file format before shipping this prompt.
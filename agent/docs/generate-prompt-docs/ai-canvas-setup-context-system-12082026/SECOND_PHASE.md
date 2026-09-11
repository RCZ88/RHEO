Yes — I've cross-read the generated v2 spec against our v1 spec. The v2 document is **architecturally correct but stack-heavy**. It was written for a team with a TypeScript/Remotion/Node pipeline. Our system is Python-first, zero-cost, local, human-in-the-loop. So the plan below keeps v2's *contracts and grammar* (the valuable, renderer-neutral parts) and swaps out its *default stack* for cheap local equivalents.

---

# CLEMENT OVERLAY ENGINE — v2 ADAPTATION PLAN

## 0. The Core Adaptation Principle

v2's own best idea is the **planning/rendering plane split**:

- AI emits structured JSON only (ShotPlan → SceneGraph → AnimationTimeline)
- Deterministic code owns pixels, keyframes, fonts, safe zones, encoding

That split is renderer-neutral. v2 *chose* Remotion/React/resvg as renderers. We will **keep the grammar, change the renderers**:

| v2 default | Our adjustment | Why |
|---|---|---|
| Remotion (Node+Chromium) primary motion renderer | **Python keyframe evaluator + PIL/cairosvg frame renderer**, FFmpeg encode | Zero-cost, no Node toolchain required; matches v1 philosophy |
| HarfBuzz/Pango text shaping | **PIL with resolved-line contract** (v2 §8.5 already stores final lines in the graph) | The resolved-lines contract makes per-line shaping unnecessary for Latin bold fonts; add libraqm later only if we need complex scripts |
| KaTeX (Node) for equations | **Equation AST → mono/bold text renderer** with term-by-term reveal | KaTeX needs Node; AST renderer is local and animatable |
| Cassowary/kiwisolver constraint layout | **stack / columns / absolute strategies only** (v2 §6.9) | 90% of templates need only these; constraint solver deferred |
| SQLite worker queue | **Sequential pipeline + SHA256 cache**; SQLite only for project state/approvals | Single-user local tool doesn't need workers |
| pnpm/React monorepo, desktop app | **Single Python repo**, optional `web/` preview folder later | Protects v1's "1 day per phase" cadence |
| Browser preview via Remotion | **HTML+SVG+CSS preview generated from the same timeline** (CSS `cubic-bezier()` natively evaluates our easing values) | Free, no build step, same grammar |

Everything else — schemas, scoring formulas, easing registry, presets, safe-zone modes, caching rules, FFmpeg recipes, export honesty about CapCut — we adopt nearly verbatim.

---

## 1. DECISION MATRIX

### ✅ ADOPT AS-IS (high value, near-zero cost)

| Item | Source |
|---|---|
| Planning/rendering split; "AI never renders frames" | v2 §1.3–1.5 |
| Data contracts: `TranscriptInput`, `ShotPlan`, `SceneGraph`, `AnimationTimeline`, `TemplateDefinition`, `StyleProfile`, `RenderManifest`, `ExportBundle` | v2 §2 |
| Rule trigger table + regex set + candidate scoring `0.25/0.20/0.20/0.15/0.10/0.10` | v2 §3.2 |
| Dedup (60% overlap + Jaccard ≥0.7), merge (gap ≤0.35s), cooldowns (1 major/3s, 1 hook/10s, 2 keywords/8s, occupancy ≤65%) | v2 §3.2 |
| LLM extraction prompt, grounding rules, 1 repair pass, rule fallback; confidence `0.35/0.35/0.20/0.10`, thresholds `<0.55 reject / 0.55–0.69 approve / ≥0.70 auto` | v2 §3.3 |
| Template catalog (20 templates) with limits + fallback chains | v2 §4 |
| Animation grammar: property tracks, keyframes, 8 named beziers, preset registry, springs compiled to samples | v2 §7 |
| Sequential hook text ("MATH / IS / BORING." — solve final layout *before* generating motion) | v2 §7.7 |
| Timing phases (enter/establish/explain/hold/exit) + reading-time formula (190 wpm + punctuation pauses) | v2 §7.10 |
| Overflow recovery order + deterministic shortening table (protected terms list) | v2 §6.11 |
| Safe-zone modes (`forbidden/discouraged/reserved/preferred`) + placement cost function | v2 §6.7 |
| Z-index bands (0–9 video … 80–89 captions …) | v2 §5.4 |
| Frame math: half-open intervals, `startFrame = round(start*fps)` | v2 §10.4 |
| Static-scene optimization (1 PNG for trackless scenes) | v2 §10.5 |
| Canonical-JSON SHA256 cache key | v2 §10.6 |
| FFmpeg recipes: alpha overlay composite, VP9 alpha WebM, ProRes (optional) | v2 §10.9 |
| Canonical timeline in **microseconds**; manifest v2 format | v2 §11 |
| CapCut honesty: alpha clips + PNG cards + SRT + instructions; experimental draft adapter isolated behind a versioned plugin | v2 §11.3 |
| Cost-control rules (rules before LLM, transcript windows, cache, low-res preview first) | v2 §1.8 |

### 🔧 ADAPT (keep the idea, change the implementation)

| v2 idea | Our implementation |
|---|---|
| Renderer interface + layer renderer registry | Same interface, **Python registry**: `LAYER_RENDERERS: dict[LayerType, Callable]`. Vector layers → SVG string → **cairosvg** raster; text/panel layers → **PIL** with resolved lines; composite in PIL |
| Template plugin interface (`validateProps / buildSceneGraph / buildAnimation`) | Same three methods as Python ABCs; `definition.json` stays shared so a future TS preview can consume identical definitions |
| Template capability scoring `0.30/0.20/0.15/0.15/0.10/0.05/0.05` + repetition penalty `0/0.15/0.30/0.55` + deterministic tie-break | Adopt, but Phase 1.5 starts with intent→template map + capacity check; scoring switches on in Phase 3.0 |
| Typography scale | **Dual-mode profile** (see §2 reconciliation) |
| Browser preview | Emit `preview.html` = SVG layers + CSS animations using the same bezier values; no bundler |
| SQLite render workers | SQLite for **project state only** (shots, approvals, revisions, cache index); rendering sequential |
| Equation rendering | Equation AST (v2 §8.6) rendered as styled mono text lines; term groups = reveal units |
| Graph rendering | `graph_spec` (v2 §8.7) → SVG via our own tiny plot builder (axes/grid/points/path with `dataToPlot`), drawn with `line_draw` preset |

### ⏸ DEFER (right idea, wrong phase)

- Remotion / React editor (revisit only if the browser preview proves insufficient — Phase 3.5+)
- MediaPipe/OpenCV face-aware placement (manual face boxes accepted now via `safe_zones` input; auto-detection later)
- FCPXML exporter (v2 itself rates EDL low-value; FCPXML after CapCut package works)
- ProRes 4444 (recipe stored, not built; **VP9 alpha WebM is our alpha master**)
- KaTeX, constraint solvers, spring physics beyond the two compiled presets
- Optional image-gen / web-search hooks (off by default; zero-cost principle)

### ❌ REJECT (protects our philosophy)

- Cloud APIs, paid services, mandatory Node toolchain, Docker requirement, HDR, desktop app, pnpm monorepo.

---

## 2. CONFLICT RECONCILIATION (v1 vs v2 constants)

Both specs must coexist: **v1 "card mode" stays backward compatible; v2 "scene mode" is the new path.** v2 §11.2 already mandates exporting both cropped cards and full-canvas metadata during transition — we use that as the bridge.

| Constant | v1 | v2 | Our ruling |
|---|---|---|---|
| Output unit | 1080×400 card PNG | Full 1080×1920 scene | Profile YAML gains `modes: card / scene`; CLI flag `--mode` |
| Hook type | Anton 64, ≤8ch/line, 2 lines | Anton 96 (min 68) | card=64, scene=96 |
| Body type | LeagueSpartan 48 | 58 (min 42) | card=48, scene=58 |
| Caption | Montserrat 40 | 46 (min 38) | card=40, scene=46 |
| Keyword | Montserrat 44 cyan | 60 (min 44) | card=44, scene=60 |
| Mono | — | JetBrains Mono 34 | **Add** (new, both modes, terminal/code templates) |
| Text safe zone | x 40–1040, y 40–1320 | {40,40,1000,1280} | Identical → adopt v2 object form |
| Face cam | x≥760, y≥1520 | {760,1120,320,400} | scene mode uses v2 (taller, safer); card mode unaffected (cards live in upper region) |
| New zones | — | captions {80,1420,920,300}; platform_ui_right {930,250,150,1370} **forbidden** | Adopt both, scene mode |
| Stroke | 3px black, 8-direction loop | text_outline 3 | Same algorithm, keep v1's offset-loop (it's correct) |
| Time units | float seconds | int microseconds | Ingest accepts seconds; **internal + export = µs** |
| Colors | 7 tokens | + surfaces, muted, positive/negative/info, warning/error | Adopt superset; v1 keys map 1:1 |
| Timeline JSON | seconds, `animation.in/out` | µs, tracks/items | Exporter emits **both shapes** during transition |

Profile YAML becomes:

```yaml
id: clement_dark_tech_v2
modes:
  card:   # legacy v1 — unchanged outputs, golden-tested
    hook: {family: Anton-Bold.ttf, size: 64, max_chars_per_line: 8, max_lines: 2}
    # ... body/caption/keyword as v1
  scene:  # v2 tokens
    hook: {family: Anton, size: 96, min_size: 68, line_height: 0.94}
    # ... chapter/body/caption/keyword/mono as v2
safe_zones: [ ...v2 four zones with modes/weights... ]
```

---

## 3. TARGET ARCHITECTURE (our system)

```
transcript (json/srt/vtt)
        │  clement ingest
        ▼
TranscriptInput (Pydantic, µs-normalized, seg_#### ids)
        │  clement extract  (rules → optional Ollama, 1 repair pass)
        ▼
ShotPlan (scored, deduped, cooldown-applied, approval-gated)
        │  clement plan  (template match → props → SceneGraph → layout solve → AnimationTimeline)
        ▼
build/  (immutable artifacts per stage — v2 §10.2)
        │  clement render  (Python frame evaluator; static-scene shortcut)
        ▼
dist/   (PNG cards / PNG sequences / alpha WebM / composite MP4)
        │  clement export  (timeline.json µs + cards.json + manifest.md + capcut/ package)
        ▼
human drags & drops (v1 workflow intact)
```

### Merged file tree (extends v1, absorbs v2)

```
clement-overlay-engine/
 ├── main.py                      # CLI: ingest/extract/plan/validate/render/composite/export/preview
 ├── requirements.txt             # Pillow, PyYAML, cairosvg, pydantic, (requests optional)
 ├── config/
 │   ├── profiles/clement_dark_tech_v2.yaml     # dual-mode tokens + safe zones
 │   └── fonts/  (+ JetBrainsMono-Bold.ttf)
 ├── clement/
 │   ├── contracts/               # Pydantic ports of v2 §2 (ADOPT verbatim)
 │   │   ├── common.py  transcript.py  shotplan.py  scenegraph.py
 │   │   ├── timeline.py  template.py  style.py  manifest.py
 │   ├── ingestion/parser.py
 │   ├── extraction/
 │   │   ├── rules_v2.py          # trigger table, regex, scoring, dedup, merge, cooldown
 │   │   └── llm.py               # v2 prompt + validation + repair + fallback
 │   ├── planning/
 │   │   ├── template_match.py    # intent map → capability scoring
 │   │   └── shot_to_scene.py
 │   ├── layout/
 │   │   ├── measure.py  wrap.py  sizing.py  placement.py  safezone.py  shorten.py
 │   ├── animation/
 │   │   ├── bezier.py            # Newton-Raphson + bisection (v2 §7.4)
 │   │   ├── evaluator.py         # evaluateTrack at exact frame times
 │   │   ├── presets/             # fade_in, slide_up, pop, line_draw, word_stagger, ...
 │   │   └── hook_sequence.py     # §7.7 sequential hook text
 │   ├── render/
 │   │   ├── static_pil.py        # v1 card_generator, refactored to StyleProfile
 │   │   ├── frame_renderer.py    # layer registry: PIL text + cairosvg vectors
 │   │   ├── sequence.py          # PNG-seq + static optimization + half-open frames
 │   │   └── ffmpeg.py            # composite/alpha recipes (v2 §10.9)
 │   ├── registry/
 │   │   ├── templates/           # one dir per template: definition.json + planner.py + scene.py + anim.py
 │   │   │   ├── hook_card/  body_card/  caption_label/  bullet_list/  keyword_pop/   # Phase 1
 │   │   │   ├── comparison_panel/  definition_card/  chapter_title/                 # Phase 2.5
 │   │   │   └── graph_animation/  equation_card/  screenshot_frame/  recording_slot/# Phase 3
 │   │   └── registry.py          # TemplateRegistry port (v2 §9.2)
 │   ├── exporters/
 │   │   ├── cards_v1.py  timeline_v1.py        # legacy, untouched
 │   │   ├── timeline_v2.py  manifest_v2.py  capcut_package.py  srt.py
 │   ├── validators/qa.py         # schema/timing/forbidden-zone/contrast/determinism
 │   └── db/state.py              # SQLite: shots, approvals, revisions, cache index
 ├── tests/
 │   ├── golden_cards/            # v1 outputs must byte-match
 │   ├── test_rules_v2.py  test_evaluator.py  test_determinism.py
 └── fixtures/svm_ep2.json
```

---

## 4. PHASED INTEGRATION ROADMAP

Every phase ships backward compatible (v1 cards keep working, per v1 §10).

### Phase 1.0 — Contracts & profile freeze (2 days)
- Port v2 §2 contracts to Pydantic; µs timebase; id regex `^[a-z][a-z0-9_-]{1,63}$`.
- Dual-mode profile YAML + v1→v2 adapter.
- Refactor `card_generator` to be fully StyleProfile-driven (no literals).
- **Acceptance:** golden tests — v1 card PNGs byte-identical; `clement validate` passes on SVM fixture.

### Phase 1.5 — Extraction v2 (2 days)
- `rules_v2.py`: full trigger table, regex set, scoring, dedup/merge/cooldown, priority chain (`user-pinned > approved > hook > chapter > …`).
- `llm.py`: v2 system/user prompts verbatim, strict JSON, one repair pass, rule fallback, confidence gating.
- **Acceptance:** SVM fixture yields the 3 shots from v2 §3.4 (hook / comparison / graph) with confidence ≥0.9; invalid LLM JSON falls back cleanly.

### Phase 2.0 — Deterministic motion, Python-only (3 days)
- `bezier.py` + `evaluator.py` (frame-exact, no wall clock); easing registry (8 named curves); presets: `fade_in/out, slide_up, slide_left/right, pop, panel_enter/exit`.
- `sequence.py`: PNG-seq export, static-scene 1-PNG shortcut, frame hashing, half-open frame math.
- `ffmpeg.py`: composite MP4 (CRF 18, bt709 tags) + VP9 alpha WebM.
- **Acceptance:** same SceneGraph+Timeline → identical SHA256 frames across two runs; animated SVM hook renders at 30fps.

### Phase 2.5 — Text motion + 3 new templates (2 days)
- `word_stagger`, `character_stagger` using resolved-lines + per-word masks (v2 §7.8 — never reshape partial strings).
- `hook_sequence.py` (§7.7) — "MATH / IS / BORING." re-centering behavior.
- Templates: `comparison_panel`, `definition_card`, `chapter_title` (with v2 limits/fallbacks).
- **Acceptance:** sequential hook golden-frame test; comparison panel left-then-right 0.18s gap.

### Phase 3.0 — Layout engine + registry scoring (3 days)
- `wrap.py` (rebalance cost: raggedness + orphan + term-split penalties), `sizing.py` (2px decrement to 72% floor, then shorten, then ellipsize), `placement.py` (obstacle order v2 §6.6), `safezone.py` (cost function, forbidden = reject), `shorten.py` (protected terms).
- Template capability scoring + repetition penalty + deterministic tie-break; template semver recorded per scene.
- `graph_animation` (graph_spec → SVG, `graph_build` preset), `equation_card` (AST), `screenshot_frame`, `screen_recording_slot` (placeholder editor-only, never exported).
- **Acceptance:** `safeZoneViolationCount == 0` mandatory; overflow recovery chain exercised by fuzzed long-text fixture.

### Phase 3.5 — Preview + human-in-the-loop (3 days)
- `clement preview` → `preview.html`: SVG layers + CSS `cubic-bezier(...)` from the same tracks; safe-zone overlay toggle; shot approve/reject/edit UI (server-side SQLite state, localhost-only binding `127.0.0.1`).
- **Acceptance:** a human can approve the ShotPlan and re-render one scene without invalidating others (v2 §10.7 dependency graph).

### Phase 4.0 — CapCut package + manifest v2 (2 days)
- `capcut/` package: source.mp4 ref, alpha WebM/MOV overlays, captions.srt, timeline.json (µs), `import_instructions.md`, isolated `experimental_draft/` adapter.
- Manifest v2 with asset status, template@version, provenance labels (`illustrative` graph data flagged).
- **Acceptance:** full SVM episode assembles in CapCut following instructions only.

**Total ≈ 17 days** to a system that does everything v2 promises at our cost ceiling, versus v2's implied multi-month monorepo.

---

## 5. KEY ENGINEERING ADJUSTMENTS (the "how" for the swapped stack)

1. **Renderer parity without Node.** v2 §8.5's resolved-lines contract is what makes PIL viable: line breaks are frozen in the SceneGraph, so preview/export can't drift. Vector layers emit SVG and rasterize through **one pinned cairosvg build**; pin + record its version in the cache key and `RenderManifest` (determinism rule from v2 §10.6).

2. **Animation evaluator is the single source of motion truth.** Preview HTML, PNG-seq renderer, and future Remotion (if ever) all consume the same `AnimationTimeline`. CSS gets raw bezier control points; Python gets `bezier.py`. Same numbers, two evaluators → visually identical motion.

3. **Alpha strategy.** Internal straight-alpha RGBA; ship **VP9 alpha WebM** as the editable overlay master; H.264 composites over source (no alpha in H.264 — v2 §8.10). Fringe test over white/black/red/source is a QA gate.

4. **Determinism gates in CI.** `test_determinism.py`: render twice, compare SHA256 per frame; compare `RenderManifest` hashes. Any nondeterministic dependency (font hinting, SVG rasterizer) gets pinned or quarantined.

5. **Approval gating preserved.** v1's "human-in-the-loop" maps directly onto v2's confidence bands: `<0.55` dropped, `0.55–0.69` requires approval in the preview UI, `≥0.70` auto-proposed. No auto-export to final video, ever.

---

## 6. RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| cairosvg/PIL pixel drift vs future TS preview | Resolved-lines + pinned rasterizer + hash gates; parity = layout/content identity, not pixel identity (v2 §8.3 allows this) |
| Scope creep from 20 templates | Registry ships 5 in Phase 1, 3 in 2.5, 4 in 3.0; the rest stay as `definition.json` stubs with fallbacks pointing at implemented templates |
| Font licensing/availability | Anton, League Spartan, Montserrat, JetBrains Mono are all OFL — bundle TTFs, record `file_sha256`; **stop production render on missing font** (v2 §8.5) |
| Ollama JSON instability | Strict parse → one repair pass → rule fallback; never clamp silently |
| CapCut format churn | Canonical timeline is source of truth; CapCut adapter versioned + isolated (v2 §11.3) |

---

## 7. FIRST 10 TASKS (start order)

1. `contracts/` Pydantic port of v2 §2 (all eight schemas + common defs).
2. `clement_dark_tech_v2.yaml` dual-mode profile + adapter; add JetBrains Mono.
3. Refactor `card_generator` → StyleProfile-driven; golden PNG tests green.
4. `validators/qa.py`: schema, `end>start`, min durations (0.7s overlay / 2.0s panel), forbidden-zone, contrast 4.5:1.
5. `rules_v2.py` with SVM fixture unit tests (must reproduce v2 §3.4 intents).
6. `llm.py` prompt + repair + fallback (Ollama only).
7. `bezier.py` + `evaluator.py` + easing registry; unit-test against known bezier values.
8. Presets `fade_in/out, slide_up, pop` + `sequence.py` with static-scene shortcut.
9. `ffmpeg.py` composite + VP9-alpha recipes as CLI `composite`.
10. CLI v2 subcommand wiring with immutable `build/` artifacts per stage.

---

## 8. WHAT WE EXPLICITLY DO NOT BUILD (yet)

Remotion, React editor, desktop app, Docker, KaTeX, constraint solvers, face auto-detection, FCPXML/EDL, ProRes, HDR, image-gen/web-search integrations, pnpm monorepo. Each has a designated re-entry point in the roadmap if a phase proves it necessary — none block the core pipeline.

---

**Bottom line:** the generated spec gives us the *language* (contracts, grammar, scoring, safe-zone math). We keep that language 100%, but speak it with a Python-first, zero-cost dialect. v1's drag-and-drop workflow survives untouched in card mode; scene mode is the upgrade path. If you want, next I can produce the Phase 1.0 implementation pack: the Pydantic contracts file, the dual-mode YAML, and the golden-test harness.
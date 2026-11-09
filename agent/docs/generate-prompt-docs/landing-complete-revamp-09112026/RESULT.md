# RESULT.md v3.0 — Landing Complete Revamp

## §0 State + defects found this round

Landed from v2.0: fused 153px panel + HUD + keyboard slider, ActRecord flow column @1000px, Dayfield band, tablist + crossfade (exact v2.0 values, verified in R2). Netlify live.

New defects, from R1–R6 evidence:

| # | Defect | Evidence |
|---|---|---|
| D1 | **Summary object untrusted** — `top_category_minutes: 3987` is impossible in a 1,440-min day; category histogram (515) contradicts `minutes_with_activity: 321` | R4 |
| D2 | Stale readout: `readout` survives mode switch (vault-hover string shows under Layers figure until pointerLeave) | R2 |
| D3 | `rm` prop received but unused in FigureInstrument — motion not gated | R2 |
| D4 | Auto `play` tour (4s on every mode change) is auto-advance-shaped | R2 |
| D5 | Radius token conflict: stage uses `borderRadius: 12`; packets disagree (6/10/16 vs 8/12/16) | R2 |
| D6 | BLOCKS fabrication confirmed and contradicted by real data: claims 840 structured minutes; real day has 321 active minutes, deep-work window 15 min | R3+R4 |
| D7 | Fill layer `scaleX(progress)` misaligns bright vs dim layers 1:1 (bright minute 720 renders over dim minute 360 at p=0.5) | current source |

**Data standing rule (consequence of D1):** until the exporter is fixed [ASSIGNED-CZ], every landing display derives client-side from `samples[]`. Summary fields are not rendered anywhere.

## §1 SampleDayTimeline — segment instrument

1. **Segments** (replaces 1,440 bars): derive consecutive same-`category` runs → `{start, end, category, meanIntensity}`. Render one `<rect>` per run: `x = start/1440 × W`, `width = (end−start) × W/1440`, `height = max(8, meanIntensity×100)` (clamped ≤100), `fill` bright `rgba(255,255,255, 0.25+brightness×0.5)` / dim `0.06+brightness×0.12`, **1px `#050506` gap at boundaries**. A 150-min block = ~104px at 1000px width; short switches stay as honest texture.
2. **Slide-reveal (fixes D7)**: bright segments static full-width (bottom); dim segments in `overflow:hidden; inset:0` wrapper with `transform: translateX(${p×100}%)` (top). Left of playhead bright, right dim, aligned 1:1, transform-only, keep 0.05s linear scrub-lag.
3. **Facts line (D1-safe)**: client-side histogram over `samples` → `IDE · 187 min · Browser 111 · AI Tools 99 · {logged}/1,440 min logged`, where logged = count of `category !== null` (definition stated in the line itself). No summary fields, no deep-work claim until exporter fixed.
4. Ruler 32→**20px** (ticks 6px, labels 9px `top:9`); panel 153→**141px**; playhead 1→**2px, opacity 0.9**; `:focus-visible { outline: 2px solid #f4f4f5; outline-offset: 3px }` in globals.
5. **Load animation**: segments `scaleY(0→1)`, origin bottom, 400ms house easing, 20ms left→right stagger, cap 600ms; prm → instant. **Hover preview**: pointermove over canvas updates HUD without committing playhead; click/drag commits (existing interactions preserved).
6. Provenance line: append `· derived from the same file` — segments are code-derived, say so.

## §2 Download FigureInstrument — narrative via synthetic pointer events (Path B)

1. **Dispatch utility** (new, ~40 lines): `sweep(el, points, {duration})` — RAF loop at ~16ms, `el.dispatchEvent(new PointerEvent("pointermove", { clientX, clientY, bubbles: true, pointerId: 1, pointerType: "mouse", isPrimary: true }))`, viewport coords from `getBoundingClientRect()` + relative point. [VERIFY-4a: no `isTrusted` guard in minified source.]
2. **VAULT→LAYERS narrative** on tab click: (a) sweep 24 points on an arc around dial center ending at the 40° coordinate, 400ms → internal `setOpen(true)` fires, bolts draw back (the real opening); (b) hold 200ms; (c) existing crossfade (keep landed values: exit `y:−8` 320ms / enter `y:12→0` 400ms delay 120ms); (d) on Exploded mount, sweep pointer left→right across stage, 640ms → `GAP4 0.18→1.0` separates (the real explosion); (e) readout holds transition sentence `the vault opens onto the stack` through beats (a)–(d), then mode default. **LAYERS→VAULT**: sweep to left edge (gap closes) → crossfade → dial sweep re-opens. [VERIFY-4b: dial center/radius in stage coords — read from minified source or devtools-measure; VERIFY-4c: vault-close behavior on pointerleave.]
3. **`run the tour` button** replaces auto-`play` (removes D4): 11px mono pill, `#8a8a94`, radius per token, under the hint line; onClick runs the current mode's sequence; `disabled` while running. User-initiated only.
4. **Fixes**: `setReadout(null)` in the mode-change effect (D2); gate all FigureInstrument motion on `rm` — no synthetic beats, no AnimatePresence transitions, no facts stagger; instant swap (D3); hint line + `onRead` unaffected (text). Stage `borderRadius: 12` → token value from globals.css (D5).
5. **Spring disclosure for the review record**: figure-internal physics triggered through its genuine input channel is the library's behavior, not our authored motion. Everything we author (crossfade, stagger, tabs, sweep timing) stays house easing. No framer springs in our code.

## §3 ActRecord — derivation replaces fabrication (D6)

1. **BLOCKS → derived cards**, four slots, all numbers computed from `samples[]`:
   - `TOP CATEGORY` — IDE, 187 min, real range where its minutes concentrate;
   - `SECOND` — Browser, 111 min, real range;
   - `THIRD` — AI Tools, 99 min, real range;
   - `QUIET` — longest consecutive `category === null` run, real range + minutes.
   Blurb templates interpolate derived values only. Phase/scrub text binds to the same derived set. The day's story becomes true: ~321 active minutes, 15-min deep-work burst — humbler, honest, still compelling.
2. **LINE_PATH → derived**: hourly mean intensity (24 real values) → smooth path generated in code (~30 lines, no dependency); `AREA_PATH` = same path closed to baseline. Caption: `intensity curve — hourly means of the same 1,440 samples`.
3. **Rail**: bind ticks to the four derived ranges [or remove — CONFIRM CZ].
4. [ASSIGNED-CZ] `export-sample-day.py`: summary is internally inconsistent (3987 > 1440; 515 ≠ 321). Until re-exported, §1.3 and §3.1 stand independent of it.

## §4 Feedback — GitHub Issues via issue-form links; landing stays zero-request

1. **`/feedback` route** + `FeedbackForm.tsx`: category pill group (Feedback / Bug / Feature Request / Other — tab-styled, roving tabindex, same contract as everything else), title input, body textarea, Bug-only optional OS + version. Draft autosave to `localStorage` (`try/catch`, debounced 500ms) + `copy as markdown` button. **localStorage is never the system of record.**
2. **Submit = link build, not a request**: `https://github.com/{owner}/{repo}/issues/new?template={cat}.yml&labels=landing&title=…&body=…` — body carries structured text (category, page, OS/version, user text). Page makes **zero network requests**; submission happens on github.com. Honesty line on the page: `nothing is sent until you submit on github.com`.
3. Repo-side: `.github/ISSUE_TEMPLATE/{feedback,bug,feature-request}.yml` — official issue-forms mechanism; field prefill by query param + field `id` per GitHub's current behavior [VERIFY-2 — fallback built in: plain `.md` templates, which reliably accept `?title=&body=`]. Repo change, needs CZ approval (scope says landing-only).
4. **R5 correction propagated**: no app-side GitHub integration exists; the Report skill targets opencode issues. This page is landing-side intake to the RHEO repo. The app's `bug_reports` table is untouched (OUT of scope). The Download `mailto:` stays for private reports; add a `feedback →` nav link beside it.
5. AI-agent access = GitHub Issues natively (`gh`/API) — the requirement is satisfied by the system of record, not by landing-side storage.

## §5 Rhythm — inventory first, then the rule

[ASSIGNED-Hands, 30 min] For all 5 sections, record computed `paddingTop/Bottom` + wrapper margins (Gallery and ActUnderstand still unmeasured [VERIFY-3]). Then apply one rule set: uniform `pt-24 sm:pt-32` (Hero `pt-0` as page start; ActRecord `pt-12 pb-12` as the scrub exception), uniform header block (kicker 11 → h2 `mt-4` → intro `mt-4`, `max-w-760`), inter-section spacing = section padding only. The recent pt-20→pt-12 flip-flop is the symptom; the inventory + rule is the cure. ActRecord's 300vh stays the single intentional rhythm break.

## §6 Implementation order

1. SampleDayTimeline segments + slide-reveal + facts (§1) — self-contained
2. FigureInstrument dispatch + narrative + tour button + D2/D3/D4/D5 fixes (§2)
3. ActRecord derivations (§3)
4. Feedback page + form + templates + nav (§4)
5. globals.css (focus ring, radius token resolution)
6. Rhythm pass after inventory (§5)

Each green before the next; frame-sampler re-baseline for #act-record/#download accepted knowingly per v2.0 sequencing note.

## §7 Audit

- [VERIFY-1] globals.css radius token set (6/10/16 vs 8/12/16) — one read.
- [VERIFY-2] YAML form field prefill params; fallback = `.md` templates (spec already dual-path).
- [VERIFY-3] Gallery/ActUnderstand paddings (inventory output).
- [VERIFY-4] (a) no `isTrusted` guard; (b) dial center/radius in stage coords; (c) vault-close behavior.
- [ASSIGNED-CZ] exporter summary fix + re-export; `.github/ISSUE_TEMPLATE` approval; carryover: profiler/studio seeded re-shots.
- Standing rule: summary object untrusted; all displays derive from `samples[]`.

## §8 Testing obligations

Canaries: segments (count === computed runs), facts line (contains `IDE` and `187` — recomputed histogram), derived cards (probe re-derives and compares rendered strings — no hand-typed numbers survive), readout resets on mode change, tour button disabled-while-running. Discriminating negatives: remove sweep → vault-open probe fails (bolts transform unchanged); remove readout reset → stale-string probe fails; break histogram → facts probe fails. Dual-mode: load stagger + narrative beats sampled in `(off, no-preference)`; rm path asserts instant swap. Feedback: link-builder pure-function tests (encoding, template mapping); zero-request probe on `/feedback` (no fetch/XHR until navigation).

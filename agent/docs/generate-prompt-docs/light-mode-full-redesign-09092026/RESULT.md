Calibration (per §11.2): App-queue frontier = **LINUX-TRACKING P0** (executor runs L-2 audit first). Landing-queue frontier = **POLISH-2 audit** (status unknown) → Atlas **C1 commit-blocked** on principal's letters. Principal-owned: ①Atlas S/B ruling ②GOLD-3D vs GO-2–7 ordering ③Ferrofluid R-5 blur lever ④release platforms. Hot files: `preload.ts`, `main.ts`, `GoldPage.tsx` (extended: `SettingsPage.tsx`, `App.tsx`). Ruling numbering resumes at **R-12**.

---

# TASK INTAKE: LIGHT-MODE FULL REDESIGN

**Package verdict:** Direction is principal-owned and already given ("tailored for light, not a toggle", "START FROM THE DASHBOARD") — no re-ask. But the design prompt, taken literally, **violates the constitution in five places**. Per IDE-EVAL precedent, Layer-0 constitutional audit runs first, then the conformant spec, then the executor prompt. Bundle distrust applies in full: it references tokens (`--color-card`, `--text-primary`, `--page-accent`, `--color-primary`) that the dumped `@theme` excerpt **does not define** — exactly the §2/§10 fabricated-token rock. Census is blocking.

## RULINGS

| # | Subject | Ruling | Basis |
|---|---|---|---|
| **R-12** | Sanction, scope, architecture | Light mode is sanctioned, app-only (landing/ untouched). Architecture is **purely additive**: primary mechanism = `html.light { }` token-override block appended last in `index.css` (dark defaults in `@theme`/`:root` untouched); secondary = `light:` utility classes appended to existing class strings. **Dark pixel-parity is a hard gate** — any edit that changes dark rendering at all fails. Dashboard-first per principal. | Constraint 1; §3-8 three-truths; principal directive |
| **R-13** | Elevation | The prompt's "light mode relies more on shadows" is **OVERRIDDEN**. LAMINAR holds in light: hairlines are the only elevation mechanism. Elevation = lightness step + hairline darkness step. Zero `box-shadow` added. Focus = `outline` (2px accent, 2px offset), never ring-shadow. Scrim (`rgb(28 25 23 / 0.32)`) permitted for overlays — scrim ≠ shadow. | §2 hairlines-not-shadows |
| **R-14** | Glass legacy | Existing `backdrop-blur` surfaces are sanctioned debt and are **NOT removed this wave** (removal would alter dark → R-12 parity). Their light treatment = **solidify**: `light:bg-white/85` + hairline, blur value unchanged. **Zero new glass.** Purge remains M-1's. | §2 glass ban; R-12 parity wins over in-file conformance |
| **R-15** | Deferred-to-M-1 set | LIGHT waves change **zero** radii (bundle's `rounded-xl/lg` stay; {6,10,16} ramp conformance = M-1 debt, recorded), **zero** font families/sizes (5-token font set incl. `--font-caslon`/`--font-display` is M-1 scope; weight changes only if G-LM-6 proves AA failure), **zero** dark→token refactors of hardcoded values (e.g., MomentumHero's `rgba(24,24,27,0.60)` stays in dark), `pageEnter` easing untouched. LIGHT is additive-only. | §2 fonts/radii; §3-8 one-commit hygiene; R-12 |
| **R-16** | Color system | All light values defined in exactly two homes: `index.css` (chrome/status/chromatic tokens — table §A) and `CategoryColors.ts` (data palette LIGHT variants — table §C). `--color-glow` and `--resume-preview-*` unchanged (paper-native by design — the resume preview is RHEO's existing light-designed surface; it is the precedent this design extends). **Page-accent light remap** via transform rule (§C). Zero new hex outside the two sanctioned homes; `white`/`black` in alpha-utility form exempt as chrome. `--color-primary` pink-vs-amber conflict: **STEP-0 census arbitrates from code**, executor does not pick a side. | §2 CategoryColors law; §2 token-conflict law; §10 |
| **R-17** | "Per-element customization" | Translated into a **recipe matrix** (§B: S0–S4 + rail/wash/ink laws), not freestyle values. Every component maps to a recipe; per-element tailoring = which recipe + which accent rail + which data ink. Ad-hoc values banned. | §2 monochrome chrome; §0 anti-slop |
| **R-18** | Queue + claims | LIGHT waves are **file-disjoint from P0** → may run parallel with LINUX-TRACKING. Claims filed below. `WidgetGrid.tsx` is WS-1 territory → **serialization: LIGHT-3 completes before WS-1 touches it** (WS-1 is behind P0 regardless; recorded as ordering, not conflict). M-1 must carry the `html.light` block when it consolidates tokens — noted in M-1's staged spec. | §7 claims law; §6 |

**Principal override rows** (pre-staged defaults; override a row, not the whole):

| Row | Default | Pre-staged alternative |
|---|---|---|
| Paper temperature | Warm paper ramp (glow `#f7f3ee` lineage, stone-family ink) | Cool ramp: surface `#fafafa`, stone→zinc family |
| Light accent hue | Cyan darkened `#0e7490` (family continuity with `--ws-accent` dark) | Keep family per `--page-accent` instead (per-page, no global accent) |

No new §8 blockers created. Waves proceed on staged defaults.

---

# LIGHT MODE SPEC — `LIGHT_MODE_SPEC.md`

*(THE artifact. Executor commits this document to `agent/docs/light-mode-redesign-09092026/` in the LIGHT-1 commit.)*

## §A Token Design — `index.css` (Phase 1)

Placement law: append **after** the existing `@theme` block and after every `:root`/`.dark` definition (census orders it last), **outside** `@theme`. Tailwind 4 utilities reference the vars, so overrides flow through existing utility classes with zero class changes.

```css
/* ============ LIGHT MODE — R-12/R-16. Additive. Dark defaults above untouched. ============ */
html.light {
  /* Surfaces — warm paper ramp (glow lineage). Elevation = lightness + hairline, never shadow (R-13). */
  --ws-surface: #f5f2ec;            /* S0 page paper */
  --ws-surface-raised: #fcfbf8;     /* S1 card */
  --ws-surface-overlay: #ffffff;    /* S2 overlay: modals, popovers, elevated */
  --ws-surface-sunken: #edeae2;     /* S3 wells: inputs, tracks, skeletons */
  --ws-veil: rgb(28 25 23 / 0.04);  /* S4 hover veil */
  --ws-scrim: rgb(28 25 23 / 0.32); /* overlay scrim (permitted; scrim ≠ shadow) */

  /* Hairlines — the ONLY elevation mechanism (R-13) */
  --ws-border: rgb(28 25 23 / 0.08);
  --ws-border-strong: rgb(28 25 23 / 0.17);

  /* Accent — cyan family darkened for paper; text-capable */
  --ws-accent: #0e7490;
  --ws-accent-hover: #155e75;

  /* Text ramp — warm stone */
  --text-primary: #1c1917;
  --text-secondary: #44403c;
  --text-muted: #57534e;
  --text-faint: #82796f;            /* decorative only, exempt from AA */

  /* Component-facing aliases — NAMES confirmed/corrected by STEP-0 census before commit */
  --color-card: #fcfbf8;
  --color-card-raised: #ffffff;
  --color-card-sunken: #edeae2;
  --accent-primary: #0e7490;
  --accent-hover: #155e75;

  /* Status inks (dark-mode twins shifted darker) */
  --resume-success: #15803d;
  --resume-warning: #b45309;
  --resume-danger: #b91c1c;
  --resume-info: #1d4ed8;
  --resume-score-high: #15803d;
  --resume-score-mid: #a16207;
  --resume-score-low: #b91c1c;
  /* --resume-preview-* UNCHANGED — already paper-native */

  /* Chromatic app tokens — one lightness step down */
  --color-clay-300: #e8866b;
  --color-clay-400: #d96846;
  --color-clay-500: #b4472a;
  --color-clay-600: #93331d;
  --color-sage-400: #3f7d5f;
  --color-amber-400: #d97706;       /* fill; required ink pairing #451a03 */
  --color-sky-400: #2b7d99;
  /* --color-glow UNCHANGED (paper-native; splash/special) */

  /* Focus */
  --ws-focus: #0e7490;
}
html.light ::selection { background: rgb(14 116 144 / 0.18); }
html.light :focus-visible { outline: 2px solid var(--ws-focus); outline-offset: 2px; }
```

Rationale: warm paper (`#f5f2ec`, not `#ffffff`) so the app reads designed-for-light, extending the resume-preview precedent; stone (not zinc) ink family so chrome harmonizes with paper; single darkened cyan accent because dark's `#06b6d4` fails contrast on paper and reads garish; four-tier text ramp so hierarchy comes from the token system, not scattered grays. Fonts: unchanged (R-15). Spacing: unchanged — light gains air through whiteness steps, not padding changes (R-12 parity).

**New utilities needed: none.** Tokens + two global rules above are the entire foundation. New `light:` variants are added per-component per §D/§E.

## §B Per-Element Recipe Matrix (Phases 4, R-17)

| Recipe | Surface | Border | Use |
|---|---|---|---|
| **S0 page** | `--ws-surface` | none | page roots |
| **S1 card** | `--color-card` | hairline `--ws-border` 1px | default card, all dashboard cards |
| **S2 overlay** | `--ws-surface-overlay` | `--ws-border-strong` 1px | modals, popovers, `elevated` variant, AI summary modal |
| **S3 sunken** | `--ws-surface-sunken` | hairline 6% inner | inputs, wells, toggle tracks, skeleton, progress tracks |
| **S4 veil-hover** | S1/S2 + `--ws-veil` | border → `--ws-border-strong` | every interactive card/row hover |

**Rail law:** accent/category rails = 2px left border at full ink (light inks are dark enough); chips/washes ≤6% alpha; status bands ≤8% alpha. **Ink law:** chrome text = token text ramp; colored ink reserved for status/data/accent semantics; colored text ≥4.5:1 (G-LM-6 measures). **Border hierarchy:** hairline 8% = containment; hairline-strong 17% = interactive boundary + S2; both-together = never. Dark-vs-colored ink: dark stone ink is default; colored ink only where the color IS the information (status, category, accent action).

## §C Data + Page-Accent Light Maps (R-16)

**CategoryColors.ts** gains a LIGHT variant set (Tableau-10 lineage, seeded values below; **G-LM-6 is the arbiter** — pre-staged fallback: darken 8% per iteration until ≥3:1 on paper; report final values verbatim):

| Role | Light seed | | Role | Light seed |
|---|---|---|---|---|
| blue | `#4e79a7` | | yellow | `#a2820c` |
| orange | `#c05f10` | | purple | `#8d5a86` |
| red | `#c13538` | | pink | `#c9506a` |
| teal | `#3a8f89` | | brown | `#8a6448` |
| green | `#3d7a44` | | grey | `#7d7668` |

ENTITY_COLORS inherit the same LIGHT map (goal=orange, ltg=yellow, habit=green, deadline=red, schedule=teal, note=purple, todo=chrome→`--text-muted`). Dark map byte-identical to today (parity).

**Page-accent transform rule:** keep hue, L\*→45±2, C −15%. Seed map (apply to whatever the `[data-page]` census actually finds):

| dark | light | | dark | light |
|---|---|---|---|---|
| pink `#ec4899` | `#be185d` | | sky `#0ea5e9` | `#0369a1` |
| amber `#f59e0b` | `#b45309` | | rose `#f43f5e` | `#be123c` |
| emerald `#10b981` | `#047857` | | indigo `#6366f1` | `#4338ca` |
| cyan `#06b6d4` | `#0e7490` | | violet `#8b5cf6` | `#6d28d9` |
| orange `#f97316` | `#c2410c` | | teal `#14b8a6` | `#0f766e` |

## §D Shared Components (Phase 3)

| Component | Light spec (all via appended `light:` / tokens; dark untouched) |
|---|---|
| **GlassCard** | `default`: S1 + hairline → `light:bg-[var(--color-card)] light:border-[var(--ws-border)]`. `compact`: S1, `p-3` kept. `subtle`: `light:bg-[color-mix(in_srgb,var(--color-card)_60%,transparent)]`, hairline 6%. `notebook`: `light:border-l-2 light:border-l-stone-300`; accent rails keep existing `railLight` (verify 40% alpha reads on paper). `bordered`: `light:border-[var(--ws-border-strong)]`, transparent. `elevated`: S2 → `light:bg-[var(--ws-surface-overlay)] light:border-[var(--ws-border-strong)]` — **no shadow (R-13)**. `interactive`: `light:bg-white/70`, S4 on hover, translate kept, no scale. Accent configs: `bgLight` 4% washes verified. |
| **EmptyState** | Icon chip: `light:bg-white light:border-[var(--ws-border)]`, icon `--text-muted`. Title `--text-secondary`, desc `--text-faint`→`--text-muted`. Action button: `--ws-accent` fill + white text (replaces `var(--color-primary)` ref **only if census proves that token undefined**; else keep var — report verdict). Inviting = warm paper + white chip, not gray wash. |
| **LoadingState** | Spinner: track `light:border-stone-200`, head keeps `var(--page-accent)` (light-remapped via §C → AA-legal). Inline `#ec4899` fallback hex: **delete** (dead once census confirms `--page-accent` defined; zero-hex ride-along, dark-safe). Skeleton: `light:bg-stone-200/70`. `animate-pulse` = functional load state, sanctioned (not a decorative loop). |
| **SectionHeader** | Icon chip keeps page-accent system (§C remap makes 12–15% washes legal). Title `light:text-stone-900`. Action slot inherits. |
| **PageShell** | Zero class changes; paper arrives via tokens. `pageEnter` untouched (R-15). |
| **ErrorBoundary** | **Full light redesign** (dark byte-untouched): page S0 paper; panel S2 white + strong hairline, radius untouched; heading `--text-primary`, body `--text-secondary`, meta `--text-faint`; details/pre = S3 sunken, mono; primary button `--ws-accent` fill/white text; secondary `light:bg-white light:border-[var(--ws-border-strong)] light:text-stone-800`; tertiary `--text-faint`; error glyph `--resume-danger`. Replaces every `bg-[#0a0a0a]`/`bg-zinc-900`/`bg-zinc-800`/`text-zinc-*` via appended light tokens. |
| **ThemeToggle** | Existing light states polished: active-light chip `light:bg-amber-100 light:text-amber-700` verified vs §C amber ink; system chip violet → `light:bg-violet-50 light:text-violet-700`; dark chip gains `light:bg-stone-100 light:text-stone-600`. Sizes/motion unchanged. |

## §E Dashboard Wave (Phase 2 — first priority, principal's words)

| Component | Light spec |
|---|---|
| **DashboardPage root** | S0 paper via tokens; layout/spacing byte-unchanged. |
| **HeroBand** | S1 card + hairline; greeting `--text-primary`; metrics tabular-nums **only if already tabular in dark** (parity); page-accent presence = 2px left rail full ink + ≤6% accent wash. |
| **SummaryStrip** | S1; vertical hairline dividers between metrics; values `--text-primary`, deltas: up `--resume-success` ink, down `--resume-danger` ink. |
| **PinnedActivities** | S1 cards; S4 hover; unpin control `--text-faint` → `--text-secondary` on hover. |
| **ScheduleCard** | S1; row hairlines (no zebra); today = 2px accent rail + 5% accent wash; time gutter `--text-muted` tabular (parity rule as above). |
| **StatusBand** | Status color at 8% wash + 24% status hairline + status ink label/icon; inks from §A tokens; statuses never fabricated (honesty law). |
| **GoalsCard** (673 ln) | S1; goal rows hairline-separated; category dot = ENTITY light map; period chips S3 + `--text-secondary`; complete toggle `--resume-success` ink; progress = S3 track + entity fill; add-form input S3, focus = global outline; overdue none (deadlines card's job); empty/loading/error per R-19. |
| **DeadlinesCard** (842 ln) | S1; overdue rows = `--resume-danger` ink + 6% danger wash; priority inks = danger/warning/info tokens; datetime inputs S3 + `--text-primary` + focus outline; reminder rows hairline-separated; modal S2 + scrim. |
| **LongestFocusCard** (196 ln) | Full white-on-dark set remapped: `text-white/*` → `light:text-stone-900/700/500` ramp; `bg-white/5` rows → `light:bg-[rgb(28_25_23_/_0.04)]`; `border-white/10` → `light:border-[var(--ws-border)]`; `bg-black/30` toggle → `light:bg-stone-200`; rank #1 numeral accent ink. |
| **WidgetGrid** (322 ln) | Heatmap container glass → R-14 solidify `light:bg-white/85` + hairline (blur unchanged). Mode toggle: track S3, active pill `light:bg-white light:text-stone-900` + strong hairline (inverts dark's zinc-700 pill correctly). Widget cards `light:bg-[var(--color-card)]`. Drag/edit affordances: veil + strong hairline; DnD keyboard equivalents already mandated by W-8 — untouched. |
| **InsightStrip** | Accent wash ≤5% + accent hairline + `--text-secondary` body; icon accent ink. |
| **MomentumHero** (193 ln) | S1 + radial accent wash ≤6% alpha (bloom-family sanction, static); score numeral `--text-primary`; bars S3 track + `--ws-accent` fill; streak flame `--color-amber-400` light + `#451a03` ink pairing; skeleton `--color-card-sunken`. |
| **TierBreakdownStrip** | Tier chips S3 + category ink labels; bars S3 track + category fill; counts tabular (parity rule). |

**R-19 — 4-state matrix:** every widget above ships explicit light treatment for data / loading (§D LoadingState) / empty (§D EmptyState) / error (danger band: 8% wash + danger ink + 24% hairline). Zero/empty data must never render as 0 (§0 law).

## §F Interactive States (Phase 4)

| State | Light law |
|---|---|
| hover | S4 veil + hairline-strong, 140ms, transform/opacity only |
| active/pressed | S3 sunken, no scale |
| selected | 2px page-accent rail + 5% wash |
| focus-visible | global 2px `--ws-focus` outline, 2px offset (§A) |
| disabled | `--text-faint` + 45% opacity, no cursor feedback games |
| drag/edit (WidgetGrid) | veil + strong hairline on source, S2 ghost |

## §G Before/After — GoalsCard (worked example)

**Dark (today):** `#09090b` page; card `bg-zinc-900/60`; `border-zinc-800`; rows hover-fill `zinc-800/50`; labels `text-zinc-500`; category dots as-is.
**Light (spec):** `#f5f2ec` paper; card `#fcfbf8` framed by a single 8% warm hairline — no shadow, no glass; rows separated by hairlines, hover raises a 4% veil instead of a darker fill (light surfaces darken toward ink, dark surfaces lighten toward glow — the asymmetry is what makes this tailored); category dots shift to the darkened Tableau light map so green/goal dots survive on paper; period chips sit in sunken wells; the add-form input is a sunken well with a 2px cyan outline on focus; an empty goals list shows the white icon chip + warm muted copy. Net read: a printed planner page, not an inverted terminal.

## §H Implementation Checklist

1. STEP-0 census (blocking) → arbitrate `--color-primary`, locate every custom-prop definition, `[data-page]` accent rules, `light:` variant config, verify bundle line-counts.
2. Baselines: Playwright captures — dark full dashboard + per-widget × states; current partial light. → `evidence/light-mode/baseline/`.
3. **LIGHT-1:** `html.light` block + `::selection`/`:focus-visible` + CategoryColors LIGHT map + spec doc committed. Gates. Commit `feat: light mode token foundation (LIGHT-1)`.
4. **LIGHT-2:** shared components (§D). Gates incl. dark parity. Commit `feat: light mode shared components (LIGHT-2)`.
5. **LIGHT-3:** dashboard components (§E) + R-19 states. Gates incl. dark parity + contrast table. Commit `feat: dashboard light mode (LIGHT-3)`.
6. Full gate suite + report. Waves 4+ (remaining ~30 pages, per-page tailored specs from this recipe system) queue separately.

---

# EXECUTOR PROMPT — paste verbatim to Hermes

```
# TASK: LIGHT MODE FULL REDESIGN — Waves 1–3 (R-12…R-18)
Skill Router: load BUILD. If it fails to load, report the failure verbatim and STOP.

You are implementing a tailored light mode for RHEO. You inherit rulings R-12–R-18.
PRIME DIRECTIVE: additive-only. Dark mode must render pixel-identically before/after
your changes. Any edit that alters dark rendering FAILS the wave.

## HARD LAWS
- Dark parity is a gate, not a hope (R-12). Appended `light:` classes and the
  `html.light{}` token block are the ONLY mechanisms.
- Zero box-shadow added. Zero new backdrop-blur. Existing blur is NOT removed (R-14).
- Zero new hex literals outside index.css and src/lib/CategoryColors.ts (white/black
  alpha-utilities exempt). Zero `transition: all`. Zero new infinite animations.
  Zero radius changes. Zero font changes (R-15).
- New `light:` classes reference tokens via arbitrary values where possible;
  never palette utilities except stone ramp/white/black.
- Bundle line counts and token names are UNTRUSTED. Code wins. Census first.

## STEP-0 — BLOCKING DISCOVERY (no edits before this reports)
1. Dump src/index.css IN FULL with line numbers.
2. Census every CSS custom property: grep -rn "^\s*--" src/*.css src/**/*.css and
   grep -rn "var(--" src/ — produce DEFINED vs REFERENCED vs UNDEFINED map. Explicitly
   rule on: --color-card, --text-primary, --text-secondary, --text-muted,
   --accent-primary, --accent-hover, --page-accent (where defined? per data-page?),
   --color-primary (pink #ec4899 vs amber #fbbf24 conflict — report which value the
   CODE actually defines, with file:line. If contradictory definitions exist, STOP
   and report for orchestrator arbitration).
3. Dump src/lib/CategoryColors.ts in full (incl. ENTITY_COLORS).
4. Dump all [data-page] accent rules (grep -n "data-page" src/index.css src/**/*.css).
5. Confirm the `light:` Tailwind variant config exists (dump tailwind/vite config
   variant section). If absent, STOP and report.
6. Verify actual line counts of: DashboardPage, GoalsCard, DeadlinesCard,
   LongestFocusCard, WidgetGrid, MomentumHero, ErrorBoundary (bundle claims 842/673/
   196/322/193/223 — report real numbers).
7. Baselines via Playwright: launch app (Linux: WAYLAND_DISPLAY= xvfb-run npx
   playwright …; dev-server capture is a DEV TOOL, gates remain §3-5). Capture DARK:
   dashboard full page + each §E widget × {data, empty, loading, error} where
   reachable; capture current partial LIGHT same set. Save evidence/light-mode/baseline/.

## WAVE 1 — LIGHT-1 (tokens + data palette)
1. Append to src/index.css, AFTER @theme and after ALL :root/.dark definitions
   (census orders it), OUTSIDE @theme:
html.light {
  --ws-surface: #f5f2ec; --ws-surface-raised: #fcfbf8; --ws-surface-overlay: #ffffff;
  --ws-surface-sunken: #edeae2; --ws-veil: rgb(28 25 23 / 0.04);
  --ws-scrim: rgb(28 25 23 / 0.32);
  --ws-border: rgb(28 25 23 / 0.08); --ws-border-strong: rgb(28 25 23 / 0.17);
  --ws-accent: #0e7490; --ws-accent-hover: #155e75; --ws-focus: #0e7490;
  --text-primary: #1c1917; --text-secondary: #44403c; --text-muted: #57534e;
  --text-faint: #82796f;
  --color-card: #fcfbf8; --color-card-raised: #ffffff; --color-card-sunken: #edeae2;
  --accent-primary: #0e7490; --accent-hover: #155e75;
  --resume-success: #15803d; --resume-warning: #b45309; --resume-danger: #b91c1c;
  --resume-info: #1d4ed8; --resume-score-high: #15803d; --resume-score-mid: #a16207;
  --resume-score-low: #b91c1c;
  --color-clay-300: #e8866b; --color-clay-400: #d96846; --color-clay-500: #b4472a;
  --color-clay-600: #93331d; --color-sage-400: #3f7d5f; --color-amber-400: #d97706;
  --color-sky-400: #2b7d99;
}
html.light ::selection { background: rgb(14 116 144 / 0.18); }
html.light :focus-visible { outline: 2px solid var(--ws-focus); outline-offset: 2px; }
  ADJUST NAMES to census truth: if components reference --text-primary etc. defined
  elsewhere, override THOSE names under html.light at their true definitions' cascade
  end. --resume-preview-* and --color-glow: UNCHANGED.
2. If census proves any alias (--color-card etc.) was UNDEFINED before, report it —
   do not invent dark values for it; light values above are the definition.
3. CategoryColors.ts: add LIGHT variant set —
   blue #4e79a7, orange #c05f10, red #c13538, teal #3f8f89→#3a8f89, green #3d7a44,
   yellow #a2820c, purple #8d5a86, pink #c9506a, brown #8a6448, grey #7d7668.
   Dark map untouched. ENTITY_COLORS light: goal=orange, ltg=yellow, habit=green,
   deadline=red, schedule=teal, note=purple, todo=--text-muted.
4. [data-page] accents: add html.light overrides via transform rule (keep hue, L*45±2,
   C−15%): pink #ec4899→#be185d, amber #f59e0b→#b45309, emerald #10b981→#047857,
   cyan #06b6d4→#0e7490, violet #8b5cf6→#6d28d9, sky #0ea5e9→#0369a1, rose #f43f5e→
   #be123c, indigo #6366f1→#4338ca, orange #f97316→#c2410c, teal #14b8a6→#0f766e —
   applied to whatever the census actually finds.
5. Commit spec doc (this prompt's rulings + tables) to
   agent/docs/light-mode-redesign-09092026/LIGHT_MODE_SPEC.md.
Commit: `feat: light mode token foundation (LIGHT-1)` — single commit, exact message.
Gates: G-LM-1 census report complete · G-LM-2 tsc total+delta (zero outside debt) ·
G-LM-3 node scripts/build.mjs (rm -rf dist FIRST; verify served artifact) · G-LM-4
dark parity pixel-diff vs baseline (target <0.002 changed-pixel ratio, report exact).

## WAVE 2 — LIGHT-2 (shared components)
Append light: variants per table (dark classes byte-untouched):
- GlassCard: default light:bg-[var(--color-card)] light:border-[var(--ws-border)]; 
  compact same+p-3 kept; subtle light:bg-[color-mix(in_srgb,var(--color-card)_60%,transparent)]
  hairline 6%; notebook light:border-l-2 light:border-l-stone-300, keep railLight;
  bordered light:border-[var(--ws-border-strong)]; elevated
  light:bg-[var(--ws-surface-overlay)] light:border-[var(--ws-border-strong)] NO shadow;
  interactive light:bg-white/70, hover veil+strong hairline, keep translate, no scale.
  Verify accent bgLight 4% washes read on paper.
- EmptyState: icon chip light:bg-white light:border-[var(--ws-border)], icon
  light:text-stone-500; title light:text-stone-700; desc light:text-stone-500; button
  light:bg-[var(--ws-accent)] light:text-white light:hover:bg-[var(--ws-accent-hover)].
  If census proved --color-primary undefined, swap that light: ref to --ws-accent and
  REPORT; else leave.
- LoadingState: spinner track light:border-stone-200 (head keeps var(--page-accent));
  DELETE the dead '#ec4899' inline fallback if census confirms --page-accent defined
  (report). Skeleton light:bg-stone-200/70.
- SectionHeader: title light:text-stone-900; icon chip rides §C page-accent remap.
- PageShell: NO changes.
- ErrorBoundary: light: everything — page light:bg-[var(--ws-surface)]; panel
  light:bg-white light:border-[var(--ws-border-strong)]; heading
  light:text-stone-900; body light:text-stone-700; meta light:text-stone-500;
  details/pre light:bg-[var(--ws-surface-sunken)]; primary btn accent fill white text;
  secondary light:bg-white light:border-[var(--ws-border-strong)] light:text-stone-800;
  tertiary light:text-stone-500; glyph light:text-[var(--resume-danger)].
- ThemeToggle: verify/polish existing light: chips (active amber-100/700; system
  violet-50/700; dark chip add light:bg-stone-100 light:text-stone-600).
Commit: `feat: light mode shared components (LIGHT-2)`
Gates: G-LM-1..4 as wave 1 + G-LM-5 (light screenshots: each component × states) +
G-LM-7 (grep bans: new hex outside 2 sanctioned files =0; box-shadow added =0;
backdrop-blur added =0; transition:all =0; new infinite animation =0; radius
values ADDED outside {6,10,16} =0; EOL: match each file, zero EOL-only lines).

## WAVE 3 — LIGHT-3 (dashboard, principal's first priority)
Per-component (recipes: S1 card=--color-card+8% hairline; S3 sunken; S4 veil-hover;
rails 2px full ink; washes ≤6%; status bands ≤8%; inks from tokens):
- DashboardPage root: paper via tokens; zero layout edits.
- HeroBand: S1 + page-accent 2px rail + ≤6% wash; greeting light primary.
- SummaryStrip: S1, vertical hairline dividers, up/down = success/danger ink.
- PinnedActivities: S1, S4 hover, unpin faint→secondary on hover.
- ScheduleCard: S1, hairline rows (no zebra), today = 2px accent rail + 5% wash.
- StatusBand: 8% status wash + 24% status hairline + status ink.
- GoalsCard: S1, hairline rows, entity-light dots, chips S3+secondary ink, complete
  = success ink, progress S3 track + entity fill, input S3 + focus outline.
- DeadlinesCard: S1, overdue = danger ink + 6% wash, priority = danger/warning/info
  inks, inputs S3, modal S2 + --ws-scrim.
- LongestFocusCard: text-white/* → light stone 900/700/500 ramp; bg-white/5 →
  light:rgb(28 25 23 / 0.04); border-white/10 → light hairline; bg-black/30 →
  light:bg-stone-200; rank #1 accent ink.
- WidgetGrid: heatmap container light:bg-white/85 + hairline (blur STAYS, R-14);
  toggle track S3, active pill light:bg-white light:text-stone-900 + strong hairline;
  widget cards light:bg-[var(--color-card)]; edit-mode affordances veil+strong.
- InsightStrip: ≤5% accent wash + accent hairline + secondary body.
- MomentumHero: S1 + static radial ≤6% accent; score primary ink; bars S3 + accent
  fill; flame --color-amber-400 light + #451a03 ink; skeleton sunken.
- TierBreakdownStrip: chips S3 + category ink; bars S3 + category fill.
- EVERY widget: R-19 4-state light matrix (loading/empty/error per shared comps;
  error band = 8% danger wash + danger ink + 24% hairline). Sweep remaining
  src/pages/dashboard/* (Sparkline, StopwatchTimer, ProductivityFocusZone) under
  the same recipes; no ad-hoc values.
Claims in force: WidgetGrid.tsx etc. claimed by this task; WS-1 waits for LIGHT-3.
FORBIDDEN this task: preload.ts, main.ts, SettingsPage.tsx, App.tsx, Sidebar.tsx,
GoldPage.tsx, sync-server/**, landing/**. Touching any = STOP and report.
Commit: `feat: dashboard light mode (LIGHT-3)`
Gates: G-LM-1..7 + G-LM-6 CONTRAST AUDIT: computed ratios for every token ink on
paper and every colored text usage — text ≥4.5:1, graphics/borders-meaningful ≥3:1;
faint + washes exempt. Failures → darken 8% per iteration until pass (pre-staged);
report final values verbatim.

## GLOBAL GATE LAW
- G-LM-4 dark parity per wave: identical viewport/capture script as baseline;
  report exact changed-pixel ratio; >0.002 = FAIL. Two fix attempts max, then
  report, don't hack.
- Shell-launch gate (§3-5): Playwright _electron.launch, xvfb-run, bounding-box
  assertions on dashboard widgets, screenshots both modes. Renderer-attach and
  MCP are dev tools, never gates. No CDP :9222.
- tsc reported as TOTAL + DELTA; delta must be 0.
- Anchors by content (grep), never line numbers. One commit per wave, exact
  messages, nothing unrelated rides. Backup branch before any destructive git op.

## REPORT FORMAT (per wave)
1. Census verdict (incl. --color-primary truth with file:line; undefined-token list)
2. Real line counts vs bundle claims
3. Gates G-LM-1..7 PASS/FAIL verbatim (parity ratio + contrast table included)
4. Files changed + commit hash
5. Screenshot paths (evidence/light-mode/)
6. Deviations/STOPs, if any
When a ruling is missing or code contradicts this prompt, STOP and ask the
orchestrator — do not invent.
```

---

# QUEUE + CLAIMS UPDATE

| Item | State |
|---|---|
| LIGHT-1/2/3 | **Spec delivered**, executor prompt paste-ready. Parallel-safe with P0 (file-disjoint). Claims: `index.css`, `CategoryColors.ts`, `GlassCard`, `EmptyState`, `LoadingState`, `SectionHeader`, `PageShell`, `ErrorBoundary`, `ThemeToggle`, `DashboardPage.tsx`, `pages/dashboard/*`, `components/dashboard/{WidgetGrid,MomentumHero,GoalsCard,DeadlinesCard,LongestFocusCard}.tsx` |
| WS-1 | Serialization recorded: `WidgetGrid.tsx` → LIGHT-3 completes first (R-18) |
| M-1 | Noted: must carry `html.light` block + absorb radius/font/glass deferrals (R-15) |
| LIGHT-4+ | Remaining ~30 pages — per-page tailored specs from the §B recipe system; queued after principal reviews LIGHT-3 evidence |

```
Status (verbatim):
Calibration              DELIVERED — both frontiers, 4 principal items, hot files.
Rulings R-12–R-18        DELIVERED — constitutional audit + light-mode law, ledger updated.
LIGHT_MODE_SPEC.md       DELIVERED in-message (§A–§H); committed to agent/docs/light-mode-redesign-09092026/ by executor in LIGHT-1.
Executor prompt          DELIVERED — paste-ready, self-contained, waves 1–3, gates G-LM-1..7.
Queue + claims           DELIVERED — LIGHT parallel-safe with P0; WS-1/M-1 coordination recorded.
Gates/reports            NOT EXECUTED — no shell/repo access from this session; executor runs, verbatim reports return here for ruling.
Waiting on               Executor pickup (Hermes) · principal override rows optional (paper temp / accent hue) · no new §8 blockers created.
```
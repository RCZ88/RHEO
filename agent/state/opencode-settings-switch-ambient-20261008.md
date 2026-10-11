<!-- SESSION: opencode-settings-switch-ambient-20261008 -->
<!-- AGENT: opencode | TERMINAL: 35181 | PROJECT: App Tracker -->

# Agent State — opencode-settings-switch-ambient-20261008

> **STATUS:** completed | **UPDATED:** 2026-10-08T11:20:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Fix 4 reported Settings defects: invisible switch ON-state, dead ambient
background (dark + light), per-page ambient scope, and cross-tab Halo Island leak.
**STATUS:** completed
**IN FLIGHT:**
- nothing — all four shipped and verified to the limit §0-0 allows
**COMPLETED:**
- **Switch (white-on-white).** Root cause was NOT a colour choice:
  `[data-page="settings"] { --page-accent: var(--text-primary) }` (index.css:743,769)
  makes the settings accent a TEXT token — `#fafafa` dark / `#1c1917` light. Three
  hand-rolled switches filled their track with it and used a white knob: measured
  **1.04:1 on dark, 17.49:1 on light**. Dark-only bug; the light half was fine.
- Consolidated `HaloSwitch` → one `SettingsSwitch` using the sanctioned `.sf-switch`
  (accent track + surface-coloured knob). Replaced 4 call sites: smooth-scroll,
  Halo enable, Halo widget toggles, and the ambient on/off (which was a 4th style,
  hardcoded `bg-emerald-500`).
- **Ambient dark.** `PEAK_ALPHA` was a single 0.08 for both themes; the settings
  page's hue was grey. Measured composited ΔRGB: old 16.1 → new 38.2 (dark),
  18.5 → 30.0 (light). Now per-theme: dark 0.19 / light 0.13, plus `isHueful()` so an
  achromatic accent falls back to `--ws-accent`.
- **Ambient light.** `AppBackground.tsx:121` hard-coded `className="light:opacity-0"`
  on the wash. Removed from that layer ONLY — the vignette/grain/luminance-wash keep
  theirs because they subtract light, which is meaningless on warm paper.
- **Per-page scope.** `AmbientPrefs` gained `scope: 'all'|'selected'` + `pages: string[]`,
  one gate `ambientAppliesTo()`, and an `AMBIENT_PAGES` picker (sf-radio--card +
  sf-check) behind progressive disclosure.
- **Halo Island leak.** It sat at the top level of SettingsPage's JSX, OUTSIDE every
  `activeTab === '…'` conditional — so it mounted on Finance/Devices/Database/Auth/
  Shortcuts too, and being the last `data-section` it is what a scroll lands on.
  Moved inside the Appearance tab. Registered `settings.halo` in the manifest and
  added `SETTINGS_SECTION_TAB`, because a same-page section row carries no `tab`
  and was landing on whatever tab was last open.
- **Stale deep-nav hint.** `SettingsPage` never called `consumeSectionHint()`, so
  `sessionStorage['deepNav:section']` was written and never cleared on every visit.
- Fixed a pre-existing `TS2304` (`HaloUiVersion` used but never imported) in the file
  I held a lease on: 113 → 112 scoped errors, zero added.

**SECOND PASS — "make sure the ambient applies to ALL pages" was NOT actually done.**
The machinery was right but three page roots painted an OPAQUE background ON TOP of
`AppBackground`'s `fixed inset-0 z-[0]` wash, so the wash was 100% invisible on them:
  - `src/pages/TerminalPage.tsx:3154` — `bg-zinc-950`. The page the wash was BUILT for.
  - `src/pages/ConductorPage.tsx:454,463,477` — `bg-zinc-950`. 454/463 are the
    `loading-projects` and `no-projects` states, so the wash vanished exactly when the
    page was emptiest.
  - `src/components/learn/LearnPage.tsx:561` — `bg-[#0f0e0d]`.
**THE KEY FACT that makes the fix safe: dark `--ws-surface` is `#09090b`, which IS
Tailwind's `zinc-950`.** So those roots were repainting the exact colour already behind
them — they bought nothing and cost the entire feature. Removed the dark fills; light
variants left untouched because they already let the wash through (80%/95%) and are
deliberate surfaces I cannot visually verify. This is very likely the real reason the
user saw "it doesn't work on dark mode" as reproducible-but-inexplicable.
**NEXT ACTION:** CZ must close RHEO, `npm run build`, reopen. Runtime verification of
the rendered result is impossible for an agent (§0-0). Two probes to re-run any time.

### Shared-file note
`src/pages/TerminalPage.tsx` had 142 insertions / 112 deletions of uncommitted work I
did not write (WorkforcePanel / isometric scene). I removed one CSS class from one
line and verified my marker survived at 3145 before leaving. Per §0a I did not touch
their work.

### Probes (both exit non-zero on regression)
- `node agent/probes/ambient-probe.mjs` — prints switch knob-vs-track contrast per
  theme + wash composited ΔRGB. **The number that settled the design:** white knob on
  the dark accent is 2.43:1 (FAILS 3:1); surface-coloured knob is 8.19:1 (passes).
- `npx esbuild src/lib/ambient.ts --bundle --platform=node --format=cjs \
    --outfile=/tmp/df/ambient.cjs --loader:.md=text && \
   node agent/probes/ambient-logic-probe.mjs` — drives the REAL shipped module.
  33 checks: scope gate, sanitisation, persistence, gradient, and the index.css
  parity check that pins `AMBIENT_PAGES` to the 21 ids the app can actually produce.

### Notes for whoever picks this up
- `AMBIENT_PAGES` must stay == the `[data-page=…]` set in `src/index.css`. It was
  hand-typed at 15 against a real 21 and the 6 gaps were silently unselectable. The
  logic probe now fails on any mismatch.
- `setAmbientPrefs` seeds the page list ONLY on the transition into `selected`
  (`patch.scope === 'selected'`). Keying that on the resulting `pages.length === 0`
  made the picker's "Clear" button resurrect the whole list on the next write.
- Two hand-rolled `role="switch"` remain in SettingsPage (Boot Animation, lines ~4883
  and ~4925). They are `bg-violet-500` + white knob — NOT the reported white-on-white
  bug — so I left them rather than restyle someone else's deliberate sub-panel.
  Consolidating them onto `sf-switch` is a fair follow-up.
- `src/pages/settings/AdvancedSection.tsx` exports a `FinanceTab` with a duplicate
  `data-section="settings.finance"` (line ~188). It is UNMOUNTED (nothing imports
  `AdvancedSection`), so it is not a live duplicate today, but it would become one
  the moment that file is wired up.
- `npm run validate:pages` reports 1 pre-existing error unrelated to this work:
  `/agentic` has no manifest (route exists at App.tsx:3818). Not mine; not fixed.

---

## HISTORY (previous cycles)
None — first cycle for this session.
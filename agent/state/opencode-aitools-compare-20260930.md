<!-- SESSION: opencode-aitools-compare-20260930 -->
<!-- AGENT: opencode | TERMINAL: aitools-compare | PROJECT: App Tracker -->

# Agent State — opencode-aitools-compare-20260930

> **STATUS:** completed | **UPDATED:** 2026-10-01T01:20:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Make the AI Tools detail view fully comparable in DROPDOWN mode (metric switch +
multi tool/model select + combined-vs-split chart toggle), via the PAINT pipeline.
**STATUS:** completed
**IN FLIGHT:**
- (none — built; awaiting human relaunch for visual confirmation)
**COMPLETED:**
- ROOT CAUSE (verified, not guessed): the dropdown branch (was 2443-2532) contained
  ZERO `aiChartMode` references. It inherited whatever the page-level metric was —
  in practice 'tokens' — and had: a stat grid hardcoded to Tokens/Input/Output/Ratio/
  Messages/Cost, a single-dataset `<Line>` with `legend.display:false`, no `chartType`
  branch, and no model breakdown. So `modalSelectedModels` was unreachable and the
  detail view was structurally ONE agent: `selectedAgent` is a single `string | null`
  and the whole view is gated on `selectedAgent && selectedAgentDetail`.
- New module-level `AgentComparePanel` (~250 lines) rendering: Tools|Models dimension
  toggle, 4-metric selector + All/In/Out token sub-toggle (bound to the EXISTING
  `aiChartMode`/`tokenDisplayMode`, so dropdown and page can never disagree), 7D/30D/All
  range, a multi-select chip row, and a Combined|Split layout toggle.
  - Combined = N series on one axis + a ranked total/share readout (answers "who wins").
  - Split = small multiples, one chart per series (answers "how do they differ").
  - Fill only when a single series — overlapping fills turn to mud.
  - ONE shared 3-sigma outlier threshold computed from the summed column, applied to
    every series. Per-series filtering would zero a spike in one tool while an
    identical spike in another stayed visible = a comparison that lies.
- New `modelDailyTotals` memo aggregates each model's DAILY series across ALL tools
  (`byTool[x].modelDaily` is nested per tool, so models were only comparable inside the
  one tool they were picked from). `isSaneDay`-guarded, matching every other date loop.
- `compareSelection` seeded to `[selectedAgent]` via effect; empty = "all" (matches the
  file's existing All-sentinel idiom). Layout persisted to `localStorage`
  (`ai-compare-layout`). "All" range spans the UNION of selected entries' dates, not
  just the anchor tool's.
- Dropped `backdrop-blur-xl` from the dropdown panel — it is chrome, and LAMINAR §7.3
  makes backdrop-blur on chrome a hard-gate FAIL.
- PAINT: answered the 4 LAYER-0 questions, called the `@bklit` MCP (Gate B) and
  **deliberately did not adopt** `@bklit/line-chart` — it is Recharts-based and this
  file is 100% `react-chartjs-2` across 16 render sites, so adopting it would put two
  chart engines in one view. Series colors reuse each tool's existing identity color
  and the frozen `MODEL_COLORS`; no palette expanded. 7 chart colors lifted to named
  module constants so no raw hex sits in a component body.
**NEXT ACTION:** Human relaunches the app → AI Tools → click a tool → toggle
  Popup/Dropdown → in the dropdown use Tools|Models, the metric selector, the chip
  multi-select and Combined|Split.
**NOTES:** Verified `tsc` delta against the pre-change baseline by copying both
  versions INTO the project (so module resolution + `deskflow-api.d.ts` apply) and
  comparing error MESSAGES with line numbers stripped — line numbers shift by ~550 so
  a naive `comm` on raw lines reports ~20 phantom "new" errors. Result: zero new
  error classes; the only count change is `deskflowAPI` 10→11, which is (a) a harness
  artifact and (b) from the PREVIOUS cycle's Tools Config work, not this one.
  `heatmapEmpty` undefined and the chart.js `weight:'500'` errors are pre-existing.
  BUILD OK (exit 0) after taking the build lock; bundle `index.BlqwVyqG.js` verified
  to contain the empty states, the Combined/Split tooltips and `modelDailyTotals`.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — 2026-10-01
**ROLE:** investigation
**STATUS:** completed
**IN FLIGHT:** — none
**COMPLETED:** Mapped the detail view; confirmed dropdown had no metric control and
  was single-agent by construction; read PAINT + conflict-resolution + LAMINAR §5/§7.3.
**NEXT ACTION:** implement.

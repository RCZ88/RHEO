# Light Mode Spec Compliance Audit — Prompt

## Raw Request (verbatim)
> "refer to the result spec for the light mode"
> "if anyhting is unsure generate prompt"

## Problem
The 09-09 light mode spec (`RESULT.md`, `LIGHT_MODE_SPEC.md` §A–§H) was delivered but not fully executed. This session patched 6 files that are NOT covered by the spec (Sidebar.tsx, TitleBar.tsx, LearnPage.tsx, LearnNavBar.tsx, LearnHome.tsx, AppBackground.tsx) and left several spec-covered files unverified (ErrorBoundary.tsx, GlassCard.tsx, ThemeToggle.tsx). The user wants a spec-grounded compliance audit before anything else moves forward.

## Context Bundle
Read `agent/docs/generate-prompt-docs/light-mode-spec-compliance-audit-13092026/CONTEXT_BUNDLE.md` first — it has the full census, spec location, §H FORBIDDEN verbatim, per-file light: counts, and the spec recipes the patches need to be checked against.

## Your Mandate

Act as Lead Designer + Spec Auditor. Produce a compliance report that answers these questions definitively — do NOT hedge:

### 1. §H FORBIDDEN audit
The spec line 345 says:
```
FORBIDDEN this task: preload.ts, main.ts, SettingsPage.tsx, App.tsx, Sidebar.tsx,
GoldPage.tsx, sync-server/**, landing/**. Touching any = STOP and report.
```
Sidebar.tsx was patched this session (35 `light:` classes added, 0→35). Per spec, touching it = STOP and report. Is the Sidebar patch a spec violation that must be reverted, or does the user's explicit demand ("the sidebar is not working at all") override §H? Give a verdict, not both options.

### 2. Out-of-spec patches
TitleBar.tsx (12), LearnPage.tsx (10), LearnNavBar.tsx (7), LearnHome.tsx (23), AppBackground.tsx (5) are NOT mentioned anywhere in §A–§H. Were these patched correctly per the frontend-design skill spec (warm paper #fafafa base, neutral-200 borders, stone-400→stone-800 ink ramp, emerald preserved for functional LIVE/tracking states), or are they ad-hoc? Check each file's light: classes against the frontend-design skill light mode color palette and card variants.

### 3. Spec-covered files — verify, don't assume
For each of these, read the actual file and check against the spec recipe. Report MATCH or MISMATCH with the specific line/content that fails:

- **SectionHeader.tsx** (2 light:) vs §D line 146: "Title light:text-stone-900. Action slot inherits." — already confirmed match, just report.
- **ThemeToggle.tsx** (3 light:) vs §D line 149: "active-light chip light:bg-amber-100 light:text-amber-700; system chip violet → light:bg-violet-50 light:text-violet-700; dark chip gains light:bg-stone-100 light:text-stone-600." — does 3 matches cover all three chips?
- **ErrorBoundary.tsx** (12 light:) vs §D line 148: full light redesign — page S0 paper, panel S2 white + strong hairline, heading --text-primary, body --text-secondary, meta --text-faint, details/pre S3 sunken, primary btn --ws-accent fill/white text, secondary light:bg-white light:border-[var(--ws-border-strong)] light:text-stone-800, tertiary --text-faint, error glyph --resume-danger. Does 12 matches cover all of this?
- **GlassCard.tsx** (10 light:) vs §D line 143 recipe matrix: default S1 + hairline light:bg-[var(--color-card)] light:border-[var(--ws-border)]; elevated S2 light:bg-[var(--ws-surface-overlay)] light:border-[var(--ws-border-strong)] no shadow; interactive light:bg-white/70 S4 hover; compact/subtle/notebook/bordered variants. Do 10 matches cover the full recipe matrix?
- **DashboardPage.tsx** (49 light:) vs §E line 155: "S0 paper via tokens; layout/spacing byte-unchanged." — is the root actually S0 paper via tokens, or is 49 matches spread across something else?

### 4. Dashboard components — recipe compliance
For each dashboard component with light: matches, read the file and check the actual light: classes against the §E recipe. Report MATCH or MISMATCH:

- HeroBand.tsx (1 match) — §E line 156: "S1 card + hairline; greeting --text-primary; metrics tabular-nums only if already tabular in dark; page-accent presence = 2px left rail full ink + ≤6% accent wash." Does 1 match cover all of this?
- SummaryStrip.tsx (5), PinnedActivities.tsx (15), ScheduleCard.tsx (24), StatusBand.tsx (18), GoalsCard.tsx (67), DeadlinesCard.tsx (70), WidgetGrid.tsx (5), MomentumHero.tsx (40), InsightStrip.tsx (8) — read each and check against §E recipe.

### 5. §C CategoryColors.ts ENTITY_COLORS LIGHT map
Read `src/lib/CategoryColors.ts` and report: did this session's patch use the spec's Tableau-10 seeded values (blue #4e79a7, orange #c05f10, red #c13538, teal #3a8f89, green #3d7a44, purple #8d5a86, yellow #a2820c, pink #c9506a, brown #8a6448, grey #7d7668), or ad-hoc values? Spec §C line 117: "G-LM-6 is the arbiter — pre-staged fallback: darken 8% per iteration until ≥3:1 on paper."

### 6. Gates
Report which spec gates have NOT been run (G-LM-6 contrast audit, G-LM-4 dark parity, G-LM-7 grep bans) and what each requires.

## Output Format

A compliance table with one row per file, columns: `File | light: count | In spec? | Spec section | Verdict (MATCH/MISMATCH/OUT-OF-SPEC/FORBIDDEN) | Detail`. Then a "Decisions Required" section listing exactly what needs user input before work continues.

Do NOT generate implementation code. This is an audit report only. Quote spec lines verbatim when making a pass/fail call. Read the actual files — do not rely on the census counts alone (a file can have light: classes that don't match the spec recipe).

# CONTEXT BUNDLE: Light Mode Spec Compliance Audit

## What this bundle covers
Gap audit between the 09-09 spec (`RESULT.md` / `LIGHT_MODE_SPEC.md` §A–§H) and the actual light: class census on disk after this session's patches. The user said "refer to the result spec for the light mode" and "if anything is unsure generate prompt."

## Spec location
`agent/docs/generate-prompt-docs/light-mode-full-redesign-09092026/RESULT.md` — 394 lines, §A (tokens), §B (recipe matrix S0–S4), §C (data + page-accent light maps), §D (shared components: GlassCard, EmptyState, LoadingState, SectionHeader, PageShell, ErrorBoundary, ThemeToggle), §E (dashboard wave: DashboardPage, HeroBand, SummaryStrip, PinnedActivities, ScheduleCard, StatusBand, GoalsCard, DeadlinesCard, LongestFocusCard, WidgetGrid, InsightStrip, MomentumHero, TierBreakdownStrip), §H (FORBIDDEN list: preload.ts, main.ts, SettingsPage.tsx, App.tsx, Sidebar.tsx, GoldPage.tsx, sync-server/**, landing/**).

## §H FORBIDDEN — verbatim line 345
```markdown
FORBIDDEN this task: preload.ts, main.ts, SettingsPage.tsx, App.tsx, Sidebar.tsx,
GoldPage.tsx, sync-server/**, landing/**. Touching any = STOP and report.
```

## Census on disk (grep -c "light:" per file, after this session's patches)

| File | light: count | In spec? | Spec section | Notes |
|------|-------------|-----------|-------------|-------|
| src/components/Sidebar.tsx | 35 | NO — FORBIDDEN | §H line 345 | Patched this session against spec. 0→35. Shell bg/border, ruler strip, header, node hairline, group kickers, NodeDot chip+dot, instrument strip (collapsed+expanded). |
| src/components/TitleBar.tsx | 12 | NO | Not in spec | Patched this session. 0→12. Shell bg, bell icon, 3 window-control icons, unread badge, hover states. Zero raw inline `style={{ color, light }}` left. |
| src/components/learn/LearnPage.tsx | 10 | NO | Not in spec | Patched this session. 0→10. Shell bg/text, scrollbar, shortcuts modal (overlay+card+h3+div+p+kbd+span). |
| src/components/learn/LearnNavBar.tsx | 7 | NO | Not in spec | Patched this session. 0→7. Header bg, clay pill, breadcrumb items, chevron, 3 nav circle buttons. |
| src/components/learn/LearnHome.tsx | 23 | NO | Not in spec | Patched this session. 0→23. Badge, headline, para, 3 buttons, 3 get-started cards, features section border+heading+para. |
| src/components/AppBackground.tsx | 5 | NO | Not in spec | Patched this session. 0→5. 5 layers dissolve on light (wash, ferrofluid, vignette, grain, overlay). |
| src/components/SectionHeader.tsx | 2 | YES | §D | Title `light:text-stone-900` — matches spec line 146. Also icon chip `light:bg-[var(--page-accent)]/15 light:border-[var(--page-accent)]/30`. |
| src/components/ErrorBoundary.tsx | 12 | YES | §D | Full light redesign per spec line 148. Appears done — needs confirmation. |
| src/components/GlassCard.tsx | 10 | YES | §D | Appears done — needs confirmation against §D recipe matrix. |
| src/components/ThemeToggle.tsx | 3 | YES | §D | Spec says "polish existing light: chips" — 3 matches may be incomplete. |
| src/pages/DashboardPage.tsx | 49 | YES | §E | S0 paper via tokens per spec line 155. Appears done. |

## Dashboard components — spec §E vs census

| Component | light: count | In spec §E? | Spec recipe |
|-----------|-------------|-------------|-------------|
| HeroBand.tsx | 1 | YES | S1 card + hairline + page-accent 2px rail + ≤6% wash |
| SummaryStrip.tsx | 5 | YES | S1 + vertical hairline dividers + success/danger ink deltas |
| PinnedActivities.tsx | 15 | YES | S1 cards + S4 hover + unpin faint→secondary |
| ScheduleCard.tsx | 24 | YES | S1 + row hairlines + today 2px accent rail + 5% wash |
| StatusBand.tsx | 18 | YES | 8% wash + 24% hairline + status ink |
| GoalsCard.tsx | 67 | YES | S1 + hairline-separated rows + ENTITY light map + period chips S3 + complete toggle success ink + progress S3 + add-form S3 |
| DeadlinesCard.tsx | 70 | YES | S1 + overdue danger ink + 6% wash + priority inks + datetime S3 + reminder hairlines + modal S2 |
| WidgetGrid.tsx | 5 | YES | Heatmap solidify + mode toggle + widget cards S1 |
| MomentumHero.tsx | 40 | YES | S1 + radial wash ≤6% + score primary ink + bars S3 + flame amber-400 + skeleton sunken |
| LongestFocusCard.tsx | (not re-counted this session) | YES | Full white-on-dark remapped to stone ramp |
| InsightStrip.tsx | 8 | YES | ≤5% accent wash + accent hairline + secondary body |

## §D shared components — detail

**SectionHeader.tsx** (2 light: matches):
```tsx
// Line 14 — icon chip
<div className="w-9 h-9 rounded-lg bg-[var(--page-accent)]/10 border border-[var(--page-accent)]/20 flex items-center justify-center text-[var(--page-accent)] light:bg-[var(--page-accent)]/15 light:border-[var(--page-accent)]/30">
// Line 18 — title
<h2 className="text-[15px] font-semibold text-zinc-100 light:text-stone-900 ${titleClassName}">{title}</h2>
```
Spec §D line 146: "Title light:text-stone-900. Action slot inherits." → MATCHES.

**ThemeToggle.tsx** (3 light: matches) — needs confirmation vs spec line 149:
"active-light chip light:bg-amber-100 light:text-amber-700; system chip violet → light:bg-violet-50 light:text-violet-700; dark chip gains light:bg-stone-100 light:text-stone-600."

**ErrorBoundary.tsx** (12 light: matches) — needs confirmation vs spec line 148:
"page S0 paper; panel S2 white + strong hairline; heading --text-primary; body --text-secondary; meta --text-faint; details/pre S3 sunken; primary btn --ws-accent fill/white text; secondary light:bg-white light:border-[var(--ws-border-strong)] light:text-stone-800; tertiary --text-faint; error glyph --resume-danger."

**GlassCard.tsx** (10 light: matches) — needs confirmation vs §D recipe matrix lines 143:
"default: S1 + hairline → light:bg-[var(--color-card)] light:border-[var(--ws-border)]; elevated: S2 → light:bg-[var(--ws-surface-overlay)] light:border-[var(--ws-border-strong)]; interactive: light:bg-white/70, S4 on hover."

## §C — CategoryColors.ts ENTITY_COLORS LIGHT map

This session's patch added 7 light keys to ENTITY_COLORS (one per entity). Spec §C line 117-127 says:
- Tableau-10 lineage seeded values (blue #4e79a7, orange #c05f10, red #c13538, teal #3a8f89, green #3d7a44, purple #8d5a86, yellow #a2820c, pink #c9506a, brown #8a6448, grey #7d7668)
- ENTITY_COLORS inherit same LIGHT map (goal=orange, ltg=yellow, habit=green, deadline=red, schedule=teal, note=purple, todo=chrome→--text-muted)
- G-LM-6 is arbiter — pre-staged fallback: darken 8% per iteration until ≥3:1 on paper

UNCERTAINTY: Did this session's patch use the spec's Tableau-10 seeded values, or ad-hoc values? Need to read the actual file.

## Gates NOT yet run (spec §H lines 348-351)

- **G-LM-6 CONTRAST AUDIT**: computed ratios for every token ink on paper; text ≥4.5:1, graphics/borders-meaningful ≥3:1; faint + washes exempt; failures → darken 8% per iteration until pass; report final values verbatim. NOT RUN.
- **G-LM-4 dark parity**: identical viewport/capture script as baseline; report exact changed-pixel ratio; >0.002 = FAIL; two fix attempts max. NOT RUN.
- **G-LM-7 grep bans**: new hex outside 2 sanctioned files =0; box-shadow added =0; backdrop-blur added =0; transition:all =0; new infinite animation =0; radius values ADDED outside {6,10,16} =0; EOL match. NOT RUN.

## Files that spec never mentions (patched this session anyway)

TitleBar.tsx, LearnPage.tsx, LearnNavBar.tsx, LearnHome.tsx, AppBackground.tsx — none appear in §A–§H. The user's complaint ("sidebar, top bar, background, lyceum page not working") maps to these files. The spec does NOT cover them. This is the core uncertainty: are these out-of-spec patches acceptable because the user demanded them, or should they be pulled into a separate spec wave?

## User's verbatim complaints (this session)

1. "the sidebar the top bar, the background the everything aside from the card is not working at all. the lyceum page havent got its white mode" + "its all a mess"
2. "FUCKING FIX IT PROPERLY WITH THE PROPER STYLE AND EVERYTHING"
3. "if anyhting is unsure generate prompt" (just now)

## What the spec DOES cover that was NOT patched this session

- ErrorBoundary.tsx (§D full light redesign) — 12 light: matches on disk, appears done but needs confirmation
- GlassCard.tsx (§D recipe matrix) — 10 light: matches, needs confirmation
- ThemeToggle.tsx (§D polish) — 3 light: matches, may be incomplete
- DashboardPage.tsx root (§E S0 paper) — 49 light: matches, appears done
- All dashboard sub-components (HeroBand, SummaryStrip, PinnedActivities, ScheduleCard, StatusBand, GoalsCard, DeadlinesCard, WidgetGrid, MomentumHero, LongestFocusCard, InsightStrip) — census shows matches, needs spec-recipe confirmation

## Key files for the prompt to read

- `agent/docs/generate-prompt-docs/light-mode-full-redesign-09092026/RESULT.md` — full spec §A–§H (394 lines)
- `src/index.css` — token blocks (lines 46-137, 139-192), page-accent remaps (lines 458-476)
- `src/lib/CategoryColors.ts` — ENTITY_COLORS with LIGHT map (7 keys added this session)
- `src/components/Sidebar.tsx` — 35 light: classes, spec-FORBIDDEN
- `src/components/TitleBar.tsx` — 12 light: classes, not in spec
- `src/components/learn/LearnPage.tsx` — 10 light: classes, not in spec
- `src/components/learn/LearnNavBar.tsx` — 7 light: classes, not in spec
- `src/components/learn/LearnHome.tsx` — 23 light: classes, not in spec
- `src/components/AppBackground.tsx` — 5 light: classes, not in spec
- `src/components/SectionHeader.tsx` — 2 light: classes, spec §D match
- `src/components/ThemeToggle.tsx` — 3 light: classes, spec §D needs check
- `src/components/ErrorBoundary.tsx` — 12 light: classes, spec §D needs confirmation
- `src/components/GlassCard.tsx` — 10 light: classes, spec §D needs confirmation

## Date
2026-09-13 (13092026)

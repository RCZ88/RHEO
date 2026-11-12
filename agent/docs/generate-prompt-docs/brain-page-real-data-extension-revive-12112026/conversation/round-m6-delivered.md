# Round M6 delivered + R1–R5 answered (2026-11-12)

- RESULT-M6.md received (1,120 lines), saved verbatim. Covers WP-A safety (F1 MCP default-deny, F2 chat-history data loss, F3 crash), WP-B privacy (F4/F5/F8), WP-C signals engine, WP-D embeddings v2, WP-E brain context + chat + MCP, WP-F backfill reconcile (D2: extend contextBackfill.ts, don't replace), WP-G UI slim.
- **NOT complete:** D6 conflict unresolved — Round-2 M5 says no 3D; a different Claude chat produced `RESULT_PART2_3D.md` (2D/3D toggle), never delivered here. CZ must decide + deliver that file if he wants the toggle.
- **Gated on CZ's section-7 confirm list (R-1..R-7 + D6):** A1, A2, R-2, R-3 replace, R-4, R-5, R-7, WP-F real run, WP-G2.
- **Done this cycle:** CONTEXT-R1R5.md assembled (1,330 lines) — all five REQUESTs full source + PRAGMA results; ready for next Claude session. A3 crash hotfix applied: `ContextGraphView.tsx` now imports `TYPE_COLORS` from `./context-graph/types` (was ReferenceError on render). Scoped tsc + esbuild clean. Full replace (R-3) still pending CZ.
- Also not covered by RESULT-M6 (§5): forget/delete, enrichment UI toggle + "Context used" disclosure, extension persistent reinstall (M3 unchanged, needs manual reinstall by CZ).
- Copy commands: R1–R5 answers = `prompt-copy agent/docs/generate-prompt-docs/brain-page-real-data-extension-revive-12112026/CONTEXT-R1R5.md`
- Handoff doc for fresh sessions: `prompt-copy get brain-session-handoff-12112026` (ID 50; append a pointer to this file).

# Context Gaps — halo-handoff-vs-figma

| # | Context | Status | Location | How to obtain |
|---|---|---|---|---|
| 1 | Handoff §4 vs Figma expanded instance heights | ✅ Have | inline in INITIAL_PROMPT | — |
| 2 | Handoff §4 padding + row height vs code | ✅ Have | inline | — |
| 3 | Handoff §10 vs spec §64 motion | ✅ Have | inline, both verbatim | — |
| 4 | Handoff §6 kind list vs curation 8 promoted kinds | ✅ Have | inline | — |
| 5 | Handoff §7 window size vs spec §9 canvas | ✅ Have | inline | — |
| 6 | `text/muted` contrast fix | ✅ Have | inline | — |
| 7 | Verified-correct items (palette, radii, type, `page/focus`, 182/198/227) | ✅ Have | inline | — |
| 8 | **Full Figma node dump** | ⚠️ **Wiped** | was `/tmp/opencode/figma.json`, now gone | **Re-fetch with `FIGMA_API_KEY`.** Recipe in `AGENTS.md` §9a. File key `2PQLHEUjBBvyajmbS4DdMr`, boards `9:124 / 9:304 / 9:692 / 9:693 / 9:782 / 9:790`, component sets `7:930 / 7:931 / 7:1206 / 7:1207`. |
| 9 | Exact pixel geometry inside `page/focus` | ⚠️ Partial | transcribed into `FocusPageRow.tsx` | Ask if you need a node re-read; I can fetch `9:304` |
| 10 | Why the island was dead (preload) | ✅ Have | inline | — |

## Rule

If a gap exists the prompt must say so — it does, in the prompt's "Context you do NOT need"
section and here. **If Claude asks for the node dump, fetch it before answering.** Do not
reconstruct node values from memory: an earlier session measured a pill as 232px from an
exported image when the file said 198, and that error survived four days.

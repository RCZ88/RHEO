# Context Gaps — External Grid Sizing Complaint (Case 2)

## Unknowns the Specialist might need

| # | Gap | Where it would come from | Current status |
|---|---|---|---|
| 1 | A screenshot of the rendered grid showing the squashed cards + oversized hero | User's machine (CZ relays) | NOT AVAILABLE — Specialist must ask; Owner requests via CZ |
| 2 | Real data distribution (how many activities, what durations) for the user's actual week | ExternalPage in the running app / DB `external_sessions` | NOT GATHERED — can be fetched on demand via IPC if Specialist needs a realistic sample |
| 3 | Exact `ExternalStats` full shape (all fields) | `src/types/external.ts` | PARTIAL — only `byActivity` excerpt embedded; full file available on request |
| 4 | Whether ExternalPage shows any other grid consumers of `computeActivityGridLayout` | grep over `src/` | Owner checked: only `ActivityMosaic` consumes it (single consumer) |
| 5 | Design-token conventions for a new control (Range/segmented) — e.g. existing slider component in repo | `src/components/ui/` (shadcn slider installed?) | NOT CHECKED — Owner will verify before implementing the hierarchy control |
| 6 | Whether the "compact row" (sleep/no-time) should also become proportional | RESULT.md v2 decision | OPEN — Specialist decision |

## Constraints (do not re-litigate)

- Treemap packing (`squarifyTreemap` + exact-thickness rows + grid-track emission) is verified correct — mixed rows form properly. Weight model is the defect, not the packer.
- `visualWeight = log1p(seconds)` must stay (spec line 30: NEVER raw hours).
- Files are CRLF; preserve line endings; no mass reformat.
- Frontend-only scope for this fix; no DB/main-process changes expected.
- The old pre-redesign sizing is NOT a reference — the user rejected the uniform grid previously ("too uniform because it caps spans").

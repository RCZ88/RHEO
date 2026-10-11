# Precedent Selection — by shape, not domain

## The rule
A precedent must match the SHAPE of the thing being built. Domain match alone has shipped an
opaque black rectangle over a user's screen: `transparent: !isLinux` was taken from a FULLSCREEN
overlay and applied to a small panel; the correct precedent (the dictation panel,
`transparent: true`, proven on the same machine) sat deleted nearby.

## Shape dimensions — a precedent must match all that apply
| Dimension        | Ask                                  | Failure when ignored                        |
|------------------|--------------------------------------|---------------------------------------------|
| Mount shape      | fullscreen overlay? small panel? page? chrome? | transparency/window flags differ by shape |
| Lifecycle timing | before app-ready? at mount? per-frame? | env vars set after init are silent no-ops |
| Data shape       | stream vs snapshot; duration vs instant | wrong re-render and cleanup model        |
| Platform layer   | Electron main / preload / renderer / web | flags and APIs differ per layer           |
| Machine proof    | ran on THIS machine?                 | "works on Linux" ≠ works here              |

## Procedure
1. Candidates by domain:
   grep -rln "<keyword>" src/ --include="*.tsx" --include="*.ts"
2. Fill the shape table for each candidate. Keep the closest on ALL dimensions.
3. Record BOTH halves (mandatory):
   `Precedent: <path:lines> — chosen because <dims>; rejected: <path> (<dim> differs).`
   The rejection half is what stops the next agent from repeating the fullscreen-overlay mistake.

## Worked cases (this repo)
- Small-panel transparency → the dictation panel (small panel, same machine), NOT the
  fullscreen overlay.
- Electron env var → the earliest pre-ready code path, NOT "somewhere in main.ts".
- Ring / radial progress → src/pages/dashboard/StatusBand.tsx:338-372 (in-repo production
  code), NOT the registry's `ring-chart`.

## Registry / MCP hit triage
"Call the MCP" is not an instruction. Measured: a radial-progress query returned FlipCards;
a `progress` query buried `ring-chart` at result positions 6–10. Judge every hit:
1. **Relevance** — does it actually implement the need, or is it the nearest noise?
2. **Dependency weight** — what does it drag in? (`ring-chart` pulls `@visx/group`,
   `@visx/responsive`, `@visx/shape`, `@number-flow/react`.)
3. **In-repo precedent** — production code in this repo outranks a registry hit (the StatusBand
   ring was ported, not pulled, for exactly this reason).
4. **Fit with design/design.md** — tokens not raw hex (§7), radii ≤ 12px (§4), duration easing
   not springs (§6/§7.4), no new signal hue (§2).
Declining the hit and adapting in-repo code is the PREFERRED outcome whenever 3 or 4 fails.

# Round 02 — what shipped on the website (2026-10-14)

## Where this goes
Handed to the Architect (Notion AI) as round 2 of the landing-page overhaul.
Authoritative source files (read with `prompt-copy landing/src/components/rheo/<File>.tsx`):

- `Hero.tsx` — right half now renders a real unretouched screen (`app-dashboard.png`)
- `Gallery.tsx` — the ASCII seam + `AsciiSurface` import + `ASCII_SOURCE` const
  retired; section keeps 17 screens and is now the single owner of captures
- `Download.tsx` — inner column widened from a floating 760 px island to the
  shared 1280 gutter, inner content stays 760 px centered
- `ActUnderstand.tsx` — console scenarios labelled `EXAMPLE` in the panel label
  (chat answers are hand-authored, not query output — see note below)
- `Ledger.tsx` — untouched; content unchanged, but two claims are under audit
  (see below)

## Boring rhythm fixes actually applied
- Section padding: `py-24 sm:py-32` normalized on Gallery / ActUnderstand / Download
  (Download previously `py-28 sm:py-36`).
- Single `max-w-[1280px] px-5 sm:px-10 lg:px-16` container across all sections;
  removed two rogue `max-w-[760px] / 620 px` island documents.
- Cursor blink suppressed under `[data-motion="off"]` (both styling paths).

## Open requests for the Architect
1. **Ledger security/privacy claim audit** — the external reviewer correctly
   pointed out the backing text is not proof:
   - "0 bytes leave your machine" — backed by "no network call in the renderer",
     which excludes the main process (which owns license checks, updater, AI
     provider, sync relay). Answer needed: what does the AI Assistant send, and to
     whom (local model vs cloud API)? List every main-process network call.
   - "0 telemetry events, ever" — explain why but lacks enforcement; drop the "ever"
   - "1 SQLite file is your entire history" — verify no WAL sidecar / JSON
     sources / generated views
   - the three "how" lines are design claims until a binary ships
2. **Console copy** — answers in `SCENARIOS` are illustrative; page now says
   `EXAMPLE`, section label should follow with "Example answers".
3. **`#download`** — proof-first + small honest ask agreed.

## Next needed (required to make the site spec not wall-of-text)
- Real product facts: DB schema, phase-detection logic, AI citation/receipt rules,
  LCP timing, per-section height bounds. Export from `src/` (not invented).
- A generated visual map of the site — component per file, route, measure. I can
  derive it from `src/pages/registry/manifests.ts` and the per-section source;
  want this as a typed MD so it cannot drift.

## What dropped
- AFK rework thread — explicitly out of scope this cycle.
- ASCII seam / sliders — removed, rejected by design per the spec's rule.
- All fake readouts (1,204,032 s counter, 10,000 happy users) — still banished.

## How to copy this to the Architect
```
prompt-copy get landing-overhaul-pro   # 34 k bytes · bundles round-02 + context
```
Or directly:
```
prompt-copy agent/docs/backandfourth-docs/landing-overhaul-pro/conversation/round-02.md
```
<!-- SESSION: opencode-landing-rev2-20261112 -->
<!-- AGENT: opencode | TERMINAL: relay | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-landing-rev2-20261112

> **STATUS:** working | **UPDATED:** 2026-11-14T03:55:00Z

---

## CURRENT CYCLE (8)
**ROLE:** Implement GLM round-07 rev-3 vault driver + round-06 sign-offs in `Download.tsx`; commit; await deploy for live verification.
**STATUS:** working
**IN FLIGHT:**
- Awaiting the next Netlify deploy (git-based: commit → auto-build; §0-0 untouched). Then live-verify with the CDP probe: both narratives + tour with the figure INITIALLY OFF-SCREEN — expect scrollIntoView → fresh `dial NN` read → open at `dial 40` → exactly 3 `path.sil.hi`; repeat under reduced motion; confirm GAP4 + round-06 selection unchanged.
- Round-08 report package to GLM after live verification (same folder convention, `prompt-copy <slug>`).
**COMPLETED:**
- GLM round-07 spec (Downloads/RESULT(10).md) implemented in full: V1 face-space orbit rf=25 via replicated `Cam(45,0.5,1.5)+fit(200,166)` `makeFaceMap`, `DEG_PER_UNIT=3.6`, sweep 50×25ms wall-clock, cubic ease-out to raw 41 (V2 no creep); V3 readiness gate (scrollIntoView + visibility poll + fresh-read wait ≤1.2s, no blind 400ms; coast/rest normalization kept ≤2.5s); V4 grid; V5 `probeDial` fails loudly (no silent 30) and callers abort the narrative (caption cleared, lock released, no crossfade/GAP4/switch); V6.1 crossfade cell min-height 444; V6.7 layers read default rewrite; V6.8 hint rewrite; V6.2–V6.6 confirmed already shipped (two-rAF bridge; fan `(i−1.5)*extra` rest ±6.24→open ±21 exact; 0.55 dimming plates+connections; glyphs untouched).
- Vault stage now dispatches via NEW `vaultDispatch` (KX=width/400, KY=height/320 — the validated reference's two scales); panel GAP4 keeps `dispatchPointer` single-scale (unchanged).
- Scoped checks: esbuild bundle OK; scoped tsc via temp tsconfig (files: next-env.d.ts + Download.tsx) exit 0. Static checklist clean: no 4.68/UNITS_PER_STEP/vShape/posAt/DIAL_CENTER/R_MIN/R_MAX/`return 30`; 3.6/rf=25/50×25/makeFaceMap/loud-failure/path.sil.hi present.
**NEXT ACTION:** On next deploy: probe live-verify rev-3 (both directions + tour + reduced motion), then create the round-08 package and commit it. `agent/MEMORY.md` hairline entry stays UNCOMMITTED (shared file carries other agents' uncommitted entries — attribution rule).
**NOTES:** Landing deploys from main automatically; no local build. `assertVaultOpens` unchanged (dev-only, `path.sil.hi===3` within 600ms). Old rev-2 symbols fully removed.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 6 — 2026-11-12
**ROLE:** Implement GLM round-05 rev-2 on the landing vault driver + report back.
**STATUS:** completed
**COMPLETED:** Rev-2 shipped (`d9224f0`): dispatch retargeted to the figure's own `[data-hairline="vault"]` stage; adaptive lap per GLM's measured reference; `assertVaultOpens` dev assert; sync crossfade; `narr`/`readRef` split. Round-06 package (`2a5fdfe`). Deploy confirmed live.
**NEXT ACTION:** (superseded)

### Cycle 7 — 2026-11-13
**ROLE:** Live runtime verification of deployed rev-2 + root-cause the vault + Netlify playbook audit.
**STATUS:** completed
**COMPLETED:** LAYERS tab verified LIVE (ALL PASS: plates/aria-pressed, fan 66.2→76.0px/gap exact, selection+clear, CONNECTIONS control). VAULT root-caused (probe + hairline@0.5.1 dist + sim): IO-gated tick (off-screen dispatches integrate nothing; deferred coast flung dial 30→77→90), real gear 3.6°/unit not the shipped 4.68, stage-space orbit maps to a face ellipse r 19.6–37.8, dial coasts after pointerup (+67u measured) — rev-2 lap a coin flip opening late. Fix VALIDATED LIVE: face-space rf=25, ease-out to raw 41 → `"dial 40 · open"`, `path.sil.hi`×3 stable 2.4s. Round-07 package created. Netlify playbook answered: never applied; config already playbook-shaped; improvements offered (analytics dashboard, /_next/static/* immutable, Permissions-Policy, optional Lighthouse).
**NEXT ACTION:** (superseded by cycle 8)

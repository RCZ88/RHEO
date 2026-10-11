# AUDIT — RESULT.md coverage check, implementation plan, backend verification

> Companion to `RESULT.md`. RESULT.md itself is stored raw and untouched (skill Rule 1).
> This document is the mandatory Phase 1 (completeness), Phase 3 (implementation plan)
> and Phase 4 (backend verification) output, plus the corrections that must be applied
> before any of it is implemented.

---

## PART 1 — Recursive completeness check (skill Phase 1)

| PROMPT requirement | Covered? | Where / gap |
|---|---|---|
| Phase 0 — research with **sources** | ⚠ partial | §1.1–1.4 has substance, but every citation is `【turn0searchN】`, a non-resolvable placeholder. No URLs, no paper/journal names. |
| Phase 0 — "metaphors considered and rejected" table | ✅ | §1.1, 8 metaphors with verdicts |
| Phase 0 — named precedents | ✅ | NASA Eyes, GPM, Psyche, Observable, Stardust.js |
| Phase 0 — instancing / picking / labels research | ✅ | §1.3 |
| Phase 0 — reduced motion + accessibility | ✅ | §1.4 |
| Phase 0 — colour systems for magnitude, both themes | ⚠ partial | §1.4 names Viridis/Cividis; §3.1 then hardcodes hexes and never uses them |
| Phase 1 — one clock | ✅ (but see BLOCKER-1) | §6.1 |
| Phase 1 — one table | ✅ | §6.2, choose raw `logs` |
| Phase 1 — **written verification procedure** | ✅ | §6.3 `verifyDataIntegrity()` |
| Phase 1 — honest empty / long-tail states | ✅ | §6.4 ("Others" bucket, dashed ring for partial day) |
| Phase 2 — primary question in 5 s | ✅ | §2.1 |
| Phase 2 — channel→meaning mapping table | ✅ | §2.1 |
| Phase 2 — survives greyscale / CVD / projector | ⚠ partial | asserted in §1.4, never specified per-channel |
| Phase 2 — legend + detail panel + readout | ⚠ partial | §3.4 label content only; legend and detail panel not specified |
| Phase 2 — light mode | ⚠ partial | §3.1 "Background #F8FAFC in light mode" — one line, no spec for how a space scene reads on white |
| Phase 3 — pixel-exact colour | ⚠ partial | §3.1, but the "tokens" are **guessed hexes** (BLOCKER-4) |
| Phase 3 — camera | ✅ | §3.2 `[0,150,250]`, FOV 50, near/far, min/max distance |
| Phase 3 — geometry, world units | ❌ **GAP** | §3.2 gives ring radii and object sizes but **no angular placement, no arc-length budget, no overlap rule**. 15-unit objects on a 40-unit-radius ring collide. The single largest unaddressed layout risk. |
| Phase 3 — materials | ⚠ partial | §3.3, incompatible with §3.1's per-instance opacity (BLOCKER-2) |
| Phase 3 — postprocessing per perfMode | ✅ | §3.3, three explicit chains |
| Phase 3 — all four states with real copy | ✅ | §3.5 |
| Phase 4 — liveliness level justified | ✅ | §4.1 "Measured" |
| Phase 4 — every animation with curve + duration | ✅ | §4.2 table |
| Phase 4 — replace-or-keep the bespoke Bezier | ✅ | §4.3, replaces it |
| Phase 4 — reduced-motion fallback | ✅ | §4.4 |
| Phase 4 — frame budget | ⚠ partial | §4.5 budgets 20 ms and calls it "50 FPS target" while §4.5 also targets 60 fps |
| Phase 5 — full input map | ✅ | §5.1 |
| Phase 5 — search/filter | ✅ | §5.2 |
| Phase 5 — keyboard + focus | ✅ | §5.3 |
| Phase 5 — screen-reader equivalent | ✅ | §5.4 |
| Phase 5 — compact/inline variant | ✅ | §5.5 |
| Phase 6 — file-by-file | ✅ | §7.1 |
| Phase 6 — duplicate-name resolution | ✅ | §7.2 (owns Starfield; deletes the other four) |
| Phase 6 — single config source | ❌ **GAP** | §7.1 mentions `OrbitSystem.tsx` "update" but never says to delete the dead second `ORBIT_CONFIG`/palette set that caused the 2000× speed discrepancy |
| Phase 6 — texture lifecycle | ✅ | §7.4 |
| Phase 6 — instancing plan + rollback | ✅ | §7.3 |
| Phase 6 — backend gap table | ✅ | §7.5 + §8 (duplicated) |
| Phase 6 — staged rollout, each stage verifiable alone | ⚠ partial | §7.6 gives 5 stages over **10 weeks**, but no per-stage verification |
| Phase 7 — 3 strongest arguments against own design | ✅ | §9 |
| Removals listed separately | ✅ | §10 |

**Coverage: 33 full, 12 partial, 3 gaps.** Not 100%. The three gaps are load-bearing
(geometry collision, config duplication, verification-per-stage), so the loop has **not**
closed. Per skill Phase 1, a `GAPS.md` follow-up prompt is owed before implementation.

---

## PART 2 — BLOCKERS: things that are wrong and would cause real bugs

These are not style objections. Each one is verified against this repo.

### BLOCKER-1 — §6.1's migration SQL cannot run and would corrupt the aggregates

Verified against the live schema:

```
logs columns:      id timestamp app category duration_ms title project keystrokes clicks
                   window_switches url domain tab_id is_browser_tracking profile_id
                   browser_name platform source
stats_daily cols:  id date app_name app_type category total_seconds session_count platform
triggers on logs:  trg_update_daily, trg_update_hourly
```

RESULT's trigger:
```sql
INSERT OR REPLACE INTO stats_daily (date, app, category, seconds) VALUES (
  DATE(NEW.timestamp, 'localtime'), NEW.app, NEW.category, NEW.duration);
```

1. **`NEW.duration` does not exist.** `logs` has `duration_ms`. Every write is NULL.
2. **`stats_daily` has no `app` and no `seconds` column.** It has `app_name` and
   `total_seconds`, plus `app_type`, `session_count`, `platform`. The INSERT fails on two
   columns.
3. **It ignores both existing triggers.** `trg_update_daily` and `trg_update_hourly` already
   maintain these tables with session counting and hourly buckets. A third trigger writing
   the same rows double-counts or conflicts.
4. **`'localtime'` is evaluated at write time against the machine's current TZ**, so rows
   written under different TZ settings land in different buckets — and the **30 000+
   historical rows are not re-bucketed at all**, so the table becomes *more* internally
   inconsistent, not less.
5. Claimed cost "4–6 hours, risk: low" is wrong; this is a data-integrity change to the
   table every dashboard widget reads.

**Correct shape of the fix** (needs CZ's decision — see PART 5): either
(a) a one-off **rebuild** of `stats_daily`/`stats_hourly` from `logs` using an explicit
fixed offset, keeping the existing triggers; or (b) leave the tables alone and have the
solar system read `logs` directly, which §6.2 already argues for anyway. (b) touches no
schema.

### BLOCKER-2 — §7.3's instancing code is invalid three.js, and the shader kills lighting

```js
planetMesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(maxPlanets*16), 16);
```
`InstancedMesh` **owns** `instanceMatrix` and maintains it via `setMatrixAt()`;
`instanceColor` via `setColorAt()`. Reassigning the attribute with a raw float array
bypasses every internal bookkeeping path (bounding sphere, frustum culling, morph state)
and the renderer will read garbage. The idiomatic form is `mesh.setMatrixAt(i, m)` and
`mesh.setColorAt(i, c)` plus `instanceMatrix.needsUpdate = true`.

The shader:
```glsl
varying float vOpacity;
void main() { vOpacity = instanceOpacity; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }
```
- It **never writes `gl_FragColor`/`vOpacity`**, so `vOpacity` is dead.
- It **drops `normal` and `normalMatrix` entirely**, so `MeshStandardMaterial` has no
  normals and lighting collapses — the planets render flat.
- `MeshStandardMaterial` has **no per-instance opacity** channel. §3.1 requires
  "opacity based on time magnitude (0.3–1.0)". That needs `onBeforeCompile` or a custom
  material, which RESULT never wires up.

### BLOCKER-3 — §4.2's `backOut` violates the house motion rule

"**App entry** · 500ms · `backOut`" overshoots and springs back. The bundle's constraint §5.4
and `design/design.md` both **ban spring overshoot on app surfaces**. Must become an eased
curve. (Ironically RESULT §4.3 correctly replaces the bespoke three-phase Bezier with
`easeInOutQuad`/`easeOutQuad` — and then immediately reintroduces overshoot via `backOut`.)

### BLOCKER-4 — §3.1's "DeskFlow tokens" are invented hexes

`--page-accent: #3B82F6`, `--bg-primary: #0F0F10` etc. are presented as existing tokens.
They are not read from anywhere; page accents are set per `[data-page="…"]` and the
dashboard's own hue is **not** blue (the Life page is CLAY `#e8866b`). Hardcoding hex also
violates anti-slop #1 ("no raw hex left in a component"). Every colour must resolve from
`var(--…)` at render time.

### BLOCKER-5 — §3.2's "depth layers = time period" is structurally impossible

"Depth (z-axis) represents time period — 4 layers: today / week / month / all" assumes all
four periods exist as data simultaneously. The IPC takes **one** period per call
(`get-dashboard-aggregates({ period, dateOffset })`), so this needs 4 fetches and 4× the
payload to render a comparison the user did not ask for. Worse, **z-depth does not compare
magnitudes** — a bigger sphere further away can look smaller. It encodes ordinal depth with
a channel that implies distance. Period is a *filter*; it belongs in the control, not the
geometry.

### BLOCKER-6 — no angular placement or collision spec (the §2.1/§3.2 hole)

§2.1 assigns "position in ring = time allocation rank". §3.2 gives ring radii (40–200) and
object sizes (2–15 units) but never says how many objects share a ring or how their angles
are spaced. With 9 categories and up to 80 apps, a 15-unit object on a 40-unit-radius ring
occupies ~43° of arc. **The layout is undefined and will overlap.** This is the one gap
that would make the redesign look *worse* than the thing it replaces.

---

## PART 3 — Implementation plan (Phase 3), staged so each stage stands alone

Adapted from §7.6: ten weeks is not a plan I can execute or verify. Re-cut into four
stages, each independently shippable, each with a verification that does **not** require
rebuilding the app.

### STAGE 1 — Data integrity + honest aggregation  ✅ SAFE, IMPLEMENTED

No 3D changes, no deletions, no schema changes. Pure functions + DOM.

- **New** `src/components/orbit/dataIntegrity.ts`
  - `localDayKey(ts)` — one clock, local, no `toISOString()`.
  - `reconcile(solarRows, logRows, toleranceSec)` — RESULT §6.3's verification procedure,
    as a **pure** function that returns `{ totalMatch, perApp[], worst }` so it can be run
    from a probe, a test, or a dev button.
  - `aggregateForVisualization(logs, opts)` — group by app, sum seconds, count sessions,
    and **keep the long tail**: returns `{ planets, others: { seconds, sessions, count } }`
    instead of silently discarding everything under the threshold (RESULT §6.4).
  - `bucketByLocalDay(logs)` — for reconciling against `stats_daily`.
- **Verification:** numeric probe against the live DB. No browser needed.

### STAGE 2 — Honest states + accessible mirror  ✅ SAFE, NEXT

Additive only; touches no existing file's exports.
- Accessible data table + `aria-live` region (RESULT §5.4) beside the canvas.
- Real empty / error / partial-long-tail copy (RESULT §3.5 + §6.4) reusing the existing
  register from `OrbitSystem.tsx:193-205`.

### STAGE 3 — Palette + encoding correctness  ⚠ NEEDS A TOKEN DECISION

Switch planet colour from 12 arbitrary category-family hues to **tier** hue with magnitude
as opacity/size — the change that makes the view obey the house rule "colour means tier,
never identity". Requires deciding how tier is resolved in the solar system
(`categoryOverrides` + `deskflow-tier-assignments` already exist). Touches
`PlanetUtils.getCategoryColorLocal` and the sun configs.

### STAGE 4 — The metaphor swap + instancing  ⛔ BLOCKED

§7's orbital disc, `InstancedMesh`, the 4 file deletions, the depth layers. Requires:
1. BLOCKER-1..6 answered,
2. CZ's explicit approval of the removals (skill Rule 3),
3. a way to **see** the result — which I do not currently have.

---

## PART 4 — Backend verification (Phase 4)

| Feature | IPC | Handler | Service | DB | Status |
|---|---|---|---|---|---|
| Per-app time, per period | `get-dashboard-aggregates` (`preload.ts:212`) | `main.ts:24970` | inline SQL | `stats_daily`, `stats_hourly` | ✅ real, ⚠ **UTC-bucketed** |
| Raw per-session logs | `get-logs` | `main.ts:6623` → `getLogs()` `:4881` | inline | `logs` (33 k rows, `duration_ms`, local-time-safe) | ✅ real |
| Session counts per app | derive from `get-logs` | — | — | `logs` | ✅ available, not currently sent |
| Hourly patterns | `stats_hourly` **exists** | same handler | — | `stats_hourly` (4 086 rows) | ✅ **exists** — RESULT §7.5/§8 says "❌ Missing, add a table". **Wrong.** |
| Tier assignments | none | — | — | `localStorage['deskflow-tier-assignments']` | ✅ real, renderer-only |
| App relationships / transitions | — | — | — | `logs.window_switches` exists | ⚠ partial, unused |
| Tier assignment **history** | — | — | — | — | ❌ genuinely missing |
| `get-logs` limit | `SELECT * FROM logs ORDER BY id DESC LIMIT 100000` | `:4881` | — | — | ⚠ newest-first; any `slice(-N)` keeps the **oldest** rows |

**Correction to RESULT §7.5/§8:** hourly data is **not** a backend gap. `stats_hourly`
exists with `date, hour, app_name, app_type, category, total_seconds, session_count` and
is already returned as `hourlyData` by the same handler. Two real gaps remain: tier
*history*, and app-transition edges.

---

## PART 5 — Decisions required from CZ before Stage 3/4

1. **Removals (skill Rule 3, mandatory).** RESULT §10 asks to delete `Planet.tsx`,
   `Ring.tsx`, `GalaxyDust.tsx`, `Moon.tsx` and replace the metaphor. Confirm or decline.
   Per skill Rule 4 I will create timestamped `.bak` copies before any removal.
2. **Data clock.** Option (a) rebuild `stats_daily`/`stats_hourly` with a fixed offset, or
   option (b) have the solar system read `logs` and leave the schema alone. **(b) touches
   no schema and is what RESULT §6.2 already recommends** — I recommend (b).
3. **Depth layers.** Keep or drop the z-axis period idea (BLOCKER-5)?
4. **Verification.** Do you want the app launched with `--remote-debugging-port=9222` so I
   can actually look at the canvas? Without it I can verify pure logic but **not a single
   pixel of 3D**, and I will not report PASS on work I cannot see.
# Skill Design: `prove-it` — the Claim Gate

## 0. Decision, subject agreement, and collision analysis

**I agree with the recommended subject.** The ten defects in bundle §5 share one property: none is a coding error. Every one is a gap between *a check passing* and *the thing working*, discovered only after it reached a user or a report. A skill that fires at the moment of **claiming** — not at the moment of coding, not at the moment of debugging — is the only place that gap can be closed, because it is the only moment through which every one of the ten defects passed.

**Chosen identity:**

| Field | Value |
|---|---|
| `id` | `prove-it` |
| `name` | `PROVE — Claim Gate & Runtime Verification` |
| `category` | `debugging` |
| Directory | `agent/skills/prove-it/` |
| Version | `1.0.0` |

**Collision analysis (Requirement 9):**

| Existing skill | Overlap | Disposition |
|---|---|---|
| `fix-problems-recursive` | Largest overlap — it governs the fix loop; PROVE governs the claim after the fix. | **Extend it? No — separate skill, justified three ways.** (1) Its load-point is "something is broken"; defects #1, #2, #3 occurred in *feature/build* flows where nothing was yet broken — burying the gate inside a debugging skill keeps it out of the build path exactly where the failures happened. (2) Its artifact is a fix; PROVE's artifact is a verdict with quoted evidence — different output, different trigger surface (claim verbs). (3) It was present all session and the ten defects still shipped. PROVE `requires:` it and defers all cause-finding to it: complementary, not duplicate. |
| `paint` | PAINT terminates in a user-facing claim. | No content overlap — PROVE says nothing about how anything looks; PAINT certifies nothing about whether anything runs. Integration is structural: PROVE becomes PAINT's terminal pipeline stage via `requires:` (see §3 of the diff below). |
| `impeccable`, `frontend-design`, `humancentred-UIUX`, `motion-alive`, `animation-stack` | Design-content skills. | No overlap. PROVE's only contact with design is *running* `design/design.md` §7 greps as evidence and *citing* its precedence order — rules it cites, never rewrites. |
| `multi-agent-coordination` | Process hygiene (PIDs, teardown, claims). | Resolved by **deference, not duplication**: PROVE §1 cites AGENTS §0.6/§0a and names multi-agent-coordination as the source of truth for process rules; `requires:` lists it. |
| `generate-prompt` | None (prompt authoring). | No interaction. |
| `commit` | Adjacent — PROVE supplies commit's evidence. | No edit required this cycle; the handoff rule lives in PROVE §5 ("a commit message may not say *fixes* without a PROVE verdict"). |

---

## 1. The complete `SKILL.md`

```markdown
---
id: prove-it
name: PROVE — Claim Gate & Runtime Verification
version: 1.0.0
category: debugging
description: >-
  THE gate between "a check passed" and "the thing works". Compile-clean, type-clean, and
  probe-green prove NOTHING about mounting, data, or what is actually running. Load BEFORE
  claiming any fix, feature, wiring, or setting is live. Use whenever the task involves:
  saying or writing FIXED / works / connected / wired / verified / done / shipped / live;
  delivering a new component, page, route, hook, store binding, IPC handler, env var, or
  settings toggle; wiring a timer, sensor, probe, or MCP value into UI; copying a pattern or
  precedent from another file or from a registry; running or reporting tsc / esbuild /
  probe / Playwright results; removing or replacing an existing surface; re-testing after
  HMR or a CZ build. Enforces mount-proof, fixture honesty, precedent-by-shape,
  artifact-freshness, and process teardown before any VERDICT is written. Not for deciding
  what to build or how it should look.
metadata:
  role: debugging
  visibility: computer
  role_note: >-
    PROVE is the terminal gate, not a debugger. fix-problems-recursive finds the cause; PAINT
    builds the surface; both load PROVE before anyone claims the result works. skill-router's
    DEBUGGING category points here, and the router must ALSO fire PROVE on claim verbs
    (fixed/works/connected/wired/verified/done) regardless of category.
requires:
  - fix-problems-recursive
  - multi-agent-coordination
---

# PROVE — Claim Gate

> PAINT builds it. fix-problems-recursive finds it. PROVE is what you load before you say it works.

## §0 THE GAP THIS CLOSES

This repo's gates — scoped `tsc`, `esbuild`, probes, Playwright — prove that code *compiles*,
*bundles*, and *passes assertions*. All of them stayed green this session across ten separate
defects where the thing did not work:

- code that compiled clean and mounted nothing (routers with zero publishers, components with zero importers);
- "connected" claims backed by `null` inputs and plausible hardcoded numbers;
- fixes reported as done against a running artifact that predated the fix;
- precedents borrowed by domain from a different **shape** (fullscreen overlay → small panel);
- platform settings assigned after the platform had already chosen;
- script patches that printed success and corrupted the file;
- environmental failures (IPv6/IPv4 mismatch, HMR mid-run, `pkill` self-match) misread as app bugs.

None of these is a coding error. Every one is a gap between **a check passing** and **the thing
working**. PROVE closes that gap at the only moment it can be closed: before the claim.

## §1 HARD RULES (AGENTS.md — PROVE never contradicts, only defers)

1. **Never run a build.** CZ builds. `dist/` and `dist-electron/` ARE the running application.
   PROVE proves against the dev server (`npm run dev`, PID recorded at spawn) or asks CZ. It
   never runs `npm run build`, never touches `dist/`, never sets `RHEO_CZ_OVERRIDE`.
2. **Zero destruction.** No `git checkout` / `restore` / `reset --hard` / `clean -fd`. A bad
   hunk is fixed by hand. Back up physically before replacing a file wholesale.
3. **Process discipline** (source of truth: AGENTS §0.6 + `multi-agent-coordination`).
   Every `probe_open` gets a `probe_close`. Kill only PIDs you recorded, with `kill <pid>`;
   match PIDs with `awk`. **Never `pkill -f "<pattern>"`** — the pattern is in your own
   command line and kills your own shell.
4. **Scope.** Typecheck and grep only your claimed files. Repo-wide error counts are noise
   (~7,700 pre-existing `tsc` errors). Files-based tsconfigs only; never `include: ["src"]`.
5. **Claim before edit.** `coord.mjs register → status → claim`. A DENIED claim is a hard stop.

## §2 THE PROCEDURE — ten steps, each independently checkable

Run Steps 1–2 before editing. Run 3–9 after each edit. Step 10 is the only place a claim may exist.

### STEP 1 — CLAIM SCOPE
```
node coord.mjs register
node coord.mjs status
node coord.mjs claim <files-you-will-touch>
```
**PASS WHEN:** `status` shows your claim on exactly those files. DENIED → stop; negotiate; do not edit.

### STEP 2 — PRECEDENT BY SHAPE, NOT DOMAIN
Before copying any pattern, list candidates by domain, then keep only those matching on **shape**:
mount shape (fullscreen overlay? small panel? page? chrome?), lifecycle timing (before app-ready?
at mount? per-frame?), data shape (stream vs snapshot; duration vs instant), platform layer
(Electron main / preload / renderer / web), and whether it is proven on THIS machine.
```
grep -rln "<domain keyword>" src/ --include="*.tsx" --include="*.ts"
```
Registry/MCP hits are candidates, not answers — triage per `references/precedents.md`
(relevance, dependency weight, in-repo production precedent). Declining a hit is a valid outcome.
**PASS WHEN:** your notes contain
`Precedent: <path:lines> — chosen because <shape dims>; rejected: <path> (<dim> differs).`
Both halves are mandatory; the rejection half is what stops the next agent from repeating the
fullscreen-overlay mistake.

### STEP 3 — EDIT, THEN RE-READ THE WOUND
Make the edit. Then, before any check:
```
git diff --stat
git diff -- <file>
```
Every hunk must be intended. If a script made the edit: **before** running it, record
`grep -c "<symbol>" <file>` for every top-level symbol (hooks, consts, functions, exports);
**after**, counts must be identical or changed exactly as intended. A patch that deletes a hook
and a module const while printing "success" is the file corrupting itself — it has happened.
**PASS WHEN:** diff contains only intended hunks; symbol counts verified.

### STEP 4 — SCOPED TYPECHECK
```
npx tsc -p tsconfig.halo.json
```
(or the files-based config covering your scope). **PASS WHEN:** exit 0, scoped config only.
Note: this is the *weakest* gate. `tsc` watched a `useRef` inside a `useEffect` and said CLEAN.
Necessary, never sufficient.

### STEP 5 — MOUNT GATE (ownership)
Prove the changed export is reachable from something that renders.
Hop 1 — find importers:
```
grep -rn "<ExportName>" src/ --include="*.tsx" --include="*.ts" | grep -v "<its own file>"
```
Hop *n* — repeat for each importer until the chain terminates at a **mount root**: the Vite
entry, a router registration, a page verified by `npm run validate:pages`, the Electron main
boot (pre-`app.ready`) for main-process code, or a provider's mount site in the entry tree.
Record every hop. A dead end — a link with zero importers that is not itself a root — means the
code is dead: **STOP and mount it before any further step.** Compile-clean zero-importer code is
this repo's most repeated failure shape (`SURFACES.md`: `WorkforcePanel`, `STTFloatingOverlay` —
"right code, zero effect").
DOM proof for page surfaces:
```
npm run validate:pages
```
**PASS WHEN:** recorded hop chain ends at a mount root AND `validate:pages` exits 0 — or the
change is provably non-DOM and the Step 6 probe imports it directly. Full method:
`references/mount-proof.md`.

### STEP 6 — RUNTIME GATE (proof by change class)
Pick the proof that watches the actual failure surface — templates in
`references/runtime-proof.md`:

| Change class | Required proof | Tool |
|---|---|---|
| module logic | printed numbers from a scoped probe | `npx esbuild agent/probes/<x>.probe.mts --bundle --platform=node --format=esm --outfile=/tmp/<x>.mjs && node /tmp/<x>.mjs` |
| DOM presence | `locator.count() ≥ 1` (removal: `=== 0`) | Playwright vs `npm run dev` |
| toggle / setting | **both states**: on → visible, off → absent; numeric settings assert a measured `boundingBox()` change; persisted settings re-assert after `page.reload()` | Playwright |
| animation | ≥ 1 **intermediate** frame between endpoints (an instant snap proves nothing); honour `prefers-reduced-motion` (design.md §6) | `halo-anim.mjs` pattern |
| React lifecycle / hooks | zero `pageerror` events (React error #321 killed the whole app with tsc+esbuild clean) | Playwright `page.on('pageerror')` |
| env / init placement | the **observed effect at the consumer**, never the assignment site | probe asserts effect |
| main ↔ renderer | value observed on the other side of the bridge | probe + Playwright |

**PASS WHEN:** a named artifact exists (probe stdout lines, assertion counts, frame counts)
and is quoted verbatim in your report. "It should work" is not an artifact.

### STEP 7 — FIXTURE HONESTY
Any stand-in for real data must be impossible to mistake for a measurement.
- **Code:** name it `FIXTURE_*` and give it a value that could not be real (wrong magnitude,
  sentinel), or badge it visibly in the UI (`SIM`). A plausible number is worse than a broken
  one — a hardcoded `3h47m` reading as a live stopwatch measurement is the canonical defect.
- **Report:** every number derived from a fixture gets its own line:
  `FIXTURE — <value> stands in for <real source>; not a measurement.`
- **Wiring words are claims:** "connected / consumes / receives" may appear ONLY if Step 6
  observed the value change with its source. Otherwise write the truth: "input is `null`;
  showing fixture."
**PASS WHEN:** `git diff | grep -n "FIXTURE_"` finds every placeholder in the change, and the
report contains one FIXTURE line per placeholder.

### STEP 8 — FRESHNESS GATE (the running artifact)
A correct fix inside a stale artifact is a false claim. Before reporting fixed:
1. Embed a distinctive marker in the changed lines (a `data-probe="<change-id>"` attribute or a
   dev-only string that `grep` finds and the DOM can expose).
2. Prove the **served module** contains it:
```
curl -s "http://127.0.0.1:<port>/src/<module-path>" | grep -c "<marker>"    # must be ≥ 1
```
   Use the same origin family your probe uses; if the connection fails, try
   `http://[::1]:<port>` before concluding anything (Chromium resolved `localhost` to IPv4
   while Vite bound `[::1]`, and it read as an app bug for 45 seconds).
3. In Playwright: `page.reload()`, then assert the marker is present in the DOM.
4. `dist/` claims: PROVE cannot verify dist — CZ builds it. Ask CZ, record the confirmation
   **verbatim** in the verdict. If two consecutive reports show the same marker or bundle hash,
   the running artifact predates the fix — say exactly that.
**PASS WHEN:** marker grep ≥ 1 after reload, OR CZ's build confirmation is quoted.

### STEP 9 — ENVIRONMENT DISCRIMINATION + TEARDOWN
If anything failed on the way here, name what you excluded before blaming app code:
- **origin family:** same host:port and IP family on both probe side and app side?
- **HMR:** was a source file edited while a Playwright run was mid-assertion? Re-run ONCE
  before diagnosing — HMR reloads between assertions make correct code "fail."
- **self-match:** did your kill pattern match your own shell? (`kill <pid>` only, ever.)
Teardown: `probe_close` count == `probe_open` count; every recorded PID killed with `kill <pid>`.
**PASS WHEN:** the triage line exists in the report (or no failure occurred), and teardown
counts match.

### STEP 10 — THE VERDICT
Write it per §3. No claim of any kind may exist anywhere upstream of this step.

## §3 THE VERDICT CONTRACT

**`VERDICT: PASS`** requires all of the following, quoted:
1. scoped `tsc` output (Step 4);
2. the mount chain, hop by hop (Step 5);
3. the runtime artifact: probe stdout / assertion counts / frame counts (Step 6);
4. every FIXTURE line (Step 7);
5. freshness proof: marker grep after reload, or CZ's confirmation verbatim (Step 8);
6. teardown confirmation (Step 9).

For UI-surface changes, also attach the design gate scoped to your files
(`design/design.md` §7):
```
git diff --name-only | xargs grep -nE "#[0-9a-fA-F]{3,8}"
```
Every survivor must be a token or pure black/white. Precedence for any conflict, because the
sub-skills disagree: `design/design.md` → live tokens in `src/index.css` → registry component
conventions → pipeline phase order → sub-skill guidance. (Worked cases: a spec-mandated spring
loses to §7.4's spring ban; a spec-mandated 24px radius loses to §4's 12px cap.)

**`VERDICT: NOT TESTED`** must name: the exact check not run; why (environment, permission,
waiting on CZ); and what would run it. Example of a valid one:
`NOT TESTED (runtime: no dev server; needs a recorded-PID npm run dev or CZ; agent/probes/halo-verify.mjs would cover it)`.
Silence is not a verdict.

**`VERDICT: PARTIAL`** — list which classes of proof passed and which did not.
**`VERDICT: BLOCKED-ON-CZ`** — dist-dependent claims awaiting build confirmation.

**Banned without quoted evidence:** *works, fixed, connected, wired, verified, done, shipped, live.*
Truthful replacements: "compiles; not yet run" · "mounted; value not observed" · "fixture, not
measurement" · "fix present in source; running artifact not yet confirmed."

## §4 WHEN NOT TO LOAD
- deciding **what** to build (spec / router's job);
- aesthetics judgement (PAINT + `design/design.md`);
- finding the cause of a failure (`fix-problems-recursive`) — PROVE loads when it's time to CLAIM.

## §5 RELATIONSHIPS
- **PAINT:** PROVE is PAINT's terminal pipeline stage. No PAINT flow reports done without a
  PROVE verdict. PROVE is category `debugging`, loaded by PAINT by explicit exception — logged
  in paint's conflict log per its §LAYER 3.
- **fix-problems-recursive:** finds causes; PROVE gates the claim that the cause is gone.
  PROVE `requires:` it; it does not edit it.
- **commit:** a PROVE verdict (any grade) is commit's evidence. A commit message may not say
  "fixes" without one.
- **multi-agent-coordination:** source of truth for all process rules (§1). No duplication.

## §6 SELF-MAINTENANCE
PROVE is a living document — same rule as PAINT and the Router: a stale gate certifies failures
as passes, which is worse than no gate. When a defect reaches a report or a running app:
1. add the discrimination step that would have caught it to the matching section;
2. bump `version:`;
3. if the trigger surfaces changed, sync `description` **and** `skill-router` in the same cycle.

## §7 REFERENCES (load on demand — do not load all by default)
- `references/mount-proof.md` — importer-chain method, mount roots, negative proofs, dead-code case files
- `references/runtime-proof.md` — proof templates per change class, probe skeleton, pageerror capture, patch-integrity re-read
- `references/precedents.md` — shape-dimension table, worked cases, registry-hit triage
- `references/environment-and-freshness.md` — origin families, HMR, stale artifacts, teardown hygiene
```

---

## 2. Reference files

### 2.1 `references/mount-proof.md`

```markdown
# Mount Proof — proving a component is reachable

## Why this exists
Compile-clean, type-clean, probe-green code with zero importers is the exact shape of dead code
this repo keeps producing. `SURFACES.md` records `WorkforcePanel` and `STTFloatingOverlay` as
"right code, zero effect". An activity router with two components and no publisher shipped the
same way this session. Nothing in the toolchain notices. This file is the check that notices.

## The importer-chain method
1. Name the export you changed or created (component, hook, provider, route, reducer).
2. Hop 1 — find who imports it:
   grep -rn "<ExportName>" src/ --include="*.tsx" --include="*.ts" | grep -v "<its own file>"
   Follow re-exports as hops too.
3. For each importer, repeat. You are building a chain:
   <your-file> → <importer1> → <importer2> → … → ROOT
4. Mount roots (the chain may terminate here, nowhere else):
   - the Vite entry — the module the HTML loads;
   - the router / route registration table;
   - any page verified by `npm run validate:pages` (a resolving data-section is machine-proof
     the page renders);
   - for Electron main-process code: the main boot path, before `app.ready`;
   - for context/providers: the provider's mount site in the entry tree.
5. Dead end = a chain link with zero importers that is not itself a root. STOP. Mount it or
   withdraw the claim. Never ship and "wire it later."

## Recording — the chain is evidence, quote it in the verdict
MOUNT: HaloIsland.tsx → StatusBandRegion.tsx → PageShell.tsx → [entry]        ✔
MOUNT: ActivityRouter.tsx → (no importers)                                   ✘ DEAD

## Negative proofs (removal / unmounting)
Proving absence is different from proving presence:
- `locator.count() === 0` after the change, AND
- `npm run validate:pages` still exits 0 for unrelated sections.
A removed component something still imports fails Step 4's typecheck — that is the cheap half;
the count() check is the half that proves the user-visible absence.

## Common shapes and their roots
| What you built            | Root it must reach                  | Machine check                     |
|---------------------------|-------------------------------------|-----------------------------------|
| page / route              | router registration                  | validate:pages                    |
| component                 | a mounted parent                    | Playwright locator count          |
| context / provider        | entry-tree mount site                | probe imports the entry module    |
| hook                      | a mounted component's body           | runtime probe / pageerror capture  |
| Electron main handler     | main boot before app.ready           | observed effect at the renderer   |
| settings toggle           | settings UI **and** the consumer     | both-state assertion (runtime-proof §3) |

## When validate:pages is the whole gate
If your change adds or moves a `data-section`, `npm run validate:pages` is the strongest single
check available: it fails when a declared section has no matching element. It proves mount for
page-level surfaces and nothing else — do not stretch it to panels or overlays; those need
locator counts.
```

### 2.2 `references/runtime-proof.md`

```markdown
# Runtime Proof — templates by change class

Rule of thumb: the proof must be the kind of thing that FAILS LOUDLY if the defect is present.
tsc and esbuild both watched a `useRef` inside a `useEffect` and reported CLEAN; only the
browser console said React #321. Choose the proof that watches the actual failure surface.

## 1. Module logic — the numbers probe
File: agent/probes/<name>.probe.mts. Zero deps. Import the units you changed, exercise them,
print numbers, assert by printing. A probe that prints `3` when the expected is visibly `4` is
honest; a probe that prints "OK" is not.
Run:
  npx esbuild agent/probes/<name>.probe.mts --bundle --platform=node --format=esm --outfile=/tmp/<name>.mjs && node /tmp/<name>.mjs
Skeleton (halo-core.probe.mts pattern — 33 assertions, 0 deps):
  const ok = (cond: boolean, msg: string) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } };
  // exercise the changed units…
  ok(result === expected, "<label>");
PASS: exit 0 AND every printed line matches expectation. Quote the lines in the verdict.

## 2. DOM presence — locator count
Against `npm run dev` (record the PID at spawn):
  const n = await page.locator('[data-section="halo-island"]').count();
  assert n >= 1 (presence) / n === 0 (removal).
Banned weak form: "the screenshot looks right." Strong form: count + attribute values.

## 3. Toggles and settings — both states, measured
A toggle proof has two assertions minimum: state A shows the surface, state B hides it. If the
setting persists, add a third: reload, assert the survived state.
Numeric settings (e.g. "halo island size") need a numeric assertion, not just existence:
  const box = await page.locator("<surface>").boundingBox();
  setSetting(size, A); reload; assert boundingBox().width  === expectedA;
  setSetting(size, B); reload; assert boundingBox().width  === expectedB;
A settings row that renders but drives nothing is defect #2 wearing a costume.

## 4. Animation — intermediate frames
Count positions BETWEEN endpoints over a window (halo-anim.mjs pattern). An instant snap yields
only endpoints and proves nothing animated. Honour `prefers-reduced-motion` (design/design.md §6):
run the frame-count proof with motion enabled; verify the reduced-motion path separately by
asserting the end state is still reached.

## 5. React lifecycle — pageerror capture
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // …interact…
  assert errors.length === 0;
This is the ONLY gate that catches misplaced hooks. React error #321 killed the entire app with
tsc and esbuild clean. Any change touching hooks, effects, or render order requires it.

## 6. Environment / init placement — assert the effect, not the assignment
`process.env.ELECTRON_OZONE_PLATFORM_HINT` assigned inside main.ts, long after Electron chose
its backend: no error, no warning, no log — the feature simply never worked. The proof lives at
the CONSUMER: assert the rendered/behavioural effect (window property, flag, platform log line),
never that the assignment executed. If you cannot observe the effect, you cannot claim the setting.

## 7. Patch integrity — re-read the wound (pairs with SKILL Step 3)
Before any scripted edit, for each top-level symbol (hooks, consts, functions, exports):
  grep -c "<symbol>" <file>      # record
After: identical counts, or changed exactly as intended. A Python slice once removed a duplicate
type AND a hook AND a module const, then printed success; the file only failed later at runtime
with a ReferenceError. Counts are cheap. Run them on every scripted edit, then read
`git diff -- <file>` hunk by hunk — every hunk intended, or fix by hand (never git restore).
```

### 2.3 `references/precedents.md`

```markdown
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
```

### 2.4 `references/environment-and-freshness.md`

```markdown
# Environment & Freshness — false alarms and stale artifacts

Four defects this session were environmental; each was initially read as an app bug.

## Origin family mismatch (the 45-second non-bug)
Vite bound `[::1]`; Chromium resolved `localhost` to IPv4. Navigation timed out and read as an
application failure. Before debugging the app:
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/
  curl -s -o /dev/null -w "%{http_code}" "http://[::1]:<port>/"
If one answers and the other does not, your failure is addressing, not code. Make the probe and
the page use the same family.

## HMR mid-run (the phantom failure)
Editing a source file while a Playwright run is mid-assertions reloads the page between
assertions; 4 of 17 "failed" against correct code. Rules: never edit while a probe runs; if a
run fails oddly, re-run ONCE before diagnosing.

## Stale artifact (the false FIXED)
The same bundle hash appeared in two consecutive bug reports; the source was fixed and the claim
was still false. Freshness protocol:
1. Marker: a `data-probe="<change-id>"` attribute or dev-only string unique to this change,
   placed IN the changed lines.
2. Served-module check:
   curl -s "http://127.0.0.1:<port>/src/<module>" | grep -c "<marker>"   # must be ≥ 1
3. DOM check: page.reload() → marker present.
4. dist/: CZ builds it. Ask CZ; record the confirmation verbatim. A PROVE verdict on dist
   without CZ's confirmation is BLOCKED-ON-CZ, not PASS.
5. Consecutive reports must show the marker CHANGED (or explicitly state unchanged). Repeating
   a prior hash and calling it fixed IS the defect, not an edge case.

## Process hygiene (AGENTS §0.6 — defer to source on any conflict)
- `probe_open` / `probe_close` paired 1:1; count them in the verdict.
- Backgrounded processes: record the PID at spawn; kill with `kill <pid>` only.
- NEVER `pkill -f "<pattern>"`: the pattern occurs in your own command line and kills your own
  shell (measured cost: one whole tool call). Match PIDs with `awk` over `ps` output instead.
- Never build, never clean `dist/`, never `RHEO_CZ_OVERRIDE`. dist/ IS the running application.
```

---

## 3. Same-cycle integration diff (required edits outside the new directory)

Two files. Nothing else is required for the skill to load.

**File 1 — `agent/skills/skill-router/SKILL.md` (mandatory, or PROVE never loads):**
- In the **DEBUGGING** category list, immediately after `fix-problems-recursive`, add an entry
  in the router's own row format with this content:
  > `prove-it` — Claim gate. Load before any FIXED / works / connected / wired / verified / done / shipped claim; enforces mount-proof, fixture honesty, precedent-by-shape, artifact freshness, teardown.
- In the router's cross-category matching rules, append one line:
  > Claim verbs (fixed, works, connected, wired, verified, done, shipped, live) in ANY category additionally load `prove-it`.

**File 2 — `agent/skills/paint/SKILL.md` (per its §LAYER 3 self-maintenance):**
- `requires:` — append `- prove-it` as the final entry.
- Pipeline table — append a terminal row in the table's own column format:
  > `∎ CLAIM GATE · prove-it · No PAINT flow reports done without a PROVE verdict; UI flows attach the design.md §7 grep scoped to changed files.`
- `version:` — bump by one minor (e.g. `1.4.2` → `1.5.0`).
- Conflict log — append, verbatim:
  > `prove-it added as terminal pipeline stage. PROVE is category=debugging, not design — loaded by PAINT by explicit exception because defects #1–#3 of this session were PAINT-flow claims. Judgment call, logged per §LAYER 3.`

PROVE is not a design skill, so the paint edit is a deliberate exception rather than a bundle-mandated one — but it is committed to here, not offered as an option, because the black-background and dead-router defects were PAINT-flow claims and a gate outside PAINT's pipeline would not have fired inside it.

---

## 4. Three task phrasings this skill must match, and why the description catches each

1. **"TIFX THE ERROR FIRST and the BLACK BACKGROUND IS STILL THERE COVERING EVERTHING"** —
   caught by *"saying or writing FIXED"*, *"removing or replacing an existing surface"*, and
   *"re-testing after HMR or a CZ build"*. This phrasing is a fix-claim plus a regression
   report whose prior "fix" was exactly defect #4 (wrong precedent shape) and #9 (stale
   artifact). The claim-verb surface fires PROVE before the word "fixed" can be written, and
   Step 2's shape table + Step 8's marker grep are the two checks the previous attempt skipped.

2. **"have you upgraded the shit out of the ui … with the paint skill?"** — caught by
   *"delivering a new component, page, route"*, *"wiring a timer, sensor, probe, or MCP value
   into UI"*, and *"running or reporting tsc / esbuild / probe / Playwright results"*. The
   honest answer to this phrasing is a PROVE verdict with quoted mount chains and probe stdout,
   not an aesthetic opinion; the description forces the load because the task is a
   report-of-results task, and PAINT's new terminal stage guarantees the gate runs inside the
   flow being asked about.

3. **"there hsould also be a setting ot adjsut the size of the halo island adn the setting to
   toggle it on and off"** — caught by *"delivering a new … settings toggle"* and *"wiring a
   timer, sensor, probe, or MCP value into UI"*. A settings toggle is the highest-risk surface
   for defect #2 (a control that renders but drives nothing): Step 5 demands the toggle's
   mount chain reach **both** the settings UI and the consumer, and runtime-proof §3 demands
   both-state plus measured `boundingBox()` assertions. (A fourth phrasing — "connect it to
   the stopwatch" — is caught by the same wiring surface and is defect #3's exact shape.)

---

## 5. Three defects PROVE would have caught first, and the exact step that catches each

1. **Defect #2 — the activity router with zero importers (dead feature reported as shipped).**
   Caught by **Step 5, MOUNT GATE**, hop 1:
   `grep -rn "ActivityRouter" src/ --include="*.tsx" --include="*.ts" | grep -v "ActivityRouter.tsx"`
   returns nothing → the chain dead-ends before any mount root → STOP is mandatory and the
   verdict cannot be PASS. `validate:pages` and every compiler stayed green; this grep is the
   only thing in the repo that fails.

2. **Defect #3 — "connected to the stopwatch" while sending `stopwatch: null` with a hardcoded
   `3*3600_000 + 47*60_000` that read as a real measurement.** Caught by **Step 7, FIXTURE
   HONESTY**: `git diff | grep -n "FIXTURE_"` returns nothing while the diff contains a
   plausible hardcoded duration — an unlabeled plausible fixture is by definition a failure;
   and the wiring word "connected" cannot appear because Step 6 never observed the value change
   with its source. The report is forced to read *"input is `null`; showing FIXTURE…"*, which
   makes the original sentence unwritable rather than merely discouraged.

3. **Defect #9 — the fix reported as done while the running artifact predated it (same bundle
   hash in two consecutive bug reports).** Caught by **Step 8, FRESHNESS GATE**:
   `curl -s "http://127.0.0.1:<port>/src/<module>" | grep -c "<marker>"` returns 0 — the marker
   from the fix is absent from the served module — so the verdict is downgraded to *"fix present
   in source; running artifact not yet confirmed"* or `BLOCKED-ON-CZ` until CZ's build
   confirmation is quoted verbatim.

For completeness, the same procedure also catches #1 (Step 6's `pageerror` capture is the only
gate that sees React #321), #4 (Step 2's shape table rejects the fullscreen overlay), #6 (Step 3's
symbol-count re-read), and #10 (Step 9's `kill <pid>`-only rule) — but the three above are the
ones where PROVE is the *first* and only line of defense.

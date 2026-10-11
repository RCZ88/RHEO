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

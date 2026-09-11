Calibration: App-queue frontier = **LINUX-TRACKING P0 executes now** (this wave) ∥ FERROFLUID-2 research in flight (`App.tsx` temp claim). Landing frontier = external-AI RESULT.md pending. Atlas C1 commit-blocked (§8-1, oldest). Ruling numbering continues at **R-29**.

---

# TASK INTAKE: LINUX-TRACKING P0 (EXECUTION WAVE)

**Bundle audit — seven findings.** The bundle has absorbed most of the staged L-rulings correctly (B-2 = L-2, Task B = L-1, Task C = L-6, Task D = L-3, Task E = L-4 — whoever assembled it read the ledger). Defects that remain:

| # | Finding | Consequence |
|---|---|---|
| 1 | **Task F re-introduces glass** — `bg-zinc-900/80 backdrop-blur-xl rounded-xl` — directly violating L-3 and §2, inside the same prompt whose Task D already carries the correct LAMINAR panel spec. Two contradictory specs in one document. | R-29: Task F **struck as superseded**; Task D + LAMINAR constitution govern every pixel of the panel. |
| 2 | **Output Format demands line-number references** while Task B correctly says grep. Main.ts is 22k+ lines and this project has died on fabricated line counts (§10). | Anchor law absolute: grep anchors only, everywhere, including RESULT.md. |
| 3 | **No gates section at all.** L-5 exists precisely for this wave (dual-env launch, zero synthetic rows). | Full gate set below (G-P0-1…8). |
| 4 | **Console prefix `[DeskFlow]`** — new code, banned name (§1). | `[RHEO]` everywhere new. |
| 5 | **Watchdog blind spot.** Task B skips the `active-win` call on Wayland — but the watchdog restarts "dead" intervals based on staleness. A skip path that never marks liveness = watchdog restart-loop fighting the degradation, an instant new incident. | R-30: skipped polls MUST still mark the watchdog's alive-marker. If the marker is ambiguous in code, STOP and ask. |
| 6 | **Mode persistence target unstated.** "Existing setPreference pattern" is right but this is the exact rock boot-splash died on (dual-store). | R-30: `trackingMode` lives in the preference store. **localStorage = forbidden.** Grep-proven. |
| 7 | **Raw request contains a third ask** — "update the hermes system prompt so it defaults to read on these instructions" — easily lost. | Delivered as a paste-block below. Also: principal's two direct questions answered before the prompt, so he's not re-asking what's decided. |

## RULINGS

| # | Subject | Ruling |
|---|---|---|
| **R-29** | P0 execution mode | Single executor wave: Tasks A–D **implement now**; Task E **spec-only** (folds into R-7 release-mode content; checksum lines are packaging-tail outputs, marked as such); Task F **struck** (superseded by Task D + L-3). L-8 stands: Linux-native alternatives (active-win forks, xprop/ewmh subprocesses) = research APPENDIX only, zero implementation without principal ruling. Naming: RHEO in all new strings/logs. PLATFORM-LINUX formal bootstrap is NOT a precondition — dev environment demonstrably runs (FERROFLUID-2 evidence); flag only if start scripts missing. |
| **R-30** | Degradation hygiene + serialization | (a) Watchdog liveness: skip path marks alive (finding 5). (b) `trackingMode` in preference store only, never localStorage — grep-proven (finding 6). (c) Claims confirmed: `main.ts`, `preload.ts`, `SettingsPage.tsx` → **P0 preempts**; boot-splash Q4 fixes (same SettingsPage) rebase after this lands. (d) FERROFLUID-2's `App.tsx` claim unaffected (disjoint). (e) Windows/macOS behavior parity is a gate — the only unconditionally-cross-platform code is detection + IPC scaffolding, returning sane defaults on win32/darwin. |

## PRINCIPAL'S DIRECT QUESTIONS (answered — do not re-ask)

| Question | Answer |
|---|---|
| "How is the autodetection of the OS?" | `process.platform` (already used throughout main.ts) → win32/linux/darwin. Linux-only second layer: display server via `$XDG_SESSION_TYPE` → `loginctl` fallback → null. `activeWinAvailable` derived: wayland→false · x11→true (runtime still verified live) · null→false (conservative). Exposed via new `get-platform-info` IPC. User sees chosen vs effective mode (L-6) — never a silent flip. |
| "Download different per OS, user selects?" | electron-builder targets already exist (win/nsis · mac/dmg · linux/AppImage). Spec = three release-mode cards (R-7), OS detected as a **hint** that highlights, never hides; real SHA-256 stamped at packaging time. §8-4 (which platforms ship at launch) remains yours. |

---

# EXECUTOR PROMPT — paste verbatim to Hermes

```
# TASK: LINUX-TRACKING P0 — PLATFORM DETECTION + GRACEFUL DEGRADATION (R-29/R-30; L-1…L-8 in force)
Skill Router: load BUILD. If it fails to load, report the failure verbatim and STOP.

You are fixing RHEO's Linux desktop tracking. Context bundle:
agent/docs/generate-prompt-docs/linux-tracking-p0-10092026/CONTEXT_BUNDLE.md — read
FIRST. It contains architecture, evidence, and task specs A–G. Where this prompt and
the bundle disagree, THIS PROMPT wins (it carries later rulings). You claim:
src/main.ts, src/preload.ts, src/pages/SettingsPage.tsx — P0 preempts all other
claims; no other task may touch these files until this wave lands.

## PRIME DIRECTIVES
1. ADDITIVE + PLATFORM-GATED. Windows/macOS tracking renders byte-identical behavior.
   Only detection + IPC scaffolding is cross-platform (sane defaults on win32/darwin).
   Every behavior change is gated on process.platform === 'linux'.
2. HONESTY CONTRACT (L-1/L-2): the foreground pipeline carries ONLY real OS
   observations. ZERO synthetic foreground entries, ZERO fake rows, ZERO invented
   confidence fields. On Wayland, the extension's browser-list match IS the
   verification — log that fact, never fabricate app activity.
3. DISTRUST the bundle's line numbers (§10). Grep anchors only, everywhere.

## HARD LAWS
- Product name: RHEO in ALL new strings, logs, UI copy. Never DeskFlow/App Tracker
  in new code. Log prefix "[RHEO]".
- trackingMode persists in the PREFERENCE STORE via existing setPreference pattern.
  localStorage is FORBIDDEN for this — grep-prove zero new localStorage keys.
- L-8: Linux-native tracking alternatives = research appendix in RESULT.md ONLY.
  Implement NOTHING beyond detection + degradation (no wnck/xprop/xdotool calls).
- No new npm dependencies. EOL: match each file's existing endings, zero EOL-only
  diff lines. One commit for this wave. Anchors by grep, never line numbers.
- File backup before edits to agent/backups/<ts>-linuxp0-pre/. DB: no schema
  changes this wave (mode is a preference). If any migration sneaks in: STOP.

## STEP-0 — BLOCKING CENSUS (report before any edit)
1. B-2 AUDIT (the Wayland honesty contract — blocking):
   a. Trace startBrowserTrackingServer() → /browser-data POST handler →
      freshForegroundIsBrowser() → browser matching (grep:
      function startBrowserTrackingServer / 'browser-data' /
      function freshForegroundIsBrowser / browsersList.some).
   b. REPORT: under active-win returning null (Wayland), does
      freshForegroundIsBrowser() return null/true/false? Does /browser-data ACCEPT,
      REJECT, or MISATTRIBUTE extension sessions? File:line (grep-verified) for
      every decision point.
   c. This report appears verbatim in RESULT.md before any diff.
2. Census: pollForeground() region (grep: async function pollForeground), null-poll
   handling, setInterval startup (grep: trackingInterval = setInterval),
   restart-tracking handler, watchdog implementation (grep: watchdog / lastPoll /
   staleness — identify the ALIVE MARKER precisely; if ambiguous, STOP and ask),
   preload.ts tracking bridges, SettingsPage Tracking section (grep:
   trackingPollInterval + sleepGapMs), setPreference pattern, package.json
   electron-builder targets.
3. Dump the 4 confirmed boot-splash bug-fix state of SettingsPage.tsx (git status +
   diff stat) — if uncommitted splash fixes are in the tree, STOP and report
   (serialization conflict, R-30c).

## IMPLEMENTATION
### A — Platform + display-server detection (main.ts)
Startup detection: platform = process.platform. Linux-only: displayServer from
process.env.XDG_SESSION_TYPE ('x11'|'wayland'); fallback subprocess
loginctl show-session $XDG_SESSION_ID -p Type (try/catch); else null.
activeWinAvailable: wayland→false · x11→true · null→false.
New IPC get-platform-info returning:
{ platform, displayServer?, activeWinAvailable, trackingMode (chosen),
  effectiveMode, reason?, message? }
Preload bridge: getPlatformInfo(). Cross-platform defaults on win32/darwin:
{ platform, activeWinAvailable: true, trackingMode: chosen, effectiveMode: chosen }.

### B — pollForeground() conditional strategy
When effective mode is browser-only/disabled OR (linux AND !activeWinAvailable):
- SKIP the active-win call entirely — no call, no spurious nulls, no null-poll
  sleep-gap path, no watchdog churn.
- WATCHDOG LIVENESS (R-30a): the skip path MUST still mark the watchdog's
  alive-marker so the 30s staleness check does not restart-loop against the
  degradation. Implement inside the skip branch; if the marker is ambiguous
  from census, STOP and ask — do not guess.
- tracking-status-changed event on startup + every effective-mode change:
  { activeWinAvailable, effectiveMode, reason } (L-1). ZERO synthetic
  foreground-changed broadcasts — renderer learns via get-platform-info +
  tracking-status-changed only.
- chosen='browser-only' → skip active-win regardless of platform.
- chosen='app-only' on Wayland → effective=browser-only, reason preserved; the
  STORED preference is never rewritten (L-6).
- X11 Linux and win32/darwin: existing behavior unchanged.
- Degraded browser verification (implement explicitly when activeWinAvailable
  === false): extension browser-list match IS the verification — no live
  active-win call in the /browser-data path. Console note:
  "[RHEO] Browser verification: active-win unavailable (Wayland), using extension browser-list match". No schema changes.

### C — trackingMode preference ('auto'|'app-only'|'browser-only'|'disabled')
Store chosen via preference store (default 'auto'). Compute effective per L-6:
auto → app-only if activeWinAvailable else browser-only · app-only on Wayland →
browser-only + reason · browser-only → browser-only · disabled → disabled.
Console on change: "[RHEO] Tracking mode: chosen=auto, effective=browser-only (Wayland)".
IPC: fold into get-platform-info + set-tracking-mode.

### D — Settings panel (SettingsPage.tsx, Tracking section §10.3)
LAMINAR (Task F is STRUCK — do not implement glass): solid --color-card, 1px
--color-border hairline, radius 10, mono 10px uppercase kickers, tabular-nums
values, segmented control per existing trackingPollInterval pattern, 140ms
single easing, focus-visible on every control, status icon colors from
CategoryColors tokens only — ZERO hex literals, no glass/shadow/blur.
4 states mandatory: loading / empty / error ("Unable to detect platform — using
defaults") / populated.
Populated content: Platform (Windows/Linux/macOS) · Display server X11/Wayland/
Unknown (Linux only) · Desktop app tracking Available/Unavailable (Wayland)/
Unknown · Mode selector 4 options — 'App tracking (X11 only)' renders
disabled-but-visible with "Unavailable on Wayland" when !activeWinAvailable
(never hidden, never silently flipped) · status line stating BOTH chosen and
effective, e.g. "Your choice: App tracking. Effective: Browser-only (Wayland)."
RHEO copy throughout.

### E — Landing download spec (OUTPUT-ONLY → landing/ is NOT touched)
Write agent/docs/generate-prompt-docs/linux-tracking-p0-10092026/
DOWNLOAD_SPEC.md: 3 cards (Windows NSIS .exe / macOS .dmg / Linux .AppImage),
UA = hint that highlights never hides, real artifact types + Electron 41 minimum
OS, SHA-256 line marked "stamped at packaging", Linux card carries verbatim:
"For best desktop app tracking on Linux, use an X11 session. On Wayland, desktop
app tracking is unavailable — browser tracking still works."
Release-mode-only per R-7. No code lands in landing/** this wave.

### APPENDIX (L-8) — research only in RESULT.md
Per-DE Wayland foreground options (portal API status, wlr-foreign-toplevel,
GNOME/mutter extensions, active-win forks/maintainership), each with effort +
risk. RECOMMEND nothing; implement nothing.

## GATES (PASS/FAIL verbatim in report)
G-P0-1 STEP-0 census + B-2 audit report complete.
G-P0-2 tsc: TOTAL errors + DELTA vs pre-wave baseline (delta must be 0 outside
  docs/debt.md sanctioned set).
G-P0-3 node scripts/build.mjs exit 0; rm -rf dist FIRST; verify served artifact.
G-P0-4 Dual-env shell-launch (§3-5 law: Playwright _electron.launch, xvfb-run,
  bounding-box assertions + screenshots; renderer-attach/MCP = dev tools never
  gates; no CDP :9222; --no-sandbox conditional + logged):
  (a) X11 real: WAYLAND_DISPLAY= ./start-dev.js — panel populates, app tracking
  functional unchanged, Windows parity (behavioral, via log assertions).
  (b) Wayland MOCK: XDG_SESSION_TYPE=wayland env — detection flips, panel shows
  Unavailable + effective=browser-only. Do NOT attempt native Wayland launch
  (Electron 41 crashes on this box) — the env mock is the sanctioned test.
G-P0-5 Wayland-mock behavior: active-win call count in logs = 0 after skip ·
  tracking-status-changed fired with correct payload · zero synthetic
  foreground-changed · DB dump: zero app-activity rows written during the mock
  session (browser rows only from real extension posts) — the L-5 no-ghost-rows
  assertion.
G-P0-6 Windows/macOS parity: platform gates grep-audited; win32 path shows
  effectiveMode === chosenMode and poll behavior unchanged.
G-P0-7 LAMINAR audit: zero new hex, zero glass/shadow/blur, radius ∈ {6,10,16},
  tokens only, 4 states present, focus-visible everywhere, RHEO naming grep
  (zero new DeskFlow strings).
G-P0-8 localStorage grep = 0 new keys · EOL clean · git porcelain-clean before
  single commit · nothing unrelated rides.
Evidence → agent/docs/generate-prompt-docs/linux-tracking-p0-10092026/evidence/
(both env launches, panel 4-state screenshots, DB dumps, log captures
full-fidelity).

## COMMIT
`fix: linux tracking platform detection + graceful degradation (LINUX-TRACKING P0)`
Feature-tracker §10.3 update + MEMORY.md Wayland lesson ride this commit (listed
in body). Backup branch before any destructive git op; never destructive on a
dirty tree.

## STOP CONDITIONS
Ambiguous watchdog alive-marker · uncommitted splash fixes on SettingsPage.tsx ·
B-2 audit reveals /browser-data semantics that contradict the degraded-verification
rule (report the contradiction, await arbitration) · any required edit outside
the three claimed files · two consecutive build failures.

## REPORT FORMAT
1. STEP-0 census + B-2 verbatim findings (decision points, accept/reject/misattribute)
2. Per-task implementation summary with grep anchors used
3. Gates G-P0-1..8 PASS/FAIL verbatim + tsc total/delta
4. Files changed + commit hash + evidence paths
5. L-8 research appendix
6. Deviations/STOPs verbatim
```

---

# HERMES STANDING-PROMPT AMENDMENT (principal's third ask — paste into Hermes config)

```
STANDING ORDER — CONTEXT BUNDLES (per principal, 10092026):
Every task wave OPENS by reading CONTEXT_BUNDLE.md in the task's folder under
agent/docs/generate-prompt-docs/<task-id>/ BEFORE any other action. Report a
one-line census confirmation ("bundle read; N code references verified") as the
first line of your first report. DISTRUST the bundle's line numbers — re-derive
anchors by grep. Where the orchestrator's task prompt and the bundle disagree,
the task prompt wins; where both are silent, STOP and ask — never fill gaps
from plausibility.
```

---

# QUEUE + CLAIMS UPDATE

| Item | State |
|---|---|
| LINUX-TRACKING P0 | **Executor prompt delivered** — claims `main.ts`, `preload.ts`, `SettingsPage.tsx` (P0 preempts). B-2 audit is the first blocking act |
| Boot-splash Q4 fixes | **Rebase after P0 lands** (SettingsPage conflict, R-30c) |
| Sidebar swap → Meridian | Behind P0 + serialized behind FERROFLUID-2's App.tsx claim |
| FERROFLUID-2 | In flight, `App.tsx` temp claim — disjoint from P0, may run parallel |
| DOWNLOAD_SPEC.md | Produced by this wave; consumed by LAUNCH-MODE release-mode + launch tail; §8-4 still gates which platforms ship |
| WS-1 / GO-1 / LIGHT waves / landing revamp | Unchanged; file-disjoint |

```
Status (verbatim):
Bundle audit             DELIVERED — 7 findings (Task F glass violation struck, line-anchor contradiction, missing gates, [DeskFlow] prefix, watchdog blind spot, dual-store risk, hidden third ask).
Rulings R-29–R-30        DELIVERED — P0 execution mode, degradation hygiene + serialization. Ledger updated.
Principal Q&A            DELIVERED — OS autodetection chain + per-OS download spec, both ruled; §8-4 remains his.
Executor prompt          DELIVERED — paste-ready: B-2 blocking audit, watchdog-liveness edge, dual-env gates G-P0-1..8, L-8 appendix-only, single commit.
Hermes standing amend    DELIVERED — paste-block for his config (bundle-first order).
Implementation, gates, evidence
                         NOT EXECUTED — no shell/repo access; Hermes executes, verbatim report returns here for gate rulings.
Waiting on               Hermes pickup (B-2 first) · principal: nothing new — §8 unchanged · splash fixes hold for SettingsPage.
```
# RHEO Tracking Migration — Canonical Handoff

> **START HERE when resuming.** Session: `opencode-trackdaemon-20261007` (2026-10-07/08).
> Status at handoff: **migration DONE · tracker LIVE · sync BUILT BUT NOT YET RUN ON REAL DATA.**
> Live state when this was written: app open (electron pid 17252), tracker `active`,
> Linux 33,832 rows vs NTFS 33,760 — **72 rows unsynced**. Re-check with
> `rheo-sync --status`; the numbers move, the topology does not.
>
> This file is the single source of truth for: the always-on background tracker
> (`rheo-tracker`), the app profile move off the NTFS mount, and Windows⇄Linux
> profile sync (`rheo-sync`). Referenced from `AGENTS.md` §0-0a and `agent/SURFACES.md`.

---

## 0. Read this first — the three facts that caused all the trouble

### 0.1 The app profile was ON the NTFS mount, by design

`start-dev.sh` deliberately overrode Electron's `userData` so Windows and Linux
shared one profile on the Windows partition:

```bash
--user-data-dir=/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Application Data/RHEO
```

That mount is **udisks automount and is NOT in `/etc/fstab`**. So the app — not just
any helper — required the Windows mount to be present. A missing mount meant no app
and no tracking. That was CZ's actual complaint, and it is why the daemon alone was
not the whole fix.

Measured divergence at migration time (this is the number that proves it):

| Profile | `logs` rows | Newest timestamp | Reality |
|---|---|---|---|
| `~/.config/RHEO` | 29,289 | 2026-10-05 | **fossil** from before the override existed |
| `.../Application Data/RHEO` (NTFS) | 33,613 | minutes old | **live** |

**The Linux copy was 4,324 rows stale.** A daemon hardcoded to `~/.config/RHEO` would
not merely miss the mount — it would build a second, parallel tracking history that
reads as catastrophic data loss the moment the app is opened.

### 0.2 Two copies of the app's data now exist, and that is intended

| Location | Role |
|---|---|
| `~/.config/RHEO` (Linux, `/dev/nvme0n1p4`) | **live** — app + tracker write here |
| `.../Application Data/RHEO` (NTFS) | Windows' copy — updated only by `rheo-sync` |

They are reconciled by `rheo-sync`, never by copying the file.

### 0.3 `logs.id` is NOT a stable identity

`logs.id` is `INTEGER PRIMARY KEY AUTOINCREMENT`. Two databases that both accepted
writes assign the **same ids to different rows**. Measured: both sides had rows in
id range 33761–33777 meaning different things.

This is why two-way sync cannot be a file copy, and why a naive merge is worse than
no merge:

```sql
-- PROVEN DATA LOSS, no error raised:
INSERT OR REPLACE INTO main.logs SELECT id,timestamp,app,... FROM win.logs;
```

A throwaway reproduction lost 3 rows and reported success.

---

## 1. What exists now

### 1.1 `rheo-tracker/` — always-on background tracker

```
rheo-tracker/
  src/index.ts            entry: poll loop, ownership state machine, shutdown
  src/session.ts          session state machine (port of pollForegroundInner)
  src/db.ts               node:sqlite access, addLog/updateAggregates equivalents
  src/categories.ts       categorizeApp port, reads+writes the SHARED categories JSON
  src/ownership.ts        /proc-based app detection, single-instance lock, heartbeat
  src/browserServer.ts    browser ingest on 54321
  src/config.ts           paths + cadence constants
  src/userdata.ts         profile resolution (env → running app → fallback)
  build.mjs               esbuild bundle → one self-contained .mjs
  tsconfig.json           SCOPED typecheck (see §5)
  rheo-tracker.service    systemd --user unit
  install.sh / uninstall.sh
  sync.mjs / sync.sh      the Windows⇄Linux merger
  README.md               operational doc (shipped copy at ~/.local/share/rheo-tracker/)
```

Runtime copy: `~/.local/share/rheo-tracker/`. Service: `rheo-tracker.service`
(enabled, linger on → starts at boot with no login).

### 1.2 Why tracking died whenever the app didn't run

`src/main.ts:6532` starts the poll loop:

```ts
trackingInterval = setInterval(pollForeground, pollInterval);
```

…and it is **inside `createWindow()`**. `src/main.ts:23497` skips `createWindow()`
entirely under `--minimized`. So there is no code path that tracks without a window.
The daemon is that code path.

---

## 2. How it works

### 2.1 Single-writer ownership

| App state | Daemon behaviour |
|---|---|
| running | stands down, flushes open session, releases 54321 |
| not running | claims tracking, binds 54321 |

Verified live: when CZ launched the app mid-test the daemon flushed, released the
port, and stood down with **zero double-counting**.

### 2.2 No dependencies, by design

- **`node:sqlite`** (built into Node 22+) — not `better-sqlite3`. The repo's copy is
  compiled for Electron's ABI (`NODE_MODULE_VERSION 145`); system Node is v26 (ABI
  147), so `require` throws `ERR_DLOPEN_FAILED`. No `node_modules` on the Linux
  partition, no native module to rebuild.
- **`src/linuxForeground.ts` is imported, not copied.** The repo already had two
  hand-written reimplementations of that algorithm (`scripts/test-pollForeground.js`,
  `scripts/diagnose-linux-foreground.mjs`). A third copy would only guarantee drift.

### 2.3 Writes

Only `INSERT INTO logs`, wrapped with `daily_stats` / `sessions` /
`daily_aggregates` / `browser_sessions` in one `BEGIN IMMEDIATE` transaction,
mirroring `addLog()` (`src/main.ts:4790`) and `updateAggregates()` (`src/main.ts:4843`).

`stats_hourly`, `stats_daily`, `app_totals` are maintained by the table's own
`AFTER INSERT` triggers and are **not** written directly — that would double-count.
Verified: `SUM(duration_ms)=38144.5s` vs `app_totals.total_seconds=38144.467`.

Two guards copied because they are load-bearing:
- website rows never touch totals tables (a domain row is a *portion* of the browser's time)
- duration clamped to `MAX_LOGGED_SESSION_MS` (1 h)

### 2.4 Idle on Linux

`powerMonitor.getSystemIdleTime()` returns 0 on Linux (already worked around at
`src/main.ts:5106`). The daemon derives idle from foreground-*change* time and never
calls the OS API.

---

## 3. `rheo-sync` — Windows ⇄ Linux

```bash
rheo-sync            # merge both ways
rheo-sync --status   # report only, change nothing
```

**Close the app first.** It refuses to run while the app or tracker may be writing,
and says so. Reading a live DB drops rows inserted mid-scan. A missed sync is
recoverable; a corrupted one is not.

Idempotent — verified, a second run inserts 0 rows.

### 3.1 Merge key = SHA-1 over all meaningful columns

`logs` has no natural key. `(timestamp, app, duration_ms)` looks like one but is not
unique: **7 groups repeat in the real data**. Inspecting all 7 showed they are
byte-identical whole rows with adjacent ids — a historic double-write, not two
sessions. So:

- row on both sides → collapses to one (correct: same row)
- row on one side → preserved with all data (correct)

Excluded from identity: `id` (the thing that collides), `source`, `platform`.

### 3.2 Aggregates are rebuilt, never merged

All five aggregate tables are derivable from `logs`. Reconciling two drifted running
totals is far harder than recomputing, so they are rebuilt after the merge using the
same GROUP BY the triggers use. `daily_stats` keeps its non-derivable columns
(`focus_score`, `keystrokes`, `clicks`) and only recomputes totals.

**This repaired pre-existing drift**, not drift the sync created:

```
before:  SUM(logs)=1715224.1s   SUM(app_totals)=1427632.0s   → 287,592s gap
after:   identical
```

### 3.3 Merge order

Windows copy first, so if interrupted the **Linux** side (the live one) is the
complete copy rather than the half-merged one.

### 3.4 Lock placement

`.rheo-sync.lock` sits next to the Windows profile — the one location both operating
systems can see. A lock under `~/.config` would not stop a Windows-side writer.

---

## 4. Backup + rollback

Three independent safety nets, all still in place:

| Asset | State |
|---|---|
| `~/rheo-migration-backup-20261007-221011/` | Verified: all 9 tables matched source, `integrity_check=ok`, sha256 `aa514c5c…` |
| `~/.config/RHEO.stale-fossil-20261008-104141/` | The old 29k-row profile, preserved not deleted |
| NTFS `.../Application Data/RHEO` | **Untouched** — full rollback target |

Backup built with `sqlite3 .backup` (online backup API), not `cp`.

**Verified**: all 9 tables row-for-row, `integrity_check=ok`, and the migrated DB was
**byte-identical** (`cmp`) to the source.

### Rollback

```bash
cd rheo-tracker && ./uninstall.sh          # stops + removes service
git checkout start-dev.sh                   # or re-add the NTFS block manually
export ELECTRON_USER_DATA_DIR="/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Application Data/RHEO"
```

The NTFS profile is frozen at its last row count and ready to resume as live.

---

## 5. Verification recipe

**Do not run repo-wide `tsc`** — it reports 8,000+ pre-existing errors and takes
minutes. Scoped instead:

```bash
cd rheo-tracker
npx tsc --project tsconfig.json            # exit 0 required; has noUnusedLocals/Parameters
node build.mjs ~/.local/share/rheo-tracker
node --check ~/.local/share/rheo-tracker/daemon.mjs   # syntax only, does NOT run it
```

**Never test a merge against the real DBs.** Use copies:

```bash
RHEO_LINUX_DB=/tmp/t/linux.db RHEO_NTFS_DB=/tmp/t/ntfs.db \
RHEO_TRACKER_USER_DATA=/tmp/t RHEO_NTFS_PROFILE=/tmp/t \
RHEO_SYNC_SKIP_WRITER_GATE=1 node rheo-tracker/sync.mjs
```

Test the sync gate **with divergence present** — a gate test passes trivially when
both sides are already equal, and never gets reached.

---

## 6. The bugs found, and the lesson in each

Every one of these passed `tsc` and `esbuild`.

1. **`isAppRunning()` matched nothing.** Matched `dist-electron/main.cjs`, which never
   appears in argv — Electron resolves `main` from `package.json` internally. Real
   argv is `electron --ozone-platform=x11 --user-data-dir=... .`. Reported "app not
   running" while the app was live holding 54321.
   → **Detect a process by `argv[0]`, never by a substring of the command line.**

2. **A promise in a boot path that never settled.** `startBrowserServer()` resolved in
   its `listen` callback; its `error` handler returned *without* resolving. On
   `EADDRINUSE` the caller's top-level `await` hung forever, the poll loop beneath it
   never started, and the daemon ran silently tracking nothing.
   → **Every promise in a boot path must settle on both success and failure.**

3. **A state log emitted on every poll.** "standing down" once per second = ~86,000
   journal lines/day. → **Log on transitions, not on evaluations.**

4. **Heartbeat filled by blind object spread.** `...session.current()` supplied
   `app`/`category` where `Heartbeat` wanted `currentApp`/`currentCategory`, so it
   reported `rowsWritten: 0` after writing four rows. → **Copy by name. A status
   readout that always says zero is worse than no readout.**

5. **A null deref on the checkpoint path.** `flush()` sets `open = null`, then the
   next line read `open.category` — throwing once per 60s checkpoint, i.e. exactly on
   the long sessions the daemon exists to survive. Caught by `tsc` (`TS18047`).

6. **`systemd` silently ignored `StartLimitIntervalSec` in `[Service]`.** It logs
   "Unknown key … ignoring"; the restart-spin protection simply was not active.
   → **It belongs in `[Unit]`.**

7. **My own test harness matched itself.** Setting a detection marker inline in a
   shell script puts the literal into that shell's `argv`, and the daemon correctly
   concluded the app was running. Same trap as AGENTS.md §0.6c. → **Split the literal
   across variables.**

8. Two syntax slips worth remembering: an unquoted `'microsoft edge'` object key, and
   `*/` inside a comment closing the comment early.

---

## 7. Open items

| Item | Status |
|---|---|
| **Run the first real `rheo-sync`** | **NOT DONE.** App was open. NTFS copy is ~72 rows behind. |
| App minimized-to-tray still untracked | Known gap. Daemon stands down whenever the app process exists, and the app only polls inside `createWindow()`. Real fix = daemon always owns tracking + app reads the daemon's heartbeat → **`src/main.ts` change → needs a build from CZ**. |
| Windows loses live history while in Linux | By design. `rheo-sync` is the bridge; run it on **both** sides of an OS switch. |
| Game poll-skip / focus-manager / browser-focus gate | Not replicated in the daemon (Electron or renderer-owned state). |
| `backups/` on NTFS (7.4 GB) | Left in place. Regenerable; skipped because only 37 GB free on `/`. |
| 7 pre-existing identical duplicate pairs in `logs` | Historic double-write. Left alone — they predate this work and collapsing them would alter history. |

---

## 8. Operational quick reference

```bash
# is the tracker alive?
systemctl --user status rheo-tracker
journalctl --user -u rheo-tracker -f

# what is it seeing right now?
cat ~/.config/RHEO/tracker-daemon.json
curl -s http://127.0.0.1:54321/foreground-app

# sync
rheo-sync --status      # read-only
rheo-sync               # merge (app must be closed)

# rebuild after editing src/
cd rheo-tracker && npx tsc --project tsconfig.json && ./install.sh

# remove everything
cd rheo-tracker && ./uninstall.sh
```

Heartbeat fields are trustworthy: `polls`, `rowsWritten`, `currentApp`,
`currentCategory`, `lastSuccessfulPollAt`.

---

## 9. Related repo knowledge

- `src/linuxForeground.ts` — Electron-free Wayland/X11 detection chain
  (`getLinuxForegroundWindow` :558, `probeLinuxTrackingEnvironment` :504). Imports
  only `node:child_process|fs/promises|os|path|util`. **Reuse this; don't reimplement.**
- This box runs **native Wayland** (KDE Plasma, Fedora 44). `kdotool` provides native
  detection; `xdotool`/`xprop` see XWayland only and are marked stale, not successful.
- `powerMonitor.getSystemIdleTime()` is dead on Linux (`src/main.ts:5106`).
- Durable lessons from this work are in `agent/MEMORY.md` (2026-10-07 entry).

---

## 10. Packaged app + auto-update (added 2026-10-10)

CZ's plan: stop relying on the dev version, and run a real RHEO on both Windows
and Linux with automatic updates.

### Files

| File | Role |
|---|---|
| `src/main/autoUpdate.ts` | the whole updater, standalone and removable in one line |
| `src/main.ts:103` | `import { initAutoUpdate } from "./main/autoUpdate";` |
| `src/main.ts` (in the `whenReady` handler block) | `initAutoUpdate(() => mainWindow)` |
| `src/preload.ts` | `checkForAppUpdate` / `installAppUpdate` / `onUpdateAvailable` / `onUpdateDownloaded` |
| `scripts/release.sh` | build → package → verify updater metadata → publish |
| `package.json` `build.publish` | GitHub Releases IS the update feed |

### Why the updater is a separate file

`src/main.ts` is ~30,000 lines and the most contended file in the repo. It is wired
with ONE import and ONE call, so it can be removed just as cheaply. The import at
line 103 is the only change to that file.

### Packaged app profiles line up with what is already deployed

| Build | userData | Reconciles via |
|---|---|---|
| dev (`npm start`) | `~/.config/RHEO` (explicit `--user-data-dir`) | — |
| packaged Linux AppImage | `~/.config/RHEO` (from `productName: RHEO`) | — |
| packaged Windows NSIS | `%APPDATA%/RHEO` = NTFS `Application Data/RHEO` | `rheo-sync` |

So the packaged Linux app needs no configuration change: it lands on exactly the
profile the daemon and dev app already use. **This is why fixing `isAppRunning()`
to recognise `rheo`/`rheo.exe` mattered** — a packaged app is otherwise invisible
to the ownership check and the daemon double-counts alongside it.

### Auto-update is a no-op under `npm start`

`app.isPackaged` is false for a dev run, so `initAutoUpdate` returns immediately and
logs why. That is correct: an unpackaged app has no install to replace and no
`app-update.yml` to read, and calling the updater there only produces a confusing
error.

### Behaviour

- Checks at most once per 24h (in-memory backoff — never writes to the profile).
- Downloads in the background; **installs on quit**, never silently. An app that
  replaces itself mid-run is a half-written binary.
- Every failure is swallowed and logged. Network down, rate limited, or a malformed
  feed are all routine and must never block startup.
- `autoUpdater` events are forwarded to the renderer as `update-available` /
  `update-downloaded`.

### Packaging gotchas already handled

1. **`electron-updater` had to move from `devDependencies` to `dependencies`.**
   devDependencies are NOT shipped, so a packaged app would have contained no
   updater — and would have silently never updated, with no error anywhere.
2. **`asarUnpack` now includes `electron-updater`.** It writes the downloaded
   installer to disk; code inside `app.asar` cannot.
3. **`artifactName` pinned per-platform.** electron-builder otherwise emits a
   build-numbered filename that `latest-linux.yml` can point at after it has moved.
4. **Version must be bumped before publishing** — the updater compares
   `package.json` version against the published feed. `package.json` and
   `package-lock.json` are kept in sync at **1.1.1**.

### Commands

```bash
npm run release            # dry run: builds + packages, publishes nothing
GH_TOKEN=... npm run release:publish   # build + upload a GitHub Release
```

`release.sh` refuses to run while port 54321 is listening (a possible DB writer) and
**refuses to publish if `latest-linux.yml` / `latest.yml` are missing** — a release
without that metadata means installed apps silently never update.

### Verified

- `src/main/autoUpdate.ts` and `src/preload.ts` bundle clean.
- **`src/main.ts` compiles under the project's own vite main config** (scratch
  outDir, `write: false` — `dist/` was not touched; per AGENTS.md §0-0 only CZ builds).
- `electron-updater@6.8.9` installed and its exports load.
- Electron 41.10.7 binary and the `better-sqlite3` native module survive the install.

### Not verified (needs CZ)

The packaged build itself has not been run — §0-0 forbids an agent from building.
The first real `npm run release:publish` must be done by CZ with a `GH_TOKEN` for a
**private** repo. Note `gh` CLI is not installed on this machine.

# RHEO background tracker (`rheo-tracker`)

An always-on time tracker for Linux that runs as a **systemd user service**. It keeps
recording when the RHEO app is closed, needs no `sudo`, no root, no polkit, and no
login — and it does not touch Electron.

```
journalctl --user -u rheo-tracker -f          # watch it live
systemctl --user status rheo-tracker          # is it up
cat ~/.config/RHEO/tracker-daemon.json        # machine-readable heartbeat
```

## Why the app's own tracking cannot do this

`src/main.ts:6532` starts the poll loop:

```ts
trackingInterval = setInterval(pollForeground, pollInterval);
```

…and it lives **inside `createWindow()`**. `src/main.ts:23497` skips `createWindow()`
entirely when launched with `--minimized`. So there is no code path that tracks
without a window. This daemon is that code path.

## Install

```bash
cd rheo-tracker
./install.sh
```

Then close the RHEO app (or just wait for it to be closed) and the tracker takes over.

Remove with `./uninstall.sh` — it sends `SIGTERM` first, so the open session is
flushed rather than lost.

## How it decides who writes

Exactly one writer at a time. The app wins whenever it is running; the daemon only
fills the gap.

| App state | Daemon behaviour |
|---|---|
| running | stands down, flushes, releases port 54321 |
| not running | claims tracking, binds 54321 for browser ingest |

Detection reads `argv[0]` of every process under `/proc`, not a substring of the
command line. Two reasons, both learned the hard way:

- The app is launched as `electron --ozone-platform=x11 --user-data-dir=... .`.
  Electron reads the `main` field from `package.json` internally, so
  `dist-electron/main.cjs` **never appears in argv**. A substring check on that
  marker reported "app not running" while the app was live and holding port 54321.
- Any `ps | grep`-style substring check matches the shell running the grep. That
  produced a daemon that believed the app was up forever and never tracked.

## Where the data goes

The daemon resolves the app's `userData` directory in this order:

1. `RHEO_TRACKER_USER_DATA` — explicit override
2. a running Electron process's `--user-data-dir` argument — the live truth
3. `~/.config/RHEO` — fallback

**It is not hardcoded to `~/.config/RHEO`, and that is not an oversight.**
`start-dev.sh:370-375` deliberately overrides Electron's default so Windows and
Linux share one profile on the NTFS mount:

```
--user-data-dir=/run/media/.../Users/cleme/Application Data/RHEO
```

Measured on this machine: that profile held 33,613 `logs` rows with the newest
timestamp minutes old, while `~/.config/RHEO` held a 29,289-row copy last written
on 5 October — a fossil from before that override existed. A daemon pointed at the
wrong one would not merely miss the mount; it would build a **second, parallel
tracking history** that reads as data loss the moment the app is opened.

Consequence to be aware of: **while the profile lives on the NTFS mount, the tracker
inherits the mount dependency.** Moving the profile to the Linux partition removes it
for both the app and the daemon. See "Moving the profile off the NTFS mount" below.

## How it writes

The daemon only ever `INSERT`s into `logs`, wrapped with `daily_stats` / `sessions` /
`daily_aggregates` / `browser_sessions` updates in one `BEGIN IMMEDIATE` transaction,
mirroring `addLog()` (`src/main.ts:4790`) and `updateAggregates()` (`src/main.ts:4843`).

`stats_hourly`, `stats_daily` and `app_totals` are maintained by the table's own
`AFTER INSERT` triggers, so they are **not** written directly — doing so would
double-count every row. Verified: after a test run, `SUM(duration_ms)` for konsole
was `38144.5 s` against an `app_totals.total_seconds` of `38144.467`.

Two guards copied from the app because they are load-bearing:

- **Website rows never touch the totals tables.** A domain row is a *portion* of the
  browser's time, so letting it reach `daily_stats` counts the browser twice.
- **Duration is clamped to `MAX_LOGGED_SESSION_MS` (1 h)**, as in the app.

## No dependencies, by design

It uses **`node:sqlite`**, built into Node 22+. There is no `node_modules` on the
Linux partition and no native module to rebuild.

This is not a style choice. The repo's `better-sqlite3` is compiled for Electron's ABI
(`NODE_MODULE_VERSION 145`); this machine's Node is v26 (ABI 147), so requiring it
fails with `ERR_DLOPEN_FAILED`. Measured, not assumed.

The detector is **not copied**. `src/linuxForeground.ts` is imported from its real
location in the repo and bundled in, so the app and the daemon run the same detection
chain by construction. The repo already contained two hand-written reimplementations
of that algorithm (`scripts/test-pollForeground.js`,
`scripts/diagnose-linux-foreground.mjs`); a third copy would only guarantee drift.

## Idle detection on Linux

`powerMonitor.getSystemIdleTime()` returns `0` on Linux — already noted and worked
around in `src/main.ts:5106`. The daemon therefore derives idle from the time the
foreground application last *changed*, and never calls the OS API.

## Test seam

`RHEO_TRACKER_APP_MARKER=<substring>` forces app detection to look for that substring
instead of resolving Electron by executable name. Point it at a string no real process
carries to exercise the tracking path while the app is running and must not be
stopped. It is logged loudly at boot.

Two traps, both real:

- **The test harness matches itself.** Setting the marker inline in a shell script
  puts the literal marker into that shell's own `argv`, and the daemon correctly
  concludes the app is running. Split the literal (`A=foo; B=bar; MARK="$A$B"`) so it
  never appears contiguously in any command line.
- Never set this in production.

To test without touching the real database, point the profile at a copy:

```bash
cp "$REAL_PROFILE/deskflow-data.db" /tmp/t/.config/RHEO/
RHEO_TRACKER_USER_DATA=/tmp/t/.config/RHEO node daemon.mjs
```

## Windows ⇄ Linux sync: `rheo-sync`

The app now writes to `~/.config/RHEO` (Linux partition). The Windows partition keeps
its own copy at `.../Application Data/RHEO`, so the two need merging when you switch.

```bash
rheo-sync            # merge both ways
rheo-sync --status   # report only, change nothing
```

**Close the app first.** The syncer refuses to run while the app or the tracker may
be writing, and says so. Reading a live database means rows inserted mid-scan are
silently dropped; a missed sync is recoverable, a corrupted one is not.

It is safe to run repeatedly — the merge is idempotent (verified: a second run
inserts 0 rows).

### Why it is not "copy one DB file over the other"

`logs.id` is `INTEGER PRIMARY KEY AUTOINCREMENT`, so it is **not stable across two
databases that both accepted writes**. On this machine's real data both sides had
rows in the id range 33761–33777 meaning different things. A reproduction confirmed
`INSERT OR REPLACE` by id loses rows **silently, with no error**.

### The merge key is a full-row hash

`logs` has no natural key. `(timestamp, app, duration_ms)` looks like one but is not
unique — the real data contains 7 groups where it repeats. Inspecting all 7 showed
they are byte-identical whole rows with adjacent ids: a historic double-write, not
two sessions. So identity is a SHA-1 over all meaningful columns:

- present on both sides → collapses to one (correct: it *is* the same row)
- unique to one side → preserved with all of its data (correct)

### Aggregates are rebuilt, never merged

`stats_hourly`, `stats_daily`, `app_totals`, `daily_stats` and `browser_sessions` are
derivable from `logs`. Reconciling two independently-drifted running totals is far
harder than recomputing, so after the merge they are rebuilt from `logs` using the
same GROUP BY the AFTER INSERT triggers use. `daily_stats` keeps its non-derivable
columns (`focus_score`, `keystrokes`, `clicks`) and only has totals recomputed.

This also repaired pre-existing drift: the live Linux profile had
`SUM(logs)=1715224.1 s` against `SUM(app_totals)=1427632.0 s` — a 287,592-second gap
that predated the sync. After a rebuild both agree exactly.

### Verified scenarios

| Scenario | Result |
|---|---|
| Linux-only rows → NTFS | 18 inserted, content hashes identical |
| Both sides divergent (3 rows each) | 33,784 on both sides, all 6 divergent rows present on both, identical hashes |
| Re-run when equivalent | 0 inserted (idempotent) |
| Divergent + app open | **refused**, both DBs untouched |
| Divergent + no writer | merged, aggregates consistent |

### Tests run against copies only

Never against the real profiles. `RHEO_LINUX_DB` / `RHEO_NTFS_DB` override both paths,
and `RHEO_SYNC_SKIP_WRITER_GATE=1` bypasses the writer check for sandbox runs only.

### The lock is on the NTFS partition

`.rheo-sync.lock` sits next to the Windows profile because that is the one location
both operating systems can see. A lock under `~/.config` would not stop a
Windows-side writer.

### Workflow across a reboot

```bash
# in Linux, before booting Windows
rheo-sync
# boot Windows, use RHEO normally
# back in Linux, after closing RHEO
rheo-sync
```

Windows writes to its own profile, so run `rheo-sync` on **both** sides of a switch.

## Known gaps

- **Minimize-to-tray with the app running is still untracked.** This daemon stands
  down whenever the app process exists, and the app only polls inside `createWindow()`.
  The correct fix is for the daemon to always own tracking and for the app to read the
  daemon's heartbeat — that needs a `main.ts` change and therefore a build.
- Game poll-skip, the focus-manager hook and the browser-focus gate are not
  replicated; they read Electron or renderer-owned state.

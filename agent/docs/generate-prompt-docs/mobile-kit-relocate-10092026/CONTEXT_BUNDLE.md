# CONTEXT_BUNDLE.md — relocate deskflow-mobile-kit off the FUSE mount

Target AI: you are planning (NOT executing) a move of the DeskFlow mobile-kit
project to a faster disk. Read everything here, then produce the migration plan
per PROMPT.md. Do not move anything yourself.

## 1. Raw facts (verified 2026-09-10 on the Linux box)

Current location (verbatim):
```
/run/media/clementzhao/78FADEEEFADEA820/Dev/deskflow-mobile-kit/
```

Mount table (verbatim, `df -T`):
```
Filesystem     Type    1K-blocks      Used Available Use% Mounted on
/dev/nvme0n1p3 fuseblk 788141176 678006804 110134372  87% /run/media/clementzhao/78FADEEEFADEA820
Filesystem     Type    1K-blocks      Used Available Use% Mounted on
/dev/nvme0n1p4 ext4    206586716 56662704  139357204  29%  /
```

Interpretation: the project lives on an NTFS volume mounted via FUSE
(`fuseblk` = ntfs-3g-style userspace driver). Every file metadata op round-trips
through userspace — `node_modules` trees (tens of thousands of small files),
Gradle caches, and Expo watchers all crawl. Even `du -sh` on
`mobile-app/node_modules` timed out after 120s. The Linux root is ext4 on the
same NVMe with ~139GB free — that is the natural target.

## 2. Project layout (verbatim, top level)

```
agent/  desktop-bridge/  desktop-devices-prompt.md  desktop-pairing-prompt.md
desktop-prompt.md  mobile-app/  mobile-app.zip  mobile-new-features.md
opencode.json  README.md  SECURITY.md  session-ses_0ecb.md  start-dev.ps1
start-dev.sh  sync-server/
```

## 3. Git status (verbatim)

```
$ git -C <kit> rev-parse --show-toplevel
fatal: not a git repository (or any parent up to mount point /run/media/clementzhao)
Stopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).
```

There is NO git repo and NO `.gitignore` in the kit. (Symptom seen in the wild:
`npx expo prebuild --clean` warns "No git repo found in current directory".)
The plan must decide the git story from scratch (init new repo at destination
vs init-then-move), including what must never be committed.

## 4. Hardcoded-path audit (verbatim results)

Grep for `run/media|COMPUTAH_SAYENCE|C:/Users|Users/cleme|78FADEEE` across
`mobile-app/src`, `sync-server/src`, `desktop-bridge`,
`modules/phone-tracker/src`, plus `package.json`, `app.json`, `tsconfig.json`,
`babel.config.js`, `start-dev.sh`, `start-dev.ps1`, `.env.example`:
**zero hits.** The code itself is already location-independent.

Location-sensitive items found (each verified):

a) `sync-server/.env` — `DATABASE_URL="file:./deskflow-sync.db"` (relative,
   travels with the move; the .db file itself moves too — it holds server-side
   users/devices/sync rows, must be copied, never regenerated).

b) `mobile-app/package.json` — `"deskflow-phone-tracker": "file:modules/phone-tracker"`
   (relative file: dep — survives the move, but `node_modules` must be
   reinstalled at the destination, NOT copied: FUSE→ext4 copy of 100k+ small
   files is exactly the slow path, and native bins may be platform-bound).

c) `start-dev.sh` — already dynamic (verbatim head):
   ```bash
   ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   SYNC_DIR="$ROOT/sync-server"
   MOBILE_DIR="$ROOT/mobile-app"
   ```
   No path changes needed; it runs wherever it lands.

d) `mobile-app/android/` — prebuilt native project. MUST be regenerated at the
   destination (`npx expo prebuild --clean`), never copied: it embeds absolute
   SDK paths (`local.properties` → `sdk.dir`, currently absent pre-prebuild),
   build caches (`.gradle/`), and machine-specific autolinking output.

e) Phone pairing is location-independent by design: `PairScreen.tsx` accepts a
   hand-typed server URL (`http://<laptop-ip>:8787` placeholder) or QR scan, and
   tokens live in `expo-secure-store` on the device. Moving the laptop folder
   changes nothing on the phone except the IP/URL if the network changes.

f) `mobile-app.zip` / `src.zip` / `session-ses_0ecb.md` — static archives/logs.
   Copy as-is (or leave behind; planner decides).

## 5. What the planner must verify itself (not pre-verified)

- Exact byte size / file count of `node_modules` trees (do NOT `du` the FUSE
  mount casually — it hangs; use `find | wc -l` with a timeout, or skip and
  reinstall anyway).
- Whether `~/.gradle`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and JDK live on ext4
  already (Gradle home off the FUSE mount matters as much as the project dir).
- Expo/Metro file-watcher behavior post-move (watchman vs node watcher).
- Whether the user wants the Windows side (`C:\Users\cleme\...` paths,
  `start-dev.ps1`) to keep working against the OLD location or be repointed —
  the two OS sides currently share nothing but docs, so this is a docs question.

## 6. Repo rules the plan must respect

- The kit has no test runner; verification = `tsc --noEmit` in each package +
  `expo prebuild` + successful `expo run:android` build + sync-server `migrate`
  + end-to-end pair from the phone.
- Never commit secrets (`.env`), databases (`*.db`), or caches
  (`node_modules`, `.expo`, `android/build`, `.gradle`, `dist`).
- The multi-agent coordination layer lives in the App Tracker repo, not here —
  no coord claims needed for planning, but the executing agent must follow it
  when touching the desktop repo.

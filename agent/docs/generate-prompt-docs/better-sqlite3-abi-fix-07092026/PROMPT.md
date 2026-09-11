# Fix better-sqlite3 ABI mismatch so Electron 41 can load it

## Raw Request
IF U CANT FUCKING FIX IT USE THE /generate-prompt

## Problem

better-sqlite3 `.node` is compiled for **ABI 137 (Node 20)** but Electron 41 bundles **Node 24 (ABI 145)**. Loading the `.node` fails with:

```
Error: The module '...better_sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 145.
```

**Consequences:**
- `db` is `null` in the main process
- FocusManager init throws → `registerIpc()` never runs
- `focus:get-state` and `focus:history` IPC handlers are never registered
- Dashboard/TierMap/longest-focus all crash with `Cannot read properties of null (reading 'prepare')`

**Additionally**, system Node v26.8.1 (ABI 147) also fails to load the same `.node`:
```
Error: ... NODE_MODULE_VERSION 147. This version of Node.js requires NODE_MODULE_VERSION 147.
```
Wait — that says it requires 147 but the module is 137. So the module is universally wrong.

## Environment

- **OS**: Fedora 888 (Linux x86-64)
- **System Node**: v26.8.1 (ABI 147)
- **Electron**: 41.1.1 → bundled Node 24.x, ABI 145
- **better-sqlite3**: 12.9.0
- **Project path**: `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker` (contains spaces)
- **Mount**: NTFS/FUSE (`fuseblk`) — **node-gyp cannot run on this mount** (see SKILL.md NTFS section)
- **Must rebuild on**: `/tmp` (ext4/tmpfs), then copy `.node` back to project

## What's been tried

1. Rebuilt `better-sqlite3` on `/tmp/better-build` targeting `--target=24.10.0 --dist-url=https://nodejs.org/dist`
2. node-gyp 10.3.1 downloaded headers from `nodejs.org/dist/v24.10.0/` (HTTP 200 confirmed)
3. **BUT** the cached headers at `~/.cache/node-gyp/24.10.0/` contained **wrong content** — `node_version.h` says `#define NODE_MODULE_VERSION 137` (Node 20) despite being in the 24.10.0 folder
4. Result: `.node` is still `node_register_module_v137.cold` = ABI 137 (Node 20)
5. The rebuilt `.node` is **the same ABI as before** — the target flag was effectively ignored because the headers were wrong

**Critical insight**: `~/.cache/node-gyp/24.10.0/include/node/node_version.h` has `NODE_MAJOR_VERSION 24` but `NODE_MODULE_VERSION 137`. This is internally inconsistent — Node 24 should be ABI 145. The cache folder is corrupted/mislabeled.

## Constraints (from app-tracker-development SKILL.md)

1. **NTFS mount blocks node-gyp** — rebuild must happen on a native Linux fs (`/tmp`), copy `.node` back
2. **Space in project path** — all shell commands must use `execFileSync` with array args, NOT `execSync` with shell strings. Shell word-splitting on `"C:\path with spaces\node_modules\..."` breaks the build silently.
3. **Verification MUST be under the actual Electron binary**, not system Node. System Node ABI (147) differs from Electron's (145), so a system-Node success doesn't prove Electron compatibility.

## Your task

1. **Delete the corrupted node-gyp cache**: `rm -rf ~/.cache/node-gyp/24.10.0`
2. **Rebuild better-sqlite3 for Node 24 (ABI 145)** on `/tmp`:
   - Copy better-sqlite3 source to `/tmp/better-build` (clean)
   - Install deps via `npm install --prefix /tmp/better-build` (or `cd /tmp/better-build && npm install`)
   - Run `node-gyp rebuild --target=24.10.0 --dist-url=https://nodejs.org/dist --module=build/Release/better_sqlite3.node` from `/tmp/better-build`
   - **Do NOT use `npm rebuild better-sqlite3`** — it runs from the project's NTFS mount and will fail due to ABI drift (better-sqlite3's install script checks system Node, not the target)
   - **Do NOT let the install script run** — it will try to prebuild-install against system Node (ABI 147) and corrupt the binary
3. **Verify the rebuilt `.node` is actually ABI 145**:
   - `strings better_sqlite3.node | grep -i cold` should show `node_register_module_v145.cold`
   - `nm -D better_sqlite3.node` should show `node_register_module_v145` (not v137)
   - If still v137, the rebuild failed — check `node-gyp` cache again
4. **Copy `.node` back** to project: `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
5. **Smoke-test under Electron** (not system Node):
   - Write a probe script that monkey-patches `Module._load` to intercept better-sqlite3 loading
   - Run it with `execFileSync(ELECTRON_BIN, [probeScript])` where `ELECTRON_BIN = /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/node_modules/electron/dist/electron`
   - The probe should: load better-sqlite3, create a test DB, insert a row, select it, print success
   - **Must succeed** — if it fails, the ABI is still wrong
6. **Rebuild the Electron app**: `node scripts/build.mjs` (or `npm run build` if that's the right command — check package.json)
7. **Kill any stale Electron** (old dist with wrong `.node`), restart with `./start-dev.js`
8. **Verify**: log should show no more `No handler registered for 'focus:get-state'` / `focus:history` errors, FocusManager should initialize, dashboard aggregates should compute

## Key paths

- Project: `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker`
- Electron binary: `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/node_modules/electron/dist/electron`
- better-sqlite3 `.node` (target): `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
- node-gyp cache: `/home/clementzhao/.cache/node-gyp/`
- Rebuild workspace: `/tmp/better-build/`
- Electron probe must use `execFileSync` (array args) — shell strings break on the space in the path

## Anti-slop checklist

- [ ] `.node` is actually ABI 145 (verify with strings/nm, not just trust the rebuild log)
- [ ] Smoke test runs under **Electron binary**, not system Node
- [ ] Rebuild happened on `/tmp`, not the NTFS mount
- [ ] No shell word-splitting on paths with spaces (use `execFileSync`)
- [ ] node-gyp cache was cleared before rebuild (the 24.10.0 cache had wrong headers)
- [ ] App was rebuilt after `.node` was replaced (old dist still has old `.node` references? No — `.node` is loaded at runtime, but the app binary itself should be rebuilt to be safe)
- [ ] Stale Electron killed before restart

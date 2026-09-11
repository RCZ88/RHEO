# Context Bundle: better-sqlite3 ABI mismatch fix

## Problem

better-sqlite3 `.node` built for ABI 137 (Node 20) but Electron 41 bundles Node 24 (ABI 145). Loading fails → `db` is null → FocusManager init throws → `registerIpc()` never runs → `focus:get-state`/`focus:history` unregistered.

## Environment

- **OS**: Fedora 888 (czFedora888), Linux x86-64
- **System Node**: v26.8.1 (ABI 147)
- **Electron**: 41.1.1 (bundled Node 24.x, ABI 145)
- **better-sqlite3**: 12.9.0
- **Mount**: NTFS/FUSE (`fuseblk`) at `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker` — **blocks node-gyp** from running in-project
- **Project path**: contains spaces → all shell commands must use `execFileSync` (array args), not shell strings

## Evidence

```
node:internal/modules/cjs/loader:2101
Error: The module '...better_sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 145.
```

```
[DeskFlow] ⚠️ SQLite failed, falling back to JSON: The module '...' was compiled against
a different Node.js version using NODE_MODULE_VERSION 147.
```

The first error is from Electron (ABI 145), the second from system Node (ABI 147). Both fail — the `.node` is ABI 137 (Node 20).

```
$ strings better_sqlite3.node | grep -i cold
node_register_module_v137.cold
```

## Files

### /tmp/rebuild-clean.js (4634 bytes)
Clean rebuild script. Copies better-sqlite3 source to `/tmp/better-build`, installs deps, runs `node-gyp rebuild --target=24.10.0 --dist-url=https://nodejs.org/dist`, copies `.node` back. **PROBLEM**: despite targeting Node 24, the resulting `.node` is still ABI 137 — the node-gyp cache at `~/.cache/node-gyp/24.10.0/` contained wrong headers (Node 20 content).

### /tmp/verify-better-sqlite3.cjs (779 bytes)
CJS smoke test: loads better-sqlite3 via `createRequire`, creates DB, inserts row, selects. Run from project dir.

### /tmp/verify-electron-better-sqlite3.js (2901 bytes)
Runs a probe script under the Electron binary via `execFileSync`. The probe monkey-patches `Module._load` to catch when better-sqlite3 loads and does a DB test.

### /tmp/verify-and-copy.js (4640 bytes)
Strings + nm + objdump inspection of `.node`, then copies to project and runs Electron probe.

### /tmp/better-build/ (rebuild workspace)
Clean copy of better-sqlite3 source + deps. Build artifacts in `build/Release/`.

## Key constraints

1. **NTFS mount** — node-gyp cannot run on the project directory. Must rebuild on `/tmp` (ext4/tmpfs).
2. **Space in path** — all shell invocations must use `execFileSync` with array args, not `execSync` with shell strings.
3. **node-gyp cache corruption** — `~/.cache/node-gyp/24.10.0/` had Node 20 headers despite being named 24.10.0. Must delete and re-fetch.
4. **Electron binary** — `ELECTRON_BIN = /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/node_modules/electron/dist/electron`
5. **Verification** — must probe under the actual Electron binary (not system Node) to confirm ABI 145 compatibility.

## Expected flow

1. Delete corrupted node-gyp cache: `rm -rf ~/.cache/node-gyp/24.10.0`
2. Clean rebuild on /tmp targeting Node 24.10.0 (ABI 145)
3. Verify `.node` has ABI 145 markers (`node_register_module_v145`)
4. Copy to project `node_modules/better-sqlite3/build/Release/`
5. Probe under Electron binary to confirm load + DB operations work
6. Rebuild Electron app (`node scripts/build.mjs`)
7. Kill stale Electron, restart with `./start-dev.js`
8. Verify no more `No handler registered for 'focus:get-state'` / `focus:history` errors

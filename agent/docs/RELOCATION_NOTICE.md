# RELOCATION NOTICE — paste into any AI coding agent working on RHEO

> **The project has moved. Read this before doing anything.**

## New location (ONLY location — the old one is frozen)

```
/home/clementzhao/dev/rheo
```

- The old path (`/run/media/.../COMPUTAH_SAYENCE/App Tracker`, NTFS mount) is **read-only history**.
  NEVER run git, npm, builds, or edits there — git times out (180s+) and any edit there is lost.
- The sibling probe repo moved with it: `/home/clementzhao/dev/probe`
  (`opencode.json`'s `../probe/dist/index.js` reference still resolves — unchanged).
- No spaces in the new path (the old `App Tracker` space broke node-gyp).

## Facts you must not re-derive

- Branch `master`, HEAD `dcda4811` at migration time. Remote `https://github.com/RCZ88/RHEO.git`.
- `.git/config` carries destructive-command BLOCKING aliases (reset/clean/push/branch/checkout/stash)
  plus Linux git values (`filemode=true`, `ignorecase=false`, `symlinks=true`, `autocrlf=input`).
  NEVER bypass them. NEVER run destructive git commands without the principal's explicit go.
- The working tree is DIRTY with in-flight work (dashboard widgets, splash, landing rows).
  Do NOT clean, stash, or reset it. Ever.
- userData (the live DB) is at `~/.config/RHEO/deskflow-data.db` — Linux-side data, authoritative
  by principal ruling. Backup: `~/.config/RHEO.backup.20260913-000240/`.
  Windows-side archive (read-only): `~/rheo-migration-archive/20260913-000240/windows-staging/`.
- `.env` and `opencode.json` hold live secrets and are UNTRACKED. Never print, commit, or push them.
- Windows-only path code is being fixed to `process.platform` branches — see the migration
  RESULT.md §4 table (`agent/docs/generate-prompt-docs/migration-linux-11092026/RESULT.md`).

## Before your first command in the new location

1. `cd /home/clementzhao/dev/rheo && git status --short --branch` — must return in seconds
   and show ONLY the known dirty set. Anything else = STOP and report.
2. `ls node_modules > /dev/null && echo DEPS_OK` — if missing, run `npm ci` (root AND `landing/`).
3. Build with `node scripts/build.mjs`. Never build while the app runs; never run two builds.

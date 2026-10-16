# GIT_SAFETY.md — RHEO git safety system

> **Read with AGENTS.md §0.7.** The short rules live there; this is the detail, the recovery
> procedure, and how this fits the backup systems that already existed.
> On 2026-10-10 a `git stash` hid ~two weeks of uncommitted work. Nothing was deleted, but
> it looked like total loss.

---

## 1. What exists

| Piece | Where | What it does |
|---|---|---|
| `rheo-safety.sh` | `scripts/safety/rheo-safety.sh` | Autosave + bundle + source tar. Runs by itself. |
| `git-guard.sh` | `scripts/safety/git-guard.sh`, installed at `~/.local/bin/git` | Blocks destructive git commands, logs every attempt. |
| Timers | `~/.config/systemd/user/rheo-{autosave,backup}.{service,timer}` | autosave every 15 min, backup every 4 h. |
| Backups | `~/backups/rheo/` | Last 3 bundles + last 3 source tars. Log: `safety.log`. |

**How the autosave works.** Every 15 min it writes a commit to a hidden ref
`refs/autosave/<branch>`, linked to the previous one, so you get a timeline. It uses a
**private index file**, so your real index and your stash are never touched. It respects
`.gitignore`, includes new files, records deletions, and skips cleanly when nothing changed
(that is why the log can look quiet — a quiet log with a populated ref means "no changes",
not "timer broken").

**How the guard works.** `~/.local/bin/git` shadows `/usr/bin/git` (it is earlier in `PATH`).
It blocks `stash`, `reset --hard|--merge|--keep`, `checkout -- |. |-f`, `restore`,
`clean -f|-d|-x`, `push --force`, `branch -D`, then prints `BLOCKED` and exits **126**.
Allowed: `stash list|show|create`, `restore --staged`. Every block is logged with the calling
process to `~/.local/share/rheo-git-guard.log`.

**Known limits.** The guard only sees `git` invoked from `PATH`. A tool that calls
`/usr/bin/git` directly, or that sets `RHEO_GIT_UNLOCK=1`, gets through. It stops accidents,
not a determined actor. It also cannot be installed on a machine without a writable
`~/.local/bin`, and `install` needs systemd user timers (so it fails on macOS and on WSL
without `systemd`).

---

## 2. What agents may and may not do

**MAY (read only):**

```bash
scripts/safety/rheo-safety.sh status   # unsaved count, last commit, autosave count, bundles
scripts/safety/rheo-safety.sh list     # the autosave timeline, index 0 = newest
```

**MAY NOT, unless CZ asks in that same message:**

- `autosave`, `backup`, `restore N`, `install`
- editing, moving, disabling or deleting anything in `scripts/safety/`
- touching `~/.config/systemd/user/rheo-*`, `~/backups/rheo`, `~/.local/bin/git`
- setting `RHEO_GIT_UNLOCK=1`, or calling `/usr/bin/git` to get around a block

A blocked command (exit 126) is the system working. Do not retry, do not route around it.
Report it and ask.

---

## 3. How this fits the backup systems that already existed

There was no single backup system before 2026-10-10; there were several partial ones. This
one does not replace them, and they cover **different failure classes**.

| Failure class | What covers it | Where |
|---|---|---|
| **Source code** lost or reverted | safety autosave ref, safety bundles + src tar, plus `agent/backups/<stamp>-desc-*` manual copies from AGENTS.md §0.5 | `refs/autosave/*`, `~/backups/rheo/`, `agent/backups/` |
| **Database** lost or corrupted | `db-guard.mjs` snapshots (before migrations), `~/rheo-migration-backup-20261007-221011/`, `.config/RHEO.stale-fossil-*`, and the NTFS `Application Data/RHEO` profile via `rheo-sync` | see `agent/docs/RHEO_TRACKING_MIGRATION.md` |

Rules of the merge:

1. **No new mechanism.** Source code → safety. Database → `db-guard`. Different assets,
   different tools. Do not add a fifth backup path.
2. **`rheo-safety.sh status` is the single "is my work safe?" command.** It reports the
   unsaved-file count and the autosave depth in one place. `agent/backups/` and `db-guard`
   are documented here rather than folded into it.
3. **They do not nest.** `rheo-safety.sh backup` excludes `agent/backups`, `dist*`,
   `node_modules`, `release` and `.git` from the source tar, so a backup never swallows the
   backups or the build output.
4. **`db-guard` stays independent.** It must work even when the repo is mid-migration and
   the safety timers are irrelevant. It is the undo button for the DB only.
5. **Pre-existing rollback targets are not backup loops.** The fossil profile and the
   migration snapshot are frozen one-off artifacts. Do not "refresh" them.

### Known gaps (measured 2026-10-12)

- **`rheo-backup.timer` fires but produces no bundle or tar.** `~/backups/rheo/` contains
  only `safety.log`. `backup()` logs only on success (`&& log`), so a failing `git bundle`
  or `tar` is silent. The 15-min autosave is the layer that actually works.
- **The NTFS profile is not mounted** (`/run/media/clementzhao/` absent), so the Windows
  rollback target and `rheo-sync` are unavailable until it remounts.
- **`scripts/safety/` is not tracked by git**, so this system does not travel to another
  machine or another user until it is committed. The script itself is portable: it uses
  `$HOME` and honours `RHEO_REPO`, `RHEO_BACKUP_DIR`, `RHEO_KEEP`.

---

## 4. Recovering lost or reverted work

**STOP. Do not self-repair.** Load the `git-trauma` skill (`agent/skills/git-trauma/SKILL.md`)
and follow it. Then:

1. **See the timeline.** `scripts/safety/rheo-safety.sh list` — index 0 is the newest save.
2. **Restore does not touch the repo.** `restore N` extracts autosave `N` into
   `~/restore-autosave/<time>-N/` via `git archive`. The working tree is untouched. Compare,
   then copy the files you need.
3. **Unhide a stash.** `git stash list` and `git stash show -p` are allowed; popping is not —
   ask CZ.
4. **Every save is a parent of the next**, so nothing is overwritten:
   `git log refs/autosave/<branch>`.
5. **Last resort.** Bundles in `~/backups/rheo/bundles/` hold **all** refs (once backups
   actually run — see the known gaps above).

---

## 5. Operational quick reference (read-only, safe)

```bash
scripts/safety/rheo-safety.sh status           # unsaved count, autosave depth, bundles
scripts/safety/rheo-safety.sh list             # autosave timeline, index 0 = newest
systemctl --user list-timers 'rheo-*'          # are the timers alive?
tail ~/backups/rheo/safety.log                 # what the system actually did
tail ~/.local/share/rheo-git-guard.log         # what got blocked, and by whom
```
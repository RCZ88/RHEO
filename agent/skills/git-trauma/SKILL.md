---
name: git-incident-recovery
description: Use when files or progress look reverted or lost, many files share one modified time, the app suddenly looks old, or an agent may have run git stash, reset, checkout, restore or clean. Also use before any task that needs to move uncommitted work out of the way. Safe diagnosis and recovery for the RHEO (App Tracker) repo.
---

# Git incident recovery

The user lost about two weeks of uncommitted work once (2026-10-10). It was in a git stash that nobody popped. They panic when this happens. Be calm, short, and exact. Give one block of commands at a time. Ask for counts, not full file lists.

## Rules (do not break)

1. Freeze first. Stop all agents. Do not open OpenCode in the repo.
2. Read only until a backup exists. Never run these until the user says go: `git stash pop`, `stash apply`, `stash drop`, `stash clear`, `reset`, `checkout`, `restore`, `clean`, `gc`, `rm`.
3. Do not trust a theory until a timestamp backs it.
4. Quote stash names: `'stash@{0}'`. Never paste `<hash>` placeholders literally.

## Project facts

- The repo is "App Tracker" (RHEO). It used to live on an NTFS drive mounted in Fedora. That causes trouble:
  - git says "dubious ownership". Fix: `git config --global --add safe.directory "<path>"`.
  - Two files that differ only by case (`result.md` and `RESULT.md`) make `git add .` fail with "will not add file alias". This also breaks OpenCode snapshots.
  - Stray files named like `C:\Users\...` appear in `git status`. Agents wrote Windows paths on Linux.
- The line `reset: moving to HEAD` in the reflog is written by BOTH `git stash` and `git reset --hard`. It is not harmless. Get its timestamp with `git reflog --date=iso`.
- The reflog does NOT record: `git restore`, `git checkout -- file`, `git clean`, or anything outside git.
- OpenCode has its own snapshot store (`~/.local/share/opencode`, separate git data). `/undo` can rewrite many files at once with no trace in the repo reflog. Known bug: if the snapshot's `git add .` fails, snapshots go stale and undo restores stale files.
- Past incident: a stash made 2026-10-10 22:30 held 741 files. It was recovered from `stash@{0}`. The cause of that stash was never found.

## Procedure

1. Back up (to a Linux drive, not NTFS):
   ```bash
   mkdir -p ~/RECOVERY_$(date +%m%d)
   rsync -ah --info=progress2 "<repo>/.git/" ~/RECOVERY_$(date +%m%d)/dot-git/
   rsync -ah --info=progress2 ~/.local/share/opencode/ ~/RECOVERY_$(date +%m%d)/opencode-linux/
   cd "<repo>" && git config gc.auto 0 && git config gc.pruneExpire never
   ```
2. Timeline. Match the reset time to the file times:
   ```bash
   git reflog --date=iso | head -40
   git stash list
   git status -sb | head -20
   ls -l --time-style=full-iso src/App.tsx src/main.ts
   ```
3. Find the lost work. Stashes first, then dangling commits and autosaves:
   ```bash
   git fsck --no-reflogs 2>/dev/null | awk '/dangling commit/{print $3}' | while read c; do git log -1 --format='%h %ci %s' $c; done
   git for-each-ref refs/autosave
   ```
   Look for `WIP on <branch>` or `On <branch>` in the lost time window.
4. Pin it so it cannot be deleted: `git branch oct-pin 'stash@{0}'`
5. Copy it out as plain files: `mkdir -p ~/RECOVERY/stash0 && git archive 'stash@{0}' | tar -x -C ~/RECOVERY/stash0`
6. Test restore in a clone, never in the real folder. Start from the commit the stash says it was made on (the hash after `WIP on <branch>:`):
   ```bash
   git clone "<repo>" ~/RECOVERY/repo-test && cd ~/RECOVERY/repo-test
   git checkout -b recovered <base-commit>
   git fetch origin oct-pin
   git stash apply $(git rev-parse FETCH_HEAD)
   git status --short | wc -l ; git status --short | grep -c '^UU'
   ```
   Expect zero conflicts. If there are conflicts, stop and ask.
7. Lock it in:
   ```bash
   git add -A && git commit -m "recovered: <date> stash"
   git bundle create ~/RECOVERY/recovered.bundle recovered
   ```
   Tell the user to copy the bundle to a USB drive or cloud drive.
8. Bring over newer work with `git cherry-pick <hash>` (abort on conflict and ask). Copy untracked files by hand, because stashes skip them. Also remind the user about `.env`, `node_modules`, local databases.
9. Report in plain words: what happened, at what time, what ran it (or "unknown"), where the copy is.

## Rules for agents (paste into AGENTS.md)

- Never run `git stash`, `git reset --hard`, `git checkout -- <path>`, `git restore`, `git clean`, `git push --force`, or `git gc` unless the user asks for it in that same message.
- To switch tasks or clear the tree, commit to a wip branch instead: `git switch -c wip/<task> && git add -A && git commit -m "wip: <what>"`.
- Commit at the end of every task, even if the app has errors. A commit is a save point, not a release. Start the message with `wip:`.
- Before any risky git step, make a backup branch: `git branch backup/$(date +%m%d-%H%M)`.
- Before and after a command that may change many files, run `git status --short | wc -l` and report both numbers.
- Never delete or rename files that differ only by case without asking.

## Optional: block the risky commands in OpenCode

Syntax may differ by version. Check the OpenCode docs before relying on it.

```json
{
  "permission": {
    "bash": {
      "git stash*": "deny",
      "git reset --hard*": "deny",
      "git checkout -- *": "deny",
      "git restore*": "deny",
      "git clean*": "deny"
    }
  }
}
```

## Safety net

The project now runs `scripts/safety/rheo-safety.sh` (replaces the old `autosave.sh`). Project is at `~/dev/rheo` (Linux drive, not NTFS).
- Every 15 minutes it saves ALL work (tracked and new untracked files) as a timeline of commits on `refs/autosave/<branch>`. Nothing in the repo, index or stash is touched.
- Every 4 hours it makes a git bundle of all refs and a tar of the project files. It keeps the last 3 of each in `~/backups/rheo/`.
- During an incident, FIRST run: `scripts/safety/rheo-safety.sh list` then `restore N`. This extracts a snapshot to `~/restore-autosave/` and is always safe.
- `~/.local/share/rheo-git-guard.log` records every blocked destructive git command with its parent process. Read it to find who did it.
- OpenCode data: `~/.local/share/opencode/opencode.db` (SQLite). Back it up with OpenCode closed.

## Git safety (hard rules for every agent)

Why: on 2026-10-10 a `git stash` hid about two weeks of uncommitted work. Nothing was deleted, but it looked like total loss. Uncommitted work is the only work git cannot protect.

1. NEVER run: `git stash` (except `list`/`show`), `git reset --hard`, `git checkout -- <path>`, `git checkout .`, `git restore` (except `--staged`), `git clean -f`, `git push --force`, `git branch -D`, `git gc`. If a command is blocked, do not work around it and do not call `/usr/bin/git`. Tell the user.
2. To get a clean tree or switch tasks, commit instead: `git switch -c wip/<task> && git add -A && git commit -m "wip: <what>"`.
3. At the END of every task, commit with a `wip:` prefix, even if the app has errors. A commit is a save point, not a release.
4. At the START of every task run `scripts/safety/rheo-safety.sh status`. If it shows more than 50 uncommitted files, commit first.
5. Before any command that may change many files, run `git status --short | wc -l` before and after, and report both numbers.
6. Never delete or rename files that differ only by case.
7. Do not run the build, `npm install`, or the app unless the user asks (existing rule 0-0).
8. If you find that files look reverted, STOP and use the `git-incident-recovery` skill. Do not try to fix it yourself.

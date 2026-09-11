# PROMPT.md — plan the mobile-kit relocation

## Raw Request (user's exact words, verbatim — do not reinterpret)

> "Generate Prompt skill to plan out a migration from one path to another so hcanging the location of hte direcoty of this project to a new directoy on the linux side of teh partition so that it is less laggy. make sure to take account the git commands that we can use and like the fact that some cod are migth still be hardcoded into a specific direotry to make sure that everythign is dynamic to where the projeft currently is."

> "i needy ou to generate the prompt for other ai to plajn out how to migrate this efficienctly and effectively"

## Context (read first, in order)

1. `CONTEXT_BUNDLE.md` (same folder) — verified facts: FUSE mount is the lag
   source, zero hardcoded paths in code, no git repo, per-item move/skip rules.
   Trust it over assumptions; re-verify any fact before building on it.

## Mandate

Act as the **Lead Engineer** owning this migration. Produce ONE complete,
ordered migration plan — no option menus, no "you could do A or B". The plan
must be executable by a mid-level developer on the Linux box, start to finish,
with rollback at every destructive step.

## Requirement checklist (every item must appear in the plan)

1. **Destination + prerequisites.** Pick the exact destination path on ext4
   (justify: same NVMe, free space, short path — the old MAX_PATH lesson still
   applies on the Windows side). List what must exist first: Node version,
   JDK, Android SDK location (confirm `ANDROID_HOME`/`~/.gradle` are already on
   ext4 — if Gradle home is on the FUSE mount, moving the project alone fixes
   nothing), disk space check command.
2. **Path-dependency inventory.** Enumerate every location-sensitive item from
   §4 of the bundle plus anything you discover: `.env` DB url, `file:` dep,
   `android/` generated files, `.expo`, Metro/watchman caches, Gradle home,
   shell PATH assumptions in `start-dev.sh`. For each: move / regenerate /
   leave-behind, with the exact command.
3. **Copy method.** Specify the exact copy command (must preserve symlinks +
   permissions — `node_modules/.bin` symlinks die under naive copy) AND the
   exclusion list (regenerables: `node_modules`, `android`, `.expo`,
   `.gradle`, `dist`, build outputs). State what gets reinstalled/regenerated
   at the destination and in what order (`npm install` before `prebuild`,
   `migrate` before first server start). Forbidden: copying `node_modules` or
   `android/` across filesystems.
4. **Git story from zero.** The kit has no repo. The plan must choose and
   justify: init at destination (recommended) vs init-then-move. Include the
   exact `git init / add / commit` sequence, a complete `.gitignore`
   (secrets, databases, caches, build outputs, OS files), first-commit
   contents, and whether to wire a remote. No destructive git (no
   force-push, no history rewrites — there is no history yet; keep it that way).
5. **Dynamism audit.** Prove nothing references the old path after the move:
   grep patterns to run, files to re-check post-move, and the fix for anything
   found (relative-ize, env-var-ize, or regenerate — never hardcode the new
   path either). `start-dev.sh` is already CWD-relative — assert it, don't redo it.
6. **Database + secrets.** `deskflow-sync.db` moves WITH the project (it is the
   server's user/device store); `.env` moves but is never committed. State how
   to verify the DB opens at the destination and that no secret lands in git
   (`git status` + `git check-ignore` gates before first commit).
7. **Verification gates (all must pass before declaring done):**
   `tsc --noEmit` clean in `sync-server` and `mobile-app`; `npm run migrate`
   succeeds; `npx expo prebuild --clean` regenerates `android/`;
   `expo run:android` builds and installs; phone pairs against the new server
   path; focus shield + goals screens behave as before. Map each gate to the
   exact command and expected output.
8. **Rollback.** Every destructive step (deleting the old tree, `prebuild
   --clean`, DB migration) gets an undo: what to back up, where, and the exact
   restore command. The old directory is deleted ONLY after all gates pass —
   state this explicitly with the final `rm` command gated on gate results.

## Constraints (hard)

- Planning only — produce the plan document, do not execute the move.
- Efficient AND effective: minimize wall-clock time (parallelize independent
  reinstalls where safe) and never re-download what can be regenerated locally.
- Keep the Windows side (`start-dev.ps1`, `C:\...` docs paths) working or
  explicitly repoint it — decide and state which.
- No new dependencies, no code changes unless the dynamism audit finds a real
  hardcoded path (code is verified clean — the plan should say so, not refactor).

## Output format

A single `RESULT.md`-style plan (you may write it inline): ordered phases,
exact commands per step, expected output per gate, rollback per destructive
step, and a final checklist. Close with the 5-line human summary: destination,
downtime estimate, the one riskiest step, what to back up first, and the first
command to run.

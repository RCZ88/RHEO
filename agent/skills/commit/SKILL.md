---
id: commit
name: Commit
category: git
applicable_to: [commits, git]
version: 1.0.0
created: 2026-04-19
tags: [git, commit, version-control]
---

# Commit Skill

## Purpose
Ensure all project changes are properly committed with complete changelog updates.

## Rules

### ALWAYS Commit ALL Files
When committing, ALWAYS use `git add -A` to stage ALL modified and untracked files. Never commit only partial files.

**CORRECT:**
```bash
git add -A
git commit -m "message"
```

**INCORRECT (NEVER DO THIS):**
```bash
git add file1.ts file2.ts
git commit -m "message"
```

## Workflow

### Before Making Code Changes
1. Commit all current changes first (backup point)
2. Use descriptive commit message

### After Making Code Changes
1. Run `git add -A` to stage ALL files
2. Update COMMITS.md with detailed changes
3. **Build the commit message** — you MUST do ALL of the following before writing a single line of the message:
   a. Run `git diff --cached --stat` to see every file changed
   b. Read `agent/state.md` — extract EVERY entry in the "Recent Changes" section (not just the latest one)
   c. List `agent/docs/` directories — each PROMPT.md or CONTEXT_BUNDLE.md documents a feature/bugfix that was implemented. Read their summaries.
   d. Check for new files: `src/pages/`, `src/components/`, `src/services/`, `src/lib/` — new files = new features
   e. Check `src/main.ts` for new IPC handlers (search for `ipcMain.handle`)
   f. Check deleted files and backups
   The commit message must cover EVERY change found across ALL of these sources.
4. Commit with comprehensive message — structured as major sections with subsections
5. Push to remote

## COMMITS.md Update Template

When updating COMMITS.md, include:
- Commit message
- Files modified
- Feature/fix description
- Breaking changes if any

## Example Complete Workflow

```bash
# 1. Stage ALL files
git add -A

# 2. Inspect full scope of changes
git diff --cached --stat

# 3. Check state.md for ALL change descriptions (not just latest)
cat agent/state.md

# 4. Check docs/ directories for features built (each PROMPT.md = one feature)
Get-ChildItem agent/docs/ -Directory | ForEach-Object { Write-Host "`n=== $($_.Name) ==="; Get-ChildItem $_.FullName -Filter "*.md" -Name }

# 5. Check for new files (new features)
Get-ChildItem src/pages/ -Name
Get-ChildItem src/components/ -Name
Get-ChildItem src/services/ -Name
Get-ChildItem src/lib/ -Name

# 6. Check new IPC handlers (new features)
Select-String -Path src/main.ts -Pattern "ipcMain\.handle\(" -AllMatches | Select-Object -ExpandProperty Matches | ForEach-Object { $_.Value }

# 7. Commit with comprehensive message covering everything
git commit -m "scope: Short title covering main change

## Major Feature Area 1
- Change with file references and why
- Change with file references and why

## Major Feature Area 2
- Change with file references and why
..."
```

## Notes
- The `-A` flag stages ALL changes including deleted, modified, and new files
- Always update COMMITS.md for significant changes
- Use prefixes: feat:, fix:, chore:, refactor:, docs:
- **NEVER write a short commit message** — inspect `git diff --stat`, `git diff --cached`, and `agent/state.md` to find every change. The message must be exhaustive, covering every modified file and the purpose of each change. A missing change description is a bug in the commit message.
# AGENTS.md — read this first

**You are probably not the only agent working in this repo right now.** Other
agents / sub-agents / shells may be editing files, building, running the app, or
writing the database at the same time. Ignoring that is what causes the DB to
"disconnect", the app to drop into internal-server-error mode, and edits to
silently overwrite each other so nothing ships.

## Non-negotiable rules

1. **Announce yourself, then look before you leap.**
   ```bash
   export AGENT_ID="<your-unique-id>"
   node agent-coordination/coord.mjs register --agent "$AGENT_ID" --task "<what you're doing>"
   node agent-coordination/coord.mjs status   # who else is active?
   ```
2. **Claim files before editing them. A DENIED claim is a hard STOP.**
   ```bash
   node agent-coordination/coord.mjs claim --agent "$AGENT_ID" --paths <files/dirs you'll edit>
   ```
3. **Never build while the app runs; never run the app while building. Never run
   two builds or two app instances.** Use the wrappers — they enforce it:
   ```bash
   node agent-coordination/run-exclusive.mjs app   --forbid build app -- npm start
   ```
   **There is deliberately no `build` line:** per root `AGENTS.md` §0-0 (Option B,
   2026-10-02) **agents never build — CZ builds.** An 8192 MB heap on a ~4 GB-available
   box caused 12 global OOM events in 24 h. Verify with scoped `tsc --noEmit`, scoped
   `esbuild --bundle --outfile=/dev/null`, and `npm run validate:pages` instead.
4. **The database has exactly one writer.** better-sqlite3 is single-writer.
   Do DB work only when the app is stopped, and always through the guard
   (it backs up first):
   ```bash
   node agent-coordination/db-guard.mjs run -- node scripts/migrate.mjs
   node agent-coordination/db-guard.mjs backup   # manual snapshot anytime
   ```
5. **Prefer surgical edits over whole-file rewrites**, and new files over
   mutating shared ones. Don't `git add -A`, force-push, drop tables, or delete
   the DB without explicit human confirmation.
6. **Always release when done** (wrappers do this automatically, even on crash):
   ```bash
   node agent-coordination/coord.mjs done --agent "$AGENT_ID"
   ```

## Full rules, edge cases, and constraints

See **`agent-coordination/MULTI_AGENT_PROTOCOL.md`**. Read it before doing
anything non-trivial. If two sub-agents would touch the same file, that's a
planning bug — partition the work into disjoint paths instead.

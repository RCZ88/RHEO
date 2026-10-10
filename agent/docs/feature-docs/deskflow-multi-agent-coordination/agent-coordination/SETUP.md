# Setup — agent-coordination

Zero dependencies. Node built-ins only. Just drop the `agent-coordination/`
folder and the root `AGENTS.md` into the repo.

## 1. Recommended package.json scripts

Replace your raw `build` / `start` scripts with coordinated wrappers, and keep
the raw ones under `:raw` so the wrappers can call them:

```jsonc
{
  "scripts": {
    "build:raw": "vite build",          // <- your real build command
    "start:raw": "electron .",          // <- your real start command

    "start": "node agent-coordination/run-exclusive.mjs app --forbid build app -- npm run start:raw",
    "deps":  "node agent-coordination/run-exclusive.mjs deps -- npm ci",

    "db:backup": "node agent-coordination/db-guard.mjs backup",
    "db:run":    "node agent-coordination/db-guard.mjs run --",

    "agents":       "node agent-coordination/coord.mjs status",
    "agents:reap":  "node agent-coordination/coord.mjs reap"
  }
}
```

> **NOTE — `build` is intentionally NOT wired to a wrapper.** Per `AGENTS.md` §0-0
> (Option B, CZ 2026-10-02) **only CZ builds**. An 8192 MB heap on a box with ~4 GB
> available produced 12 global OOM events in 24 h. Do not add a `build` wrapper line
> back into `package.json` — it would re-create the contradiction this repo just spent
> a cycle removing. CZ runs `npm run build`, which self-logs via
> `scripts/build-with-log.mjs`.

After this, `npm start` is automatically collision-safe:
you physically cannot start a second app instance or build over a running app.

## 2. Pointing db-guard at the real database

The DB lives in Electron's `userData` dir, not in the repo. `db-guard.mjs` will
auto-resolve it per-OS from the app name, or you can be explicit:

```bash
# Option A: environment variable (recommended in your shell profile)
export DESKFLOW_DB="$HOME/Library/Application Support/deskflow/deskflow-data.db"

# Option B: per-command flag
node agent-coordination/db-guard.mjs where --db /path/to/deskflow-data.db
```

If your Electron app name isn't `deskflow`, set `DESKFLOW_APP_NAME`.

## 3. Ignore the runtime state

Add to `.gitignore`:

```
agent-coordination/registry.json
agent-coordination/.reg.lockdir/
agent-coordination/backups/
```

## 4. Give every agent the habit

The root `AGENTS.md` is the contract. Any agent framework that reads `AGENTS.md`
(or an equivalent system prompt) will pick up the rules. For frameworks that
don't, paste the "Non-negotiable rules" block into the system prompt.

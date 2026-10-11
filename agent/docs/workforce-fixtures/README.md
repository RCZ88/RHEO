# Workforce fixtures — verifying the action classifier against REAL agent output

## What this directory is for

The RHEO Workforce scene (`/terminal` → `WorkforcePanel`) is driven by real terminal
output. `classifyAction()` in `src/shared/workforceActivity.ts` decides what a line of PTY
output *means* — which kind of action it is, for the worker standing at a station.

The failure mode this directory exists to kill: **writing that classifier against guesses.**
A guessed tool-name table looks right, passes review, and then silently classifies 90% of
real activity as `unknown` — which renders as an office where nobody ever does anything.

Everything here is derived from **measured output of an opencode agent running on this
machine**, not from documentation or memory of what tool names "should" look like.

| File | What it is |
|---|---|
| `tool-registry.json` | The authoritative tool enumeration for this machine: **140 tools** (16 builtins + 124 MCP), extracted from real session data. |
| `extract-tool-registry.py` | The reproducible extractor that produced it. Reads `~/.local/share/opencode/opencode.db` **read-only**. |
| `verify-tool-coverage.cjs` | Probe asserting every one of the 140 tool names classifies correctly. |

---

## 2. The ground truth: `~/.local/share/opencode/opencode.db`

**This is the most valuable thing in this directory. Read it before touching the classifier.**

`~/.local/share/opencode/opencode.db` is a SQLite database (~910 MB). The table that
matters is **`part`**, and the column that matters is **`data`** — it holds one JSON blob
per message part. The agent's tool calls are all in there, with their real names, their real
arguments, and their real outcome.

Three queries matter. All are read-only.

### 2a. Real tool names + how often they are actually called

```bash
python3 - <<'PY'
import sqlite3
db = sqlite3.connect('file:/home/clementzhao/.local/share/opencode/opencode.db?mode=ro', uri=True)
print(db.execute("""
  SELECT json_extract(data,'$.tool'), COUNT(*)
  FROM part
  WHERE json_extract(data,'$.tool') IS NOT NULL
  GROUP BY 1 ORDER BY 2 DESC
""").fetchall())
PY
```

Measured head of that result (this is what frequency means — `bash` dominates, and the
MCP tools are not decoration):

```
bash 13362 | read 4038 | edit 2485 | probe_eval 661 | grep 527
write 387 | todowrite 235 | glob 207 | probe_open 205 | skill 131
```

Note what is **absent**: `list`, `patch`. They do not exist. See bug (b).

### 2b. Real argument keys per tool

You cannot guess an argument shape either. This gives the actual key set:

```bash
python3 - <<'PY'
import sqlite3
db = sqlite3.connect('file:/home/clementzhao/.local/share/opencode/opencode.db?mode=ro', uri=True)
for tool, keys in db.execute("""
  SELECT json_extract(data,'$.tool'), group_concat(DISTINCT k.key)
  FROM part p, json_each(p.data,'$.state.input') k
  WHERE json_extract(data,'$.tool') IS NOT NULL
  GROUP BY 1 ORDER BY 1
"""):
    print(f"{tool:34s} {keys}")
PY
```

Real output for the top tools:

```
bash   command,workdir,timeout,description
read   filePath,offset,limit
edit   filePath,oldString,newString,replaceAll
grep   pattern,path,include
glob   pattern,path
write  filePath,content
```

### 2c. The authoritative tool enumeration

The single best query in this document. When a model is offered a tool that does not exist,
the `invalid` tool returns an error message that **lists every tool it was actually offered**:

```bash
python3 - <<'PY'
import sqlite3
db = sqlite3.connect('file:/home/clementzhao/.local/share/opencode/opencode.db?mode=ro', uri=True)
msg = db.execute("""
  SELECT json_extract(data,'$.state.input.error')
  FROM part
  WHERE json_extract(data,'$.tool')='invalid' LIMIT 1
""").fetchone()[0]
print(msg[:1200])
PY
```

The text is ~3.6 KB and ends with a line beginning `Available tools:` followed by a
comma-separated list of **all 140 names**. That is the *offered* set, straight from the
model — not inferred, not documented, not guessed. `extract-tool-registry.py` parses that
line, subtracts the 16 builtins, and writes `tool-registry.json`.

### 2d. How failures are recorded — `state.status`

`json_extract(data,'$.state.status')` is one of `completed | error | running | pending`.

```bash
python3 - <<'PY'
import sqlite3
db = sqlite3.connect('file:/home/clementzhao/.local/share/opencode/opencode.db?mode=ro', uri=True)
print(db.execute("""
  SELECT json_extract(data,'$.state.status'), COUNT(*)
  FROM part WHERE json_extract(data,'$.tool')='bash' GROUP BY 1
""").fetchall())
# -> [('completed', 13305), ('error', 23), ('running', 34)]
```

**This is the honest source for a failed tool call.** Never infer failure from a glyph in
the transcript — a red `✗`, a `!`, a `(1)` in a shell prompt. Those are per-TUI decoration
and they lie. If you need to know a call failed, read `state.status` (or, in the app, the
recorder in §5).

---

## 3. Running the three verification suites

The suites live **outside** the repo (they `require()` built bundles, not `src/`), and they
must be **rebuilt with esbuild first** — `tsc` proves types, it does not produce something
Node can `import`.

### 3a. Build the logic bundle

```bash
cd ~/Documents/COMPUTAH_SAYENCE/"App Tracker"

rm -rf /tmp/opencode/wf-out
npx esbuild \
  src/shared/workforceActivity.ts \
  src/main/workforceAdapters.ts \
  src/components/terminal/workforce/workforceStore.ts \
  src/components/terminal/workforce/workforceSceneModel.ts \
  --bundle --format=esm --platform=node \
  --outdir=/tmp/opencode/wf-out --outbase=src \
  --loader:.css=empty --external:electron
```

This bundle stays **nested** — `wf-probe.cjs` requires those exact paths:
`wf-out/shared/workforceActivity.js`, `wf-out/main/workforceAdapters.js`,
`wf-out/components/terminal/workforce/workforceStore.js`,
`wf-out/components/terminal/workforce/workforceSceneModel.js`.

### 3b. Build the render bundle

```bash
rm -rf /tmp/opencode/wf-ssr
npx esbuild \
  src/components/terminal/workforce/IsometricWorkforceScene.tsx \
  src/components/terminal/workforce/WorkforceInspector.tsx \
  src/components/terminal/workforce/WorkforceStations.tsx \
  src/components/terminal/workforce/workforceSceneModel.ts \
  src/components/terminal/workforce/workforceStore.ts \
  src/main/workforceAdapters.ts \
  src/shared/workforceActivity.ts \
  --bundle --format=esm --platform=node --jsx=automatic \
  --outdir=/tmp/opencode/wf-ssr --outbase=src \
  --loader:.css=empty --external:react --external:react-dom --external:electron

# --outbase=src nests the output (the entries are at three depths); flatten it.
find /tmp/opencode/wf-ssr -name '*.js' -exec mv -t /tmp/opencode/wf-ssr {} +
```

After the flatten, `/tmp/opencode/wf-ssr/` is flat and holds all seven bundles:
`IsometricWorkforceScene.js`, `WorkforceInspector.js`, `WorkforceStations.js`,
`workforceSceneModel.js`, `workforceStore.js`, `workforceAdapters.js`, `workforceActivity.js`.

Two things bite here and both are in the command above on purpose:

- **`--loader:.css=empty` is mandatory.** These modules `import './workforce.css'`. esbuild's
  default CSS loader will try to resolve and parse the Tailwind-processed stylesheet; with
  `empty` the import becomes a no-op and the JS bundles cleanly under plain Node.
- **`--outbase=src` produces NESTED output dirs**, because the entries live at three
  different depths. The probes either require those exact nested paths (suite 1) or expect a
  flat dir (suite 3) — check what the probe imports before you flatten. Do not assume a flat
  layout.

Note `src/components/terminal/workforce/WorkforceStations.tsx` is capital-**S**. Passing the
lowercase spelling makes esbuild fail with a `different-path-case` warning followed by
`Cannot read file` on a case-sensitive filesystem.

### 3c. Run the three suites

```bash
# 1. logic assertions — 105 PASS
node /tmp/opencode/wf-probe.cjs

# 2. tool coverage — 32 PASS  (requires /tmp/opencode/wf-out/shared/workforceActivity.js
#    and /tmp/opencode/tool-registry.json; the probe is the repo copy)
cp agent/docs/workforce-fixtures/tool-registry.json /tmp/opencode/tool-registry.json
node agent/docs/workforce-fixtures/verify-tool-coverage.cjs

# 3. render assertions — 41 PASS  (server-side render, no browser needed)
node /tmp/opencode/render-probe.mjs
```

| Suite | Probe | Assertions | Expected |
|---|---|---|---|
| Classifier + store + scene-model logic | `wf-probe.cjs` | **105** | all PASS |
| Every real tool name classifies | `tool-coverage-probe.cjs` | **32** | all PASS |
| Real components → real DOM | `render-probe.mjs` | **41** | all PASS |

Suite 3 needs `react` / `react-dom/server` resolvable — run it from a dir with those
installed (`/tmp/opencode/node_modules` already has them).

---

## 4. THE THREE BUGS the ground truth caught

Do not reintroduce these. All three were shipped-then-corrected once already.

### (a) MCP tools are NOT `mcp__`-prefixed

opencode uses **bare** names: `probe_eval`, `shadcn_get_component`, `notion_notion_create_page`.

Only **claude** and **codex** use the `mcp__<server>__<tool>` form.

A `^mcp__` check therefore matches **nothing** for opencode and silently drops ~90% of real
activity into `unknown`. Verified against the live DB: `probe_eval` alone has 661 calls and
`probe_open` 205 — real, frequent, and not `mcp__`-prefixed. The classifier must accept both
forms, and must treat any `server_tool` shape as MCP by **fallback** (so a server installed
tomorrow still classifies) rather than by a hardcoded prefix list.

### (b) `list` and `patch` are not real tools

Both appear in hand-written tool tables and in model priors. They are not offered by
opencode and never appear in the `Available tools:` line. Support for them is dead code.

Tools that **do** exist and that matter:

- **`skill(name)`** — real. Classifies as `read` (the agent is loading instructions).
- **`question(...)`** — real, and semantically important: **`question` is how the agent
  asks a human.** That is the `blocked` state. An agent sitting on a `question` is waiting on
  CZ, not idle and not working — the station must show that.

### (c) `shadcn_` and `shadcn-ui-mcp_` are two DIFFERENT servers

They differ by one character class (`shadcn-` vs `shadcn`) and **both** are live in
`opencode.json`. Collapsing them into one prefix drops or misroutes a real tool. They also
teach the general rule: MCP names here are not always `<server>_<tool>` with an underscore
delimiter — a server name may itself contain hyphens (`google-design-mcp_`,
`shadcn-ui-mcp_`). Never parse a server out of a tool name by splitting on `_`.

---

## 5. The recorder (plan §8.2) — how to get fixtures for the other agents

The PTY line regexes in `src/main/workforceAdapters.ts` are **HYPOTHESES** for the
non-opencode agents. They were written by reading opencode's TUI output and generalising.
**No fixtures exist for claude, codex, gemini, or aider** — there is no recorded output from
any of them, so their line patterns are unconfirmed guesses.

The recorder is how a guess becomes a fixture. It is wired in `src/main.ts` (~line 14125):

```bash
DESKFLOW_RECORD_WORKFORCE=1 npm start
```

- `DESKFLOW_RECORD_WORKFORCE=1` enables `workforceRecorder`, which accumulates **every**
  `ActionEvent` produced by the ingest pipeline — after `stripAnsi`, after `classifyAction`,
  i.e. exactly what the scene would have rendered.
- `dumpWorkforceRecording()` in `src/main.ts` flushes the batcher and returns the whole
  recording as a JSON fixture string. That string is the artifact to commit.
- The batcher runs at 100 ms, so nothing is lost when you dump — it stops the batcher first.

Procedure for a new agent: run that agent in a DeskFlow terminal with the env var set,
drive it through each action kind (read, edit, bash, delegate, ask-a-human, fail), dump,
commit the JSON next to this README, then **write assertions against the fixture** the way
the three suites do. Only then change the regex. Do not change the regex first.

---

## 6. The DB must be read READ-ONLY

`opencode.db` is a **live** database belonging to the running editor session. It is ~910 MB
and there is an active `-wal` (and `-shm`) alongside it — see
`~/.local/share/opencode/opencode.db-wal`, currently ~15 MB.

**Always open with the `mode=ro` URI form:**

```python
sqlite3.connect('file:/home/clementzhao/.local/share/opencode/opencode.db?mode=ro', uri=True)
```

A plain `sqlite3.connect(path)` takes a write lock and can collide with the live session.

**Before copying the file** (which is what `extract-tool-registry.py` consumes), be aware:
the live DB is mid-transaction, so a raw copy is **not a consistent snapshot** — the `-wal`
holds committed data that is not yet in the main file, and a bare `cp` without the `-wal`
silently loses recent sessions. If you copy, copy the `-wal` and `-shm` too, or use
`VACUUM INTO` / the SQLite backup API. **And say so in your report** — a 910 MB copy taken
while opencode is running is not free, and it lands in `/tmp`.
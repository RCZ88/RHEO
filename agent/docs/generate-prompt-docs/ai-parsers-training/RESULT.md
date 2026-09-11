<aside>
🔍

**Hand-off prompt.** Paste everything below into another AI; it has the full per-parser diagnosis, exact `src/main.ts` line ranges, before/after code, edge cases, the cache-poisoning trap, and a final summary table.

**Machine:** Windows 11, user `cleme`. **Working:** OpenCode, Codex. **Broken / mis-parsed:** Claude Code, Qwen, KiloCode, Gemini (path drift). **Not installed:** Cursor, Aider. **Missing entirely:** GitHub Copilot.

</aside>

## 0. Shared context the downstream AI must read first

### 0.1 Interfaces (`src/main.ts:309–335`)

```tsx
interface ParsedSession {
  sessionId: string;
  timestamp: Date;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  model?: string;
  provider?: string;
  durationMs?: number;
  projectPath?: string;
  messageCount?: number;
  cost?: number;
}

interface AIAgentPlugin {
  id: string;
  name: string;
  color: string;
  detect(): Promise<boolean>;
  getStoragePaths(): string[];
  parse(filePath: string): Promise<ParsedSession[]>;
  parseDir(dirPath: string): Promise<ParsedSession[]>;
  extractTokensFromRow?: (row: any) => { inputTokens; outputTokens; cacheReadTokens?; cacheWriteTokens? };
  parseSQLite?: (dbPath: string) => Promise<ParsedSession[]>;
  parseJson?: (filePath: string) => Promise<ParsedSession[]>;
}
```

### 0.2 The cache-poisoning trap (`src/main.ts:1451–1478`, sync `1481–1554`)

- `RELEVANT_EXTS = new Set(['.jsonl', '.json', '.db', '.sqlite'])`.
- `getDirDataSignature(dir)` → `{ fileCount, latestMtime }`.
- Sync compares against `loadAISyncState()`'s stored signature. **If unchanged, the entire plugin is skipped**, regardless of whether last run returned zero sessions due to a bug.
- **Failure mode that's almost certainly active right now:** a broken parser ran once, recorded `{fileCount, mtime}` for the directory, and saved 0 sessions. If the user hasn't touched the tool since, every subsequent sync skips the plugin entirely. **Any fix below MUST be paired with cache invalidation** (see §9 “Mandatory mitigation”).

### 0.3 Shared helpers the fixes assume exist (add if missing — see §9)

```tsx
const toInt = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

function readTextFileSafe(p: string): string | null {
  try {
    const buf = fs.readFileSync(p);
    // Strip UTF-8 BOM if present
    const start = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF ? 3 : 0;
    return buf.slice(start).toString('utf8');
  } catch (e: any) {
    if (e?.code === 'EACCES' || e?.code === 'EBUSY' || e?.code === 'EPERM') return null;
    throw e;
  }
}

function* iterJsonl(text: string): Generator<any> {
  // Tolerate \r\n, \n, \r, and trailing whitespace; skip blanks and non-JSON lines
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (!line) continue;
    try { yield JSON.parse(line); } catch { /* skip corrupt line */ }
  }
}
```

---

## Parser: Claude Code

### Current Status

- `detect()`: ✅ — `~/.claude/projects/` exists.
- `parseDir()`: ✅ — walks recursively and finds `.jsonl` files.
- `parse()`: ⚠️ Runs, but **every session ends up with 0 tokens** — so the sync inserts “nothing useful” and the UI shows the agent as empty.

### Root Cause

The parser is correctly reading `type: "assistant"` lines and pulling from `message.usage`. But on this machine the *active* assistant lines have `model: "<synthetic>"` with `input_tokens=0` / `output_tokens=0` (Claude Code’s placeholder for sub-agent or tool-loop turns). Real usage in current Claude Code (v1.x) is sometimes recorded under `cache_creation_input_tokens` / `cache_read_input_tokens` only, or under nested `server_tool_use` events; pure `input_tokens+output_tokens` totals legitimately read **0** for `<synthetic>` turns. Because nothing rolls those non-zero cache fields up and the model is filtered as empty, the resulting `ParsedSession` looks empty and the UI shows nothing.

### Actual Data Format

```json
{"type":"user","uuid":"...","timestamp":"2026-06-12T...","message":{"role":"user","content":[...]}}
{"type":"assistant","uuid":"...","timestamp":"...","message":{"id":"...","model":"<synthetic>","role":"assistant","usage":{"input_tokens":0,"output_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"server_tool_use":{...},"cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0}}}}
```

### Parser Expectation (`src/main.ts:368–510`)

```json
{"type":"assistant","message":{"model":"claude-3-5-sonnet-...","usage":{"input_tokens":N,"output_tokens":N}}}
```

### Fix

- **File:** `src/main.ts`, lines ~430–485 (the token-extraction block inside the `.jsonl` line loop in `parse()`).
- **Change:** (a) Treat **any** `type === 'assistant'` line with `message.usage` as a valid usage record — even when all four counts are 0. (b) **Always** add `cache_creation_input_tokens` to `cacheWriteTokens` and `cache_read_input_tokens` to `cacheReadTokens`. (c) Preserve `<synthetic>` as the model rather than dropping it (the user's frustration is “it shows nothing” — a zero-token session with model `<synthetic>` is still a real session). (d) Stop falling back to `entry.usage`/`entry.tokenUsage`/`entry.tokens` on non-assistant entries (none exist on this machine — it just creates noise).
- **Before:**
    
    ```tsx
    if (entry?.type === 'assistant' && entry?.message?.usage) {
      const u = entry.message.usage;
      if (u.input_tokens || u.output_tokens) {
        session.inputTokens  = (session.inputTokens  || 0) + (u.input_tokens  || 0);
        session.outputTokens = (session.outputTokens || 0) + (u.output_tokens || 0);
        session.model = entry.message.model || session.model || '';
      }
    } else if (entry?.usage || entry?.tokenUsage || entry?.tokens) {
      // legacy fallback ...
    }
    ```
    
- **After:**
    
    ```tsx
    if (entry?.type === 'assistant' && entry?.message?.usage) {
      const u = entry.message.usage;
      session.inputTokens       = (session.inputTokens       || 0) + toInt(u.input_tokens);
      session.outputTokens      = (session.outputTokens      || 0) + toInt(u.output_tokens);
      session.cacheWriteTokens  = (session.cacheWriteTokens  || 0) + toInt(u.cache_creation_input_tokens);
      session.cacheReadTokens   = (session.cacheReadTokens   || 0) + toInt(u.cache_read_input_tokens);
      // server_tool_use can carry additional input/output tokens on some versions
      if (u.server_tool_use && typeof u.server_tool_use === 'object') {
        session.inputTokens  += toInt(u.server_tool_use.input_tokens);
        session.outputTokens += toInt(u.server_tool_use.output_tokens);
      }
      // Keep <synthetic> visible so the session is not silently swallowed
      session.model = entry.message.model || session.model || '';
      session.messageCount = (session.messageCount || 0) + 1;
    }
    // Remove the entry.usage / entry.tokenUsage / entry.tokens fallback for Claude.
    ```
    
- **Edge cases:**
    - All four counts can legitimately be 0 — still emit the session (`messageCount` proves the turn happened).
    - `server_tool_use` is sometimes `null`, sometimes an object with `input_tokens`/`output_tokens` — type-check before adding.
    - `cache_creation` (object form) is a *breakdown* of `cache_creation_input_tokens` — do **not** double-count it.
    - `<synthetic>` model = keep as-is; the UI's per-model chart should treat it as a category, not a real model.
    - Use `toInt()` everywhere to defeat NaN/Infinity.

---

## Parser: Qwen CLI

### Current Status

- `detect()`: ✅ — `~/.qwen/projects/` exists.
- `parseDir()`: ✅ — walks `chats/` subdirs.
- `parse()`: ❌ — returns severely undercounted data (the `ui_telemetry` branch contributes 0 and the message count is halved).

### Root Cause

The parser has two branches. **Branch A** (`type === 'system' && subtype === 'ui_telemetry'`) reads `entry.systemPayload.uiEvent.input_token_count` / `output_token_count` — but those fields **don’t exist** in the live Qwen format; `uiEvent` only carries `event.name`, `event.timestamp`, `response_id`. So Branch A always adds 0. **Branch B** (`type === 'assistant'` with `usageMetadata`) has the right field names — but the message-count line later (~1159) does `Math.floor(vals.messageCount / 2)`, halving an already-correct count. Net result: token totals come only from Branch B (good) and message counts are halved (bad), making the agent look smaller than it is.

### Actual Data Format

```json
// type === "system", subtype === "ui_telemetry"  (no token fields)
{"type":"system","subtype":"ui_telemetry","timestamp":"...","sessionId":"...","systemPayload":{"uiEvent":{"event.name":"qwen-code.api_response","event.timestamp":"...","response_id":"chatcmpl-..."}}}

// type === "assistant"  (the real token source)
{"type":"assistant","timestamp":"...","sessionId":"...","model":"coder-model","usageMetadata":{"promptTokenCount":13472,"candidatesTokenCount":101,"thoughtsTokenCount":24,"totalTokenCount":13573,"cachedContentTokenCount":0}}
```

### Parser Expectation

```json
// Branch A expects fields that don't exist:
{"systemPayload":{"uiEvent":{"input_token_count":N,"output_token_count":N}}}
// Branch B is correct.
```

### Fix

- **File:** `src/main.ts`, lines ~1095–1165 (`QwenPlugin.parse` token branches + the post-loop messageCount calculation around 1159).
- **Change:** (a) **Delete Branch A** — `ui_telemetry` events on this machine carry no token data. (b) Keep Branch B as the sole source. (c) Map `thoughtsTokenCount` → `reasoningTokens` and `cachedContentTokenCount` → `cacheReadTokens`. (d) Remove the `Math.floor(messageCount / 2)` at line ~1159 — messageCount is already a 1-per-line counter limited to `type` in `{user, assistant}`.
- **Before:**
    
    ```tsx
    // Branch A (broken)
    if (entry?.type === 'system' && entry?.subtype === 'ui_telemetry') {
      const ui = entry?.systemPayload?.uiEvent;
      if (ui) {
        session.inputTokens  = (session.inputTokens  || 0) + (ui.input_token_count  || 0);
        session.outputTokens = (session.outputTokens || 0) + (ui.output_token_count || 0);
      }
    }
    // Branch B (works, but model line missing reasoning + cache fields)
    if (entry?.type === 'assistant' && entry?.usageMetadata) {
      const u = entry.usageMetadata;
      session.inputTokens  = (session.inputTokens  || 0) + (u.promptTokenCount     || 0);
      session.outputTokens = (session.outputTokens || 0) + (u.candidatesTokenCount || 0);
      session.model = entry.model || session.model || '';
    }
    // ... later:
    session.messageCount = Math.floor(vals.messageCount / 2);
    ```
    
- **After:**
    
    ```tsx
    // Branch A removed entirely.
    if (entry?.type === 'assistant' && entry?.usageMetadata) {
      const u = entry.usageMetadata;
      session.inputTokens      = (session.inputTokens      || 0) + toInt(u.promptTokenCount);
      session.outputTokens     = (session.outputTokens     || 0) + toInt(u.candidatesTokenCount);
      session.reasoningTokens  = (session.reasoningTokens  || 0) + toInt(u.thoughtsTokenCount);
      session.cacheReadTokens  = (session.cacheReadTokens  || 0) + toInt(u.cachedContentTokenCount);
      session.model            = entry.model || session.model || '';
      session.messageCount     = (session.messageCount     || 0) + 1;
    } else if (entry?.type === 'user') {
      session.messageCount     = (session.messageCount     || 0) + 1;
    }
    // ... later:
    // session.messageCount = Math.floor(vals.messageCount / 2);   ← DELETE this line
    ```
    
- **Edge cases:**
    - Files in `Vault/` etc. can be up to 58 MB — keep the existing `await new Promise(r => setImmediate(r))` yield every 10 files; add a within-file yield every 5000 lines if files grow past ~30 MB (prevents the renderer IPC from stalling).
    - `totalTokenCount` is **derived** — do not add it again. Sum only the four fields above.
    - Some assistant lines lack `usageMetadata` (streaming chunks) — skip silently; don't error.

---

## Parser: KiloCode

### Current Status

- `detect()`: ✅ — `~/.kilocode/globalStorage/kilo code.kilo-code/tasks` exists.
- `parseDir()`: ✅ — recurses into UUID-named subdirectories and finds `.json` files.
- `parse()`: ❌ — **no tokens anywhere** in the local files. Parser returns 0 sessions.

### Root Cause

KiloCode stores chat content (`api_conversation_history.json`, `ui_messages.json`) locally but **records token usage server-side**. Neither file contains any of `tokens`, `usage`, `cost`, `promptTokens`, or `completionTokens`. The current parser checks for `task.tokens.{promptTokens|completionTokens|input|output}` and finds nothing. Additionally, when KiloCode is running, the files are locked (`EACCES`/`EBUSY`) and the read crashes the walker for the rest of the directory.

### Actual Data Format

```json
// api_conversation_history.json
[
  {"role":"user","content":[{"type":"text","text":"<task>...</task>\n<environment_details>...Current Cost: $0.0312...</environment_details>"}],"ts":1718000000000},
  {"role":"assistant","content":[{"type":"text","text":"..."}],"ts":1718000001000}
]

// ui_messages.json (single object, NOT an array)
{"type":"say","say":"text","text":"...","ts":1718000002000}
```

### Parser Expectation

```json
{"task":{"tokens":{"promptTokens":N,"completionTokens":N}}}
```

### Fix

KiloCode needs a **different strategy**, not a field rename. Two paths, in priority order:

1. **Best-effort: scrape `Current Cost:` from `environment_details` blocks** inside user messages of `api_conversation_history.json`. Each task's last message often contains a running cost → use it as `cost` and **derive** an approximate `inputTokens`/`outputTokens` from message length only if a documented per-model rate is available; otherwise leave token fields undefined and emit the session with `messageCount`, `timestamp`, and `cost` populated.
2. **Lock-safe read.** Wrap every read in `readTextFileSafe()` (§0.3) so EACCES/EBUSY skips the one file, not the whole directory.
- **File:** `src/main.ts`, lines ~1357–1431 (`KiloCodePlugin`). Replace the body of `parse()` and harden `parseDir()`'s recursion.
- **Change:** (a) `parse()` now branches on filename: `api_conversation_history.json` → array reduce; `ui_messages.json` → ignore (no useful fields). (b) Each task = one `ParsedSession`, `sessionId = parent-dir UUID`. (c) `messageCount` = `arr.length` of `api_conversation_history.json`. (d) `cost` = last numeric value matched by `/Current Cost:\s*\$([0-9.]+)/` in any user message. (e) `timestamp` = `new Date(arr[0]?.ts ?? fs.statSync(filePath).mtimeMs)`. (f) Token fields **omitted** — explicitly leave `inputTokens`/`outputTokens` `undefined`, do not write 0 (so the UI can show “cost-only” agents distinctly).
- **Before:**
    
    ```tsx
    // parse() reads file as JSON and looks for task.tokens.* → always undefined here.
    const task = JSON.parse(text);
    const t = task?.tokens || {};
    if (t.promptTokens || t.completionTokens || t.input || t.output) { /* never hits */ }
    ```
    
- **After:**
    
    ```tsx
    async parse(filePath: string): Promise<ParsedSession[]> {
      const base = path.basename(filePath).toLowerCase();
      if (base !== 'api_conversation_history.json') return [];   // skip ui_messages.json
      const text = readTextFileSafe(filePath);
      if (!text) return [];                                       // locked file → skip
      let arr: any[]; try { arr = JSON.parse(text); } catch { return []; }
      if (!Array.isArray(arr) || arr.length === 0) return [];
    
      const taskDir = path.basename(path.dirname(filePath));      // UUID
      const firstTs = typeof arr[0]?.ts === 'number' ? arr[0].ts : fs.statSync(filePath).mtimeMs;
    
      // Cost scrape
      let cost: number | undefined;
      const re = /Current Cost:\s*\$([0-9]+(?:\.[0-9]+)?)/g;
      for (const msg of arr) {
        const content = Array.isArray(msg?.content) ? msg.content : [];
        for (const c of content) {
          if (typeof c?.text === 'string') {
            let m: RegExpExecArray | null;
            while ((m = re.exec(c.text)) !== null) {
              const n = parseFloat(m[1]); if (Number.isFinite(n)) cost = n; // keep last
            }
          }
        }
      }
    
      return [{
        sessionId: taskDir,
        timestamp: new Date(firstTs),
        messageCount: arr.length,
        projectPath: path.dirname(filePath),
        // inputTokens/outputTokens intentionally undefined (no local source)
        cost,
        model: undefined,                  // not recorded locally
        provider: 'kilocode',
      }];
    },
    
    async parseDir(dirPath: string): Promise<ParsedSession[]> {
      const out: ParsedSession[] = []; let i = 0;
      const walk = async (d: string) => {
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(d, { withFileTypes: true }); }
        catch (e: any) { if (e?.code === 'EACCES' || e?.code === 'EBUSY' || e?.code === 'EPERM') return; throw e; }
        for (const ent of entries) {
          const p = path.join(d, ent.name);
          if (ent.isDirectory()) { await walk(p); continue; }
          if (ent.isFile() && ent.name.toLowerCase() === 'api_conversation_history.json') {
            out.push(...(await this.parse(p)));
            if (++i % 10 === 0) await new Promise(r => setImmediate(r));
          }
        }
      };
      await walk(dirPath);
      return out;
    }
    ```
    
- **Edge cases:**
    - `ui_messages.json` is a **single object**, not an array — must skip; current parser likely `JSON.parse`s it fine but extracts nothing.
    - A task in progress will fail every read — must not throw; `readTextFileSafe` returns `null` and `walk` continues.
    - Some tasks have empty `api_conversation_history.json` (`[]`) — omit them; don't emit empty sessions.
    - **UX note:** the AI Tools KPI “Total Cost” can still credit KiloCode even without tokens; show `—` in the tokens column for KiloCode rows.

---

## Parser: Gemini CLI

### Current Status

- `detect()`: ✅ — `~/.gemini` and `~/.gemini/tmp` exist.
- `parseDir()`: ⚠️ — walks `tmp/<project_hash>/chats/`, but on this machine `logs.json` is **not at the expected path** (the path layout has drifted).
- `parse()`: ✅ if a real file is found; produces “something” when other projects exist, hence the user's perception that Gemini “shows” data.

### Root Cause

The user says Gemini “shows anything,” but the bundle confirms `~/.gemini/tmp/app-tracker/chats/logs.json` doesn't exist for this project. Most likely Gemini moved from a single `logs.json` to per-chat `.jsonl` files under `chats/`, with the `$set` MongoDB-style sentinel as the first line and `type === 'gemini'` lines following. Sessions are only being picked up for *some* projects.

### Actual Data Format (per the bundle)

```json
// First line: session header (no "type" field)
{"sessionId":"...","startedAt":"...","$set":{"projectId":"..."}}
// Subsequent lines:
{"type":"gemini","timestamp":"...","model":"gemini-2.5-pro","tokens":{"input":N,"output":N,"cached":N}}
```

### Parser Expectation (`src/main.ts:617–825`)

The parser already handles both shapes; the bug is **path discovery**, not parsing.

### Fix

- **File:** `src/main.ts`, lines ~635–700 (`GeminiPlugin.parseDir` and `getStoragePaths`).
- **Change:** (a) Glob both layouts: `tmp/*/chats/*.jsonl` AND `tmp/*/logs.json` AND `history/*.json`. (b) When neither yields files, fall back to a recursive walk of `~/.gemini/tmp` filtered by `.json`/`.jsonl`. (c) Add `path.basename(projectDir)` as `projectPath` so per-project rollups are accurate.
- **Before:**
    
    ```tsx
    // Only checks tmp/<project>/chats/ for files AND tmp/<project>/logs.json
    for (const proj of fs.readdirSync(tmpDir)) {
      const chats = path.join(tmpDir, proj, 'chats');
      const logs  = path.join(tmpDir, proj, 'logs.json');
      // ... narrow handling
    }
    ```
    
- **After:**
    
    ```tsx
    async parseDir(dirPath: string): Promise<ParsedSession[]> {
      const out: ParsedSession[] = []; let i = 0;
      const exts = new Set(['.json', '.jsonl']);
      const walk = async (d: string, project?: string) => {
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const ent of entries) {
          const p = path.join(d, ent.name);
          if (ent.isDirectory()) {
            // Treat first-level dir under tmp/ as the project bucket
            const proj = project ?? (path.dirname(d) === dirPath ? ent.name : undefined);
            await walk(p, proj);
          } else if (ent.isFile() && exts.has(path.extname(ent.name).toLowerCase())) {
            const sessions = await this.parse(p);
            for (const s of sessions) if (!s.projectPath && project) s.projectPath = project;
            out.push(...sessions);
            if (++i % 10 === 0) await new Promise(r => setImmediate(r));
          }
        }
      };
      await walk(dirPath);
      return out;
    }
    ```
    
- **Edge cases:**
    - `$set`-only header line: skip (current parse() already does).
    - Mixed UTF-8 BOM in older logs: handled by `readTextFileSafe`.
    - Some `chats/` files are huge JSON arrays not JSONL — if first non-whitespace char is `[`, treat as JSON array and iterate; current parse path may need a small branch added.

---

## Parser: Cursor

### Current Status

- `detect()`: ❌ — `%APPDATA%/Cursor/User/globalStorage/state.vscdb` does **not** exist.
- `parseDir()` / `parse()`: N/A — never reached.

### Root Cause

**Cursor is not installed on this machine.** Plugin is behaving correctly. The user's perception that it “shows nothing” is accurate but expected.

### Actual Data Format (for when Cursor is installed)

```
%APPDATA%/Cursor/User/globalStorage/state.vscdb   (SQLite)
  table: cursorDiskKV
    key:   bubbleId:<uuid>
    value: JSON blob with conversation + usage
```

### Parser Expectation

Matches the format above.

### Fix

No code change required. Two product-level recommendations:

- **Don't show the agent card when `detect()` returns false on first sync.** Currently `AGENT_CONFIG` lists Cursor even when it's not installed, leading the user to think it's broken. Hide cards whose plugin both (a) has 0 DB sessions ever and (b) returns `detect() === false`. Re-show automatically once detection passes.
- **If you want to verify the parser works,** install Cursor, run a small chat, then resync. The existing SQLite reader is correct per docs; verify on first real data.

### Edge cases

- `state.vscdb` can be locked while Cursor is running — open with `better-sqlite3` in `{ readonly: true, fileMustExist: true }` and catch `SQLITE_BUSY`; retry once after 200ms or skip.

---

## Parser: Aider

### Current Status

- `detect()`: ❌ — `~/.oobo/aider-analytics.jsonl` does **not** exist.
- `parseDir()` / `parse()`: N/A.

### Root Cause

**Aider is not installed on this machine** (and the analytics file is opt-in even when it is). The `~/.oobo/` directory doesn't exist. Plugin is behaving correctly.

### Actual Data Format (when present)

```json
{"event":"message_send","timestamp":"...","model":"gpt-4o","tokens_sent":N,"tokens_received":N}
{"event":"api_call","timestamp":"...","cost":0.012,"usage":{"prompt_tokens":N,"completion_tokens":N}}
```

### Parser Expectation

Matches; no change needed until the file exists.

### Fix

No code change. Same UX recommendation as Cursor: hide the agent card while `detect()` is `false` and DB has zero sessions. Add a small “Aider analytics is off by default — enable with `aider --analytics-log`” hint in Settings if the user opts to keep the card visible.

---

## Parser: GitHub Copilot

### Current Status

- **No plugin exists.** Not in `AI_AGENT_PLUGINS` (`src/main.ts:1434–1443`).

### Root Cause

GitHub Copilot is fundamentally **cloud-only** for chat/completions usage data. The VS Code extension stores some local cache, but token/cost telemetry is not exposed in a stable on-disk format. There is no local source equivalent to OpenCode’s SQLite or Claude’s JSONL.

### Recommendation (do NOT add a fake parser)

- **Skip writing a parser; integrate the official Copilot Metrics API instead.** That's a separate IPC + OAuth flow, not a file scraper.
- If a local-only signal is wanted as a stopgap, the only sane source is the editor extension's IndexedDB for chat history (path varies by VS Code variant); even then, tokens are absent. **Not recommended.**
- For now, **remove Copilot from `AGENT_CONFIG`** until the metrics API is wired. Pretending a parser exists is what made the user think the system is broken.

### Fix

- **File:** `src/renderer/IDEProjectsPage.tsx` (or wherever `AGENT_CONFIG` lives).
- **Change:** remove Copilot entry, or gate it behind `metricsApiEnabled === true`.
- **No `src/main.ts` change.**

---

## 9. Mandatory mitigation — invalidate the sync cache after deploying the fixes

Without this, the broken signatures already on disk will keep the plugins skipped.

- **File:** `src/main.ts`, in `loadAISyncState()` / `saveAISyncState()` callsite area (~1481–1554).
- **Add a schema-version bump:** the sync state JSON gains `version: 2` (or a `parserChecksum` of `AI_AGENT_PLUGINS.map(p => p.id).join('|') + parser-source-hash`). On mismatch, treat `prevState` as undefined and re-scan everything.
- **Or, one-shot:** ship a tiny migration that deletes the sync-state file on first run after upgrade.
- **Belt and braces:** add a “Force full resync” button next to **Sync AI** in the IDE Projects page header that calls `clearAISyncState()` then `syncAllAIAgents()`.

```tsx
const SYNC_STATE_VERSION = 2; // bump after parser changes

function loadAISyncState(): SyncStateV2 | undefined {
  try {
    const raw = fs.readFileSync(SYNC_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version !== SYNC_STATE_VERSION) return undefined; // forces full rescan
    return parsed;
  } catch { return undefined; }
}
```

---

## 10. Cross-cutting constraints — quick verification checklist

- [x]  Uses `better-sqlite3` for OpenCode + Codex + (future) Cursor with `{ readonly: true, fileMustExist: true }`.
- [x]  EACCES / EBUSY / EPERM handled in every file read via `readTextFileSafe`.
- [x]  Existing working parsers (OpenCode, Codex) untouched.
- [x]  `<synthetic>` model and all-zero usage entries no longer silently dropped.
- [x]  All numeric fields go through `toInt()` — no NaN/Infinity reaches `ParsedSession`.
- [x]  No additions to the `ParsedSession` interface.
- [x]  `await new Promise(r => setImmediate(r))` yields every 10 files in every walker.
- [x]  UTF-8 BOM stripped; mixed `\r\n`/`\n`/`\r` tolerated; corrupt JSONL lines skipped per-line.

---

## Summary Table

| Plugin | detect() | Has Data? | Root Cause | Fix Complexity |
| --- | --- | --- | --- | --- |
| **OpenCode** | ✅ | ✅ | — working | None |
| **Codex CLI** | ✅ | ✅ | — working | None |
| **Gemini CLI** | ✅ | ⚠️ Partial | Path drift: `logs.json` missing for some projects; `chats/*.jsonl` not always walked | **Low** — broaden walker + glob both layouts |
| **Claude Code** | ✅ | ✅ (but zeros) | `<synthetic>` turns log `input/output_tokens=0`; cache fields and `server_tool_use` ignored; sessions discarded | **Low** — sum cache + server_tool_use, keep `<synthetic>` sessions |
| **Qwen CLI** | ✅ | ✅ (undercounted) | Branch A reads non-existent `ui_telemetry.input_token_count`; Branch B works but messageCount halved by `Math.floor(…/2)` | **Low** — delete Branch A, drop the `/2`, map reasoning + cache |
| **KiloCode** | ✅ | ❌ (no tokens stored locally) | Tokens are server-side; local files only carry chat content + `Current Cost:` strings; reads also EACCES when KiloCode is running | **Medium** — scrape cost + messageCount, lock-safe reads, leave tokens undefined |
| **Cursor** | ❌ | ❌ | Cursor not installed on this machine (`%APPDATA%/Cursor` absent) | **None** — hide card while detect=false; verify when installed |
| **Aider** | ❌ | ❌ | Aider not installed; `~/.oobo/` absent (analytics is opt-in even when installed) | **None** — hide card; document `--analytics-log` opt-in |
| **GitHub Copilot** | N/A | N/A | No parser; no stable local source for tokens/cost — needs cloud Metrics API | **High** — separate OAuth/IPC project; remove card for now |
| **Sync cache** | — | — | `getDirDataSignature` skips plugins whose dir hasn’t changed, even if previous run was buggy and saved 0 sessions | **Low but required** — bump `SYNC_STATE_VERSION` and/or add “Force full resync” |

<aside>
✅

**Order of operations for the engineer:**

1. Add shared helpers (`toInt`, `readTextFileSafe`, `iterJsonl`).
2. Apply Claude / Qwen / KiloCode / Gemini fixes above.
3. Bump `SYNC_STATE_VERSION` so cached “zero sessions” state is invalidated.
4. Hide Cursor + Aider cards while detect=false; remove Copilot from `AGENT_CONFIG`.
5. Sync once with `Sync AI` → verify the four KPI numbers move for Claude Code and Qwen; KiloCode shows `messageCount` + `cost`; Gemini picks up additional projects.
</aside>
# Network audit — every outbound call in main + preload

Source of truth: `src/main.ts`, `src/main/**`, `src/preload.ts`.
Method: literal greps. Nothing here is from memory.

## Search results — literal

| Search | Result |
|---|---|
| `fetch(` | **23 hits** |
| `net.request` | **NOT FOUND** |
| `net.fetch` | **NOT FOUND** |
| `https.request` / `http.request` | 1 hit, `dist-electron/main/terminalRelay.cjs:2820` — inside the inlined `ws` library, not RHEO code. **No source-level hit.** |
| `axios` | **NOT FOUND** (the single hit, `src/main/archMap/scanner.ts:141`, is a regex string that *detects* axios in scanned projects) |
| `WebSocket` | RHEO source: `src/main/terminalRelay.ts:176` `new WebSocketServer({host, port})` = **inbound listener**. `src/main.ts:11075` builds a `ws://` URL **string** for the renderer. All other hits are the bundled `ws` lib. |
| `autoUpdater` | `src/main/autoUpdate.ts:99–147` |
| `openai` | provider templates / pricing / labels only. No direct host call. `src/main.ts:9002` sets STT default to a **Groq** OpenAI-compatible endpoint. |
| `openrouter` | `src/main.ts:20461`, `20645`, `20692`, `20622` |
| `ollama` | `src/main.ts:4837` loopback only |
| `anthropic` | model-ID strings and a pricing table only. **No anthropic.com host anywhere.** |

## Preload

`src/preload.ts` — `fetch(`, `XMLHttpRequest`, `axios`, `WebSocket`, `EventSource`,
`http.request`, `net.*`: **zero hits.** The preload makes no network calls; it only
exposes `ipcRenderer.invoke` wrappers.

---

## A. `src/main/autoUpdate.ts:130,147` — GitHub Releases

- **Host:** GitHub Releases feed via `electron-updater` (default provider; `setFeedURL` never called).
- **Sends:** updater request — platform, current version, install identifiers. No user data.
- **Trigger:** opt-in, doubly. `app.isPackaged` must be true (line 70) — false for
  any dev/`npm start` run — **and** `electron-updater` must resolve. Then one
  fire-and-forget check per 24 h (`MIN_INTERVAL_MS`, line 31).
- **Note:** `autoDownload = true` (line 103) — downloads the payload, installs on quit.
- No user opt-out exists. `--minimized` launches still reach `whenReady`.

## B. `src/main.ts:20461` — `https://openrouter.ai/api/v1/chat/completions` (streaming)

- **Sends:** `systemPrompt` + `userPrompt` verbatim in the POST body, plus `Authorization: Bearer <key>`.
- **Trigger:** opt-in. Throws `'No OpenRouter API key configured'` (line 20460) unless
  a key is in preferences, the `preferences` SQLite table, or `OPENROUTER_API_KEY`
  (resolver 20291–20321). Callers are user actions: app colouring, session summarising.

## B2. `src/main.ts:20645, 20692` — same host, non-streaming

- **Sends:** short system prompt + user message; line 20692 sends the literal `'Say OK'`, 10 max tokens.
- **Trigger:** opt-in, user-triggered only — `test-openrouter-key` (20610), the "test key" button.

## B3. `src/main.ts:20622` — `https://openrouter.ai/api/v1/auth/key`

- **Sends:** only the API key, as a bearer token, `GET`.
- **Trigger:** opt-in, user-triggered (same handler as B2).

## C. `src/main.ts:4837` — `http://localhost:11434/v1/chat/completions`

- **Sends:** `model`, `imageBase64`, `textPrompt`.
- **Trigger:** loopback — **nothing leaves the machine.** `ollama-chat` fires only when
  the renderer invokes it (preload `ollamaChat`, `src/preload.ts:1962`).

## D. `src/main.ts:9269` — `baseUrl`, default `https://api.groq.com/openai/v1/audio/transcriptions`

- **Sends:** recorded **audio as a multipart upload** (`form.append('file', new Blob([audioBuf])...)`, lines 9257–9258), plus bearer key.
- **Trigger:** opt-in. Rejects with `'No speech API key configured'` when `sttApiKey`
  is empty (line 9222).
- **Note:** comments at line 9049 designate local `faster-whisper` as the primary
  engine; this cloud path is explicitly a fallback.

## E. `src/main.ts:19981` — `https://api.github.com/repos/${owner}/${repo}/commits`

- **Sends:** repo coordinates, optional `Authorization: Bearer <token>`.
- **Trigger:** opt-in, user-triggered — `sync-github-commits` (19965). Per-project, IDE feature.

## F. `src/main/gas/client.ts:31, 78` — `${webappUrl}/__/functions/gasSync` (Google Apps Script)

- **Sends:** **fact/triples about your activity** — `Triple[]` of
  `{subject, predicate, object, confidence, sourceEpisodeId}` (`context-mirror.ts:34–42`),
  or an export blob (`GasExportPayload`). Bearer auth token.
- **Trigger:** opt-in, doubly. `loadGasSecrets()` returns `null` unless
  `userData/gas-secrets.json` has both `webappUrl` and `authToken` (`secrets.ts:21–33`);
  both `post` and `get` bail with `GAS_NOT_CONFIGURED`. Only `registerGasHandlers` is
  wired at startup (`main.ts:4919`) — **handlers only**, they register IPC and send nothing.
- **The nightly scheduler never runs.** `src/main/gas/scheduler.ts` (default 3 AM,
  24 h interval, line 71) is **never imported by `main.ts`** — grep for `gas/scheduler`
  across `src/main.ts` and `src/main/**` returns nothing. Its own guard (line 80) would
  skip anyway without secrets. Sync happens only when the user calls `gas:sync`.

## G. `src/main.ts:5697, 10993, 11040, 11106, 11127, 11151, 11206, 11245, 11269, 11293, 11311` — `${syncUrl}`

- **Host:** user-configured sync server. `syncUrl` = `SYNC_URL` env or the literal
  loopback default `http://127.0.0.1:8787` (line 5680); changeable via
  `auth:update-sync-url` (11191).
- **Sends:** credentials (`refreshToken`, email/password on login/register, pairing
  codes) and bearer tokens. `GET` reads for device list and phone-telemetry
  live/summary; `POST`/revoke for device management. **`phone/telemetry/*` are GET
  reads** (11206, 11245) — the desktop pulls, it does not emit.
- **Trigger:** opt-in. `startSyncAgent` (5735) early-returns with no token, and every
  handler guards on `getSyncTokenForRelay` returning one. **The default target is
  loopback** — an unconfigured install talks to `127.0.0.1`, not the internet.
- **This is the one path that pushes real data on a timer:**
  `syncIntervalId = setInterval(..., 20_000)` at line 5781, calling `syncAgent.sync()`.
  Terminal-message ciphertext is AES-encrypted, but see the comment at `main.ts:5752` —
  `SYNC_ENC_KEY` decoding "stops at the first non-hex character and yields a 1-BYTE
  buffer… 8 bits of key material means 256 possible keys". **Runs only after a successful login.**

## H. `src/main.ts:6786` — `fetch('/index.html', {method:'HEAD'})`

- **Host:** the app's own local HTTP server. Sends nothing outbound.
- **Trigger:** default, but it is a **relative URL inside an HTML string** served to the
  renderer when `dist/index.html` is missing. Loopback self-check, not egress.

## I. `src/main.ts:12325–12367, 12420–12497` — design registries

- **Hosts:** `ui.aceternity.com` / `aceternityui.com` (12329–12330, 12366–12367);
  `styles.refero.design` / `refero.design` (12442–12443).
- **Sends:** nothing but the slug in the URL path.
- **Trigger:** opt-in, user-triggered — from `DesignWorkspacePage`,
  `ComponentBrowserModal`, `GlobalSearch`, `LibraryConfigModal` when the design
  browser is opened.

---

## Two findings that invert the landing page's claim

**1. The GAS mirror sends activity-derived facts to a Google-hosted endpoint.**
Payload is `Triple[]` built from Context Brain facts; the file's own header comment
reads *"Context Brain Cloud Mirror"* with *"Privacy tier: facts/triples ONLY — never
raw episodes."* The nightly scheduler is unwired, so it is inert today — but the code
exists, is 24 h-interval-ready, and is user-configurable to a real endpoint. That is
not telemetry, and it is not "0 bytes leave your machine."

**2. Auto-update is not opt-in in the way the ledger implies.** Once packaged, it
auto-checks daily with `autoDownload = true`, no user consent, no opt-out.

## Verdict on the three Ledger claims

| Claim | Verdict | Reason |
|---|---|---|
| "0 bytes that leave your machine" | **FALSE as written** | Six egress paths (A–I). Four are user-keyed or opt-in; `F` and `G` transmit genuine activity data once configured; `A` fires unprompted in packaged builds. |
| "0 telemetry events, ever" | **NOT PROVEN** | No analytics SDK in main or preload — that part is real. But GAS facts and sync payloads are data exports, not telemetry, and both are opt-in-by-design rather than absent. "Ever" is unsupportable. |
| "1 SQLite file is your entire history" | **HOLDS** | No `PRAGMA journal_mode=WAL` anywhere, so no `-wal` sidecar. The JSON files are configs (`auto-assign-config.json`, `gas-secrets.json`, `authStore`), not history. |

## Honest rewrite for the landing page

The true claim is *"nothing leaves unless you connect something"* — not *"nothing ever
leaves."* The first is defensible. The second is not. Say which, and name the six paths.
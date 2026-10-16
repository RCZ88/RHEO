# Round 03 — renderer network audit + AI Assistant trace

Method: literal greps over `src/`, split renderer vs main. Lines quoted, no summaries.

## Corrections to round 02 (accepted, not argued)

1. **Item A mislabelled.** I wrote "opt-in, doubly" for the update check and then
   described `autoDownload = true` with no opt-out in the same paragraph. Read together
   that is **default-on in packaged builds**. The verdict table was right; the item was wrong.
2. **"Six egress paths" did not match the A–I list.** A–I is **nine items**. The count was
   invented rather than counted.
3. **`SYNC_ENC_KEY` is a launch blocker, not a footnote.** `src/main.ts:5752` — decoded key
   "stops at the first non-hex character and yields a 1-BYTE buffer… 8 bits of key material
   means 256 possible keys, so every stored terminal-message ciphertext is brute-forceable."
   Verified by executing the real path, per that comment. **The docs must not say sync is
   encrypted until this is fixed.**

---

## 1. Renderer grep results — literal

Scope `src/` excluding `src/main`. Note that `src/infrastructure/ipc/**`,
`src/services/**`, `src/domains/**` are **main-process code imported by `main.ts`**
(verified: `main.ts:93-99` imports the ipc handlers; `main.ts:20776` `require`s
`AIService`; `main.ts:21546` `require`s `callProvider`; `main.ts:4819` `require`s
`services/vision`). Only `src/pages`, `src/components`, `src/hooks`, `src/features`,
`src/app` are renderer.

| Search | Renderer result |
|---|---|
| `fetch(` across `src/` minus `src/main` | 29 hits, of which **2 are true renderer** (below). The rest live in main-imported service/ipc modules. |
| `net.request` | **NOT FOUND** |
| `net.fetch` | **NOT FOUND** |
| `https.request` / `http.request` | `src/services/vision/index.ts:38` — **main-process**, `require`d at `main.ts:4819`. Not renderer. |
| `axios` | 2 hits, both **main-process**: `src/services/design/FontsInUseScraperService.ts:1,61` and `CariScraperService.ts:1,61`, `require`d at `main.ts:73-75`. **Not renderer, and never invoked from renderer.** |
| `new WebSocket(` / `EventSource(` | **NOT FOUND** in renderer. |

### The only two true renderer egress sites

**`src/components/finance/currency-data.ts:59`**
```
const res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
```
- **Host:** `api.exchangerate-api.com`
- **Sends:** nothing but the URL. No body, no headers, no user data.
- **When:** `fetchLiveRates()`, called from `src/pages/FinancePage.tsx:94` on Finance page
  load, behind a 30-minute cache (`RATES_CACHE_TTL`, line 51) and a hardcoded fallback
  table (`EXCHANGE_RATES`) if the call fails.
- **Default or opt-in:** **runs by default the moment you open the Finance page.** It is
  a third-party call with no key and no consent step, and it reveals that the user opened
  a currency page to that host. Not telemetry about *you*; it is still an unasked call.

**`src/hooks/useAiPageData.ts:69`**
```
fetch();
```
**NOT NETWORK.** That is the hook's own local `const fetch = useCallback(...)` — its own
name. It calls `bridge()` IPC methods. Listed only because the grep hit it; it sends nothing.

### Renderer verdict

No analytics SDK, no tracking beacon, no WebSocket, no EventSource, no telemetry in the
renderer. One unkeyed third-party fetch, gated behind opening Finance.

---

## 2. AI Assistant trace — button to network, with lines

The page sells this: *"It answers against your record, and cites the sessions it used."*

### The chain

1. **`src/pages/AiPage.tsx:1285`** — `chat.send(text, images)` is the submit path.
   `useAiChat` is imported at `AiPage.tsx:29`.

2. **`src/hooks/useAiChat.ts:452`** — builds the system prompt:
   ```
   const bundle = await buildContextBundleDetailed()
   systemPrompt = bundle.content
   ```

3. **`src/hooks/useAiChat.ts:478-482`** — assembles the payload:
   ```
   const payloadMessages = [
     { role: "system", content: systemPrompt + memorySuffix },
     ...history,
     { role: "user", content: userContent },
   ]
   ```

4. **`src/hooks/useAiChat.ts:565-569`** — sends it:
   ```
   await (b.providerChatCall as ...)({ provider: target.provider, messages: payloadMessages, model: target.model })
   ```

5. **`src/preload.ts:1532-1533`** — the IPC hop:
   ```
   providerChatCall: (data: {...}) => ipcRenderer.invoke('provider-chat-call', data)
   ```

6. **`src/main.ts:21558`** — the handler `provider-chat-call`, which resolves a provider
   config and calls `callProvider` (`main.ts:21565`).

7. **`src/services/providers/callProvider.ts:64`** — the actual HTTP:
   ```
   response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
   ```
   `url` is `config.baseUrl || template.defaultBaseUrl` (line 16).

### Which host receives it

**Whichever provider the user configured.** Every `defaultBaseUrl` in
`src/services/providers/templates.ts`:

```
http://127.0.0.1:4000/v1/chat/completions                        (loopback — llama.cpp)
http://localhost:11434/v1/chat/completions                      (loopback — Ollama)
https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1/chat/completions
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
https://models.inference.ai.azure.com/chat/completions
https://openrouter.ai/api/v1/chat/completions
```

**It is NOT OpenRouter by default.** The main-process OpenRouter callers
(`main.ts:20461/20645/20692`) are app colouring, session summarising, and the key-test
button — none of them is the AI chat screen. The chat screen goes through the generic
`callProvider` fan-out, and a local provider is a first-class option. That is a
meaningfully better answer than round 02 implied.

### Do session rows go into the prompt? YES.

`buildContextBundleDetailed` (`src/services/aiContextBundle.ts:201`) reads, via IPC, and
appends to `lines`:

| Line | Data pulled into the system prompt |
|---|---|
| 205-213 | `getGoals(today)`, `getLongtermGoals()`, `getGoalContext()`, `getAIUsageSummary("today")`, `getProjects()`, `readPlanningMd()`, `getSleepForDate(today)`, `getExternalSessions('today')` |
| 264-268 | `getDashboardAggregates({period:"today"})` → **"Today's app usage"** — the per-app totals, i.e. your actual record |
| 319 | "### Today's goals" |
| 327 | "### Planning notes" |
| 329-331 | sleep hours + quality |
| 332-338 | off-device activity, up to 5 entries |
| 355-362 | finance summary, wallets (name/type/balance/currency), subscriptions — **gated** |
| 272-281 | connector inventory, and for connected ones, **5 email subjects with sender addresses** or **3 calendar event summaries** (lines 333-347) |
| 397-410 | auto-derived user profile: traits, interests, habits, communication style, each with confidence and occurrence counts |
| 292-308 | existing canvas card contents |

**The finance lock is real and works.** Lines 240-266 implement it fail-closed:
```
let financeLocked = true; // fail closed
try {
  const lockRes = await (b as any)?.financeIsLocked?.();
  financeLocked = lockRes?.locked !== false;
} catch { financeLocked = true; }
```
Only when `financeLocked` is false does it pull `financeGetSummary`, `financeGetWallets`,
`financeGetSubscriptionIntelligence`. The comment at 237-239 records that this was added
after finance data leaked while the module was locked. That fix is real and should be
stated as such.

**The lock covers Finance only.** Every other row in that table — app usage, goals,
planning notes, sleep, off-device activity, email subjects with sender names, calendar
entries, derived psychological traits — goes in regardless.

### Everything is logged locally before and after

`src/main.ts:21563` and `21576`:
```
vaultLogSafe({ source: 'ai-assistant', event: 'prompt', ..., payload: { messages: data.messages } })
vaultLogSafe({ source: 'ai-assistant', event: 'output', ..., payload: result.content, ... })
```
`src/services/aiDebugVault.ts:313` documents it: *"captures: prompt, output, thinking"*.
Local, not outbound — but it means the full prompt including your app usage is persisted
to disk on every question.

---

## 3. What this changes about the page

**The claim "0 analytics or tracking code in the app" survives the renderer check.**
Nothing in `src/pages`, `src/components`, `src/hooks`, `src/features` or `src/app`
contains an analytics SDK, a tracking beacon, a WebSocket, or an EventSource. That was
the open question and it is now answered with greps, not inference.

**But three things still go out that the page must not deny:**

1. `fetchLiveRates()` hits `api.exchangerate-api.com` **by default** when Finance opens.
2. The AI prompt carries your **app usage, goals, planning notes, sleep, off-device
   activity, email subjects with sender addresses, and derived traits** — to whichever
   provider you configured. Local providers are available and are the honest default story.
3. The update check is **default-on in packaged builds**, and downloads without consent.

**And one launch blocker that is not about the page:** the sync encryption key. Fix the
1-byte key before launch, and until then no documentation may claim sync is encrypted.

## 4. Footer bugs confirmed

- **`0 BYTES TO CLOUD`** in the footer — false under all three findings above.
- **`v0.1`** in the footer — product is `v0.2.0` (`Download.tsx:14`, `VERSIONS[0]`).

## 5. Recommended Ledger, now that the renderer is checked

| # | Claim | Evidence |
|---|---|---|
| **1** | network call runs by default — the update check. Sends platform + version, nothing else. | `autoUpdate.ts:147`, gated only on `app.isPackaged` |
| **0** | analytics or tracking code in the app | renderer grep: no SDK, no beacon, no WebSocket, no EventSource |
| **1** | SQLite file holds your history | no `PRAGMA journal_mode=WAL`; JSON files are configs |

Then the rule: **everything else needs your key, your provider, or opening a page that
asks for it.** That is true and checkable. Add an auto-update toggle, fix the footer, and
stop claiming encryption until `SYNC_ENC_KEY` is fixed.
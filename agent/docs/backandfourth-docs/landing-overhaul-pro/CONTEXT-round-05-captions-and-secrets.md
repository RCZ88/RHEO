# Round 05 — answers to REQUEST D and E

Method: greps + reading `node_modules/electron-updater` source (v6.8.9). Quoted lines.

---

## REQUEST D — the 17 captions, the 4 phase blurbs, the 5 changelog entries

### D1. The `#act-record` PHASES block — typed by hand. This is a fabricated readout.

`landing/src/components/rheo/ActRecord.tsx:25-58`, quoted:

```ts
const PHASES: Phase[] = [
  { key: "REST",       range: "23–06", startH: 23, endH: 30, total: 420, blurb: "Recovery is a phase, not a gap. RHEO guards it." },
  { key: "DEEP WORK",  range: "09–12", startH: 9,  endH: 12, total: 180, blurb: "Unbroken focus. The record marks its depth, not just its length." },
  { key: "MEETINGS",   range: "12–14", startH: 12, endH: 14, total: 120, blurb: "Context switches, logged. Later you see what they cost." },
  { key: "LEARNING",   range: "19–21", startH: 19, endH: 21, total: 120, blurb: "Study compounds. The timeline remembers every session." },
];
```

**Answer to your direct question: typed by hand.** Nothing computes these. There is no
query, no DB read, no derivation. `total: 420` is a literal. The ranges are literals.
`420 = 7h`, `180 = 3h`, `120 = 2h × 2` — and `420 + 180 + 120 + 120 = 840 min = exactly
14 hours`, which is a suspiciously round total for a human day. That is the shape of an
illustrative example, not a measurement.

**This breaks the no-fabricated-readouts rule the same way the `1,204,032 s` counter did.**
It is currently rendered as a live record with a scroll-scrubbed video behind it, which
makes it read as *your* day. Needs a label — "A sample day" — exactly as you ruled.

### D2. The four blurbs — what code makes each true

| Blurb | Verdict | Code |
|---|---|---|
| "Recovery is a phase, not a gap. RHEO guards it." | **not found** — no sleep-protection code path is described by this string, and the `REST` phase is a hardcoded literal, not a detected sleep window. Sleep *detection* exists (`deskflow-sleep-detection.json`, `src/main.ts:5237`) but nothing in this section reads it. |
| "Unbroken focus. The record marks its depth, not just its length." | **not found** in `src/` — no focus-depth implementation was located. There *is* a `deep_focus_sessions` table in the live DB, which suggests it exists somewhere I have not found. **I have not read that code.** Do not ship this line until someone quotes it. |
| "Context switches, logged. Later you see what they cost." | **partially found** — `logs` and `productivity_sessions` do record per-app sessions, and switching app produces a new row. But "what they cost" implies an attribution number, and I have not found one. **Unverified.** |
| "Study compounds. The timeline remembers every session." | **not found** as a computation. `learn_*` tables exist in the live DB. I have not read them. **I have not read it.** |

**Honest position: 0 of 4 blurbs are verified.** I am not going to describe them from
their filenames after round 04's retraction. Three of them assert behaviour I have not
found code for; one asserts a metric that may not exist.

### D3. The 17 captions

Most are descriptive of a screenshot and carry no falsifiable claim. The four that do:

| Caption | Line | Verdict |
|---|---|---|
| `ai` — "It answers against your record, and cites the sessions it used." | `Gallery.tsx:73` | **FALSE.** Round 04 REQUEST C: **NOT FOUND** for citations. The first clause is true (round 03 traced app usage into the prompt); the second has no code. Delete the clause. |
| `database` — "One SQLite file on your disk. Browse it. It's yours." | `Gallery.tsx:77` | **FALSE.** `journal_mode = WAL` (`main.ts:27306`), three files live. Your replacement copy is correct. |
| `settings` — "Local-first by default. Zero telemetry." | `Gallery.tsx:82` | **Overstated.** No analytics SDK exists anywhere (round 03 renderer grep). But "zero telemetry" is the phrase we banned. "No analytics code." per your table. |
| `dashboard` — "The whole day on one surface — depth, not duration." | `Gallery.tsx:68` | **Unverified.** Asserts a weighted-depth feature. I have not read the aggregation code. |

The remaining 13 (`activity`, `insights`, `life`, `learn`, `finance`, `ide`, `rankings`,
`labs`, `studio`, `guide`, `lecture`, `profiler`, `console`) are either screenshot
descriptions or product claims I have not verified. Flagging that rather than asserting.

One of them is worth calling out anyway — `profiler`: **"RHEO measures itself with RHEO."**
That is a nice line and it is checkable: `src/main/autoUpdate.ts:59` logs the updater
loading, and `terminalRelay.ts:186` logs a bind failure. Real, but it is log output, not
a performance profiler. The live DB does have a `dora_metrics` table. **I have not read
it.** Flagged, not cleared.

### D4. The five changelog entries

`Download.tsx:13-19`, `VERSIONS`. Verdict per entry:

| Version | Entry | Verdict |
|---|---|---|
| v0.2.0 (2026-09-30) | "Chat Library — every AI conversation is kept, searchable, pinnable, groupable, exportable" | **TRUE.** `ai_chat_threads`, `ai_chat_groups`, `ai_chat_messages`, `ai_chat_fts` all present in the live DB. Verified. |
| v0.2.0 | "Dashboard rebuilt around a widget registry, with jump-to-widget navigation and persisted layouts" | **Unverified** — not read. |
| v0.2.0 | "Native find bar now really highlights each match and scrolls it into view" | **Unverified** — not read. |
| v0.1.0 | "First public preview build. Timeline, phases, AI-understand, lessons engine." | **TRUE** as a release statement. |
| v0.1.0 | "Local-first by default. Zero telemetry. macOS / Windows / Linux." | **"Zero telemetry" is the banned phrasing.** Reword per your table. |
| v0.1.0 | "Reduced-motion mode renders scrub sections as static panels." | **TRUE** — verified in round 01, motion-off path renders static. |
| v0.0.7 | "Added cited-session chips under every AI answer — receipts, not guesses." | **FALSE.** Round 04 REQUEST C: **NOT FOUND.** No citation code exists anywhere in `src/`. **Delete or mark unreleased.** |
| v0.0.7 | "Lessons now redraw when a referenced session is deleted or re-tagged." | **Unverified** — not read. |
| v0.0.9 | "Refined phase-detection heuristics — fewer false 'meeting' tags during solo calls." | **MISLEADING.** Round 04: phases are user-set, and the one detector is wired to zeros. There is no heuristic that "refined." **Delete.** |
| v0.0.9 | "Dashboard donut now reflects weighted depth, not raw duration." | **Unverified** — not read. Same claim as the `dashboard` caption. |
| v0.0.8 | "Fixed a rare crash when a session spanned midnight across timezones." | **Unverified** — not read. |
| v0.0.8 | "Stopped the AI panel re-querying on every keystroke; Enter is now explicit." | **Unverified** — not read. |

**Three of the five versions carry a claim that is false or misleading** (v0.0.7 citations,
v0.0.9 phase heuristics, v0.1.0 "zero telemetry"). The changelog sits directly under the
Ledger, which is the worst place for unsupported claims.

**Naming convention, so you can tell what was checked:** three verdicts are in caps
because they contradict something. Everything "Unverified" is a gap in *my* reading, not
a claim that the entry is wrong — seven entries still need someone to read the code.

---

## REQUEST E

### E1. API keys — stored **plaintext**. `safeStorage` is **NOT FOUND**.

```
$ grep -rn "safeStorage" src/ dist-electron/main.cjs
(empty)
```

Electron's OS-keystore API is not used anywhere in RHEO. The OpenRouter key resolves
through this chain (`src/main.ts:20291-20321`):

```ts
function getOpenRouterApiKey(): string {
  let prefsKey = userPreferences?.openrouterApiKey || '';        // deskflow-prefs.json
  ...
  const row = db!.prepare('SELECT value FROM preferences WHERE key = ?').get('openrouterApiKey')
  ...
  let envKey = process.env.OPENROUTER_API_KEY || '';
}
```

Three plaintext stores: `deskflow-prefs.json` on disk, a `preferences` table in the
plaintext database, and an environment variable. The STT key is the same —
`userPreferences.sttApiKey` (`main.ts:9291`). Provider configs land the same way
(`main.ts:21131` — `userPreferences.openrouterApiKey = config.apiKey`).

**This is worse than the sync-key issue for a privacy brand, and it is easier to fix.**
Any process reading that database — including anything that copies it, and it is a
plaintext 122 MB file — reads every provider key. Anyone with the `preferences` table can
exfiltrate them.

Recommendation: `safeStorage.encryptString` / `decryptString` on write. It is a
five-line change per key. **OPEN: I have not checked whether any key is ever logged.**

### E2. `stt-rec-*` files — **yes, deleted**. Clean.

`src/main.ts:9285-9286`, inside a `finally`:

```ts
} finally {
    try { fs_1.default.unlinkSync(audioPath); } catch { /* ignore */ }
    try { fs_1.default.unlinkSync(scriptPath); } catch { /* ignore */ }
}
```

`finally` means it runs even if the transcription throws or the process is in a bad
state. `overlay-studio-transcribe.py` is also unlinked at `9371`. **No `stt-rec-*`
residue on a clean run.** Item closed — you can drop it from section 6.

### E3. What `electron-updater` sends. Library read, v6.8.9.

The check request, `node_modules/electron-updater/out/providers/GitHubProvider.js:40-45`:

```js
async getLatestVersion() {
    const feedXml = (await this.httpRequest((0, util_1.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), {
        accept: "application/xml, application/atom+xml, text/xml, */*",
    }, cancellationToken));
```

Header assembly, `providers/Provider.js:59-71`:

```js
createRequestOptions(url, headers) {
    const result = {};
    if (this.requestHeaders == null) {
        if (headers != null) { result.headers = headers; }
    }
    ...
    configureRequestUrl(url, result);
    return result;
}
```

**So: the request is a `GET` to `<repo>.atom`, and the only header RHEO's code sets is
`accept`.** No `Authorization`, no API key, no device id, no user id. `this.requestHeaders`
is `null` unless `addAuthHeader()` is called (`AppUpdater.js:49-52`) — grep found no call
to it in RHEO's source.

**What the server still learns, because it is an HTTP request:** source IP, and whatever
the URL itself encodes. The default provider is GitHub, so the URL is the repo's public
release feed — no per-install identifier in the path.

One more header exists and RHEO does trigger it. `AppUpdater.js:387`:

```js
client.setRequestHeaders(this.computeFinalHeaders({ "x-user-staging-id": stagingUserId }));
```

and `getOrCreateStagingUserId()` at line 499 writes `path.join(this.app.userDataPath,
".updaterId")`. **OPEN: I have not read the staging-path guard.** In electron-updater
that id is only sent when the release config enables staged rollouts, and RHEO has no
`app-update.yml` (it is unpackaged), so it should never fire — but I have not read the
condition, so it is marked OPEN rather than claimed.

### E3 verdict for the docs

> **Update check.** In packaged builds RHEO checks GitHub for a newer version once a day
> and downloads it in the background. The check is a `GET` to the project's release feed.
> It sends no API key, no account id and no identifier — only the standard headers your
> network stack adds.

That is now quotable from library source rather than assumed. **Named in `/docs/network`
only with the `-shm`/`-wal` caveat removed from E3 and the staging-id OPEN attached.**

---

## Net effect on your step 1 sweep

Three new false claims beyond your table, all in files you already have open:

| Add to sweep | File:line | Why |
|---|---|---|
| `total: 420 / 180 / 120 / 120` + the 24h ranges | `ActRecord.tsx:31,37,43,49` | hand-typed, sums to exactly 14h, rendered as a live record |
| `Refined phase-detection heuristics` | `Download.tsx:16` (v0.0.9) | no heuristic exists; the detector is wired to zeros |
| `Zero telemetry` | `Download.tsx:15` (v0.1.0) | your table already has it for the Gallery caption; it is **also** in the changelog |

And one new backend item for section 6, ahead of the sync key:

- **API keys are plaintext in two places** (`deskflow-prefs.json` + the `preferences`
  table), `safeStorage` unused. Affects every provider, not just sync. Cheaper to fix and
  more damaging than the sync key.

## Still OPEN, stated as OPEN

- Four phase blurbs and four gallery captions: **not read.** I am not clearing them.
- Seven changelog entries: **not read.**
- `x-user-staging-id` guard: **not read.**
- Whether any key is logged: **not checked.**
- The 50 source-less tables: counted, not diffed.
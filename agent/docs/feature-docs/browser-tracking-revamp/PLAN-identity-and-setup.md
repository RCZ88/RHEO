# Browser Tracking: Identity + Zero-Config Setup Plan

## The one-sentence diagnosis

The identity seam is broken in exactly one place. `browser-extension/background.js:118`
already knows `BROWSER_NAME` and `state.profileId`, but it only sends them **once**, to
`POST /browser-identify`. Every subsequent `POST /browser-data` payload carries `profileId`
and **no browser name at all** (`background.js:383`, `background.js:423`). So the app can
never attribute a website to a browser — `logs.browser_name` (added `main.ts:2233`) is
written from `data.browser_name` at `main.ts:20013`/`20114` and is therefore **always NULL**.

Worse, in-memory session state is keyed by **domain only**:

```ts
// main.ts:19979
const existingSession = activeBrowserSessions.get(data.domain);
```

Two browsers on the same site collapse into ONE row: durations add together, and
`browser_name` is overwritten by whichever reported last. This is the root cause of
"two extensions, one per browser" not working.

---

## Phase 1 — Make attribution work (data plumbing, no UI)

| # | Change | Where |
|---|---|---|
| 1.1 | `logs` += `profile_id TEXT` + index | `main.ts` ~2233 (next to `browser_name` migration) |
| 1.2 | Extension sends `browserName` in EVERY data payload | `background.js:383`, `background.js:423` |
| 1.3 | Session key becomes `profileId::domain` | `main.ts:19979`, `20067`, `20125`, `20138`, `20143` |
| 1.4 | Persist `profile_id` + `browser_name` on INSERT and UPDATE | `main.ts:20012`, `20113` |
| 1.5 | Server-side fallback: remember which profile each HTTP connection belongs to, so even an OLD extension (no `browserName`) still attributes correctly | new `extensionSessions` map near `main.ts:4970` |

1.3 is the fix the user is really asking for. 1.5 is what makes it robust: the app learns
"this request came from the extension that identified itself as Brave" and stamps the row
even if the payload omits the field.

## Phase 2 — Make connection state TRUE (so setup feels live)

| # | Change | Where |
|---|---|---|
| 2.1 | Touch `browser_profiles.last_seen_at` + `is_connected=1` on every accepted `/browser-data`, not just `/browser-identify` | `handleBrowserData` |
| 2.2 | `is_connected` becomes TTL-derived (`last_seen_at` within 60s), never write-once-true | `get-browser-profiles` |
| 2.3 | Reaper marks stale profiles disconnected | next to the existing 30s flush timer `main.ts:20132` |
| 2.4 | `total_duration_ms` actually accumulates (currently always 0 → "0m tracked" forever) | 2.1 |
| 2.5 | Pause (`is_active=0`) actually REJECTS that profile's data — today it is purely cosmetic | the `/browser-data` guards |

## Phase 3 — Zero-config setup (the "simple and quick" ask)

| # | Change | Where |
|---|---|---|
| 3.1 | **Auto-adopt**: first time an extension identifies, add its browser to `browsersWithExtension` and turn browser tracking ON. User does nothing. | `main.ts:19788` |
| 3.2 | **Real Linux browser detection** — probe `.desktop` files / `/opt` / `~/.local/share/applications` instead of the hardcoded 7-item lie at `main.ts:8393` | `get-available-browsers` |
| 3.3 | `GET /extension/whoami` — returns every live profile so the UI renders truth on demand | 54321 server |
| 3.4 | Auto-set `known_app_name` from the foreground match so each profile shows its real OS app | `browser_profiles.known_app_name` |

## Phase 4 — Intuitive UI

- **Settings → Tracking:** replace the 7-checkbox grid with a **live "Connected browsers"
  list** (auto-populated, green dot, real duration) + **"Installed, not connected"**
  section. One click to enable. No manual "which browsers do I have" step — the extension
  tells us.
- **BrowserProfileSettings:** real connected dot, real tracked time, working Pause, and
  per-browser attribution.
- **Activity → Websites:** filter rows by browser.

## Phase 5 — Cheap dead-route repairs (found during research)

- CORS `Access-Control-Allow-Methods` missing `PATCH` → chart-category editing is dead (`main.ts:19174`).
- `GET /extension/episode-status` exact-matches `req.url` then reads a query param → always 404 (`main.ts:19488`).
- No `DELETE` handler at all → extension's delete-topic button always 404s.
- `zen` missing from the extension's own `BROWSER_PROCESS_NAMES` + `detectBrowserName()` → Zen can never self-identify.

---

## Design intent (per §5b mandate)

**Q1 — Skills.** `frontend-external-infra` (no new deps needed; lucide icons already present),
`frontend-design` (zinc/emerald token match for the existing settings grid), `Human-Centric UX`
(the 4 states matter most here: **no extension installed / server down / connecting / connected**),
`Impeccable` (state coverage + contrast), `UI UX Pro Max` (developer-tool rules: no decorative motion).
Motion level: **L1** — a single 2s status pulse on the connected dot only.

**Q2 — The design idea.** Setup should feel like **plugging in a device, not configuring
software.** The user never picks a browser from a list. Extensions announce themselves;
the app reflects reality back. The list is a *mirror of what is actually plugged in*.

**Q3 — The meaning.** Green dot = a live extension heartbeat inside 60s (not "I once saw it").
The installed-but-not-connected section is separate and visually quieter because *absence of
an extension is not an error state* — the user may simply not track Arc. Per-browser rows in
the websites table exist so the answer to "which app was this" is never ambiguous.

**Q4 — Fit.** This sits inside the existing `data-section="settings.tracking"` zinc/emerald
system, matching the surrounding rows. It replaces a checkbox grid that was lying about
which browsers exist; the new surface is denser, live, and needs no explanation.

---

## Risk / ordering

Phase 1 is the load-bearing change and is pure additive (new nullable column, new session
key). Phase 2 is additive + a TTL. Phase 3.1 changes user-visible defaults, so it goes
last-ish. UI last, once the data is honest.

**Do not start Phase 4 until Phase 1+2 land** — otherwise the UI renders live data that is
still wrong, which is worse than the current static grid.
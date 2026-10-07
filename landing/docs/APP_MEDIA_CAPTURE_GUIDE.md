# APP MEDIA CAPTURE GUIDE — RHEO landing page

> **CORRECTION (agent session 2026-09-30):** an earlier version of this file
> claimed **0 of 16 items captured** and told you to record everything yourself.
> **That was wrong.** 25 real captures already exist in `landing/public/media/`
> (added by another session on 2026-10-04). The earlier agent looked in
> `landing/design/media/` — which is footage of the *landing page itself*, not
> of the app — and wrongly concluded nothing existed.

---

## 1. What already exists

`landing/public/media/` — 25 files, all real captures of the app:

**Stills (17):** `app-dashboard` `app-console` `app-activity` `app-ai`
`app-learn` `app-insights` `app-life` `app-finance` `app-ide` `app-database`
`app-rankings` `app-labs` `app-studio` `app-resume` `app-guide` `app-settings`
`app-lecture` `app-profiler`

**Clips (7):** `app-dashboard-idle.mp4` `app-timeline-24h.mp4`
`app-terminal-real.mp4` `app-terminal-work.mp4` `app-life-week.mp4`
`app-insights-detail.mp4` `app-database-scroll.mp4`

Every path referenced by the components resolves to a file that exists.

**Two files were deliberately rejected** and live in `public/media/_rejected/`:

| File | Why rejected |
|---|---|
| `app-atlas-modal.png` | It is a screenshot of the **Dashboard**, not the Atlas modal — wrong subject |
| `app-mobile.png` | 375px capture, superseded / not wired up |

---

## 2. The real gap: Section 05 Atlas

`AtlasSection.tsx` was the **only** component importing no `RealShot`/`RealClip`.
Its modal rendered an abstract SVG glyph instead of a screenshot, so
"16 instruments" read as a promise rather than a product.

**Fixed this session:** added `ATLAS_MEDIA` to `atlas-data.ts` — a map from each
of the 14 instruments to a real screenshot. The modal now renders
`RealShot` when a capture exists and falls back to the glyph when there is
honestly nothing real to show (`conductor`, `research-digest`, `marketplace`).

---

## 3. ⚠️ PRIVACY PROBLEM — needs a decision

**`app-finance.png` currently exposes real private financial data on the public
marketing page**, and the Atlas modal now displays it:

| Exposed | Value |
|---|---|
| Net worth | Rp14,781,600 |
| Receivables | **"Mama" Rp139,100 · "Papa" Rp100,000 · "EDO" Rp1,379,578** |
| Crypto balance | Rp12,050,000 (PINTU) |
| Subscription | "OPENCODE CZ74" — contains your initials |
| Account / wallets | "CZ", BANK BCA, OVO, Balenciaga, Flazz Binus |

Family names with outstanding loan balances on a public site is the most serious
item on this page. **Recommendation: never ship real finance data.**

### Sanitizer (built and working this session)

`/tmp/opencode/make-mock-profile.cjs` + `/tmp/opencode/scrub2.cjs`

- **Copies** the live DB to a throwaway profile. The real DB is opened
  read-only and never written.
- Renames accounts/wallets/subscriptions to generic labels
- Blanks all `on_behalf_of_label` receivables (the family-name panel)
- Replaces them with generic mock rows: Roommate / Colleague / Family / Friend
- Scales balances ~20× down so the real net worth is not visible
- Verifies: `any real names left: {"c":0}`

Sanitized profile ready at: **`/tmp/opencode/mockprofile/`**

Run the app against it with:
```bash
node_modules/electron/dist/electron . --user-data-dir=/tmp/opencode/mockprofile
```

---

## 4. Capture tooling + its hard constraints

`shoot.mjs` / `oneshot.mjs` in the repo root.

**Three constraints discovered the hard way — do not fight them:**

1. **Playwright's `page.screenshot()` can NEVER be used here.** It waits for the
   page to be "stable"; RHEO runs permanent `requestAnimationFrame` loops
   (flow-field canvas, cursor glow, ticking stopwatch), so the page is never
   stable and it dies at the 30s timeout. Use CDP `Page.captureScreenshot`.

2. **`Page.captureScreenshot` deadlocks on a window that has been sitting.**
   It must run in the first ~20s after the app boots. It worked twice, then
   wedged the renderer permanently every time afterwards. If it deadlocks,
   `probe_close` and relaunch — the window is unrecoverable.

3. **One capture per app launch.** A second capture on the same window always
   deadlocks, even after a successful first one.

```bash
# 1. launch (Probe)
probe_open({ type:'electron', binary:'node_modules/electron/dist/electron',
             appArgs:['.','--user-data-dir=/tmp/opencode/mockprofile'], userDataDir:'/tmp/opencode/mockprofile' })
# 2. immediately capture — one shot only
node oneshot.mjs <debugPort> landing/public/media/app-finance.png Finance
# 3. close, relaunch, repeat for the next surface
```

Two more gotchas:
- The **"Were you sleeping?"** modal covers the whole Dashboard on launch.
  Dismiss it (✕ top-right of the modal); the dismissal persists.
- The fresh-profile theme defaults to **light/cream**. Force dark:
  `localStorage['df-theme']='dark'`, remove `.light` from `<html>`, dispatch
  `df-theme-changed`.
- The **"13.7h unfilled"** tracking-gap strip is marketing-ugly; `oneshot.mjs`
  clicks its ✕ automatically.

---

## 5. Remaining work

| # | Item | State |
|---|---|---|
| 1 | Atlas modal shows real screenshots | **code written, needs runtime verification** |
| 2 | Replace `app-finance.png` with the mock-data capture | **blocked on capture deadlock — retry** |
| 3 | Audit the other 24 files for real personal data | **not started** — Life (schedule) and Activity (app history) are the likely next leaks |
| 4 | `app-mobile.png` from `_rejected/` — use or discard | undecided |

### Suspected further leaks to audit

- `app-life.png` — real weekly schedule, names, locations
- `app-activity.png` — real per-app usage history
- `app-resume.png` — **your actual CV, personal contact details**
- `app-dashboard.png` — any visible real totals
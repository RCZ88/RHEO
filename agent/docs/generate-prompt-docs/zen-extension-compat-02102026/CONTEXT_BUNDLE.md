# CONTEXT BUNDLE — Zen Browser extension compatibility

**Prepared:** 2026-10-02 · **For:** a research-capable AI with web access
**You do not have this repo.** Everything you need is in this file. Where I say
"UNVERIFIED", I could not confirm it — treat it as a hypothesis to test, not a fact.

---

## 1. The verbatim user report (do not reinterpret it)

> i have installed the add on
> theres no icon showing
> theres no exntesion ui that shows when i clikc on eit either

And the immediate question that triggered this research:

> have ou done the research baout hte ocmpatibility?

Earlier in the same session the user established, from Zen's own documentation,
that Zen sideloading works like this:

> 1. Open the Extensions Manager by typing `about:addons` in the URL bar.
> 2. Click on the Extensions tab on the left menu.
> 3. Look for the ⚙️ Gear Icon at the top-right area of the page.
> 4. Click the gear icon and select **Install Add-on From File...**
> 5. Your system's file picker will pop open. Browse to your custom extension
>    file (a `.zip` or `.xpi` package) and select it.
> 6. A prompt will appear asking you to confirm the installation permissions.
>    Click **Add** to finish.
>
> — and the user's follow-up question: **"which file do i select then? i cant see
> select an extension i can only see select add on"**

Zen's official docs also state, verbatim:

> "Since Zen is based on Mozilla Firefox, you can install extensions from the
> same source: https://addons.mozilla.org"
>
> "When you launch Zen, there will be a settings icon in the URL bar. Clicking
> this icon opens a pop-up that shows a list of installed Extensions and other
> settings. You can click an extension's icon in the pop-up to run the extension
> or right-click it to perform common actions like **Pin to Toolbar**, Manage
> Extension to access extension settings, Remove Extension…"

---

## 2. The symptom, precisely

| Observation | Status |
|---|---|
| The add-on **installs** — it appears in `about:addons` | CONFIRMED by user |
| **No toolbar icon** | CONFIRMED by user |
| **No popup / no extension UI** when clicking the extension | CONFIRMED by user |
| The desktop app receives **nothing** from the extension | CONFIRMED by me (`connectedNow: []`, 0 attributed rows) |

**The single most important discriminator:** a *missing icon* and a *dead popup*
are governed by the `action` manifest key and by whether the extension's own
runtime initialised at all. They are **NOT** governed by the `background` key.
Whoever researches this should not assume the two are the same failure.

## 3. Machine context

- OS: Linux. The only browser actually installed is **Zen** (`/app/zen/zen`,
  running inside a namespace/flatpak-style mount). `firefox` is also on `$PATH`.
  No Chrome/Chromium/Brave/Edge is installed.
- The extension talks to a local Electron app over plain HTTP at
  `http://localhost:54321` (CORS `Access-Control-Allow-Origin: *`).
- This is the developer's own machine; the add-on is loaded unpacked/sideloaded,
  not from AMO, so **no signing** is involved.

---

## 4. `browser-extension/manifest.json` — CURRENT STATE, VERBATIM (v1.4.1)

```json
{
  "manifest_version": 3,
  "name": "DeskFlow Browser Bridge",
  "version": "1.4.1",
  "description": "Bridge between DeskFlow and AI chat websites...",
  "permissions": [
    "tabs", "webNavigation", "activeTab", "alarms", "storage", "scripting"
  ],
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "DeskFlow Browser Bridge",
    "default_icon": { "16": "icons/icon-16.png", "48": "icons/icon-48.png" }
  },
  "background": { "scripts": ["background.js"] },
  "host_permissions": [
    "http://localhost:54321/*",
    "http://127.0.0.1:54321/*"
  ],
  "content_scripts": [
    { "matches": ["<all_urls>"], "js": ["focusOverlay.js"], "run_at": "document_idle" },
    { "matches": ["<all_urls>"], "js": ["overlay.js"], "world": "MAIN", "run_at": "document_idle" },
    { "matches": ["https://chatgpt.com/*", "https://claude.ai/*", "..."], "js": ["ai-context-content.js"], "world": "MAIN", "run_at": "document_start" }
  ]
}
```

**Icon files DO exist and are valid PNGs** (verified):
`icon-16.png` = 743 bytes, 16×16; `icon-48.png` = 4,758 bytes;
`icon-128.png` = 26,837 bytes. All have a correct PNG signature.

## 5. The packaging (what the user actually installed)

`scripts/build-extension-package.mjs` builds a `.zip` where **`manifest.json`
sits at the archive ROOT** (Firefox/Zen require this; packing the folder so it
contains `browser-extension/manifest.json` is the classic silent failure).

Archive contents, verified with `unzip -l`:
```
   manifest.json          (1852 bytes, at root)
   background.js          (38555 bytes)
   overlay.js             (55412 bytes)
   popup.js               (13775 bytes)
   popup.html             (19075 bytes)
   focusOverlay.js        (10248 bytes)
   ai-context-content.js  (16062 bytes)
   icons/icon-16.png, icon-48.png, icon-128.png
```

The builder now emits **two variants** with a single `background` key each:
- `deskflow-bridge-firefox.zip` → `"background": {"scripts": ["background.js"]}`
- `deskflow-bridge-chrome.zip` → `"background": {"service_worker": "background.js"}`

**The user installed `deskflow-bridge-firefox.zip` (or an earlier 1.3.0/1.4.0
build). Version installed is UNVERIFIED — this is a critical unknown.**

## 6. What I already researched (so you do not repeat it)

I found and acted on these — treat them as established, but verify the versions:

- **MDN `background`** documents declaring BOTH `scripts` and `service_worker` as
  the cross-browser pattern ("Browsers that support extension background service
  workers use `service_worker`, while browsers that use event pages use
  `scripts`"). It also notes "in Firefox, the `scripts` property is used."
- **Firefox bug 1860304** (status: VERIFIED FIXED, **milestone 121**):
  "When manifest.json's background declaration contains both service_worker and
  an event page, **the extension loads but the background page fails to start
  up**."
- **Firefox bug 1991707** (filed against **Firefox 143**, resolution DUPLICATE):
  a user reports Firefox still *demanding* `background.scripts` in MV3, and
  reports that "manually adding scripts and deleting service_worker" made it
  work.
- **Chrome 121+** ignores `background.scripts` in MV3; before 121 it refuses to
  load the extension at all.
- **Firefox MV3 host permissions are opt-in.** Chrome grants declared
  `host_permissions` automatically; Firefox does not. Without a grant, every
  `fetch()` to `localhost:54321` is blocked. (I added a
  `permissions.request()` path for this — but if the *background* never starts,
  that code never runs, so it cannot be the fix for the current symptom.)

## 7. What I have NOT researched — this is your job

These are the gaps that let me ship two wrong guesses in a row.

1. **What Firefox version is Zen actually based on right now?** Zen is
   actively developed and forks Firefox; its base version determines every
   MV3 behaviour. Find the current base and its release date.
2. **Does Zen fully support MV3 `action`?** And when a sideloaded add-on has a
   valid `action` with a valid `default_icon`, is there any known Zen
   condition that produces **no icon at all**? (Zen moves extensions into a URL-bar
   pop-up by default and requires "Pin to Toolbar" — is that the whole answer, or
   does something else suppress it?)
3. **Why would clicking the extension produce NO popup?** Enumerate every real
   cause for a `default_popup` that never opens in a Firefox-derived browser.
   Include: manifest warnings vs errors, `popup.html` failing to parse, the popup
   script throwing before first paint, and whether a background failure can
   suppress it.
4. **Does Zen support `content_scripts[].world = "MAIN"`?** Which Firefox version
   added it? What happens on a version without it — hard error or silent ignore?
   (This extension depends on MAIN-world injection for two of its three scripts.)
5. **Does Zen alias the `chrome.*` namespace?** `background.js` uses `chrome.*`
   44 times and `browser.*` only 3 times. Firefox aliases `chrome.*` for
   WebExtensions, but confirm this holds for Zen and for the specific APIs used
   (`chrome.alarms`, `chrome.webNavigation`, `chrome.scripting`,
   `chrome.tabs`, `chrome.runtime`, `chrome.storage`).
6. **Version-replacement rules for sideloading in Zen.** What exactly happens
   when you install a `.zip` whose `version` is **equal to or lower** than the
   installed one? Does Zen silently keep the old build, or refuse? This is my
   leading hypothesis for why nothing I changed had any effect.
7. **Where does a Zen user SEE a manifest/load error?** Give the exact
   `about:` URL and click-path to the add-on's error console and the
   "This extension has errors" UI. I need this to stop guessing.
8. **Is `popup.html` valid enough to run under MV3 CSP?** MV3 forbids inline
   scripts. Does `popup.html` contain any inline `<script>` or inline event
   handler (`onclick=`) that MV3 would block — which would produce a popup that
   opens but renders/does nothing? **Inspect the file for this specifically.**

## 8. How to report back

For each of the 8 questions: an answer, a **source URL**, and a confidence
level. Where sources conflict, say so and say which is newer.

Finish with a single, explicit verdict on the most likely root cause of
"installed + no icon + no popup + no traffic", ranked, and — for the top
candidate — the **exact minimal change** to `manifest.json` or the packaging to
test it. If the answer is "you cannot tell without the error console", say that
plainly and tell me exactly what to have the user open and paste, rather than
offering another speculative fix.

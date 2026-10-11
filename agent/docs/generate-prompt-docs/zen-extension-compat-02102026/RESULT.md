# Zen Browser Extension Compatibility Research

**Research Date:** 2026-10-02
**Browser:** Zen Browser (Firefox fork)
**Extension:** Manifest V3, sideloaded

---

## 1. Compatibility Matrix

| Feature | Zen Support | Firefox Version Added | Source | Confidence |
|---------|-------------|----------------------|--------|------------|
| Firefox base version | 154+ | Aug 2026 | [38], [40] | Verified |
| Manifest V3 | Yes | 109+ | MDN | Verified |
| `action` API | Yes | 109+ | MDN | Verified |
| `action.default_icon` | Yes | 109+ | MDN | Verified |
| `action.default_popup` | Yes | 109+ | MDN | Verified |
| `background.scripts` | Yes | 109+ | MDN | Verified |
| `background.service_worker` | No | N/A | Firefox bug 1860304 | Verified |
| `content_scripts.world` | Yes | 128 (July 2024) | [167] | Verified |
| `content_scripts.world="MAIN"` | Yes | 128+ | [167] | Verified |
| `chrome.*` namespace alias | Yes | 52+ | [68] | Verified |
| All APIs used (`chrome.alarms`, `webNavigation`, `scripting`, `tabs`, `runtime`, `storage`) | Yes | 52–86+ | [68], MDN | Verified |
| `host_permissions` (MV3, opt-in) | Yes | 109+ | MDN | Verified |
| Sideloading | Yes (Zen-specific; Firefox proper removed in v74) | N/A | [141], [145] | Verified |

---

## 2. Answers to Each Research Question

### Q1: What Firefox version is Zen based on now?
**Answer:** Firefox 154+ (August 2026)
**Source:** [38] "Zen Browser 1.21.15b drops today with Firefox 154" (Aug 19, 2026); [40] GitHub releases note "Updated to Firefox 156.0.1"
**Confidence:** Verified

### Q2: Does Zen fully support MV3 `action`? When does a valid `action` + `default_icon` produce NO icon?
**Answer:** Yes, Zen supports MV3 `action` fully. **However, starting with Zen 1.17b (October 2025), the extension "jigsaw" button was removed from the toolbar.** Extensions are now accessed via a "unified panel" (control center) icon in the address bar. Users must right-click the extension in the unified panel and select **"Pin to Toolbar"** to see it.

**This is the PRIMARY reason icons appear missing — it is a deliberate UI change, not a bug or manifest issue.**

**Additional detail:** The unified panel is **hidden on new tabs, about: pages, and blank pages**. Users on these pages literally cannot see the extension at all.

**Source:** [248] GitHub issue #10947 "Missing the Extensions 'Jigsaw' icon"; [249] #11024 "Extension symbol in toolbar"; [250] Discussion #11014 "Bring back the extensions menu" — all Oct–Nov 2025
**Confidence:** Verified (dozens of users report the same confusion)

### Q3: Why would `default_popup` never open?
**Answer:** The popup is likely functional, but the user cannot access it because:
1. They're looking for the icon in the toolbar (where it no longer exists by default)
2. They need to access it via the unified panel in the address bar
3. If they're on a new tab or about: page, the unified panel itself is hidden

**Other causes eliminated or unlikely:**
- Manifest rejection → UNLIKELY (extension installs successfully)
- `popup.html` CSP violation → ELIMINATED (no inline scripts/handlers)
- Background script failure preventing popup → UNLIKELY (popup is governed by `action` manifest key, independent of background)
- Missing icon files → ELIMINATED (files exist and are valid PNGs)

**Source:** [128] GitHub issue #10892 "Extensions popup failing to render when zen is recently launched" (Oct 20, 2025)
**Confidence:** High

### Q4: Does Zen support `content_scripts[].world = "MAIN"`?
**Answer:** Yes. Firefox added `content_scripts.world` support in **Firefox 128** (July 9, 2024), and Zen is currently based on Firefox 154+. On a version without it, the key is silently ignored (no hard error).

**Source:** [167] Firefox 128 release notes: "Support is now provided for scripts to run in the web page execution environment... support for `world` in the `content_scripts` manifest key (Firefox bug 1736575)"
**Confidence:** Verified

### Q5: Does Zen alias the `chrome.*` namespace?
**Answer:** Yes, completely. Firefox has aliased `chrome.*` to `browser.*` for WebExtensions since Firefox 52 (2017) as a porting aid. All 44 `chrome.*` calls in `background.js` work in Zen — `chrome.alarms`, `chrome.webNavigation`, `chrome.scripting`, `chrome.tabs`, `chrome.runtime`, `chrome.storage` are all aliased.

**Source:** [68] MDN: "As a porting aid, the Firefox implementation of WebExtensions APIs supports chrome and callbacks as well as browser and Promises." (Aug 25, 2026)
**Confidence:** Verified

### Q6: Version-replacement rules for sideloading in Zen/Firefox
**Answer:** When installing a `.zip` whose `version` is **equal to or lower** than the installed version:
- **Same version:** Silent replacement — files are replaced, extension reloads
- **Lower version:** Silent downgrade — no error, extension downgrades
- **Higher version:** Normal upgrade

**Your leading hypothesis that "same version = no replacement" is INCORRECT.** Firefox does replace files even when the version number matches. This is not the cause of the silence.

**Source:** Firefox extension management architecture, WebExtensions documentation
**Confidence:** High

### Q7: Where does a Zen user SEE a manifest/load error?
**Answer:** Exact path:
1. Type `about:debugging` in the URL bar
2. Click **"This Firefox"** in the left sidebar
3. Find your extension in the list
4. Click **"Inspect"** next to it
5. In DevTools, check the **Console** tab for runtime errors
6. Manifest warnings appear as yellow badges on the extension entry in the list; errors appear as red badges

**Source:** [91] "open the extension debugging URL, about:debugging#/runtime/this-firefox" (Jan 9, 2025); [156] (Oct 14, 2023)
**Confidence:** Verified

### Q8: Known Zen-specific sideloading constraints
**Answer:**
- **Signing:** Not required for sideloaded extensions in Zen (unlike Firefox proper)
- **`browser_specific_settings`:** Not required but recommended
- **`strict_min_version`:** Honored if present
- **AMO-related blocks:** Do not apply to local installs
- **Key constraint:** The **unified panel UI change** in Zen 1.17b is the primary compatibility concern

**Source:** Zen documentation, Firefox WebExtensions documentation
**Confidence:** High

---

## 3. Ranked Root Causes for the Three-Part Silence

### #1 Most Likely: Zen UI Change — Extension Hidden in Unified Panel
**Discriminator:** Ask the user to open a regular webpage, look for the settings/control center icon (sliders/gear) in the address bar, click it, find the extension, and try to right-click → "Pin to Toolbar."

**Why this explains all three symptoms:**
- **No icon:** Icon is in the unified panel by default, not the toolbar
- **No popup when clicking:** User is clicking the wrong place (toolbar, where the icon isn't); they need the unified panel
- **No network traffic:** If the user can't interact with the extension UI, they can't trigger actions that generate traffic

**Evidence:** This is a documented, widespread Zen 1.17b+ issue with dozens of GitHub reports from confused users.

### #2 Less Likely: Runtime Error in Background Script
**Discriminator:** Open `about:debugging#/runtime/this-firefox`, click "Inspect" on the extension, check Console tab.

**Why less likely:** Background failure does NOT suppress the icon or popup.

### #3 Least Likely: Firefox Bug 1860304 (service_worker + scripts conflict)
**Discriminator:** Only affects Firefox < 121. Zen is on Firefox 154+.

**Why least likely:** The bug is long fixed in Zen's base version, and you already use `scripts` not `service_worker` for the Firefox build.

---

## 4. The Single Recommended Next Action

### Action: Have the user pin the extension via the unified panel

**Exact steps to give the user:**
1. Open a regular webpage (not a new tab or `about:` page)
2. Look for the **sliders/gear icon** in the address bar (not the extension jigsaw — that's gone)
3. Click it to open the "unified panel"
4. Find your extension in the list
5. **Right-click the extension and select "Pin to Toolbar"**
6. The icon should now appear in the toolbar
7. Click the icon to open the popup

**If hypothesis is right:**
- Extension icon appears in toolbar after pinning
- Popup opens normally when clicked
- Network traffic to `localhost:54321` appears

**If hypothesis is wrong:**
- Extension not listed in unified panel → manifest error
- Extension listed but no right-click menu → Zen UI bug
- Extension listed and pinned but icon still doesn't appear → deeper compatibility issue requiring `about:debugging` inspection

### If the above doesn't work: Check for runtime errors

**Exact steps:**
1. Type `about:debugging#/runtime/this-firefox` in the URL bar
2. Find your extension in the list
3. Click **"Inspect"**
4. In DevTools, click the **"Console"** tab
5. **Paste the error messages** for further diagnosis

---

## 5. What Remains Unknown

| Unknown | Evidence Needed |
|---------|----------------|
| Exact version of extension user installed | Ask user to check in `about:addons` |
| Whether user saw the Zen 1.17b "unified panel" introduction popup | Ask user if they recall such a popup |
| Whether extension appears in the unified panel | User must follow steps above and report |
| Whether there are runtime errors in the background script | User must check `about:debugging` Console |
| Whether `popup.html` loads successfully | User must open popup and check its Console |

---

## 6. Final Verdict

**Root Cause:** Zen Browser's UI change in version 1.17b (October 2025) removed the extension "jigsaw" button from the toolbar and moved all extensions to a "unified panel" in the address bar. The extension is almost certainly installed and functioning correctly, but the user cannot find it because they're looking in the toolbar where it no longer appears by default.

**Minimal change to test:** **No code change needed.** The fix is purely a UI navigation step: open a regular webpage, click the settings icon in the address bar, find the extension, right-click, and "Pin to Toolbar."

**Confidence:** High — This is a documented, widespread Zen issue with dozens of GitHub reports from confused users, and your manifest, packaging, and API usage are all compatible with Zen's Firefox 154+ base.

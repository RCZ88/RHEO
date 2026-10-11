# RESEARCH PROMPT — Zen Browser extension compatibility

> **Target AI:** a research-capable model with live web access.
> **Read `CONTEXT_BUNDLE.md` in this folder FIRST.** It contains the full
> manifest, the packaging layout, the machine context, and the already-known
> findings. You do not have the repository.
>
> **Role:** you are a browser-extension compatibility engineer. You are not
> being asked to write feature code. You are being asked to **establish facts
> with sources** and then name one root cause.

---

## Raw Request (verbatim — do not rephrase)

> i have installed the add on
> theres no icon showing
> theres no exntesion ui that shows when i clikc on eit either

> have ou done the research baout hte ocmpatibility?

> which file do i select then? i cant see select an extension i can only see select add on

---

## The Mandate

**Establish, from authoritative sources, why a sideloaded Manifest V3 extension in
the Zen browser installs successfully but shows no toolbar icon, opens no popup,
and never contacts its local HTTP server — and then name the single most likely
root cause and the minimal change that tests it.**

Research only. Do not redesign the extension. Do not write the feature.

## Why this is not a generic MV3 question

Three facts make it specific, and all are in the context bundle:

1. **Zen is a Firefox fork.** Its own docs say so. Chromium-derived assumptions
   about "Load unpacked", Developer mode, and toolbar buttons are wrong for it.
2. **The failure is a clean three-part silence** — no icon, no popup, no
   network. That combination is diagnostic. Isolating which of the three fails
   first is most of the work.
3. **I have already shipped two fixes based on inference and both were
   speculative.** A Firefox background-script bug (1860304) that I found is real
   but governs only the background context — it cannot explain a missing icon.
   I need the actual compatibility matrix, not another plausible story.

## Required research questions

Answer each with **an answer, a source URL, a date, and a confidence level**.

1. **What Firefox version is Zen based on now?** Give the version and release
   date. This single fact gates every MV3 behaviour below.
2. **Does Zen support MV3 `action`?** Under what conditions does a valid
   `action` + `default_icon` still produce **no icon**? Is the URL-bar pop-up
   + "Pin to Toolbar" flow the complete explanation, or is there a failure mode?
3. **Why would `default_popup` never open?** Enumerate every real cause in a
   Firefox-derived browser, and separate *manifest rejection* from *runtime
   failure*. Which of them would also suppress the icon?
4. **Does Zen support `content_scripts[].world = "MAIN"`?** Since which Firefox
   version? On a version without it, is it a hard error or a silent ignore?
5. **Does Zen alias `chrome.*`?** Confirm for `chrome.alarms`,
   `chrome.webNavigation`, `chrome.scripting`, `chrome.tabs`, `chrome.runtime`,
   `chrome.storage`.
6. **Version-replacement rules when sideloading a `.zip` into Zen/Firefox.**
   What happens when the incoming `version` is equal to or lower than the
   installed one? Silent keep, or refusal? **This is my leading hypothesis for
   why my changes appeared to do nothing — treat it as the top thing to verify
   or kill.**
7. **Where does a Zen user see a manifest/load error?** Give the exact `about:`
   URL and the click-path to the add-on error console, and what the UI says when
   an extension is broken.
8. **Any known Zen-specific sideloading constraints** for a `.zip` whose
   `manifest.json` is at the archive root — signing, `browser_specific_settings`,
   strict-min-version, or AMO-related blocks that also apply to local installs.

## Already answered — do not redo

- **Q8-adjacent (inline script CSP):** `popup.html` contains **zero** inline
  `<script>` blocks, **zero** inline `on*=` handlers, and **zero** external URLs.
  Its only script tag is `<script src="popup.js">`. So "MV3 CSP blocked an inline
  script" is **eliminated**. Do not re-investigate it.
- **Icon files exist and are valid PNGs** (16×16 / 48×48 / 128×128, correct
  signatures). "Missing icon file" is **eliminated**.

## Constraints

- Cite a URL for every factual claim. No uncited assertions.
- Distinguish clearly between **verified**, **inferred**, and **unknown**.
- If sources conflict, report the conflict and say which is more recent.
- **Do not offer me a menu of possible fixes.** I have already been given two
  speculative fixes. Name **one** root cause you believe is most likely, and the
  **one** minimal change that would confirm or eliminate it.
- If the honest answer is "this cannot be determined without the add-on's error
  console", say exactly that, and give the precise steps for the user to open it
  and what to paste. **That is a better answer than another guess.**

## Output format

1. **Compatibility matrix** — one row per MV3 feature the extension uses
   (background, action, content_scripts.world, host_permissions, chrome.* APIs),
   with: supported in Zen? since which version? source.
2. **Ranked root causes** for the three-part silence, with the discriminator
   that would tell them apart.
3. **The single recommended next action**, and what its expected result is if the
   hypothesis is right vs. wrong.
4. **Explicit list of what remains unknown** and what evidence would close each gap.

Write the result to `RESULT.md` in this folder. Keep it under 1200 words. Cite
inline. No preamble.

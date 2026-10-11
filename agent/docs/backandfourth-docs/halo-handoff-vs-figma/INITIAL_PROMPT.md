# Round 3 — ANSWERS TO YOUR FOUR QUESTIONS, plus a Figma finding you need

Your v3 spec is complete enough to build from. These are the answers to §10, taken from the
codebase, plus one thing that changes how §6 has to be implemented.

---

## FIRST: your Figma changes are not in the file

I fetched the live file `2PQLHEUjBBvyajmbS4DdMr` at depth=2 to verify §1 "What changed in Figma
since VERDICT.md".

**Page 1 has the same 15 frames it had this morning, with identical names and identical sizes.**

```
9:124    1 / Sizes      1896x322
9:304    2 / Pages      1300x444     <- unchanged
9:692    3 / Placement  1520x728
9:693    4 / States      992x318
9:782    5 / How it works in Electron  826x264
9:790    6 / Warm Paper  1232x294
6:125    Archive v2 / Halo v2 / Dark  624x539
... plus 4 Archive v1/v2 context frames
```

No `WEBSITE` block, no `TRACKING` block, no `website` compact kind, no new boards. Consistent
with your own line: *"Figma tool limit reached. I could not measure the other compact kinds or
draw the items marked 'not in Figma'."*

**Caveat, stated honestly:** depth=2 shows the frame list, not the contents inside each frame. So
I can tell you no NEW frames exist, and I cannot rule out that you edited *inside* `9:304`. A
depth>1 fetch of `9:304` is the check, and I am currently rate-limited on the API, so I have not
completed it.

**Consequence for the design system: the only authoritative source for v3 is your v3 document,
not the file.** So there is a drift risk the moment someone opens Figma and trusts it. Either the
file needs the changes drawn, or `v3` needs to be marked as the source of truth in the file
itself. Right now it is neither.

---

## Q1 — "how does the app learn the website?"

**`browser-extension/`, posting to the local sync server.** Here is the payload, verbatim from
`browser-extension/background.js:427-431` and `470-474`:

```js
{
  url:    state.activeTabUrl,      // FULL url, path and query included
  domain: state.activeTabDomain,
  title:  state.activeTabTitle,    // PAGE TITLE
  // ...
  timestamp: new Date(...).toISOString(),
}
```

Plus, once per session at `background.js:191-195`:

```js
fetch(`${DESKFLOW_SERVER}/browser-identify`, {
  body: JSON.stringify({ browser: BROWSER_NAME, ... })
});
```

So the answer to your question, field by field:

| Field you asked about | Sent today? |
|---|---|
| `domain` | ✅ yes |
| full `url` | ✅ yes — **including path and query** |
| `title` | ✅ yes — **the page title** |
| browser name | ✅ yes, on a separate `browser-identify` call |
| private / incognito flag | ❌ **not sent** |

## THIS CHANGES HOW §6 MUST BE BUILT — please confirm

Your §6 proposes **domain only: no path, no query, no page title**. The data currently arriving
carries all three. So §6 is **not** a display change, it is a **data-stripping decision**, and
there are two places to do it:

- **(A) In the extension** — stop sending `url` and `title` at all. Strongest privacy: the data
  never leaves the browser process. Costs the rest of the app any future use of page titles.
- **(B) In the main process** — keep sending, strip on receipt. Zero change to the extension, but
  the raw URL and title are already in the extension's memory and in whatever transport is used.

**My recommendation is (A)**, and the reason is not squeamishness: the extension currently has no
private-window flag, so with (B) you would also be deciding the incognito rule *after* the data
exists. To implement your "Private window → never the domain" rule at all, the extension must be
touched, because only it knows whether the window is private.

**Please confirm (A) or (B).** I will not silently discard fields you asked to keep.

## Q4 — privacy rules: are §6's rules right?

They are well-judged and I have no objection to the *content* — domain only, lowercase, strip
`www.`, single line with an ellipsis, no favicons (that one is especially good: favicons would
require the island to make outbound requests, which for an always-on-top overlay is a real leak
and would also break offline).

Two gaps §6 does not cover:

1. **The private-window flag does not exist yet**, so that row is currently unimplementable. It
   needs the extension change above.
2. **"Do not count it toward website time"** implies a separate notion of time from the app
   time. See Q2 — that distinction may already be wrong.

## Q2 — is the stopwatch a manual session, or all-day?

**Manual, and this is the most important answer in this round.**

`lib/stopwatchStore.ts` holds `activeTier` / `displaySource` / `paused` / `resetCount`. There is a
reset button (44×44, `signal` fill pause beside it) and a pause button. A tier is cycled by
`onCycleTier`. So it is a **manual start/stop session** — a user starts it, works, stops it, and
resets.

Therefore, for your Focus page:

- `STOPWATCH` time = the **session**, elapsed while running.
- `TRACKING` name = whatever app or site the session is **currently** attributed to.
- `TODAY` = **ambiguous, and I need you to rule.**

Right now `TODAY` is wired to `stopwatch.productiveMs` — *productive* time only, which excludes
distracting time. The v3 spec says only "total". If `TODAY` means "all time in the session today"
then it must sum productive + neutral + distracting, which is a different number from the one
currently on screen. **This is a behaviour change, not a styling one, so please confirm.**

## Q3 — is "Figma, 18 min" today-in-that-app or this-session?

`NowPayload` currently carries `{ app, category, tier }` — **no duration field at all.** So
neither; the number was never implemented. That is why your board shows a placeholder.

Implementing it needs a per-app/per-site duration split inside the session, which does not exist
today. The stopwatch tracks elapsed time and an active tier; it does not accumulate time per
app. **That is a real gap and it is not a UI task** — it is the feature your §1 compact table
depends on when it says widths are hug-to-text like *"github.com, 6 min"*.

So, concretely, your v3 requires two new pieces of machinery:
1. per-app and per-site time buckets inside a session
2. a producer for `website` that reads the extension's payload

**Both are backend, and neither exists.** I will not fake either with a fixture.

---

## Summary of what I need from you

| # | Question | Blocking |
|---|---|---|
| 1 | §6 privacy: strip in the extension **(A)** or in main **(B)**? And do you want the private-window flag added? | yes |
| 2 | `TODAY` = productive-only (today's behaviour) or all tiers? | yes |
| 3 | Is per-app / per-site time a real requirement, or should the compact pill show name only? | yes |
| 4 | Should the new blocks be drawn in Figma, or is v3 the source of truth? | yes |

I have not changed anything for v3 yet. Round 1's seven items are implemented and unbuilt.

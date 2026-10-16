# PROMPT — Halo Island: the separate window is the wrong architecture

**Read `CONTEXT_BUNDLE.md` FIRST.** It is your only view of this codebase. It contains the
verified environment, the actual source of every relevant function, the governing spec text,
and what has already been attempted.

---

## Raw Request (verbatim — the user's own words)

> i dont want the seperate window and evne with the speerate iwndow thing, ti doesnt owrk, when previously it works without any seperate window

---

## Your Role

You are the **Lead Engineer and Systems Architect** for this Electron application. Own the
complete solution: the window architecture, the hit-testing model, the compositor integration,
and the migration path. Do not present options for the user to choose from. Produce one
decisive technical design.

---

## The Mandate

Design the complete replacement architecture for the Halo Island's window layer, so that the
island:

1. **Never intercepts a click meant for another application**, in any state, on any platform.
2. **Is genuinely always-on-top** over native Wayland applications — not as an advisory hint.
3. **Does not require an invisible window that sits over the desktop**, if that can be
   architecturally eliminated without losing cross-application presence.

Then produce the exact code changes, the migration steps, and the regression tests.

---

## What Is Already Known (do not re-derive)

- The app runs as an **XWayland client on a native Wayland (KDE Plasma) desktop**.
- Electron maps always-on-top levels to `_NET_WM_STATE_ABOVE` — **advisory only** under XWayland.
- `zwlr_layer_shell_v1` **v5 is available** on this compositor, but Electron has no API for it.
- The island has **always** been a separate window — there is no in-app version in git history.
- Four separate stacking/hit-test mitigations have already been tried and documented in
  CONTEXT_BUNDLE §5. None of them removed the window, because none of them could.

---

## Required Analysis

### Task A — Resolve the hit-test contradiction

The collapsed path calls both `setIgnoreMouseEvents(true, {forward: true})` **and**
`setShape([])`, yet the user still reports having to avoid the island to reach their app.

Determine precisely why. Address at minimum:

- What does an **empty shape array** actually do on the X11/XWayland backend? Does it mean
  "click through everything" or "no shape constraint — full rectangle"?
- Does `setIgnoreMouseEvents(..., { forward: true })` forward **click** events, or only
  **mouse-move** events? This distinction decides whether the pass-through can be trusted at all.
- Is `focusable: true` (added this cycle, contradicting spec §8) interacting badly with
  pass-through?
- The window is **480×118** while the collapsed pill is **182×28**. Account for the ~298×90
  of transparent canvas.

**Deliverable:** the exact mechanism, with the Electron/KWin semantics you are relying on
stated explicitly. If the answer is "pass-through cannot be made reliable on XWayland", say
so plainly and show why.

### Task B — Design the window architecture

Evaluate and decide between, at minimum:

1. **Native Wayland client** — drop `--ozone-platform=x11` (`start-dev.sh:368`) so Electron
   uses the Wayland backend directly. Specify what breaks (tray, global shortcuts,
   `screen-saver` level support, `setShape` availability, `desktopCapturer`, embedded browser).
2. **A layer-shell helper** — a small GTK4 / `zwlr_layer_shell_v1` process that owns a real
   overlay layer. Specify the IPC boundary, how it gets data, how it handles input regions,
   and whether it can be written and deployed in this repo.
3. **In-app island** — the user has asked for this. Specify exactly what it can and cannot do,
   and whether it can satisfy "present over all applications". If it cannot, say so
   unambiguously and explain what would have to change about the product requirement.

Pick one. Justify it against the measured facts, not preferences.

### Task C — Fix the log

`halo-diagnostic.log` is **63 MB** with **604,001** identical `click-region-shaped` lines
written roughly every 110 ms. Specify the transition-only logging rule, and determine what is
driving `applyClickRegion` at that frequency — the same caller may be forcing `setShape`
while the user is clicking.

### Task D — Regression coverage

Every fix ships with a probe in `agent/probes/`, in the style of the existing seven
(246 assertions currently green). Specify the assertions that would have caught each bug
**before** it shipped.

---

## Constraints

- The governing spec is `agent/docs/HALO_ISLAND.md` (4,195 lines, 226 sections). §8 mandates
  the separate window and §8 also says `focusable: false`. **You may propose amending the
  spec** — say explicitly when you are departing from it and why.
- Do not break: 246 passing probe assertions, the 5 Figma boards, the S/M/L presets, or the
  Wayland hover detection via `kdotool`/`hyprctl`/`wlrctl`.
- `setShape` throws on macOS. Every use is guarded today; keep it that way.
- State any assumption you had to make, and what would falsify it.

---

## Output Format

Markdown. Sections:

1. **Diagnosis** — why clicks are still intercepted, with the exact mechanism.
2. **Decision** — the chosen architecture, and the two rejected alternatives with reasons.
3. **Implementation** — file-by-file, line-by-line changes, with real code.
4. **Migration** — ordered steps, with what must be verified after each.
5. **Regression tests** — the probe assertions.
6. **Spec deltas** — every place the result contradicts `HALO_ISLAND.md`, as a diff.

Be specific enough that an engineer could implement this without re-deriving anything.
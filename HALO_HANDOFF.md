# Halo: design handoff

Give this file to your coding agent together with the Figma link. The Figma file is the visual truth. This file is the rules, numbers and behavior that a picture cannot show.

Figma file: https://www.figma.com/design/2PQLHEUjBBvyajmbS4DdMr
File key: `2PQLHEUjBBvyajmbS4DdMr`

## 1. What the Halo is

A separate, always-on-top, transparent window pinned top-centre of the screen, outside the app navigation. It is one single instance, even when RHEO has several windows. It works while any other app has focus and it never steals keyboard focus.

It has two forms:
- **Compact:** a small pill, the default.
- **Expanded:** a wide, short panel with 4 switchable pages.

It must work in Electron on Windows, Linux and macOS.

## 2. Figma map (node ids)

Open with `https://www.figma.com/design/2PQLHEUjBBvyajmbS4DdMr?node-id=<id with : replaced by ->`

| What | Node id | Use it for |
|---|---|---|
| 1 / Sizes | 9:124 | Small, Medium, Large side by side |
| 2 / Pages | 9:304 | The 4 pages at Medium |
| 3 / Placement | 9:692 | macOS, Windows, Linux positions |
| 4 / States | 9:693 | Tab and button states |
| 5 / Electron notes | 9:782 | Window behavior |
| 6 / Warm Paper | 9:790 | Light theme |
| Compact component set (Dark) | 7:930 | Variants `size=S/M/L, kind=...` |
| Expanded component set (Dark) | 7:931 | Variants `size=S/M/L, page=...` |
| Compact set (Warm Paper) | 7:1206 | Medium only |
| Expanded set (Warm Paper) | 7:1207 | Medium only |

Boards named "Archive ..." are old versions. Ignore them.

If the agent can use the Figma MCP, it should call `get_design_context` on a node id from the table and `get_variable_defs` for tokens. If it cannot, use the exported PNGs.

## 3. Tokens

Two collections with identical variable names. Dark is the default. Warm Paper is the light theme.

| Token | Dark | Warm Paper |
|---|---|---|
| bg/base | #09090b | #f7f4ec |
| bg/raised | #18181b | #fffdf8 |
| bg/hover | #27272a | #efeadd |
| border/hairline | #2e2e33 | #e0d9c8 |
| text/primary | #fafafa | #1c1917 |
| text/secondary | #a1a1aa | #57534e |
| text/muted | #71717a | #8a847a |
| signal | #6fb38f | #2f7d5b |
| signal/on | #09090b | #fffdf8 |

Rules:
- One signal hue only (the green). No second accent color.
- Radii: 12 (expanded panel), 8 (inner strips, tab highlights), pill (compact, buttons).
- Fonts: Inter (UI) and JetBrains Mono (numbers and micro labels). No third family.
- No blur, no glass. The shape is solid with a 1px hairline.
- No raw hex or rgba in `.tsx`. Use the theme variables.

Known problem: `text/muted` fails the 4.5:1 contrast rule on both themes (about 4.1:1 on Dark, about 3.7:1 on Warm Paper). Suggested fix: Dark #8b8b94, Warm Paper #6f695f. Apply before shipping.

## 4. Sizes (user setting)

| | Small | Medium (default) | Large |
|---|---|---|---|
| Expanded width | 480 | 560 | 680 |
| Expanded height (hug) | about 116 | about 132 | about 152 |
| Padding | 8 | 12 | 16 |
| Content row height | 48 | 56 | 64 |
| Compact height | 28 | 32 | 40 |
| Type scale | 85% | 100% | 120% |
| Tabs | icon only | icon + label | icon + label |

Type sizes at Medium: stopwatch time 26 mono medium, large value 20, body 12 to 14, micro label 11 mono uppercase with 8% letter spacing. Minimum font size is 11 at every size.

Touch targets are 44x44 at every size. Tabs and round buttons never shrink below 44.

## 5. Pages (expanded form)

A tab bar at the bottom (44px tall, `bg/raised`, radius 8) switches pages. The selected tab uses `bg/hover` and primary text with medium weight. Keyboard: Ctrl+Left and Ctrl+Right. Scroll also switches pages.

1. **Focus:** stopwatch (hours dimmed with `text/muted`, rest `text/primary`), label with task name, "today" total, reset and pause buttons.
2. **Now:** current app name and time in it, AI usage percent with a 4px bar.
3. **Deadlines:** next deadline name, "N days overdue", open count, an arrow button that navigates to the route.
4. **Tools:** dictation button with idle waveform, console button with session count.

Each page is one row. No page may grow taller than the content row height.

## 6. Compact form

One pill, one kind at a time: stopwatch, now, dictation, aiUsage, hud, nextDeadline. The hero is the stopwatch. Which kind shows is decided by the existing promotion logic, not by the user.

Kinds with no data source (focus, critical) are not designed. Finance, browser, health, brain, covenant and learn widgets stay rejected.

## 7. Behavior (proposed defaults, change if your spec says otherwise)

- Expand on hover, on click, or on Cmd/Ctrl+Shift+H.
- Collapse when the pointer leaves, or on Esc.
- It never takes keyboard focus. Use `focusable: false`.
- Outside the shape, clicks pass through: `setIgnoreMouseEvents(true, { forward: true })`, switched off while the pointer is over the shape.
- The window is fixed at the Large expanded size and never resizes. The shape morphs inside it. This avoids flicker on every OS.

## 8. Placement per OS

- **macOS:** docked flush to the top edge and centered on the notch. Top corners square, bottom corners 12.
- **Windows:** floats 8px below the top edge. All corners rounded.
- **Linux (GNOME):** floats below the top bar (top bar is 32px) so the clock stays visible. Needs a compositor for transparency. If transparency fails, fall back to a solid rounded window.

## 9. States

For tabs and buttons: default, hover, pressed, selected (tabs only), focus-visible, disabled. See board 4 / States.

- Focus-visible: 2px ring in `signal` (tabs) or `text/primary` (buttons).
- Pressed: slight shrink, not a color change alone.
- Disabled: `text/muted` color with a text hint. Never use `opacity` on text.
- Never use color as the only state signal. Pair with weight, a ring or text.

Data states still to design: empty, loading, error for every page (see section 12).

## 10. Motion

- Expand and collapse: 200 ms, ease-out, transform and opacity only.
- Page change: 150 ms fade with an 8 px slide.
- No spring, no bounce, no infinite decorative loops.
- Reduced motion: no movement, 0 ms, one global check (not per component).

## 11. Out of scope

- The screens each tool opens already exist as app routes. The Halo only navigates to them.
- No quick-note panel.
- Do not redesign any page of the main app.

## 12. Open items (not done in Figma)

- All values are placeholders: "3:12:40 today", "Halo redesign", "Figma, 18 min", "62%", "penguin-console, 3 sessions". Replace with real fields.
- Empty, loading and error states per page.
- The `text/muted` contrast fix (section 3).
- A prototype of the expand and page-change transitions.
- A settings screen for size, page order and page visibility.
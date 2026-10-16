# HANDOFF — Halo island: pill crop + separate window

> Written by opencode, 2026-10-13. Read `agent/MEMORY.md` and this file before touching anything.
> **Every claim below is verified unless marked UNVERIFIED. Do not trust my earlier explanations
> — two of the three root causes I proposed were disproven by my own measurements.**

---

## 0. What the user actually wants (three things, all still broken)

1. **The pill is cropped.** Cut off, visually clipped. Cause **unknown**.
2. **The halo is its own window.** User considers this a defect, not a cosmetic issue.
3. **The island does not open when the user is in another app** (Firefox, VS Code).

All three reproduce on the user's machine. **Nothing I changed this session altered any of them.**

---

## 1. Hard environment facts (measured, do not re-derive)

- Native **Wayland** session: `WAYLAND_DISPLAY=wayland-0`, `XDG_SESSION_TYPE=wayland`.
- Electron is forced onto **XWayland** by `--ozone-platform=x11` in `start-dev.sh` (~line 368).
- Consequence: any Electron `BrowserWindow` is an X11 toplevel. Native Wayland toplevels sit above
  it **permanently**. `setAlwaysOnTop` only reorders siblings inside X11 and cannot touch the
  Wayland surface list. This is the mechanical reason for symptom 3.
- `zwlr_layer_shell_v1` **v5 is available** on the compositor.
- `WAYLAND_DISPLAY` and `XDG_CURRENT_DESKTOP` must be inherited when spawning a child, or GTK fails
  to initialise.

## 2. What is BUILT AND VERIFIED (keep this, it is real)

`native/halo-layer-shell/` — a GTK4 + WebKitGTK + `zwlr_layer_shell_v1` helper.

| Check | Result |
|---|---|
| `meson setup build` / `ninja` | exit 0 |
| Binary | 36K, `build/halo-layer-shell` |
| Linked against | `libgtk4-layer-shell.so.0`, `libgtk-4.so.1`, `libwebkitgtk-6.0.so.4` |
| Runs on this compositor | emits `{"type":"ready"}`, stderr clean |
| stdin/stdout protocol | verified round-trip |
| Leaked processes | 0 |

Protocol (one JSON object per line):
```
-> {"type":"show","url":"http://localhost:PORT/halo.html","x":N,"y":N,"w":N,"h":H}
-> {"type":"hide"}
<- {"type":"ready"}
```

`src/main/halo/layerShellClient.ts` — typed client, `tsc` clean (scoped). Spawns the helper,
`show(url, rect)` / `hide()` / `stop()`. **This file is imported by nothing. It is dead code.**

Packages now installed: `gtk4-devel`, `gtk4-layer-shell-devel` (note: `.pc` is named
**`gtk4-layer-shell-0`**, not `gtk4-layer-shell`), `webkitgtk6.0-devel`, `json-glib-devel`.

## 3. What is NOT done — the actual next work

**The swap.** `src/main/halo/haloIsland.ts:781` still does `new BrowserWindow(...)`. That line is
untouched. Until it is removed the island remains an X11 toplevel and symptom 3 cannot improve.

Integration points that assume "window" and must go:
- `:781` `new BrowserWindow({...})`
- `:265`, `:272` `win.loadURL(...halo.html)`
- `:1010` `win.showInactive()` (and the focus/`screen-saver` logic around `:1003–1024`)
- `:412–568` `applyClickRegion` — `setShape(...)` / `setClickThrough(...)`
- `reconcileHaloGeometry()` / teardown

**The swap is mostly DELETION.** A layer-shell surface is not a window: it has no `setShape`, no
`setIgnoreMouseEvents`, no `setAlwaysOnTop` and no focus semantics to re-implement. The compositor
handles z-order and input natively — that is the entire benefit. Replace the ~200 lines of window
management with `client.show(url, rect)` / `client.hide()`.

**Fail loudly.** Do NOT fall back to a `BrowserWindow` if the helper is missing — that silently
restores the exact bug being fixed. `layerShellClient.ts` already throws `HaloLayerShellError`.

## 4. The pill crop — UNRESOLVED, and my explanations were WRONG

Measured facts, all confirmed:

```
compactWidth   S 182   M 198   L 227
compactHeight  S  28   M  32   L  40
rowHeight      S  48   M  56   L  64     <- sized for the EXPANDED page
fBody          S  11   M  12   L  14     <- also the DIVIDER height
```

- Row content height ≈ 20px (line box) vs pill height 28–40px → **fits vertically. Vertical
  overflow is RULED OUT.** I previously claimed vertical overflow; that was wrong.
- Horizontal overflow via a fixed 140px name **was implemented, shipped in the 20:43 build, and
  the crop persisted.** So it is not the cause either.
- **The crop's axis and side are genuinely unknown.** Nobody has looked at it.

### DO THIS FIRST
**Ask the user for a screenshot of the cropped pill.** One image settles axis and side. Every
theory I produced was theory, because I never looked at the thing. Do not repeat that.

### Known bad source comment — FIX THIS
`src/features/halo/CompactPill.tsx` contains a ~30-line comment asserting the crop was caused by
"210px of content in a 182px pill". **That arithmetic is unmeasured and disproven.** It sits above
`const nameStyle`. Delete it or mark it UNRESOLVED before trusting it. (An attempt to replace it
failed on a string mismatch — read the file.)

## 5. APIs I got wrong (cost most of the session — do not repeat)

- **json-glib has no `json_builder_add_object_value`, `json_object_to_json_string`, or
  `JSON_C_TO_STRING_PLAIN`.** Those are **json-c** symbols. I invented all three.
- `json_object_to_json_string` needs `json-gobject.h` — which does not help, it does not exist there.
- **GTK3 APIs that do not exist in GTK4:** `gtk_widget_set_app_paintable`, `gtk_widget_show/hide`
  (use `gtk_widget_set_visible`), `gdk_device_get_position`, `gtk_show_uri_on_window`.
- **Layer-shell surfaces ignore `gtk_window_move`.** Anchoring all four edges lets the compositor
  stretch the surface across the whole output and **every geometry message is silently dropped**.
  Anchor `TOP` + `LEFT` only and set position with `gtk_layer_set_margin`.
- **bash `printf` inside `$( ...; sleep N )` buffers** — a piped command never reached the child's
  stdin watch. Use `cat file` or a file redirect.
- `erasableSyntaxOnly` is enabled project-wide: **constructor parameter properties are a TS1294
  compile error.** Declare the field and assign in the constructor body.
- Never `pkill -f <pattern>` — the filter matches its own shell and hangs the session.

## 6. Constraints on whoever continues

- **§0-0: agents do not build.** The user runs `npm run build`. Close RHEO first.
- `dist/` and `dist-electron/` **are** the running app — never delete or clear them.
- Coordination gate: `node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs register|status|claim|done`.
- Kill every process you start; record PIDs.
- **Do not write a probe to prove a string exists.** I wrote 312 green assertions across 10 probes
  while the app was visibly broken in three ways. Every one tested a source string or an isolated
  number. A green probe suite is not evidence the user sees a fix.

## 7. Order of work

1. Get the screenshot. Settle the crop axis before writing any code for it.
2. Delete/correct the false-cause comment in `CompactPill.tsx`.
3. Do the window swap (`haloIsland.ts:781`). Mostly deletion. Then the user builds and tests
   symptom 3 — that is the one with a verified mechanism behind it.
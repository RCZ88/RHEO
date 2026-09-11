<!-- SESSION: opencode-linux-tracking-20260910 -->
<!-- AGENT: opencode | TERMINAL: codex | PROJECT: App Tracker -->

# Agent State — opencode-linux-tracking-20260910

> **STATUS:** completed | **UPDATED:** 2026-09-10T23:32:00+07:00

---

## CURRENT CYCLE (1)
**ROLE:** Hands & Eyes — fix Linux foreground/application tracking
**STATUS:** completed
**IN FLIGHT:**
- None
**COMPLETED:**
- Added `src/linuxForeground.ts` with bounded X11 `xprop` and `xdotool` fallbacks, robust Linux window metadata parsing, and `/proc/<pid>/exe` resolution.
- Wired the fallback into `pollForeground()` after `active-win` returns no result.
- Verified parser fixture and rebuilt `dist-electron/main.cjs` and `dist-electron/preload.cjs`.
- Confirmed this environment is native GNOME Wayland; no universal active-window API is available, so runtime resolver returns undefined safely instead of logging the wrong app.
- Renderer `vite build` timed out after 180 seconds during `transforming`; no renderer code was changed.
- Packaged valid `dist/src.zip` and recorded the Wayland limitation in durable memory.
**NEXT ACTION:** User should relaunch the Linux build; X11 sessions will use the fallback. Native Wayland requires a compositor-specific integration or X11 session for global app tracking.
**NOTES:** Existing worktree contains many unrelated dirty files; only `src/main.ts`, new `src/linuxForeground.ts`, this spoke, and `MEMORY.md` were changed in this cycle.

---

## HISTORY (previous 2 cycles, oldest first)
(Empty — cycle 1 is current.)

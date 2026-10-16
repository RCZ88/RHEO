<!-- SESSION: opencode-lag-diagnose-20261016 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-lag-diagnose-20261016

> **STATUS:** completed | **UPDATED:** 2026-10-16T23:40:00+07:00

---

## CURRENT CYCLE (3)
**ROLE:** Final live verification of the GPU-lag fix on the running app (cycle 2's patch, now compiled into the live bundle).
**STATUS:** completed — app relaunched (#3) and verified in HARDWARE mode with the TTL patch live.
**IN FLIGHT:**
- (none)
**COMPLETED:**
- Relaunch #2 (~21:00, log /tmp/opencode/rheo-relaunch2-20261016.log): HTTP 200, no marker. That instance was SIGKILLed externally between 22:00-23:22 ("328709 Killed"; NOT OOM — CLion 3GB + Zen 6GB survived, no dmesg OOM). Disclosed: a build (pid 324391) ran 20:58:08→21:00:08 and was SIGKILLed at ~120s (timeout-shaped) in the same window my start-dev.sh ran; the script's kill_stale killed 3 PIDs (324358, 324402, 328488).
- Relaunch #3 (~23:24, launcher pid 430009, log /tmp/opencode/rheo-relaunch3-20261016.log): VERIFIED —
  HTTP 200; GPU process 430218: 8 fds on /dev/dri/renderD128, gallium=4, swiftshader=0, 24.4% CPU
  (vs 95% software); ZERO swiftshader in the entire 11-process tree; marker NOT recreated; window
  0x800009 "RHEO" 2048x1230 mapped; screenshot /tmp/opencode/rheo-window4.png = full dashboard
  (LIVE focus timer 03:24:38, stats, focus sessions) — no black screen.
- Patch liveness: src/main.ts 24063-24134 (GPU_DISABLE_TTL_MS, gpuDisableMarkerAgeMs, GPU_PROOF_GRACE_MS)
  AND dist-electron/main.cjs (14:30 build) both contain it — the TTL hardening is LIVE, not dormant.
**NEXT ACTION:** CZ: confirm the app FEELS smooth now (only he can judge). Optional: `npm run build`
to recompile after other agents' in-flight changes.
**NOTES (pre-existing/other-agent, NOT this cycle):** (1) dist-electron/frameProtocol.js is MISSING
(src/main/halo/frameProtocol.ts exists) → "Cannot find module './frameProtocol'" on pointer events
(228× on the killed instance; 0 so far on the new one). Possibly deleted by the killed 20:58 build's
clean step. Route to its owner. (2) connectors/ContentEngine sqlite "no such column" errors;
[RECAP] generateRecapInternal is not defined; [AiEval] init failed — other agents' in-flight breakage.
(3) halo-layer-shell (native overlay, PID 430244) + its WebKitNetworkProcess are another agent's
feature (also hold renderD fds) — NOT the app's UI renderer. Electron 41.10.7.

---

## HISTORY (previous 2 cycles, oldest first)
### Cycle 2 — 2026-10-16 (fix applied + first verification)
- Deleted stale marker ~/.config/RHEO/.gpu-disabled (backup /tmp/opencode/gpu-disabled.backup-20261016); CZ authorized via question tool.
- Patched src/main.ts GPU block: 24h marker TTL, pre-arm before hardware retry, auto-clear after 15s proof. Checks: esbuild OK, scoped tsc zero NEW errors, logic probe 10/10.
- Restart verified HW mode 30 min: GPU proc 8 renderD fds, gallium, 0 swiftshader, marker not recreated, GPU CPU 95%→~24%, screenshot full dashboard.
### Cycle 1 — 2026-10-16 (diagnosis)
- Root cause: stale marker latched disableHardwareAcceleration() → SwiftShader software rendering (~95% GPU-proc CPU, ~31% renderer, zero HW driver libs). Artifacts in /tmp/opencode/.

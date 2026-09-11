# E0 CENSUS — executed by Hermes (executor), 2026-09-10 ~02:15 WIB

## E0.1 True process tree
- RHEO app = PID 338667 (main, cwd = live project `Documents/COMPUTAH_SAYENCE/App Tracker`, 57+ min old) + 5 zygotes + 1 network utility at first enumeration.
- By end of E0: ALL children are `[electron] <defunct>` zombies. Live processes: main only.
- `--type=renderer`: **0 across the box for this app.** `--type=gpu-process`: **0.**
- `ps -eo pid,ppid,etime,args` + per-PID `/proc/<pid>/cmdline` + `ps --ppid <zygote>` — no hidden renderer anywhere. (Prior "impossible process map" CONFIRMED, not mis-enumeration.)

## E0.2 Window → PID → bundle binding
- `wmctrl -lp`: window `0x03c00004 "RHEO"` → PID **338667** (the live main). No duplicate instance (single main; SingletonLock present).
- `lsof -p 338667 | grep dist`: NO bundle files open (dead renderer holds nothing) → **PID→bundle file binding IMPOSSIBLE** (STOP-condition adjacent; see verdict).
- `dist/index.html` → `assets/index.CC_didq1.js`, which CONTAINS all perf fixes (hermite ×1, 4-tap ×1, app-ferrofluid ×1). Note: dist holds 3 index.*.js hashes (another session rebuilt during the wave).
- Port :38123 served the fixed bundle earlier in the night; **port is now dead** (curl empty). Window loads via file:// dist.
- Paint test: two screenshots 2s apart = **0.00% pixels changed** (vs 12.9%/s when alive earlier). Synthetic pointer wake via xdotool → still 0.00%. **Renderer is dead; window shows last painted frame; main lingers at 9–15% CPU.**

## E0.3 GPU node audit
- `/dev/dri`: card0, card1, renderD128, renderD129 (Intel Arc + RTX 4050 Mobile present).
- `fuser -v renderD128/129`: holders = plasma/firefox/obsidian/Hermes — **RHEO holds NO render node.**
- Main's fd table: GPUCache files only, no `/dev/dri` handle. No GPU flags in `src/main.ts` (no appendSwitch/disable-gpu hits). S-5 (software GL) SUPPORTED, never contradicted.

## E0.4 Environment log
- Display: 2048×1280 (window is fullscreen; X11, DPR effectively 1 → 2.6M px canvas).
- RAM: 30GB total, 23 used, 2 free. **Swap: 8GB total, 7GB USED** — box is deep in swap.
- Top CPU at census: Hermes 47%, firefox 27%, **mount.ntfs-3g 25%** (project lives on NTFS mount), hermes 23%, RHEO main ~9–15%.
- Governor: performance. Animations enabled (no reduced-motion). 22 CPUs.

## E0 VERDICT (blocking finding)
1. **The on-screen app is a stale corpse**: renderer dead (0.00% paint, no wake, zero renderer processes, zombie children), main lingering. Any "lag" felt right now is an UNRESPONSIVE process, not slow rendering.
2. **S-6 CONFIRMED in substance** (stale-instance class): the process on screen cannot be profiled for live-render cost. E1 numeric A/B is BLOCKED until a fresh live instance exists.
3. **New S-7 (box under pressure)**: 7/8GB swap consumed + NTFS driver at 25% CPU + ~100% combined load from sibling apps. Even a healthy renderer would jank here; any E1 numbers taken in this state measure the box, not the background.
4. S-5 stands (no render node ever held). S-2/S-3/S-4 untested (need live instance).

## E0 ADDENDUM (post-census correction, same night)
- The "dead renderer" verdict was WRONG. Follow-up: synthetic click (after windowactivate) produced a 2.54% frame change, and a `--type=renderer` process (PID 49502, CPU 0) was observed transiently, then reaped. Earlier 0.00% readings = PERF-FIX2 idle-freeze working + unfocused xdotool input not delivered (Escape/clicks without prior windowactivate did nothing; with windowactivate they land).
- Corrected shape: renderer is REAL but SHORT-LIVED in snapshots (present on input, absent during minute-long idle watches; main steady ~5.5%). Whether this is on-demand spawn, rapid crash-respawn, or enumeration aliasing is UNRESOLVED — flagged for the E3/E5 passes, not assumed.
- S-6 (stale/duplicate instance) is DOWNGRADED: window→PID binding is clean (wmctrl → live main), dist bundle is current+fixed, no duplicates. The corpse theory is out; the transient-renderer shape is in.
- S-5 (software GL) stands and hardens: STILL zero gpu-process and zero DRI handles across every snapshot.

## RESCOPE (superseded — principal chose Path A, app relaunched as PID 32166/32173)
- E1 proceeds on the fresh instance. E1 relaunch discipline: user relaunches; executor never kills app processes.

// mobile-telemetry-transitions.probe.mjs — runs the REAL usePhoneTracker module
// (from ~/dev/deskflow-mobile-kit) with native/network deps stubbed, and asserts
// the app-state transition math that feeds POST /v1/phone/telemetry/push.
//
// Rebuild the bundle first (from /home/clementzhao/dev/rheo):
//   npx esbuild ~/dev/deskflow-mobile-kit/mobile-app/src/hooks/usePhoneTracker.ts \
//     --bundle --format=esm --platform=node --outfile=/tmp/opencode/mtk-bundle.mjs \
//     --alias:react=/tmp/opencode/mtk-stubs/react.mts \
//     --alias:react-native=/tmp/opencode/mtk-stubs/react-native.mts \
//     --alias:@react-native-async-storage/async-storage=/tmp/opencode/mtk-stubs/async-storage.mts \
//     --alias:../api/client=/tmp/opencode/mtk-stubs/api-client.mts \
//     --alias:../lib/nativeShield=/tmp/opencode/mtk-stubs/native-shield.mts
import {
  applyTransition,
  pushScreenTime,
  todayForegroundSec,
  lastTrackerStatus,
} from "/tmp/opencode/mtk-bundle.mjs"

// The bundled module inlines its own copy of the api-client stub, so the call
// log is shared through globalThis (the stub writes there).
const calls = (globalThis.__mtkApiCalls ??= [])

let pass = 0, fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name) }
  else { fail++; console.log("  FAIL", name, extra !== undefined ? JSON.stringify(extra) : "") }
}

// Scenario: 300s in-app -> leave -> 120s away -> return -> 240s in-app -> push.
// Honest semantics: fg = 300+240 = 540, bg = 120, unlocks = 1.
// Pre-fix code stored fg = 300+120+240 = 660 and bg = 300-120 = 180.

// 1. Fresh boot, nothing owed: push must NOT hit the network.
await pushScreenTime()
check("empty day pushes nothing", calls.length === 0, calls)
check("status ok when idle", lastTrackerStatus === "ok", lastTrackerStatus)

// 2. The fg/bg/unlock cycle.
applyTransition(true, false, 300)  // leaving after 300s active
check("leave -> pendingFg 300", todayForegroundSec === 300, todayForegroundSec)
applyTransition(false, true, 120)  // 120s away, then return
applyTransition(true, false, 240)  // leaving again after 240s active
check("fg totals 540 (not 660)", todayForegroundSec === 540, todayForegroundSec)

// 3. Push carries DELTAS + unlock_count; battery absent without native module.
await pushScreenTime()
check("one network call", calls.length === 1, calls)
const body = calls[0]?.body
check("path is telemetry/push", calls[0]?.path === "/v1/phone/telemetry/push", calls[0]?.path)
check("fg delta = 540", body?.deskflow_usage?.foreground_seconds === 540, body?.deskflow_usage)
check("bg delta = 120", body?.deskflow_usage?.background_seconds === 120, body?.deskflow_usage)
check("unlock_count = 1", body?.deskflow_usage?.unlock_count === 1, body?.deskflow_usage)
check("device_id present", body?.device_id === "dev-probe-1", body?.device_id)
check("battery omitted (no native)", body?.battery === undefined, body?.battery)
check("status ok after push", lastTrackerStatus === "ok", lastTrackerStatus)

// 4. Deltas are cleared ONLY after acceptance: a second push sends nothing.
await pushScreenTime()
check("second push sends nothing (deltas cleared)", calls.length === 1, calls)

console.log(`\n${pass}/${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)

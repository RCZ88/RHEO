// mobile-camera-guard.probe.mjs — proves the expo-camera guard (kit
// src/lib/camera.tsx) does its job, mirroring mobile-image-picker-guard:
//
//  HOSTILE host (no native ExpoCamera — the crash CZ would hit next):
//    - the shim and the REAL PairScreen module graph load without a boot crash
//    - cameraAvailable() = false; CameraView renders an honest hint
//    - useCameraPermissions keeps the real 3-tuple shape, never rejects
//  FRIENDLY host (native present):
//    - CameraView is the REAL class (identity), hook delegates untouched
//
// Rebuild the three bundles first (from /home/clementzhao/dev/rheo):
//   STUB=/tmp/opencode/cam-stubs
//   npx esbuild ~/dev/deskflow-mobile-kit/mobile-app/src/lib/camera.tsx \
//     --bundle --format=esm --platform=node --outfile=/tmp/opencode/cam-shim-hostile.mjs \
//     --alias:react=$STUB/react.mts --alias:react-native=$STUB/react-native.mts \
//     --alias:expo-camera=$STUB/camera-hostile.ts --log-level=error
//   npx esbuild ~/dev/deskflow-mobile-kit/mobile-app/src/lib/camera.tsx \
//     --bundle --format=esm --platform=node --outfile=/tmp/opencode/cam-shim-ok.mjs \
//     --alias:react=$STUB/react.mts --alias:react-native=$STUB/react-native.mts \
//     --alias:expo-camera=$STUB/camera-ok.ts --log-level=error
//   npx esbuild /tmp/opencode/cam-ps/screens/PairScreen.tsx \
//     --bundle --format=esm --platform=node --outfile=/tmp/opencode/cam-pair-hostile.mjs \
//     --alias:react=$STUB/react.mts --alias:react-native=$STUB/react-native.mts \
//     --alias:expo-camera=$STUB/camera-hostile.ts --alias:@expo/vector-icons=$STUB/feather.mts --log-level=error
// (the PairScreen bundle keeps the REAL shim and REAL PairScreen; only
//  react-native primitives, icons, theme, ui and api/client are stubbed)

let pass = 0, fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name) }
  else { fail++; console.log("  FAIL", name, extra !== undefined ? String(JSON.stringify(extra) ?? extra).slice(0, 160) : "") }
}

// ── HOSTILE host ──
let hostile = null
try {
  hostile = await import("/tmp/opencode/cam-shim-hostile.mjs")
  check("shim loads when native module is ABSENT (no boot crash)", true)
} catch (e) {
  check("shim loads when native module is ABSENT (no boot crash)", false, e?.message)
}
if (hostile) {
  check("cameraAvailable() = false in hostile host", hostile.cameraAvailable() === false)
  check("CameraView falls back to an honest function component", typeof hostile.CameraView === "function", typeof hostile.CameraView)
  const el = hostile.CameraView({ style: { flex: 1 } })
  check("fallback renders a hint element (no throw)", !!el && el.__el === true && Array.isArray(el.children) && el.props?.style?.flex === 1, el)
  const tuple = hostile.useCameraPermissions()
  const [perm, getPerm, reqPerm] = tuple
  check("hook keeps the real 3-tuple shape", Array.isArray(tuple) && tuple.length === 3 && typeof getPerm === "function" && typeof reqPerm === "function", tuple?.length)
  check("permission honest: not granted / undetermined", perm?.granted === false && perm?.status === "undetermined", perm)
  const req = await reqPerm()
  check("request() resolves not-granted (never rejects)", req?.granted === false && req?.status === "undetermined", req)
}

// ── FRIENDLY host ──
let ok = null
try {
  ok = await import("/tmp/opencode/cam-shim-ok.mjs")
  check("shim loads when native module is PRESENT", true)
} catch (e) {
  check("shim loads when native module is PRESENT", false, e?.message)
}
if (ok) {
  check("cameraAvailable() = true in friendly host", ok.cameraAvailable() === true)
  check("CameraView delegates to the REAL class (identity)", ok.CameraView === globalThis.__camStubCtor, typeof ok.CameraView)
  const [perm, , req] = ok.useCameraPermissions()
  check("useCameraPermissions delegates (real hook result)", perm?.granted === true, perm)
  const r = await req()
  check("real request path passes through", r?.granted === true, r)
}

// ── BOOT PATH: the REAL PairScreen module graph loads on a hostile host ──
try {
  await import("/tmp/opencode/cam-pair-hostile.mjs")
  check("REAL PairScreen (the boot screen) loads when native module is ABSENT", true)
} catch (e) {
  check("REAL PairScreen (the boot screen) loads when native module is ABSENT", false, e?.message)
}

console.log(`\n${pass}/${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)

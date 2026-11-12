// mobile-image-picker-guard.probe.mjs — proves the expo-image-picker guard
// (~/dev/deskflow-mobile-kit/mobile-app/src/lib/imagePicker.ts) does its job:
//
//  HOSTILE host (no native ExponentImagePicker — the boot-crash CZ hit):
//    - importing the REAL life.ts module must NOT throw at load time
//    - imagePickerAvailable() is false; picker calls throw an HONEST error
//  FRIENDLY host (native present):
//    - the shim delegates: args flow through, stub result returns
//
// Rebuild the four bundles first (from /home/clementzhao/dev/rheo):
//   SRC=/tmp/opencode/ipg-src; STUB=/tmp/opencode/ipg-stubs
//   npx esbuild $SRC/lib/imagePicker.ts --bundle --format=esm --platform=node \
//     --outfile=/tmp/opencode/ipg-shim-hostile.mjs --alias:expo-image-picker=$STUB/picker-hostile.ts
//   npx esbuild $SRC/lib/imagePicker.ts --bundle --format=esm --platform=node \
//     --outfile=/tmp/opencode/ipg-shim-ok.mjs --alias:expo-image-picker=$STUB/picker-ok.ts
//   npx esbuild $SRC/api/life.ts --bundle --format=esm --platform=node \
//     --outfile=/tmp/opencode/ipg-life-hostile.mjs \
//     --alias:expo-image-picker=$STUB/picker-hostile.ts \
//     --alias:@react-native-async-storage/async-storage=/tmp/opencode/mtk-stubs/async-storage.mts
//   npx esbuild $SRC/api/life.ts --bundle --format=esm --platform=node \
//     --outfile=/tmp/opencode/ipg-life-ok.mjs \
//     --alias:expo-image-picker=$STUB/picker-ok.ts \
//     --alias:@react-native-async-storage/async-storage=/tmp/opencode/mtk-stubs/async-storage.mts

let pass = 0, fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name) }
  else { fail++; console.log("  FAIL", name, extra !== undefined ? String(extra).slice(0, 160) : "") }
}

// ── HOSTILE host ──
let hostileShim = null
try {
  hostileShim = await import("/tmp/opencode/ipg-shim-hostile.mjs")
  check("shim loads when native module is ABSENT (no boot crash)", true)
} catch (e) {
  check("shim loads when native module is ABSENT (no boot crash)", false, e?.message)
  hostileShim = null
}

let hostileLife = null
try {
  hostileLife = await import("/tmp/opencode/ipg-life-hostile.mjs")
  check("REAL life.ts loads when native module is ABSENT (boot fix)", true)
} catch (e) {
  check("REAL life.ts loads when native module is ABSENT (boot fix)", false, e?.message)
  hostileLife = null
}

if (hostileShim) {
  check("imagePickerAvailable() = false in hostile host", hostileShim.imagePickerAvailable() === false)
  check("MediaTypeOptions fallback present", typeof hostileShim.MediaTypeOptions?.Images === "string")
  let threw = null
  try { await hostileShim.launchImageLibraryAsync({ quality: 0.6 }) } catch (e) { threw = e }
  check("picker call fails at CALL time with an honest message", threw !== null && /unavailable/i.test(threw?.message ?? ""), threw?.message)
}

// ── FRIENDLY host ──
let okShim = null
try {
  okShim = await import("/tmp/opencode/ipg-shim-ok.mjs")
  check("shim loads when native module is PRESENT", true)
} catch (e) {
  check("shim loads when native module is PRESENT", false, e?.message)
  okShim = null
}
if (okShim) {
  check("imagePickerAvailable() = true in friendly host", okShim.imagePickerAvailable() === true)
  const res = await okShim.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 })
  check("launchImageLibraryAsync delegates and returns the native result", res?.canceled === false && res?.assets?.[0]?.uri === "file://stub.png", res)
  const calls = globalThis.__ipgPickerCalls ?? []
  const last = calls.at(-1)
  check("options object passed through untouched", Array.isArray(last?.[1]?.[0]?.mediaTypes) && last[1][0].mediaTypes[0] === "images", JSON.stringify(last))
}

console.log(`\n${pass}/${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)

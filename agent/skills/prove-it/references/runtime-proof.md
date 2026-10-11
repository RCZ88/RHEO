# Runtime Proof — templates by change class

Rule of thumb: the proof must be the kind of thing that FAILS LOUDLY if the defect is present.
tsc and esbuild both watched a `useRef` inside a `useEffect` and reported CLEAN; only the
browser console said React #321. Choose the proof that watches the actual failure surface.

## 1. Module logic — the numbers probe
File: agent/probes/<name>.probe.mts. Zero deps. Import the units you changed, exercise them,
print numbers, assert by printing. A probe that prints `3` when the expected is visibly `4` is
honest; a probe that prints "OK" is not.
Run:
  npx esbuild agent/probes/<name>.probe.mts --bundle --platform=node --format=esm --outfile=/tmp/<name>.mjs && node /tmp/<name>.mjs
Skeleton (halo-core.probe.mts pattern — 33 assertions, 0 deps):
  const ok = (cond: boolean, msg: string) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } };
  // exercise the changed units…
  ok(result === expected, "<label>");
PASS: exit 0 AND every printed line matches expectation. Quote the lines in the verdict.

## 2. DOM presence — locator count
Against `npm run dev` (record the PID at spawn):
  const n = await page.locator('[data-section="halo-island"]').count();
  assert n >= 1 (presence) / n === 0 (removal).
Banned weak form: "the screenshot looks right." Strong form: count + attribute values.

## 3. Toggles and settings — both states, measured
A toggle proof has two assertions minimum: state A shows the surface, state B hides it. If the
setting persists, add a third: reload, assert the survived state.
Numeric settings (e.g. "halo island size") need a numeric assertion, not just existence:
  const box = await page.locator("<surface>").boundingBox();
  setSetting(size, A); reload; assert boundingBox().width  === expectedA;
  setSetting(size, B); reload; assert boundingBox().width  === expectedB;
A settings row that renders but drives nothing is defect #2 wearing a costume.

## 4. Animation — intermediate frames
Count positions BETWEEN endpoints over a window (halo-anim.mjs pattern). An instant snap yields
only endpoints and proves nothing animated. Honour `prefers-reduced-motion` (design/design.md §6):
run the frame-count proof with motion enabled; verify the reduced-motion path separately by
asserting the end state is still reached.

## 5. React lifecycle — pageerror capture
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // …interact…
  assert errors.length === 0;
This is the ONLY gate that catches misplaced hooks. React error #321 killed the entire app with
tsc and esbuild clean. Any change touching hooks, effects, or render order requires it.

## 6. Environment / init placement — assert the effect, not the assignment
`process.env.ELECTRON_OZONE_PLATFORM_HINT` assigned inside main.ts, long after Electron chose
its backend: no error, no warning, no log — the feature simply never worked. The proof lives at
the CONSUMER: assert the rendered/behavioural effect (window property, flag, platform log line),
never that the assignment executed. If you cannot observe the effect, you cannot claim the setting.

## 7. Patch integrity — re-read the wound (pairs with SKILL Step 3)
Before any scripted edit, for each top-level symbol (hooks, consts, functions, exports):
  grep -c "<symbol>" <file>      # record
After: identical counts, or changed exactly as intended. A Python slice once removed a duplicate
type AND a hook AND a module const, then printed success; the file only failed later at runtime
with a ReferenceError. Counts are cheap. Run them on every scripted edit, then read
`git diff -- <file>` hunk by hunk — every hunk intended, or fix by hand (never git restore).

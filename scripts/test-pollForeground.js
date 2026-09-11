/**
 * Standalone test runner for pollForeground invariants — v3.
 * Matches the patched pollForeground in src/main.ts exactly.
 *
 * Run: node scripts/test-pollForeground.js
 */
import { readFileSync } from 'node:fs'

// -----------------------------------------------------------------------
// Fake clock
// -----------------------------------------------------------------------
function createFakeClock (nowMs = 1_000_000) {
  let current = nowMs
  return {
    now () { return current },
    advance (ms) { current += Math.max(0, ms) },
  }
}

// -----------------------------------------------------------------------
// Tracking state
// -----------------------------------------------------------------------
function freshState (nowMs) {
  return {
    currentApp: 'AppA',
    sessionStart: nowMs - 60_000,
    lastPollTime: nowMs - 1000,
    lastSuccessfulObservationTime: nowMs - 1000,
    consecutiveNullPolls: 0,
    logs: [],
  }
}

// -----------------------------------------------------------------------
// Constants (mirror main.ts)
// -----------------------------------------------------------------------
const SLEEP_GAP_MS = 30_000
const MAX_SESSION_MS = 120 * 60 * 1000
const BROWSER_MAX_NULL_POLL = 60
const NORMAL_MAX_NULL_POLL = 30

// -----------------------------------------------------------------------
// Pure transition — mirrors patched pollForeground in src/main.ts
// -----------------------------------------------------------------------
function tick (state, clock, outcome) {
  const now = clock.now()
  const previousPollTime = state.lastPollTime
  state.lastPollTime = now

  // Step 2-3: primary collector + Linux fallback (modeled by outcome)
  const effectiveResult = outcome.fallbackOK && outcome.isLinux &&
    (outcome.collectorThrown || outcome.result === null)
    ? { title: 'FallbackTitle', owner: { name: 'FallbackOwner' } }
    : outcome.result

  // Step 5: resolve
  const resolved = outcome.resolved

  // Step 6: SINGLE failure-count increment (mirrors main.ts line 4853-4856)
  const attemptFailed = effectiveResult === null || resolved === null
  if (attemptFailed) {
    state.consecutiveNullPolls += 1
  }

  // Step 7: Sleep-gap detection (time-based)
  const timeSinceLastPoll = now - previousPollTime
  if (timeSinceLastPoll > SLEEP_GAP_MS) {
    if (state.currentApp &&
        state.currentApp !== 'RHEO' &&
        state.currentApp !== 'DeskFlow' &&
        state.currentApp !== 'Electron') {
      const knownDuration = state.lastSuccessfulObservationTime - state.sessionStart
      if (knownDuration > 5000) {
        state.logs.push({
          app: state.currentApp,
          start: state.sessionStart,
          duration: Math.min(knownDuration, MAX_SESSION_MS),
        })
      }
    }
    state.currentApp = null
    state.sessionStart = now
    state.lastSuccessfulObservationTime = now
    state.consecutiveNullPolls = 0
    return state
  }

  // Step 8: if (!result): handle absent observation
  if (effectiveResult === null) {
    // Keep-alive: known game with keepalive resolver
    if (resolved && resolved.source === 'keepalive' && state.currentApp) {
      state.consecutiveNullPolls = 0
      state.sessionStart = state.sessionStart ?? now
      return state
    }
    // Game category keep-alive
    if (state.currentApp && state.currentApp.toLowerCase() === 'game') {
      state.sessionStart = now
      return state
    }
    // Browser: ALWAYS early return.
    // Below threshold: reset sessionStart only (match main.ts behavior), keep lastSuccessful unchanged.
    // At 60+ polls: log session, reset everything.
    if (state.currentApp && state.currentApp.toLowerCase().includes('browser')) {
      if (state.consecutiveNullPolls >= BROWSER_MAX_NULL_POLL) {
        const knownDuration = state.lastSuccessfulObservationTime - state.sessionStart
        if (knownDuration > 5000) {
          state.logs.push({
            app: state.currentApp,
            start: state.sessionStart,
            duration: Math.min(knownDuration, MAX_SESSION_MS),
          })
          state.currentApp = null
        }
        state.consecutiveNullPolls = 0
        state.sessionStart = now
        state.lastSuccessfulObservationTime = now
        return state
      }
      // Below threshold: reset sessionStart only (matching main.ts line 4923).
      // Do NOT update lastSuccessfulObservationTime — it stays unchanged.
      state.sessionStart = now
      return state
    }
    // Normal apps: after 30 consecutive failed attempts
    if (state.currentApp && state.consecutiveNullPolls >= NORMAL_MAX_NULL_POLL) {
      const knownDuration = state.lastSuccessfulObservationTime - state.sessionStart
      if (knownDuration > 5000 &&
          state.currentApp !== 'RHEO' &&
          state.currentApp !== 'DeskFlow' &&
          state.currentApp !== 'Electron') {
        state.logs.push({
          app: state.currentApp,
          start: state.sessionStart,
          duration: Math.min(knownDuration, MAX_SESSION_MS),
        })
        state.currentApp = null
      }
      state.sessionStart = now
      state.lastSuccessfulObservationTime = now
      state.consecutiveNullPolls = 0
      return state
    }
    // counter < 30: no early return, fall through
    return state
  }

  // Step 9: if (!resolved): already counted in step 6, just return
  if (resolved === null) {
    return state
  }

  // Step 10: Valid observation path
  if (effectiveResult !== null && resolved !== null) {
    state.consecutiveNullPolls = 0
    state.lastSuccessfulObservationTime = now

    const appName = resolved.name
    if (appName !== state.currentApp) {
      const rawDuration = state.lastSuccessfulObservationTime - state.sessionStart
      if (state.currentApp && rawDuration > 5000) {
        state.logs.push({
          app: state.currentApp,
          start: state.sessionStart,
          duration: Math.min(rawDuration, MAX_SESSION_MS),
        })
      }
      state.currentApp = appName
      state.sessionStart = now
      state.lastSuccessfulObservationTime = now
    }
    return state
  }

  return state
}

function poll (args = {}) {
  return {
    result: null,
    resolved: null,
    isLinux: false,
    fallbackOK: false,
    collectorThrown: false,
    ...args,
  }
}

// -----------------------------------------------------------------------
// Test runner
// -----------------------------------------------------------------------
let passed = 0
let failed = 0

function assert (condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message}`)
  }
}

function assertEquals (actual, expected, message) {
  if (actual === expected) {
    passed++
    console.log(`  ✓ ${message} (=${expected})`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message} — expected ${expected}, got ${actual}`)
  }
}

console.log('=== pollForeground control-flow invariants (v3) ===\n')

// --- Test 1: Single increment per attempt (counter < threshold) ---
{
  console.log('1. Single increment per attempt (counter < threshold)')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  for (let i = 0; i < 29; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.consecutiveNullPolls, 29,
    '29 null polls → counter = 29 (SINGLE increment per poll, not 58)')
}

// --- Test 2: Threshold fires at 30, resets counter ---
{
  console.log('\n2. Threshold fires at 30, resets counter')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  for (let i = 0; i < 29; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.consecutiveNullPolls, 29, '29 polls → counter = 29')
  tick(st, clock, poll({ result: null, resolved: null }))
  clock.advance(1000)
  assertEquals(st.consecutiveNullPolls, 0, '30th poll triggers threshold → counter reset')
  assertEquals(st.logs.length, 1, 'Threshold logs once')
}

// --- Test 3: Single poll with both null: counter = 1 ---
{
  console.log('\n3. Single poll with both null (counter < 30): increment once')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  tick(st, clock, poll({ result: null, resolved: null }))
  assertEquals(st.consecutiveNullPolls, 1,
    'Single poll with both null → counter = 1 (old bug would be 2)')
}

// --- Test 4: Linux fallback after primary throws ---
{
  console.log('\n4. Linux fallback attempted after primary collector throws')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  tick(st, clock, poll({
    result: null, resolved: { name: 'FO', source: 'map' },
    isLinux: true, fallbackOK: true, collectorThrown: true,
  }))
  assertEquals(st.consecutiveNullPolls, 0,
    'Fallback succeeds → no failure increment (attemptFailed = false)')
  assertEquals(st.lastSuccessfulObservationTime, clock.now(),
    'lastSuccessfulObservationTime updated on valid observation')
}

// --- Test 5: Linux fallback after primary returns null on Linux ---
{
  console.log('\n5. Linux fallback after primary returns null (no throw)')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  tick(st, clock, poll({
    result: null, resolved: { name: 'FO', source: 'map' },
    isLinux: true, fallbackOK: true, collectorThrown: false,
  }))
  assertEquals(st.consecutiveNullPolls, 0, 'Fallback succeeds → no increment')
}

// --- Test 6: Linux NOT attempted on Windows ---
{
  console.log('\n6. Linux fallback NOT attempted on non-Linux')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  tick(st, clock, poll({
    result: null, resolved: null,
    isLinux: false, fallbackOK: false, collectorThrown: true,
  }))
  assertEquals(st.consecutiveNullPolls, 1,
    'Windows: collector throws, no fallback → 1 increment')
}

// --- Test 7: lastSuccessfulObservationTime used for duration ---
{
  console.log('\n7. lastSuccessfulObservationTime used for session duration')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.sessionStart = clock.now() - 120_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  st.currentApp = 'AppA'
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 1, 'AppA logged once at threshold')
  assertEquals(st.logs[0].app, 'AppA', 'Logged app is AppA')
  assertEquals(st.logs[0].duration, 60_000,
    'Duration = lastSuccessfulObservationTime - sessionStart = 60s')
}

// --- Test 8: A → unavailable → B: gap not assigned ---
{
  console.log('\n8. Observed A → unavailable → observed B: gap not assigned')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 120_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 1, 'AppA logged once at threshold')
  assertEquals(st.logs[0].duration, 60_000, 'AppA duration = 60s (gap not included)')
  assertEquals(st.currentApp, null, 'currentApp reset after threshold')
  const recoveryTime = clock.now()
  tick(st, clock, poll({ result: { title: 'AppB' }, resolved: { name: 'AppB', source: 'raw' } }))
  assertEquals(st.currentApp, 'AppB', 'AppB becomes current')
  assertEquals(st.sessionStart, recoveryTime, 'AppB session starts at recovery time')
  assertEquals(st.logs.length, 1, 'Only 1 log — gap not assigned to B')
}

// --- Test 9: Recovery into same app does not bridge gap ---
{
  console.log('\n9. Recovery into same app does not bridge unknown gap')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 120_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  const recoveryTime = clock.now()
  tick(st, clock, poll({ result: { title: 'AppA' }, resolved: { name: 'AppA', source: 'raw' } }))
  assertEquals(st.sessionStart, recoveryTime,
    'New session starts at recovery time, not continuing old session')
  assertEquals(st.logs.filter(l => l.app === 'AppA').length, 1,
    'Only 1 log for AppA — recovery does not re-log')
}

// --- Test 10: Suspend/resume via sleep gap ---
{
  console.log('\n10. Sleep-gap detection fires on wall-clock gap, not null count')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 60_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  clock.advance(35_000)
  tick(st, clock, poll({
    result: { title: 'AppA' }, resolved: { name: 'AppA', source: 'raw' },
  }))
  assertEquals(st.currentApp, null, 'Sleep gap → currentApp = null')
  assertEquals(st.sessionStart, clock.now(), 'sessionStart reset to now')
  assertEquals(st.consecutiveNullPolls, 0, 'consecutiveNullPolls reset')
}

// --- Test 11: Game keepalive preserved during null polls ---
{
  console.log('\n11. Game keepalive preservation')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'GameApp'
  st.sessionStart = clock.now() - 60_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.currentApp, 'GameApp', 'Game session preserved after 30 null polls')
  assertEquals(st.logs.length, 0, 'No logs for game keepalive')
  assertEquals(st.consecutiveNullPolls, 0, 'Counter reset (game path clears it)')
}

// --- Test 12: Keepalive source resets counter ---
{
  console.log('\n12. Keepalive source resets consecutiveNullPolls')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'GameApp'
  st.sessionStart = clock.now() - 60_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 29; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.consecutiveNullPolls, 29, '29 null polls accumulated')
  tick(st, clock, poll({
    result: null, resolved: { name: 'GameApp', source: 'keepalive' },
  }))
  assertEquals(st.consecutiveNullPolls, 0, 'Keepalive resets counter to 0')
  assertEquals(st.logs.length, 0, 'No log emitted by keepalive')
}

// --- Test 13: No silent catch-up of unknown intervals ---
{
  console.log('\n13. No silent catch-up of unknown intervals during recovery')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 60_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 0, 'No log — knownDuration = 0 (≤ 5000)')
  assertEquals(st.consecutiveNullPolls, 0, 'Counter reset after threshold')
  tick(st, clock, poll({ result: { title: 'AppB' }, resolved: { name: 'AppB', source: 'raw' } }))
  assertEquals(st.logs.length, 0, 'Still 0 logs — gap NOT caught up')
}

// --- Test 14: Repeated unavailable does not duplicate final interval ---
{
  console.log('\n14. Repeated unavailable does not duplicate final valid interval')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 120_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 1, '1 log at threshold')
  for (let i = 0; i < 10; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 1, 'Still 1 log — repeated nulls do not duplicate')
  assertEquals(st.consecutiveNullPolls, 10, 'Counter at 10 (building toward next threshold)')
}

// --- Test 15: Normal app threshold logs with correct duration ---
{
  console.log('\n15. Normal app threshold (30 nulls) logs with correct duration')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 120_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 1, 'AppA logged at 30-null threshold')
  assertEquals(st.logs[0].app, 'AppA', 'Logged app = AppA')
  assertEquals(st.logs[0].duration, 60_000, 'Duration = 60s')
  assertEquals(st.currentApp, null, 'currentApp cleared after logging')
  assertEquals(st.consecutiveNullPolls, 0, 'Counter reset after threshold')
}

// --- Test 16: Browser at 30-59 polls: early-return, no state mutation ---
{
  console.log('\n16. Browser at 30-59 polls: early-return, counter accumulates')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'ChromeBrowser'
  st.sessionStart = clock.now() - 120_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 0, 'Browser at 30: no log (no browser logging threshold yet)')
  assertEquals(st.currentApp, 'ChromeBrowser', 'Browser currentApp preserved')
  assertEquals(st.consecutiveNullPolls, 30, 'Counter at 30 (accumulating)')
  // Browser below threshold: sessionStart = now each poll, lastSuccessful unchanged.
  // After 30 polls starting at now=1000000: sessionStart = 1029000 (last poll's now).
  assertEquals(st.sessionStart, 1_029_000, 'sessionStart = now (1029000) after 30 polls')
  assertEquals(st.lastSuccessfulObservationTime, 940_000,
    'lastSuccessful unchanged (940000)')
}

// --- Test 17: Browser at 60+ polls: browser-specific logging fires ---
{
  console.log('\n17. Browser at 60+ polls: browser-specific logging fires')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'ChromeBrowser'
  st.sessionStart = clock.now() - 120_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  // 30 polls: counter at 30, no log yet, state unchanged
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 0, '30 polls: no log')
  assertEquals(st.consecutiveNullPolls, 30, 'Counter at 30')
  assertEquals(st.currentApp, 'ChromeBrowser', 'currentApp preserved')
  // 30 more polls: counter reaches 60 → browser logging fires, everything resets
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 1, '60 polls: browser-specific logging fires')
  assertEquals(st.currentApp, null, 'Browser session cleared after logging')
  assertEquals(st.consecutiveNullPolls, 0, 'Counter reset after browser logging')
}

// --- Test 18: Threshold reached but knownDuration <= 5000 ---
{
  console.log('\n18. Threshold reached but knownDuration <= 5000: no log, counter reset')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 60_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  for (let i = 0; i < 30; i++) {
    tick(st, clock, poll({ result: null, resolved: null }))
    clock.advance(1000)
  }
  assertEquals(st.logs.length, 0, 'No log (insufficient observed duration)')
  assertEquals(st.consecutiveNullPolls, 0, 'Counter reset after threshold')
  // After 30 polls at 1s each starting from now=1000000: now=1030000
  assertEquals(st.sessionStart, 1_030_000, 'sessionStart updated to now (1030000)')
  assertEquals(st.lastSuccessfulObservationTime, 1_030_000, 'lastSuccessful updated to now (1030000)')
}

// --- Test 19: Valid observation resets counter ---
{
  console.log('\n19. Valid observation resets counter and updates lastSuccessful')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 60_000
  st.lastSuccessfulObservationTime = clock.now() - 60_000
  st.consecutiveNullPolls = 15
  tick(st, clock, poll({
    result: { title: 'AppA' }, resolved: { name: 'AppA', source: 'raw' },
  }))
  assertEquals(st.consecutiveNullPolls, 0, 'Counter reset on valid observation')
  assertEquals(st.lastSuccessfulObservationTime, clock.now(), 'lastSuccessful updated to now')
  assertEquals(st.logs.length, 0, 'No log (same app, no change)')
}

// --- Test 20: App change logs previous session ---
{
  console.log('\n20. App change logs previous session using lastSuccessfulObservationTime')
  const clock = createFakeClock(1_000_000)
  const st = freshState(clock.now())
  st.currentApp = 'AppA'
  st.sessionStart = clock.now() - 120_000
  st.lastSuccessfulObservationTime = clock.now() - 30_000
  tick(st, clock, poll({
    result: { title: 'AppB' }, resolved: { name: 'AppB', source: 'raw' },
  }))
  assertEquals(st.logs.length, 1, 'AppA logged on app change')
  assertEquals(st.logs[0].app, 'AppA', 'Logged app = AppA')
  // rawDuration = lastSuccessful - sessionStart = 970000 - 880000 = 90000
  assertEquals(st.logs[0].duration, 90_000, 'Duration = 90s (lastSuccessful - sessionStart)')
  assertEquals(st.currentApp, 'AppB', 'Current app is now AppB')
}

// --- Summary ---
console.log('\n=== SUMMARY ===')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
console.log(`Total:  ${passed + failed}`)
if (failed > 0) {
  process.exit(1)
}

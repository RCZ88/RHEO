# PROMPT.md — Desktop focus → phone link

## Raw Request (user's exact words, verbatim — do not reinterpret)

> "create a prompt instruction for my ai coding agent workingo nthe windows n linux side of hte app (dekstop app)"

Feature context (user's exact words defining what the desktop side must do):

> "i would like you to have hte new feature of adding like the focus feature aswell that is connected to ur phone. like in hte deskstop app we have the focus feature where we can like stay away form some aplpicaiton right? and like i would ilke to apply that onto like the fucking apps selecitngh the app in which is allowed and such and even like blockgn the usageo f hte phone whne the super focus mode on the laptop is acive and usch like thta. maybe mostly hsould be most of thapps and not the entire shit."

Plain reading: when strict ("super") focus runs on the laptop, the paired
Android phone shields the user's blocked apps; breaking/returning on the phone
is reflected on the desktop session. Phone + server are done. You wire the
desktop halves.

## Context (read first, in order)

1. `CONTEXT_BUNDLE.md` (same folder) — the ONLY codebase reference you need.
   Every path/line number below refers to it. Trust it over your assumptions;
   verify each line number against the files before editing.
2. `agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/MULTI_AGENT_PROTOCOL.md`
   — you are not the only agent in this repo. Follow it.

## Mandate

Act as the **Lead Engineer** owning this integration end-to-end: data flow,
failure modes, and verification. One comprehensive solution, no option menus.

## Task A — Publish the live session (desktop → server → phone)

1. Add a fire-and-forget `publishFocusState()` helper in main-process scope
   (near the sync wiring, `src/main.ts` ~4436-4512). It POSTs to
   `${syncUrl}/v1/focus/publish` with `authorization: *** ${await
   getSyncTokenForRelay()}` and `content-type: application/json`. Body is built
   from `focusManager.getPublicState()`:
   `{ active: true, sessionId: String(state.id), strictness: state.strictness,
   allowedApps: <parsed allowed_json>.apps, allowedDomains: <parsed
   allowed_json>.domains, startedAt: <iso from state.startedAt>,
   endsAt: <iso or null> }`.
2. Call it after every session start: both `focusGroup:startWith` and
   `focusGroup:startWithMany` handlers (they already hold `state` + `sessionId`),
   AND plain `focus:start` sessions (that IPC lives inside FocusManager —
   preferred hook: `setCompositionEmitter()` subscription on
   `focus.session.started`, which also covers future entry points).
3. Call `publishFocusState({ active: false })` on EVERY end: subscribe to
   `focus.session.ended` + `focus.session.broken` via the same emitter.
4. Rules: skip silently when there is no token (`getSyncTokenForRelay()` returns
   `""` = unpaired — do not log errors, do not retry). Wrap everything in
   try/catch — a failed publish must NEVER break, delay, or alter a focus
   session. Log `[focus-phone] publish <active> <sessionId>` on success only.

## Task B — Consume phone events (phone → desktop session)

1. Extend `src/main/syncAgent.ts` `pull()`: after the existing merge
   transaction, read `changes.deep_focus_events ?? []`. For each row, parse
   `value_json` and keep only events where `origin === "phone"`.
2. In main-process scope add `handlePhoneFocusEvent(ev)`: if
   `focusManager.getActiveSessionId()` is non-null AND
   `String(liveId) === String(ev.session_id)` → `kind === "broke"` calls
   `focusManager.breakFocus('app', ev.target_name ?? 'phone')`;
   `kind === "returned"` calls `focusManager.returnToFocus()`. Anything else
   (dead session, id mismatch, malformed row) is ignored with a
   `[focus-phone] event ignored <reason>` log.
3. Dedupe: pull repeats rows until the cursor advances — track handled event
   uuids in a module-level `Set` (cap ~500 entries, FIFO evict).
4. Do NOT create a `phone_kv` table, do NOT merge phone sessions into
   `deep_focus_sessions` — events only. Do NOT touch the existing 4-table merge.

## Constraints (hard)

- Surgical edits to `src/main.ts` + `src/main/syncAgent.ts` only. No new
  dependencies. No renderer/preload changes. No schema changes (desktop DB
  already has every table; server schema is final).
- `setCompositionEmitter()` currently has NO subscriber — your Task A wiring is
  its first consumer; do not break the Composition engine's future use of it.
- Strictness semantics (§7 of the bundle) are locked — do not reinterpret,
  do not add strictness/goals to the group editor.
- CRLF preserved. No `git add -A`, no force-push, no destructive git.
- Coordination protocol (§8): register/claim (use the library-import
  workaround), release with `done` at the end.

## Edge cases to handle explicitly

- Unpaired desktop (empty token) → publish skipped, zero logs spam.
- Server unreachable → caught, session unaffected.
- Stopwatch sessions (`endsAt: null`) → publish `endsAt: null`.
- Restart-abort (`start()` while active ends the old session first) → the end
  path publishes `{active:false}` then start publishes the new session; order
  must be end-then-start.
- Phone event arrives after desktop session already ended → ignored.
- `focus:end` with no live session → no publish (guard on `active`).

## Output format

1. Implement Task A, then Task B. After each: `node scripts/build.mjs` must
   exit 0 (allow ~5-6min), plus the repo's usual `tsc` check with zero NEW errors.
2. Prove the wiring without a phone: with the app running, start a strict group
   session and show `[focus-phone] publish true <id>` in the main console;
   end it and show `[focus-phone] publish false`. Simulate an inbound event by
   inserting a `deep_focus_events` row server-side (or via the endpoint with a
   test token) and show the desktop overlay/break firing for `broke`, and
   `return_count` incrementing for `returned`.
3. End with the repo's cycle report (`CYCLE / BUILD / GATE / FEATURE / STEPS /
   EXPECTED / ACTUAL / RENDERER CONSOLE / MAIN CONSOLE / VERDICT / ARTIFACTS`).
   If any gate fails, report FAIL with the exact log line — never PASS on
   build-OK alone.

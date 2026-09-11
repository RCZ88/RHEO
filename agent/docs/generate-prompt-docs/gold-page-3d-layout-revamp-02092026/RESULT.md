Fair hit — they're both in the debt ledger (§3: "VCalendar is FAKE… replace w/ real date picker" + "MonthWall… LAMINAR conformance pass"), and I'd only spec'd the two frontier tasks. Debt wave specs now exist too. Both paste-ready, both derived strictly from LAMINAR + governance. Queue position per handoff: after M-1 → IA-1 — runnable earlier only on your explicit order (MonthWall's color/font work can collide with M-1; flagging, not deciding).

## ③ VCAL-REPLACE — paste-ready

```
TASK VCAL-REPLACE (debt ledger) — kill the fake, mount a real date picker
Load Skill Router → BUILD. App side. Read design/design.md (LAMINAR) first.

CONTEXT: VCalendar is a fake — a <select> with one option. Ledger law: not
silently fixed, not silently ignored. Replacement is a FEATURE build (§2
blocks fake repairs, not real builds).

STEP 0 — DISCOVERY (blocking):
grep 'VCalendar' across src/. Output a table: every usage (file:line, props,
bound state, what the date is FOR — deadline/schedule/log-date). Two branches:
- Usages exist → proceed to STEP 1.
- Zero usages → the fake is dead code. STOP, report, propose deletion.
  User rules replace-vs-delete. Never both silently.

STEP 1 — DECISION TABLE (present to user, wait for go before dep install):
  A. Native <input type="date"> styled to LAMINAR — zero deps, but OS popup
     is outside our chrome law (unstylable on Windows).
  B. Small picker lib restyled to LAMINAR — full chrome control, one dep.
  ORCHESTRATOR DEFAULT: B, IF a React 19-compatible candidate passes peer-dep
  check (verify against React 19 explicitly — report the version pinned).
  User confirms in table before any install.

STEP 2 — BUILD (LAMINAR law, all of it):
- Binds to the EXISTING state from STEP 0 — no new store, no prop reshaping
  beyond the mounting surface.
- Chrome: hairline borders (1px) — popover separated by border + solid bg,
  NOT box-shadow; radii 6 (day cells) / 10 (popover); no color literals —
  monochrome chrome, any data color via src/lib/CategoryColors.ts only;
  numerals tabular-nums in the font role design.md assigns; ONE easing,
  reactive transitions 140ms.
- Keyboard: field focusable, Enter/Esc open/close, arrows move, Enter select,
  focus returns to field on close. ARIA labels on the grid.
- No infinite animations anywhere in the component. Reduced-motion honored
  via the app's motion-preference system (Month transitions snap under
  prefers-reduced-motion).
- The fake and its name die: VCalendar file deleted, all imports migrated.
  New name is honest (DatePicker/RheoDatePicker).

GATES (PASS/FAIL verbatim, full fidelity — §6):
1. STEP 0 table complete; branch ruled by user.
2. tsc: zero errors outside sanctioned set (RAGService 39, pre-existing
   test/main.ts — docs/debt.md). Report total + delta.
3. grep 'VCalendar' = zero hits repo-wide.
4. Clean rebuild: delete dist/ FIRST (start-dev -Build forces nothing),
   rebuild, artifact = dist/ the launcher serves — never dist-tmp/.
5. Shell-launch (_electron.launch, never CDP :9222; kill stale first,
   EADDRINUSE :8788 = stale relay): open hosting surface → click field →
   popover bbox > 0 → select a date → field + dependent surface reflect it;
   keyboard path does the same; emulateMedia reduce → transitions snap;
   screenshots closed/open/selected → evidence/.
6. docs/debt.md: VCalendar entry closed with commit hash IN the commit.
7. Commit exactly: "feat: replace fake VCalendar with real date picker".

REPORT: discovery table, decision table + ruling, per-gate verdicts,
screenshot paths, commit hash.
```

## ④ MONTHWALL-LAMINAR — paste-ready

```
TASK MONTHWALL-LAMINAR (debt ledger) — conformance pass, no rebuild
Load Skill Router → DESIGN. App side. Read design/design.md (LAMINAR) first.
This is a REPAIR of an existing component → §2 applies: fix in place, invent
NOTHING new. Target: src/components/MonthWall, mounted at
features/warmth/gold/GoldPage.tsx.

STEP 0 — VIOLATION INVENTORY (blocking, full-fidelity table, file:line each):
Audit against LAMINAR: (a) onWheel handlers / scroll-hijack — BANNED;
(b) non-flat default state (perspective/rotate/tilt at rest); (c) color
literals not via src/lib/CategoryColors.ts; (d) shadows instead of hairlines;
(e) radii outside {6,10,16}; (f) easings/durations ≠ the single LAMINAR
easing, 140ms reactive; (g) infinite animations (CSS infinite keyframes,
setInterval, rAF in the component); (h) fonts outside the 3 sanctioned
families/roles; (i) reduced-motion unhandled.
Report the table BEFORE fixing. No silent fixes — this table IS the receipt.

STEP 1 — FIX IN PLACE (only rows from the table):
- Wheel-hijack: delete onWheel interception entirely. Month navigation =
  chevron buttons + keyboard (PageUp/PageDown, arrows). Native page scroll
  untouched.
- Flat default: remove any rest-state transform/perspective. The grid sits
  flat.
- Phase colors ONLY: every color flows through CategoryColors.ts lookups —
  no new hex/rgb/hsl strings in the component (grep-enforced).
- Hairlines not shadows; radii clamp to {6,10,16}; single easing; reactive
  transitions 140ms; zero infinite animations (Meridian's state-gated LIVE
  dot is the app's ONLY sanctioned one — MonthWall gets none). "Today" or
  shimmer effects become static emphasis.
- Reduced motion: month transition snaps under prefers-reduced-motion.
- Day numerals tabular-nums, correct font role.
- DO NOT: rename routes, restructure GoldPage, touch anything outside
  MonthWall's scope from the table. Route hygiene is IA-1's job.

GATES (PASS/FAIL verbatim, full fidelity):
1. STEP 0 table present, every row has a disposition.
2. grep gates on MonthWall files: zero color literals; zero onWheel with
   preventDefault; zero infinite animation sources (keyframes infinite /
   setInterval / rAF).
3. tsc: zero errors outside sanctioned set (total + delta).
4. Clean rebuild (delete dist/ first), artifact = dist/ the launcher serves.
5. Shell-launch: navigate to the Gold route → MonthWall bbox > 0 (FIX-APP-8
   regression guard: content pane alive, row wrapper intact); chevron click
   changes month (assert header); wheel scroll scrolls the PAGE, not the
   calendar; emulateMedia reduce → transition snaps; screenshots: default
   flat state, month N, month N+1 → evidence/.
6. docs/debt.md: MonthWall entry closed with commit hash IN the commit.
7. Commit exactly: "refactor: MonthWall LAMINAR conformance".

REPORT: violation table (before→after), per-gate verdicts, screenshot paths,
commit hash.
```

## Status — this session, verbatim

```
VCAL-REPLACE gates      STAGED — executor: Hermes. Discovery + decision table hit YOUR desk before any dep lands.
MONTHWALL-LAMINAR gates STAGED — executor: Hermes. Violation table hits YOUR desk before any fix.
Execution                NOT EXECUTED — no shell/repo here; specs only, per §3 honesty.
```

**Your three moves:** 1) order the debt wave now or keep M-1 → IA-1 first (collision risk noted above); 2) paste whichever spec you green-light to Hermes; 3) rule only on its two tables (discovery/decision for VCAL, violations for MonthWall) and the `evidence/` screenshots — not the prose.
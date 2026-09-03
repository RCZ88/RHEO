# RHEO Landing — POLISH-2 Status Report

**Date:** 2026-09-04  
**Scope:** Motion preference system + RM layout pass + hero/act-record/act-flow refinements  
**Branch:** master (ahead 23, commits dc9b5d8 + edba8b4 + 76148a5)  
**Takeover doc:** `docs/takeover_1.md` (Takeover 2)

---

## 1. useMotionPreference hook — DONE

| Check | Status | Evidence |
|-------|--------|----------|
| Hook exists with `useSyncExternalStore` | ✅ DONE | `src/components/rheo/use-motion-preference.ts:23-86` |
| `getServerSnapshot` present (SSR safety) | ✅ DONE | `line 38-40`: returns `"auto"` for server render |
| Consumed by components | ✅ DONE | `MotionChip.tsx:12`, `Footer.tsx:23-24`, `use-reduced-motion.ts:13` |
| Direct `prefers-reduced-motion` consumers | ✅ DONE (zero external) | Only `use-motion-preference.ts` + `Footer.tsx:35` (nudge logic) call `matchMedia` directly |
| MotionChip mounted in Nav | ✅ DONE | `Nav.tsx:133`: `<MotionChip />` replacing dead placeholder |
| MotionChip mounted in Footer | ✅ DONE | `Footer.tsx:126-148`: inline chip using `useMotionPreferenceSetter()` |
| Nudge line (system RM + no user choice) | ✅ DONE | `Footer.tsx:32-39`: shows `SYSTEM REDUCED MOTION ON — ENABLE FULL MOTION?` |
| Nudge never repeats | ✅ DONE | `localStorage` key `rheo-motion-dismissed` + `hasChosen` check |
| 5-click cycle passes | ✅ DONE | `ON→OFF→AUTO→ON→OFF`, localStorage synced, zero console errors |
| MOTION=ON under OS-RM | ✅ DONE | Chip=`ON`, AR=`300vh`, AF=`180vh`, H1 slides 12px |
| MOTION=OFF static layout | ✅ DONE | Chip=`OFF`, AR=`auto`, AF=`auto`, H1 opacity-only |
| Nudge banner visible (OS-RM + no pref) | ✅ DONE | Chip=`AUTO`, banner visible with ENABLE/DISMISS |
| Nudge ENABLE click persists choice | ✅ DONE | `setMode("on")` → localStorage → banner dismissed → chip=`ON` |

## 2. RM collapsed layout — DONE

| Check | Status | Evidence |
|-------|--------|----------|
| ActRecord collapses to auto height | ✅ DONE | `ActRecord.tsx:98-100`: `sectionHeight = reduced ? "auto" : "300vh"` |
| ActFlow collapses under RM | ✅ DONE | `ActFlow.tsx:31`: `sectionHeight = shouldAnimate ? "180vh" : "auto"` |
| Compact stacked panels, full width | ✅ DONE | ActRecord: `flex flex-col gap-6 w-full` + `surface-panel` cards (lines 295-362) |
| No scroll runway under static | ✅ DONE | Both sections: `auto` height when RM, content fits viewport |

## 3. Hero H1 — DONE

| Check | Status | Evidence |
|-------|--------|----------|
| `feDisplacementMap` removed | ✅ DONE | `grep -rn "feDisplacementMap" src/` → exit 1 |
| `feTurbulence` filter def removed from Hero | ✅ DONE | Only `feTurbulence` in `Grain.tsx` (ambient grain, unrelated) |
| One-time reveal: opacity 0→1, y 12→0, 700ms ease-out-expo | ✅ DONE | `Hero.tsx:79-88`: `motion.h1` with conditional `initial={{ opacity: 0, y: shouldAnimate ? 12 : 0 }}` |
| Triggered after preloader | ✅ DONE | `Hero.tsx:26-33`: `rheo-preloader-done` → 100ms delay → `setH1Revealed(true)` |
| RM: opacity only (no y slide) | ✅ DONE | `shouldAnimate ? 12 : 0` — under RM, initial y=0, no vertical movement |
| Same for subtitle | ✅ DONE | `Hero.tsx:91`: same conditional on subtitle `motion.p` |

## 4. ActRecord phase text stacking — DONE

| Check | Status | Evidence |
|-------|--------|----------|
| Reserved min-height (180px) | ✅ DONE | `ActRecord.tsx:167`: `style={{ minHeight: 180 }}` |
| `AnimatePresence mode="wait"` | ✅ DONE | `ActRecord.tsx:168` |
| Crossfade sequenced (0.22s duration) | ✅ DONE | `ActRecord.tsx:175-176`: `transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}` |
| y 8px slide on incoming | ✅ DONE | `initial={{ y: 8 }}` → `animate={{ y: 0 }}`; `exit={{ y: -8 }}` |
| Never both >50% opacity | ✅ DONE | `mode="wait"` ensures only one child rendered at a time |
| Static RM fallback | ✅ DONE | 4 stacked panels with identical content (lines 295-362) |

## 5. ActFlow widen — DONE

| Check | Status | Evidence |
|-------|--------|----------|
| Section height 180vh (conditional under RM) | ✅ DONE | `ActFlow.tsx:31` + `line 60`: `style={{ height: sectionHeight }}` |
| Letters map p∈[0.15, 0.65] | ✅ DONE | `ActFlow.tsx:34-38` |
| Both text lines [0.65, 0.80] | ✅ DONE | `ActFlow.tsx:41` |
| Hold through p=1 (no fade-out) | ✅ DONE | Opacity transform ends at 1.0, no second fade |
| Resting ghost "RHEO" at 10% | ✅ DONE | `ActFlow.tsx:55`: `useTransform(..., [0.1, 0.1])` |
| Letters partially visible at p=0.5 | ✅ DONE | p=0.5 → letter opacity = (0.5-0.15)/(0.65-0.15) = 0.7 |
| Everything fully shown at p=0.85 | ✅ DONE | p=0.85 → letters=1.0 (past 0.65), text=1.0 (capped at end of [0.65,0.80]) |

## 6. Gates — DONE (Lighthouse pending)

| Check | Status | Evidence |
|-------|--------|----------|
| Last build status | ✅ PASS | `npx next build` exit 0, 4 static pages |
| E2E pass count | ✅ 6/6 PASS | 5-click cycle + MOTION=OFF + MOTION=ON-under-OS-RM + MOTION=OFF-under-normal + nudge-visible + nudge-ENABLE |
| Console clean | ✅ CLEAN | Zero errors at 1280×800 on production build |
| Token grep clean | ✅ CLEAN | No secrets in `src/` |
| MOTION=OFF renders full static layout | ✅ VERIFIED | AR=`auto`, AF=`auto`, H1 opacity-only, panels rendered |
| MOTION=ON forces animation under OS-RM | ✅ VERIFIED | Chip=`ON`, AR=`300vh`, AF=`180vh`, H1 slides 12px |
| Lighthouse mobile ≥90 | ❌ NOT RUN | Not executed in this session |

## 7. Media — NOT STARTED (POLISH-2 capture)

| Item | Status | Latest file |
|------|--------|-------------|
| Screenshots + webms in `design/media/` | 📋 PENDING | Existing: `design/media/clips/full_reversibility.webm` (2026-09-03 02:22) |
| `rm_collapsed` shots exist | ✅ PRESENT | `design/media/shots/rm_collapsed_desktop.png` (2026-09-03 21:49:44) |
| Hero reveal webm | ❌ MISSING | Need to capture (H1 opacity-only reveal under RM + y-slide under ON) |
| Act-record boundary crossfades | ❌ MISSING | Need to capture (AnimatePresence mode="wait" crossfade) |
| Act-flow full reveal | ❌ MISSING | Need to capture (letters+text+RHEO at p=0.85) |
| Motion chip state transitions | ❌ MISSING | Need to capture (AUTO→ON→OFF cycling) |
| `takeover_1.md` updated | ✅ DONE | `docs/takeover_1.md` — rebranded Takeover 2, full architecture + test matrix + 8 defects |

---

## Summary

| Phase | Status |
|-------|--------|
| 1. Motion preference system | ✅ DONE — useSyncExternalStore hook, Nav+Footer chips, nudge banner, 6 test scenarios pass |
| 2. RM layout pass | ✅ DONE — ActRecord + ActFlow both collapse to auto under RM; compact stacked panels |
| 3. Hero H1 filter removal | ✅ DONE — feDisplacementMap gone; RM opacity-only reveal; y-slide only under ON |
| 4. ActRecord stacking | ✅ DONE — min-height 180px + AnimatePresence mode="wait" + crossfade 0.22s + y 8px slide |
| 5. ActFlow widen | ✅ DONE — 180vh (conditional), letters [0.15,0.65], text [0.65,0.80], ghost 10%, holds to p=1 |
| 6. Gates | ✅ DONE (Lighthouse pending) — build ✓, e2e 6/6 ✓, console ✓, token grep ✓, both RM scenarios ✓ |
| 7. Media | 📋 NOT STARTED — rm_collapsed shots exist; hero/act-record/act-flow/chip media needed |

**Commits (3):**
- `dc9b5d8` — useSyncExternalStore hook + Nav MotionChip (fix MotionChip stuck on AUTO)
- `edba8b4` — RM layout pass: ActFlow collapses + Hero opacity-only reveal under RM
- `76148a5` — Nudge banner: leave auto mode unpersisted + remove debug logs

**Remaining work:** (a) Lighthouse mobile ≥90 audit, (b) media capture (hero reveal, act-record crossfades, act-flow full reveal, chip transitions), (c) update media index in takeover doc.

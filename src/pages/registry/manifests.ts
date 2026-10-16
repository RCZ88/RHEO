/**
 * manifests.ts — the page list, and nothing else.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SEPARATE FILE
 *
 * `index.ts` re-exports `registry.ts`, and `registry.ts` needs `PAGE_MANIFESTS`.
 * So the obvious shape — `registry.ts` importing the list back out of `index.ts` —
 * is a CIRCULAR DEPENDENCY. The list is then `undefined` when the barrel's
 * module-level `flatMap` runs, and the app white-screens at import time.
 *
 * This repo has already been bitten by exactly this: `Sidebar.tsx` imported
 * `useSidebarConfig`, which imported `SIDEBAR_ITEMS` back from `../Sidebar`, so
 * the store's module-level `load()` read a `const` that was still initialising →
 * `ReferenceError: Cannot access 'SIDEBAR_ITEMS' before initialization`. Vite
 * only prints a CIRCULAR DEPENDENCY warning; esbuild and `tsc` are both happy.
 *
 * So: the DATA lives here (leaf module, imports only `./pages/*`), the LOGIC
 * lives in `registry.ts`, and `index.ts` is a pure barrel over both. No cycles.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { PageManifest } from './types'

import dashboard from './pages/dashboard'
import activity from './pages/activity'
import { rankings, external } from './pages/tracking'
import ide from './pages/ide'
import terminal from './pages/terminal'
import ai from './pages/ai'
import life from './pages/life'
import { learn, lecture } from './pages/learn'
import { studio, labs } from './pages/studio'
import { goals, gold } from './pages/goals'
import { finance, resume } from './pages/finance'
import reports from './pages/reports'
import database from './pages/database'
import transcripts from './pages/transcripts'
import profiler from './pages/profiler'
import { settings, guide } from './pages/settings'
import {
  penguinConsole, simpleTerminal, ideHelp, focusRetired,
  conductorStub, pricingStub, titlebarSettings,
} from './pages/misc'

/**
 * Every page in DeskFlow.
 *
 * Order only affects grouping in the palette (entries group by `group`, then by
 * manifest order within a group), so keep it roughly sidebar-alphabetical.
 *
 * ── AGENTS.md §5d: a new page or sub-page MUST be added to this list. ──
 */
export const PAGE_MANIFESTS: PageManifest[] = [
  dashboard,
  activity,
  rankings,
  ide,
  terminal,
  ai,
  life,
  learn,
  lecture,
  studio,
  labs,
  goals,
  gold,
  finance,
  resume,
  external,
  reports,
  database,
  settings,
  guide,
  penguinConsole,
  simpleTerminal,
  ideHelp,
  profiler,

  // Placeholder routes that render an inline stub rather than a page.
  // Hidden from the palette, but owned so the validator sees every URL.
  conductorStub,
  pricingStub,

  // A command row, not a page — see pages/misc.ts.
  titlebarSettings,

  // Deliberately not routed: `FocusPage.tsx` exists and is imported at
  // App.tsx:40 but never mounted, so `/focus` hit the `*` catch-all. Four
  // registry keys and three palette rows used to send users to that 404.
  // Its aliases now resolve to Activity → Focus, which really exists.
  focusRetired,

  // The saved-dictation library behind the LB-04 Transcripts lab. Registered so
  // the card's `route` resolves and ⌘K / Ctrl+F can find it.
  transcripts,
]
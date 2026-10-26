import type { PageManifest } from '../types'

/**
 * /time-tools — the full-page view of the time controls (Labs `LB-06`).
 *
 * WHY THIS PAGE EXISTS
 * --------------------
 * The stopwatch / countdown timer / alarms were only reachable from the top bar's clock
 * dropdown, which is a 3-tab popover a few hundred pixels wide. That is the right surface for
 * "start a 10 minute timer", and the wrong one for reading a list of six alarms or watching a
 * stopwatch run while you work. The dropdown and this page render the SAME store
 * (`lib/timeStore.ts` via `components/TimePanel.tsx`), so nothing is duplicated — this is the
 * same controls with room to breathe, and a change in either place appears in the other
 * immediately.
 *
 * `group: 'Labs'` rather than `'Navigation'`: this page is the destination of the `LB-06`
 * "Time Tools" card in the Labs hub, and `lecture` already established `Labs` as the group for
 * a hub-declared surface that is not part of the app's own nav rail.
 *
 * THE ACCENT IS CYAN ON PURPOSE. `index.css` declares `[data-page="time-tools"]`, so the page
 * gets its signal hue from a token like every other page rather than inheriting the default
 * accent. Cyan is what the `LB-06` card itself carries in `labRegistry.ts`, so walking from the
 * card into the page does not cross hues.
 *
 * NO `tabs` BLOCK, and therefore no `stateKey`/`storageKey`: the page is one screen with two
 * cards. `validate:pages` requires a deep-link path only for a page that has tabs, and inventing
 * a tab model here to satisfy a rule that does not apply would be the drift §5d exists to stop.
 */
const timeTools: PageManifest = {
  id: 'time-tools',
  route: '/time-tools',
  label: 'Time Tools',
  icon: 'Timer',
  group: 'Labs',
  keywords: [
    'time tools',
    'time',
    'stopwatch',
    'timer',
    'countdown',
    'alarm',
    'clock',
    'pomodoro',
    'focus timer',
    'lap',
  ],
  hint: 'Stopwatch, countdown timer and alarms, shared with the top-bar clock',

  /* Every id below MUST have a matching `data-section` in `pages/TimeToolsPage.tsx`. The
     validator fails the build on a declared-but-unrendered anchor, and `usePageSurface` warns
     in dev — that pairing is the whole point of declaring them here rather than hand-writing
     palette rows. */
  sections: [
    {
      id: 'time-tools.panel',
      label: 'Time Tools — Live Controls',
      icon: 'Timer',
      keywords: ['stopwatch', 'timer', 'alarms', 'running', 'live', 'elapsed'],
      hint: 'Start, pause and reset every timer in one place',
    },
    {
      id: 'time-tools.quick',
      label: 'Time Tools — Quick Actions',
      icon: 'Zap',
      keywords: ['quick', 'actions', 'how', 'ai', 'assistant', 'help'],
      hint: 'The other two ways to start a timer, without opening this page',
    },
  ],
}

export default timeTools

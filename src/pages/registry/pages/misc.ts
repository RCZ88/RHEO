import type { PageManifest } from '../types'

/**
 * /penguin-console — the standalone multi-pane terminal app.
 *
 * **Completely absent from the old palette.** It is a real route
 * (`App.tsx:3328`) with ten right-panel tabs, and `notes` is reachable in code
 * (`Panels.tsx:823`) but has no button in the tab array — so it could only ever
 * be opened programmatically. Declared here, it is finally navigable.
 */
const penguinConsole: PageManifest = {
  id: 'penguin-console',
  route: '/penguin-console',
  label: 'Penguin Console',
  icon: 'Terminal',
  group: 'Navigation',
  keywords: ['penguin', 'console', 'terminal', 'inspector', 'panes', 'handbook'],
  hint: 'The standalone multi-pane console with its inspector',

  tabs: {
    variable: 'rightTab',
    stateKey: 'tab',
    storageKey: 'penguin-rightTab',
    default: 'inspect',
    items: [
      { id: 'inspect', label: 'Inspect', icon: 'Search', keywords: ['inspect', 'inspector', 'elements'] },
      { id: 'layout', label: 'Layout', icon: 'LayoutGrid', keywords: ['layout', 'panes', 'arrangement'] },
      { id: 'commands', label: 'Commands', icon: 'Terminal', keywords: ['commands', 'cmds', 'run'] },
      { id: 'history', label: 'History', icon: 'History', keywords: ['history', 'past', 'log'] },
      { id: 'stats', label: 'Stats', icon: 'ChartLine', keywords: ['stats', 'metrics'] },
      { id: 'keys', label: 'Keys', icon: 'Keyboard', keywords: ['keys', 'keybindings', 'shortcuts'] },
      { id: 'mcp', label: 'MCP', icon: 'Blocks', keywords: ['mcp', 'servers', 'tools'] },
      { id: 'theme', label: 'Theme', icon: 'Palette', keywords: ['theme', 'colors', 'appearance'] },
      { id: 'sys', label: 'System', icon: 'Server', keywords: ['system', 'processes', 'resources'] },
      { id: 'handbook', label: 'Handbook', icon: 'BookOpen', keywords: ['handbook', 'commands', 'reference'] },
      { id: 'notes', label: 'Notes', icon: 'NotebookPen', keywords: ['notes', 'notes panel', 'command notes'] },
    ],
  },
}

/** /simple-terminal — the stripped-back terminal. */
const simpleTerminal: PageManifest = {
  id: 'simple-terminal',
  route: '/simple-terminal',
  label: 'Simple Terminal',
  icon: 'Terminal',
  group: 'Navigation',
  keywords: ['simple', 'terminal', 'minimal', 'plain'],
}

/** /ide-help — the IDE help page. */
const ideHelp: PageManifest = {
  id: 'ide-help',
  route: '/ide-help',
  label: 'IDE Help',
  icon: 'Circle',
  group: 'Navigation',
  keywords: ['ide', 'help', 'support', 'docs', 'guide'],
}

/**
 * /focus — REMOVED.
 *
 * `FocusPage.tsx` exists, is imported at `App.tsx:40`, and is never routed. The
 * old palette and `SMART_SEARCH_PAGES` both sent users to `/focus`, which hit
 * the `*` catch-all and rendered `NotFoundPage`. Three palette entries and four
 * registry keys were pointing at a 404.
 *
 * The focus surface genuinely exists, at Activity → Focus. So `focus` is now an
 * ALIAS of the activity page and ⌘K "Focus → Goals" resolves to a real screen.
 * If someone re-routes `FocusPage` later, promote this to a real manifest.
 */
const focusRetired: PageManifest = {
  id: 'focus',
  route: '/activity',
  tab: 'focus',
  label: 'Focus Sessions',
  icon: 'Timer',
  group: 'Navigation',
  keywords: ['focus', 'pomodoro', 'sessions', 'deep work', 'concentration', 'goals'],
  hidden: true, // reachable via its own aliases below, not as a duplicate page row
  aliases: ['focus-goals', 'focus-stats', 'focus-history'],
}

/**
 * /conductor — a PLACEHOLDER route. `App.tsx:3321` renders
 * `<div>Conductor is now in the workspace sidebar</div>`.
 *
 * Kept out of the palette (`hidden`) but given a manifest so the route is
 * covered and, if anything ever links here, it resolves to the real Conductor
 * group in the Terminal Workspace rather than looking like an orphan.
 */
const conductorStub: PageManifest = {
  id: 'conductor-stub',
  route: '/conductor',
  label: 'Conductor (moved)',
  icon: 'Network',
  group: 'Navigation',
  hidden: true,
  keywords: ['conductor'],
  hint: 'Moved to Terminal → Conductor',
  navState: { group: 'conductor' },
}

/**
 * /pricing — a PLACEHOLDER route rendering "Not Yet Added Feature".
 * Hidden from the palette; a manifest exists so the validator does not flag a
 * routable URL with no owner.
 */
const pricingStub: PageManifest = {
  id: 'pricing-stub',
  route: '/pricing',
  label: 'Pricing (not built)',
  icon: 'Coins',
  group: 'Navigation',
  hidden: true,
  keywords: ['pricing', 'plans', 'subscription'],
  hint: 'Not yet added',
}

/**
 * A COMMAND, not a destination.
 *
 * `titlebar-settings` opens a settings sheet inside the title bar. It has no
 * route, it is not a page, and it is not in the sidebar — but it was reachable
 * from ⌘K and should stay reachable. Declaring it as a manifest with `event`
 * (rather than a route) keeps it in the palette while making clear to the
 * validator that this row does not correspond to a routable URL.
 */
const titlebarSettings: PageManifest = {
  id: 'titlebar-settings',
  route: '',
  label: 'Title bar settings',
  icon: 'Monitor',
  group: 'Appearance',
  event: 'open-titlebar-settings',
  keywords: ['title bar', 'titlebar', 'hide', 'auto-hide', 'window title', 'frame', 'appearance'],
}

export {
  penguinConsole,
  simpleTerminal,
  ideHelp,
  focusRetired,
  conductorStub,
  pricingStub,
  titlebarSettings,
}
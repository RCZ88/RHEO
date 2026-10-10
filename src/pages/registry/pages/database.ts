import type { PageManifest } from '../types'

/**
 * /database — Browse, Architecture, Recent Changes.
 *
 * `DatabasePage.tsx` had **zero** `data-section` attributes and read neither
 * `location.state.tab` nor any storage hint, yet the palette pointed three
 * entries at `database.browse` / `.architecture` / `.changes`. All three were
 * guaranteed no-ops: navigate, then retry `scrollToSection` eight times over
 * 1.6s, then give up silently.
 *
 * Both halves are fixed here: the manifest declares the tabs, and the three
 * `data-section` attributes were added to the page. `npm run validate:pages`
 * now enforces the pairing so it cannot rot back.
 */
const database: PageManifest = {
  id: 'database',
  route: '/database',
  label: 'Database',
  icon: 'Database',
  group: 'Navigation',
  keywords: ['database', 'tables', 'sql', 'schema', 'rows', 'migrations'],
  hint: 'Browse every table, the schema map and the change history',

  tabs: {
    variable: 'activeTab',
    stateKey: 'tab',
    storageKey: 'database-activeTab',
    default: 'browse',
    items: [
      { id: 'browse', label: 'Browse', icon: 'Database', keywords: ['browse', 'tables', 'rows', 'data'] },
      { id: 'architecture', label: 'Architecture', icon: 'Blocks', keywords: ['architecture', 'schema', 'diagram', 'relations'] },
      { id: 'changes', label: 'Recent Changes', icon: 'History', keywords: ['changes', 'history', 'migrations', 'diff'] },
    ],
  },

  sections: [
    { id: 'database.browse', label: 'Database — Browse', icon: 'Database', keywords: ['browse', 'tables', 'rows'] },
    { id: 'database.architecture', label: 'Database — Architecture', icon: 'Blocks', keywords: ['architecture', 'schema', 'diagram'] },
    { id: 'database.changes', label: 'Database — Recent Changes', icon: 'History', keywords: ['changes', 'history', 'migrations'] },
  ],
}

export default database
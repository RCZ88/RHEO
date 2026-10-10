import type { PageManifest } from '../types'

/**
 * /life — the Warmth page.
 *
 * Two-level surface: a `viewMode` switch (Pages | River) and, inside Pages, a
 * 7-tab `PAGE_TABS` strip. Before this manifest the palette listed three
 * `life-*` items, NONE of which carried a `tab`, so every ⌘K jump to Life landed
 * on the River view with the Phases lens — the tabs were unreachable. `notes`
 * and `memories` in particular had no deep-nav path from anywhere in the app:
 * the Dashboard widget that tries to jump to a note dispatches a `rheo:navigate`
 * event that has zero listeners.
 *
 * The `hashParam` + `storageKey` pair below is exactly what `LifePage.tsx:145-161`
 * reads. Declaring it here is what makes the palette able to reach these tabs.
 *
 * The `section` on every tab matches a `data-section` written in
 * `LifePage.tsx` — the page is the source of truth for the anchor, the manifest
 * is the source of truth for the destination. `npm run validate:pages` fails if
 * the two ever disagree.
 */
const life: PageManifest = {
  id: 'life',
  route: '/life',
  label: 'Life',
  icon: 'Heart',
  group: 'Navigation',
  keywords: ['life', 'warmth', 'phases', 'river', 'gold', 'memories', 'notes', 'habits', 'covenant', 'self'],
  hint: 'Phases, covenant, memories, gold, notes, schedule, habits, self',

  tabs: {
    variable: 'pageTab',
    stateKey: 'tab',
    storageKey: '/life-activeTab',
    hashParam: 'tab',
    default: 'covenant',
    items: [
      {
        id: 'covenant',
        label: 'Covenant',
        icon: 'Anchor',
        section: 'life.covenant',
        keywords: ['covenant', 'promises', 'commitments', 'agreements', 'vows'],
      },
      {
        id: 'memories',
        label: 'Memories',
        icon: 'Image',
        section: 'life.memories',
        keywords: ['memories', 'photos', 'collage', 'timeline', 'photos'],
      },
      {
        id: 'gold',
        label: 'Gold',
        icon: 'Coins',
        section: 'life.gold',
        keywords: ['gold', 'treasure', 'goals', 'vault', 'wealth'],
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: 'NotebookPen',
        section: 'life.notes',
        keywords: [
          'notes', 'note', 'journal', 'writing', 'drafts', 'groups', 'tags',
          'markdown', 'capture', 'quick note', 'reflection',
        ],
      },
      {
        id: 'schedule',
        label: 'Schedule',
        icon: 'Calendar',
        section: 'life.schedule',
        keywords: ['schedule', 'calendar', 'planner', 'events', 'agenda'],
      },
      {
        id: 'habits',
        label: 'Habits',
        icon: 'Target',
        section: 'life.habits',
        keywords: ['habits', 'streak', 'daily', 'routine', 'checklist', 'tracker'],
      },
      {
        id: 'training',
        label: 'Training',
        icon: 'Activity',
        section: 'life.training',
        keywords: ['training', 'log', 'review queue', 'srs', 'spaced repetition', 'coach', 'plan mode', 'drill', 'practice'],
      },
      {
        id: 'self',
        label: 'Self',
        icon: 'User',
        section: 'life.self',
        keywords: [
          'self', 'identity', 'profile', 'radar', 'interests',
          'context brain', 'knowledge graph', 'graph', 'nodes', 'edges',
          'entities', 'legend', 'avalanche', 'activity', 'governance',
        ],
      },
    ],
  },

  /**
   * Sections inside the SELF tab.
   *
   * These are deliberately `find.segments` and NOT page-level `sections`. A
   * page-level section becomes a ⌘K palette row that scrolls the page — but
   * every one of these anchors only exists while the Self tab is mounted, so a
   * palette row would navigate to `/life` (defaulting to Covenant) and then
   * scroll to nothing. That is the exact rot §5d exists to prevent. As find
   * segments they are searchable, and their `section` maps to a real
   * `data-section` in `SelfOrchestrator.tsx`.
   */
  find: {
    root: '[data-section="life.self"]',
    segments: [
      {
        id: 'life.self.graph',
        title: 'Context Brain graph',
        text: 'The living knowledge graph: entities as nodes, facts as edges. Click a node to inspect it, drag to rearrange, arrow keys to navigate, search and filter by type.',
        section: 'life.self.graph',
        rank: 2,
      },
      {
        id: 'life.self.identity',
        title: 'Identity',
        text: 'Who you are — the profile card that keys the graph beside it.',
        section: 'life.self.identity',
        rank: 2,
      },
      {
        id: 'life.self.legend',
        title: 'Reading the graph',
        text: 'What the graph colours mean, what is selected, and how many connections it has.',
        section: 'life.self.legend',
        rank: 1,
      },
      {
        id: 'life.self.activity',
        title: 'Avalanche readout',
        text: 'Live firing events across the graph, with cascade size and magnitude.',
        section: 'life.self.activity',
        rank: 1,
      },
      {
        id: 'life.self.signals',
        title: 'Brain totals',
        text: 'Episodes, entities, active facts and all-time facts.',
        section: 'life.self.signals',
        rank: 1,
      },
      {
        id: 'life.self.governance',
        title: 'Memory & Brain Management',
        text: 'Drawer for governance totals and jumping to the graph in AI Assistant.',
        section: 'life.self.governance',
        rank: 0.5,
      },
    ],
  },

  sections: [
    { id: 'life.river', label: 'River', icon: 'Waves', keywords: ['river', 'flow', 'timeline', 'canvas', 'ring', 'lens'] },
    { id: 'life.lenses', label: 'River Lenses', icon: 'Compass', keywords: ['lens', 'phases', 'gold', 'memories', 'covenant', 'view'] },
    { id: 'life.quick-add', label: 'Quick Add', icon: 'Plus', keywords: ['quick add', 'new', 'create', 'phase', 'goal', 'memory'] },
    { id: 'life.drafts', label: 'Draft Chapters', icon: 'PenTool', keywords: ['draft', 'shelf', 'unfinished', 'wip'] },
  ],

  tutorial: {
    id: 'life',
    name: 'Life',
    steps: [
      {
        target: '[data-tutorial="life.view-switch"]',
        title: 'Pages or River',
        instruction: '• **Pages** is the tabbed workspace for editing\n• **River** is the visual timeline of your phases',
        position: 'bottom',
      },
      {
        target: '[data-tutorial="life.tabs"]',
        title: 'Seven tabs',
        instruction: '• Covenant, Memories, Gold, **Notes**, Schedule, Habits, Self\n• Every tab is one keystroke away from ⌘K',
        position: 'bottom',
        type: 'action',
      },
      {
        target: '[data-tutorial="life.notes"]',
        title: 'Notes',
        instruction: '• Group notes, tag them, attach files and links\n• Drafts sit at the top until you file them',
        position: 'right',
        type: 'action',
      },
    ],
  },
}

export default life

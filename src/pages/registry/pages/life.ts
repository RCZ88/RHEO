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
  hint: 'Goals, covenant, memories, notes, schedule, training, self',

  tabs: {
    variable: 'pageTab',
    stateKey: 'tab',
    storageKey: '/life-activeTab',
    hashParam: 'tab',
    /* The `habits` tab was deleted in the Life consolidation, but the id is a
       plain string and every emitter of it kept compiling: the dashboard's
       WIDGET_NAV, shared `?tab=habits` links, and — worst — the persisted
       `/life-activeTab` value written by an older build. Without this, all three
       are rejected against `validIds` and the page silently falls back to its
       default tab. See `usePageSurface.resolveTabId`. */
    tabAliases: { habits: 'gold' },
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
        /* §1.2 the KEY stays 'gold' — it is technical identity, bookmarked,
           persisted in `/life-activeTab` and passed as `?tab=gold`. Only the
           LABEL changes, because the tab now holds goals, habits and routines,
           not gold. */
        label: 'Goals',
        icon: 'Coins',
        section: 'life.gold',
        /* THE KEYWORDS CARRY THE DEEP-LINK. With the Habits tab gone, this array
           is the only thing that makes ⌘K → "habits" still find something.
           Removing it would silently break every habits deep-nav. */
        keywords: ['goals', 'goal', 'gold', 'habits', 'habit', 'routine', 'streak', 'weekly', 'vault', 'long-term', 'target'],
        /* §5.3 edit 7: the Goals tab now carries FIVE panes, so each needs a
           search segment.
           These are `find.segments`, NOT page-level `sections`, and the
           distinction is load-bearing: a page-level section becomes a ⌘K row
           that navigates to /life, defaults the tab to Covenant, and then
           scrolls to an anchor that is not mounted — the exact rot §5d exists to
           prevent. A segment is scoped to the tab's own subtree, so it cannot
           escape to a tab that is not open. */
        find: {
          /* Consumed: it is what scopes a Ctrl+F hit to this tab's subtree, so a
             match in another tab's unmounted DOM cannot be attributed to it. */
          root: '[data-section="life.gold"]',
          segments: [
            {
              id: 'life.gold.today',
              title: 'Today',
              text: 'Daily goals for the selected day. The shortest horizon: one thing that matters today.',
              section: 'life.gold.today',
              rank: 2,
            },
            {
              id: 'life.gold.habits',
              title: 'Habits',
              text: 'Habits are goals that repeat. Each one keeps a streak, so the tracker shows the week at a glance.',
              section: 'life.gold.habits',
              rank: 2,
            },
            {
              id: 'life.gold.routines',
              title: 'Routines',
              text: 'Weekly recurring targets — the thing you repeat on a cadence, as distinct from a habit streak.',
              section: 'life.gold.routines',
              rank: 2,
            },
            {
              id: 'life.gold.vault',
              title: 'The Vault',
              text: 'Long-term destinations. The only place a long-term goal appears — it is never a routine.',
              section: 'life.gold.vault',
              rank: 2,
            },
            {
              id: 'life.gold.weekly',
              title: 'Weekly recap',
              text: 'Monday to Sunday at a glance: productive time, routines sealed, habits kept, and the one change worth making.',
              section: 'life.gold.weekly',
              rank: 1,
            },
          ],
        },
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
        /* The count was right by accident before and is right now: the list
           said seven but named six tabs, omitting Training and naming the
           deleted Habits tab. Now it names the seven that actually exist. */
        title: 'Seven tabs',
        instruction: '• Covenant, Memories, **Goals**, Notes, Schedule, **Training**, Self\n• Habits and routines live in Goals\n• Every tab is one keystroke away from ⌘K',
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

import type { PageManifest } from '../types'

/**
 * /ai — the AI Studio deck.
 *
 * `AiPage` has three render modes (`deck` | `canvas` | `compositions`) and NO
 * visible tab bar — the mode is reachable only through `location.state.tab`.
 * `deck` had no palette entry at all, so it was unreachable except by accident.
 * Declaring the modes as tabs makes ⌘K the tab bar it never had.
 *
 * The card types are declared as sections so ⌘K can jump to a specific card
 * composition rather than only to the canvas.
 */
const ai: PageManifest = {
  id: 'ai',
  route: '/ai',
  label: 'AI Studio',
  icon: 'Bot',
  group: 'Navigation',
  keywords: ['ai', 'assistant', 'canvas', 'compositions', 'chat', 'cards'],
  aliases: ['ai-assistant'],
  hint: 'Chat, card canvas and saved compositions',

  tabs: {
    variable: 'canvasMode',
    stateKey: 'tab',
    default: 'canvas',
    items: [
      { id: 'chat', label: 'Chat', icon: 'MessageSquare', keywords: ['chat', 'conversation', 'assistant'] },
      { id: 'canvas', label: 'Canvas Deck', icon: 'LayoutGrid', section: 'ai.canvas', keywords: ['canvas', 'cards', 'deck', 'board'] },
      { id: 'deck', label: 'Deck', icon: 'Presentation', section: 'ai.deck', keywords: ['deck', 'slides', 'cards'] },
      { id: 'compositions', label: 'Compositions', icon: 'Layers', section: 'ai.compositions', keywords: ['compositions', 'library', 'saved', 'templates'] },
    ],
  },

  sections: [
    // The AI tools surface lives on the IDE page, not here: `AIToolsTab` is
    // mounted by `IDEProjectsPage.tsx:2183` under the `ai` tab, which already
    // carries the `ide.ai-tools` anchor. Declaring it as a section HERE would
    // have pointed ⌘K at an element that never renders on /ai. Cross-page
    // section instead — `route` present, so no `data-section` is required.
    { id: 'ai.tools', label: 'AI — Tools & Commands', icon: 'Wrench', route: '/ide', tab: 'ai', keywords: ['tools', 'slash', 'commands', 'toolbox', 'ide'] },
  ],

  /**
   * The five canvas card slots are NOT sections, on purpose.
   *
   * `connectorsSlot`, `focusSlot`, `digestSlot`, the automations list and the
   * goals/reminders drawer are slots inside a card, not page regions. Anchoring
   * them would mean either a new prop on three components or a wrapper div inside
   * a layout-sensitive card slot — and a `display:contents` wrapper inside that
   * slot is exactly the kind of "safe" change that is not safe.
   *
   * So they are curated Ctrl+F segments instead: findable by name, zero layout
   * risk, and no invented anchor. Goals & Reminders is a MODAL (`open={...}`) and
   * is therefore not even a scroll target — anchoring a section to a closed modal
   * would scroll to an unmounted element and silently do nothing.
   */
  find: {
    segments: [
      { id: 'connectors', title: 'Connectors', text: 'Link external services — email, calendars and issue trackers — into the AI canvas.', rank: 1.4 },
      { id: 'focus-board', title: 'Focus board', text: 'Goals, plan goals and AI suggestions for the current focus session.', rank: 1.4 },
      { id: 'automations', title: 'Automations', text: 'Trigger-based automations parsed from natural language and run on a schedule or event.', rank: 1.3 },
      { id: 'daily-digest', title: 'Daily digest', text: 'A generated morning digest of the topics you follow, with sources and confidence.', rank: 1.3 },
      { id: 'goals-reminders', title: 'Goals & reminders', text: 'Long-term goals, events and calendar reminders in one drawer.', rank: 1.2 },
    ],
  },

  tutorial: {
    id: 'ai',
    name: 'AI Assistant',
    steps: [
      {
        target: '[data-tutorial="ai.canvas"]',
        title: 'Canvas',
        instruction: '• A grid of live cards: planner, schedule, deadlines, goals\n• Cards are draggable and resizable',
        position: 'right',
        type: 'action',
      },
      {
        target: '[data-tutorial="ai.card-types"]',
        title: 'Card types',
        instruction: '• Add a card, then pick what it renders\n• Each type has its own settings panel',
        position: 'bottom',
        type: 'action',
      },
    ],
  },
}

export default ai
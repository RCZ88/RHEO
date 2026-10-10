import type { PageManifest } from '../types'

/**
 * /terminal — the Terminal Workspace.
 *
 * Three levels deep: group → sub-tab → panel. The palette listed 6 of the 8
 * groups (`ai-gateway` and `handbook` were missing entirely) and ZERO of the 29
 * sub-tabs. This manifest declares all three levels, which is what makes
 * "Handbook → Practice" a two-keystroke trip instead of four clicks.
 *
 * Sub-tabs are declared as `children` of their group so the flattened palette
 * entry still carries BOTH the group (`navState.group`) and the sub-tab, which
 * is what `TerminalPage.tsx:637-647` needs to land on the right panel.
 */
const terminal: PageManifest = {
  id: 'terminal',
  route: '/terminal',
  label: 'Terminal Workspace',
  icon: 'Terminal',
  group: 'Navigation',
  keywords: ['terminal', 'workspace', 'agents', 'conductor', 'sessions', 'context brain'],
  hint: 'Eight groups, twenty-nine panels — the agent control room',
  aliases: ['conductor'],

  tabs: {
    variable: 'activeGroup',
    stateKey: 'group',
    storageKey: 'terminal-activeGroup',
    default: 'work',
    items: [
      {
        id: 'setup',
        label: 'Setup',
        icon: 'Settings',
        keywords: ['setup', 'presets', 'configs', 'routing', 'profiles'],
        children: [
          { id: 'presets', label: 'Presets', icon: 'Bookmark', keywords: ['presets', 'shortcuts', 'saved'] },
          { id: 'configs', label: 'Configs', icon: 'Sliders', keywords: ['configs', 'configuration'] },
          { id: 'fortress', label: 'Fortress', icon: 'ShieldCheck', keywords: ['fortress', 'security', 'permissions', 'sandbox'] },
          { id: 'backups', label: 'Backups', icon: 'HardDrive', keywords: ['backups', 'snapshots', 'restore'] },
        ],
      },
      {
        id: 'work',
        label: 'Work',
        icon: 'Terminal',
        keywords: ['work', 'sessions', 'agents', 'terminal'],
        children: [
          { id: 'sessions', label: 'Sessions', icon: 'Terminal', keywords: ['sessions', 'agents', 'active', 'terminals'] },
          { id: 'map', label: 'Map', icon: 'Workflow', keywords: ['map', 'graph', 'topology', 'overview'] },
          { id: 'files', label: 'Files', icon: 'Folder', keywords: ['files', 'browse', 'project files'] },
          { id: 'workspaces', label: 'Workspaces', icon: 'LayoutGrid', keywords: ['workspaces', 'saved', 'groups', 'multi-pane'] },
        ],
      },
      {
        id: 'insights',
        label: 'Insights',
        icon: 'LineChart',
        keywords: ['insights', 'analytics', 'costs', 'tokens', 'performance'],
        children: [
          { id: 'analytics', label: 'Analytics', icon: 'ChartLine', keywords: ['analytics', 'usage', 'costs'] },
          { id: 'code-stats', label: 'Code Stats', icon: 'FileCode', keywords: ['code', 'stats', 'lines', 'files'] },
          { id: 'history', label: 'Prompts', icon: 'NotebookPen', keywords: ['prompts', 'history', 'past', 'log'] },
          { id: 'issues', label: 'Issues', icon: 'Bug', keywords: ['issues', 'bugs', 'errors', 'problems'] },
          { id: 'performance', label: 'Performance', icon: 'Gauge', keywords: ['performance', 'latency', 'speed'] },
          { id: 'bugs', label: 'Bugs', icon: 'AlertTriangle', keywords: ['bugs', 'crashes', 'errors'] },
          { id: 'architecture', label: 'Architecture', icon: 'Blocks', keywords: ['architecture', 'structure', 'map'] },
        ],
      },
      {
        id: 'studio',
        label: 'Studio',
        icon: 'Sparkles',
        keywords: ['studio', 'build', 'dev', 'skills', 'styles', 'design'],
        children: [
          { id: 'skills', label: 'Skills', icon: 'Wand2', keywords: ['skills', 'agents', 'prompts'] },
          { id: 'styles', label: 'Styles', icon: 'Brush', keywords: ['styles', 'themes', 'css'] },
          { id: 'design', label: 'Design', icon: 'PenTool', keywords: ['design', 'mockups', 'specs'] },
        ],
      },
      {
        id: 'conductor',
        label: 'Conductor',
        icon: 'Network',
        keywords: ['conductor', 'orchestrate', 'missions', 'approvals', 'budget'],
        children: [
          { id: 'missions', label: 'Missions', icon: 'Rocket', keywords: ['missions', 'tasks', 'runs'] },
          { id: 'approvals', label: 'Approvals', icon: 'CheckCircle2', keywords: ['approvals', 'review', 'pending'] },
          { id: 'trace', label: 'Trace', icon: 'Activity', keywords: ['trace', 'timeline', 'debug'] },
          { id: 'budget', label: 'Budget', icon: 'Wallet', keywords: ['budget', 'cost', 'spend', 'limits'] },
          { id: 'providers', label: 'Providers', icon: 'Server', keywords: ['providers', 'backends', 'models'] },
          { id: 'templates', label: 'Templates', icon: 'Copy', keywords: ['templates', 'presets'] },
          { id: 'settings', label: 'Settings', icon: 'Settings', keywords: ['settings', 'config'] },
        ],
      },
      {
        id: 'context',
        label: 'Context',
        icon: 'Brain',
        keywords: ['context', 'knowledge', 'memory', 'brain', 'dictionary'],
        children: [
          { id: 'context', label: 'Context', icon: 'Inbox', keywords: ['context', 'inbox', 'injected'] },
          { id: 'context-brain', label: 'Brain', icon: 'Brain', keywords: ['brain', 'graph', 'entities'] },
          { id: 'context-maintenance', label: 'Maintenance', icon: 'RefreshCw', keywords: ['maintenance', 'cleanup', 'decay'] },
          { id: 'context-map', label: 'Architecture Map', icon: 'Workflow', keywords: ['architecture', 'map', 'pages', 'components'] },
          { id: 'dictionary', label: 'Dictionary', icon: 'BookOpen', keywords: ['dictionary', 'terms', 'terminology', 'vocabulary'] },
        ],
      },
    ],
  },

  tutorial: {
    id: 'terminal',
    name: 'Terminal & Agent Sessions',
    steps: [
      {
        target: '[data-tutorial="term.panes"]',
        title: 'Panes',
        instruction: '• Split the terminal into panes and run agents side by side\n• Sessions persist across restarts',
        position: 'right',
      },
      {
        target: '[data-tutorial="term.sessions"]',
        title: 'Sessions',
        instruction: '• Name a session, pick a working directory, launch an agent\n• Context is injected automatically from Context → Brain',
        position: 'right',
        type: 'action',
      },
    ],
  },
}

export default terminal

import type { PageManifest } from '../types'

/**
 * /ide — IDE Projects, Environment, Git, Analytics, Backup, AI Tools.
 *
 * **The key-mismatch fix.** `deepNav.ts` wrote `ide-activeTab`, but
 * `IDEProjectsPage.tsx:369` reads `ide-projects-activeTab`. The palette appeared
 * to work only because `navigateTo` *also* passes `location.state.tab`, which
 * the page does honour — the localStorage half was silently dead. Declaring
 * `storageKey: 'ide-projects-activeTab'` makes the page reload onto the right
 * tab instead of resetting to Overview on every hard refresh.
 */
const ide: PageManifest = {
  id: 'ide',
  route: '/ide',
  label: 'IDE Projects',
  icon: 'Code2',
  group: 'Navigation',
  keywords: ['ide', 'projects', 'code', 'git', 'environment', 'editor'],
  aliases: ['ide-projects'],

  tabs: {
    variable: 'activeTab',
    stateKey: 'tab',
    storageKey: 'ide-projects-activeTab',
    default: 'overview',
    items: [
      { id: 'overview', label: 'Overview', icon: 'LayoutDashboard', section: 'ide.overview', keywords: ['overview', 'pulse', 'summary', 'usage'] },
      { id: 'projects', label: 'Projects', icon: 'FolderOpen', section: 'ide.projects', keywords: ['projects', 'repos', 'list', 'manage'] },
      { id: 'ai', label: 'AI Tools', icon: 'Sparkles', section: 'ide.ai-tools', keywords: ['ai', 'tools', 'assistant', 'code', 'copilot'] },
      { id: 'git', label: 'Git', icon: 'GitBranch', section: 'ide.git', keywords: ['git', 'commits', 'branch', 'diff', 'history'] },
      { id: 'environment', label: 'Environment', icon: 'Cpu', section: 'ide.environment', keywords: ['environment', 'tools', 'setup', 'runtimes', 'languages'] },
      { id: 'analytics', label: 'Analytics', icon: 'LineChart', section: 'ide.analytics', keywords: ['analytics', 'metrics', 'charts', 'productivity'] },
      { id: 'backup', label: 'Backup', icon: 'HardDrive', section: 'ide.backup', keywords: ['backup', 'snapshot', 'restore', 'archive'] },
    ],
  },

  tutorial: {
    id: 'ide',
    name: 'IDE Projects',
    steps: [
      {
        target: '[data-tutorial="ide.usage"]',
        title: 'IDE usage',
        instruction: '• Per-project time and language breakdown\n• Feeds the productivity tier you assigned to your editor',
        position: 'right',
      },
    ],
  },
}

export default ide

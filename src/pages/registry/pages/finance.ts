import type { PageManifest } from '../types'

/**
 * /finance — Overview, Wallets, Transactions, People, Categories, Budget,
 * Charts, Audit, Recap.
 *
 * **`budget`, `charts` and `people` are real tabs with real `data-section`
 * anchors**, but the palette listed `finance.budget` / `finance.charts` /
 * `finance.people` as sections *and* the deep-nav hint wrote
 * `finance-activeTab`, which `FinancePage` never reads — it reads
 * `location.state.tab` only. So those three entries navigated to the page and
 * stopped on Overview. Declaring them as `tabs` routes them through the channel
 * the page actually honours.
 *
 * `subscriptions` is deliberately NOT a tab: `FinancePage` has no such tab, it
 * renders a subscriptions BLOCK inside the overview tab. It is declared as a
 * section (`finance.subscriptions`) because that anchor genuinely exists at
 * `FinancePage.tsx:1370`.
 */
const finance: PageManifest = {
  id: 'finance',
  route: '/finance',
  label: 'Finance',
  icon: 'Wallet',
  group: 'Navigation',
  keywords: ['finance', 'money', 'wallet', 'budget', 'spending', 'transactions'],

  tabs: {
    variable: 'activeTab',
    stateKey: 'tab',
    storageKey: 'finance-activeTab',
    default: 'overview',
    items: [
      { id: 'overview', label: 'Overview', icon: 'Wallet', section: 'finance.overview', keywords: ['overview', 'summary', 'net worth'] },
      { id: 'wallets', label: 'Wallets', icon: 'CreditCard', section: 'finance.wallets', keywords: ['wallets', 'accounts', 'balance', 'cards'] },
      { id: 'transactions', label: 'Transactions', icon: 'Receipt', section: 'finance.transactions', keywords: ['transactions', 'history', 'spend', 'ledger'] },
      { id: 'people', label: 'People', icon: 'Users', keywords: ['people', 'contacts', 'split', 'owes'] },
      { id: 'categories', label: 'Categories', icon: 'Tags', section: 'finance.categories', keywords: ['categories', 'budget', 'groups', 'tags'] },
      { id: 'budget', label: 'Budget', icon: 'Gauge', keywords: ['budget', 'plan', 'limits', 'allowance'] },
      { id: 'charts', label: 'Charts', icon: 'LineChart', keywords: ['charts', 'trends', 'graph', 'visualisation'] },
      { id: 'audit', label: 'Audit Log', icon: 'ScrollText', section: 'finance.audit', keywords: ['audit', 'log', 'changes', 'history'] },
      { id: 'recap', label: 'Recap', icon: 'Calendar', section: 'finance.recap', keywords: ['recap', 'summary', 'report', 'period'] },
    ],
  },

  sections: [
    { id: 'finance.subscriptions', label: 'Finance — Subscriptions', icon: 'Repeat', keywords: ['subscriptions', 'recurring', 'monthly', 'mrr'] },
    { id: 'finance.subscriptions.full', label: 'Finance — All Subscriptions', icon: 'List', keywords: ['subscriptions', 'full list', 'all recurring'] },
  ],
}

/**
 * /resume — the hub, plus four real child ROUTES.
 *
 * `currentPageId` was `pathname.replace('/',')`, so `/resume/build` minted the
 * pageId `resume/build` while `SMART_SEARCH_PAGES` keyed on `resume-build`. The
 * Ctrl+F "Page" scope filter `h.pageId === currentPageId` could therefore never
 * match the curated resume segments. `match` fixes the derivation at the source.
 */
const resume: PageManifest = {
  id: 'resume',
  route: '/resume',
  label: 'Resume Builder',
  icon: 'FileText',
  group: 'Navigation',
  keywords: ['resume', 'cv', 'builder', 'jobs', 'career'],
  hint: 'Build, preview, import and export your CV',
  aliases: ['resume-hub'],

  children: [
    { id: 'resume-build', route: '/resume/build', label: 'Build / Editor', icon: 'PenTool', keywords: ['build', 'editor', 'edit', 'write', 'sections'], group: 'Resume' },
    { id: 'resume-preview', route: '/resume/preview', label: 'Preview', icon: 'Presentation', keywords: ['preview', 'view', 'render', 'pdf'], group: 'Resume' },
    { id: 'resume-import', route: '/resume/import', label: 'Import', icon: 'Upload', keywords: ['import', 'upload', 'pdf', 'parse', 'existing cv'], group: 'Resume' },
    { id: 'resume-export', route: '/resume/export', label: 'Export', icon: 'Download', keywords: ['export', 'download', 'pdf', 'share', 'format'], group: 'Resume' },
  ],
}

export { finance, resume }
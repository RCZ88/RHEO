export const DEFAULT_CATEGORIES = [
  'IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication',
  'Design', 'Productivity', 'Tools', 'Education', 'Developer Tools',
  'Search Engine', 'News', 'Shopping', 'Social Media', 'Gaming', 'Uncategorized', 'Other'
];

export const DEFAULT_TIER_ASSIGNMENTS = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other'],
  distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming']
};

export const CATEGORY_COLORS: Record<string, string> = {
  'IDE': '#6366f1',
  'AI Tools': '#8b5cf6',
  'Browser': '#3b82f6',
  'Entertainment': '#ec4899',
  'Communication': '#14b8a6',
  'Design': '#a855f7',
  'Productivity': '#10b981',
  'Tools': '#f59e0b',
  'Education': '#06b6d4',
  'Developer Tools': '#10b981',
  'Search Engine': '#0ea5e9',
  'News': '#eab308',
  'Shopping': '#f97316',
  'Social Media': '#ef4444',
  'Uncategorized': '#78716c',
  'Other': '#64748b',
};

export const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#64748b', '#78716c',
];

export const ANIMATION_DURATIONS: Record<'slow' | 'normal' | 'instant', number> = {
  slow: 2500,
  normal: 1200,
  instant: 0,
};

export const DEFAULT_SHORTCUTS: Record<string, string> = {
  voiceInput: 'Ctrl+Shift+V',
  commandPalette: 'Ctrl+K',
  aiChatVoice: 'Ctrl+Shift+M',
  aiPageTranscript: 'Ctrl+Shift+L',
  aiPagePalette: 'Ctrl+K',
  designWorkspacePalette: 'Cmd+K',
  externalSelect: 'Enter',
  externalDeselect: 'Escape',
  canvasUndo: 'Ctrl+Z',
  canvasRedo: 'Ctrl+Shift+Z',
  financeNewTx: 'Ctrl+N',
  chatSend: 'Ctrl+Enter',
  pageContextSearch: 'Ctrl+F',
  ideAddProject: 'Ctrl+A',
  ideRefresh: 'Ctrl+R',
  resumeSubmit: 'Ctrl+Enter',
  terminalNewTab: 'Ctrl+Shift+T',
  terminalCloseTab: 'Ctrl+Shift+W',
  terminalRename: 'Ctrl+Shift+R',
  terminalPin: 'Ctrl+Shift+P',
  terminalNextTab: 'Ctrl+Tab',
  terminalPrevTab: 'Ctrl+Shift+Tab',
  terminalSplitH: 'Ctrl+Shift+H',
  terminalSplitV: 'Ctrl+Shift+V',
  terminalNextPane: 'Ctrl+Shift+ArrowRight',
  terminalPrevPane: 'Ctrl+Shift+ArrowLeft',
  terminalZoom: 'Ctrl+Shift+Z',
  terminalBroadcast: 'Ctrl+Shift+B',
  terminalPalette: 'Ctrl+K',
  terminalClear: 'Ctrl+L',
  terminalWorkspace: 'Ctrl+Shift+S',
  terminalFind: 'Ctrl+Shift+F',
  terminalSaveCmd: 'Ctrl+Shift+D',
  terminalCycleTheme: 'Ctrl+Shift+Y',
  terminalFindInPanes: 'Ctrl+Shift+T',
  terminalBalance: 'Ctrl+Shift+Space',
  terminalExport: 'Ctrl+Shift+E',
  terminalSplitFind: 'Ctrl+Shift+J',
  terminalSplitFindHist: 'Ctrl+Shift+K',
  terminalEnter: 'Enter',
  lyceumHome: 'g h',
  lyceumLibrary: 'g l',
  lyceumStudy: 'g s',
  lyceumNext: 'j / ↓',
  lyceumPrev: 'k / ↑',
  lyceumTutor: 'a',
  lyceumGraph: 'g',
  lyceumCompose: 'c',
  lyceumImport: 'i',
  lyceumShortcuts: '?',
  lyceumClose: 'Esc',
};

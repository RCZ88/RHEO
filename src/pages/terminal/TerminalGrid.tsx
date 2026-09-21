import { useState, useCallback } from 'react';
import { Bug, Sparkles, RefreshCw, Search, Eye, MoreHorizontal } from 'lucide-react';
import type { PaneNode } from '../components/TerminalWindow';
import { TerminalLayout, insertIntoLayout, getLeafIds, getGroupTrees, updateGroupTree } from '../components/TerminalWindow';
import { splitPane, removePane } from '../components/TerminalWindow';
import { MapEditor, swapLeavesInTree } from '../components/MapEditor';

// ── Terminal ID Generator ──

export function generateTerminalId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface TerminalGroup { terminals: string[]; direction?: 'horizontal' | 'vertical'; }

export function collectLeafIds(node: PaneNode): string[] {
  if (node.type === 'leaf') return node.terminalId ? [node.terminalId] : [];
  if (node.children) return [...collectLeafIds(node.children[0]), ...collectLeafIds(node.children[1])];
  return [];
}

export function extractGroups(layout: PaneNode | null): TerminalGroup[] {
  if (!layout) return [];
  if (layout.type === 'leaf') return [{ terminals: layout.terminalId ? [layout.terminalId] : [], direction: undefined }];
  if (layout.children) return layout.children.map(c => ({ terminals: collectLeafIds(c), direction: layout.direction }));
  return [];
}

export function togglePaneDirection(node: PaneNode, path: number[]): PaneNode {
  if (path.length === 0) {
    return { ...node, direction: node.direction === 'horizontal' ? 'vertical' : 'horizontal' };
  }
  const [index, ...rest] = path;
  if (!node.children || !node.children[index]) return node;
  const newChildren = [...node.children];
  newChildren[index] = togglePaneDirection(newChildren[index], rest);
  return { ...node, children: newChildren };
}

export function findLeafInTree(node: PaneNode, terminalId: string): PaneNode | null {
  if (node.type === 'leaf') return node.terminalId === terminalId ? node : null;
  if (node.children) {
    for (const child of node.children) {
      const found = findLeafInTree(child, terminalId);
      if (found) return found;
    }
  }
  return null;
}

export function removeLeafFromTree(node: PaneNode, terminalId: string): PaneNode | null {
  if (node.type === 'leaf') return node.terminalId === terminalId ? null : node;
  if (!node.children) return node;
  const newChildren = node.children.map(c => removeLeafFromTree(c, terminalId)).filter((c): c is PaneNode => c !== null);
  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];
  return { ...node, children: newChildren };
}

export function addLeafToGroup(tree: PaneNode, targetId: string, leaf: PaneNode, direction: 'horizontal' | 'vertical'): PaneNode {
  if (tree.type === 'leaf' && tree.terminalId === targetId) {
    return { type: 'split', direction, children: [tree, leaf] };
  }
  if (tree.children) {
    return { ...tree, children: tree.children.map(c => addLeafToGroup(c, targetId, leaf, direction)) };
  }
  return tree;
}

// ── Session Categorization Config ──

const SESSION_CATEGORIES: Record<string, { label: string; icon: any; bg: string; text: string; border: string; color: string }> = {
  'bug-fix': { label: 'Bug Fix', icon: Bug, bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30', color: 'red' },
  'feature': { label: 'Feature', icon: Sparkles, bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', color: 'blue' },
  'refactor': { label: 'Refactor', icon: RefreshCw, bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30', color: 'purple' },
  'research': { label: 'Research', icon: Search, bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/30', color: 'teal' },
  'review': { label: 'Review', icon: Eye, bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', color: 'amber' },
  'other': { label: 'Other', icon: MoreHorizontal, bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30', color: 'zinc' },
};

const SESSION_STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  active: { dot: 'bg-green-500 animate-pulse', label: 'Active' },
  paused: { dot: 'bg-yellow-500', label: 'Paused' },
  completed: { dot: 'bg-gray-500', label: 'Completed' },
  archived: { dot: 'bg-zinc-600', label: 'Archived' },
  action_required: { dot: 'bg-orange-500 animate-pulse', label: 'Action Required' },
  in_progress: { dot: 'bg-violet-500 animate-pulse', label: 'Working...' },
  ready: { dot: 'bg-cyan-500', label: 'Ready' },
};

const SUBPAGE_LABELS: Record<string, string> = {
  'setup/presets': 'Setup / Presets',
  'setup/configs': 'Setup / Configs',
  'setup/fortress': 'Setup / Fortress',
  'setup/backups': 'Setup / Backups',
  'work/sessions': 'Work / Sessions',
  'work/map': 'Work / Map',
  'work/files': 'Work / Files',
  'work/workspaces': 'Work / Workspaces',
  'insights/analytics': 'Insights / Analytics',
  'insights/code-stats': 'Insights / Code Stats',
  'insights/history': 'Insights / Prompts',
  'insights/issues': 'Insights / Issues',
  'insights/performance': 'Insights / Performance',
  'insights/bugs': 'Insights / Bugs',
  'insights/architecture': 'Insights / Architecture',
  'studio/skills': 'Studio / Skills',
  'studio/styles': 'Studio / Styles',
  'studio/design': 'Studio / Design',
  'ai-gateway/status': 'AI Gateway / Status',
  'ai-gateway/chat': 'AI Gateway / Chat',
  'ai-gateway/providers': 'AI Gateway / Providers',
  'ai-gateway/runs': 'AI Gateway / Runs',
  'ai-gateway/settings': 'AI Gateway / Settings',
  'context/context': 'Context / Context',
  'context/context-maintenance': 'Context / Maintenance',
  'context/page-context': 'Context / Page Context',
  'context/feature-logic': 'Context / Feature Logic',
  'context/dictionary': 'Context / Dictionary',
};

// ── Workspace UI Primitives ──

const GROUP_ACCENT_HEX: Record<string, string> = {
  green: '#34d399', emerald: '#34d399', teal: '#2dd4bf', cyan: '#22d3ee', blue: '#3b82f6',
  indigo: '#818cf8', violet: '#a78bfa', purple: '#c084fc', pink: '#f472b6', rose: '#fb7185',
  amber: '#fbbf24', yellow: '#facc15', orange: '#fb923c',
};

const accentStyle = (accent: string): React.CSSProperties => ({ ['--page-accent' as string]: GROUP_ACCENT_HEX[accent] || '#22d3ee' } as React.CSSProperties);

export const WS_ICON_BTN = 'p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors duration-150 active:scale-95';

export const WS_SELECT = 'h-7 w-full rounded-md bg-zinc-900 border border-zinc-800/60 px-2 pr-7 text-[11px] text-zinc-200 appearance-none bg-no-repeat bg-[right_0.5rem_center] hover:border-zinc-700 focus:border-[color:var(--page-accent)]/60 focus:ring-1 focus:ring-[color:var(--page-accent)]/25 focus:outline-none transition-colors duration-150';

export const TAB_ACTIVE: Record<string, string> = {
  green: 'text-green-400 border-green-500', emerald: 'text-emerald-400 border-emerald-500',
  yellow: 'text-yellow-400 border-yellow-500', indigo: 'text-indigo-400 border-indigo-500',
  pink: 'text-pink-400 border-pink-500', orange: 'text-orange-400 border-orange-500',
  rose: 'text-rose-400 border-rose-500', amber: 'text-amber-400 border-amber-500',
  violet: 'text-violet-400 border-violet-500',
};

export const ACCENT_STRIP: Record<string, string> = {
  green: 'bg-green-500', emerald: 'bg-emerald-500', yellow: 'bg-yellow-500',
  indigo: 'bg-indigo-500', pink: 'bg-pink-500', orange: 'bg-orange-500',
  rose: 'bg-rose-500', amber: 'bg-amber-500', violet: 'bg-violet-500',
};

export const ACCENT_TEXT: Record<string, string> = {
  orange: 'text-orange-300', green: 'text-green-300', purple: 'text-purple-300',
  indigo: 'text-indigo-300', amber: 'text-amber-300', rose: 'text-rose-300',
};

export const ACCENT_BORDER: Record<string, string> = {
  orange: 'border-orange-500/50', green: 'border-green-500/50', purple: 'border-purple-500/50',
  indigo: 'border-indigo-500/50', amber: 'border-amber-500/50', rose: 'border-rose-500/50',
};

// ── Sub-Components ──

export function CategoryBadge({ category }: { category?: string }) {
  const cat = SESSION_CATEGORIES[category || 'other'] || SESSION_CATEGORIES.other;
  const Icon = cat.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium leading-none ${cat.bg} ${cat.text} ${cat.border} border`}>
      <Icon className="w-2.5 h-2.5" />
      {cat.label}
    </span>
  );
}

export function GroupPanel({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      {children}
    </div>
  );
}

interface Preset {
  id: string;
  name: string;
  command: string;
  category?: string;
  isBuiltIn?: boolean;
}

interface Session {
  id: string;
  agent: string;
  topic: string;
  resume_id?: string;
  created_at: string;
  total_cost?: number;
  total_tokens?: number;
  terminal_id?: string;
  category?: string;
  status?: string;
  product_area?: string;
  description?: string;
  auto_tags?: string;
  category_confirmed?: number;
  auto_named?: number;
  subpage?: string;
}

const loggedErrors = new Set<string>();

export function logOnce(key: string, message: string, ...args: any[]) {
  if (!loggedErrors.has(key)) {
    loggedErrors.add(key);
    console.warn(message, ...args);
  }

}


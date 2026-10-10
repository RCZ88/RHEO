// ============================================================================
// Workspace Command Bar
// Replaces the hand-rolled terminal header in TerminalPage.
// Single persistent bar: exit · project · terminal tabs · actions
// ============================================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Monitor, Plus, X, Settings, Terminal as TerminalIcon,
  Send, Save, AlertTriangle, AlertCircle, Link, RefreshCw, Cpu,
  ChevronDown, Lock
} from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';

interface TerminalTab {
  id: string;
  name: string;
  agent: string;
  modelTier?: string;
  status?: string;
}

interface SessionData {
  terminal_id?: string;
  status?: string;
  category?: string;
  topic?: string;
}

interface Project {
  id: string;
  name: string;
  path?: string;
}

interface WorkspaceCommandBarProps {
  // Exit
  onExit: () => void;
  // Project
  projects: Project[];
  selectedProject: string;
  onProjectChange: (id: string) => void;
  // Terminal tabs
  terminalTabs: Record<string, TerminalTab>;
  activeTerminalId: string | null;
  sessions: SessionData[];
  onTabSelect: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  // Actions
  onCompose: () => void;
  onQuick: () => void;
  onSave: () => void;
  // Status
  hasUnsavedChanges: boolean;
  anomalies?: Record<string, { severity: string; kind: string; detail: string }>;
  cliUpdates?: Array<{ agent: string; current: string; latest: string }>;
}

export function WorkspaceCommandBar({
  onExit, projects, selectedProject, onProjectChange,
  terminalTabs, activeTerminalId, sessions, onTabSelect, onCloseTab, onNewTab,
  onCompose, onQuick, onSave, hasUnsavedChanges, anomalies, cliUpdates,
}: WorkspaceCommandBarProps) {
  const currentProject = projects.find(p => p.id === selectedProject);

  return (
    <div className="flex items-center h-11 px-3 bg-zinc-950 light:bg-[var(--ws-surface)] border-b border-zinc-800/60 shrink-0 gap-2">
      {/* ── Left: Exit + Project ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Tooltip content="Exit workspace">
          <button
            onClick={onExit}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors duration-150"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Tooltip>

        <div className="w-px h-4 bg-zinc-800 mx-0.5" />

        <div className="flex items-center gap-1.5">
          <Monitor className="w-3.5 h-3.5 text-green-500" />
          <span className="text-[11px] font-semibold tracking-wider text-zinc-300 hidden sm:inline">Terminal</span>
        </div>

        {currentProject && (
          <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-zinc-800">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-400 max-w-[100px] truncate">{currentProject.name}</span>
          </div>
        )}

        {projects.length > 1 && (
          <select
            value={selectedProject}
            onChange={(e) => onProjectChange(e.target.value)}
            className="h-6 w-auto max-w-[120px] rounded-md bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 px-1.5 text-[10px] text-zinc-300 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-700"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Center: Terminal Tabs ── */}
      <div className="flex-1 min-w-0 flex items-center gap-px overflow-x-auto scrollbar-none mx-2">
        {Object.entries(terminalTabs).map(([id, tab]) => {
          const isActive = activeTerminalId === id;
          const session = sessions.find(s => s.terminal_id === id);
          const anomaly = anomalies?.[id];
          const isActionRequired = session?.status === 'action_required';

          return (
            <button
              key={id}
              onClick={() => onTabSelect(id)}
              className={`group relative flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium transition-all duration-150 shrink-0 ${
                isActive
                  ? 'bg-zinc-800/80 text-white ring-1 ring-zinc-700/50'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-x-0 -bottom-px h-[2px] bg-green-500 rounded-full"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}

              <TerminalIcon className="w-3 h-3 text-green-500 shrink-0" />

              {session?.status === 'active' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              )}

              <span className="max-w-[100px] truncate">{tab.name}</span>

              {tab.modelTier && tab.modelTier !== 'mid' && (
                <span className={`text-[8px] px-0.5 rounded font-mono ${
                  tab.modelTier === 'top' ? 'text-green-400 bg-green-500/15' :
                  'text-yellow-400 bg-yellow-500/15'
                }`}>
                  {tab.modelTier}
                </span>
              )}

              {isActionRequired && (
                <AlertTriangle className="w-2.5 h-2.5 text-orange-500 animate-pulse shrink-0" />
              )}

              {anomaly && (
                <AlertCircle className={`w-2.5 h-2.5 shrink-0 ${
                  anomaly.severity === 'high' ? 'text-red-500 animate-pulse' : 'text-amber-500'
                }`} />
              )}

              <button
                onClick={(e) => { e.stopPropagation(); onCloseTab(id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700/60 transition-opacity duration-100"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </button>
          );
        })}

        <button
          onClick={onNewTab}
          title="New terminal"
          className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors duration-150 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-1 shrink-0">
        {cliUpdates && cliUpdates.length > 0 && (
          <button
            title={cliUpdates.map(u => `${u.agent} ${u.current} → ${u.latest}`).join(', ')}
            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            {cliUpdates.length}
          </button>
        )}

        <button
          onClick={onCompose}
          title="Compose prompt"
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold text-zinc-950 bg-green-500 hover:bg-green-400 transition-all duration-150 active:scale-95"
        >
          <Send className="w-3 h-3" />
          <span className="hidden md:inline">Compose</span>
        </button>

        <button
          onClick={onQuick}
          title="Quick instruction"
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium text-zinc-300 bg-zinc-800 ring-1 ring-zinc-700/60 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-150 active:scale-95"
        >
          <span className="hidden md:inline">Quick</span>
        </button>

        <button
          onClick={onSave}
          title="Save workspace"
          className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-150 active:scale-95 relative"
        >
          <Save className="w-3 h-3" />
          {hasUnsavedChanges && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );
}

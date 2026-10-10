import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Edit, Equal, ChevronDown, ChevronRight, FileText, FolderTree } from 'lucide-react';
import { ProjectBackupDiff } from '../../types/deskflow-api';
import { Chip } from './_ds/primitives';

interface BackupDiffViewerProps {
  diff: ProjectBackupDiff | null;
  isLoading?: boolean;
}

export function BackupDiffViewer({ diff, isLoading }: BackupDiffViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    added: true,
    modified: true,
    deleted: true,
    unchanged: false,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-4 w-32 bg-zinc-800/60 rounded animate-pulse" />
        <div className="h-4 w-full bg-zinc-800/60 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-zinc-800/60 rounded animate-pulse" />
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FileText className="w-8 h-8 text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500">Select a backup and click Diff to compare</p>
      </div>
    );
  }

  const sections = [
    { key: 'added', label: 'Added', icon: <Plus className="w-3.5 h-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', files: diff.added },
    { key: 'modified', label: 'Modified', icon: <Edit className="w-3.5 h-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', files: diff.modified },
    { key: 'deleted', label: 'Deleted', icon: <Minus className="w-3.5 h-3.5" />, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', files: diff.deleted },
    { key: 'unchanged', label: 'Unchanged', icon: <Equal className="w-3.5 h-3.5" />, color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', files: diff.unchanged },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <FolderTree className="w-4 h-4 text-zinc-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Diff Summary</h3>
        <div className="flex gap-1.5 ml-auto">
          {sections.map((s) => (
            <span key={s.key} className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.bg} ${s.color} border ${s.border}`}>
              {s.label} {s.files.length}
            </span>
          ))}
        </div>
      </div>
      {sections.map((section) => (
        <div key={section.key} className="rounded-lg border border-zinc-800/40 overflow-hidden">
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
            className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] hover:bg-zinc-800/40 transition-colors"
          >
            {expandedSections[section.key] ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
            <span className={`flex items-center gap-1.5 text-xs font-medium ${section.color}`}>
              {section.icon}
              {section.label}
            </span>
            <span className="text-xs text-zinc-500 ml-auto">{section.files.length} files</span>
          </button>
          <AnimatePresence>
            {expandedSections[section.key] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                  {section.files.length === 0 ? (
                    <p className="text-xs text-zinc-600 px-2 py-1">No {section.label.toLowerCase()} files</p>
                  ) : (
                    section.files.map((file) => (
                      <div key={file} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/40 transition-colors">
                        <FileText className={`w-3 h-3 shrink-0 ${section.color}`} />
                        <span className={`text-xs truncate ${section.color}`}>{file}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

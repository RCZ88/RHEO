import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Import, FileUp, FileCode2, HelpCircle, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ValidationReport } from './ValidationReport';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';
import type { ValidationIssue } from '../../shared/learn/types';

export function ImportView({ importText, setImportText, onImport, onPickFile, onImportExample, importingExample, loading, result, mode, setMode, errors, warnings, onJumpToNode, onShowOnboarding }: {
  importText: string;
  setImportText: (v: string) => void;
  onImport: () => void;
  onPickFile: () => void;
  onImportExample: () => void;
  importingExample: boolean;
  loading: boolean;
  result: any;
  mode: 'pick' | 'paste' | null;
  setMode: (m: 'pick' | 'paste' | null) => void;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  onJumpToNode: (nodeId: string) => void;
  onShowOnboarding: () => void;
}) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-100">Import lesson</h2>
        <span className="text-[10px] text-zinc-600">lmd-import v2</span>
        <button
          onClick={onShowOnboarding}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          How it works
        </button>
      </div>

      <div className="space-y-6">
        {/* Worked example */}
        <div className="p-5 rounded-xl border border-zinc-700/40 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-zinc-200">Start with the worked example</h3>
              <p className="text-xs text-zinc-500 mt-1">Memory Hierarchy — demonstrates all 10 block types</p>
            </div>
            <button
              onClick={onImportExample}
              disabled={importingExample}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-clay-500/20 hover:bg-clay-500/30 text-clay-300 text-sm font-medium transition border border-clay-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importingExample ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {importingExample ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          <button
            onClick={() => setMode('pick')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              mode === 'pick' ? 'bg-zinc-800/60 text-zinc-200 border-b-2 border-clay-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileUp className="w-3.5 h-3.5 inline mr-1.5" />
            Pick file
          </button>
          <button
            onClick={() => setMode('paste')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              mode === 'paste' ? 'bg-zinc-800/60 text-zinc-200 border-b-2 border-clay-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 inline mr-1.5" />
            Paste lesson
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'pick' && (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button
                onClick={onPickFile}
                className="w-full flex flex-col items-center justify-center gap-3 px-6 py-12 rounded-xl border-2 border-dashed border-zinc-700/50 hover:border-zinc-600/50 hover:bg-zinc-800/20 transition text-zinc-400 hover:text-zinc-300 cursor-pointer"
              >
                <FileUp className="w-8 h-8" />
                <div>
                  <div className="text-sm font-medium">Click to select a lesson file</div>
                  <div className="text-xs text-zinc-600 mt-1">.lmd, .ldoc, or .json</div>
                </div>
              </button>
            </motion.div>
          )}

          {mode === 'paste' && (
            <motion.div key="paste" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-zinc-500">Paste .lmd or .ldoc content</span>
                <FieldAIButton
                  fieldName="importText"
                  label="Lesson Content"
                  value={importText}
                  onUpdate={setImportText}
                  allFields={{ importText }}
                  category="learn"
                  context="Help convert or validate this lesson content format"
                />
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full h-64 px-4 py-3 rounded-xl bg-zinc-800/40 border border-zinc-700/50 text-zinc-200 text-sm font-mono focus:border-clay-500/50 focus:outline-none resize-y placeholder:text-zinc-600 transition"
                placeholder='Paste your .lmd lesson (starts with ---) or compiled .ldoc JSON'
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Validation report */}
        {(errors.length > 0 || warnings.length > 0) && (
          <ValidationReport errors={errors} warnings={warnings} onJumpToNode={onJumpToNode} />
        )}

        {/* Import button */}
        {importText && (
          <button
            onClick={onImport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-clay-500/20 hover:bg-clay-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-clay-300 font-medium transition border border-clay-500/30"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Import className="w-4 h-4" />}
            {loading ? 'Validating & importing...' : 'Validate & Import'}
          </button>
        )}

        {/* Result feedback */}
        {result && (
          <div className={`p-5 rounded-xl border ${result.ok ? 'border-clay-400/30 bg-clay-500/5 shadow-[0_0_20px_rgba(194,85,58,0.15)]' : 'border-zinc-600/40 bg-zinc-800/40'}`}>
            {result.ok ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sage-400" />
                <div>
                  <div className="text-sm text-clay-300 font-medium">Import successful</div>
                  {result.data.lessonId && <div className="text-xs text-zinc-500 mt-1">Lesson: {result.data.lessonId}</div>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-red-400 font-medium">Import failed</div>
                  <div className="text-xs text-zinc-500 mt-1">{result.error}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

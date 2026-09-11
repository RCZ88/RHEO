import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert,
  Plus,
  Trash2,
  RefreshCw,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  FolderOpen,
  X,
  Settings2,
} from 'lucide-react'
import { GlassCard } from '../GlassCard'
import { cn } from './lib/cn'

interface TrackedWord {
  id: number
  word: string
  label: string
  color: string
  enabled: number
  tolerance: string
  created_at: string
}

interface WordCount {
  id: number
  word_id: number
  project_id: string | null
  count: number
  last_scanned_at: string | null
  word: string
  label: string
  color: string
  project_name?: string | null
}

function safeWordCount(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(count) ? count : 0
}

interface Project {
  id: string
  name: string
  path: string
}

const PRESET_COLORS = [
  '#f59e0b', '#ef4444', '#ec4899', '#a855f7',
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
]

const DEFAULT_WORDS = [
  { word: 'idiot', label: 'Idiot', color: '#ef4444' },
  { word: 'stupid', label: 'Stupid', color: '#f97316' },
  { word: 'damn', label: 'Damn', color: '#f59e0b' },
  { word: 'hell', label: 'Hell', color: '#eab308' },
  { word: 'crap', label: 'Crap', color: '#84cc16' },
]

export function WordTrackerPanel({ overview }: { overview: any }) {
  const [words, setWords] = useState<TrackedWord[]>([])
  const [counts, setCounts] = useState<WordCount[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [mode, setMode] = useState<'realtime' | 'jsonl'>('jsonl')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ scanned: number; counts: Record<string, number> } | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [newWord, setNewWord] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [newTolerance, setNewTolerance] = useState('stem')
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedWord, setExpandedWord] = useState<number | null>(null)
  const [projectCounts, setProjectCounts] = useState<WordCount[]>([])
  const [loading, setLoading] = useState(false)

  const api = (window as any).deskflowAPI

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [w, c, p] = await Promise.all([
        api?.wordTrackerGetWords?.() ?? [],
        api?.wordTrackerCounts?.(selectedProject || undefined) ?? [],
        api?.getProjects?.() ?? [],
      ])
      setWords(w)
      setCounts(c)
      setProjects(p)
      const savedMode = await api?.wordTrackerGetConfig?.('mode')
      if (savedMode === 'realtime' || savedMode === 'jsonl') setMode(savedMode)
      const savedCase = await api?.wordTrackerGetConfig?.('case_sensitive')
      setCaseSensitive(savedCase === 'true')
    } catch (err) {
      console.error('[WordTracker] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedProject])

  useEffect(() => { loadData() }, [loadData])

  const handleAddWord = async () => {
    if (!newWord.trim()) return
    const result = await api?.wordTrackerAddWord?.(newWord.trim(), undefined, newColor, newTolerance)
    if (result?.success) {
      setNewWord('')
      setShowAddForm(false)
      loadData()
    }
  }

  const handleRemoveWord = async (wordId: number) => {
    await api?.wordTrackerRemoveWord?.(wordId)
    loadData()
  }

  const handleToggleWord = async (wordId: number, enabled: boolean) => {
    await api?.wordTrackerToggleWord?.(wordId, enabled)
    loadData()
  }

  const handleSetTolerance = async (wordId: number, tolerance: string) => {
    await api?.wordTrackerSetTolerance?.(wordId, tolerance)
    loadData()
  }

  const handleCaseSensitiveToggle = async () => {
    const next = !caseSensitive
    setCaseSensitive(next)
    await api?.wordTrackerSetConfig?.('case_sensitive', String(next))
  }

  const [editingWord, setEditingWord] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState(PRESET_COLORS[0])
  const [editTolerance, setEditTolerance] = useState('exact')

  const startEdit = (word: TrackedWord) => {
    setEditingWord(word.id)
    setEditText(word.word)
    setEditLabel(word.label)
    setEditColor(word.color)
    setEditTolerance(word.tolerance || 'exact')
  }

  const saveEdit = async () => {
    if (!editingWord || !editText.trim()) return
    await api?.wordTrackerEditWord?.(editingWord, {
      word: editText.trim(),
      label: editLabel.trim() || editText.trim(),
      color: editColor,
      tolerance: editTolerance,
    })
    setEditingWord(null)
    loadData()
  }

  const handleScan = async () => {
    setScanning(true)
    setScanResult(null)
    try {
      const result = await api?.wordTrackerScanJsonl?.(selectedProject || undefined)
      setScanResult(result)
      loadData()
    } catch (err) {
      console.error('[WordTracker] scan error:', err)
    } finally {
      setScanning(false)
    }
  }

  const handleReset = async () => {
    await api?.wordTrackerResetCounts?.()
    setScanResult(null)
    loadData()
  }

  const handleModeChange = async (newMode: 'realtime' | 'jsonl') => {
    setMode(newMode)
    await api?.wordTrackerSetConfig?.('mode', newMode)
  }

  const handleExpandWord = async (wordId: number) => {
    if (expandedWord === wordId) {
      setExpandedWord(null)
      return
    }
    setExpandedWord(wordId)
    const pc = await api?.wordTrackerCountsByProject?.(wordId)
    setProjectCounts(pc || [])
  }

  const totalAllCounts = counts.reduce((sum, c) => sum + safeWordCount(c.count), 0)

  const initDefaults = async () => {
    for (const d of DEFAULT_WORDS) {
      await api?.wordTrackerAddWord?.(d.word, d.label, d.color)
    }
    loadData()
  }

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-100">
              Word Tracker
            </h3>
            <p className="text-[11px] text-zinc-500 light:text-stone-500">
              {words.length} tracked word{words.length !== 1 ? 's' : ''} &middot; {totalAllCounts.toLocaleString()} total hit{totalAllCounts !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-zinc-500 light:text-stone-500 hover:text-zinc-200 hover:bg-zinc-800 light:bg-stone-200 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* Controls Row */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-zinc-900/60 light:bg-stone-200 rounded-lg p-0.5 ring-1 ring-zinc-800/50">
                <button
                  onClick={() => handleModeChange('realtime')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150',
                    mode === 'realtime'
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  Real-time
                </button>
                <button
                  onClick={() => handleModeChange('jsonl')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150',
                    mode === 'jsonl'
                      ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  JSONL Scan
                </button>
              </div>

              {/* Case Sensitivity Toggle */}
              <button
                onClick={handleCaseSensitiveToggle}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] ring-1 transition-colors',
                  caseSensitive
                    ? 'bg-amber-500/15 ring-amber-500/30 text-amber-300'
                    : 'text-zinc-500 bg-zinc-900/60 hover:text-zinc-200 ring-zinc-800/50'
                )}
                title={caseSensitive ? 'Case sensitive: "Idiot" ≠ "idiot"' : 'Case insensitive: "Idiot" = "idiot" = "IDIOT"'}
              >
                <span className="font-mono text-[10px]">{caseSensitive ? 'Aa' : 'aA'}</span>
                {caseSensitive ? 'Exact Case' : 'Any Case'}
              </button>

              {/* Project Filter */}
              <div className="relative">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="appearance-none pl-7 pr-6 py-1.5 bg-zinc-900/60 text-[11px] text-zinc-300 light:text-stone-700 rounded-lg ring-1 ring-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <FolderOpen className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 light:text-stone-500 pointer-events-none" />
              </div>

              {/* Actions */}
              {mode === 'jsonl' && (
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-500/15 text-violet-300 rounded-lg text-[11px] ring-1 ring-violet-500/30 hover:bg-violet-500/25 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={cn('w-3 h-3', scanning && 'animate-spin')} />
                  {scanning ? 'Scanning...' : 'Scan'}
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/70 text-zinc-400 light:text-stone-500 hover:text-zinc-200 light:hover:text-stone-800 rounded-lg text-[11px] ring-1 ring-zinc-700/60 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/15 text-amber-300 rounded-lg text-[11px] ring-1 ring-amber-500/30 hover:bg-amber-500/25 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Word
              </button>
              {words.length === 0 && (
                <button
                  onClick={initDefaults}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/70 text-zinc-400 light:text-stone-500 hover:text-zinc-200 light:hover:text-stone-800 rounded-lg text-[11px] ring-1 ring-zinc-700/60 transition-colors"
                >
                  Load Defaults
                </button>
              )}
            </div>

            {/* Scan Result */}
            <AnimatePresence>
              {scanResult && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-3 p-3 bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/20"
                >
                  <div className="text-[11px] text-emerald-300">
                    Scanned {scanResult.scanned} file{scanResult.scanned !== 1 ? 's' : ''}
                    {Object.keys(scanResult.counts).length > 0 && (
                      <> &mdash; {Object.entries(scanResult.counts).map(([w, c]) => `${w}: ${c}`).join(', ')}</>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add Word Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-3"
                >
                  <div className="p-3 bg-zinc-900/60 light:bg-stone-200 rounded-xl ring-1 ring-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="w-3.5 h-3.5 text-zinc-500 light:text-stone-500" />
                      <span className="text-[11px] text-zinc-500 light:text-stone-500 uppercase tracking-wider font-medium">
                        Add word to track
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                        placeholder="Enter word..."
                        className="flex-1 px-3 py-1.5 bg-zinc-800/60 text-sm text-zinc-100 rounded-lg ring-1 ring-zinc-700/60 placeholder:text-zinc-600 light:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      <div className="flex items-center gap-1">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setNewColor(c)}
                            className={cn(
                              'w-5 h-5 rounded-full ring-1 transition-all',
                              newColor === c ? 'ring-white scale-125' : 'ring-zinc-700 hover:ring-zinc-500'
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={handleAddWord}
                        disabled={!newWord.trim()}
                        className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-lg text-[11px] font-medium ring-1 ring-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="p-1.5 text-zinc-500 light:text-stone-500 hover:text-zinc-200 hover:bg-zinc-800 light:bg-stone-200 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Tolerance selector */}
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-3 h-3 text-zinc-600 light:text-stone-500" />
                      <span className="text-[10px] text-zinc-600 light:text-stone-500 uppercase tracking-wider">Tolerance:</span>
                      {(['exact', 'stem', 'fuzzy'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setNewTolerance(t)}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-medium ring-1 transition-colors',
                            newTolerance === t
                              ? t === 'exact' ? 'bg-blue-500/20 text-blue-300 ring-blue-500/30'
                                : t === 'stem' ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30'
                                : 'bg-orange-500/20 text-orange-300 ring-orange-500/30'
                              : 'text-zinc-600 ring-zinc-800/40 hover:text-zinc-400'
                          )}
                        >
                          {t === 'exact' ? 'Exact' : t === 'stem' ? 'Smart Stem' : 'Fuzzy Match'}
                        </button>
                      ))}
                      <span className="text-[10px] text-zinc-700 ml-1">
                        {newTolerance === 'exact' && 'only exact word'}
                        {newTolerance === 'stem' && 'word + variations (idiots, idiotic)'}
                        {newTolerance === 'fuzzy' && 'misspellings + Levenshtein'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Word List */}
            {words.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 light:text-stone-500 text-sm">
                No tracked words yet. Click &quot;Add Word&quot; or &quot;Load Defaults&quot; to start.
              </div>
            ) : (
              <div className="space-y-1.5">
                {words.map((word) => {
                  const wordCount = counts.find((c) => c.word_id === word.id)
                   const count = safeWordCount(wordCount?.count)
                  const isEditing = editingWord === word.id

                  if (isEditing) {
                    return (
                      <div key={word.id} className="p-3 bg-zinc-900/60 light:bg-stone-200 rounded-xl ring-1 ring-amber-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] text-amber-400 uppercase tracking-wider font-medium">Editing</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="flex-1 px-3 py-1.5 bg-zinc-800/60 light:bg-stone-200 text-sm text-zinc-100 rounded-lg ring-1 ring-zinc-700/60 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Label"
                            className="w-28 px-2 py-1.5 bg-zinc-800/60 text-sm text-zinc-300 rounded-lg ring-1 ring-zinc-700/60 placeholder:text-zinc-600 light:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                          />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className={cn(
                                'w-5 h-5 rounded-full ring-1 transition-all',
                                editColor === c ? 'ring-white scale-125' : 'ring-zinc-700 hover:ring-zinc-500'
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Settings2 className="w-3 h-3 text-zinc-600 light:text-stone-500" />
                          {(['exact', 'stem', 'fuzzy'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setEditTolerance(t)}
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-medium ring-1 transition-colors',
                                editTolerance === t
                                  ? t === 'exact' ? 'bg-blue-500/20 text-blue-300 ring-blue-500/30'
                                    : t === 'stem' ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30'
                                    : 'bg-orange-500/20 text-orange-300 ring-orange-500/30'
                                  : 'text-zinc-600 ring-zinc-800/40 hover:text-zinc-400'
                              )}
                            >
                              {t === 'exact' ? 'Exact' : t === 'stem' ? 'Smart Stem' : 'Fuzzy'}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-[11px] font-medium ring-1 ring-amber-500/30 hover:bg-amber-500/30">Save</button>
                          <button onClick={() => setEditingWord(null)} className="px-3 py-1 bg-zinc-800/70 text-zinc-400 light:text-stone-500 rounded-lg text-[11px] ring-1 ring-zinc-700/60 hover:text-zinc-200 light:hover:text-stone-800">Cancel</button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={word.id}>
                      <div
                        className={cn(
                          'flex items-center gap-3 p-2.5 rounded-xl transition-colors duration-150 group',
                          word.enabled ? 'bg-zinc-900/40 hover:bg-zinc-900/60' : 'bg-zinc-900/20 opacity-50'
                        )}
                      >
                        {/* Color dot */}
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: word.color }}
                        />

                        {/* Word + Count + Tolerance */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-zinc-200">
                              {word.word}
                            </span>
                            <span className="text-[11px] text-zinc-500 light:text-stone-500">
                              {word.label}
                            </span>
                            {/* Tolerance badge */}
                            <button
                              onClick={() => {
                                const next = word.tolerance === 'exact' ? 'stem' : word.tolerance === 'stem' ? 'fuzzy' : 'exact'
                                handleSetTolerance(word.id, next)
                              }}
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ring-1 transition-colors cursor-pointer',
                                (word.tolerance || 'exact') === 'exact'
                                  ? 'bg-blue-500/15 text-blue-400 ring-blue-500/20'
                                  : (word.tolerance || 'exact') === 'stem'
                                  ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20'
                                  : 'bg-orange-500/15 text-orange-400 ring-orange-500/20'
                              )}
                              title={`Click to cycle: exact → stem → fuzzy (current: ${word.tolerance || 'exact'})`}
                            >
                              {word.tolerance || 'exact'}
                            </button>
                          </div>
                        </div>

                        {/* Count badge */}
                        <button
                          onClick={() => handleExpandWord(word.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-colors ring-1',
                            count > 0
                              ? 'bg-amber-500/15 text-amber-300 ring-amber-500/20 hover:bg-amber-500/25'
                              : 'bg-zinc-800/60 text-zinc-500 ring-zinc-700/40'
                          )}
                        >
                          <span>{safeWordCount(count).toLocaleString()}</span>
                          {expandedWord === word.id ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {/* Toggle */}
                        <button
                          onClick={() => handleToggleWord(word.id, !word.enabled)}
                          className="text-zinc-500 light:text-stone-500 hover:text-zinc-200 light:hover:text-stone-800 transition-colors"
                        >
                          {word.enabled ? (
                            <ToggleRight className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => startEdit(word)}
                          className="p-1 text-zinc-600 light:text-stone-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all"
                          title="Edit word"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleRemoveWord(word.id)}
                          className="p-1 text-zinc-600 light:text-stone-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Expanded: per-project breakdown */}
                      <AnimatePresence>
                        {expandedWord === word.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-8 mr-2 mb-1 p-2 bg-zinc-950/60 light:bg-white rounded-lg ring-1 ring-zinc-800/40">
                              {projectCounts.length === 0 ? (
                                <div className="text-[11px] text-zinc-600 light:text-stone-500 py-1">No project data yet</div>
                              ) : (
                                <div className="space-y-1">
                                  {projectCounts.map((pc) => (
                                    <div key={pc.id} className="flex items-center justify-between text-[11px]">
                                      <span className="text-zinc-400 light:text-stone-500">{pc.project_name || 'No project'}</span>
                                       <span className="text-amber-400 font-medium">{safeWordCount(pc.count).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  )
}

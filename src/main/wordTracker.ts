import { randomUUID } from 'crypto'

interface TrackedWord {
  id: number
  word: string
  label: string
  color: string
  enabled: number
  tolerance: string
  created_at: string
}

interface WordCountRow {
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

// In-memory store (backed by the words table recreated on startup)
let words: TrackedWord[] = []
let nextWordId = 1
let counts: WordCountRow[] = []
let wordTrackerConfig: Record<string, string> = {}

// DB reference - set during init
let db: any = null

function now(): string {
  return new Date().toISOString()
}

function findWordIndex(id: number): number {
  return words.findIndex(w => w.id === id)
}

function findCount(wordId: number, projectId?: string): number {
  return counts.findIndex(c => c.word_id === wordId && c.project_id === (projectId ?? null))
}

export function initWordTracker(dbInstance: any): void {
  db = dbInstance
  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_tracker_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#f59e0b',
      enabled INTEGER DEFAULT 1,
      tolerance TEXT DEFAULT 'exact',
      created_at TEXT NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_tracker_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      project_id TEXT NULL,
      count INTEGER DEFAULT 0,
      last_scanned_at TEXT NULL,
      word TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      project_name TEXT NULL,
      FOREIGN KEY (word_id) REFERENCES word_tracker_words(id)
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_wt_words_id ON word_tracker_words(id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_wt_counts_word_id ON word_tracker_counts(word_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_wt_counts_project ON word_tracker_counts(project_id)')

  // Load words from DB
  const rows = db.prepare('SELECT * FROM word_tracker_words ORDER BY id').all()
  words = rows.map((r: any) => ({
    id: r.id,
    word: r.word,
    label: r.label,
    color: r.color,
    enabled: r.enabled,
    tolerance: r.tolerance,
    created_at: r.created_at,
  }))
  if (words.length === 0) {
    const defaults = [
      { word: 'idiot', label: 'Idiot', color: '#ef4444' },
      { word: 'stupid', label: 'Stupid', color: '#f97316' },
      { word: 'damn', label: 'Damn', color: '#f59e0b' },
      { word: 'hell', label: 'Hell', color: '#eab308' },
      { word: 'crap', label: 'Crap', color: '#84cc16' },
    ]
    for (const d of defaults) {
      const id = nextWordId++
      words.push({ id, ...d, enabled: 1, tolerance: 'exact', created_at: now() })
      db.prepare('INSERT INTO word_tracker_words (id, word, label, color, enabled, tolerance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, d.word, d.label, d.color, 1, 'exact', now())
    }
  } else {
    nextWordId = Math.max(...words.map(w => w.id)) + 1
  }

  // Load counts from DB
  const countRows = db.prepare('SELECT * FROM word_tracker_counts ORDER BY id').all()
  counts = countRows.map((r: any) => ({
    id: r.id,
    word_id: r.word_id,
    project_id: r.project_id,
    count: r.count,
    last_scanned_at: r.last_scanned_at,
    word: r.word,
    label: r.label,
    color: r.color,
    project_name: r.project_name,
  }))

  // Load config
  const configRows = db.prepare('SELECT * FROM word_tracker_config').all()
  wordTrackerConfig = {}
  for (const r of configRows) {
    wordTrackerConfig[r.key] = r.value
  }
}

export function ensureWordTrackerTables(dbInstance: any): void {
  db = dbInstance
  db.exec('CREATE TABLE IF NOT EXISTS word_tracker_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
}

export function wordTrackerGetWords(): TrackedWord[] {
  return [...words]
}

export function wordTrackerAddWord(word: string, label?: string, color?: string, tolerance?: string): { success: boolean; id?: number; message?: string } {
  if (!word || !word.trim()) {
    return { success: false, message: 'Word cannot be empty' }
  }
  const id = nextWordId++
  const newWord: TrackedWord = {
    id,
    word: word.trim(),
    label: label?.trim() || word.trim(),
    color: color || '#f59e0b',
    enabled: 1,
    tolerance: tolerance || 'exact',
    created_at: now(),
  }
  words.push(newWord)
  if (db) {
    db.prepare('INSERT INTO word_tracker_words (id, word, label, color, enabled, tolerance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, newWord.word, newWord.label, newWord.color, newWord.enabled, newWord.tolerance, newWord.created_at)
  }
  return { success: true, id }
}

export function wordTrackerEditWord(wordId: number, updates: { word?: string; label?: string; color?: string; tolerance?: string }): { success: boolean; message?: string } {
  const idx = findWordIndex(wordId)
  if (idx === -1) {
    return { success: false, message: `Word with id ${wordId} not found` }
  }
  if (updates.word !== undefined) words[idx].word = updates.word.trim()
  if (updates.label !== undefined) words[idx].label = updates.label.trim()
  if (updates.color !== undefined) words[idx].color = updates.color
  if (updates.tolerance !== undefined) words[idx].tolerance = updates.tolerance
  if (db) {
    const stmt = db.prepare('UPDATE word_tracker_words SET word = ?, label = ?, color = ?, tolerance = ? WHERE id = ?')
    stmt.run(words[idx].word, words[idx].label, words[idx].color, words[idx].tolerance, wordId)
  }
  return { success: true }
}

export function wordTrackerRemoveWord(wordId: number): { success: boolean; message?: string } {
  const idx = findWordIndex(wordId)
  if (idx === -1) {
    return { success: false, message: `Word with id ${wordId} not found` }
  }
  words.splice(idx, 1)
  counts = counts.filter(c => c.word_id !== wordId)
  if (db) {
    db.prepare('DELETE FROM word_tracker_counts WHERE word_id = ?').run(wordId)
    db.prepare('DELETE FROM word_tracker_words WHERE id = ?').run(wordId)
  }
  return { success: true }
}

export function wordTrackerToggleWord(wordId: number, enabled: boolean): { success: boolean } {
  const idx = findWordIndex(wordId)
  if (idx === -1) return { success: false }
  words[idx].enabled = enabled ? 1 : 0
  if (db) {
    db.prepare('UPDATE word_tracker_words SET enabled = ? WHERE id = ?').run(words[idx].enabled, wordId)
  }
  return { success: true }
}

export function wordTrackerSetTolerance(wordId: number, tolerance: string): { success: boolean } {
  const idx = findWordIndex(wordId)
  if (idx === -1) return { success: false }
  words[idx].tolerance = tolerance
  if (db) {
    db.prepare('UPDATE word_tracker_words SET tolerance = ? WHERE id = ?').run(tolerance, wordId)
  }
  return { success: true }
}

export function wordTrackerGetConfig(key: string): string | null {
  if (db) {
    const row = db.prepare('SELECT value FROM word_tracker_config WHERE key = ?').get(key)
    return row ? row.value : null
  }
  return wordTrackerConfig[key] ?? null
}

export function wordTrackerSetConfig(key: string, value: string): { success: boolean; message?: string } {
  wordTrackerConfig[key] = value
  if (db) {
    db.prepare('INSERT OR REPLACE INTO word_tracker_config (key, value) VALUES (?, ?)').run(key, value)
  }
  return { success: true }
}

export function wordTrackerGetCounts(projectId?: string): WordCountRow[] {
  if (projectId) {
    return counts.filter(c => c.project_id === projectId)
  }
  return [...counts]
}

export function wordTrackerCountsByProject(wordId: number): WordCountRow[] {
  return counts.filter(c => c.word_id === wordId)
}

export function wordTrackerResetCounts(): { success: boolean; message?: string } {
  counts = []
  if (db) {
    db.prepare('DELETE FROM word_tracker_counts').run()
  }
  return { success: true }
}

export function wordTrackerCountText(text: string, projectId?: string): { success: boolean; counts: Record<string, number>; message?: string } {
  const result: Record<string, number> = {}
  const lowerText = text.toLowerCase()
  for (const word of words) {
    if (!word.enabled) continue
    const searchWord = word.tolerance === 'exact' ? word.word.toLowerCase() : word.word.toLowerCase()
    const searchTerm = word.tolerance === 'stem' ? searchWord.replace(/ing$|ed$|s$/, '') : searchWord
    const searchTermLower = searchTerm.toLowerCase()
    const regex = new RegExp(searchTermLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches = lowerText.match(regex)
    if (matches && matches.length > 0) {
      result[word.label] = matches.length
    }
  }
  // Persist counts
  for (const [label, count] of Object.entries(result)) {
    const word = words.find(w => w.label === label)
    if (word) {
      const idx = findCount(word.id, projectId)
      if (idx !== -1) {
        counts[idx].count = count
        counts[idx].last_scanned_at = now()
      } else {
        counts.push({
          id: counts.length > 0 ? Math.max(...counts.map(c => c.id)) + 1 : 1,
          word_id: word.id,
          project_id: projectId ?? null,
          count,
          last_scanned_at: now(),
          word: word.word,
          label: word.label,
          color: word.color,
          project_name: undefined,
        })
      }
    }
  }
  if (db) {
    const insertStmt = db.prepare('INSERT OR REPLACE INTO word_tracker_counts (id, word_id, project_id, count, last_scanned_at, word, label, color, project_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const c of counts) {
      insertStmt.run(c.id, c.word_id, c.project_id, c.count, c.last_scanned_at, c.word, c.label, c.color, c.project_name ?? null)
    }
  }
  return { success: true, counts, message: `Counted ${Object.values(result).reduce((a, b) => a + b, 0)} occurrences` }
}

export function wordTrackerScanJsonl(projectId?: string): { success: boolean; scanned: number; counts: Record<string, number>; message?: string } {
  return { success: true, scanned: 0, counts: {}, message: 'JSONL scan not yet implemented' }
}
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

function now(): string {
  return new Date().toISOString()
}

function findWordIndex(id: number): number {
  return words.findIndex(w => w.id === id)
}

function findCount(wordId: number, projectId?: string): number {
  return counts.findIndex(c => c.word_id === wordId && c.project_id === (projectId ?? null))
}

export function initWordTracker() {
  // Seed default words if empty
  if (words.length === 0) {
    const defaults = [
      { word: 'idiot', label: 'Idiot', color: '#ef4444' },
      { word: 'stupid', label: 'Stupid', color: '#f97316' },
      { word: 'damn', label: 'Damn', color: '#f59e0b' },
      { word: 'hell', label: 'Hell', color: '#eab308' },
      { word: 'crap', label: 'Crap', color: '#84cc16' },
    ]
    for (const d of defaults) {
      words.push({
        id: nextWordId++,
        word: d.word,
        label: d.label,
        color: d.color,
        enabled: 1,
        tolerance: 'exact',
        created_at: now(),
      })
    }
  }
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
  return { success: true }
}

export function wordTrackerRemoveWord(wordId: number): { success: boolean; message?: string } {
  const idx = findWordIndex(wordId)
  if (idx === -1) {
    return { success: false, message: `Word with id ${wordId} not found` }
  }
  words.splice(idx, 1)
  counts = counts.filter(c => c.word_id !== wordId)
  return { success: true }
}

export function wordTrackerToggleWord(wordId: number, enabled: boolean): { success: boolean } {
  const idx = findWordIndex(wordId)
  if (idx === -1) return { success: false }
  words[idx].enabled = enabled ? 1 : 0
  return { success: true }
}

export function wordTrackerSetTolerance(wordId: number, tolerance: string): { success: boolean } {
  const idx = findWordIndex(wordId)
  if (idx === -1) return { success: false }
  words[idx].tolerance = tolerance
  return { success: true }
}

export function wordTrackerGetConfig(key: string): string | null {
  return wordTrackerConfig[key] ?? null
}

export function wordTrackerSetConfig(key: string, value: string): { success: boolean; message?: string } {
  wordTrackerConfig[key] = value
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
  return { success: true, counts, message: `Counted ${Object.values(result).reduce((a, b) => a + b, 0)} occurrences` }
}

export function wordTrackerScanJsonl(projectId?: string): { success: boolean; scanned: number; counts: Record<string, number>; message?: string } {
  // Placeholder implementation - in a real app this would scan project files
  return { success: true, scanned: 0, counts: {}, message: 'JSONL scan not yet implemented' }
}

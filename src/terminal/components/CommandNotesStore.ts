import { uid } from '../lib/data';

export interface CommandNote {
  id: string;
  command: string;
  section: string;
  sectionTitle: string;
  title: string;
  summary: string;
  what: string;
  when: string;
  gotcha: string;
  params: Array<{ name: string; meaning: string }>;
  safety: string;
  related: string[];
  savedAt: number;
  savedBy: 'ai' | 'manual';
  aiRaw?: string;
}

const LS_KEY = 'penguin-console-command-notes';

function load(): CommandNote[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

let _lastWriteOk = true;

function write(notes: CommandNote[]): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(notes));
    _lastWriteOk = true;
    return true;
  } catch (e) {
    _lastWriteOk = false;
    // Quota exceeded / private mode: the note is NOT saved, and the caller must
    // be able to say so instead of rendering a success that lost the data.
    console.error('[CommandNotes] write failed', e);
    return false;
  }
}

/** Bumped on every mutation so consumers can mem without re-parsing storage. */
let _version = 0;
const listeners = new Set<() => void>();
export function subscribeNotes(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function notesVersion() { return _version; }
function bump() { _version++; listeners.forEach((fn) => fn()); }

export const commandNotes = {
  /** True when the most recent write actually reached storage. */
  lastWriteOk(): boolean { return _lastWriteOk; },

  list(): CommandNote[] {
    return load().sort((a, b) => b.savedAt - a.savedAt);
  },

  get(command: string): CommandNote | undefined {
    return load().find(n => n.command === command);
  },

  add(note: Omit<CommandNote, 'id' | 'savedAt' | 'savedBy'>, aiRaw?: string): CommandNote {
    const notes = load();
    const existing = notes.findIndex(n => n.command === note.command);
    const entry: CommandNote = {
      id: uid('cn'),
      ...note,
      savedAt: Date.now(),
      savedBy: 'ai',
      aiRaw,
    };
    if (existing >= 0) {
      notes[existing] = entry;
    } else {
      notes.unshift(entry);
    }
    if (!write(notes)) return entry;
    bump();
    return entry;
  },

  update(id: string, patch: Partial<Pick<CommandNote, 'title' | 'summary' | 'what' | 'when' | 'gotcha'>>): boolean {
    const notes = load();
    const i = notes.findIndex(n => n.id === id);
    if (i < 0) return false;
    notes[i] = { ...notes[i], ...patch };
    return write(notes);
  },

  remove(id: string): boolean {
    const notes = load().filter(n => n.id !== id);
    const ok = write(notes);
    if (ok) bump();
    return ok;
  },

  clear(): void {
    localStorage.removeItem(LS_KEY);
  },
};
